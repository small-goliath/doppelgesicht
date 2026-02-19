import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalManager } from '../../../src/tools/approval/manager.js';
import type { Logger } from '../../../src/logging/types.js';

// Mock Logger
const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

describe('ApprovalManager', () => {
  let manager: ApprovalManager;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    manager = new ApprovalManager(mockLogger);
  });

  describe('createRequest', () => {
    it('승인 요청을 생성해야 함', () => {
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli');

      expect(request.requestId).toBeDefined();
      expect(request.tool).toBe('exec');
      expect(request.params).toEqual({ command: 'ls' });
      expect(request.status).toBe('pending');
      expect(request.mode).toBe('cli');
    });

    it('위험도를 올바르게 평가해야 함', () => {
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli');

      expect(request.riskLevel).toBe('Critical');
      expect(request.riskScore).toBeGreaterThan(0);
    });

    it('만료 시간을 설정해야 함', () => {
      const before = new Date();
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli');
      const after = new Date();

      expect(request.expiresAt.getTime()).toBeGreaterThan(before.getTime());
      expect(request.expiresAt.getTime()).toBeGreaterThan(request.timestamp.getTime());
    });

    it('컨텍스트를 포함할 수 있음', () => {
      const context = { sessionId: 'test-session', source: 'test' };
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli', context);

      expect(request.context).toEqual(context);
    });
  });

  describe('approve', () => {
    it('대기 중인 요청을 승인해야 함', () => {
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli');
      const result = manager.approve(request.requestId, 'test-user');

      expect(result.approved).toBe(true);
      expect(result.request?.status).toBe('approved');
      expect(result.request?.resolvedBy).toBe('test-user');
    });

    it('존재하지 않는 요청은 거부해야 함', () => {
      const result = manager.approve('non-existent-id');

      expect(result.approved).toBe(false);
      expect(result.message).toContain('찾을 수 없습니다');
    });

    it('이미 처리된 요청은 거부해야 함', () => {
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli');
      manager.approve(request.requestId);
      const result = manager.approve(request.requestId);

      expect(result.approved).toBe(false);
      expect(result.message).toContain('이미');
    });

    it('만료된 요청은 거부해야 함', () => {
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli');
      // 만료 시간을 과거로 설정
      request.expiresAt = new Date(Date.now() - 1000);

      const result = manager.approve(request.requestId);

      expect(result.approved).toBe(false);
      expect(result.message).toContain('만료');
    });
  });

  describe('reject', () => {
    it('대기 중인 요청을 거부해야 함', () => {
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli');
      const result = manager.reject(request.requestId, '테스트 거부', 'test-user');

      expect(result.approved).toBe(false);
      expect(result.request?.status).toBe('rejected');
      expect(result.request?.rejectionReason).toBe('테스트 거부');
      expect(result.request?.resolvedBy).toBe('test-user');
    });

    it('사유 없이 거부할 수 있음', () => {
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli');
      const result = manager.reject(request.requestId);

      expect(result.approved).toBe(false);
      expect(result.request?.status).toBe('rejected');
    });
  });

  describe('cancel', () => {
    it('대기 중인 요청을 취소해야 함', () => {
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli');
      const result = manager.cancel(request.requestId);

      expect(result.approved).toBe(false);
      expect(result.request?.status).toBe('cancelled');
    });
  });

  describe('getRequest', () => {
    it('요청을 조회해야 함', () => {
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli');
      const retrieved = manager.getRequest(request.requestId);

      expect(retrieved).toEqual(request);
    });

    it('존재하지 않는 요청은 undefined를 반환해야 함', () => {
      const retrieved = manager.getRequest('non-existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllRequests', () => {
    it('모든 요청을 반환해야 함', () => {
      manager.createRequest('exec', { command: 'ls' }, 'cli');
      manager.createRequest('file_read', { path: '/tmp/test' }, 'cli');

      const all = manager.getAllRequests();

      expect(all).toHaveLength(2);
    });
  });

  describe('getPendingRequests', () => {
    it('대기 중인 요청만 반환해야 함', () => {
      const req1 = manager.createRequest('exec', { command: 'ls' }, 'cli');
      const req2 = manager.createRequest('file_read', { path: '/tmp/test' }, 'cli');
      manager.approve(req1.requestId);

      const pending = manager.getPendingRequests();

      expect(pending).toHaveLength(1);
      expect(pending[0].requestId).toBe(req2.requestId);
    });
  });

  describe('canAutoApprove', () => {
    it('Critical 위험도는 자동 승인 불가 (blockCritical 설정 시)', () => {
      manager.updatePolicy({ blockCritical: true });
      const result = manager.canAutoApprove('exec', { command: 'ls' }, 'cli');

      expect(result.canApprove).toBe(false);
      expect(result.reason).toContain('Critical');
    });

    it('Daemon 모드에서 화이트리스트 확인', () => {
      manager.updatePolicy({ whitelistOnly: true });
      const result = manager.canAutoApprove('exec', { command: 'ls' }, 'daemon');

      expect(result.canApprove).toBe(false);
      expect(result.reason).toContain('화이트리스트');
    });

    it('화이트리스트에 있는 도구는 자동 승인 가능 (whitelistOnly 모드)', () => {
      // whitelistOnly 모드를 활성화하고 화이트리스트 규칙 추가
      manager.updatePolicy({ whitelistOnly: true });
      manager.addWhitelistRule({
        tool: 'info',
        maxRiskLevel: 'Low',
        description: '정보 조회 허용',
      });

      // 화이트리스트 확인
      expect(manager.checkWhitelist('info', {})).toBe(true);

      // 자동 승인 확인
      const result = manager.canAutoApprove('info', {}, 'daemon');
      expect(result.canApprove).toBe(true);
    });

    it('화이트리스트에 없는 도구는 자동 승인 불가 (whitelistOnly 모드)', () => {
      // whitelistOnly 모드를 활성화
      manager.updatePolicy({ whitelistOnly: true });

      const result = manager.canAutoApprove('exec', { command: 'ls' }, 'daemon');

      expect(result.canApprove).toBe(false);
      expect(result.reason).toContain('화이트리스트');
    });
  });

  describe('whitelist', () => {
    it('화이트리스트 규칙을 추가해야 함', () => {
      // whitelistOnly 모드를 비활성화
      manager.updatePolicy({ whitelistOnly: false });
      const initialLength = manager.getConfig().whitelist.length;

      const rule = manager.addWhitelistRule({
        tool: 'info',
        maxRiskLevel: 'Low',
        description: '정보 조회 허용',
      });

      expect(rule.id).toBeDefined();
      expect(rule.tool).toBe('info');
      expect(manager.getConfig().whitelist).toHaveLength(initialLength + 1);
    });

    it('화이트리스트 규칙을 제거해야 함', () => {
      // whitelistOnly 모드를 비활성화
      manager.updatePolicy({ whitelistOnly: false });
      const rule = manager.addWhitelistRule({
        tool: 'info',
        maxRiskLevel: 'Low',
        description: '정보 조회 허용',
      });

      const removed = manager.removeWhitelistRule(rule.id);

      expect(removed).toBe(true);
      expect(manager.getConfig().whitelist.some(r => r.id === rule.id)).toBe(false);
    });

    it('존재하지 않는 규칙 제거는 false를 반환해야 함', () => {
      const removed = manager.removeWhitelistRule('non-existent');

      expect(removed).toBe(false);
    });

    it('패턴이 일치하는 경우 화이트리스트 통과', () => {
      manager.addWhitelistRule({
        tool: 'file_read',
        maxRiskLevel: 'High',
        paramPattern: { path: '^/tmp/.*' },
        description: '/tmp 디렉토리 읽기 허용',
      });

      const result = manager.checkWhitelist('file_read', { path: '/tmp/test.txt' });

      expect(result).toBe(true);
    });

    it('패턴이 불일치하는 경우 화이트리스트 거부', () => {
      manager.addWhitelistRule({
        tool: 'file_read',
        maxRiskLevel: 'High',
        paramPattern: { path: '^/tmp/.*' },
        description: '/tmp 디렉토리 읽기 허용',
      });

      const result = manager.checkWhitelist('file_read', { path: '/etc/passwd' });

      expect(result).toBe(false);
    });
  });

  describe('cleanupExpired', () => {
    it('만료된 요청을 정리해야 함', () => {
      const request = manager.createRequest('exec', { command: 'ls' }, 'cli');
      request.expiresAt = new Date(Date.now() - 1000);

      const cleaned = manager.cleanupExpired();

      expect(cleaned).toBe(1);
      expect(manager.getRequest(request.requestId)?.status).toBe('expired');
    });
  });

  describe('events', () => {
    it('이벤트 리스너를 등록하고 호출해야 함', () => {
      const listener = vi.fn();
      manager.onEvent(listener);

      manager.createRequest('exec', { command: 'ls' }, 'cli');

      expect(listener).toHaveBeenCalledWith('request.created', expect.any(Object));
    });

    it('구독 해제 함수를 반환해야 함', () => {
      const listener = vi.fn();
      const unsubscribe = manager.onEvent(listener);

      unsubscribe();

      manager.createRequest('exec', { command: 'ls' }, 'cli');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('통계를 올바르게 계산해야 함', () => {
      const req1 = manager.createRequest('exec', { command: 'ls' }, 'cli');
      const req2 = manager.createRequest('file_read', { path: '/tmp/test' }, 'cli');
      const req3 = manager.createRequest('info', {}, 'cli');

      manager.approve(req1.requestId);
      manager.reject(req2.requestId);

      const stats = manager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
    });
  });
});
