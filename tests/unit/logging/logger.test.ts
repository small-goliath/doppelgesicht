import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Logger,
  initializeLogger,
  getLogger,
  closeLogger,
} from '../../../src/logging/logger.js';
import { LogLevel, LogOutput } from '../../../src/logging/types.js';
import { MemoryTransport } from '../../../src/logging/transports.js';

describe('Logger', () => {
  let logger: Logger;
  let memoryTransport: MemoryTransport;

  beforeEach(() => {
    memoryTransport = new MemoryTransport();
    logger = new Logger({
      minLevel: LogLevel.DEBUG,
      output: LogOutput.CONSOLE,
      context: 'test',
    });

    // 트랜스포트 교체
    (logger as any).transport = memoryTransport;
  });

  afterEach(async () => {
    await logger.close();
    vi.restoreAllMocks();
  });

  describe('로그 레벨', () => {
    it('DEBUG 레벨 로그를 출력해야 함', () => {
      logger.debug('debug message');
      const logs = memoryTransport.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.DEBUG);
      expect(logs[0].message).toBe('debug message');
    });

    it('INFO 레벨 로그를 출력해야 함', () => {
      logger.info('info message');
      const logs = memoryTransport.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.INFO);
    });

    it('WARN 레벨 로그를 출력해야 함', () => {
      logger.warn('warn message');
      const logs = memoryTransport.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.WARN);
    });

    it('ERROR 레벨 로그를 출력해야 함', () => {
      const error = new Error('test error');
      logger.error('error message', error);
      const logs = memoryTransport.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].error).toBeDefined();
      expect(logs[0].error?.message).toBe('test error');
    });

    it('설정된 최소 레벨 이상만 출력해야 함', () => {
      logger.setLevel(LogLevel.WARN);

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      const logs = memoryTransport.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[1].level).toBe(LogLevel.ERROR);
    });
  });

  describe('메타데이터', () => {
    it('메타데이터를 포함하여 로그를 출력해야 함', () => {
      logger.info('message', { userId: '123', action: 'login' });
      const logs = memoryTransport.getLogs();
      expect(logs[0].metadata).toEqual({ userId: '123', action: 'login' });
    });

    it('기본 메타데이터와 함께 로그를 출력해야 함', () => {
      const loggerWithDefaults = new Logger({
        minLevel: LogLevel.DEBUG,
        output: LogOutput.CONSOLE,
        context: 'test',
        defaultMetadata: { app: 'test-app', version: '1.0.0' },
      });
      (loggerWithDefaults as any).transport = memoryTransport;

      loggerWithDefaults.info('message', { userId: '123' });
      const logs = memoryTransport.getLogs();
      expect(logs[0].metadata).toEqual({
        app: 'test-app',
        version: '1.0.0',
        userId: '123',
      });
    });
  });

  describe('컨텍스트', () => {
    it('컨텍스트를 포함하여 로그를 출력해야 함', () => {
      logger.info('message');
      const logs = memoryTransport.getLogs();
      expect(logs[0].context).toBe('test');
    });

    it('자식 로거는 부모 컨텍스트를 상속해야 함', () => {
      const childLogger = logger.child('child', { extra: 'data' });
      (childLogger as any).transport = memoryTransport;

      childLogger.info('child message');
      const logs = memoryTransport.getLogs();
      expect(logs[0].context).toBe('test:child');
      expect(logs[0].metadata).toEqual({ extra: 'data' });
    });
  });

  describe('타임스탬프', () => {
    it('ISO 8601 형식의 타임스탬프를 포함해야 함', () => {
      logger.info('message');
      const logs = memoryTransport.getLogs();
      const timestamp = logs[0].timestamp;

      // ISO 8601 형식 검증
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('글로벌 로거', () => {
    afterEach(async () => {
      await closeLogger();
    });

    it('initializeLogger로 글로벌 로거를 초기화해야 함', () => {
      const globalLogger = initializeLogger({
        minLevel: LogLevel.INFO,
        output: LogOutput.CONSOLE,
      });

      expect(globalLogger).toBeDefined();
      expect(getLogger()).toBe(globalLogger);
    });

    it('getLogger는 초기화되지 않은 경우 기본 로거를 반환해야 함', () => {
      const logger = getLogger();
      expect(logger).toBeDefined();
    });

    it('closeLogger로 글로벌 로거를 종료해야 함', async () => {
      initializeLogger({
        minLevel: LogLevel.INFO,
        output: LogOutput.CONSOLE,
      });

      await closeLogger();

      // 종료 후 새로운 로거 반환
      const newLogger = getLogger();
      expect(newLogger).toBeDefined();
    });
  });

  describe('에러 처리', () => {
    it('트랜스포트 에러가 발생필도 콘솔에 출력해야 함', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 에러를 발생시키는 트랜스포트
      const errorTransport = {
        send: () => {
          throw new Error('Transport error');
        },
        close: async () => {},
      };

      (logger as any).transport = errorTransport;
      logger.info('message');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send log:',
        expect.any(Error)
      );
    });
  });

  describe('설정 조회', () => {
    it('현재 설정을 조회할 수 있어야 함', () => {
      const options = logger.getOptions();
      expect(options.minLevel).toBe(LogLevel.DEBUG);
      expect(options.context).toBe('test');
    });
  });
});
