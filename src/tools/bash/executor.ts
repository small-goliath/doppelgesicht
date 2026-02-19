/**
 * Bash 도구 실행기
 * @description 명령어 실행, 출력 캡처, 타임아웃 관리
 */

import { spawn, type ChildProcess } from 'child_process';
import type {
  BashExecuteOptions,
  BashExecuteResult,
  BashToolConfig,
  RunningProcess,
  IBashTool,
} from './types.js';
import type { ILogger } from '../../logging/index.js';

/**
 * 위험한 명령어 패턴
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  />\s*\/dev\/null.*\bfb\d/,
  /:\(\)\s*\{\s*:\|\:\s*\&\s*\}/, // Fork bomb
  /dd\s+if=.*of=\/dev\/(sda|hd|disk)/,
  /mkfs\.\w+\s+\/dev\/sda/,
  /\bwget\b.*\|.*\bsh\b/,
  /\bcurl\b.*\|.*\bsh\b/,
];

/**
 * Bash 도구 구현
 */
export class BashTool implements IBashTool {
  readonly config: BashToolConfig;

  private logger: ILogger;
  private runningProcesses = new Map<number, ChildProcess>();

  constructor(config: Partial<BashToolConfig>, logger: ILogger) {
    this.config = {
      defaultTimeout: 30000,
      maxOutputSize: 1024 * 1024, // 1MB
      requireApprovalForDangerous: true,
      ...config,
    };
    this.logger = logger.child('BashTool') as ILogger;
  }

  /**
   * 명령어 실행
   */
  async execute(command: string, options: BashExecuteOptions = {}): Promise<BashExecuteResult> {
    const startTime = Date.now();
    const timeout = options.timeout ?? this.config.defaultTimeout;
    const cwd = options.cwd ?? this.config.defaultCwd ?? process.cwd();
    const env = { ...process.env, ...this.config.defaultEnv, ...options.env };
    const shell = options.shell ?? '/bin/sh';

    this.logger.info('Executing command', { command, cwd, timeout });

    // 명령어 검증
    const validation = this.validate(command);
    if (!validation.valid) {
      throw new Error(`Command validation failed: ${validation.reason}`);
    }

    // 위험한 명령어 체크
    if (this.config.requireApprovalForDangerous && this.isDangerous(command)) {
      this.logger.warn('Dangerous command detected', { command });
      throw new Error('Dangerous command requires approval');
    }

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // 프로세스 생성
      const child = spawn(shell, ['-c', command], {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // 프로세스 등록
      this.runningProcesses.set(child.pid!, child);

      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        timedOut = true;
        this.logger.warn('Command timed out', { command, pid: child.pid });
        child.kill('SIGTERM');

        // SIGTERM 후에도 종료되지 않으면 SIGKILL
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      // stdout 처리
      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (stdout.length + chunk.length > this.config.maxOutputSize) {
          stdout += chunk.slice(0, this.config.maxOutputSize - stdout.length);
          stdout += '\n[Output truncated due to size limit]';
          child.stdout?.destroy();
        } else {
          stdout += chunk;
        }
      });

      // stderr 처리
      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (stderr.length + chunk.length > this.config.maxOutputSize) {
          stderr += chunk.slice(0, this.config.maxOutputSize - stderr.length);
          stderr += '\n[Error output truncated due to size limit]';
          child.stderr?.destroy();
        } else {
          stderr += chunk;
        }
      });

      // stdin 입력
      if (options.input) {
        child.stdin?.write(options.input);
        child.stdin?.end();
      }

      // 종료 처리
      child.on('close', (code, signal) => {
        clearTimeout(timeoutId);
        this.runningProcesses.delete(child.pid!);

        const duration = Date.now() - startTime;

        this.logger.info('Command completed', {
          command,
          exitCode: code,
          signal,
          duration,
          timedOut,
          stdoutLength: stdout.length,
          stderrLength: stderr.length,
        });

        resolve({
          command,
          exitCode: code ?? (signal ? 128 + 1 : 1), // signal 종료 시 exit code
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration,
          timedOut,
          finishedAt: new Date(),
        });
      });

      // 에러 처리
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        this.runningProcesses.delete(child.pid!);

        this.logger.error('Command execution error', error);
        reject(error);
      });
    });
  }

  /**
   * 명령어 검증
   */
  validate(command: string): { valid: boolean; reason?: string } {
    // 빈 명령어 체크
    if (!command || command.trim().length === 0) {
      return { valid: false, reason: 'Empty command' };
    }

    // 화이트리스트 체크
    if (this.config.allowedCommands && this.config.allowedCommands.length > 0) {
      const isAllowed = this.config.allowedCommands.some((pattern) =>
        new RegExp(pattern).test(command)
      );
      if (!isAllowed) {
        return { valid: false, reason: 'Command not in whitelist' };
      }
    }

    // 블랙리스트 체크
    if (this.config.blockedCommands) {
      for (const pattern of this.config.blockedCommands) {
        if (new RegExp(pattern).test(command)) {
          return { valid: false, reason: `Command matches blocked pattern: ${pattern}` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 실행 중인 프로세스 목록
   */
  getRunningProcesses(): RunningProcess[] {
    const processes: RunningProcess[] = [];

    for (const [pid, child] of this.runningProcesses) {
      if (!child.killed) {
        processes.push({
          pid,
          startTime: new Date(), // 실제로는 생성 시점 저장 필요
          command: child.spawnargs.join(' '),
          kill: async (signal = 'SIGTERM') => {
            child.kill(signal);
          },
        });
      }
    }

    return processes;
  }

  /**
   * 프로세스 중지
   */
  async killProcess(pid: number, signal: NodeJS.Signals = 'SIGTERM'): Promise<boolean> {
    const child = this.runningProcesses.get(pid);

    if (!child || child.killed) {
      return false;
    }

    child.kill(signal);

    // 프로세스 종료 대기
    return new Promise((resolve) => {
      child.on('close', () => {
        resolve(true);
      });

      // 5초 후에도 종료되지 않으면 false
      setTimeout(() => {
        resolve(child.killed);
      }, 5000);
    });
  }

  /**
   * 위험한 명령어 여부 확인
   */
  private isDangerous(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
  }
}

/**
 * Bash 도구 인스턴스 생성
 */
export function createBashTool(config: Partial<BashToolConfig>, logger: ILogger): BashTool {
  return new BashTool(config, logger);
}
