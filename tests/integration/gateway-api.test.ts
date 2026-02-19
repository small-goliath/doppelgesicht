import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GatewayServer } from '../../src/gateway/server.js';
import type { GatewayServerConfig } from '../../src/gateway/types.js';
import type { Logger } from '../../src/logging/types.js';
import type { ILLMClient } from '../../src/llm/types.js';
import type { IChannelAdapter } from '../../src/channels/types.js';

describe('Gateway API Integration', () => {
  let server: GatewayServer;
  let mockLogger: Logger;
  let config: GatewayServerConfig;
  let mockLLMClient: ILLMClient;
  let mockChannel: IChannelAdapter;
  let authToken: string;

  beforeAll(async () => {
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
      httpPort: 18080,
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
      complete: vi.fn().mockResolvedValue({
        id: 'resp-1',
        message: {
          role: 'assistant',
          content: 'Test response',
        },
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
        },
        model: 'claude-3-sonnet',
        stop_reason: 'end_turn',
      }),
      stream: vi.fn().mockImplementation(async function* () {
        yield {
          id: 'chunk-1',
          content: 'Test',
          done: false,
        };
        yield {
          id: 'chunk-2',
          content: ' response',
          done: true,
        };
      }),
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

    await server.start();
    authToken = server.createSessionToken(['gateway:read', 'gateway:write']);
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return healthy status without authentication', async () => {
      const response = await fetch(`http://127.0.0.1:18080/v1/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('healthy');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const response = await fetch(`http://127.0.0.1:18080/v1/models`);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should accept requests with valid token', async () => {
      const response = await fetch(`http://127.0.0.1:18080/v1/models`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Models API', () => {
    it('should return list of models', async () => {
      const response = await fetch(`http://127.0.0.1:18080/v1/models`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.data).toBeInstanceOf(Array);
      expect(data.data.data.length).toBeGreaterThan(0);
    });
  });

  describe('Chat Completions API', () => {
    it('should return 400 for invalid request', async () => {
      const response = await fetch(`http://127.0.0.1:18080/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_REQUEST');
    });
  });

  describe('Channels API', () => {
    it('should return list of channels', async () => {
      const response = await fetch(`http://127.0.0.1:18080/v1/channels`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.channels).toBeInstanceOf(Array);
    });

    it('should return 400 for invalid channel send request', async () => {
      const response = await fetch(`http://127.0.0.1:18080/v1/channels/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_REQUEST');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await fetch(`http://127.0.0.1:18080/v1/unknown`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });
});
