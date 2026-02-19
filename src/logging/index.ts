/**
 * 로깅 시스템 모듈
 * @description 구조화된 JSON 로깅, 파일 로테이션, 환경별 설정 지원
 *
 * @example
 * ```typescript
 * import { Logger, LogLevel, getLogger, initializeLogger } from './logging/index.js';
 *
 * // 기본 로거 사용
 * const logger = getLogger();
 * logger.info('Application started');
 * logger.error('Something went wrong', error);
 *
 * // 커스텀 설정으로 초기화
 * initializeLogger({
 *   minLevel: LogLevel.DEBUG,
 *   output: 'both',
 *   logFilePath: '/path/to/app.log',
 * });
 *
 * // 자식 로거 생성
 * const childLogger = logger.child('database', { connection: 'postgres' });
 * childLogger.debug('Connected to database');
 * ```
 */

// 타입 재낳ㅇ
export type {
  LogEntry,
  LoggerOptions,
  LogFormatter,
  LogTransport,
  ILogger,
  RotationConfig,
  EnvironmentLogConfig,
} from './types.js';

// 열거형 재낳ㅇ
export { LogLevel, LogOutput, LogLevelValue } from './types.js';

// 로거 클래스
export { Logger, initializeLogger, getLogger, closeLogger } from './logger.js';

import { Logger } from './logger.js';

/**
 * 간편 로거 생성 함수
 * @param options - 로거 옵션
 * @returns Logger 인스턴스
 */
export function createLogger(options?: {
  level?: 'debug' | 'info' | 'warn' | 'error';
  console?: boolean;
  file?: { enabled: boolean; path?: string };
  json?: boolean;
}): Logger {
  const loggerOptions: Partial<import('./types.js').LoggerOptions> = {
    minLevel: (options?.level?.toUpperCase() as import('./types.js').LogLevel) || 'INFO',
    output: options?.console !== false ? ('console' as import('./types.js').LogOutput) : ('file' as import('./types.js').LogOutput),
    useColors: true,
  };

  if (options?.file?.enabled) {
    loggerOptions.output = 'both' as import('./types.js').LogOutput;
    loggerOptions.logFilePath = options.file.path;
  }

  return new Logger(loggerOptions as import('./types.js').LoggerOptions);
}

// 포맷터
export { JsonFormatter, PrettyFormatter, createFormatter } from './formatters.js';

// 트랜스포트
export { ConsoleTransport, FileTransport, CompositeTransport, MemoryTransport } from './transports.js';

// 로테이션
export { LogRotator, DateBasedRotator } from './rotation.js';

// 설정
export {
  DEFAULT_LOG_DIR,
  DEFAULT_LOG_FILENAME,
  defaultConfigs,
  detectEnvironment,
  getDefaultConfig,
  mergeConfig,
  loadConfigFromEnv,
  loadConfig,
} from './config.js';
