/**
 * Bash 도구 타입 정의
 * @description 명령어 실행, 출력 캡처, 타임아웃 관리
 */

/**
 * Bash 실행 옵션
 */
export interface BashExecuteOptions {
  /** 작업 디렉토리 */
  cwd?: string;
  /** 환경변수 */
  env?: Record<string, string>;
  /** 타임아웃 (ms) */
  timeout?: number;
  /** 최대 출력 크기 (bytes) */
  maxOutputSize?: number;
  /** stdin 입력 */
  input?: string;
  /** 셸 지정 */
  shell?: string;
}

/**
 * Bash 실행 결과
 */
export interface BashExecuteResult {
  /** 명령어 */
  command: string;
  /** 종료 코드 */
  exitCode: number;
  /** stdout 출력 */
  stdout: string;
  /** stderr 출력 */
  stderr: string;
  /** 실행 시간 (ms) */
  duration: number;
  /** 타임아웃 여부 */
  timedOut: boolean;
  /** 종료 시간 */
  finishedAt: Date;
}

/**
 * Bash 도구 설정
 */
export interface BashToolConfig {
  /** 기본 타임아웃 (ms) */
  defaultTimeout: number;
  /** 기본 작업 디렉토리 */
  defaultCwd?: string;
  /** 기본 환경변수 */
  defaultEnv?: Record<string, string>;
  /** 최대 출력 크기 (bytes) */
  maxOutputSize: number;
  /** 허용된 명령어 패턴 (화이트리스트) */
  allowedCommands?: string[];
  /** 금지된 명령어 패턴 (블랙리스트) */
  blockedCommands?: string[];
  /** 위험한 명령어 승인 필요 여부 */
  requireApprovalForDangerous: boolean;
}

/**
 * 실행 중인 프로세스 정보
 */
export interface RunningProcess {
  /** 프로세스 ID */
  pid: number;
  /** 시작 시간 */
  startTime: Date;
  /** 명령어 */
  command: string;
  /** 중지 함수 */
  kill(signal?: NodeJS.Signals): Promise<void>;
}

/**
 * Bash 도구 인터페이스
 */
export interface IBashTool {
  /** 설정 */
  readonly config: BashToolConfig;

  /**
   * 명령어 실행
   */
  execute(command: string, options?: BashExecuteOptions): Promise<BashExecuteResult>;

  /**
   * 명령어 검증
   */
  validate(command: string): { valid: boolean; reason?: string };

  /**
   * 실행 중인 프로세스 목록
   */
  getRunningProcesses(): RunningProcess[];

  /**
   * 프로세스 중지
   */
  killProcess(pid: number, signal?: NodeJS.Signals): Promise<boolean>;
}
