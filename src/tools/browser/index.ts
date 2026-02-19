/**
 * Browser 샌드박스 모듈
 * @description 2계층 검증: Layer 1 (정적 분석 + isolated-vm), Layer 2 (Playwright CDP)
 */

export type {
  IBrowserSandbox,
  SandboxExecuteOptions,
  SandboxExecuteResult,
  StaticAnalysisRule,
  StaticAnalysisResult,
  StaticAnalysisViolation,
  IsolatedVMConfig,
  IsolatedVMResult,
  PlaywrightConfig,
  PlaywrightResult,
  BrowserConsoleLog,
} from './types.js';

export {
  DEFAULT_STATIC_RULES,
  DEFAULT_VM_CONFIG,
  DEFAULT_PLAYWRIGHT_CONFIG,
} from './types.js';

export { StaticAnalyzer, createStaticAnalyzer } from './static-analyzer.js';
export { VMRunner, createVMRunner } from './vm-runner.js';
export { PlaywrightRunner, createPlaywrightRunner } from './playwright-runner.js';
export { BrowserSandbox, createBrowserSandbox } from './sandbox.js';
