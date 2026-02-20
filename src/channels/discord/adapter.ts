/**
 * Discord 채널 어댑터
 * @description discord.js 14.x 기반 Discord Bot 구현
 */

import { Client, GatewayIntentBits, Events, Partials, ActivityType } from 'discord.js';
import type {
  DiscordConfig,
  DiscordIncomingMessage,
  DiscordOutgoingMessage,
  DiscordAdapterState,
  DiscordAttachment,
} from './types.js';
import { DISCORD_CAPABILITIES } from './types.js';
import type { IChannelAdapter, ChannelConfig, IncomingMessage } from '../types.js';
import type { ILogger } from '../../logging/index.js';

/**
 * Discord 채널 어댑터
 */
export class DiscordAdapter implements IChannelAdapter {
  readonly id = 'discord';
  readonly name = 'Discord';
  readonly capabilities = DISCORD_CAPABILITIES;

  private client?: Client;
  private config: DiscordConfig;
  private logger: ILogger;
  private state: DiscordAdapterState = { connected: false };
  private messageHandler?: (message: DiscordIncomingMessage) => void | Promise<void>;
  private startTime?: Date;

  constructor(config: ChannelConfig, logger: ILogger) {
    this.config = config as unknown as DiscordConfig;
    this.logger = logger.child('DiscordAdapter');
  }

  /**
   * 어댑터 초기화
   */
  async initialize(config: ChannelConfig): Promise<void> {
    this.config = config as unknown as DiscordConfig;
    this.logger.debug('Initializing Discord adapter');

    // Discord 클라이언트 생성
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageTyping,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    // 에러 핸들러 설정
    this.client.on(Events.Error, (error: Error) => {
      this.logger.error('Discord client error', error);
      this.state.lastError = error.message;
    });

    this.client.on(Events.Warn, (warning: string) => {
      this.logger.warn('Discord client warning', { warning });
    });

    // 메시지 핸들러 설정
    this.setupMessageHandlers();

    this.logger.debug('Discord adapter initialized');
  }

  /**
   * 봇 시작
   */
  async start(): Promise<void> {
    if (!this.client) {
      throw new Error('Discord adapter not initialized');
    }

    this.logger.info('Starting Discord bot');

    try {
      // 봇 로그인
      await this.client.login(this.config.botToken);

      // 준비 이벤트 대기
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discord bot login timeout'));
        }, 30000);

        this.client!.once(Events.ClientReady, () => {
          clearTimeout(timeout);
          resolve();
        });

        this.client!.once(Events.Error, (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // 봇 정보 저장
      const user = this.client.user;
      if (user) {
        this.state.botInfo = {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator || '0',
          avatar: user.avatar || undefined,
        };

        // 활동 상태 설정
        if (this.config.activityMessage && this.client.user) {
          this.client.user.setActivity(this.config.activityMessage, {
            type: ActivityType.Playing,
          });
        }
      }

      // 서버(길드) 정보 저장
      this.state.guilds = this.client.guilds.cache.map((guild: { id: string; name: string; memberCount: number }) => ({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
      }));

      this.state.connected = true;
      this.startTime = new Date();

      const botInfo = this.state.botInfo;
      if (botInfo) {
        this.logger.info(`Bot logged in as ${botInfo.username}#${botInfo.discriminator}`);
      }
      this.logger.info(`Connected to ${this.state.guilds.length} guild(s)`);
    } catch (error) {
      this.state.connected = false;
      this.state.lastError = (error as Error).message;
      this.logger.error('Failed to start Discord bot', error as Error);
      throw error;
    }
  }

  /**
   * 봇 중지
   */
  async stop(): Promise<void> {
    if (!this.client) return;

    this.logger.info('Stopping Discord bot');

    try {
      await this.client.destroy();
      this.state.connected = false;
      this.state.guilds = [];
      this.logger.info('Discord bot stopped');
    } catch (error) {
      this.logger.error('Error stopping bot', error as Error);
      throw error;
    }
  }

