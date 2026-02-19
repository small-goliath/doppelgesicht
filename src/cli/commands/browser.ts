/**
 * Browser CLI 명령어
 * @description 브라우저 자동화 CLI 구현
 */

import { Command } from 'commander';
import * as p from '@clack/prompts';
import { pc } from '../../utils/colors.js';
import { createLogger } from '../../logging/index.js';
import { createBrowserSandbox } from '../../tools/browser/sandbox.js';
import type { SandboxExecuteResult } from '../../tools/browser/types.js';
import { readFileSync, existsSync } from 'fs';

/**
 * Browser 명령어 등록
 */
export function registerBrowserCommand(program: Command): void {
  program
    .command('browser')
    .description('브라우저 자동화 및 코드 검증을 실행합니다')
    .argument('[input]', 'URL 또는 JavaScript 파일 경로')
    .option('-u, --url <url>', '실행할 URL')
    .option('-c, --code <code>', '실행할 JavaScript 코드')
    .option('-f, --file <file>', '실행할 JavaScript 파일')
    .option('--no-vm', 'isolated-vm 실행 건너뛰기')
    .option('--no-playwright', 'Playwright 실행 건너뛰기')
    .option('--screenshot', '스크린샷 캡처')
    .option('--headless', '헤드리스 모드로 실행', true)
    .option('--no-headless', 'GUI 모드로 실행')
    .action(async (input, options) => {
      const browser = new BrowserCLI(input, options);
      await browser.run();
    });
}

/**
 * Browser CLI 클래스
 */
class BrowserCLI {
  private input?: string;
  private options: {
    url?: string;
    code?: string;
    file?: string;
    vm: boolean;
    playwright: boolean;
    screenshot: boolean;
    headless: boolean;
  };
  private logger = createLogger({ level: 'info', console: true, json: false });

  constructor(
    input: string | undefined,
    options: {
      url?: string;
      code?: string;
      file?: string;
      vm: boolean;
      playwright: boolean;
      screenshot: boolean;
      headless: boolean;
    }
  ) {
    this.input = input;
    this.options = options;
  }

  /**
   * Browser CLI 실행
   */
  async run(): Promise<void> {
    console.clear();
    p.intro(pc.cyan('🌐 Doppelgesicht Browser'));

    try {
      // 1. 실행할 코드/URL 결정
      const code = await this.resolveInput();
      if (!code) {
        p.outro(pc.red('실행할 코드 또는 URL을 제공하세요.'));
        process.exit(1);
      }

      // 2. 코드인지 URL인지 판단
      const isUrl = this.isValidUrl(code);
      
      if (isUrl) {
        p.log.info(pc.cyan(`URL 실행: ${code}`));
      } else {
        p.log.info(pc.cyan(`JavaScript 코드 실행 (${code.length} 문자)`));
      }

      // 3. Browser 샌드박스 초기화
      const spinner = p.spinner();
      spinner.start('Browser 샌드박스를 초기화하는 중...');
      
      const sandbox = createBrowserSandbox(this.logger);
      spinner.stop('Browser 샌드박스가 준비되었습니다.');

      // 4. 2계층 검증 실행
      let result: SandboxExecuteResult;

      if (isUrl) {
        // URL 실행
        result = await this.executeUrl(sandbox, code);
      } else {
        // JavaScript 코드 실행
        result = await this.executeCode(sandbox, code);
      }

      // 5. 결과 출력
      this.displayResult(result);

      // 6. 리소스 정리
      await sandbox.dispose();

      // 성공 여부에 따라 종료 코드 설정
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      this.logger.error('Browser CLI failed', error as Error);
      p.outro(pc.red('실행 중 오류가 발생했습니다.'));
      process.exit(1);
    }
  }

  /**
   * 입력값을 해석하여 코드/URL 반환
   */
  private async resolveInput(): Promise<string | null> {
    // 옵션 우선순위: code > file > url > input
    if (this.options.code) {
      return this.options.code;
    }

    if (this.options.file) {
      if (!existsSync(this.options.file)) {
        p.log.error(`파일을 찾을 수 없습니다: ${this.options.file}`);
        return null;
      }
      return readFileSync(this.options.file, 'utf-8');
    }

    if (this.options.url) {
      return this.options.url;
    }

    if (this.input) {
      // 입력이 파일 경로인지 확인
      if (existsSync(this.input)) {
        return readFileSync(this.input, 'utf-8');
      }
      return this.input;
    }

    // 인터랙티브 모드
    const input = await p.text({
      message: 'URL 또는 JavaScript 코드를 입력하세요:',
      placeholder: 'https://example.com 또는 console.log("hello")',
    });

    if (p.isCancel(input)) {
      return null;
    }

    return input;
  }

  /**
   * URL인지 확인
   */
  private isValidUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * JavaScript 코드 실행
   */
  private async executeCode(
    sandbox: import('../../tools/browser/sandbox.js').BrowserSandbox,
    code: string
  ): Promise<SandboxExecuteResult> {
    const spinner = p.spinner();
    spinner.start('2계층 검증을 실행하는 중...');

    const result = await sandbox.execute({
      code,
      captureScreenshot: this.options.screenshot,
      vmConfig: this.options.vm ? undefined : { timeoutMs: 0 },
      playwrightConfig: {
        headless: this.options.headless,
        browserType: 'chromium',
      },
    });

    spinner.stop('검증이 완료되었습니다.');
    return result;
  }

