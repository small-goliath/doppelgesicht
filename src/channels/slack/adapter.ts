/**
 * Slack 채널 어댑터
 * @description @slack/bolt 4.6.0, @slack/web-api 7.14.0 기반
 */

import { App, ExpressReceiver } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import type {
  SlackConfig,
  SlackIncomingMessage,
  SlackOutgoingMessage,
  SlackAdapterState,
} from './types.js';
import { SLACK_CAPABILITIES } from './types.js';
import type { IChannelAdapter, ChannelConfig } from '../types.js';
import type { Logger } from '../../logging/index.js';

/**
 * Slack 채널 어댑터
 */
export class SlackAdapter implements IChannelAdapter {
  readonly id = 'slack';
  readonly name = 'Slack';
  readonly capabilities = SLACK_CAPABILITIES;

  private app?: App;
  private webClient?: WebClient;
  private config: SlackConfig;
  private logger: Logger;
  private state: SlackAdapterState = { connected: false, socketMode: false };
  private messageHandler?: (message: SlackIncomingMessage) => void | Promise<void>;

  constructor(config: ChannelConfig, logger: Logger) {
    this.config = config as SlackConfig;
    this.logger = logger.child('SlackAdapter');
  }

  /**
   * 어댑터 초기화
   */
  async initialize(config: ChannelConfig): Promise<void> {
    this.config = config as SlackConfig;
    this.logger.debug('Initializing Slack adapter');

    // Web Client 초기화 (토큰 검증용)
    this.webClient = new WebClient(this.config.botToken);

    // Bolt App 초기화
    if (this.config.socketMode && this.config.appToken) {
      // Socket Mode
      this.app = new App({
        token: this.config.botToken,
        appToken: this.config.appToken,
        socketMode: true,
      });
      this.state.socketMode = true;
    } else if (this.config.signingSecret) {
      // HTTP Mode
      const receiver = new ExpressReceiver({
        signingSecret: this.config.signingSecret,
      });

      this.app = new App({
        token: this.config.botToken,
        receiver,
      });
      this.state.socketMode = false;
    } else {
      throw new Error('Either appToken (for socket mode) or signingSecret (for HTTP mode) is required');
    }

    // 메시지 핸들러 설정
    this.setupMessageHandlers();

    this.logger.debug('Slack adapter initialized');
  }

  /**
   * 봇 시작
   */
  async start(): Promise<void> {
    if (!this.app || !this.webClient) {
      throw new Error('Slack adapter not initialized');
    }

    this.logger.info('Starting Slack app');

    try {
      // 토큰 검증 (auth.test 호출)
      const authResult = await this.webClient.auth.test();

      if (!authResult.ok) {
        throw new Error('Slack authentication failed');
      }

      this.state.authInfo = {
        userId: authResult.user_id || '',
        user: authResult.user || '',
        teamId: authResult.team_id || '',
        team: authResult.team || '',
      };

      this.logger.info(`Authenticated as @${authResult.user} in workspace ${authResult.team}`);

      // 앱 시작
      const port = this.config.port || 3000;
      await this.app.start(port);

      this.state.connected = true;
      this.logger.info(`Slack app started on port ${port}`);
    } catch (error) {
      this.state.connected = false;
      this.state.lastError = (error as Error).message;
      this.logger.error('Failed to start Slack app', error as Error);
      throw error;
    }
  }

  /**
   * 봇 중지
   */
  async stop(): Promise<void> {
    if (!this.app) return;

    this.logger.info('Stopping Slack app');

    try {
      await this.app.stop();
      this.state.connected = false;
      this.logger.info('Slack app stopped');
    } catch (error) {
      this.logger.error('Error stopping app', error as Error);
      throw error;
    }
  }

  /**
   * 메시지 전송
   */
  async send(to: string, message: SlackOutgoingMessage): Promise<void> {
    if (!this.webClient) {
      throw new Error('Slack adapter not initialized');
    }

    const channelId = to || message.channelId;
    if (!channelId) {
      throw new Error('No channel ID specified');
    }

    this.logger.debug('Sending message', { channelId, textLength: message.text.length });

    try {
      await this.webClient.chat.postMessage({
        channel: channelId,
        text: message.text,
        thread_ts: message.threadTs,
        blocks: message.blocks,
        attachments: message.attachments,
        mrkdwn: message.mrkdwn ?? true,
      });

      this.logger.debug('Message sent successfully');
    } catch (error) {
      this.logger.error('Failed to send message', error as Error);
      throw error;
    }
  }

