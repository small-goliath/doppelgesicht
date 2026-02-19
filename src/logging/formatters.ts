/**
 * 로그 포맷터 구현
 * @description JSON 및 Pretty 포맷팅 지원
 */

import type { LogEntry, LogFormatter } from './types.js';
import { LogLevel } from './types.js';

/**
 * 색상 코드 (ANSI)
 */
const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * 로그 레벨별 색상 매핑
 */
const LevelColors: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: Colors.gray,
  [LogLevel.INFO]: Colors.cyan,
  [LogLevel.WARN]: Colors.yellow,
  [LogLevel.ERROR]: Colors.red,
};

/**
 * JSON 포맷터
 * 구조화된 JSON 문자열로 변환
 */
export class JsonFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    return JSON.stringify(entry);
  }
}

/**
 * Pretty 포맷터
 * 사람이 읽기 쉬운 형태로 변환
 */
export class PrettyFormatter implements LogFormatter {
  private useColors: boolean;

  constructor(useColors: boolean = true) {
    this.useColors = useColors;
  }

  format(entry: LogEntry): string {
    const { timestamp, level, message, context, metadata, error, requestId, userId, sessionId } = entry;

    // 타임스탬프 포맷팅
    const ts = this.formatTimestamp(timestamp);

    // 레벨 표시 (색상 적용)
    const levelStr = this.colorize(
      level.toUpperCase().padEnd(5),
      LevelColors[level]
    );

    // 컨텍스트 표시
    const contextStr = context ? this.colorize(`[${context}]`, Colors.magenta) : '';

    // 추적 ID 표시
    const traceStr = requestId ? this.colorize(`(${requestId})`, Colors.dim) : '';

    // 기본 메시지 조합
    let output = `${ts} ${levelStr} ${contextStr} ${traceStr} ${message}`;

    // 메타데이터 추가
    if (metadata && Object.keys(metadata).length > 0) {
      const metaStr = Object.entries(metadata)
        .map(([key, value]) => `${key}=${this.formatValue(value)}`)
        .join(' ');
      output += `\n  ${this.colorize('meta:', Colors.dim)} ${metaStr}`;
    }

    // 에러 정보 추가
    if (error) {
      output += `\n  ${this.colorize('error:', Colors.red)} ${error.name}: ${error.message}`;
      if (error.stack) {
        const stackLines = error.stack.split('\n').slice(1);
        const formattedStack = stackLines
          .slice(0, 5) // 처음 5줄만 표시
          .map(line => `    ${this.colorize(line.trim(), Colors.gray)}`)
          .join('\n');
        output += `\n${formattedStack}`;
        if (stackLines.length > 5) {
          output += `\n    ${this.colorize(`... ${stackLines.length - 5} more lines`, Colors.gray)}`;
        }
      }
    }

    // 사용자/세션 정보 추가
    if (userId || sessionId) {
      const ids = [];
      if (userId) ids.push(`user=${userId}`);
      if (sessionId) ids.push(`session=${sessionId}`);
      output += `\n  ${this.colorize('ctx:', Colors.dim)} ${ids.join(' ')}`;
    }

    return output;
  }

  /**
   * 타임스탬프 포맷팅
   */
  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    const ss = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return this.colorize(`${hh}:${mm}:${ss}.${ms}`, Colors.dim);
  }

  /**
   * 값 포맷팅
   */
  private formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return `{${Object.keys(value as object).length} keys}`;
    return String(value);
  }

  /**
   * 색상 적용
   */
  private colorize(text: string, color: string): string {
    if (!this.useColors) return text;
    return `${color}${text}${Colors.reset}`;
  }
}

/**
 * 포맷터 팩토리
 */
export function createFormatter(type: 'json' | 'pretty', useColors: boolean = true): LogFormatter {
  switch (type) {
    case 'json':
      return new JsonFormatter();
    case 'pretty':
      return new PrettyFormatter(useColors);
    default:
      return new JsonFormatter();
  }
}
