/**
 * 위험도 평가 모듈
 * @description 도구 실행 요청의 위험도를 평가하고 점수를 계산
 */

import {
  type RiskLevel,
  type ApprovalRequest,
  TOOL_RISK_LEVELS,
  RISK_SCORES,
} from './types.js';

/**
 * 위험도 평가 결과
 */
export interface RiskEvaluation {
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
}

/**
 * 위험 요인
 */
export interface RiskFactor {
  type: string;
  description: string;
  impact: number; // 0-100
}

/**
 * 위험도 평가기
 */
export class RiskEvaluator {
  /**
   * 도구의 기본 위험도 조회
   */
  static getBaseRiskLevel(tool: string): RiskLevel {
    return TOOL_RISK_LEVELS[tool] ?? 'Medium';
  }

  /**
   * 위험도 평가 수행
   */
  static evaluate(tool: string, params: Record<string, unknown>): RiskEvaluation {
    const baseLevel = this.getBaseRiskLevel(tool);
    const factors: RiskFactor[] = [];
    let score = RISK_SCORES[baseLevel];

    // 도구별 추가 위험 요인 분석
    switch (tool) {
      case 'exec':
        factors.push(...this.analyzeExecRisk(params));
        break;
      case 'browser':
        factors.push(...this.analyzeBrowserRisk(params));
        break;
      case 'file_write':
      case 'file_delete':
        factors.push(...this.analyzeFileRisk(tool, params));
        break;
      case 'file_read':
        factors.push(...this.analyzeFileReadRisk(params));
        break;
      case 'web_fetch':
        factors.push(...this.analyzeWebFetchRisk(params));
        break;
    }

    // 위험 요인 점수 조정
    for (const factor of factors) {
      score = Math.min(100, score + factor.impact);
    }

    // 최종 위험도 결정
    const finalLevel = this.scoreToLevel(score);

    return {
      level: finalLevel,
      score,
      factors,
    };
  }

  /**
   * 점수를 위험도 레벨로 변환
   */
  private static scoreToLevel(score: number): RiskLevel {
    if (score >= 80) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  }

  /**
   * exec 도구 위험 분석
   */
  private static analyzeExecRisk(params: Record<string, unknown>): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const command = String(params.command || '').toLowerCase();

    // 위험한 명령어 패턴
    const dangerousPatterns = [
      { pattern: /rm\s+-rf\s+\//, desc: '루트 디렉토리 강제 삭제', impact: 30 },
      { pattern: /mkfs\./, desc: '파일시스템 포맷', impact: 30 },
      { pattern: /dd\s+if=.*of=\/dev/, desc: '디스크 직접 쓰기', impact: 30 },
      { pattern: /:\(\)\{.*:\|:&\};:/, desc: '포크 폭탄', impact: 25 },
      { pattern: /curl.*\|.*sh/, desc: '파이프를 통한 스크립트 실행', impact: 20 },
      { pattern: /wget.*-O-.*\|.*sh/, desc: '파이프를 통한 스크립트 실행', impact: 20 },
      { pattern: /sudo/, desc: '관리자 권한 사용', impact: 15 },
      { pattern: /chmod\s+777/, desc: '전체 권한 부여', impact: 10 },
    ];

    for (const { pattern, desc, impact } of dangerousPatterns) {
      if (pattern.test(command)) {
        factors.push({ type: 'dangerous_command', description: desc, impact });
      }
    }

    // 네트워크 관련 명령어
    if (/curl|wget|nc\s|netcat|telnet/.test(command)) {
      factors.push({
        type: 'network_command',
        description: '네트워크 통신 명령어',
        impact: 10,
      });
    }

    return factors;
  }

  /**
   * browser 도구 위험 분석
   */
  private static analyzeBrowserRisk(params: Record<string, unknown>): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const url = String(params.url || '');
    const script = String(params.script || '');

    // 외부 URL 접근
    if (url && !url.startsWith('file://') && !url.startsWith('data:')) {
      factors.push({
        type: 'external_url',
        description: '외부 URL 접근',
        impact: 10,
      });
    }

