/**
 * Supabase 데이터베이스 관리자
 * @description @supabase/supabase-js 기반 PostgreSQL 연동
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
} from '../types.js';
import { MessageRole, ContextStrategy } from '../types.js';
import {
  initializeSupabaseClient,
  testSupabaseConnection,
} from './client.js';

/**
 * Supabase 데이터베이스 관리자
 */
export class SupabaseDatabaseManager {
  private supabaseClient: SupabaseClient | null = null;
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig) {
    this.config = config;
  }

  /**
   * 데이터베이스 초기화
   */
  async initialize(): Promise<void> {
    // Supabase 클라이언트 초기화
    this.supabaseClient = initializeSupabaseClient(this.config);

    // 연결 테스트
    const connected = await testSupabaseConnection();

    if (!connected) {
      throw new Error('Supabase connection failed. Please check your Supabase URL and API key.');
    }
  }

  /**
   * Supabase 클라이언트 조회
   */
  getClient(): SupabaseClient {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }
    return this.supabaseClient;
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
      toolCalls: row.tool_calls ? (row.tool_calls as unknown as import('../types.js').ToolCall[]) : undefined,
      toolResults: row.tool_results ? (row.tool_results as unknown as import('../types.js').ToolResult[]) : undefined,
      metadata: row.metadata || undefined,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * 데이터베이스 연결 종료
   */
  async close(): Promise<void> {
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
  config: SupabaseConfig
): Promise<SupabaseDatabaseManager> {
  globalSupabaseDatabase = new SupabaseDatabaseManager(config);
  await globalSupabaseDatabase.initialize();
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
