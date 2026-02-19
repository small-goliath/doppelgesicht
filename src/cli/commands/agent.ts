/**
 * Agent CLI 명령어
 * @description AI 대화 인터페이스 구현
 */

import { randomUUID } from 'crypto';
import * as p from '@clack/prompts';
import { pc } from '../../utils/colors.js';
import type { Command } from 'commander';
import type { ILLMClient, ChatMessage, ToolCall, ToolDefinition } from '../../llm/types.js';
import { ApprovalManager, type RiskLevel } from '../../tools/approval/index.js';
import type { Logger } from '../../logging/index.js';
import type { SupabaseMemoryManager } from '../../memory/index.js';

/**
 * 도구 정의
 */
const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Execute bash commands in the system shell',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The bash command to execute',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in seconds (default: 30)',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'channel_send',
      description: 'Send a message through a communication channel (Telegram, Slack)',
      parameters: {
        type: 'object',
        properties: {
          channel: {
            type: 'string',
            enum: ['telegram', 'slack'],
            description: 'The channel to send through',
          },
          recipient: {
            type: 'string',
            description: 'The recipient ID or username',
          },
          message: {
            type: 'string',
            description: 'The message content',
          },
        },
        required: ['channel', 'recipient', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cli_runner',
      description: 'Run a CLI command with specific arguments',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The CLI command to run',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Command arguments',
          },
        },
        required: ['command'],
      },
    },
  },
];

/**
 * Agent 세션 상태
 */
interface AgentSession {
  id: string;
  messages: ChatMessage[];
  startTime: Date;
  toolCallCount: number;
}

/**
 * Agent CLI 클래스
 */
export class AgentCLI {
  private llmClient: ILLMClient;
  private approvalManager: ApprovalManager;
  private logger: Logger;
  private memoryManager?: SupabaseMemoryManager;
  private session: AgentSession;
  private isRunning = false;

  constructor(
    llmClient: ILLMClient,
    approvalManager: ApprovalManager,
    logger: Logger,
    memoryManager?: SupabaseMemoryManager
  ) {
    this.llmClient = llmClient;
    this.approvalManager = approvalManager;
    this.logger = logger;
    this.memoryManager = memoryManager;
    this.session = {
      id: randomUUID(),
      messages: [],
      startTime: new Date(),
      toolCallCount: 0,
    };

    // approvalManager 등록 (이벤트 리스너 등에 사용)
    this.logger.debug('ApprovalManager initialized', {
      pendingRequests: approvalManager.getPendingRequests().length,
    });
  }

  /**
   * 에이전트를 시작합니다
   */
  async start(): Promise<void> {
    this.isRunning = true;

    p.intro(pc.cyan('🤖 Doppelgesicht Agent'));
    p.note(
      'AI 어시스턴트와 대화를 시작합니다.\n' +
      '도구 호출이 필요한 경우 승인을 요청합니다.\n' +
      pc.dim('exit 또는 quit를 입력하여 종료합니다.'),
      '사용 방법'
    );

    // 시스템 메시지 초기화
    const systemPrompt = `You are Doppelgesicht Agent, an AI assistant that can use tools to help users.
Available tools:
- bash: Execute bash commands
- channel_send: Send messages through Telegram or Slack
- cli_runner: Run CLI commands

When you need to use a tool, clearly indicate it. The user will be asked for approval before execution.
Be helpful, concise, and safe in your responses.`;

    this.session.messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // 대화 루프
    while (this.isRunning) {
      const userInput = await p.text({
        message: pc.cyan('You:'),
        placeholder: '메시지를 입력하세요...',
      });

      if (p.isCancel(userInput)) {
        break;
      }

      const input = userInput.trim();

      // 종료 명령
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        break;
      }

      if (input.length === 0) {
        continue;
      }

      // 사용자 메시지 추가
      this.session.messages.push({
        role: 'user',
        content: input,
      });

      // 메모리에 저장
      await this.saveToMemory('user', input);

      // LLM 응답 처리
      await this.processLLMResponse();
    }

