/**
 * 데이터베이스 관리자
 * @description better-sqlite3 기반 데이터베이스 연결 및 관리
 */

import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import type { DatabaseConfig, IDatabaseConnection } from './types.js';
import { AccessQueue } from './queue.js';

/**
 * better-sqlite3 Database 타입
 */
type BetterSqlite3Database = Database.Database;

/**
 * 데이터베이스 관리자
 */
export class DatabaseManager implements IDatabaseConnection {
  private db: BetterSqlite3Database | null = null;
  private config: DatabaseConfig;
  private queue: AccessQueue;

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = {
      dbPath: config.dbPath || this.getDefaultDbPath(),
      queueSize: config.queueSize || 100,
      timeout: config.timeout || 5000,
      walMode: config.walMode !== false,
      synchronous: config.synchronous || 'NORMAL',
    };

    this.queue = new AccessQueue(this.config.queueSize, this.config.timeout);
  }

  /**
   * 기본 데이터베이스 경로 반환
   */
  private getDefaultDbPath(): string {
    const homedir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    return join(homedir, '.doppelgesicht', 'memory.db');
  }

  /**
   * 데이터베이스 초기화
   */
  async initialize(): Promise<void> {
    await this.queue.enqueue(async () => {
      // 디렉토리 생성
      const dbDir = dirname(this.config.dbPath);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }

      // 데이터베이스 연결
      this.db = new Database(this.config.dbPath);

      // 성능 최적화 설정
      this.db.pragma('journal_mode = WAL');
      this.db.pragma(`synchronous = ${this.config.synchronous}`);
      this.db.pragma('foreign_keys = ON');

      // 스키마 적용
      await this.applySchema();
    });
  }

  /**
   * 스키마 적용
   */
  private async applySchema(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // 현재 파일 경로 기준으로 schema.sql 찾기
      const currentFilePath = fileURLToPath(import.meta.url);
      const schemaPath = join(dirname(currentFilePath), 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');

      // 스키마 실행
      this.db.exec(schema);
    } catch (error) {
      console.error('Failed to apply schema:', error);
      throw error;
    }
  }

  /**
   * SQL 실행
   */
  exec(sql: string): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    this.db.exec(sql);
  }

  /**
   * 준비된 문 생성
   */
  prepare(sql: string): Database.Statement {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db.prepare(sql);
  }

  /**
   * 트랜잭션 실행
   */
  transaction<T>(fn: () => T): T {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  /**
   * 백업 생성
   */
  async backup(destination: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.queue.enqueue(async () => {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      this.db.backup(destination);
    });
  }

  /**
   * 데이터베이스 연결 종료
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * 큐를 통한 비동기 작업 실행
   */
  async runInQueue<T>(fn: () => Promise<T> | T): Promise<T> {
    return this.queue.enqueue(async () => fn());
  }

  /**
   * 데이터베이스 상태 확인
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * 데이터베이스 경로 조회
   */
  getDbPath(): string {
    return this.config.dbPath;
  }
}

/**
 * 글로벌 데이터베이스 인스턴스
 */
let globalDatabase: DatabaseManager | null = null;

/**
 * 글로벌 데이터베이스 초기화
 */
export async function initializeDatabase(
  config?: Partial<DatabaseConfig>
): Promise<DatabaseManager> {
  globalDatabase = new DatabaseManager(config);
  await globalDatabase.initialize();
  return globalDatabase;
}

/**
 * 글로벌 데이터베이스 조회
 */
export function getDatabase(): DatabaseManager {
  if (!globalDatabase) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return globalDatabase;
}

/**
 * 글로벌 데이터베이스 종료
 */
export function closeDatabase(): void {
  if (globalDatabase) {
    globalDatabase.close();
    globalDatabase = null;
  }
}
