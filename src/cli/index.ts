#!/usr/bin/env node

/**
 * doppelgesicht CLI 엔트리포인트
 * @description Commander.js 기반 메인 CLI
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// CLI 명령어 등록
import { registerOnboardCommand } from './commands/onboard.js';
import { registerGatewayCommand } from './commands/gateway.js';
import { registerAgentCommand } from './commands/agent.js';
import { registerConfigCommand } from './commands/config.js';
import { registerAuthCommand } from './commands/auth.js';
import { registerMessageCommand } from './commands/message.js';
import { registerBrowserCommand } from './commands/browser.js';

// 현재 파일의 디렉토리 경로 (ESM 환경)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * package.json에서 버전 정보를 읽어옵니다
 */
function getVersion(): string {
  try {
    // 여러 가능한 위치에서 package.json 찾기
    const possiblePaths = [
      join(__dirname, '../../package.json'),
      join(__dirname, '../package.json'),
      join(process.cwd(), 'package.json'),
    ];

    for (const pkgPath of possiblePaths) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.version) {
          return pkg.version;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // 무시
  }
  return '0.0.0';
}

/**
 * 메인 CLI 프로그램 생성
 */
function createProgram(): Command {
  const program = new Command();

  // 기본 정보 설정
  program
    .name('doppelgesicht')
    .description('AI Gateway with Multi-Channel Integration')
    .version(getVersion(), '-v, --version', '버전 정보를 출력합니다')
    .helpOption('-h, --help', '도움말을 출력합니다')
    .usage('[command] [options]');

  // 글로벌 옵션
  program
    .option('--verbose', '상세 로그 출력', false)
    .option('--config <path>', '설정 파일 경로 지정')
    .option('--no-color', '컬러 출력 비활성화');

  // 글로벌 옵션 처리 미들웨어
  program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();

    // verbose 모드 설정
    if (opts.verbose) {
      process.env.LOG_LEVEL = 'debug';
    }

    // 색상 비활성화
    if (opts.noColor) {
      process.env.NO_COLOR = '1';
    }

    // 설정 파일 경로 환경변수로 전달
    if (opts.config) {
      process.env.DOPPELGESICHT_CONFIG = opts.config;
    }
  });

  return program;
}

/**
 * 모든 명령어 등록
 */
function registerCommands(program: Command): void {
  // 1. onboard: 초기 설정 마법사
  registerOnboardCommand(program);

  // 2. gateway: 서버 시작
  registerGatewayCommand(program);

  // 3. agent: AI 대화 인터페이스
  registerAgentCommand(program);

  // 4. config: 설정 관리
  registerConfigCommand(program);

  // 5. auth: 인증 프로파일 관리
  registerAuthCommand(program);

  // 6. message: 메시지 전송 및 채널 관리
  registerMessageCommand(program);

  // 7. browser: 브라우저 자동화
  registerBrowserCommand(program);
}

/**
 * 에러 핸들링 설정
 */
function setupErrorHandling(program: Command): void {
  // 명령어 not found 처리
  program.on('command:*', (operands) => {
    console.error(`
  ${'❌'} 오류: 알 수 없는 명령어 '${operands[0]}'

  사용 가능한 명령어를 볼려면:
    $ doppelgesicht --help
`);
    process.exit(1);
  });

  // 전역 에러 핸들러
  process.on('uncaughtException', (error) => {
    console.error(`
  ${'❌'} 처리되지 않은 예외가 발생했습니다:
     ${error.message}

  자세한 내용은 로그를 확인하세요.
`);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error(`
  ${'❌'} 처리되지 않은 Promise 거부가 발생했습니다:
     ${reason}

  자세한 내용은 로그를 확인하세요.
`);
    process.exit(1);
  });
}

/**
 * CLI 실행
 */
async function main(): Promise<void> {
  const program = createProgram();

  // 명령어 등록
  registerCommands(program);

  // 에러 핸들링 설정
  setupErrorHandling(program);

  // 명령어 파싱 및 실행
  await program.parseAsync(process.argv);

  // 명령어가 없으면 도움말 표시
  if (process.argv.length <= 2) {
    program.help();
  }
}

// CLI 실행
main().catch((error) => {
  console.error('CLI 실행 중 오류가 발생했습니다:', error);
  process.exit(1);
});

// 버전 정보 export (다른 모듈에서 사용 가능)
export const VERSION = getVersion();