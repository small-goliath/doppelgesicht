/**
 * Supabase 데이터베이스 관리자
 * @description @supabase/supabase-js 기반 PostgreSQL 연동 및 로컬 캐시 폴리
 */

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SupabaseConfig,
  SupabaseSessionRow,
  SupabaseMessageRow,
  CreateSessionInput,
  CreateMessageInput,
  UpdateSessionInput,
  SupabaseQueryResult,
  SupabaseQueryListResult,
} from './types.js';
import type {
  Session,
  Message,
  SessionQueryOptions,
  MessageQueryOptions,
  DatabaseConfig,
} from '../types.js';
import { MessageRole, ContextStrategy } from '../types.js';
import {
  initializeSupabaseClient,
  testSupabaseConnection,
  reconnectSupabase,
  setLocalCacheMode,
} from './client.js';
import { DatabaseManager as SQLiteDatabaseManager } from '../database.js';

/**
 * Supabase 데이터베이스 관리자
 */
export class SupabaseDatabaseManager {
  private supabaseClient: SupabaseClient | null = null;
  private config: SupabaseConfig;
  private localCache: SQLiteDatabaseManager | null = null;
  private useLocalCache: boolean = false;
  private maxRetries: number = 5;

  constructor(config: SupabaseConfig) {
    this.config = config;
  }

  /**
   * 데이터베이스 초기화
   */
  async initialize(localCacheConfig?: DatabaseConfig): Promise<void> {
    // Supabase 클라이언트 초기화
    this.supabaseClient = initializeSupabaseClient(this.config);

    // 연결 테스트
    const connected = await testSupabaseConnection();

    if (!connected) {
      // 연결 실패 시 로컬 캐시 모드로 전환
      if (localCacheConfig) {
        this.useLocalCache = true;
        setLocalCacheMode(true);
        this.localCache = new SQLiteDatabaseManager(localCacheConfig);
        await this.localCache.initialize();
        console.warn('Supabase connection failed. Using local cache mode.');
      } else {
        throw new Error('Supabase connection failed and no local cache configured');
      }
    }
  }

  /**
   * 로컬 캐시 모드 여부 확인
   */
  isLocalCacheMode(): boolean {
    return this.useLocalCache;
  }

  /**
   * 연결 재시도
   */
  async retryConnection(): Promise<boolean> {
    if (this.useLocalCache) {
      const reconnected = await reconnectSupabase(this.config, this.maxRetries);
      if (reconnected) {
        this.useLocalCache = false;
        setLocalCacheMode(false);
        // 로컬 캐시 데이터를 Supabase로 동기화
        await this.syncLocalCacheToSupabase();
        return true;
      }
    }
    return false;
  }

  /**
   * 로컬 캐시 데이터를 Supabase로 동기화
   */
  private async syncLocalCacheToSupabase(): Promise<void> {
    if (!this.localCache || !this.supabaseClient) return;

    try {
      // 로컬 세션 조회
      const sessions = await this.localCache.runInQueue(() => {
        const stmt = this.localCache!.prepare('SELECT * FROM sessions');
        return stmt.all() as SupabaseSessionRow[];
      });

      // 로컬 메시지 조회
      const messages = await this.localCache.runInQueue(() => {
        const stmt = this.localCache!.prepare('SELECT * FROM messages');
        return stmt.all() as SupabaseMessageRow[];
      });

      // Supabase로 데이터 동기화
      for (const session of sessions) {
        await this.supabaseClient.from('sessions').upsert({
          id: session.id,
          channel_id: session.channel_id,
          user_id: session.user_id,
          title: session.title,
          max_messages: session.max_messages,
          max_tokens: session.max_tokens,
          context_strategy: session.context_strategy,
          preserve_system_messages: session.preserve_system_messages,
          metadata: session.metadata,
          created_at: session.created_at,
          updated_at: session.updated_at,
        });
      }

      for (const message of messages) {
        await this.supabaseClient.from('messages').upsert({
          id: message.id,
          session_id: message.session_id,
          role: message.role,
          content: message.content,
          tool_calls: message.tool_calls,
          tool_results: message.tool_results,
          metadata: message.metadata,
          created_at: message.created_at,
        });
      }

      console.log(`Synced ${sessions.length} sessions and ${messages.length} messages to Supabase`);
    } catch (error) {
      console.error('Failed to sync local cache to Supabase:', error);
    }
  }