    // JavaScript 실행
    if (script) {
      factors.push({
        type: 'javascript_execution',
        description: 'JavaScript 코드 실행',
        impact: 15,
      });

      // 위험한 JS 패턴
      const dangerousJSPatterns = [
        { pattern: /eval\s*\(/, desc: 'eval() 사용', impact: 20 },
        { pattern: /Function\s*\(/, desc: 'Function 생성자 사용', impact: 15 },
        { pattern: /document\.write/, desc: 'document.write 사용', impact: 10 },
        { pattern: /localStorage|sessionStorage/, desc: '스토리지 접근', impact: 5 },
      ];

      for (const { pattern, desc, impact } of dangerousJSPatterns) {
        if (pattern.test(script)) {
          factors.push({ type: 'dangerous_js', description: desc, impact });
        }
      }
    }

    return factors;
  }

  /**
   * file_write/file_delete 도구 위험 분석
   */
  private static analyzeFileRisk(
    tool: string,
    params: Record<string, unknown>
  ): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const path = String(params.path || '');

    // 중요 시스템 경로
    const systemPaths = [
      { pattern: /^\/etc\//, desc: '시스템 설정 디렉토리', impact: 25 },
      { pattern: /^\/usr\/bin/, desc: '시스템 실행 파일', impact: 25 },
      { pattern: /^\/bin\//, desc: '시스템 실행 파일', impact: 25 },
      { pattern: /^\/sbin\//, desc: '시스템 관리 파일', impact: 25 },
      { pattern: /^\/boot\//, desc: '부트 디렉토리', impact: 30 },
      { pattern: /^\/sys\//, desc: '시스템 정보', impact: 20 },
      { pattern: /^\/proc\//, desc: '프로세스 정보', impact: 20 },
      { pattern: /\.ssh\//, desc: 'SSH 설정', impact: 20 },
      { pattern: /\.gnupg\//, desc: 'GPG 설정', impact: 20 },
      { pattern: /id_rsa|id_ed25519|id_dsa/, desc: 'SSH 키 파일', impact: 25 },
    ];

    for (const { pattern, desc, impact } of systemPaths) {
      if (pattern.test(path)) {
        factors.push({
          type: 'system_path',
          description: `${desc} 접근`,
          impact,
        });
      }
    }

    // 삭제 작업 추가 위험
    if (tool === 'file_delete') {
      factors.push({
        type: 'delete_operation',
        description: '파일 삭제 작업',
        impact: 10,
      });

      // 재귀 삭제
      if (params.recursive === true) {
        factors.push({
          type: 'recursive_delete',
          description: '재귀적 삭제',
          impact: 15,
        });
      }
    }

    return factors;
  }

  /**
   * file_read 도구 위험 분석
   */
  private static analyzeFileReadRisk(params: Record<string, unknown>): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const path = String(params.path || '');

    // 민감한 파일 패턴
    const sensitivePatterns = [
      { pattern: /\/etc\/passwd/, desc: '사용자 계정 정보', impact: 15 },
      { pattern: /\/etc\/shadow/, desc: '암호화된 비밀번호', impact: 20 },
      { pattern: /\.env/, desc: '환경 변수 파일', impact: 15 },
      { pattern: /\.aws\//, desc: 'AWS 자격 증명', impact: 20 },
      { pattern: /\.ssh\/config/, desc: 'SSH 설정', impact: 15 },
      { pattern: /id_rsa|id_ed25519/, desc: 'SSH 개인 키', impact: 20 },
      { pattern: /token|secret|password|key/i, desc: '자격 증명 파일', impact: 15 },
    ];

    for (const { pattern, desc, impact } of sensitivePatterns) {
      if (pattern.test(path)) {
        factors.push({
          type: 'sensitive_file',
          description: `민감한 파일 접근: ${desc}`,
          impact,
        });
      }
    }

    return factors;
  }

  /**
   * web_fetch 도구 위험 분석
   */
  private static analyzeWebFetchRisk(params: Record<string, unknown>): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const url = String(params.url || '');

    // 비보안 프로토콜
    if (url.startsWith('http://')) {
      factors.push({
        type: 'insecure_protocol',
        description: '비암호화 HTTP 사용',
        impact: 10,
      });
    }

    // 내부 IP 접근 시도
    const internalIPPattern = /^(http:\/\/|https:\/\/)?(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i;
    if (internalIPPattern.test(url)) {
      factors.push({
        type: 'internal_network',
        description: '내부 네트워크 접근 시도',
        impact: 15,
      });
    }

    return factors;
  }

  /**
   * 승인 요청에 위험도 정보 추가
   */
  static enrichRequest(
    request: Omit<ApprovalRequest, 'riskLevel' | 'riskScore'>
  ): ApprovalRequest {
    const evaluation = this.evaluate(request.tool, request.params);

    return {
      ...request,
      riskLevel: evaluation.level,
      riskScore: evaluation.score,
    };
  }
}