  /**
   * URL 실행
   */
  private async executeUrl(
    sandbox: import('../../tools/browser/sandbox.js').BrowserSandbox,
    url: string
  ): Promise<SandboxExecuteResult> {
    const spinner = p.spinner();
    spinner.start(`URL 접근 중: ${url}...`);

    // URL은 정적 분석 + Playwright로 실행
    const code = `
      // URL 접근 스크립트
      window.location.href = '${url}';
    `;

    const result = await sandbox.execute({
      code,
      captureScreenshot: this.options.screenshot,
      vmConfig: { timeoutMs: 0 }, // URL은 VM 실행 건너뛰기
      playwrightConfig: {
        headless: this.options.headless,
        browserType: 'chromium',
      },
    });

    spinner.stop('URL 접근이 완료되었습니다.');
    return result;
  }

  /**
   * 결과 출력
   */
  private displayResult(result: SandboxExecuteResult): void {
    console.log();
    p.log.step('실행 결과');

    // Layer 1: 정적 분석
    const staticAnalysis = result.layer1.staticAnalysis;
    console.log();
    console.log(pc.cyan('━━━ Layer 1: 정적 분석 ━━━'));
    
    if (staticAnalysis.passed) {
      p.log.success(`정적 분석 통과 (${staticAnalysis.duration}ms)`);
    } else {
      p.log.error(`정적 분석 실패 (${staticAnalysis.duration}ms)`);
    }

    if (staticAnalysis.violations.length > 0) {
      console.log(pc.yellow('\n발견된 위반사항:'));
      for (const violation of staticAnalysis.violations) {
        const severityColor = {
          critical: pc.red,
          high: pc.red,
          medium: pc.yellow,
          low: pc.gray,
        }[violation.severity];

        console.log(`  ${severityColor(`[${violation.severity.toUpperCase()}]`)} ${violation.ruleName}`);
        console.log(`    ${pc.dim(violation.description)}`);
        if (violation.line) {
          console.log(`    ${pc.dim(`줄 ${violation.line}: ${violation.match}`)}`);
        }
      }
    }

    // Layer 1: VM 실행
    if (result.layer1.vmExecution) {
      console.log();
      console.log(pc.cyan('━━━ Layer 1: isolated-vm 실행 ━━━'));
      const vmResult = result.layer1.vmExecution;

      if (vmResult.success) {
        p.log.success(`VM 실행 성공 (${vmResult.duration}ms)`);
        if (vmResult.result !== undefined) {
          console.log(`  결과: ${pc.dim(JSON.stringify(vmResult.result))}`);
        }
      } else {
        p.log.error(`VM 실행 실패 (${vmResult.duration}ms)`);
        if (vmResult.error) {
          console.log(`  에러: ${pc.red(vmResult.error)}`);
        }
      }

      if (vmResult.logs.length > 0) {
        console.log(pc.dim('\n  콘솔 로그:'));
        for (const log of vmResult.logs) {
          console.log(`    ${pc.dim('>')} ${log}`);
        }
      }
    }

    // Layer 2: Playwright
    if (result.layer2?.playwrightExecution) {
      console.log();
      console.log(pc.cyan('━━━ Layer 2: Playwright 실행 ━━━'));
      const pwResult = result.layer2.playwrightExecution;

      if (pwResult.success) {
        p.log.success(`Playwright 실행 성공 (${pwResult.duration}ms)`);
        if (pwResult.url) {
          console.log(`  URL: ${pc.dim(pwResult.url)}`);
        }
        if (pwResult.title) {
          console.log(`  제목: ${pc.dim(pwResult.title)}`);
        }
      } else {
        p.log.error(`Playwright 실행 실패 (${pwResult.duration}ms)`);
        if (pwResult.error) {
          console.log(`  에러: ${pc.red(pwResult.error)}`);
        }
      }

      if (pwResult.consoleLogs.length > 0) {
        console.log(pc.dim('\n  브라우저 콘솔:'));
        for (const log of pwResult.consoleLogs.slice(0, 10)) {
          const typeColor = {
            error: pc.red,
            warn: pc.yellow,
            info: pc.cyan,
            log: pc.gray,
            debug: pc.gray,
          }[log.type];

          console.log(`    ${typeColor(`[${log.type.toUpperCase()}]`)} ${log.message}`);
        }
        if (pwResult.consoleLogs.length > 10) {
          console.log(pc.dim(`    ... 외 ${pwResult.consoleLogs.length - 10}개 로그`));
        }
      }

      if (pwResult.screenshot) {
        console.log();
        p.log.success('스크린샷이 캡처되었습니다.');
        // Base64 이미지를 파일로 저장하거나 표시할 수 있음
      }
    }

    // 요약
    console.log();
    console.log(pc.cyan('━━━ 요약 ━━━'));
    if (result.success) {
      p.log.success(pc.green('전체 실행 성공 ✓'));
    } else {
      p.log.error(pc.red('전체 실행 실패 ✗'));
      if (result.error) {
        console.log(`  에러: ${pc.red(result.error)}`);
      }
    }
    console.log(`  총 소요 시간: ${result.totalDuration}ms`);
  }
}