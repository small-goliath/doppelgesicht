#!/usr/bin/env node

/**
 * doppelgesicht CLI 엔트리포인트
 */

import { Command } from 'commander';
import { VERSION } from '../index.js';
import { registerAgentCommand } from './commands/agent.js';
import { registerConfigCommand } from './commands/config.js';
import { registerAuthCommand } from './commands/auth.js';

const program = new Command();

program
  .name('doppelgesicht')
  .description('AI Gateway with Multi-Channel Integration')
  .version(VERSION);

// 기본 명령어
program
  .command('hello')
  .description('테스트 명령어')
  .action(() => {
    console.log('Hello from doppelgesicht CLI!');
  });

// 서브커맨드 등록
registerAgentCommand(program);
registerConfigCommand(program);
registerAuthCommand(program);

// 명령어 파싱
program.parse();
