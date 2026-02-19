/**
 * Telegram 채널 어댑터
 * @description grammy 1.40.0 기반 Telegram Bot 구현
 */

import { Bot, Context, GrammyError, HttpError } from 'grammy';
import type {
  TelegramConfig,
  TelegramIncomingMessage,
  TelegramOutgoingMessage,
  TelegramAdapterState,
} from './types.js';
import { TELEGRAM_CAPABILITIES } from './types.js';
import type { IChannelAdapter, ChannelConfig } from '../types.js';
import type { ILogger } from '../../logging/index.js';

/**
 * Telegram 채널 어댑터
 */
export class TelegramAdapter implements IChannelAdapter {
  readonly id = 'telegram';
  readonly name = 'Telegram';
  readonly capabilities = TELEGRAM_CAPABILITIES;

  private bot?: Bot;
  private config: TelegramConfig;
  private logger: ILogger;
  private state: TelegramAdapterState = { connected: false };
  private messageHandler?: (message: TelegramIncomingMessage) => void | Promise<void>;

  constructor(config: ChannelConfig, logger: ILogger) {
    this.config = config as unknown as TelegramConfig;
    this.logger = logger.child('TelegramAdapter');
  }

  /**
   * 어댑터 초기화
   */
  async initialize(config: ChannelConfig): Promise<void> {
    this.config = config as unknown as TelegramConfig;
    this.logger.debug('Initializing Telegram adapter');

    // 봇 인스턴스 생성
    this.bot = new Bot(this.config.botToken);

    // 에러 핸들러 설정
    this.bot.catch((err) => {
      const ctx = err.ctx;
      this.logger.error(`Error while handling update ${ctx.update.update_id}`);

      const e = err.error;
      if (e instanceof GrammyError) {
        this.logger.error('Error in request:', new Error(e.description));
      } else if (e instanceof HttpError) {
        this.logger.error('Could not contact Telegram:', e);
      } else {
        this.logger.error('Unknown error:', e instanceof Error ? e : new Error(String(e)));
      }
    });

    // 메시지 핸들러 설정
    this.setupMessageHandlers();

    this.logger.debug('Telegram adapter initialized');
  }

