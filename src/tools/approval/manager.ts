/**
 * 승인 관리자 모듈
 * @description 승인 요청 관리 및 실행 모드별 처리
 */

import { randomUUID } from 'crypto';
import type { Logger } from '../../logging/index.js';
import {
  type ApprovalRequest,
  type ApprovalResult,
  type ApprovalConfig,
  type ApprovalPolicy,
  type WhitelistRule,
  type RiskLevel,
  type ExecutionMode,
  type ApprovalEventType,
  type ApprovalEventListener,
  RISK_TIMEOUTS,
} from './types.js';
import { RiskEvaluator } from './evaluator.js';

/**
 * 승인 관리자 설정 기본값
 */
const DEFAULT_CONFIG: ApprovalConfig = {
  defaultTimeout: 60,
  highRiskTimeout: 120,
  whitelist: [],
  policy: {
    blockCritical: false,
    whitelistOnly: false,
    rememberDuration: 0,
  },
};

/**
 * 승인 관리자
 */
export class ApprovalManager {
  private requests: Map<string, ApprovalRequest> = new Map();
  private config: ApprovalConfig;
  private logger: Logger;
  private eventListeners: ApprovalEventListener[] = [];
  private rememberedApprovals: Map<string, Date> = new Map();

  constructor(logger: Logger, config?: Partial<ApprovalConfig>) {
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 승인 요청 생성
   */
  createRequest(
    tool: string,
    params: Record<string, unknown>,
    mode: ExecutionMode,
    context?: ApprovalRequest['context']
  ): ApprovalRequest {
    const requestId = randomUUID();
    const evaluation = RiskEvaluator.evaluate(tool, params);
    const timeout = RISK_TIMEOUTS[evaluation.level];
    const now = new Date();

    const request: ApprovalRequest = {
      requestId,
      tool,
      params,
      riskLevel: evaluation.level,
      riskScore: evaluation.score,
      timestamp: now,
      status: 'pending',
      mode,
      expiresAt: new Date(now.getTime() + timeout * 1000),
      context,
    };

    this.requests.set(requestId, request);
    this.emit('request.created', request);

    this.logger.info('Approval request created', {
      requestId,
      tool,
      riskLevel: evaluation.level,
      riskScore: evaluation.score,
      mode,
      expiresAt: request.expiresAt,
    });

    return request;
  }

  /**
   * 승인 요청 조회
   */
  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * 모든 승인 요청 조회
   */
  getAllRequests(): ApprovalRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * 대기 중인 요청 조회
   */
  getPendingRequests(): ApprovalRequest[] {
    return this.getAllRequests().filter((r) => r.status === 'pending');
  }

  /**
   * 승인 처리
   */
  approve(requestId: string, resolvedBy?: string): ApprovalResult {
    const request = this.requests.get(requestId);

    if (!request) {
      return { approved: false, message: '요청을 찾을 수 없습니다' };
    }

    if (request.status !== 'pending') {
      return {
        approved: false,
        message: `요청이 이미 ${request.status} 상태입니다`,
      };
    }

    if (new Date() > request.expiresAt) {
      request.status = 'expired';
      this.emit('request.expired', request);
      return { approved: false, message: '요청이 만료되었습니다' };
    }

    request.status = 'approved';
    request.resolvedAt = new Date();
    request.resolvedBy = resolvedBy || 'system';

    this.emit('request.approved', request);

    this.logger.info('Approval request approved', {
      requestId,
      tool: request.tool,
      resolvedBy: request.resolvedBy,
    });

    // remember 기능
    if (this.config.policy.rememberDuration > 0) {
      const key = this.getRememberKey(request.tool, request.params);
      this.rememberedApprovals.set(key, new Date());
    }

    return { approved: true, message: '승인되었습니다', request };
  }

  /**
   * 거부 처리
   */
  reject(
    requestId: string,
    reason?: string,
    resolvedBy?: string
  ): ApprovalResult {
    const request = this.requests.get(requestId);

    if (!request) {
      return { approved: false, message: '요청을 찾을 수 없습니다' };
    }

    if (request.status !== 'pending') {
      return {
        approved: false,
        message: `요청이 이미 ${request.status} 상태입니다`,
      };
    }

    request.status = 'rejected';
    request.resolvedAt = new Date();
    request.resolvedBy = resolvedBy || 'system';
    request.rejectionReason = reason;

    this.emit('request.rejected', request);

    this.logger.info('Approval request rejected', {
      requestId,
      tool: request.tool,
      reason,
      resolvedBy: request.resolvedBy,
    });

    return { approved: false, message: `거부되었습니다: ${reason || '사유 없음'}`, request };
  }

  /**
   * 요청 취소
   */
  cancel(requestId: string): ApprovalResult {
    const request = this.requests.get(requestId);

    if (!request) {
      return { approved: false, message: '요청을 찾을 수 없습니다' };
    }

    if (request.status !== 'pending') {
      return {
        approved: false,
        message: `요청이 이미 ${request.status} 상태입니다`,
      };
    }

    request.status = 'cancelled';

    this.emit('request.cancelled', request);

    this.logger.info('Approval request cancelled', {
      requestId,
      tool: request.tool,
    });

    return { approved: false, message: '취소되었습니다', request };
  }

  /**
   * 화이트리스트 확인 (Daemon 모드용)
   */
  checkWhitelist(tool: string, params: Record<string, unknown>): boolean {
    if (this.config.policy.whitelistOnly && this.config.whitelist.length === 0) {
      this.logger.warn('Whitelist-only mode but no whitelist rules configured');
      return false;
    }

    const evaluation = RiskEvaluator.evaluate(tool, params);

    for (const rule of this.config.whitelist) {
      // 도구 일치 확인
      if (rule.tool !== '*' && rule.tool !== tool) {
        continue;
      }

      // 위험도 확인
      const riskLevels: RiskLevel[] = ['Low', 'Medium', 'High', 'Critical'];
      const ruleMaxIndex = riskLevels.indexOf(rule.maxRiskLevel);
      const currentIndex = riskLevels.indexOf(evaluation.level);

      if (currentIndex > ruleMaxIndex) {
        continue;
      }

      // 파라미터 패턴 확인
      if (rule.paramPattern) {
        let patternMatch = true;
        for (const [key, pattern] of Object.entries(rule.paramPattern)) {
          const value = String(params[key] || '');
          const regex = new RegExp(pattern);
          if (!regex.test(value)) {
            patternMatch = false;
            break;
          }
        }
        if (!patternMatch) {
          continue;
        }
      }

      // 만료 확인
      if (rule.expiresAt && new Date() > rule.expiresAt) {
        continue;
      }

      this.logger.debug('Whitelist match found', {
        tool,
        ruleId: rule.id,
      });

      return true;
    }

    return false;
  }

  /**
   * 자동 승인 가능 여부 확인
   */
  canAutoApprove(
    tool: string,
    params: Record<string, unknown>,
    mode: ExecutionMode
  ): { canApprove: boolean; reason?: string } {
    const evaluation = RiskEvaluator.evaluate(tool, params);

    // Critical 위험도 차단
    if (this.config.policy.blockCritical && evaluation.level === 'Critical') {
      return {
        canApprove: false,
        reason: 'Critical 위험도는 자동 승인할 수 없습니다',
      };
    }

    // Daemon 모드: 화이트리스트 확인
    if (mode === 'daemon') {
      const inWhitelist = this.checkWhitelist(tool, params);

      if (this.config.policy.whitelistOnly) {
        // whitelistOnly 모드: 화이트리스트에 없으면 거부
        if (!inWhitelist) {
          return {
            canApprove: false,
            reason: '화이트리스트에 없는 요청입니다',
          };
        }
      }

      // 화이트리스트에 있으면 자동 승인
      if (inWhitelist) {
        return {
          canApprove: true,
          reason: '화이트리스트에 등록된 도구',
        };
      }
    }

    // remember 기능 확인
    if (this.config.policy.rememberDuration > 0) {
      const key = this.getRememberKey(tool, params);
      const rememberedAt = this.rememberedApprovals.get(key);

      if (rememberedAt) {
        const elapsed = (new Date().getTime() - rememberedAt.getTime()) / 1000;
        if (elapsed < this.config.policy.rememberDuration) {
          return {
            canApprove: true,
            reason: '이전 승인 기록 사용',
          };
        }
      }
    }

    return { canApprove: false };
  }

  /**
   * 만료된 요청 정리
   */
  cleanupExpired(): number {
    let count = 0;
    const now = new Date();

    for (const [requestId, request] of this.requests) {
      if (request.status === 'pending' && now > request.expiresAt) {
        request.status = 'expired';
        this.emit('request.expired', request);
        count++;

        this.logger.info('Approval request expired', {
          requestId,
          tool: request.tool,
        });
      }
    }

    return count;
  }

  /**
   * 화이트리스트 규칙 추가
   */
  addWhitelistRule(rule: Omit<WhitelistRule, 'id' | 'createdAt'>): WhitelistRule {
    const newRule: WhitelistRule = {
      ...rule,
      id: randomUUID(),
      createdAt: new Date(),
    };

    this.config.whitelist.push(newRule);

    this.logger.info('Whitelist rule added', {
      ruleId: newRule.id,
      tool: newRule.tool,
      description: newRule.description,
    });

    return newRule;
  }

  /**
   * 화이트리스트 규칙 제거
   */
  removeWhitelistRule(ruleId: string): boolean {
    const index = this.config.whitelist.findIndex((r) => r.id === ruleId);
    if (index === -1) {
      return false;
    }

    this.config.whitelist.splice(index, 1);

    this.logger.info('Whitelist rule removed', { ruleId });

    return true;
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<ApprovalConfig>): void {
    this.config = { ...this.config, ...config };

    this.logger.info('Approval config updated', {
      blockCritical: this.config.policy.blockCritical,
      whitelistOnly: this.config.policy.whitelistOnly,
      rememberDuration: this.config.policy.rememberDuration,
    });
  }

  /**
   * 정책 업데이트
   */
  updatePolicy(policy: Partial<ApprovalPolicy>): void {
    this.config.policy = { ...this.config.policy, ...policy };

    this.logger.info('Approval policy updated', this.config.policy);
  }

  /**
   * 이벤트 리스너 등록
   */
  onEvent(listener: ApprovalEventListener): () => void {
    this.eventListeners.push(listener);

    // 구독 해제 함수 반환
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * 이벤트 발생
   */
  private emit(event: ApprovalEventType, request: ApprovalRequest): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event, request);
      } catch (error) {
        this.logger.error('Approval event listener error', { error, event });
      }
    }
  }

  /**
   * remember 키 생성
   */
  private getRememberKey(tool: string, params: Record<string, unknown>): string {
    // 파라미터 정렬하여 일관된 키 생성
    const sortedParams = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join('&');

    return `${tool}:${sortedParams}`;
  }

  /**
   * 설정 조회
   */
  getConfig(): ApprovalConfig {
    return { ...this.config };
  }

  /**
   * 통계 정보
   */
  getStats(): {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    cancelled: number;
  } {
    const requests = this.getAllRequests();
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
      expired: requests.filter((r) => r.status === 'expired').length,
      cancelled: requests.filter((r) => r.status === 'cancelled').length,
    };
  }
}
