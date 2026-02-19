/**
 * Browser 샌드박스 타입 정의
 * @description 2계층 검증: Layer 1 (정적 분석 + isolated-vm), Layer 2 (Playwright CDP)
 */

/**
 * 정적 분석 규칙
 */
export interface StaticAnalysisRule {
  /** 규칙 ID */
  id: string;
  /** 규칙 이름 */
  name: string;
  /** 정규식 패턴 */
  pattern: RegExp;
  /** 심각도 */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** 설명 */
  description: string;
}

/**
 * 정적 분석 결과
 */
export interface StaticAnalysisResult {
  /** 검증 통과 여부 */
  passed: boolean;
  /** 발견된 위반사항 */
  violations: StaticAnalysisViolation[];
  /** 검증 소요 시간 (ms) */
  duration: number;
}

/**
 * 정적 분석 위반사항
 */
export interface StaticAnalysisViolation {
  /** 규칙 ID */
  ruleId: string;
  /** 규칙 이름 */
  ruleName: string;
  /** 심각도 */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** 위반 내용 */
  match: string;
  /** 줄 번호 */
  line?: number;
  /** 설명 */
  description: string;
}

/**
 * isolated-vm 설정
 */
export interface IsolatedVMConfig {
  /** 메모리 제한 (MB) */
  memoryLimitMB: number;
  /** 타임아웃 (ms) */
  timeoutMs: number;
  /** console.log 허용 여부 */
  allowConsole: boolean;
}

/**
 * isolated-vm 실행 결과
 */
export interface IsolatedVMResult {
  /** 실행 성공 여부 */
  success: boolean;
  /** 반환값 */
  result?: unknown;
  /** 로그 출력 */
  logs: string[];
  /** 에러 */
  error?: string;
  /** 실행 소요 시간 (ms) */
  duration: number;
  /** 메모리 사용량 (bytes) */
  memoryUsage?: number;
}

/**
 * Playwright 설정
 */
export interface PlaywrightConfig {
  /** 브라우저 타입 */
  browserType: 'chromium' | 'firefox' | 'webkit';
  /** 헤드리스 모드 */
  headless: boolean;
  /** 뷰포트 */
  viewport?: { width: number; height: number };
  /** User Agent */
  userAgent?: string;
  /** 추가 HTTP 헤더 */
  extraHTTPHeaders?: Record<string, string>;
  /** JavaScript 활성화 */
  javaScriptEnabled: boolean;
}

/**
 * Playwright 실행 결과
 */
export interface PlaywrightResult {
  /** 실행 성공 여부 */
  success: boolean;
  /** 페이지 URL */
  url?: string;
  /** 페이지 제목 */
  title?: string;
  /** 콘솔 로그 */
  consoleLogs: BrowserConsoleLog[];
  /** 에러 */
  error?: string;
  /** 스크린샷 (base64) */
  screenshot?: string;
  /** 실행 소요 시간 (ms) */
  duration: number;
}

/**
 * 브라우저 콘솔 로그
 */
export interface BrowserConsoleLog {
  /** 로그 타입 */
  type: 'log' | 'error' | 'warn' | 'info' | 'debug';
  /** 메시지 */
  message: string;
  /** 시간 */
  timestamp: Date;
}

/**
 * 샌드박스 실행 옵션
 */
export interface SandboxExecuteOptions {
  /** 실행할 JavaScript 코드 */
  code: string;
  /** 정적 분석 규칙 */
  staticRules?: StaticAnalysisRule[];
  /** isolated-vm 설정 */
  vmConfig?: Partial<IsolatedVMConfig>;
  /** Playwright 설정 */
  playwrightConfig?: Partial<PlaywrightConfig>;
  /** 스크린샷 캡처 여부 */
  captureScreenshot: boolean;
  /** URL (Playwright 실행 시) */
  url?: string;
}

/**
 * 샌드박스 실행 결과
 */
export interface SandboxExecuteResult {
  /** 전체 성공 여부 */
  success: boolean;
  /** Layer 1 결과 */
  layer1: {
    staticAnalysis: StaticAnalysisResult;
    vmExecution?: IsolatedVMResult;
  };
  /** Layer 2 결과 */
  layer2?: {
    playwrightExecution: PlaywrightResult;
  };
  /** 전체 소요 시간 (ms) */
  totalDuration: number;
  /** 에러 메시지 */
  error?: string;
}

/**
 * Browser 샌드박스 인터페이스
 */
export interface IBrowserSandbox {
  /**
   * 코드 실행 (2계층 검증)
   */
  execute(options: SandboxExecuteOptions): Promise<SandboxExecuteResult>;

  /**
   * 정적 분석만 수행
   */
  analyze(code: string, rules?: StaticAnalysisRule[]): Promise<StaticAnalysisResult>;

  /**
   * isolated-vm에서만 실행
   */
  executeInVM(code: string, config?: Partial<IsolatedVMConfig>): Promise<IsolatedVMResult>;

  /**
   * Playwright에서만 실행
   */
  executeInBrowser(code: string, config?: Partial<PlaywrightConfig>): Promise<PlaywrightResult>;
}

/**
 * 기본 정적 분석 규칙
 */
export const DEFAULT_STATIC_RULES: StaticAnalysisRule[] = [
  {
    id: 'eval-usage',
    name: 'eval() 사용',
    pattern: /\beval\s*\(/,
    severity: 'critical',
    description: 'eval() 함수는 임의의 코드 실행을 허용하여 보안 위험이 있습니다.',
  },
  {
    id: 'new-function',
    name: 'new Function() 사용',
    pattern: /new\s+Function\s*\(/,
    severity: 'critical',
    description: 'Function 생성자는 eval()과 유사한 보안 위험이 있습니다.',
  },
  {
    id: 'child-process',
    name: 'child_process 접근',
    pattern: /require\s*\(\s*['"]child_process['"]\s*\)/,
    severity: 'critical',
    description: 'child_process 모듈은 시스템 명령어 실행을 허용합니다.',
  },
  {
    id: 'fs-access',
    name: 'fs 모듈 접근',
    pattern: /require\s*\(\s*['"]fs['"]\s*\)/,
    severity: 'high',
    description: 'fs 모듈은 파일 시스템 접근을 허용합니다.',
  },
  {
    id: 'network-fetch',
    name: '네트워크 요청',
    pattern: /\bfetch\s*\(|\bXMLHttpRequest|\baxios|\brequest\s*\(/,
    severity: 'high',
    description: '네트워크 요청은 데이터 유출 위험이 있습니다.',
  },
  {
    id: 'env-access',
    name: '환경변수 접근',
    pattern: /process\.env/,
    severity: 'medium',
    description: '환경변수 접근은 민감한 정보 노출 위험이 있습니다.',
  },
];

/**
 * 기본 isolated-vm 설정
 */
export const DEFAULT_VM_CONFIG: IsolatedVMConfig = {
  memoryLimitMB: 256,
  timeoutMs: 30000,
  allowConsole: true,
};

/**
 * 기본 Playwright 설정
 */
export const DEFAULT_PLAYWRIGHT_CONFIG: PlaywrightConfig = {
  browserType: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 720 },
  javaScriptEnabled: true,
};
