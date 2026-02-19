import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TelegramAdapter } from '../../../src/channels/telegram/adapter.js';
import { TELEGRAM_CAPABILITIES } from '../../../src/channels/telegram/types.js';
import type { TelegramConfig, TelegramIncomingMessage } from '../../../src/channels/telegram/types.js';
import type { Logger } from '../../../src/logging/types.js';

// grammy 모킹
vi.mock('grammy', () => ({
  Bot: vi.fn().mockImplementation(() => ({
    api: {
      getMe: vi.fn().mockResolvedValue({
        id: 12345,
        username: 'testbot',
        first_name: 'Test Bot',
      }),
      sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
      sendChatAction: vi.fn().mockResolvedValue(true),
      setMessageReaction: vi.fn().mockResolvedValue(true),
      setWebhook: vi.fn().mockResolvedValue(true),
      deleteWebhook: vi.fn().mockResolvedValue(true),
    },
    start: vi.fn().mockImplementation(({ onStart }) => {
      onStart?.({ username: 'testbot' });
    }),
    stop: vi.fn(),
    catch: vi.fn(),
    on: vi.fn(),
  })),
  GrammyError: class GrammyError extends Error {
    constructor(public description: string) {
      super(description);
    }
  },
  HttpError: class HttpError extends Error {},
}));

describe('TelegramAdapter', () => {
  let adapter: TelegramAdapter;
  let mockLogger: Logger;
  let config: TelegramConfig;

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
      id: 'telegram-test',
      name: 'Test Telegram Bot',
      enabled: true,
      botToken: 'test-token',
      allowedUsers: [],
    };

    adapter = new TelegramAdapter(config, mockLogger);
  });

  describe('기본 속성', () => {
    it('올바른 ID를 가져야 함', () => {
      expect(adapter.id).toBe('telegram');
    });

    it('올바른 이름을 가져야 함', () => {
      expect(adapter.name).toBe('Telegram');
    });

    it('올바른 기능을 가져야 함', () => {
      expect(adapter.capabilities).toEqual(TELEGRAM_CAPABILITIES);
      expect(adapter.capabilities.text).toBe(true);
      expect(adapter.capabilities.images).toBe(true);
      expect(adapter.capabilities.reactions).toBe(true);
    });
  });

  describe('initialize', () => {
    it('어댑터를 초기화해야 함', async () => {
      await adapter.initialize(config);
      expect(mockLogger.debug).toHaveBeenCalledWith('Initializing Telegram adapter');
    });
  });

  describe('start/stop', () => {
    it('봇을 시작해야 함', async () => {
      await adapter.initialize(config);
      await adapter.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Starting Telegram bot');
      expect(adapter.isConnected()).toBe(true);
    });

    it('봇을 중지해야 함', async () => {
      await adapter.initialize(config);
      await adapter.start();
      await adapter.stop();

      expect(mockLogger.info).toHaveBeenCalledWith('Stopping Telegram bot');
      expect(adapter.isConnected()).toBe(false);
    });

    it('초기화되지 않은 상태에서 시작하면 에러를 발생해야 함', async () => {
      await expect(adapter.start()).rejects.toThrow('Telegram adapter not initialized');
    });
  });

  describe('send', () => {
    it('메시지를 전송해야 함', async () => {
      await adapter.initialize(config);

      await adapter.send('123456', {
        text: 'Hello!',
        chatId: '123456',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Sending message',
        expect.any(Object)
      );
    });

    it('chatId가 없으면 에러를 발생해야 함', async () => {
      await adapter.initialize(config);

      await expect(
        adapter.send('', { text: 'Hello!' })
      ).rejects.toThrow('No chat ID specified');
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

    it('시작 후 연결 상태여야 함', async () => {
      await adapter.initialize(config);
      await adapter.start();
      expect(adapter.isConnected()).toBe(true);
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
