/**
 * Browser 샌드박스
 * @description 2계층 검증: Layer 1 (정적 분석 + isolated-vm), Layer 2 (Playwright CDP)
 */

import { StaticAnalyzer } from './static-analyzer.js';
import { VMRunner } from './vm-runner.js';
import { PlaywrightRunner } from './playwright-runner.js';
import type {
  IBrowserSandbox,
  SandboxExecuteOptions,
  SandboxExecuteResult,
  StaticAnalysisResult,
  IsolatedVMResult,
  PlaywrightResult,
  IsolatedVMConfig,
  PlaywrightConfig,
  StaticAnalysisRule,
} from './types.js';
import type { Logger } from '../../logging/index.js';

/**
 * Browser 샌드박스 구현
 */
export class BrowserSandbox implements IBrowserSandbox {
  private staticAnalyzer: StaticAnalyzer;
  private vmRunner: VMRunner;
  private playwrightRunner: PlaywrightRunner;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child('BrowserSandbox');
    this.staticAnalyzer = new StaticAnalyzer(this.logger);
    this.vmRunner = new VMRunner(this.logger);
    this.playwrightRunner = new PlaywrightRunner(this.logger);

    this.logger.debug('Browser sandbox initialized');
  }

  /**
   * 코드 실행 (2계층 검증)
   */
  async execute(options: SandboxExecuteOptions): Promise<SandboxExecuteResult> {
    const startTime = Date.now();

    this.logger.info('Starting sandbox execution', {
      codeLength: options.code.length,
      captureScreenshot: options.captureScreenshot,
    });

    try {
      // ========== Layer 1: 정적 분석 ==========
      const staticResult = await this.analyze(
        options.code,
        options.staticRules
      );

      // Critical 위반 시 즉시 종료
      const criticalViolations = staticResult.violations.filter(
        (v) => v.severity === 'critical'
      );

      if (criticalViolations.length > 0) {
        const duration = Date.now() - startTime;

        this.logger.error('Critical violations detected, aborting', {
          violations: criticalViolations.map((v) => v.ruleId),
        });

        return {
          success: false,
          layer1: {
            staticAnalysis: staticResult,
          },
          totalDuration: duration,
          error: `Critical violations detected: ${criticalViolations
            .map((v) => v.ruleName)
            .join(', ')}`,
        };
      }

      // ========== Layer 1: isolated-vm 실행 ==========
      const vmResult = await this.executeInVM(
        options.code,
        options.vmConfig
      );

      if (!vmResult.success) {
        const duration = Date.now() - startTime;

        this.logger.error('VM execution failed', {
          error: vmResult.error,
        });

        return {
          success: false,
          layer1: {
            staticAnalysis: staticResult,
            vmExecution: vmResult,
          },
          totalDuration: duration,
          error: `VM execution failed: ${vmResult.error}`,
        };
      }

      // ========== Layer 2: Playwright 실행 ==========
      const playwrightResult = await this.executeInBrowser(
        options.code,
        options.playwrightConfig
      );

      const totalDuration = Date.now() - startTime;

      this.logger.info('Sandbox execution completed', {
        totalDuration,
        vmSuccess: vmResult.success,
        playwrightSuccess: playwrightResult.success,
      });

      return {
        success: playwrightResult.success,
        layer1: {
          staticAnalysis: staticResult,
          vmExecution: vmResult,
        },
        layer2: {
          playwrightExecution: playwrightResult,
        },
        totalDuration,
        error: playwrightResult.success ? undefined : playwrightResult.error,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Sandbox execution failed', error as Error);

      return {
        success: false,
        layer1: {
          staticAnalysis: {
            passed: false,
            violations: [],
            duration: 0,
          },
        },
        totalDuration: duration,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 정적 분석만 수행
   */
  async analyze(
    code: string,
    rules?: StaticAnalysisRule[]
  ): Promise<StaticAnalysisResult> {
    if (rules) {
      this.staticAnalyzer = new StaticAnalyzer(this.logger, rules);
    }

    return this.staticAnalyzer.analyze(code);
  }

  /**
   * isolated-vm에서만 실행
   */
  async executeInVM(
    code: string,
    config?: Partial<IsolatedVMConfig>
  ): Promise<IsolatedVMResult> {
    if (config) {
      this.vmRunner.updateConfig(config);
    }

    return this.vmRunner.execute(code);
  }

  /**
   * Playwright에서만 실행
   */
  async executeInBrowser(
    code: string,
    config?: Partial<PlaywrightConfig>
  ): Promise<PlaywrightResult> {
    if (config) {
      this.playwrightRunner.updateConfig(config);
    }

    return this.playwrightRunner.execute(code);
  }

  /**
   * 스크린샷 캡처
   */
  async captureScreenshot(
    url: string,
    options?: { fullPage?: boolean; selector?: string }
  ): Promise<string> {
    return this.playwrightRunner.captureScreenshot(url, options);
  }

  /**
   * 리소스 정리
   */
  async dispose(): Promise<void> {
    await this.playwrightRunner.close();
    this.logger.debug('Sandbox disposed');
  }
}

/**
 * 샌드박스 인스턴스 생성
 */
export function createBrowserSandbox(logger: Logger): BrowserSandbox {
  return new BrowserSandbox(logger);
}
