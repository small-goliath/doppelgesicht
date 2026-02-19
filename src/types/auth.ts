/**
 * 인증 관련 타입 정의
 */

/**
 * LLM 제공자 타입
 */
export type LLMProvider = 'anthropic' | 'openai';

/**
 * 인증 방식 타입
 */
export type AuthType = 'api_key' | 'oauth';

/**
 * 프로파일 상태 타입
 */
export type ProfileStatus = 'healthy' | 'degraded' | 'cooldown' | 'error';

/**
 * Rate Limit 설정
 */
export interface RateLimitConfig {
  /** 분당 최대 요청 수 */
  requestsPerMinute: number;
  /** 일일 최대 요청 수 (0 = 무제한) */
  requestsPerDay: number;
  /** 현재 분 카운터 */
  currentMinuteCount: number;
  /** 현재 일 카운터 */
  currentDayCount: number;
  /** 마지막 요청 시간 */
  lastRequestTime: number;
  /** 마지막 일 초기화 시간 */
  lastDayResetTime: number;
}

/**
 * Health Check 설정
 */
export interface HealthConfig {
  /** 상태 */
  status: ProfileStatus;
  /** 마지막 체크 시간 */
  lastCheckTime: number;
  /** 마지막 에러 메시지 */
  lastError?: string;
  /** 마지막 에러 시간 */
  lastErrorTime?: number;
  /** 연속 실패 횟수 */
  consecutiveFailures: number;
  /** 성공률 (0-1) */
  successRate: number;
}

/**
 * API Key 자격 증명
 */
export interface ApiKeyCredentials {
  type: 'api_key';
  /** API 키 */
  apiKey: string;
  /** 선택적 API 엔드포인트 */
  baseUrl?: string;
}

/**
 * OAuth 자격 증명
 */
export interface OAuthCredentials {
  type: 'oauth';
  /** 액세스 토큰 */
  accessToken: string;
  /** 리프레시 토큰 */
  refreshToken?: string;
  /** 토큰 만료 시간 */
  expiresAt?: number;
  /** 클라이언트 ID */
  clientId?: string;
  /** 클라이언트 시크릿 */
  clientSecret?: string;
}

/**
 * 자격 증명 유니온 타입
 */
export type Credentials = ApiKeyCredentials | OAuthCredentials;

/**
 * Auth Profile 모델
 */
export interface AuthProfile {
  /** 고유 식별자 */
  id: string;
  /** 프로파일 이름 */
  name: string;
  /** LLM 제공자 */
  provider: LLMProvider;
  /** 인증 방식 */
  type: AuthType;
  /** 암호화된 자격 증명 */
  encryptedCredentials: string;
  /** Rate Limit 설정 */
  rateLimits: RateLimitConfig;
  /** Health Check 설정 */
  health: HealthConfig;
  /** 마지막 사용 시간 */
  lastUsed: number;
  /** 연속 실패 횟수 */
  failCount: number;
  /** 우선순위 (낮을수록 높음) */
  priority: number;
  /** Fallback 프로파일 ID 목록 */
  fallbackChain: string[];
  /** 생성 시간 */
  createdAt: number;
  /** 수정 시간 */
  updatedAt: number;
  /** 활성화 여부 */
  isActive: boolean;
  /** 메타데이터 */
  metadata?: Record<string, unknown>;
}

/**
 * Auth Profile 생성 입력
 */
export interface CreateAuthProfileInput {
  name: string;
  provider: LLMProvider;
  type: AuthType;
  credentials: Credentials;
  rateLimits?: Partial<RateLimitConfig>;
  priority?: number;
  fallbackChain?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Auth Profile 업데이트 입력
 */
export interface UpdateAuthProfileInput {
  name?: string;
  credentials?: Credentials;
  rateLimits?: Partial<RateLimitConfig>;
  priority?: number;
  fallbackChain?: string[];
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * 프로파일 필터 옵션
 */
export interface ProfileFilterOptions {
  provider?: LLMProvider;
  status?: ProfileStatus;
  isActive?: boolean;
  minPriority?: number;
  maxPriority?: number;
}

/**
 * 프로파일 목록 정렬 옵션
 */
export type ProfileSortField = 'priority' | 'lastUsed' | 'createdAt' | 'name';
export type SortOrder = 'asc' | 'desc';

export interface ProfileSortOptions {
  field: ProfileSortField;
  order: SortOrder;
}
