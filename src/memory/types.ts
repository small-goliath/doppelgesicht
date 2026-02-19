/**
 * 메모리 시스템 타입 정의
 * @description Supabase PostgreSQL 기반 대화 기록 저장을 위한 타입 시스템
 */

/**
 * 메시지 역할
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

/**
 * 메시지 모델
 */
export interface Message {
  /** 메시지 ID (UUID) */
  id: string;
  /** 세션 ID */
  sessionId: string;
  /** 메시지 역할 */
  role: MessageRole;
  /** 메시지 내용 */
  content: string;
  /** 도구 호출 정보 (있는 경우) */
  toolCalls?: ToolCall[];
  /** 도구 호출 결과 (있는 경우) */
  toolResults?: ToolResult[];
  /** 생성 타임스탬프 */
  createdAt: Date;
  /** 메타데이터 */
  metadata?: Record<string, unknown>;
}

/**
 * 도구 호출 정보
 */
export interface ToolCall {
  /** 도구 호출 ID */
  id: string;
  /** 도구 이름 */
  name: string;
  /** 도구 인자 */
  arguments: Record<string, unknown>;
}

/**
 * 도구 호출 결과
 */
export interface ToolResult {
  /** 도구 호출 ID */
  toolCallId: string;
  /** 실행 결과 */
  result: string;
  /** 에러 여부 */
  isError?: boolean;
}

/**
 * 세션 모델
 */
export interface Session {
  /** 세션 ID (UUID) */
  id: string;
  /** 채널 ID (Telegram/Slack 채널 등) */
  channelId: string;
  /** 사용자 ID */
  userId: string;
  /** 세션 제목 */
  title?: string;
  /** 메시지 목록 */
  messages: Message[];
  /** 컨텍스트 윈도우 설정 */
  contextWindow: ContextWindowConfig;
  /** 생성 타임스탬프 */
  createdAt: Date;
  /** 마지막 업데이트 타임스탬프 */
  updatedAt: Date;
  /** 메타데이터 */
  metadata?: Record<string, unknown>;
}

/**
 * 컨텍스트 윈도우 설정
 */
export interface ContextWindowConfig {
  /** 최대 메시지 수 */
  maxMessages: number;
  /** 최대 토큰 수 (추정치) */
  maxTokens?: number;
  /** 컨텍스트 전략 */
  strategy: ContextStrategy;
  /** 시스템 메시지 유지 여부 */
  preserveSystemMessages: boolean;
}

/**
 * 컨텍스트 전략
 */
export enum ContextStrategy {
  /** 최근 메시지 우선 */
  RECENT_FIRST = 'recent_first',
  /** 중요 메시지 우선 */
  IMPORTANT_FIRST = 'important_first',
  /** 요약 후 보관 */
  SUMMARIZE = 'summarize',
}

/**
 * 세션 조회 옵션
 */
export interface SessionQueryOptions {
  /** 채널 ID 필터 */
  channelId?: string;
  /** 사용자 ID 필터 */
  userId?: string;
  /** 시작 날짜 */
  startDate?: Date;
  /** 종료 날짜 */
  endDate?: Date;
  /** 최대 결과 수 */
  limit?: number;
  /** 건수 */
  offset?: number;
  /** 정렬 순서 */
  orderBy?: 'createdAt' | 'updatedAt';
  /** 정렬 방향 */
  orderDirection?: 'asc' | 'desc';
}

/**
 * 메시지 조회 옵션
 */
export interface MessageQueryOptions {
  /** 세션 ID 필터 */
  sessionId?: string;
  /** 역할 필터 */
  role?: MessageRole;
  /** 시작 날짜 */
  startDate?: Date;
  /** 종료 날짜 */
  endDate?: Date;
  /** 최대 결과 수 */
  limit?: number;
  /** 건수 */
  offset?: number;
}

/**
 * 메모리 관리자 인터페이스
 */
export interface IMemoryManager {
  /** 세션 생성 */
  createSession(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'messages'>): Promise<Session>;
  /** 세션 조회 */
  getSession(sessionId: string): Promise<Session | null>;
  /** 세션 목록 조회 */
  listSessions(options?: SessionQueryOptions): Promise<Session[]>;
  /** 세션 업데이트 */
  updateSession(sessionId: string, updates: Partial<Omit<Session, 'id' | 'createdAt'>>): Promise<Session>;
  /** 세션 삭제 */
  deleteSession(sessionId: string): Promise<void>;
  /** 메시지 추가 */
  addMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
  /** 메시지 목록 조회 */
  getMessages(sessionId: string, options?: MessageQueryOptions): Promise<Message[]>;
  /** 메시지 삭제 */
  deleteMessage(messageId: string): Promise<void>;
  /** 컨텍스트 윈도우 조회 */
  getContextWindow(sessionId: string): Promise<Message[]>;
  /** 데이터베이스 연결 종료 */
  close(): Promise<void>;
}
