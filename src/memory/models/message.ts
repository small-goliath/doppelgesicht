/**
 * Message 모델 구현
 * @description 메시지 CRUD 및 조회
 */

import { randomUUID } from 'crypto';
import type {
  Message,
  MessageQueryOptions,
} from '../types.js';
import { MessageRole } from '../types.js';
import { DatabaseManager } from '../database.js';

/**
 * Message 모델
 */
export class MessageModel {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * 메시지 생성
   */
  async create(data: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    return this.dbManager.runInQueue(() => {
      const id = randomUUID();
      const now = new Date().toISOString();

      const stmt = this.dbManager.prepare(`
        INSERT INTO messages (
          id, session_id, role, content, tool_calls, tool_results, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.sessionId,
        data.role,
        data.content,
        data.toolCalls ? JSON.stringify(data.toolCalls) : null,
        data.toolResults ? JSON.stringify(data.toolResults) : null,
        data.metadata ? JSON.stringify(data.metadata) : null,
        now
      );

      const result = this.findById(id);
      return result as Promise<Message>;
    });
  }

  /**
   * 메시지 조회
   */
  async findById(id: string): Promise<Message | null> {
    return this.dbManager.runInQueue(() => {
      const stmt = this.dbManager.prepare(`
        SELECT * FROM messages WHERE id = ?
      `);
      const row = stmt.get(id) as MessageRow | undefined;

      if (!row) return null;

      return this.rowToMessage(row);
    });
  }

  /**
   * 메시지 목록 조회
   */
  async findMany(options: MessageQueryOptions = {}): Promise<Message[]> {
    return this.dbManager.runInQueue(() => {
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (options.sessionId) {
        conditions.push('session_id = ?');
        params.push(options.sessionId);
      }

      if (options.role) {
        conditions.push('role = ?');
        params.push(options.role);
      }

      if (options.startDate) {
        conditions.push('created_at >= ?');
        params.push(options.startDate.toISOString());
      }

      if (options.endDate) {
        conditions.push('created_at <= ?');
        params.push(options.endDate.toISOString());
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = options.limit || 100;
      const offset = options.offset || 0;

      const stmt = this.dbManager.prepare(`
        SELECT * FROM messages
        ${whereClause}
        ORDER BY created_at ASC
        LIMIT ? OFFSET ?
      `);

      const rows = stmt.all(...params, limit, offset) as MessageRow[];
      return rows.map((row) => this.rowToMessage(row));
    });
  }

  /**
   * 세션의 모든 메시지 조회
   */
  async findBySessionId(sessionId: string): Promise<Message[]> {
    return this.findMany({ sessionId });
  }

  /**
   * 메시지 삭제
   */
  async delete(id: string): Promise<void> {
    return this.dbManager.runInQueue(() => {
      const stmt = this.dbManager.prepare('DELETE FROM messages WHERE id = ?');
      stmt.run(id);
    });
  }

  /**
   * 세션의 모든 메시지 삭제
   */
  async deleteBySessionId(sessionId: string): Promise<void> {
    return this.dbManager.runInQueue(() => {
      const stmt = this.dbManager.prepare('DELETE FROM messages WHERE session_id = ?');
      stmt.run(sessionId);
    });
  }

  /**
   * 메시지 수 조회
   */
  async count(options: Omit<MessageQueryOptions, 'limit' | 'offset'> = {}): Promise<number> {
    return this.dbManager.runInQueue(() => {
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (options.sessionId) {
        conditions.push('session_id = ?');
        params.push(options.sessionId);
      }

      if (options.role) {
        conditions.push('role = ?');
        params.push(options.role);
      }

      if (options.startDate) {
        conditions.push('created_at >= ?');
        params.push(options.startDate.toISOString());
      }

      if (options.endDate) {
        conditions.push('created_at <= ?');
        params.push(options.endDate.toISOString());
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const stmt = this.dbManager.prepare(`
        SELECT COUNT(*) as count FROM messages ${whereClause}
      `);

      const result = stmt.get(...params) as { count: number } | undefined;
      return result?.count || 0;
    });
  }

  /**
   * 데이터베이스 행을 Message 객체로 변환
   */
  private rowToMessage(row: MessageRow): Message {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role as MessageRole,
      content: row.content,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      toolResults: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}

/**
 * 데이터베이스 메시지 행 타입
 */
interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  tool_calls: string | null;
  tool_results: string | null;
  metadata: string | null;
  created_at: string;
}
