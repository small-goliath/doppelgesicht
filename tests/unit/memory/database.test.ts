import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DatabaseManager } from '../../../src/memory/database.js';

describe('DatabaseManager', () => {
  let tempDir: string;
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `doppelgesicht-db-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    dbManager = new DatabaseManager({
      dbPath: join(tempDir, 'test.db'),
      queueSize: 10,
      timeout: 5000,
    });

    await dbManager.initialize();
  });

  afterEach(() => {
    dbManager.close();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('초기화', () => {
    it('데이터베이스를 초기화해야 함', () => {
      expect(dbManager.isInitialized()).toBe(true);
    });

    it('스키마가 적용되어야 함', async () => {
      // 테이블 존재 확인
      const stmt = dbManager.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
      );
      const result = stmt.get() as { name: string } | undefined;
      expect(result?.name).toBe('sessions');
    });

    it('WAL 모드가 활성화되어야 함', () => {
      const stmt = dbManager.prepare('PRAGMA journal_mode');
      const result = stmt.get() as { journal_mode: string };
      expect(result.journal_mode.toLowerCase()).toBe('wal');
    });

    it('외래키 제약이 활성화되어야 함', () => {
      const stmt = dbManager.prepare('PRAGMA foreign_keys');
      const result = stmt.get() as { foreign_keys: number };
      expect(result.foreign_keys).toBe(1);
    });
  });

  describe('SQL 실행', () => {
    it('exec로 SQL을 실행해야 함', () => {
      dbManager.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)');

      const stmt = dbManager.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'"
      );
      const result = stmt.get() as { name: string } | undefined;
      expect(result?.name).toBe('test_table');
    });

    it('prepare로 prepared statement를 생성해야 함', () => {
      const stmt = dbManager.prepare('SELECT 1 as num');
      const result = stmt.get() as { num: number };
      expect(result.num).toBe(1);
    });
  });

  describe('트랜잭션', () => {
    it('트랜잭션을 실행해야 함', () => {
      dbManager.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');

      const result = dbManager.transaction(() => {
        const insertStmt = dbManager.prepare('INSERT INTO test (value) VALUES (?)');
        insertStmt.run('value1');
        insertStmt.run('value2');

        const selectStmt = dbManager.prepare('SELECT COUNT(*) as count FROM test');
        return (selectStmt.get() as { count: number }).count;
      });

      expect(result).toBe(2);
    });

    it('트랜잭션 롤백이 작동해야 함', () => {
      dbManager.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT UNIQUE)');

      expect(() => {
        dbManager.transaction(() => {
          const insertStmt = dbManager.prepare('INSERT INTO test (value) VALUES (?)');
          insertStmt.run('value1');
          insertStmt.run('value1'); // 중복으로 인한 에러
        });
      }).toThrow();

      // 롤백 확인
      const stmt = dbManager.prepare('SELECT COUNT(*) as count FROM test');
      const result = stmt.get() as { count: number };
      expect(result.count).toBe(0);
    });
  });

  describe('큐', () => {
    it('runInQueue로 비동기 작업을 실행해야 함', async () => {
      const result = await dbManager.runInQueue(async () => {
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('여러 큐 작업을 순차적으로 실행해야 함', async () => {
      const results: number[] = [];

      const promises = [1, 2, 3].map((num) =>
        dbManager.runInQueue(async () => {
          results.push(num);
          return num;
        })
      );

      await Promise.all(promises);
      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('백업', () => {
    it('백업을 생성해야 함', async () => {
      const backupPath = join(tempDir, 'backup.db');
      await dbManager.backup(backupPath);

      expect(existsSync(backupPath)).toBe(true);
    });
  });

  describe('경로 조회', () => {
    it('데이터베이스 경로를 반환해야 함', () => {
      const path = dbManager.getDbPath();
      expect(path).toBe(join(tempDir, 'test.db'));
    });
  });

  describe('종료', () => {
    it('close로 데이터베이스를 종료해야 함', () => {
      expect(dbManager.isInitialized()).toBe(true);
      dbManager.close();
      expect(dbManager.isInitialized()).toBe(false);
    });

    it('종료 후 작업 시도 시 에러를 발생해야 함', () => {
      dbManager.close();
      expect(() => {
        dbManager.exec('SELECT 1');
      }).toThrow('Database not initialized');
    });
  });
});
