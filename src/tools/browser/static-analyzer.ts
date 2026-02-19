/**
 * 정적 분석기
 * @description JavaScript 코드 정적 분석 - eval, new Function 등 위험 패턴 감지
 */

import type {
  StaticAnalysisRule,
  StaticAnalysisResult,
  StaticAnalysisViolation,
} from './types.js';
import { DEFAULT_STATIC_RULES } from './types.js';
import type { ILogger } from '../../logging/index.js';

/**
 * 정적 분석기
 */
export class StaticAnalyzer {
  private rules: StaticAnalysisRule[];
  private logger: ILogger;

  constructor(logger: ILogger, rules?: StaticAnalysisRule[]) {
    this.logger = logger.child('StaticAnalyzer') as ILogger;
    this.rules = rules ?? DEFAULT_STATIC_RULES;
  }

  /**
   * 코드 분석
   */
  analyze(code: string): StaticAnalysisResult {
    const startTime = Date.now();
    const violations: StaticAnalysisViolation[] = [];

    this.logger.debug('Starting static analysis', {
      codeLength: code.length,
      rulesCount: this.rules.length,
    });

    // 줄 단위로 분석
    const lines = code.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;

      for (const rule of this.rules) {
        const matches = line.match(rule.pattern);

        if (matches) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            match: matches[0],
            line: lineNumber,
            description: rule.description,
          });

          this.logger.warn('Static analysis violation detected', {
            ruleId: rule.id,
            line: lineNumber,
            match: matches[0],
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    const passed = !violations.some((v) => v.severity === 'critical');

    this.logger.debug('Static analysis completed', {
      duration,
      violationsCount: violations.length,
      passed,
    });

    return {
      passed,
      violations,
      duration,
    };
  }

  /**
   * 규칙 추가
   */
  addRule(rule: StaticAnalysisRule): void {
    this.rules.push(rule);
    this.logger.debug('Rule added', { ruleId: rule.id });
  }

  /**
   * 규칙 제거
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      this.logger.debug('Rule removed', { ruleId });
      return true;
    }
    return false;
  }

  /**
   * 현재 규칙 목록 반환
   */
  getRules(): StaticAnalysisRule[] {
    return [...this.rules];
  }
}

/**
 * 정적 분석기 인스턴스 생성
 */
export function createStaticAnalyzer(logger: ILogger, rules?: StaticAnalysisRule[]): StaticAnalyzer {
  return new StaticAnalyzer(logger, rules);
}
