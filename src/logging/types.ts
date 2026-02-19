/**
 * 로깅 시스템 타입 정의
 * @description 구조화된 JSON 로깅을 위한 타입 시스템
 */

/**
 * 로그 레벨 열거형
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 로그 레벨 숫자 값 (비교용)
 */
export const LogLevelValue: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * 구조화된 로그 엔트리
 */
export interface LogEntry {
  /** ISO 8601 타임스탬프 */
  timestamp: string;
  /** 로그 레벨 */
  level: LogLevel;
  /** 로그 메시지 */
  message: string;
  /** 로그 컨텍스트 (모듈/컴포넌트명) */
  context?: string;
  /** 추가 메타데이터 */
  metadata?: Record<string, unknown>;
  /** 에러 객체 (있는 경우) */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  /** 요청 ID (분산 추적용) */
  requestId?: string;
  /** 사용자 ID */
  userId?: string;
  /** 세션 ID */
  sessionId?: string;
}

/**
 * 로그 출력 대상
 */
export enum LogOutput {
  CONSOLE = 'console',
  FILE = 'file',
  BOTH = 'both',
}

/**
 * 로거 설정 옵션
 */
export interface LoggerOptions {
  /** 최소 로그 레벨 (이 레벨 이상만 출력) */
  minLevel: LogLevel;
  /** 로그 출력 대상 */
  output: LogOutput;
  /** 로그 파일 경로 (output이 file 또는 both인 경우) */
  logFilePath?: string;
  /** 로그 파일 최대 크기 (바이트, 기본 10MB) */
  maxFileSize?: number;
  /** 보관할 로그 파일 수 (기본 5) */
  maxFiles?: number;
  /** 콘솔 출력 포맷 (json 또는 pretty) */
  consoleFormat?: 'json' | 'pretty';
  /** 타임스탬프 포맷 (기본 ISO 8601) */
  timestampFormat?: 'iso' | 'local' | 'unix';
  /** 색상 사용 여부 (pretty 모드에서만 적용) */
  useColors?: boolean;
  /** 컨텍스트 접두사 */
  context?: string;
  /** 기본 메타데이터 (모든 로그에 포함) */
  defaultMetadata?: Record<string, unknown>;
}

/**
 * 로그 파일 로테이션 설정
 */
export interface RotationConfig {
  /** 로그 디렉토리 경로 */
  logDir: string;
  /** 기본 로그 파일명 */
  filename: string;
  /** 최대 파일 크기 (바이트) */
  maxSize: number;
  /** 보관할 파일 수 */
  maxFiles: number;
  /** 파일명 패턴 (예: app-%DATE%.log) */
  datePattern?: string;
}

/**
 * 로거 인터페이스
 */
export interface ILogger {
  /** 디버그 로그 */
  debug(message: string, metadata?: Record<string, unknown>): void;
  /** 정보 로그 */
  info(message: string, metadata?: Record<string, unknown>): void;
  /** 경고 로그 */
  warn(message: string, metadata?: Record<string, unknown>): void;
  /** 에러 로그 */
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  /** 로그 레벨 변경 */
  setLevel(level: LogLevel): void;
  /** 자식 로거 생성 (컨텍스트 상속) */
  child(context: string, metadata?: Record<string, unknown>): ILogger;
  /** 로거 종료 (리소스 정리) */
  close(): Promise<void>;
}

/**
 * 환경별 로그 설정
 */
export interface EnvironmentLogConfig {
  development: LoggerOptions;
  production: LoggerOptions;
  test: LoggerOptions;
}

/**
 * 로그 포맷터 인터페이스
 */
export interface LogFormatter {
  /** 로그 엔트리를 문자열로 포맷팅 */
  format(entry: LogEntry): string;
}

/**
 * 로그 트랜스포트 인터페이스
 */
export interface LogTransport {
  /** 로그 전송 */
  send(entry: LogEntry): void;
  /** 트랜스포트 종료 */
  close(): Promise<void>;
}