  /**
   * 봇 시작
   */
  async start(): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram adapter not initialized');
    }

    this.logger.info('Starting Telegram bot');

    try {
      // 봇 토큰 검증 (getMe 호출)
      const botInfo = await this.bot.api.getMe();
      this.state.botInfo = {
        id: botInfo.id,
        username: botInfo.username,
        firstName: botInfo.first_name,
      };

      this.logger.info(`Bot authenticated: @${botInfo.username}`);

      // 폧링 시작
      if (this.config.webhookUrl) {
        // Webhook 모드
        await this.bot.api.setWebhook(this.config.webhookUrl);
        this.logger.info(`Webhook set to: ${this.config.webhookUrl}`);
      } else {
        // 폧링 모드
        this.bot.start({
          drop_pending_updates: true,
          onStart: (info) => {
            this.state.connected = true;
            this.logger.info(`Bot @${info.username} started successfully`);
          },
        });
      }

      this.state.connected = true;
    } catch (error) {
      this.state.connected = false;
      this.state.lastError = (error as Error).message;
      this.logger.error('Failed to start Telegram bot', error as Error);
      throw error;
    }
  }

  /**
   * 봇 중지
   */
  async stop(): Promise<void> {
    if (!this.bot) return;

    this.logger.info('Stopping Telegram bot');

    try {
      if (this.config.webhookUrl) {
        await this.bot.api.deleteWebhook();
      } else {
        this.bot.stop();
      }

      this.state.connected = false;
      this.logger.info('Telegram bot stopped');
    } catch (error) {
      this.logger.error('Error stopping bot', error as Error);
      throw error;
    }
  }

  /**
   * 메시지 전송
   */
  async send(to: string, message: TelegramOutgoingMessage): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram adapter not initialized');
    }

    const chatId = to || message.chatId;
    if (!chatId) {
      throw new Error('No chat ID specified');
    }

    this.logger.debug('Sending message', { chatId, textLength: message.text.length });

    try {
      await this.bot.api.sendMessage(chatId, message.text, {
        parse_mode: message.parseMode,
        reply_markup: message.replyMarkup as never,
        reply_to_message_id: message.replyToMessageId,
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
  onMessage(handler: (message: TelegramIncomingMessage) => void | Promise<void>): void {
    this.messageHandler = handler;
    this.logger.debug('Message handler registered');
  }

  /**
   * 타이핑 표시
   */
  async sendTypingIndicator(to: string): Promise<void> {
    if (!this.bot) return;

    try {
      await this.bot.api.sendChatAction(Number(to), 'typing');
    } catch (error) {
      this.logger.error('Failed to send typing indicator', error as Error);
    }
  }

  /**
   * 반응 추가
   */
  async react(messageId: string, emoji: string): Promise<void> {
    if (!this.bot) return;

    const [chatId, msgId] = messageId.split(':');
    if (!chatId || !msgId) {
      throw new Error('Invalid message ID format. Expected "chatId:messageId"');
    }

    try {
      await this.bot.api.setMessageReaction(Number(chatId), Number(msgId), [
        { type: 'emoji', emoji: emoji as unknown as never },
      ]);
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
  getState(): TelegramAdapterState {
    return { ...this.state };
  }

  /**
   * 메시지 핸들러 설정
   */
  private setupMessageHandlers(): void {
    if (!this.bot) return;

    // 텍스트 메시지 핸들러
    this.bot.on('message:text', async (ctx) => {
      await this.handleMessage(ctx, 'text');
    });

    // 사진 메시지 핸들러
    this.bot.on('message:photo', async (ctx) => {
      await this.handleMessage(ctx, 'photo');
    });

    // 문서 메시지 핸들러
    this.bot.on('message:document', async (ctx) => {
      await this.handleMessage(ctx, 'document');
    });

    // 음성 메시지 핸들러
    this.bot.on('message:voice', async (ctx) => {
      await this.handleMessage(ctx, 'voice');
    });

    // 비디오 메시지 핸들러
    this.bot.on('message:video', async (ctx) => {
      await this.handleMessage(ctx, 'video');
    });

    // 오디오 메시지 핸들러
    this.bot.on('message:audio', async (ctx) => {
      await this.handleMessage(ctx, 'audio');
    });
  }

  /**
   * 메시지 처리
   */
  private async handleMessage(ctx: Context, messageType: TelegramIncomingMessage['messageType']): Promise<void> {
    const msg = ctx.message;
    if (!msg) return;

    const userId = String(msg.from?.id);
    const username = msg.from?.username;

    // 화이트리스트 검사
    if (this.config.allowedUsers && this.config.allowedUsers.length > 0) {
      const isAllowed = this.config.allowedUsers.some(
        (allowed) => allowed === userId || allowed === username || allowed === `@${username}`
      );

      if (!isAllowed) {
        this.logger.warn(`Message from unauthorized user: ${userId} (@${username})`);
        await ctx.reply('You are not authorized to use this bot.');
        return;
      }
    }

    // 메시지 객체 생성
    const incomingMessage: TelegramIncomingMessage = {
      id: `${msg.chat.id}:${msg.message_id}`,
      channel: 'telegram',
      text: msg.text || msg.caption || '',
      sender: {
        id: userId,
        name: msg.from?.first_name || msg.from?.username || 'Unknown',
        username: msg.from?.username,
      },
      timestamp: new Date(msg.date * 1000),
      telegramMessageId: msg.message_id,
      chatId: msg.chat.id,
      from: {
        id: msg.from?.id || 0,
        username: msg.from?.username,
        firstName: msg.from?.first_name,
        lastName: msg.from?.last_name,
      },
      messageType,
      fileId: this.extractFileId(msg, messageType),
      caption: msg.caption,
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

  /**
   * 파일 ID 추출
   */
  private extractFileId(msg: NonNullable<Context['message']>, type: string): string | undefined {
    switch (type) {
      case 'photo':
        return msg.photo?.[msg.photo.length - 1]?.file_id;
      case 'document':
        return msg.document?.file_id;
      case 'voice':
        return msg.voice?.file_id;
      case 'video':
        return msg.video?.file_id;
      case 'audio':
        return msg.audio?.file_id;
      default:
        return undefined;
    }
  }
}
