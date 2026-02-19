/**
 * Session 모델 구현
 * @description 세션 CRUD 및 컨텍스트 윈도우 관리
 */

import { randomUUID } from 'crypto';
import type {
  Session,
  SessionQueryOptions,
  ContextWindowConfig,
  Message,
} from '../types.js';
import { ContextStrategy } from '../types.js';
import { DatabaseManager } from '../database.js';

/**
 * Session 모델
 */
export class SessionModel {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * 세션 생성
   */
  async create(
    data: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'messages'>
  ): Promise<Session> {
    return this.dbManager.runInQueue(() => {
      const id = randomUUID();
      const now = new Date().toISOString();

      const stmt = this.dbManager.prepare(`
        INSERT INTO sessions (
          id, channel_id, user_id, title, max_messages, max_tokens,
          context_strategy, preserve_system_messages, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.channelId,
        data.userId,
        data.title || null,
        data.contextWindow.maxMessages,
        data.contextWindow.maxTokens || null,
        data.contextWindow.strategy,
        data.contextWindow.preserveSystemMessages ? 1 : 0,
        data.metadata ? JSON.stringify(data.metadata) : null,
        now,
        now
      );

      const result = this.findById(id);
      return result as Promise<Session>;
    });
  }

  /**
   * 세션 조회
   */
  async findById(id: string): Promise<Session | null> {
    return this.dbManager.runInQueue(() => {
      const stmt = this.dbManager.prepare(`
        SELECT * FROM sessions WHERE id = ?
      `);
      const row = stmt.get(id) as SessionRow | undefined;

      if (!row) return null;

      return this.rowToSession(row);
    });
  }

  /**
   * 세션 목록 조회
   */
  async findMany(options: SessionQueryOptions = {}): Promise<Session[]> {
    return this.dbManager.runInQueue(() => {
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (options.channelId) {
        conditions.push('channel_id = ?');
        params.push(options.channelId);
      }

      if (options.userId) {
        conditions.push('user_id = ?');
        params.push(options.userId);
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
      const orderBy = options.orderBy || 'updated_at';
      const orderDirection = options.orderDirection || 'desc';
      const limit = options.limit || 100;
      const offset = options.offset || 0;

      const stmt = this.dbManager.prepare(`
        SELECT * FROM sessions
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT ? OFFSET ?
      `);

      const rows = stmt.all(...params, limit, offset) as SessionRow[];
      return rows.map((row) => this.rowToSession(row));
    });
  }

  /**
   * 세션 업데이트
   */
  async update(
    id: string,
    updates: Partial<Omit<Session, 'id' | 'createdAt'>>
  ): Promise<Session> {
    return this.dbManager.runInQueue(() => {
      const sets: string[] = [];
      const params: (string | number | null)[] = [];

      if (updates.title !== undefined) {
        sets.push('title = ?');
        params.push(updates.title);
      }

      if (updates.contextWindow) {
        sets.push('max_messages = ?');
        params.push(updates.contextWindow.maxMessages);

        if (updates.contextWindow.maxTokens !== undefined) {
          sets.push('max_tokens = ?');
          params.push(updates.contextWindow.maxTokens);
        }

        sets.push('context_strategy = ?');
        params.push(updates.contextWindow.strategy);

        sets.push('preserve_system_messages = ?');
        params.push(updates.contextWindow.preserveSystemMessages ? 1 : 0);
      }

      if (updates.metadata !== undefined) {
        sets.push('metadata = ?');
        params.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
      }

      if (sets.length === 0) {
        return this.findById(id) as Promise<Session>;
      }

      sets.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);

      const stmt = this.dbManager.prepare(`
        UPDATE sessions
        SET ${sets.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...params);

      return this.findById(id) as Promise<Session>;
    });
  }

  /**
   * 세션 삭제
   */
  async delete(id: string): Promise<void> {
    return this.dbManager.runInQueue(() => {
      const stmt = this.dbManager.prepare('DELETE FROM sessions WHERE id = ?');
      stmt.run(id);
    });
  }

  /**
   * 세션의 메시지 수 조회
   */
  async getMessageCount(sessionId: string): Promise<number> {
    return this.dbManager.runInQueue(() => {
      const stmt = this.dbManager.prepare(`
        SELECT COUNT(*) as count FROM messages WHERE session_id = ?
      `);
      const result = stmt.get(sessionId) as { count: number } | undefined;
      return result?.count || 0;
    });
  }

  /**
   * 컨텍스트 윈도우 조회
   */
  async getContextWindow(
    sessionId: string,
    messages: Message[]
  ): Promise<Message[]> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const config = session.contextWindow;

    // 시스템 메시지 필터링
    const systemMessages = config.preserveSystemMessages
      ? messages.filter((m) => m.role === 'system')
      : [];

    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    // 전략에 따른 메시지 선택
    let selectedMessages: Message[];

    switch (config.strategy) {
      case ContextStrategy.RECENT_FIRST:
        selectedMessages = this.selectRecentMessages(nonSystemMessages, config);
        break;
      case ContextStrategy.IMPORTANT_FIRST:
        selectedMessages = this.selectImportantMessages(nonSystemMessages, config);
        break;
      case ContextStrategy.SUMMARIZE:
        // TODO: 요약 로직 구현
        selectedMessages = this.selectRecentMessages(nonSystemMessages, config);
        break;
      default:
        selectedMessages = this.selectRecentMessages(nonSystemMessages, config);
    }

    // 시스템 메시지 + 선택된 메시지 병합
    return [...systemMessages, ...selectedMessages];
  }

  /**
   * 최근 메시지 선택
   */
  private selectRecentMessages(
    messages: Message[],
    config: ContextWindowConfig
  ): Message[] {
    // 시간순 정렬 후 최근 N개 선택
    const sorted = [...messages].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    return sorted.slice(-config.maxMessages);
  }

  /**
   * 중요 메시지 선택 (간단한 휴리스틱)
   */
  private selectImportantMessages(
    messages: Message[],
    config: ContextWindowConfig
  ): Message[] {
    // TODO: 더 정교한 중요도 계산
    // 현재는 최근 메시지와 동일하게 동작
    return this.selectRecentMessages(messages, config);
  }

  /**
   * 데이터베이스 행을 Session 객체로 변환
   */
  private rowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      channelId: row.channel_id,
      userId: row.user_id,
      title: row.title || undefined,
      messages: [], // 메시지는 별도 로드
      contextWindow: {
        maxMessages: row.max_messages,
        maxTokens: row.max_tokens || undefined,
        strategy: row.context_strategy as ContextStrategy,
        preserveSystemMessages: row.preserve_system_messages === 1,
      },
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

/**
 * 데이터베이스 세션 행 타입
 */
interface SessionRow {
  id: string;
  channel_id: string;
  user_id: string;
  title: string | null;
  max_messages: number;
  max_tokens: number | null;
  context_strategy: string;
  preserve_system_messages: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}
