/**
 * 로거 클래스 구현
 * @description 구조화된 JSON 로깅 및 다중 트랜스포트 지원
 */

import type { ILogger, LogEntry, LoggerOptions, LogTransport } from './types.js';
import { LogLevel, LogLevelValue } from './types.js';
import { ConsoleTransport, CompositeTransport } from './transports.js';
import { loadConfig } from './config.js';

/**
 * 로거 클래스
 */
export class Logger implements ILogger {
  private options: LoggerOptions;
  private transport: LogTransport;
  private context: string;
  private defaultMetadata: Record<string, unknown>;

  constructor(options?: Partial<LoggerOptions>) {
    this.options = loadConfig(options);
    this.context = this.options.context || 'app';
    this.defaultMetadata = this.options.defaultMetadata || {};

    // 트랜스포트 초기화
    this.transport = this.createTransport();
  }

  /**
   * 트랜스포트 생성
   */
  private createTransport(): LogTransport {
    switch (this.options.output) {
      case 'console':
        return new ConsoleTransport(
          this.options.consoleFormat,
          this.options.useColors
        );
      case 'file':
      case 'both':
        return new CompositeTransport(this.options);
      default:
        return new ConsoleTransport('pretty', true);
    }
  }

  /**
   * 로그 엔트리 생성
   */
  private createEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      metadata: {
        ...this.defaultMetadata,
        ...metadata,
      },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  /**
   * 로그 레벨 체크
   */
  private shouldLog(level: LogLevel): boolean {
    return LogLevelValue[level] >= LogLevelValue[this.options.minLevel];
  }

  /**
   * 로그 출력
   */
  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    try {
      this.transport.send(entry);
    } catch (err) {
      // 트랜스포트 에러는 콘솔에 직접 출력
      console.error('Failed to send log:', err);
    }
  }

  /**
   * 디버그 로그
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry(LogLevel.DEBUG, message, metadata));
  }

  /**
   * 정보 로그
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry(LogLevel.INFO, message, metadata));
  }

  /**
   * 경고 로그
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry(LogLevel.WARN, message, metadata));
  }

  /**
   * 에러 로그
   */
  error(
    message: string,
    error?: Error,
    metadata?: Record<string, unknown>
  ): void {
    this.log(this.createEntry(LogLevel.ERROR, message, metadata, error));
  }

  /**
   * 로그 레벨 변경
   */
  setLevel(level: LogLevel): void {
    this.options.minLevel = level;
  }

  /**
   * 자식 로거 생성
   */
  child(context: string, metadata?: Record<string, unknown>): ILogger {
    const childOptions: Partial<LoggerOptions> = {
      ...this.options,
      context: `${this.context}:${context}`,
      defaultMetadata: {
        ...this.defaultMetadata,
        ...metadata,
      },
    };

    return new Logger(childOptions);
  }

  /**
   * 로거 종료
   */
  async close(): Promise<void> {
    await this.transport.close();
  }

  /**
   * 현재 설정 조회
   */
  getOptions(): LoggerOptions {
    return { ...this.options };
  }
}

/**
 * 글로벌 로거 인스턴스
 */
let globalLogger: Logger | null = null;

/**
 * 글로벌 로거 초기화
 */
export function initializeLogger(options?: Partial<LoggerOptions>): Logger {
  globalLogger = new Logger(options);
  return globalLogger;
}

/**
 * 글로벌 로거 조회
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

/**
 * 글로벌 로거 종료
 */
export async function closeLogger(): Promise<void> {
  if (globalLogger) {
    await globalLogger.close();
    globalLogger = null;
  }
}