  /**
   * 메시지 수신 핸들러 등록
   */
  onMessage(handler: (message: SlackIncomingMessage) => void | Promise<void>): void {
    this.messageHandler = handler;
    this.logger.debug('Message handler registered');
  }

  /**
   * 타이핑 표시
   */
  async sendTypingIndicator(to: string): Promise<void> {
    if (!this.webClient) return;

    try {
      await this.webClient.chat.postMessage({
        channel: to,
        text: '...',
      });
      // Slack은 typing indicator API가 없어서 대체
    } catch (error) {
      this.logger.error('Failed to send typing indicator', error as Error);
    }
  }

  /**
   * 반응 추가
   */
  async react(messageId: string, emoji: string): Promise<void> {
    if (!this.webClient) return;

    const [channelId, ts] = messageId.split(':');
    if (!channelId || !ts) {
      throw new Error('Invalid message ID format. Expected "channelId:ts"');
    }

    try {
      await this.webClient.reactions.add({
        channel: channelId,
        timestamp: ts,
        name: emoji.replace(/:/g, ''), // :emoji: -> emoji
      });
    } catch (error) {
      this.logger.error('Failed to add reaction', error as Error);
      throw error;
    }
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.state.connected;
  }

  /**
   * 현재 상태 반환
   */
  getState(): SlackAdapterState {
    return { ...this.state };
  }

  /**
   * 메시지 핸들러 설정
   */
  private setupMessageHandlers(): void {
    if (!this.app) return;

    // 일반 메시지 핸들러
    this.app.message(async ({ message, say, context }) => {
      // bot_message 필터링
      if (message.subtype === 'bot_message') return;

      await this.handleMessage(message as Record<string, unknown>);
    });

    // 멘션 핸들러
    this.app.event('app_mention', async ({ event }) => {
      await this.handleMessage(event as Record<string, unknown>);
    });

    // DM 핸들러
    this.app.event('message.im', async ({ event }) => {
      await this.handleMessage(event as Record<string, unknown>);
    });
  }

  /**
   * 메시지 처리
   */
  private async handleMessage(event: Record<string, unknown>): Promise<void> {
    const userId = String(event.user || '');
    const channelId = String(event.channel || '');
    const text = String(event.text || '');
    const ts = String(event.ts || '');

    // 봇 메시지 무시
    if (event.bot_id) return;

    // 화이트리스트 검사
    if (this.config.allowedUsers && this.config.allowedUsers.length > 0) {
      const isAllowed = this.config.allowedUsers.includes(userId);

      if (!isAllowed) {
        this.logger.warn(`Message from unauthorized user: ${userId}`);
        return;
      }
    }

    // 파일 처리
    const files: SlackIncomingMessage['files'] = [];
    if (Array.isArray(event.files)) {
      for (const file of event.files as Array<Record<string, unknown>>) {
        files.push({
          id: String(file.id || ''),
          name: String(file.name || ''),
          url: String(file.url_private || ''),
          mimetype: String(file.mimetype || ''),
          size: Number(file.size || 0),
        });
      }
    }

    // 메시지 타입 결정
    let messageType: SlackIncomingMessage['messageType'] = 'text';
    if (files.length > 0) {
      messageType = 'file';
    } else if (text.includes('```')) {
      messageType = 'code';
    }

    // 메시지 객체 생성
    const incomingMessage: SlackIncomingMessage = {
      id: `${channelId}:${ts}`,
      channel: 'slack',
      text,
      sender: {
        id: userId,
        name: String(event.user_name || userId),
      },
      timestamp: new Date(Number(event.ts || Date.now()) * 1000),
      slackTs: ts,
      channelId,
      teamId: String(event.team || ''),
      threadTs: event.thread_ts ? String(event.thread_ts) : undefined,
      messageType,
      files: files.length > 0 ? files : undefined,
      blocks: event.blocks as unknown[] | undefined,
    };

    this.logger.debug('Received message', {
      messageId: incomingMessage.id,
      from: incomingMessage.sender.name,
      type: messageType,
    });

    // 핸들러 호출
    if (this.messageHandler) {
      try {
        await this.messageHandler(incomingMessage);
      } catch (error) {
        this.logger.error('Message handler error', error as Error);
      }
    }
  }
}