  // ==================== 세션 CRUD ====================

  /**
   * 세션 생성
   */
  async createSession(data: CreateSessionInput): Promise<SupabaseQueryResult<Session>> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const sessionData = {
      id,
      channel_id: data.channel_id,
      user_id: data.user_id,
      title: data.title ?? null,
      max_messages: data.max_messages ?? 100,
      max_tokens: data.max_tokens ?? null,
      context_strategy: data.context_strategy ?? 'recent_first',
      preserve_system_messages: data.preserve_system_messages ?? true,
      metadata: data.metadata ?? null,
      created_at: now,
      updated_at: now,
    };

    if (this.useLocalCache && this.localCache) {
      // 로컬 캐시 모드
      return this.localCache.runInQueue(() => {
        const stmt = this.localCache!.prepare(`
          INSERT INTO sessions (
            id, channel_id, user_id, title, max_messages, max_tokens,
            context_strategy, preserve_system_messages, metadata, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          sessionData.id,
          sessionData.channel_id,
          sessionData.user_id,
          sessionData.title,
          sessionData.max_messages,
          sessionData.max_tokens,
          sessionData.context_strategy,
          sessionData.preserve_system_messages ? 1 : 0,
          sessionData.metadata ? JSON.stringify(sessionData.metadata) : null,
          sessionData.created_at,
          sessionData.updated_at
        );

        const result = this.rowToSession(sessionData as unknown as SupabaseSessionRow);
        return { data: result, error: null };
      });
    }

    // Supabase 모드
    const { error } = await this.supabaseClient!.from('sessions').insert(sessionData);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const result = this.rowToSession(sessionData as unknown as SupabaseSessionRow);
    return { data: result, error: null };
  }

  /**
   * 세션 조회
   */
  async getSession(id: string): Promise<SupabaseQueryResult<Session>> {
    if (this.useLocalCache && this.localCache) {
      return this.localCache.runInQueue(() => {
        const stmt = this.localCache!.prepare('SELECT * FROM sessions WHERE id = ?');
        const row = stmt.get(id) as SupabaseSessionRow | undefined;

        if (!row) {
          return { data: null, error: null };
        }

        return { data: this.rowToSession(row), error: null };
      });
    }

    const { data, error } = await this.supabaseClient!
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: this.rowToSession(data as SupabaseSessionRow), error: null };
  }

  /**
   * 세션 목록 조회
   */
  async listSessions(options: SessionQueryOptions = {}): Promise<SupabaseQueryListResult<Session>> {
    if (this.useLocalCache && this.localCache) {
      return this.localCache.runInQueue(() => {
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

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const orderBy = options.orderBy === 'createdAt' ? 'created_at' : 'updated_at';
        const orderDirection = options.orderDirection || 'desc';
        const limit = options.limit || 100;
        const offset = options.offset || 0;

        const stmt = this.localCache!.prepare(`
          SELECT * FROM sessions
          ${whereClause}
          ORDER BY ${orderBy} ${orderDirection}
          LIMIT ? OFFSET ?
        `);

        const rows = stmt.all(...params, limit, offset) as SupabaseSessionRow[];
        return { data: rows.map((row) => this.rowToSession(row)), error: null };
      });
    }

    let query = this.supabaseClient!.from('sessions').select('*');

    if (options.channelId) {
      query = query.eq('channel_id', options.channelId);
    }

    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }

    const orderBy = options.orderBy === 'createdAt' ? 'created_at' : 'updated_at';
    query = query.order(orderBy, { ascending: options.orderDirection === 'asc' });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    return { data: (data as SupabaseSessionRow[]).map((row) => this.rowToSession(row)), error: null };
  }

  /**
   * 세션 업데이트
   */
  async updateSession(
    id: string,
    updates: UpdateSessionInput
  ): Promise<SupabaseQueryResult<Session>> {
    const updateData: Record<string, unknown> = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.max_messages !== undefined) updateData.max_messages = updates.max_messages;
    if (updates.max_tokens !== undefined) updateData.max_tokens = updates.max_tokens;
    if (updates.context_strategy !== undefined) updateData.context_strategy = updates.context_strategy;
    if (updates.preserve_system_messages !== undefined)
      updateData.preserve_system_messages = updates.preserve_system_messages;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    updateData.updated_at = new Date().toISOString();

    if (this.useLocalCache && this.localCache) {
      return this.localCache.runInQueue(() => {
        const sets: string[] = [];
        const params: unknown[] = [];

        for (const [key, value] of Object.entries(updateData)) {
          sets.push(`${key} = ?`);
          params.push(value);
        }

        params.push(id);

        const stmt = this.localCache!.prepare(`
          UPDATE sessions
          SET ${sets.join(', ')}
          WHERE id = ?
        `);

        stmt.run(...params);

        // 업데이트된 세션 조회
        const selectStmt = this.localCache!.prepare('SELECT * FROM sessions WHERE id = ?');
        const row = selectStmt.get(id) as SupabaseSessionRow;

        return { data: this.rowToSession(row), error: null };
      });
    }

    const { error } = await this.supabaseClient!.from('sessions').update(updateData).eq('id', id);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // 업데이트된 세션 조회
    return this.getSession(id);
  }

  /**
   * 세션 삭제
   */
  async deleteSession(id: string): Promise<SupabaseQueryResult<void>> {
    if (this.useLocalCache && this.localCache) {
      return this.localCache.runInQueue(() => {
        // 메시지 먼저 삭제
        const deleteMessagesStmt = this.localCache!.prepare(
          'DELETE FROM messages WHERE session_id = ?'
        );
        deleteMessagesStmt.run(id);

        // 세션 삭제
        const deleteSessionStmt = this.localCache!.prepare('DELETE FROM sessions WHERE id = ?');
        deleteSessionStmt.run(id);

        return { data: undefined, error: null };
      });
    }

    const { error } = await this.supabaseClient!.from('sessions').delete().eq('id', id);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: undefined, error: null };
  }

  // ==================== 메시지 CRUD ====================

  /**
   * 메시지 생성
   */
  async createMessage(data: CreateMessageInput): Promise<SupabaseQueryResult<Message>> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const messageData = {
      id,
      session_id: data.session_id,
      role: data.role,
      content: data.content,
      tool_calls: data.tool_calls ?? null,
      tool_results: data.tool_results ?? null,
      metadata: data.metadata ?? null,
      created_at: now,
    };

    if (this.useLocalCache && this.localCache) {
      return this.localCache.runInQueue(() => {
        const stmt = this.localCache!.prepare(`
          INSERT INTO messages (
            id, session_id, role, content, tool_calls, tool_results, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          messageData.id,
          messageData.session_id,
          messageData.role,
          messageData.content,
          messageData.tool_calls ? JSON.stringify(messageData.tool_calls) : null,
          messageData.tool_results ? JSON.stringify(messageData.tool_results) : null,
          messageData.metadata ? JSON.stringify(messageData.metadata) : null,
          messageData.created_at
        );

        // 세션 업데이트 시간 갱신
        const updateStmt = this.localCache!.prepare(
          'UPDATE sessions SET updated_at = ? WHERE id = ?'
        );
        updateStmt.run(now, data.session_id);

        const result = this.rowToMessage(messageData as unknown as SupabaseMessageRow);
        return { data: result, error: null };
      });
    }

    const { error } = await this.supabaseClient!.from('messages').insert(messageData);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const result = this.rowToMessage(messageData as unknown as SupabaseMessageRow);
    return { data: result, error: null };
  }

