/**
 * 로그 파일 로테이션 구현
 * @description 파일 크기 기반 로테이션 및 보관 관리
 */

import { existsSync, mkdirSync, renameSync, statSync, unlinkSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';
import type { RotationConfig } from './types.js';

/**
 * 로그 파일 로테이션 관리자
 */
export class LogRotator {
  private config: RotationConfig;
  private currentFile: string;
  private currentSize: number = 0;

  constructor(config: RotationConfig) {
    this.config = {
      ...config,
    };

    // 로그 디렉토리 생성
    this.ensureDirectory();

    // 현재 로그 파일 경로 설정
    this.currentFile = join(this.config.logDir, this.config.filename);

    // 기존 파일 크기 확인
    if (existsSync(this.currentFile)) {
      const stats = statSync(this.currentFile);
      this.currentSize = stats.size;
    }
  }

  /**
   * 로그 메시지 쓰기
   */
  write(message: string): void {
    const messageBytes = Buffer.byteLength(message + '\n', 'utf8');

    // 로테이션 필요 여부 확인
    if (this.currentSize + messageBytes > this.config.maxSize) {
      this.rotate();
    }

    // 메시지 추가 (동기적 쓰기)
    const fs = require('fs');
    fs.appendFileSync(this.currentFile, message + '\n');
    this.currentSize += messageBytes;
  }

  /**
   * 파일 로테이션 실행
   */
  protected rotate(): void {
    // 기존 백업 파일들 순환
    for (let i = this.config.maxFiles - 1; i >= 1; i--) {
      const oldFile = this.getRotatedFileName(i);
      const newFile = this.getRotatedFileName(i + 1);

      if (existsSync(oldFile)) {
        if (existsSync(newFile)) {
          unlinkSync(newFile);
        }
        renameSync(oldFile, newFile);
      }
    }

    // 현재 파일을 .1로 이동
    if (existsSync(this.currentFile)) {
      const rotatedFile = this.getRotatedFileName(1);
      renameSync(this.currentFile, rotatedFile);
    }

    // 크기 초기화
    this.currentSize = 0;
  }

  /**
   * 로테이션된 파일명 생성
   */
  private getRotatedFileName(index: number): string {
    const base = basename(this.config.filename, extname(this.config.filename));
    const ext = extname(this.config.filename);
    return join(this.config.logDir, `${base}.${index}${ext}`);
  }

  /**
   * 디렉토리 존재 확인 및 생성
   */
  private ensureDirectory(): void {
    if (!existsSync(this.config.logDir)) {
      mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  /**
   * 로그 파일 목록 조회
   */
  getLogFiles(): string[] {
    if (!existsSync(this.config.logDir)) {
      return [];
    }

    const base = basename(this.config.filename, extname(this.config.filename));
    const ext = extname(this.config.filename);

    return readdirSync(this.config.logDir)
      .filter(file => file.startsWith(base) && file.endsWith(ext))
      .map(file => join(this.config.logDir, file))
      .sort();
  }

  /**
   * 모든 로그 파일 삭제
   */
  clear(): void {
    const files = this.getLogFiles();
    for (const file of files) {
      try {
        unlinkSync(file);
      } catch {
        // 삭제 실패 무시
      }
    }
    this.currentSize = 0;
  }

  /**
   * 현재 로그 파일 경로 반환
   */
  getCurrentFile(): string {
    return this.currentFile;
  }

  /**
   * 현재 파일 크기 반환 (바이트)
   */
  getCurrentSize(): number {
    return this.currentSize;
  }
}

/**
 * 날짜 기반 로테이션 (선택적 확장)
 */
export class DateBasedRotator extends LogRotator {
  private lastDate: string;

  constructor(config: RotationConfig) {
    super(config);
    this.lastDate = this.getCurrentDate();
  }

  /**
   * 로그 메시지 쓰기 (날짜 변경 감지)
   */
  write(message: string): void {
    const currentDate = this.getCurrentDate();

    // 날짜가 변경되었으면 로테이션
    if (currentDate !== this.lastDate) {
      // protected 메서드 호출
      (this as unknown as { rotate: () => void }).rotate();
      this.lastDate = currentDate;
    }

    super.write(message);
  }

  /**
   * 현재 날짜 문자열 반환 (YYYYMMDD)
   */
  private getCurrentDate(): string {
    const now = new Date();
    return now.toISOString().split('T')[0].replace(/-/g, '');
  }
}
