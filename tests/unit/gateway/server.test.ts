import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { GatewayServer } from '../../../src/gateway/server.js';
import type { GatewayServerConfig } from '../../../src/gateway/types.js';
import type { Logger } from '../../../src/logging/types.js';
import type { ILLMClient } from '../../../src/llm/types.js';
import type { IChannelAdapter } from '../../../src/channels/types.js';

// supertest 대신 fetch 사용
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GatewayServer', () => {
  let server: GatewayServer;
  let mockLogger: Logger;
  let config: GatewayServerConfig;
  let mockLLMClient: ILLMClient;
  let mockChannel: IChannelAdapter;

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
      httpPort: 0, // 랜덤 포트
      host: '127.0.0.1',
      jwtSecret: 'test-secret-key-for-testing-only',
      tokenExpiry: 3600,
      acl: {
        allowedIPs: ['127.0.0.1', '::1'],
        blockedIPs: [],
      },
      cors: {
        origins: ['http://localhost:3000'],
      },
    };

    mockLLMClient = {
      id: 'test-client',
      provider: 'anthropic',
      config: {
        provider: 'anthropic',
        apiKey: 'test-key',
      },
      complete: vi.fn(),
      stream: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true, latency: 100, lastChecked: new Date() }),
      listModels: vi.fn().mockResolvedValue(['claude-3-sonnet']),
      validateKey: vi.fn().mockResolvedValue(true),
    } as unknown as ILLMClient;

    mockChannel = {
      id: 'telegram',
      name: 'Telegram',
      capabilities: {
        text: true,
        images: true,
        audio: false,
        video: false,
        documents: false,
        reactions: true,
        threads: false,
        typing: true,
        readReceipts: false,
      },
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      send: vi.fn().mockResolvedValue(undefined),
      onMessage: vi.fn(),
      sendTypingIndicator: vi.fn().mockResolvedValue(undefined),
      react: vi.fn().mockResolvedValue(undefined),
    } as unknown as IChannelAdapter;

    server = new GatewayServer(config, mockLogger, {
      llmClients: [mockLLMClient],
      channels: [mockChannel],
    });
  });

  afterEach(async () => {
    await server.stop();
    vi.clearAllMocks();
  });

  describe('기본 동작', () => {
    it('서버를 생성해야 함', () => {
      expect(server).toBeDefined();
    });

    it('세션 토큰을 생성해야 함', () => {
      const token = server.createSessionToken(['read', 'write']);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('연결 수를 반환해야 함', () => {
      const count = server.getConnectionCount();
      expect(typeof count).toBe('number');
      expect(count).toBe(0);
    });
  });

  describe('start/stop', () => {
    it('서버를 시작해야 함', async () => {
      await server.start();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('HTTP server started')
      );
    });

    it('서버를 중지해야 함', async () => {
      await server.start();
      await server.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('HTTP server stopped');
    });
  });

  describe('createSessionToken', () => {
    it('기본 권한으로 토큰을 생성해야 함', () => {
      const token = server.createSessionToken();
      expect(token).toBeDefined();
    });

    it('커스텀 권한으로 토큰을 생성해야 함', () => {
      const token = server.createSessionToken(['admin', 'gateway:write']);
      expect(token).toBeDefined();
    });
  });
});
