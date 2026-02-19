import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { GatewayServer } from '../../src/gateway/server.js';
import { TelegramAdapter } from '../../src/channels/telegram/adapter.js';
import { AnthropicClient } from '../../src/llm/anthropic.js';
import {
  SupabaseMemoryManager,
  initializeSupabaseMemoryManager,
} from '../../src/memory/supabase/manager.js';
import { SupabaseDatabaseManager } from '../../src/memory/supabase/database.js';
import { ApprovalManager } from '../../src/tools/approval/manager.js';
import type { GatewayServerConfig } from '../../src/gateway/types.js';
import type { Logger } from '../../src/logging/types.js';
import type { TelegramConfig } from '../../src/channels/telegram/types.js';
import type { LLMClientConfig } from '../../src/llm/types.js';

/**
 * E2E Test: Normal Flow
 * onboard → gateway 시작 → Telegram 메시지 → AI 응답
 */
describe('E2E: Normal Flow', () => {
  let dbManager: SupabaseDatabaseManager;
  let memoryManager: SupabaseMemoryManager;
  let gatewayServer: GatewayServer;
  let telegramAdapter: TelegramAdapter;
  let anthropicClient: AnthropicClient;
  let approvalManager: ApprovalManager;
  let mockLogger: Logger;
  let authToken: string;

  beforeAll(async () => {
    // Mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
      setLevel: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Logger;

    // Initialize Supabase memory system
    // Note: These should be set in environment variables for actual tests
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'test-key';

    dbManager = new SupabaseDatabaseManager({
      url: supabaseUrl,
      anonKey: supabaseKey,
    });
    await dbManager.initialize();
    memoryManager = initializeSupabaseMemoryManager(dbManager);

    // Initialize approval manager
    approvalManager = new ApprovalManager(
      { mode: 'interactive' },
      mockLogger
    );

    // Initialize LLM client (mocked)
    const llmConfig: LLMClientConfig = {
      provider: 'anthropic',
      apiKey: 'test-api-key',
      defaultModel: 'claude-3-sonnet-20240229',
    };

    // Mock Anthropic client
    vi.mock('@anthropic-ai/sdk', () => ({
      default: vi.fn().mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({
            id: 'msg-123',
            content: [{ type: 'text', text: 'Hello! I received your message.' }],
            model: 'claude-3-sonnet-20240229',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        },
      })),
    }));

    anthropicClient = new AnthropicClient(llmConfig, mockLogger);

    // Initialize Telegram adapter (mocked)
    const telegramConfig: TelegramConfig = {
      id: 'telegram-test',
      name: 'Test Bot',
      enabled: true,
      botToken: 'test-bot-token',
      allowedUsers: [],
    };

    telegramAdapter = new TelegramAdapter(telegramConfig, mockLogger);
    await telegramAdapter.initialize(telegramConfig);

    // Initialize Gateway server
    const gatewayConfig: GatewayServerConfig = {
      httpPort: 28080,
      host: '127.0.0.1',
      jwtSecret: 'e2e-test-secret-key',
      tokenExpiry: 3600,
      acl: {
        allowedIPs: ['127.0.0.1'],
        blockedIPs: [],
      },
      cors: {
        origins: ['http://localhost:3000'],
      },
    };

    gatewayServer = new GatewayServer(gatewayConfig, mockLogger, {
      llmClients: [anthropicClient],
      channels: [telegramAdapter],
      approvalManager,
      memoryManager,
    });

    await gatewayServer.start();
    authToken = gatewayServer.createSessionToken(['gateway:read', 'gateway:write']);
  });

  afterAll(async () => {
    await gatewayServer.stop();
    await telegramAdapter.stop();
    await memoryManager.close();
  });

  describe('Step 1: Gateway Health Check', () => {
    it('should confirm gateway is running', async () => {
      const response = await fetch('http://127.0.0.1:28080/v1/health');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('healthy');
      expect(data.data.http).toBe(true);
    });
  });

  describe('Step 2: Authentication', () => {
    it('should authenticate with valid token', async () => {
      const response = await fetch('http://127.0.0.1:28080/v1/models', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Step 3: Channel Status', () => {
    it('should list available channels', async () => {
      const response = await fetch('http://127.0.0.1:28080/v1/channels', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.channels).toBeInstanceOf(Array);
      expect(data.data.channels.length).toBeGreaterThan(0);
    });
  });

  describe('Step 4: LLM Client Status', () => {
    it('should list available models', async () => {
      const response = await fetch('http://127.0.0.1:28080/v1/models', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.data).toBeInstanceOf(Array);
    });
  });
});
