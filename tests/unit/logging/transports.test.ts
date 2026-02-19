import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ConsoleTransport,
  MemoryTransport,
} from '../../../src/logging/transports.js';
import { LogLevel } from '../../../src/logging/types.js';
import type { LogEntry } from '../../../src/logging/types.js';

describe('Transports', () => {
  const baseEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    message: 'Test message',
    context: 'test',
  };

  describe('ConsoleTransport', () => {
    let transport: ConsoleTransport;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      transport = new ConsoleTransport('pretty', false);
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(async () => {
      await transport.close();
      vi.restoreAllMocks();
    });

    it('INFO 레벨 로그를 console.log로 출력해야 함', () => {
      transport.send(baseEntry);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('ERROR 레벨 로그를 console.error로 출력해야 함', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      transport.send({ ...baseEntry, level: LogLevel.ERROR });
      expect(errorSpy).toHaveBeenCalled();
    });

    it('WARN 레벨 로그를 console.warn으로 출력해야 함', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      transport.send({ ...baseEntry, level: LogLevel.WARN });
      expect(warnSpy).toHaveBeenCalled();
    });

    it('DEBUG 레벨 로그를 console.log로 출력해야 함', () => {
      transport.send({ ...baseEntry, level: LogLevel.DEBUG });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('MemoryTransport', () => {
    let transport: MemoryTransport;

    beforeEach(() => {
      transport = new MemoryTransport();
    });

    afterEach(async () => {
      await transport.close();
    });

    it('로그를 메모리에 저장해야 함', () => {
      transport.send(baseEntry);
      const logs = transport.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(baseEntry);
    });

    it('여러 로그를 저장해야 함', () => {
      transport.send({ ...baseEntry, message: 'message 1' });
      transport.send({ ...baseEntry, message: 'message 2' });
      transport.send({ ...baseEntry, message: 'message 3' });

      const logs = transport.getLogs();
      expect(logs).toHaveLength(3);
    });

    it('최대 개수를 초과하면 오래된 로그를 삭제해야 함', () => {
      transport = new MemoryTransport(3); // 최대 3개

      transport.send({ ...baseEntry, message: '1' });
      transport.send({ ...baseEntry, message: '2' });
      transport.send({ ...baseEntry, message: '3' });
      transport.send({ ...baseEntry, message: '4' }); // 1번 삭제됨

      const logs = transport.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('2');
      expect(logs[2].message).toBe('4');
    });

    it('특정 레벨의 로그만 조회할 수 있어야 함', () => {
      transport.send({ ...baseEntry, level: LogLevel.INFO, message: 'info 1' });
      transport.send({ ...baseEntry, level: LogLevel.ERROR, message: 'error 1' });
      transport.send({ ...baseEntry, level: LogLevel.INFO, message: 'info 2' });
      transport.send({ ...baseEntry, level: LogLevel.WARN, message: 'warn 1' });

      const errorLogs = transport.getLogsByLevel(LogLevel.ERROR);
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('error 1');

      const infoLogs = transport.getLogsByLevel(LogLevel.INFO);
      expect(infoLogs).toHaveLength(2);
    });

    it('clear로 모든 로그를 삭제할 수 있어야 함', () => {
      transport.send(baseEntry);
      transport.send(baseEntry);

      expect(transport.getLogs()).toHaveLength(2);

      transport.clear();
      expect(transport.getLogs()).toHaveLength(0);
    });

    it('close로 모든 로그를 삭제해야 함', async () => {
      transport.send(baseEntry);
      expect(transport.getLogs()).toHaveLength(1);

      await transport.close();
      expect(transport.getLogs()).toHaveLength(0);
    });

    it('getLogs는 복사본을 반환해야 함', () => {
      transport.send(baseEntry);

      const logs1 = transport.getLogs();
      const logs2 = transport.getLogs();

      expect(logs1).toEqual(logs2);
      expect(logs1).not.toBe(logs2); // 다른 참조
    });
  });
});
