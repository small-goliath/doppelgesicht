/**
 * Supabase 메모리 관리자 구현
 * @description 세션 및 메시지 관리를 위한 고수준 인터페이스 (Supabase + 로컬 캐시)
 */

import type {
  IMemoryManager,
  Session,
  Message,
  SessionQueryOptions,
  MessageQueryOptions,
  ContextWindowConfig,
  DatabaseConfig,
} from '../types.js';
import { ContextStrategy, MessageRole } from '../types.js';
import type { SupabaseConfig } from './types.js';
import { SupabaseDatabaseManager } from './database.js';

/**
 * Supabase 메모리 관리자
 */
export class SupabaseMemoryManager implements IMemoryManager {
  private supabaseDb: SupabaseDatabaseManager;
  private useLocalCache: boolean = false;

  constructor(supabaseDb: SupabaseDatabaseManager) {
    this.supabaseDb = supabaseDb;
    this.useLocalCache = supabaseDb.isLocalCacheMode();
  }

  /**
   * 세션 생성
   */
  async createSession(
    data: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'messages'>
  ): Promise<Session> {
    const result = await this.supabaseDb.createSession({
      channel_id: data.channelId,
      user_id: data.userId,
      title: data.title,
      max_messages: data.contextWindow.maxMessages,
      max_tokens: data.contextWindow.maxTokens,
      context_strategy: data.contextWindow.strategy,
      preserve_system_messages: data.contextWindow.preserveSystemMessages,
      metadata: data.metadata,
    });

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error('Failed to create session');
    }

    return result.data;
  }

  /**
   * 세션 조회
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const result = await this.supabaseDb.getSession(sessionId);

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      return null;
    }

    // 메시지 로드
    const messagesResult = await this.supabaseDb.getMessagesBySessionId(sessionId);
    if (messagesResult.error) {
      throw messagesResult.error;
    }

    result.data.messages = messagesResult.data;
    return result.data;
  }

  /**
   * 세션 목록 조회
   */
  async listSessions(options?: SessionQueryOptions): Promise<Session[]> {
    const result = await this.supabaseDb.listSessions(options);

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  /**
   * 세션 업데이트
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<Session, 'id' | 'createdAt'>>
  ): Promise<Session> {
    const updateData: {
      title?: string;
      max_messages?: number;
      max_tokens?: number;
      context_strategy?: string;
      preserve_system_messages?: boolean;
      metadata?: Record<string, unknown>;
    } = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.contextWindow) {
      updateData.max_messages = updates.contextWindow.maxMessages;
      if (updates.contextWindow.maxTokens !== undefined) {
        updateData.max_tokens = updates.contextWindow.maxTokens;
      }
      updateData.context_strategy = updates.contextWindow.strategy;
      updateData.preserve_system_messages = updates.contextWindow.preserveSystemMessages;
    }
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    const result = await this.supabaseDb.updateSession(sessionId, updateData);

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error('Failed to update session');
    }

    return result.data;
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId: string): Promise<void> {
    const result = await this.supabaseDb.deleteSession(sessionId);

    if (result.error) {
      throw result.error;
    }
  }

  /**
   * 메시지 추가
   */
  async addMessage(data: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const result = await this.supabaseDb.createMessage({
      session_id: data.sessionId,
      role: data.role,
      content: data.content,
      tool_calls: data.toolCalls,
      tool_results: data.toolResults,
      metadata: data.metadata,
    });

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error('Failed to create message');
    }

    return result.data;
  }

  /**
   * 메시지 목록 조회
   */
  async getMessages(
    sessionId: string,
    options?: MessageQueryOptions
  ): Promise<Message[]> {
    const result = await this.supabaseDb.listMessages({
      ...options,
      sessionId,
    });

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  /**
   * 메시지 삭제
   */
  async deleteMessage(messageId: string): Promise<void> {
    const result = await this.supabaseDb.deleteMessage(messageId);

    if (result.error) {
      throw result.error;
    }
  }

  /**
   * 컨텍스트 윈도우 조회
   */
  async getContextWindow(sessionId: string): Promise<Message[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const config = session.contextWindow;

    // 시스템 메시지 필터링
    const systemMessages = config.preserveSystemMessages
      ? session.messages.filter((m) => m.role === MessageRole.SYSTEM)
      : [];

    const nonSystemMessages = session.messages.filter((m) => m.role !== MessageRole.SYSTEM);

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
   * 데이터베이스 연결 종료
   */
  async close(): Promise<void> {
    await this.supabaseDb.close();
  }

  /**
   * 로컬 캐시 모드 여부 확인
   */
  isLocalCacheMode(): boolean {
    return this.useLocalCache;
  }

  /**
   * Supabase 연결 재시도
   */
  async retryConnection(): Promise<boolean> {
    const reconnected = await this.supabaseDb.retryConnection();
    if (reconnected) {
      this.useLocalCache = false;
    }
    return reconnected;
  }
}

/**
 * 글로벌 Supabase 메모리 관리자 인스턴스
 */
let globalSupabaseMemoryManager: SupabaseMemoryManager | null = null;

/**
 * 글로벌 Supabase 메모리 관리자 초기화
 */
export async function initializeSupabaseMemoryManager(
  supabaseConfig: SupabaseConfig,
  localCacheConfig?: DatabaseConfig
): Promise<SupabaseMemoryManager> {
  const { initializeSupabaseDatabase } = await import('./database.js');
  const dbManager = await initializeSupabaseDatabase(supabaseConfig, localCacheConfig);
  globalSupabaseMemoryManager = new SupabaseMemoryManager(dbManager);
  return globalSupabaseMemoryManager;
}

/**
 * 글로벌 Supabase 메모리 관리자 조회
 */
export function getSupabaseMemoryManager(): SupabaseMemoryManager {
  if (!globalSupabaseMemoryManager) {
    throw new Error('SupabaseMemoryManager not initialized. Call initializeSupabaseMemoryManager() first.');
  }
  return globalSupabaseMemoryManager;
}

/**
 * 글로벌 Supabase 메모리 관리자 종료
 */
export function closeSupabaseMemoryManager(): void {
  if (globalSupabaseMemoryManager) {
    globalSupabaseMemoryManager.close();
    globalSupabaseMemoryManager = null;
  }
}