  /**
   * 메시지 조회
   */
  async getMessage(id: string): Promise<SupabaseQueryResult<Message>> {
    if (this.useLocalCache && this.localCache) {
      return this.localCache.runInQueue(() => {
        const stmt = this.localCache!.prepare('SELECT * FROM messages WHERE id = ?');
        const row = stmt.get(id) as SupabaseMessageRow | undefined;

        if (!row) {
          return { data: null, error: null };
        }

        return { data: this.rowToMessage(row), error: null };
      });
    }

    const { data, error } = await this.supabaseClient!
      .from('messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: this.rowToMessage(data as SupabaseMessageRow), error: null };
  }

  /**
   * 메시지 목록 조회
   */
  async listMessages(
    options: MessageQueryOptions = {}
  ): Promise<SupabaseQueryListResult<Message>> {
    if (this.useLocalCache && this.localCache) {
      return this.localCache.runInQueue(() => {
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

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = options.limit || 100;
        const offset = options.offset || 0;

        const stmt = this.localCache!.prepare(`
          SELECT * FROM messages
          ${whereClause}
          ORDER BY created_at ASC
          LIMIT ? OFFSET ?
        `);

        const rows = stmt.all(...params, limit, offset) as SupabaseMessageRow[];
        return { data: rows.map((row) => this.rowToMessage(row)), error: null };
      });
    }

    let query = this.supabaseClient!.from('messages').select('*');

    if (options.sessionId) {
      query = query.eq('session_id', options.sessionId);
    }

    if (options.role) {
      query = query.eq('role', options.role);
    }

    query = query.order('created_at', { ascending: true });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    return { data: (data as SupabaseMessageRow[]).map((row) => this.rowToMessage(row)), error: null };
  }

  /**
   * 세션의 모든 메시지 조회
   */
  async getMessagesBySessionId(sessionId: string): Promise<SupabaseQueryListResult<Message>> {
    return this.listMessages({ sessionId });
  }

  /**
   * 메시지 삭제
   */
  async deleteMessage(id: string): Promise<SupabaseQueryResult<void>> {
    if (this.useLocalCache && this.localCache) {
      return this.localCache.runInQueue(() => {
        const stmt = this.localCache!.prepare('DELETE FROM messages WHERE id = ?');
        stmt.run(id);
        return { data: undefined, error: null };
      });
    }

    const { error } = await this.supabaseClient!.from('messages').delete().eq('id', id);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: undefined, error: null };
  }

