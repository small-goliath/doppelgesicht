/**
 * 승인 UI 모듈
 * @description 터미널 인터랙티브 승인 인터페이스 (@clack/prompts)
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { ApprovalRequest, RiskLevel, ApprovalUIOptions } from './types.js';
import { RISK_TIMEOUTS } from './types.js';

/**
 * 위험도별 색상
 */
const RISK_COLORS: Record<RiskLevel, (text: string) => string> = {
  Critical: pc.red,
  High: pc.yellow,
  Medium: pc.blue,
  Low: pc.green,
};

/**
 * 위험도별 아이콘
 */
const RISK_ICONS: Record<RiskLevel, string> = {
  Critical: '🔴',
  High: '🟠',
  Medium: '🟡',
  Low: '🟢',
};

/**
 * 승인 UI 결과
 */
export interface ApprovalUIResult {
  approved: boolean;
  reason?: string;
  timedOut: boolean;
}

/**
 * 승인 UI
 */
export class ApprovalUI {
  /**
   * 승인 요청 UI 표시
   */
  static async prompt(
    request: ApprovalRequest,
    options: Partial<ApprovalUIOptions> = {}
  ): Promise<ApprovalUIResult> {
    const timeout = options.timeout ?? RISK_TIMEOUTS[request.riskLevel];
    const showDetails = options.showDetails ?? true;

    // 헤더 표시
    console.log();
    p.intro(`${RISK_ICONS[request.riskLevel]} 도구 실행 승인 요청`);

    // 요청 정보 표시
    const s = p.spinner();
    s.start('승인 요청 처리 중...');

    // 상세 정보 표시
    if (showDetails) {
      s.stop();
      this.renderRequestDetails(request);
    }

    // 위험도 경고 (Critical/High)
    if (request.riskLevel === 'Critical' || request.riskLevel === 'High') {
      console.log();
      p.note(
        pc.bold(RISK_COLORS[request.riskLevel](
          `⚠️  ${request.riskLevel} 위험도 작업입니다!`
        )) +
        '\n' +
        pc.dim('이 작업은 시스템에 영향을 줄 수 있습니다.'),
        '경고'
      );
    }

    // 타임아웃 안내
    console.log();
    p.log.info(pc.dim(`⏱️  타임아웃: ${timeout}초`));

    // 승인/거부 선택
    const result = await this.promptWithTimeout(request, timeout);

    return result;
  }

  /**
   * 요청 상세 정보 렌더링
   */
  private static renderRequestDetails(request: ApprovalRequest): void {
    const color = RISK_COLORS[request.riskLevel];

    const details = [
      pc.bold('요청 ID: ') + pc.dim(request.requestId.slice(0, 8) + '...'),
      pc.bold('도구: ') + pc.cyan(request.tool),
      pc.bold('위험도: ') + color(`${RISK_ICONS[request.riskLevel]} ${request.riskLevel} (${request.riskScore}/100)`),
      pc.bold('모드: ') + pc.dim(request.mode === 'cli' ? 'CLI' : 'Daemon'),
    ];

    // 파라미터 표시
    const paramEntries = Object.entries(request.params);
    if (paramEntries.length > 0) {
      details.push(pc.bold('파라미터:'));
      for (const [key, value] of paramEntries) {
        const valueStr = this.truncateValue(value, 50);
        details.push(`  ${pc.cyan(key)}: ${pc.dim(valueStr)}`);
      }
    }

    // 컨텍스트 표시
    if (request.context?.source) {
      details.push(pc.bold('출처: ') + pc.dim(request.context.source));
    }

    p.log.message(details.join('\n'));
  }

  /**
   * 값 표시 제한
   */
  private static truncateValue(value: unknown, maxLength: number): string {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  }

