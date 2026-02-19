/**
 * Playwright 실행기
 * @description 브라우저 컨텍스트에서 검증된 코드 실행
 */

import { chromium, firefox, webkit, type Browser, type Page, type BrowserContext } from 'playwright-core';
import type {
  PlaywrightConfig,
  PlaywrightResult,
  BrowserConsoleLog,
} from './types.js';
import { DEFAULT_PLAYWRIGHT_CONFIG } from './types.js';
import type { Logger } from '../../logging/index.js';

/**
 * Playwright 실행기
 */
export class PlaywrightRunner {
  private config: PlaywrightConfig;
  private logger: Logger;
  private browser?: Browser;
  private context?: BrowserContext;

  constructor(logger: Logger, config?: Partial<PlaywrightConfig>) {
    this.logger = logger.child('PlaywrightRunner');
    this.config = { ...DEFAULT_PLAYWRIGHT_CONFIG, ...config };
  }

  /**
   * 브라우저 초기화
   */
  async initialize(): Promise<void> {
    if (this.browser) return;

    this.logger.debug('Initializing browser', { browserType: this.config.browserType });

    const launchOptions = {
      headless: this.config.headless,
    };

    switch (this.config.browserType) {
      case 'firefox':
        this.browser = await firefox.launch(launchOptions);
        break;
      case 'webkit':
        this.browser = await webkit.launch(launchOptions);
        break;
      case 'chromium':
      default:
        this.browser = await chromium.launch(launchOptions);
        break;
    }

    // 컨텍스트 생성
    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      extraHTTPHeaders: this.config.extraHTTPHeaders,
      javaScriptEnabled: this.config.javaScriptEnabled,
    });

    this.logger.debug('Browser initialized');
  }

  /**
   * 코드 실행
   */
  async execute(code: string, url?: string): Promise<PlaywrightResult> {
    const startTime = Date.now();
    const consoleLogs: BrowserConsoleLog[] = [];

    this.logger.debug('Starting Playwright execution', {
      codeLength: code.length,
      url,
    });

    if (!this.context) {
      await this.initialize();
    }

    if (!this.context) {
      throw new Error('Failed to initialize browser context');
    }

    let page: Page | undefined;

    try {
      // 페이지 생성
      page = await this.context.newPage();

      // 콘솔 로그 수집
      page.on('console', (msg) => {
        const log: BrowserConsoleLog = {
          type: msg.type() as BrowserConsoleLog['type'],
          message: msg.text(),
          timestamp: new Date(),
        };
        consoleLogs.push(log);
        this.logger.debug('Browser console', { type: log.type, message: log.message });
      });

      // 페이지 에러 수집
      page.on('pageerror', (error) => {
        const log: BrowserConsoleLog = {
          type: 'error',
          message: error.message,
          timestamp: new Date(),
        };
        consoleLogs.push(log);
        this.logger.error('Browser page error', error);
      });

      // URL로 이동 또는 빈 페이지 사용
      if (url) {
        await page.goto(url, { waitUntil: 'networkidle' });
      } else {
        await page.goto('about:blank');
      }

      // 코드 실행
      const result = await page.evaluate((codeToExecute) => {
        try {
          // Function 생성자를 사용하여 코드 실행 (eval 대신)
          const fn = new Function(codeToExecute);
          return { success: true, result: fn() };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }, code);

      // 페이지 정보 수집
      const pageUrl = page.url();
      const title = await page.title();

      // 스크린샷 캡처 (옵션)
      let screenshot: string | undefined;
      if (!this.config.headless) {
        const screenshotBuffer = await page.screenshot({ encoding: 'base64' });
        screenshot = screenshotBuffer;
      }

      const duration = Date.now() - startTime;

      this.logger.debug('Playwright execution completed', {
        duration,
        url: pageUrl,
        consoleLogsCount: consoleLogs.length,
      });

      return {
        success: result.success,
        url: pageUrl,
        title,
        consoleLogs,
        error: result.success ? undefined : result.error,
        screenshot,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Playwright execution failed', error as Error);

      return {
        success: false,
        consoleLogs,
        error: (error as Error).message,
        duration,
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * 스크린샷 캡처
   */
  async captureScreenshot(url: string, options?: { fullPage?: boolean; selector?: string }): Promise<string> {
    if (!this.context) {
      await this.initialize();
    }

    if (!this.context) {
      throw new Error('Failed to initialize browser context');
    }

    const page = await this.context.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle' });

      let screenshot: Buffer;

      if (options?.selector) {
        const element = await page.locator(options.selector).first();
        screenshot = await element.screenshot();
      } else {
        screenshot = await page.screenshot({
          fullPage: options?.fullPage,
        });
      }

      return screenshot.toString('base64');
    } finally {
      await page.close();
    }
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      this.context = undefined;
      this.logger.debug('Browser closed');
    }
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<PlaywrightConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Playwright config updated', { config: this.config });
  }
}

/**
 * Playwright 실행기 인스턴스 생성
 */
export function createPlaywrightRunner(
  logger: Logger,
  config?: Partial<PlaywrightConfig>
): PlaywrightRunner {
  return new PlaywrightRunner(logger, config);
}
