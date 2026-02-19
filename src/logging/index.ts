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
