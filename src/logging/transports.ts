/**
 * 로그 트랜스포트 구현
 * @description 콘솔 및 파일 로그 전송
 */

import type { LogEntry, LogTransport, LoggerOptions, LogFormatter } from './types.js';
import { LogOutput } from './types.js';
import { createFormatter } from './formatters.js';
import { LogRotator } from './rotation.js';

/**
 * 콘솔 트랜스포트
 */
export class ConsoleTransport implements LogTransport {
  private formatter: LogFormatter;

  constructor(format: 'json' | 'pretty' = 'pretty', useColors: boolean = true) {
    this.formatter = createFormatter(format, useColors);
  }

  send(entry: LogEntry): void {
    const formatted = this.formatter.format(entry);

    switch (entry.level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  async close(): Promise<void> {
    // 콘솔은 별도 정리 필요 없음
  }
}

/**
 * 파일 트랜스포트
 */
export class FileTransport implements LogTransport {
  private rotator: LogRotator;
  private formatter: LogFormatter;

  constructor(logFilePath: string, maxSize?: number, maxFiles?: number) {
    const { dirname, basename } = require('path');
    this.rotator = new LogRotator({
      logDir: dirname(logFilePath),
      filename: basename(logFilePath),
      maxSize: maxSize || 10 * 1024 * 1024,
      maxFiles: maxFiles || 5,
    });
    this.formatter = createFormatter('json', false);
  }

  send(entry: LogEntry): void {
    const formatted = this.formatter.format(entry);
    this.rotator.write(formatted);
  }

  async close(): Promise<void> {
    // 파일 핸들은 appendFileSync에서 자동 관리
  }

  /**
   * 현재 로그 파일 경로 반환
   */
  getCurrentFile(): string {
    return this.rotator.getCurrentFile();
  }

  /**
   * 로그 파일 목록 조회
   */
  getLogFiles(): string[] {
    return this.rotator.getLogFiles();
  }
}

/**
 * 복합 트랜스포트 (콘솔 + 파일)
 */
export class CompositeTransport implements LogTransport {
  private consoleTransport: ConsoleTransport;
  private fileTransport?: FileTransport;

  constructor(options: LoggerOptions) {
    this.consoleTransport = new ConsoleTransport(
      options.consoleFormat,
      options.useColors
    );

    if (options.output === LogOutput.FILE || options.output === LogOutput.BOTH) {
      if (options.logFilePath) {
        this.fileTransport = new FileTransport(
          options.logFilePath,
          options.maxFileSize,
          options.maxFiles
        );
      }
    }
  }

  send(entry: LogEntry): void {
    // 항상 콘솔에 출력
    this.consoleTransport.send(entry);

    // 파일에도 출력 (설정된 경우)
    if (this.fileTransport) {
      this.fileTransport.send(entry);
    }
  }

  async close(): Promise<void> {
    await this.consoleTransport.close();
    if (this.fileTransport) {
      await this.fileTransport.close();
    }
  }

  /**
   * 파일 트랜스포트 접근 (테스트용)
   */
  getFileTransport(): FileTransport | undefined {
    return this.fileTransport;
  }
}

/**
 * 메모리 트랜스포트 (테스트용)
 */
export class MemoryTransport implements LogTransport {
  private logs: LogEntry[] = [];
  private maxLogs: number;

  constructor(maxLogs: number = 1000) {
    this.maxLogs = maxLogs;
  }

  send(entry: LogEntry): void {
    this.logs.push(entry);

    // 최대 개수 초과 시 오래된 로그 삭제
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  async close(): Promise<void> {
    this.logs = [];
  }

  /**
   * 저장된 로그 조회
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 로그 초기화
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * 특정 레벨 이상의 로그 조회
   */
  getLogsByLevel(level: string): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }
}