  /**
   * 세션의 모든 메시지 삭제
   */
  async deleteMessagesBySessionId(sessionId: string): Promise<SupabaseQueryResult<void>> {
    if (this.useLocalCache && this.localCache) {
      return this.localCache.runInQueue(() => {
        const stmt = this.localCache!.prepare('DELETE FROM messages WHERE session_id = ?');
        stmt.run(sessionId);
        return { data: undefined, error: null };
      });
    }

    const { error } = await this.supabaseClient!
      .from('messages')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: undefined, error: null };
  }

  // ==================== 유틸리티 ====================

  /**
   * 데이터베이스 행을 Session 객체로 변환
   */
  private rowToSession(row: SupabaseSessionRow): Session {
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
        preserveSystemMessages: row.preserve_system_messages,
      },
      metadata: row.metadata || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * 데이터베이스 행을 Message 객체로 변환
   */
  private rowToMessage(row: SupabaseMessageRow): Message {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role as MessageRole,
      content: row.content,
      toolCalls: row.tool_calls || undefined,
      toolResults: row.tool_results || undefined,
      metadata: row.metadata || undefined,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * 데이터베이스 연결 종료
   */
  async close(): Promise<void> {
    if (this.localCache) {
      this.localCache.close();
    }
    this.supabaseClient = null;
  }
}

/**
 * 글로벌 Supabase 데이터베이스 관리자 인스턴스
 */
let globalSupabaseDatabase: SupabaseDatabaseManager | null = null;

/**
 * 글로벌 Supabase 데이터베이스 초기화
 */
export async function initializeSupabaseDatabase(
  config: SupabaseConfig,
  localCacheConfig?: DatabaseConfig
): Promise<SupabaseDatabaseManager> {
  globalSupabaseDatabase = new SupabaseDatabaseManager(config);
  await globalSupabaseDatabase.initialize(localCacheConfig);
  return globalSupabaseDatabase;
}

/**
 * 글로벌 Supabase 데이터베이스 조회
 */
export function getSupabaseDatabase(): SupabaseDatabaseManager {
  if (!globalSupabaseDatabase) {
    throw new Error('SupabaseDatabase not initialized. Call initializeSupabaseDatabase() first.');
  }
  return globalSupabaseDatabase;
}

/**
 * 글로벌 Supabase 데이터베이스 종료
 */
export function closeSupabaseDatabase(): void {
  if (globalSupabaseDatabase) {
    globalSupabaseDatabase.close();
    globalSupabaseDatabase = null;
  }
}
