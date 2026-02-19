import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserSandbox } from '../../../src/tools/browser/sandbox.js';
import type { Logger } from '../../../src/logging/types.js';

// 의존성 모킹
vi.mock('../../../src/tools/browser/static-analyzer.js', () => ({
  StaticAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue({
      passed: true,
      violations: [],
      duration: 10,
    }),
  })),
}));

vi.mock('../../../src/tools/browser/vm-runner.js', () => ({
  VMRunner: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      result: 'VM result',
      duration: 50,
    }),
    updateConfig: vi.fn(),
  })),
}));

vi.mock('../../../src/tools/browser/playwright-runner.js', () => ({
  PlaywrightRunner: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      result: 'Playwright result',
      duration: 100,
    }),
    captureScreenshot: vi.fn().mockResolvedValue('screenshot-base64'),
    updateConfig: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('BrowserSandbox', () => {
  let sandbox: BrowserSandbox;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
      setLevel: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Logger;

    sandbox = new BrowserSandbox(mockLogger);
  });

  describe('execute', () => {
    it('코드를 성공적으로 실행해야 함', async () => {
      const result = await sandbox.execute({
        code: 'console.log("Hello")',
      });

      expect(result.success).toBe(true);
      expect(result.layer1).toBeDefined();
      expect(result.layer2).toBeDefined();
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('스크린샷 캡처 옵션을 처리해야 함', async () => {
      const result = await sandbox.execute({
        code: 'document.body.innerHTML = "Test"',
        captureScreenshot: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('analyze', () => {
    it('정적 분석을 수행해야 함', async () => {
      const result = await sandbox.analyze('const x = 1;');

      expect(result.passed).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeInVM', () => {
    it('isolated-vm에서 코드를 실행해야 함', async () => {
      const result = await sandbox.executeInVM('1 + 1');

      expect(result.success).toBe(true);
      expect(result.result).toBe('VM result');
    });
  });

  describe('executeInBrowser', () => {
    it('Playwright에서 코드를 실행해야 함', async () => {
      const result = await sandbox.executeInBrowser('console.log("test")');

      expect(result.success).toBe(true);
      expect(result.result).toBe('Playwright result');
    });
  });

  describe('captureScreenshot', () => {
    it('스크린샷을 캡처해야 함', async () => {
      const screenshot = await sandbox.captureScreenshot('https://example.com');

      expect(screenshot).toBe('screenshot-base64');
    });

    it('전체 페이지 스크린샷을 캡처해야 함', async () => {
      const screenshot = await sandbox.captureScreenshot('https://example.com', {
        fullPage: true,
      });

      expect(screenshot).toBe('screenshot-base64');
    });
  });

  describe('dispose', () => {
    it('리소스를 정리해야 함', async () => {
      await sandbox.dispose();

      expect(mockLogger.debug).toHaveBeenCalledWith('Sandbox disposed');
    });
  });
});
