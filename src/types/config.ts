/**
 * 설정 관련 타입 정의
 */

/**
 * LLM 설정
 */
export interface LLMConfig {
  /** 기본 제공자 */
  defaultProvider: 'anthropic' | 'openai';
  /** 기본 모델 */
  defaultModel: string;
  /** 최대 토큰 수 */
  maxTokens: number;
  /** 온도 (0-2) */
  temperature: number;
}

/**
 * 채널 설정
 */
export interface ChannelConfig {
  /** 활성화 여부 */
  enabled: boolean;
  /** Telegram 설정 */
  telegram?: {
    botToken?: string;
    allowedUsers?: string[];
  };
  /** Slack 설정 */
  slack?: {
    appToken?: string;
    botToken?: string;
    allowedUsers?: string[];
  };
  /** Discord 설정 (F005-1) */
  discord?: {
    botToken?: string;
    allowedUsers?: string[];
    allowedChannels?: string[];
    allowedGuilds?: string[];
    allowDMs?: boolean;
  };
}

/**
 * Gateway 설정
 */
export interface GatewayConfig {
  /** HTTP 포트 */
  httpPort: number;
  /** WebSocket 포트 */
  wsPort: number;
  /** 호스트 */
  host: string;
  /** CORS 설정 */
  cors?: {
    origins: string[];
  };
  /** 인증 설정 */
  auth?: {
    jwtSecret: string;
    tokenExpiry: number;
  };
}

/**
 * 로깅 설정
 */
export interface LoggingConfig {
  /** 로그 레벨 */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** 콘솔 출력 */
  console: boolean;
  /** 파일 출력 */
  file?: {
    enabled: boolean;
    path: string;
    maxSize: string;
    maxFiles: number;
  };
  /** JSON 형식 */
  json: boolean;
}

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
 * 메모리 설정
 */
export interface MemoryConfig {
  /** Supabase 설정 (F008) */
  supabase: SupabaseConfig;
  /** 최대 컨텍스트 길이 */
  maxContextLength: number;
  /** 세션 만료 시간 (밀리초) */
  sessionExpiry: number;
}

/**
 * 보안 설정
 */
export interface SecurityConfig {
  /** 승인 모드 */
  approvalMode: 'interactive' | 'whitelist';
  /** 화이트리스트 도구 */
  whitelistedTools?: string[];
  /** 위험도별 타임아웃 */
  timeouts: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

/**
 * 애플리케이션 설정
 */
export interface AppConfig {
  /** 설정 버전 */
  version: string;
  /** LLM 설정 */
  llm: LLMConfig;
  /** 채널 설정 */
  channels: ChannelConfig;
  /** Gateway 설정 */
  gateway: GatewayConfig;
  /** 로깅 설정 */
  logging: LoggingConfig;
  /** 메모리 설정 */
  memory: MemoryConfig;
  /** 보안 설정 */
  security: SecurityConfig;
}

/**
 * 설정 변경 콜백 타입
 */
export type ConfigChangeCallback = (config: AppConfig) => void;

/**
 * 설정 검증 결과
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}
