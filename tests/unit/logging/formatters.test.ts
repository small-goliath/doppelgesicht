import { describe, it, expect } from 'vitest';
import {
  JsonFormatter,
  PrettyFormatter,
  createFormatter,
} from '../../../src/logging/formatters.js';
import { LogLevel } from '../../../src/logging/types.js';
import type { LogEntry } from '../../../src/logging/types.js';

describe('Formatters', () => {
  const baseEntry: LogEntry = {
    timestamp: '2024-01-15T10:30:00.000Z',
    level: LogLevel.INFO,
    message: 'Test message',
    context: 'test-context',
  };

  describe('JsonFormatter', () => {
    it('로그 엔트리를 JSON 문자열로 변환해야 함', () => {
      const formatter = new JsonFormatter();
      const result = formatter.format(baseEntry);

      const parsed = JSON.parse(result);
      expect(parsed.timestamp).toBe(baseEntry.timestamp);
      expect(parsed.level).toBe(baseEntry.level);
      expect(parsed.message).toBe(baseEntry.message);
      expect(parsed.context).toBe(baseEntry.context);
    });

    it('메타데이터를 포함한 JSON을 생성해야 함', () => {
      const entry: LogEntry = {
        ...baseEntry,
        metadata: { userId: '123', action: 'login' },
      };

      const formatter = new JsonFormatter();
      const result = formatter.format(entry);

      const parsed = JSON.parse(result);
      expect(parsed.metadata).toEqual({ userId: '123', action: 'login' });
    });

    it('에러 정보를 포함한 JSON을 생성해야 함', () => {
      const entry: LogEntry = {
        ...baseEntry,
        error: {
          name: 'TestError',
          message: 'Something went wrong',
          stack: 'Error: Something went wrong\n    at Test.method',
        },
      };

      const formatter = new JsonFormatter();
      const result = formatter.format(entry);

      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.name).toBe('TestError');
      expect(parsed.error.message).toBe('Something went wrong');
    });
  });

  describe('PrettyFormatter', () => {
    it('로그 엔트리를 읽기 쉬운 형태로 변환해야 함', () => {
      const formatter = new PrettyFormatter(false); // 색상 비활성화
      const result = formatter.format(baseEntry);

      expect(result).toContain('INFO');
      expect(result).toContain('Test message');
      expect(result).toContain('[test-context]');
    });

    it('타임스탬프를 포맷팅해야 함', () => {
      const formatter = new PrettyFormatter(false);
      const result = formatter.format(baseEntry);

      // HH:MM:SS.mmm 형식 확인
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
    });

    it('메타데이터를 포맷팅해야 함', () => {
      const entry: LogEntry = {
        ...baseEntry,
        metadata: { userId: '123', count: 42, active: true },
      };

      const formatter = new PrettyFormatter(false);
      const result = formatter.format(entry);

      expect(result).toContain('meta:');
      expect(result).toContain('userId="123"');
      expect(result).toContain('count=42');
      expect(result).toContain('active=true');
    });

    it('에러 정보를 포맷팅해야 함', () => {
      const entry: LogEntry = {
        ...baseEntry,
        error: {
          name: 'TestError',
          message: 'Something went wrong',
          stack: 'Error: Something went wrong\n    at line 1\n    at line 2',
        },
      };

      const formatter = new PrettyFormatter(false);
      const result = formatter.format(entry);

      expect(result).toContain('error:');
      expect(result).toContain('TestError:');
      expect(result).toContain('Something went wrong');
    });

    it('스택 트레이스를 제한해서 표시해야 함', () => {
      const stackLines = Array(10)
        .fill(0)
        .map((_, i) => `    at line ${i}`)
        .join('\n');

      const entry: LogEntry = {
        ...baseEntry,
        error: {
          name: 'TestError',
          message: 'Error',
          stack: `Error: Error\n${stackLines}`,
        },
      };

      const formatter = new PrettyFormatter(false);
      const result = formatter.format(entry);

      // 처음 5줄만 표시하고 "... more lines" 표시
      expect(result).toContain('... 5 more lines');
    });

    it('사용자 및 세션 ID를 표시해야 함', () => {
      const entry: LogEntry = {
        ...baseEntry,
        userId: 'user-123',
        sessionId: 'session-456',
      };

      const formatter = new PrettyFormatter(false);
      const result = formatter.format(entry);

      expect(result).toContain('ctx:');
      expect(result).toContain('user=user-123');
      expect(result).toContain('session=session-456');
    });

    it('요청 ID를 표시해야 함', () => {
      const entry: LogEntry = {
        ...baseEntry,
        requestId: 'req-abc-123',
      };

      const formatter = new PrettyFormatter(false);
      const result = formatter.format(entry);

      expect(result).toContain('(req-abc-123)');
    });

    it('색상 코드를 포함할 수 있어야 함', () => {
      const formatter = new PrettyFormatter(true); // 색상 활성화
      const result = formatter.format(baseEntry);

      // ANSI 색상 코드 확인
      expect(result).toContain('\x1b[');
    });

    it('색상 비활성화 시 색상 코드를 포함하지 않아야 함', () => {
      const formatter = new PrettyFormatter(false); // 색상 비활성화
      const result = formatter.format(baseEntry);

      // ANSI 색상 코드 없음
      expect(result).not.toContain('\x1b[');
    });
  });

  describe('createFormatter', () => {
    it('json 타입 포맷터를 생성해야 함', () => {
      const formatter = createFormatter('json');
      expect(formatter).toBeInstanceOf(JsonFormatter);
    });

    it('pretty 타입 포맷터를 생성해야 함', () => {
      const formatter = createFormatter('pretty');
      expect(formatter).toBeInstanceOf(PrettyFormatter);
    });

    it('기본값으로 json 포맷터를 생성해야 함', () => {
      const formatter = createFormatter('unknown' as any);
      expect(formatter).toBeInstanceOf(JsonFormatter);
    });
  });
});
