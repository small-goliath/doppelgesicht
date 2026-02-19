/**
 * 로거 설정 관리
 * @description 환경별 로그 설정 및 기본값 제공
 */

import { homedir } from 'os';
import { join } from 'path';
import type { LoggerOptions, EnvironmentLogConfig } from './types.js';
import { LogLevel, LogOutput } from './types.js';

/**
 * 기본 로그 디렉토리 경로
 */
export const DEFAULT_LOG_DIR = join(homedir(), '.doppelgesicht', 'logs');

/**
 * 기본 로그 파일명
 */
export const DEFAULT_LOG_FILENAME = 'app.log';

/**
 * 환경별 기본 설정
 */
export const defaultConfigs: EnvironmentLogConfig = {
  development: {
    minLevel: LogLevel.DEBUG,
    output: LogOutput.CONSOLE,
    consoleFormat: 'pretty',
    useColors: true,
    timestampFormat: 'iso',
    context: 'app',
  },
  production: {
    minLevel: LogLevel.INFO,
    output: LogOutput.BOTH,
    logFilePath: join(DEFAULT_LOG_DIR, DEFAULT_LOG_FILENAME),
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    consoleFormat: 'json',
    useColors: false,
    timestampFormat: 'iso',
    context: 'app',
  },
  test: {
    minLevel: LogLevel.ERROR,
    output: LogOutput.CONSOLE,
    consoleFormat: 'json',
    useColors: false,
    timestampFormat: 'iso',
    context: 'test',
  },
};

/**
 * 현재 환경 감지
 */
export function detectEnvironment(): 'development' | 'production' | 'test' {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return 'test';
  }
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  return 'development';
}

/**
 * 환경별 기본 설정 조회
 */
export function getDefaultConfig(
  env: 'development' | 'production' | 'test' = detectEnvironment()
): LoggerOptions {
  return { ...defaultConfigs[env] };
}

/**
 * 설정 병합 (사용자 설정 + 기본값)
 */
export function mergeConfig(userConfig: Partial<LoggerOptions>): LoggerOptions {
  const env = detectEnvironment();
  const defaultConfig = getDefaultConfig(env);

  return {
    ...defaultConfig,
    ...userConfig,
    // 중첩 객체 병합
    defaultMetadata: {
      ...defaultConfig.defaultMetadata,
      ...userConfig.defaultMetadata,
    },
  };
}

/**
 * 환경 변수에서 설정 로드
 */
export function loadConfigFromEnv(): Partial<LoggerOptions> {
  const config: Partial<LoggerOptions> = {};

  // 로그 레벨
  if (process.env.LOG_LEVEL) {
    const level = process.env.LOG_LEVEL.toLowerCase();
    if (Object.values(LogLevel).includes(level as LogLevel)) {
      config.minLevel = level as LogLevel;
    }
  }

  // 출력 대상
  if (process.env.LOG_OUTPUT) {
    const output = process.env.LOG_OUTPUT.toLowerCase();
    if (Object.values(LogOutput).includes(output as LogOutput)) {
      config.output = output as LogOutput;
    }
  }

  // 로그 파일 경로
  if (process.env.LOG_FILE_PATH) {
    config.logFilePath = process.env.LOG_FILE_PATH;
  }

  // 최대 파일 크기
  if (process.env.LOG_MAX_FILE_SIZE) {
    const size = parseInt(process.env.LOG_MAX_FILE_SIZE, 10);
    if (!isNaN(size)) {
      config.maxFileSize = size;
    }
  }

  // 최대 파일 수
  if (process.env.LOG_MAX_FILES) {
    const files = parseInt(process.env.LOG_MAX_FILES, 10);
    if (!isNaN(files)) {
      config.maxFiles = files;
    }
  }

  // 콘솔 포맷
  if (process.env.LOG_FORMAT) {
    const format = process.env.LOG_FORMAT.toLowerCase();
    if (format === 'json' || format === 'pretty') {
      config.consoleFormat = format;
    }
  }

  // 색상 사용 여부
  if (process.env.LOG_COLORS) {
    config.useColors = process.env.LOG_COLORS === 'true';
  }

  // 컨텍스트
  if (process.env.LOG_CONTEXT) {
    config.context = process.env.LOG_CONTEXT;
  }

  return config;
}

/**
 * 전체 설정 로드 (환경 변수 + 기본값)
 */
export function loadConfig(userConfig?: Partial<LoggerOptions>): LoggerOptions {
  const envConfig = loadConfigFromEnv();
  return mergeConfig({ ...envConfig, ...userConfig });
}
