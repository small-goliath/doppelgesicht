/**
 * Gateway CLI 명령어
 * @description Gateway 서버 시작 CLI 구현
 */

import { Command } from 'commander';
import * as p from '@clack/prompts';
import { pc } from '../../utils/colors.js';
import { ConfigManager } from '../../core/config-manager.js';
import { GatewayServer } from '../../gateway/server.js';
import { createLogger } from '../../logging/index.js';
import { TelegramAdapter } from '../../channels/telegram/adapter.js';
import { SlackAdapter } from '../../channels/slack/adapter.js';
import { DiscordAdapter } from '../../channels/discord/adapter.js';
import { AnthropicClient } from '../../llm/anthropic.js';
import { OpenAIClient } from '../../llm/openai.js';
import { MoonshotClient } from '../../llm/moonshot.js';
import { AuthProfileManager } from '../../core/auth-profile.js';
import type { ToolDefinition, ILLMClient, ChatMessage } from '../../llm/types.js';
import type { IChannelAdapter } from '../../channels/types.js';
import type { ILogger } from '../../logging/index.js';
// recoverMasterKey는 onboard.ts에서 가져오지 않고 남부 구현
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

// 기본 설정 경로
const DEFAULT_CONFIG_DIR = join(homedir(), '.doppelgesicht');
const DEFAULT_CONFIG_PATH = join(DEFAULT_CONFIG_DIR, 'config.yaml');
const MASTER_KEY_FILE = join(DEFAULT_CONFIG_DIR, 'master.key');

/**
 * Gateway 명령어 등록
 */
export function registerGatewayCommand(program: Command): void {
  program
    .command('gateway')
    .description('Gateway 서버를 시작합니다')
    .option('-c, --config <path>', '설정 파일 경로', DEFAULT_CONFIG_PATH)
    .option('-p, --port <port>', 'HTTP 포트 (설정 파일보다 우선)')
    .option('-d, --daemon', 'Daemon 모드로 실행')
    .option('--no-channels', '채널 연결 없이 실행')
    .action(async (options) => {
      const gateway = new GatewayCLI(options);
      await gateway.run();
    });
}

/**
 * Gateway CLI 클래스
 */
class GatewayCLI {
  private options: {
    config: string;
    port?: string;
    daemon: boolean;
    channels: boolean;
  };
  private logger = createLogger({ level: 'info', console: true, json: false });
  private server?: GatewayServer;
  private shuttingDown = false;

  constructor(options: {
    config: string;
    port?: string;
    daemon: boolean;
    channels: boolean;
  }) {
    this.options = options;
  }

  /**
   * Gateway 실행
   */
  async run(): Promise<void> {
    console.clear();
    p.intro(pc.cyan('🌐 Doppelgesicht Gateway'));

    try {
      // 1. 마스터 키 복구
      const masterKey = await this.recoverMasterKey();
      if (!masterKey) {
        p.outro(pc.red('마스터 키 복구에 실패했습니다. `doppelgesicht onboard`를 실행하세요.'));
        process.exit(1);
      }

      // 2. 설정 파일 로드
      const config = await this.loadConfig();
      if (!config) {
        p.outro(pc.red('설정 파일을 로드할 수 없습니다.'));
        process.exit(1);
      }

      // 3. Daemon 모드 처리
      if (this.options.daemon) {
        await this.runAsDaemon();
        return;
      }

      // 4. 서버 초기화 및 시작
      await this.startServer(config, masterKey);

      // 5. 종료 처리
      this.setupShutdownHandlers();
    } catch (error) {
      this.logger.error('Gateway failed', error as Error);
      p.outro(pc.red('Gateway 실행 중 오류가 발생했습니다.'));
      process.exit(1);
    }
  }

  /**
   * 마스터 키 복구
   */
  private async recoverMasterKey(): Promise<Buffer | null> {
    if (!existsSync(MASTER_KEY_FILE)) {
      return null;
    }

    const password = await p.password({
      message: '마스터 비밀번호를 입력하세요:',
    });

    if (p.isCancel(password)) {
      return null;
    }

    const spinner = p.spinner();
    spinner.start('마스터 키를 복구하는 중...');

    try {
      const { readFileSync } = await import('fs');
      const { verifyAndRecoverKey } = await import('../../security/master-key.js');
      
      const storedHash = readFileSync(MASTER_KEY_FILE, 'utf-8');
      const key = await verifyAndRecoverKey(password, storedHash);
      
      spinner.stop('마스터 키가 복구되었습니다.');
      return key;
    } catch (error) {
      spinner.stop('마스터 키 복구에 실패했습니다.');
      return null;
    }
  }