  /**
   * 메시지 전송
   */
  async send(to: string, message: DiscordOutgoingMessage): Promise<void> {
    if (!this.client) {
      throw new Error('Discord adapter not initialized');
    }

    const channelId = to || message.channelId;
    if (!channelId) {
      throw new Error('No channel ID specified');
    }

    this.logger.debug('Sending message', { channelId, textLength: message.text.length });

    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      if (!channel.isTextBased()) {
        throw new Error(`Channel is not text-based: ${channelId}`);
      }

      // 메시지 옵션 구성
      const messageOptions: {
        content: string;
        embeds?: DiscordOutgoingMessage['embeds'];
        components?: DiscordOutgoingMessage['components'];
        reply?: { messageReference: string };
        allowedMentions?: DiscordOutgoingMessage['allowedMentions'];
        tts?: boolean;
      } = {
        content: message.text,
      };

      if (message.embeds?.length) {
        messageOptions.embeds = message.embeds;
      }

      if (message.components?.length) {
        messageOptions.components = message.components;
      }

      if (message.replyToMessageId) {
        messageOptions.reply = { messageReference: message.replyToMessageId };
      }

      if (message.allowedMentions) {
        messageOptions.allowedMentions = message.allowedMentions;
      }

      if (message.tts) {
        messageOptions.tts = message.tts;
      }

      // TextBased 채널에 메시지 전송 (TextChannel, DMChannel 등)
      // send 메서드가 있는 채널 타입으로 캐스팅
      await (channel as import('discord.js').TextChannel | import('discord.js').DMChannel | import('discord.js').NewsChannel | import('discord.js').ThreadChannel).send(messageOptions);

      this.logger.debug('Message sent successfully');
    } catch (error) {
      this.logger.error('Failed to send message', error as Error);
      throw error;
    }
  }

  /**
   * 메시지 수신 핸들러 등록
   */
  onMessage(handler: (message: IncomingMessage) => void | Promise<void>): void {
    this.messageHandler = handler as (message: DiscordIncomingMessage) => void | Promise<void>;
    this.logger.debug('Message handler registered');
  }

  /**
   * 타이핑 표시
   */
  async sendTypingIndicator(to: string): Promise<void> {
    if (!this.client) return;

    try {
      const channel = await this.client.channels.fetch(to);

      if (!channel) {
        throw new Error(`Channel not found: ${to}`);
      }

      if (channel.isTextBased() && 'sendTyping' in channel) {
        await channel.sendTyping();
      }
    } catch (error) {
      this.logger.error('Failed to send typing indicator', error as Error);
    }
  }

  /**
   * 반응 추가
   */
  async react(messageId: string, emoji: string): Promise<void> {
    if (!this.client) return;

    const [channelId, msgId] = messageId.split(':');
    if (!channelId || !msgId) {
      throw new Error('Invalid message ID format. Expected "channelId:messageId"');
    }

    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Text channel not found: ${channelId}`);
      }

      const message = await channel.messages.fetch(msgId);
      await message.react(emoji);
    } catch (error) {
      this.logger.error('Failed to add reaction', error as Error);
      throw error;
    }
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.state.connected && this.client?.isReady() === true;
  }

  /**
   * 현재 상태 반환
   */
  getState(): DiscordAdapterState {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : undefined;
    return {
      ...this.state,
      uptime,
    };
  }

  /**
   * 메시지 핸들러 설정
   */
  private setupMessageHandlers(): void {
    if (!this.client) return;

    // 메시지 생성 이벤트
    this.client.on(Events.MessageCreate, async (message) => {
      await this.handleMessage(message);
    });
  }

  /**
   * 메시지 처리
   */
  private async handleMessage(message: import('discord.js').Message<boolean>): Promise<void> {
    // 봇 메시지 무시
    if (message.author.bot) return;

    // 메시지 수신 로그
    // eslint-disable-next-line no-console
    console.log(`[DISCORD] Message received: "${message.content.substring(0, 50)}" from ${message.author.username} (${message.author.id})`);
    this.logger.info(`[DISCORD] Message received from ${message.author.username}`);

    const userId = message.author.id;
    const channelId = message.channelId;
    const guildId = message.guildId || undefined;

    // eslint-disable-next-line no-console
    console.log(`[DISCORD] Whitelist check: userId=${userId}, channelId=${channelId}, guildId=${guildId}`);
    // eslint-disable-next-line no-console
    console.log(`[DISCORD] Config allowedUsers:`, this.config.allowedUsers);
    // eslint-disable-next-line no-console
    console.log(`[DISCORD] Config allowedGuilds:`, this.config.allowedGuilds);

    // 화이트리스트 검사
    if (this.config.allowedUsers && this.config.allowedUsers.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[DISCORD] Checking allowedUsers: ${userId} in [${this.config.allowedUsers.join(', ')}]`);
      if (!this.config.allowedUsers.includes(userId)) {
        // eslint-disable-next-line no-console
        console.log(`[DISCORD] BLOCKED: User ${userId} not in allowedUsers`);
        this.logger.warn(`Message from unauthorized user: ${userId} (${message.author.username})`);
        return;
      }
      // eslint-disable-next-line no-console
      console.log(`[DISCORD] User ${userId} passed allowedUsers check`);
    }

    // 채널 화이트리스트 검사
    if (this.config.allowedChannels && this.config.allowedChannels.length > 0) {
      if (!this.config.allowedChannels.includes(channelId)) {
        this.logger.warn(`Message from unauthorized channel: ${channelId}`);
        return;
      }
    }

    // 서버(길드) 화이트리스트 검사
    if (guildId && this.config.allowedGuilds && this.config.allowedGuilds.length > 0) {
      if (!this.config.allowedGuilds.includes(guildId)) {
        this.logger.warn(`Message from unauthorized guild: ${guildId}`);
        return;
      }
    }

    // DM 허용 여부 검사
    const isDM = message.channel.isDMBased();
    if (isDM && this.config.allowDMs === false) {
      this.logger.warn('DM received but DMs are disabled');
      return;
    }

    // 메시지 타입 결정
    let messageType: DiscordIncomingMessage['messageType'] = 'text';
    if (isDM) {
      messageType = 'dm';
    } else if (message.mentions.has(this.client!.user!.id)) {
      messageType = 'mention';
    } else if (message.reference) {
      messageType = 'reply';
    } else if (message.attachments.size > 0) {
      const firstAttachment = message.attachments.first();
      if (firstAttachment?.contentType?.startsWith('image/')) {
        messageType = 'image';
      } else {
        messageType = 'file';
      }
    }

    // 첨부 파일 처리
    const attachments: DiscordAttachment[] = [];
    message.attachments.forEach((attachment: import('discord.js').Attachment) => {
      // MIME 타입에 따라 파일 타입 결정
      let type: 'image' | 'audio' | 'video' | 'document' = 'document';
      if (attachment.contentType) {
        if (attachment.contentType.startsWith('image/')) type = 'image';
        else if (attachment.contentType.startsWith('audio/')) type = 'audio';
        else if (attachment.contentType.startsWith('video/')) type = 'video';
      }

      attachments.push({
        id: attachment.id,
        name: attachment.name,
        url: attachment.url,
        size: attachment.size,
        contentType: attachment.contentType || undefined,
        description: attachment.description || undefined,
        type,
      });
    });

    // 메시지 객체 생성
    const incomingMessage: DiscordIncomingMessage = {
      id: `${channelId}:${message.id}`,
      channel: 'discord',
      text: message.content,
      sender: {
        id: userId,
        name: message.author.displayName || message.author.username,
        username: message.author.username,
      },
      timestamp: message.createdAt,
      discordMessageId: message.id,
      channelId,
      guildId,
      from: {
        id: userId,
        username: message.author.username,
        discriminator: message.author.discriminator || '0',
        displayName: message.author.displayName,
        avatar: message.author.avatar || undefined,
        bot: message.author.bot,
      },
      messageType,
      attachments: attachments.length > 0 ? attachments : undefined,
      mentions: message.mentions.users.map((user: import('discord.js').User) => user.id),
      referenceMessageId: message.reference?.messageId || undefined,
      embeds: message.embeds.length > 0 ? message.embeds : undefined,
    };

    this.logger.debug('Received message', {
      messageId: incomingMessage.id,
      from: incomingMessage.sender.name,
      type: messageType,
      channel: channelId,
    });

    // 핸들러 호출
    // eslint-disable-next-line no-console
    console.log(`[DISCORD] Calling message handler, handler exists: ${!!this.messageHandler}`);
    if (this.messageHandler) {
      try {
        await this.messageHandler(incomingMessage);
        // eslint-disable-next-line no-console
        console.log('[DISCORD] Message handler completed');
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[DISCORD] Message handler error:', (error as Error).message);
        this.logger.error('Message handler error', error as Error);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('[DISCORD] No message handler registered!');
    }
  }
}
