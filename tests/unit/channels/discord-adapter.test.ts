import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscordAdapter } from '../../../src/channels/discord/adapter.js';
import { DISCORD_CAPABILITIES } from '../../../src/channels/discord/types.js';
import type { DiscordConfig, DiscordIncomingMessage } from '../../../src/channels/discord/types.js';
import type { Logger } from '../../../src/logging/types.js';

// discord.js 모킹
vi.mock('discord.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    user: { tag: 'TestBot#1234', id: '123456789' },
    login: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    on: vi.fn().mockImplementation((event, handler) => {
      if (event === 'ready') {
        setTimeout(() => handler(), 10);
      }
      if (event === 'messageCreate') {
        // 메시지 핸들러 저장
      }
    }),
    once: vi.fn().mockImplementation((event, handler) => {
      if (event === 'ready') {
        setTimeout(() => handler(), 10);
      }
    }),
    off: vi.fn(),
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 3,
    GuildMessageReactions: 4,
    DirectMessages: 5,
    DirectMessageReactions: 6,
  },
  Partials: {
    Channel: 0,
    Message: 1,
    Reaction: 2,
  },
  Events: {
    Ready: 'ready',
    MessageCreate: 'messageCreate',
    InteractionCreate: 'interactionCreate',
    Error: 'error',
  },
  MessageFlags: {
    SuppressEmbeds: 4,
  },
}));

describe('DiscordAdapter', () => {
  let adapter: DiscordAdapter;
  let mockLogger: Logger;
  let config: DiscordConfig;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
      setLevel: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Logger;

    config = {
      id: 'discord-test',
      name: 'Test Discord Bot',
      enabled: true,
      botToken: 'test-token',
      allowedUsers: [],
    };

    adapter = new DiscordAdapter(config, mockLogger);
  });

  describe('기본 속성', () => {
    it('올바른 ID를 가져야 함', () => {
      expect(adapter.id).toBe('discord');
    });

    it('올바른 이름을 가져야 함', () => {
      expect(adapter.name).toBe('Discord');
    });

    it('올바른 기능을 가져야 함', () => {
      expect(adapter.capabilities).toEqual(DISCORD_CAPABILITIES);
      expect(adapter.capabilities.text).toBe(true);
      expect(adapter.capabilities.images).toBe(true);
      expect(adapter.capabilities.reactions).toBe(true);
      expect(adapter.capabilities.threads).toBe(true);
    });
  });

  describe('initialize', () => {
    it('어댑터를 초기화해야 함', async () => {
      await adapter.initialize(config);
      expect(mockLogger.debug).toHaveBeenCalledWith('Initializing Discord adapter');
    });
  });

  describe('start/stop', () => {
    it('봇을 시작해야 함', async () => {
      await adapter.initialize(config);
      await adapter.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Starting Discord bot');
    });

    it('봇을 중지해야 함', async () => {
      await adapter.initialize(config);
      await adapter.start();
      await adapter.stop();

      expect(mockLogger.info).toHaveBeenCalledWith('Stopping Discord bot');
      expect(adapter.isConnected()).toBe(false);
    });

    it('초기화되지 않은 상태에서 시작하면 에러를 발생해야 함', async () => {
      await expect(adapter.start()).rejects.toThrow('Discord adapter not initialized');
    });
  });

  describe('send', () => {
    it('메시지를 전송해야 함', async () => {
      await adapter.initialize(config);

      await adapter.send('123456', {
        text: 'Hello!',
        channelId: '123456',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Sending message',
        expect.any(Object)
      );
    });

    it('channelId가 없으면 에러를 발생해야 함', async () => {
      await adapter.initialize(config);

      await expect(
        adapter.send('', { text: 'Hello!' })
      ).rejects.toThrow('No channel ID specified');
    });
  });

  describe('onMessage', () => {
    it('메시지 핸들러를 등록해야 함', async () => {
      await adapter.initialize(config);

      const handler = vi.fn();
      adapter.onMessage(handler);

      expect(mockLogger.debug).toHaveBeenCalledWith('Message handler registered');
    });
  });

  describe('sendTypingIndicator', () => {
    it('타이핑 표시를 전송해야 함', async () => {
      await adapter.initialize(config);
      await adapter.start();

      await adapter.sendTypingIndicator('123456');

      // 에러가 발생하지 않아야 함
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('react', () => {
    it('반응을 추가해야 함', async () => {
      await adapter.initialize(config);
      await adapter.start();

      await adapter.react('123456:789', '👍');

      // 에러가 발생하지 않아야 함
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('잘못된 메시지 ID 형식이면 에러를 발생해야 함', async () => {
      await adapter.initialize(config);

      await expect(adapter.react('invalid-id', '👍')).rejects.toThrow(
        'Invalid message ID format'
      );
    });
  });

  describe('isConnected', () => {
    it('초기에는 연결되지 않아야 함', () => {
      expect(adapter.isConnected()).toBe(false);
    });

    it.skip('시작 후 연결 상태여야 함', async () => {
      // TODO: discord.js 모킹 개선 필요
      await adapter.initialize(config);
      await adapter.start();
    });
  });

  describe('getState', () => {
    it('상태를 반환해야 함', async () => {
      await adapter.initialize(config);

      const state = (adapter as any).getState();
      expect(state).toHaveProperty('connected');
    });
  });
});