  /**
   * 설정 파일 로드
   */
  private async loadConfig() {
    const spinner = p.spinner();
    spinner.start('설정 파일을 로드하는 중...');

    try {
      const configManager = new ConfigManager(this.options.config);
      
      if (!configManager.exists()) {
        spinner.stop('설정 파일이 존재하지 않습니다.');
        return null;
      }

      const config = configManager.load();
      
      // 포트 오버라이드
      if (this.options.port) {
        config.gateway.httpPort = parseInt(this.options.port, 10);
      }

      spinner.stop('설정 파일이 로드되었습니다.');
      return config;
    } catch (error) {
      spinner.stop(`설정 파일 로드 실패: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 서버 시작
   */
  private async startServer(config: import('../../types/config.js').AppConfig, masterKey: Buffer): Promise<void> {
    const spinner = p.spinner();
    spinner.start('서버를 초기화하는 중...');

    try {
      // Auth Profile Manager 설정
      const profileManager = new AuthProfileManager();
      profileManager.setMasterKey(masterKey);

      // 파일에서 프로파일 로드
      const loaded = profileManager.loadFromFile();
      if (loaded) {
        this.logger.info(`Loaded ${profileManager.count} auth profiles from file`);
      } else {
        this.logger.warn('No auth profiles file found, starting with empty profiles');
      }

      // LLM 클라이언트 초기화
      const llmClients = await this.initializeLLMClients(profileManager);

      // 채널 어댑터 초기화
      const channels: import('../../channels/types.js').IChannelAdapter[] = [];
      if (this.options.channels) {
        const channelAdapters = await this.initializeChannels(config);
        channels.push(...channelAdapters);

        // 채널 메시지 핸들러 등록
        for (const channel of channels) {
          this.setupChannelMessageHandler(channel, llmClients);
        }
      }

      // Gateway 서버 생성
      this.server = new GatewayServer(
        {
          httpPort: config.gateway.httpPort,
          wsPort: config.gateway.wsPort,
          host: config.gateway.host,
          jwtSecret: config.gateway.auth?.jwtSecret || 'default-secret',
          tokenExpiry: config.gateway.auth?.tokenExpiry || 3600,
          cors: config.gateway.cors,
          acl: {
            allow: ['127.0.0.1/32', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
            deny: [],
          },
        },
        this.logger,
        {
          llmClients,
          channels,
        }
      );

      // 서버 시작
      await this.server.start();
      spinner.stop('서버가 시작되었습니다.');

      // 시작 정보 출력
      console.log();
      p.note(
        `${pc.cyan('HTTP Server:')}  http://${config.gateway.host}:${config.gateway.httpPort}\n` +
        `${pc.cyan('WebSocket:')}    ws://${config.gateway.host}:${config.gateway.httpPort}/ws\n` +
        `${pc.cyan('Health Check:')}  http://${config.gateway.host}:${config.gateway.httpPort}/v1/health\n` +
        `${pc.cyan('Channels:')}      ${channels.length > 0 ? channels.map(c => c.name).join(', ') : '없음'}`,
        '서버 정보'
      );

      console.log();
      p.log.info(pc.dim('서버가 실행 중입니다. Ctrl+C를 눌러 종료하세요.'));

      // 메모리 정리
      masterKey.fill(0);
    } catch (error) {
      spinner.stop(`서버 시작 실패: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * LLM 클라이언트 초기화
   */
  private async initializeLLMClients(
    profileManager: AuthProfileManager
  ): Promise<import('../../llm/types.js').ILLMClient[]> {
    const clients: import('../../llm/types.js').ILLMClient[] = [];

    try {
      const profiles = profileManager.getAllProfiles();

      for (const profile of profiles) {
        if (profile.provider === 'anthropic') {
          const credentials = profileManager.getDecryptedCredentials(profile.id);
          if (credentials?.type === 'api_key') {
            clients.push(new AnthropicClient({ provider: 'anthropic', apiKey: credentials.apiKey }, this.logger));
          }
        } else if (profile.provider === 'openai') {
          const credentials = profileManager.getDecryptedCredentials(profile.id);
          if (credentials?.type === 'api_key') {
            clients.push(new OpenAIClient({ provider: 'openai', apiKey: credentials.apiKey }, this.logger));
          }
        } else if (profile.provider === 'moonshot') {
          const credentials = profileManager.getDecryptedCredentials(profile.id);
          if (credentials?.type === 'api_key') {
            clients.push(new MoonshotClient({ provider: 'moonshot', apiKey: credentials.apiKey }, this.logger));
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to initialize some LLM clients', { error: (error as Error).message });
    }

    return clients;
  }

  /**
   * 채널 어댑터 초기화
   */
  private async initializeChannels(
    config: import('../../types/config.js').AppConfig
  ): Promise<import('../../channels/types.js').IChannelAdapter[]> {
    const channels: import('../../channels/types.js').IChannelAdapter[] = [];

    // Telegram 채널
    if (config.channels.telegram?.botToken) {
      try {
        const telegramAdapter = new TelegramAdapter(
          {
            id: 'telegram',
            name: 'Telegram',
            enabled: true,
            botToken: config.channels.telegram.botToken,
            allowedUsers: config.channels.telegram.allowedUsers || [],
          } as import('../../channels/types.js').ChannelConfig,
          this.logger
        );
        await telegramAdapter.initialize({
          id: 'telegram',
          name: 'Telegram',
          enabled: true,
          botToken: config.channels.telegram.botToken,
          allowedUsers: config.channels.telegram.allowedUsers || [],
        } as import('../../channels/types.js').ChannelConfig);
        await telegramAdapter.start();
        channels.push(telegramAdapter);
        this.logger.info('Telegram channel initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Telegram channel', error as Error);
      }
    }

    // Slack 채널
    if (config.channels.slack?.appToken && config.channels.slack?.botToken) {
      try {
        const slackAdapter = new SlackAdapter(
          {
            id: 'slack',
            name: 'Slack',
            enabled: true,
            appToken: config.channels.slack.appToken,
            botToken: config.channels.slack.botToken,
            allowedUsers: config.channels.slack.allowedUsers || [],
          } as import('../../channels/types.js').ChannelConfig,
          this.logger
        );
        await slackAdapter.initialize({
          id: 'slack',
          name: 'Slack',
          enabled: true,
          appToken: config.channels.slack.appToken,
          botToken: config.channels.slack.botToken,
          allowedUsers: config.channels.slack.allowedUsers || [],
        } as import('../../channels/types.js').ChannelConfig);
        await slackAdapter.start();
        channels.push(slackAdapter);
        this.logger.info('Slack channel initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Slack channel', error as Error);
      }
    }

    // Discord 채널
    if (config.channels.discord?.botToken) {
      try {
        const discordConfig = {
          id: 'discord',
          name: 'Discord',
          enabled: true,
          botToken: config.channels.discord.botToken,
          allowedUsers: config.channels.discord.allowedUsers || [],
          allowedChannels: config.channels.discord.allowedChannels || [],
          allowedGuilds: config.channels.discord.allowedGuilds || [],
          allowDMs: config.channels.discord.allowDMs ?? true,
        };
        // eslint-disable-next-line no-console
        console.log('[GATEWAY] Discord config:', JSON.stringify(discordConfig, null, 2));

        const discordAdapter = new DiscordAdapter(
          discordConfig as import('../../channels/types.js').ChannelConfig,
          this.logger
        );
        await discordAdapter.initialize(discordConfig as import('../../channels/types.js').ChannelConfig);
        await discordAdapter.start();
        channels.push(discordAdapter);
        this.logger.info('Discord channel initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Discord channel', error as Error);
      }
    }

    return channels;
  }

  /**
   * Daemon 모드로 실행
   */
  private async runAsDaemon(): Promise<void> {
    p.log.info(pc.yellow('Daemon 모드로 실행합니다...'));
    
    // TODO: 실제 Daemon 구현 (pm2, forever 등 연동)
    p.log.warn('Daemon 모드는 아직 완전히 구현되지 않았습니다.');
    p.log.info('대신 일반 모드로 실행합니다.');
  }

  /**
   * 종료 핸들러 설정
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.shuttingDown) return;
      this.shuttingDown = true;

      console.log();
      p.log.info(pc.yellow(`${signal} 신호를 받았습니다. 서버를 종료합니다...`));

      try {
        if (this.server) {
          await this.server.stop();
        }
        p.outro(pc.green('서버가 안전하게 종료되었습니다.'));
        process.exit(0);
      } catch (error) {
        this.logger.error('Shutdown error', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Windows에서 Ctrl+C 처리
    if (process.platform === 'win32') {
      process.on('message', (msg) => {
        if (msg === 'shutdown') {
          shutdown('shutdown');
        }
      });
    }
  }

  /**
   * 사용 가능한 도구 정의 목록
   */
  private getToolDefinitions(): ToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'exec',
          description: 'Execute a shell command and return the output. Useful for running curl, date, or other CLI tools to get real-time data.',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The shell command to execute (e.g., "curl -s https://api.example.com/data" or "date")',
              },
              timeout: {
                type: 'number',
                description: 'Timeout in milliseconds (default: 30000)',
              },
            },
            required: ['command'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'web_fetch',
          description: 'Fetch content from a URL using HTTP GET. Returns the HTML or text content.',
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to fetch (e.g., "https://example.com")',
              },
              headers: {
                type: 'object',
                description: 'Optional HTTP headers to include',
              },
            },
            required: ['url'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'file_read',
          description: 'Read the contents of a file from the local filesystem.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute path to the file to read',
              },
              encoding: {
                type: 'string',
                description: 'File encoding (default: utf8)',
                enum: ['utf8', 'base64', 'binary'],
              },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'file_write',
          description: 'Write content to a file on the local filesystem.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute path to the file to write',
              },
              content: {
                type: 'string',
                description: 'Content to write to the file',
              },
              encoding: {
                type: 'string',
                description: 'File encoding (default: utf8)',
                enum: ['utf8', 'base64'],
              },
            },
            required: ['path', 'content'],
          },
        },
      },
    ];
  }

  /**
   * 도구 실행
   */
  private async executeTool(
    toolCall: { id: string; function: { name: string; arguments: string } },
    _logger: ILogger
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    const { name, arguments: argsStr } = toolCall.function;
    let args: Record<string, unknown>;

    try {
      args = JSON.parse(argsStr);
    } catch {
      return { success: false, error: 'Invalid JSON in tool arguments' };
    }

    // eslint-disable-next-line no-console
    console.log(`[TOOL] Executing tool: ${name} with args:`, args);

    try {
      switch (name) {
        case 'exec': {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);

          const command = args.command as string;
          const timeout = (args.timeout as number) || 30000;

          const { stdout, stderr } = await execAsync(command, { timeout });
          const output = stdout || stderr || '';

          // 출력 크기 제한 (1MB)
          const MAX_OUTPUT_SIZE = 1024 * 1024;
          const truncatedOutput = output.length > MAX_OUTPUT_SIZE
            ? output.substring(0, MAX_OUTPUT_SIZE) + '\n... (output truncated)'
            : output;

          return { success: true, output: truncatedOutput };
        }

        case 'web_fetch': {
          const url = args.url as string;
          const response = await fetch(url, {
            headers: (args.headers as Record<string, string>) || {},
          });

          if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
          }

          const content = await response.text();
          // 출력 크기 제한 (1MB)
          const MAX_CONTENT_SIZE = 1024 * 1024;
          const truncatedContent = content.length > MAX_CONTENT_SIZE
            ? content.substring(0, MAX_CONTENT_SIZE) + '\n... (content truncated)'
            : content;

          return { success: true, output: truncatedContent };
        }

        case 'file_read': {
          const { readFileSync } = await import('fs');
          const filePath = args.path as string;
          const encoding = (args.encoding as 'utf8' | 'base64') || 'utf8';

          const content = readFileSync(filePath, encoding);
          // 출력 크기 제한 (1MB)
          const MAX_CONTENT_SIZE = 1024 * 1024;
          const truncatedContent = typeof content === 'string' && content.length > MAX_CONTENT_SIZE
            ? content.substring(0, MAX_CONTENT_SIZE) + '\n... (content truncated)'
            : content;

          return { success: true, output: truncatedContent };
        }

        case 'file_write': {
          const { writeFileSync } = await import('fs');
          const filePath = args.path as string;
          const content = args.content as string;
          const encoding = (args.encoding as 'utf8' | 'base64') || 'utf8';

          writeFileSync(filePath, content, encoding);
          return { success: true, output: `File written successfully: ${filePath}` };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Tool Call Loop 구현
   * 반복적으로 LLM을 호출하여 도구 실행을 처리
   */
  private async executeToolCallLoop(
    client: ILLMClient,
    userMessage: string,
    logger: ILogger
  ): Promise<string> {
    const tools = this.getToolDefinitions();
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a helpful AI assistant with access to real-time data through tools. Current date: ${new Date().toISOString()}. Use tools when you need current information.`,
      },
      { role: 'user', content: userMessage },
    ];

    const MAX_ITERATIONS = 10;
    const MAX_TOTAL_TIME = 5 * 60 * 1000; // 5분
    const startTime = Date.now();

    let iteration = 0;

    while (iteration < MAX_ITERATIONS) {
      // 총 실행 시간 체크
      if (Date.now() - startTime > MAX_TOTAL_TIME) {
        logger.warn('Tool call loop exceeded maximum execution time');
        return '죄송합니다. 요청 처리 시간이 너무 오래 걸려 중단되었습니다.';
      }

      iteration++;
      logger.debug(`Tool call loop iteration ${iteration}`);
      // eslint-disable-next-line no-console
      console.log(`[TOOL LOOP] Iteration ${iteration}/${MAX_ITERATIONS}`);

      // LLM 호출
      const response = await client.complete({
        model: 'moonshot-v1-8k',
        messages,
        tools,
        max_tokens: 2048,
      });

      const assistantMessage = response.message;

      // 도구 호출이 없으면 최종 응답 반환
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        logger.debug('No tool calls, returning final response');
        return assistantMessage.content;
      }

      // 어시스턴트 메시지 추가 (tool_calls 포함 필수)
      messages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: assistantMessage.tool_calls,
      });

      // 각 도구 호출 실행
      for (const toolCall of assistantMessage.tool_calls) {
        // eslint-disable-next-line no-console
        console.log(`[TOOL LOOP] Executing tool: ${toolCall.function.name}`);

        const toolResult = await this.executeTool(toolCall, logger);

        // eslint-disable-next-line no-console
        console.log(`[TOOL LOOP] Tool result: ${toolResult.success ? 'success' : 'error'}`);

        // 도구 결과를 메시지에 추가
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });

        // 도구 실행 로깅
        logger.info(`Tool executed: ${toolCall.function.name}`, {
          success: toolResult.success,
          outputLength: toolResult.output?.length || 0,
          error: toolResult.error,
        });
      }
    }

    // 최대 반복 횟수 초과
    logger.warn('Tool call loop exceeded maximum iterations');

    // 마지막으로 한 번 더 호출하여 정리
    const finalResponse = await client.complete({
      model: 'moonshot-v1-8k',
      messages,
      max_tokens: 2048,
    });

    return finalResponse.message.content;
  }

  /**
   * 채널 메시지 핸들러 설정
   */
  private setupChannelMessageHandler(
    channel: IChannelAdapter,
    llmClients: ILLMClient[]
  ): void {
    this.logger.info(`Setting up message handler for ${channel.name}`);
    // eslint-disable-next-line no-console
    console.log(`[GATEWAY] Setting up message handler for ${channel.name}`);

    channel.onMessage(async (message) => {
      // eslint-disable-next-line no-console
      console.log(`[GATEWAY] Received message from ${channel.name}: "${message.text.substring(0, 50)}"`);
      this.logger.info(`Received message from ${channel.name}`, {
        userId: message.sender.id,
        text: message.text.substring(0, 50),
      });

      // 채널 ID 추출 (Discord는 channelId, 기타는 channel 속성 사용)
      const channelId = (message as { channelId?: string }).channelId || message.channel;
      // eslint-disable-next-line no-console
      console.log(`[GATEWAY] Using channel ID: ${channelId}`);

      try {
        // 사용자에게 타이핑 표시 (지원하는 경우)
        if (channel.sendTypingIndicator) {
          await channel.sendTypingIndicator(channelId);
        }

        // LLM 클라이언트 선택 (첫 번째 사용 가능한 클라이언트)
        const client = llmClients[0];
        if (!client) {
          this.logger.error('No LLM client available');
          await channel.send(channelId, {
            text: '죄송합니다. 현재 AI 모델을 사용할 수 없습니다.',
          });
          return;
        }

        // AI 응답 생성 (Tool Call Loop 사용)
        this.logger.debug(`Generating response with ${client.provider}`);
        // eslint-disable-next-line no-console
        console.log(`[GATEWAY] Starting tool call loop with ${client.provider}`);

        const responseText = await this.executeToolCallLoop(client, message.text, this.logger);

        // 응답 전송
        // eslint-disable-next-line no-console
        console.log(`[GATEWAY] Sending response: "${responseText.substring(0, 50)}..."`);
        await channel.send(channelId, {
          text: responseText,
        });
        // eslint-disable-next-line no-console
        console.log('[GATEWAY] Response sent successfully');

        this.logger.info(`Response sent to ${channel.name}`);
      } catch (error) {
        this.logger.error('Error handling message', error as Error);
        // eslint-disable-next-line no-console
        console.error('[GATEWAY] Error handling message:', (error as Error).message);
        try {
          await channel.send(channelId, {
            text: '죄송합니다. 메시지 처리 중 오류가 발생했습니다.',
          });
        } catch (sendError) {
          this.logger.error('Failed to send error message', sendError as Error);
          // eslint-disable-next-line no-console
          console.error('[GATEWAY] Failed to send error message:', (sendError as Error).message);
        }
      }
    });
  }
}