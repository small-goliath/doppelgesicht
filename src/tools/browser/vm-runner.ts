/**
 * isolated-vm 실행기
 * @description 30초 타임아웃, 256MB 메모리 제한의 샌드박스 환경
 */

import ivm from 'isolated-vm';
import type { IsolatedVMConfig, IsolatedVMResult } from './types.js';
import { DEFAULT_VM_CONFIG } from './types.js';
import type { Logger } from '../../logging/index.js';

/**
 * VM 실행기
 */
export class VMRunner {
  private config: IsolatedVMConfig;
  private logger: Logger;

  constructor(logger: Logger, config?: Partial<IsolatedVMConfig>) {
    this.logger = logger.child('VMRunner');
    this.config = { ...DEFAULT_VM_CONFIG, ...config };
  }

  /**
   * 코드 실행
   */
  async execute(code: string): Promise<IsolatedVMResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    this.logger.debug('Starting VM execution', {
      codeLength: code.length,
      memoryLimit: this.config.memoryLimitMB,
      timeout: this.config.timeoutMs,
    });

    // Isolate 생성
    const isolate = new ivm.Isolate({
      memoryLimit: this.config.memoryLimitMB,
    });

    try {
      // 컨텍스트 생성
      const context = await isolate.createContext();

      // console 객체 설정
      if (this.config.allowConsole) {
        const logCallback = new ivm.Reference((...args: unknown[]) => {
          const logMessage = args.map((a) => String(a)).join(' ');
          logs.push(logMessage);
          this.logger.debug('VM log', { message: logMessage });
        });

        await context.global.set('console', {
          log: logCallback,
          error: logCallback,
          warn: logCallback,
          info: logCallback,
        });
      }

      // 글로벌 객체 제한
      await context.global.set('global', undefined);
      await context.global.set('process', undefined);
      await context.global.set('require', undefined);
      await context.global.set('module', undefined);
      await context.global.set('exports', undefined);
      await context.global.set('__dirname', undefined);
      await context.global.set('__filename', undefined);

      // setTimeout, setInterval 허용 (제한된)
      const timeoutRefs: ivm.Reference<ReturnType<typeof setTimeout>>[] = [];

      await context.global.set(
        'setTimeout',
        new ivm.Reference((fn: () => void, ms: number) => {
          const ref = setTimeout(fn, Math.min(ms, 5000)); // 최대 5초
          timeoutRefs.push(new ivm.Reference(ref));
          return ref;
        })
      );

      await context.global.set(
        'setInterval',
        new ivm.Reference((fn: () => void, ms: number) => {
          const ref = setInterval(fn, Math.min(ms, 5000)); // 최대 5초
          timeoutRefs.push(new ivm.Reference(ref));
          return ref;
        })
      );

      // 코드 컴파일
      const script = await isolate.compileScript(code, {
        filename: 'sandbox.js',
      });

      // 타임아웃과 함께 실행
      const result = await script.run(context, {
        timeout: this.config.timeoutMs,
        release: true,
      });

      // 결과 변환
      let resultValue: unknown;
      if (result instanceof ivm.Reference) {
        resultValue = await result.copy();
        result.release();
      } else if (result instanceof ivm.ExternalCopy) {
        resultValue = result.copy();
      } else {
        resultValue = result;
      }

      // 타임아웃 정리
      for (const ref of timeoutRefs) {
        try {
          const timeout = ref.deref();
          clearTimeout(timeout);
          clearInterval(timeout);
        } catch {
          // 무시
        }
        ref.release();
      }

      const duration = Date.now() - startTime;

      this.logger.debug('VM execution completed', {
        duration,
        logsCount: logs.length,
      });

      return {
        success: true,
        result: resultValue,
        logs,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message;

      this.logger.error('VM execution failed', error as Error);

      return {
        success: false,
        logs,
        error: errorMessage,
        duration,
      };
    } finally {
      // Isolate 정리
      isolate.dispose();
    }
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<IsolatedVMConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('VM config updated', { config: this.config });
  }
}

/**
 * VM 실행기 인스턴스 생성
 */
export function createVMRunner(logger: Logger, config?: Partial<IsolatedVMConfig>): VMRunner {
  return new VMRunner(logger, config);
}
