/**
 * 메모리 관리자 구현
 * @description 세션 및 메시지 관리를 위한 고수준 인터페이스
 */

import type {
  IMemoryManager,
  Session,
  Message,
  SessionQueryOptions,
  MessageQueryOptions,
} from './types.js';
import { DatabaseManager } from './database.js';
import { SessionModel } from './models/session.js';
import { MessageModel } from './models/message.js';

/**
 * 메모리 관리자
 */
export class MemoryManager implements IMemoryManager {
  private dbManager: DatabaseManager;
  private sessionModel: SessionModel;
  private messageModel: MessageModel;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
    this.sessionModel = new SessionModel(dbManager);
    this.messageModel = new MessageModel(dbManager);
  }

  /**
   * 세션 생성
   */
  async createSession(
    data: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'messages'>
  ): Promise<Session> {
    return this.sessionModel.create(data);
  }

  /**
   * 세션 조회
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) return null;

    // 메시지 로드
    session.messages = await this.messageModel.findBySessionId(sessionId);
    return session;
  }

  /**
   * 세션 목록 조회
   */
  async listSessions(options?: SessionQueryOptions): Promise<Session[]> {
    return this.sessionModel.findMany(options);
  }

  /**
   * 세션 업데이트
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<Session, 'id' | 'createdAt'>>
  ): Promise<Session> {
    return this.sessionModel.update(sessionId, updates);
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId: string): Promise<void> {
    // 메시지 먼저 삭제 (외래키 제약으로 인해 자동 삭제되지만 명시적으로 처리)
    await this.messageModel.deleteBySessionId(sessionId);
    // 세션 삭제
    await this.sessionModel.delete(sessionId);
  }

  /**
   * 메시지 추가
   */
  async addMessage(data: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    return this.messageModel.create(data);
  }

  /**
   * 메시지 목록 조회
   */
  async getMessages(
    sessionId: string,
    options?: MessageQueryOptions
  ): Promise<Message[]> {
    return this.messageModel.findMany({ ...options, sessionId });
  }

  /**
   * 메시지 삭제
   */
  async deleteMessage(messageId: string): Promise<void> {
    return this.messageModel.delete(messageId);
  }

  /**
   * 컨텍스트 윈도우 조회
   */
  async getContextWindow(sessionId: string): Promise<Message[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return this.sessionModel.getContextWindow(sessionId, session.messages);
  }

  /**
   * 데이터베이스 연결 종료
   */
  async close(): Promise<void> {
    this.dbManager.close();
  }

  /**
   * 세션 모델 접근 (고급 사용)
   */
  getSessionModel(): SessionModel {
    return this.sessionModel;
  }

  /**
   * 메시지 모델 접근 (고급 사용)
   */
  getMessageModel(): MessageModel {
    return this.messageModel;
  }
}

/**
 * 글로벌 메모리 관리자 인스턴스
 */
let globalMemoryManager: MemoryManager | null = null;

/**
 * 글로벌 메모리 관리자 초기화
 */
export function initializeMemoryManager(dbManager: DatabaseManager): MemoryManager {
  globalMemoryManager = new MemoryManager(dbManager);
  return globalMemoryManager;
}

/**
 * 글로벌 메모리 관리자 조회
 */
export function getMemoryManager(): MemoryManager {
  if (!globalMemoryManager) {
    throw new Error('MemoryManager not initialized. Call initializeMemoryManager() first.');
  }
  return globalMemoryManager;
}

/**
 * 글로벌 메모리 관리자 종료
 */
export function closeMemoryManager(): void {
  if (globalMemoryManager) {
    globalMemoryManager.close();
    globalMemoryManager = null;
  }
}
