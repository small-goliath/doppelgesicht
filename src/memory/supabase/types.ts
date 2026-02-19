/**
 * Supabase 메모리 시스템 타입 정의
 * @description @supabase/supabase-js 기반 PostgreSQL 연동
 */

// Supabase 메모리 시스템 타입 정의

/**
 * Supabase 연결 설정
 */
export interface SupabaseConfig {
  /** Supabase 프로젝트 URL */
  url: string;
  /** Supabase Anon/Public API Key */
  anonKey: string;
  /** 연결 옵션 */
  options?: {
    /** 인증 설정 */
    auth?: {
      persistSession?: boolean;
      autoRefreshToken?: boolean;
    };
    /** 데이터베이스 설정 */
    db?: {
      schema?: string;
    };
    /** 실시간 설정 */
    realtime?: {
      enabled?: boolean;
    };
  };
}

/**
 * Supabase 메모리 설정 (MemoryConfig 확장)
 */
export interface SupabaseMemoryConfig {
  /** Supabase 연결 설정 */
  supabase: SupabaseConfig;
  /** 로컬 캐시 설정 (Supabase 연결 실패 시 폴백) */
  localCache?: {
    /** 로컬 캐시 사용 여부 */
    enabled: boolean;
    /** SQLite 캐시 DB 경로 */
    dbPath: string;
  };
  /** 최대 컨텍스트 길이 */
  maxContextLength: number;
  /** 세션 만료 시간 (밀리초) */
  sessionExpiry: number;
}

/**
 * Supabase 세션 테이블 행 타입
 */
export interface SupabaseSessionRow {
  id: string;
  channel_id: string;
  user_id: string;
  title: string | null;
  max_messages: number;
  max_tokens: number | null;
  context_strategy: string;
  preserve_system_messages: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Supabase 메시지 테이블 행 타입
 */
export interface SupabaseMessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  tool_calls: Record<string, unknown>[] | null;
  tool_results: Record<string, unknown>[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Supabase 연결 상태
 */
export interface SupabaseConnectionState {
  /** 연결 상태 */
  connected: boolean;
  /** 인증 상태 */
  authenticated: boolean;
  /** 마지막 에러 메시지 */
  lastError?: string;
  /** 로컬 캐시 모드 여부 */
  localCacheMode: boolean;
  /** 재연결 시도 횟수 */
  reconnectAttempts: number;
}

/**
 * Supabase 실시간 구독 설정
 */
export interface SupabaseRealtimeConfig {
  /** 구독할 테이블 */
  tables: ('sessions' | 'messages')[];
  /** 이벤트 타입 */
  events: ('INSERT' | 'UPDATE' | 'DELETE')[];
  /** 콜백 함수 */
  callback?: (payload: SupabaseRealtimePayload) => void;
}

/**
 * Supabase 실시간 이벤트 페이로드
 */
export interface SupabaseRealtimePayload {
  /** 이벤트 타입 */
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  /** 테이블명 */
  table: string;
  /** 새 데이터 */
  new: Record<string, unknown> | null;
  /** 이전 데이터 */
  old: Record<string, unknown> | null;
}

/**
 * Supabase 쿼리 결과
 */
export interface SupabaseQueryResult<T> {
  /** 조회된 데이터 */
  data: T | null;
  /** 에러 정보 */
  error: Error | null;
}

/**
 * Supabase 쿼리 결과 (목록)
 */
export interface SupabaseQueryListResult<T> {
  /** 조회된 데이터 목록 */
  data: T[];
  /** 에러 정보 */
  error: Error | null;
  /** 총 개수 (카운트 쿼리 시) */
  count?: number;
}

/**
 * 세션 생성 입력 타입
 */
export interface CreateSessionInput {
  channel_id: string;
  user_id: string;
  title?: string;
  max_messages?: number;
  max_tokens?: number;
  context_strategy?: string;
  preserve_system_messages?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * 메시지 생성 입력 타입
 */
export interface CreateMessageInput {
  session_id: string;
  role: string;
  content: string;
  tool_calls?: Record<string, unknown>[];
  tool_results?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}

/**
 * 세션 업데이트 입력 타입
 */
export interface UpdateSessionInput {
  title?: string;
  max_messages?: number;
  max_tokens?: number;
  context_strategy?: string;
  preserve_system_messages?: boolean;
  metadata?: Record<string, unknown>;
}