    await this.stop();
  }

  /**
   * LLM 응답을 처리합니다
   */
  private async processLLMResponse(): Promise<void> {
    const spinner = p.spinner();
    spinner.start('AI가 응답을 생성하고 있습니다...');

    try {
      // LLM 완전 응답 요청
      const result = await this.llmClient.complete({
        model: 'claude-3-sonnet-20240229',
        messages: this.session.messages,
        tools: TOOLS,
      });

      spinner.stop('');

      const fullContent = result.message.content || '';
      const toolCalls = result.message.tool_calls || [];

      // 도구 호출이 있는 경우
      if (toolCalls.length > 0) {
        console.log(); // 줄바꿈
        p.note('도구 호출이 감지되었습니다', '🔧');

        for (const toolCall of toolCalls) {
          const approved = await this.handleToolCall(toolCall);

          if (approved) {
            // 도구 실행 결과를 메시지에 추가
            this.session.messages.push({
              role: 'assistant',
              content: fullContent,
              tool_calls: [toolCall],
            });
          }
        }
      } else {
        // 일반 응답
        console.log(); // 줄바꿈
        p.log.success(pc.green('AI: ') + fullContent);

        // 어시스턴트 메시지 추가
        this.session.messages.push({
          role: 'assistant',
          content: fullContent,
        });

        // 메모리에 저장
        await this.saveToMemory('assistant', fullContent);
      }
    } catch (error) {
      spinner.stop('');
      p.log.error(`Error: ${(error as Error).message}`);
      this.logger.error('LLM response error', new Error((error as Error).message));
    }
  }

  /**
   * 도구 호출을 처리합니다
   */
  private async handleToolCall(toolCall: ToolCall): Promise<boolean> {
    const toolName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    // 위험도 평가
    let riskLevel: RiskLevel = 'Low';
    let description = '';

    switch (toolName) {
      case 'bash':
        riskLevel = this.assessBashRisk(args.command);
        description = `Bash 명령 실행: ${args.command}`;
        break;
      case 'channel_send':
        riskLevel = 'Medium';
        description = `${args.channel}로 메시지 전송: "${args.message}"`;
        break;
      case 'cli_runner':
        riskLevel = 'Medium';
        description = `CLI 실행: ${args.command} ${args.args?.join(' ') || ''}`;
        break;
      default:
        riskLevel = 'High';
        description = `알 수 없는 도구: ${toolName}`;
    }

    // 승인 UI 표시
    const shouldExecute = await p.confirm({
      message: `${pc.yellow('⚠️')} 도구 실행 승인 요청\n\n` +
        pc.dim('도구: ') + pc.cyan(toolName) + '\n' +
        pc.dim('위험도: ') + this.getRiskColor(riskLevel)(riskLevel) + '\n' +
        pc.dim('설명: ') + description + '\n\n' +
        '실행을 승인하시겠습니까?',
      initialValue: riskLevel === 'Low',
    });

    if (p.isCancel(shouldExecute) || !shouldExecute) {
      p.log.info('도구 실행이 취소되었습니다.');

      // 취소 결과를 메시지에 추가
      this.session.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: 'Tool execution was cancelled by user.',
      });

      return false;
    }

    // 도구 실행
    const spinner = p.spinner();
    spinner.start('도구를 실행하는 중...');

    try {
      const result = await this.executeTool(toolName, args);
      spinner.stop('도구 실행 완료');

      // 결과를 메시지에 추가
      this.session.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });

      this.session.toolCallCount++;

      p.log.success('결과: ' + pc.dim(JSON.stringify(result).slice(0, 200)));

      return true;
    } catch (error) {
      spinner.stop('도구 실행 실패');
      const errorMessage = (error as Error).message;
      p.log.error(`실패: ${errorMessage}`);

      // 에러를 메시지에 추가
      this.session.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: `Error: ${errorMessage}`,
      });

      return false;
    }
  }

  /**
   * 도구를 실행합니다
   */
  private async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    // TODO: 실제 도구 실행 구현
    // BashExecutor 등 도구 실행기 연동 필요
    switch (toolName) {
      case 'bash': {
        const command = args.command as string;
        return {
          stdout: `Executed: ${command}`,
          stderr: '',
          exitCode: 0,
        };
      }

      case 'channel_send':
        // 채널 전송은 별도 구현 필요
        return { status: 'not_implemented', message: 'Channel send not yet implemented' };

      case 'cli_runner': {
        const command = args.command as string;
        const cliArgs = (args.args as string[]) || [];
        return {
          stdout: `Executed: ${command} ${cliArgs.join(' ')}`,
          stderr: '',
          exitCode: 0,
        };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Bash 명령의 위험도를 평가합니다
   */
  private assessBashRisk(command: string): RiskLevel {
    const highRiskPatterns = [
      /rm\s+-rf/i,
      />\s*\/dev\/null/i,
      /dd\s+if/i,
      /mkfs/i,
      /fdisk/i,
      /:\(\)\s*\{\s*:\|\:&/,
    ];

    const mediumRiskPatterns = [
      /sudo/i,
      /curl.*\|.*sh/i,
      /wget.*\|.*sh/i,
      /chmod\s+777/i,
    ];

    for (const pattern of highRiskPatterns) {
      if (pattern.test(command)) {
        return 'Critical';
      }
    }

    for (const pattern of mediumRiskPatterns) {
      if (pattern.test(command)) {
        return 'High';
      }
    }

    return 'Low';
  }

  /**
   * 위험도에 따른 색상 반환
   */
  private getRiskColor(risk: RiskLevel): (text: string) => string {
    switch (risk) {
      case 'Critical':
        return pc.bgRed;
      case 'High':
        return pc.red;
      case 'Medium':
        return pc.yellow;
      case 'Low':
        return pc.green;
      default:
        return pc.gray;
    }
  }

  /**
   * 메모리에 저장합니다
   */
  private async saveToMemory(role: 'user' | 'assistant', _content: string): Promise<void> {
    if (!this.memoryManager) return;

    try {
      // TODO: MemoryManager 인터페이스에 따라 구현
      this.logger.debug('Saving to memory', { sessionId: this.session.id, role });
    } catch (error) {
      this.logger.warn('Failed to save to memory', { error: (error as Error).message });
    }
  }

  /**
   * 에이전트를 중지합니다
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    const duration = Math.floor((Date.now() - this.session.startTime.getTime()) / 1000);

    p.outro(
      pc.cyan('👋 에이전트 세션이 종료되었습니다.\n') +
      pc.dim(`세션 ID: ${this.session.id}\n`) +
      pc.dim(`지속 시간: ${duration}초\n`) +
      pc.dim(`도구 호출: ${this.session.toolCallCount}회`)
    );
  }

  /**
   * ApprovalManager를 반환합니다
   */
  getApprovalManager(): ApprovalManager {
    return this.approvalManager;
  }
}

/**
 * Commander 명령어 등록
 */
export function registerAgentCommand(program: Command): void {
  program
    .command('agent')
    .description('Start interactive AI agent session')
    .option('-m, --model <model>', 'LLM model to use', 'claude-3-sonnet-20240229')
    .action(async (options) => {
      // 의존성 주입 (실제 구현에서는 DI 컨테이너 사용 권장)
      console.log(pc.yellow('Agent command not yet fully initialized.'));
      console.log(pc.dim('Model:'), options.model);
    });
}