  /**
   * 타임아웃이 있는 프롬프트
   */
  private static async promptWithTimeout(
    request: ApprovalRequest,
    timeoutSeconds: number
  ): Promise<ApprovalUIResult> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    // 타임아웃 타이머 설정
    let timedOut = false;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        timedOut = true;
        reject(new Error('TIMEOUT'));
      }, timeoutMs);
    });

    // 사용자 입력 Promise
    const promptPromise = this.showPrompt(request);

    try {
      const result = await Promise.race([promptPromise, timeoutPromise]);
      return result;
    } catch (error) {
      if (timedOut) {
        console.log();
        p.log.error(pc.red('⏱️  시간 초과! 요청이 자동으로 거부되었습니다.'));
        return { approved: false, timedOut: true };
      }
      throw error;
    }
  }

  /**
   * 실제 프롬프트 표시
   */
  private static async showPrompt(
    request: ApprovalRequest
  ): Promise<ApprovalUIResult> {
    // 선택 옵션
    const action = await p.select({
      message: '이 작업을 승인하시겠습니까?',
      options: [
        { value: 'approve', label: '✅ 승인', hint: '작업을 실행합니다' },
        { value: 'reject', label: '❌ 거부', hint: '작업을 취소합니다' },
        ...(request.riskLevel !== 'Critical'
          ? [{ value: 'approve_once', label: '✅ 한 번만 승인', hint: '이번만 승인하고 기록하지 않습니다' }]
          : []),
      ],
    });

    if (p.isCancel(action) || action === 'reject') {
      // 거부 사유 입력
      const reason = await p.text({
        message: '거부 사유를 입력하세요 (선택):',
        placeholder: '사유 없음',
      });

      p.outro(pc.red('❌ 작업이 거부되었습니다'));

      return {
        approved: false,
        reason: p.isCancel(reason) ? undefined : (reason || undefined),
        timedOut: false,
      };
    }

    if (action === 'approve' || action === 'approve_once') {
      // Critical 위험도는 추가 확인
      if (request.riskLevel === 'Critical') {
        const confirmed = await p.confirm({
          message: pc.red('정말로 이 위험한 작업을 실행하시겠습니까?'),
          initialValue: false,
        });

        if (!confirmed || p.isCancel(confirmed)) {
          p.outro(pc.red('❌ 작업이 거부되었습니다'));
          return { approved: false, timedOut: false };
        }
      }

      p.outro(pc.green('✅ 작업이 승인되었습니다'));

      return {
        approved: true,
        timedOut: false,
      };
    }

    return { approved: false, timedOut: false };
  }

  /**
   * 간단한 승인 요청 (Low 위험도용)
   */
  static async promptSimple(
    request: ApprovalRequest,
    timeoutSeconds = 30
  ): Promise<ApprovalUIResult> {
    console.log();

    const message = `${RISK_ICONS[request.riskLevel]} ${pc.cyan(request.tool)} 도구를 실행하시겠습니까?`;

    const timeoutPromise = new Promise<ApprovalUIResult>((resolve) => {
      setTimeout(() => {
        resolve({ approved: false, timedOut: true });
      }, timeoutSeconds * 1000);
    });

    const promptPromise = p
      .confirm({
        message,
        initialValue: true,
      })
      .then((result) => {
        if (p.isCancel(result)) {
          return { approved: false, timedOut: false };
        }
        return { approved: result, timedOut: false };
      });

    return Promise.race([promptPromise, timeoutPromise]);
  }

  /**
   * 일괄 승인 UI
   */
  static async promptBatch(
    requests: ApprovalRequest[],
    timeoutSeconds = 60
  ): Promise<Map<string, ApprovalUIResult>> {
    console.log();
    p.intro(`📋 ${requests.length}개의 승인 요청`);

    const results = new Map<string, ApprovalUIResult>();

    for (const request of requests) {
      // 이미 처리된 요청은 건너뛰기
      if (results.has(request.requestId)) {
        continue;
      }

      const result = await this.prompt(request, { timeout: timeoutSeconds });
      results.set(request.requestId, result);

      // 사용자가 취소한 경우
      if (!result.approved && !result.timedOut) {
        const continueBatch = await p.confirm({
          message: '나머지 요청도 처리하시겠습니까?',
          initialValue: false,
        });

        if (!continueBatch || p.isCancel(continueBatch)) {
          // 나머지 모두 거부 처리
          for (const remaining of requests) {
            if (!results.has(remaining.requestId)) {
              results.set(remaining.requestId, {
                approved: false,
                reason: '일괄 처리 중단',
                timedOut: false,
              });
            }
          }
          break;
        }
      }
    }

    // 결과 요약
    const approved = Array.from(results.values()).filter((r) => r.approved).length;
    const rejected = results.size - approved;

    p.outro(
      `처리 완료: ${pc.green(`${approved}개 승인`)}, ${pc.red(`${rejected}개 거부`)}`
    );

    return results;
  }

  /**
   * 승인 상태 표시
   */
  static renderStatus(request: ApprovalRequest): void {
    const color = RISK_COLORS[request.riskLevel];
    const statusIcon = {
      pending: '⏳',
      approved: '✅',
      rejected: '❌',
      expired: '⏱️',
      cancelled: '🚫',
    }[request.status];

    console.log(
      `${statusIcon} ${pc.cyan(request.tool)} ${pc.dim(`(${request.requestId.slice(0, 8)})`)} - ` +
      color(`${RISK_ICONS[request.riskLevel]} ${request.riskLevel}`)
    );
  }

  /**
   * 승인 목록 표시
   */
  static renderList(requests: ApprovalRequest[]): void {
    console.log();
    p.intro('📋 승인 요청 목록');

    if (requests.length === 0) {
      p.log.info('표시할 요청이 없습니다.');
      return;
    }

    for (const request of requests) {
      this.renderStatus(request);
    }

    console.log();
  }
}
