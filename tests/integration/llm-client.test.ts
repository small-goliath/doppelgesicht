import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnthropicClient } from '../../src/llm/anthropic.js';
import { MoonshotClient } from '../../src/llm/moonshot.js';
import type { Logger } from '../../src/logging/types.js';
import type { LLMClientConfig, ChatMessage } from '../../src/llm/types.js';

// Anthropic SDK 모킹
const mockCreate = vi.fn();
const mockStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
  APIError: class APIError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  },
}));

// OpenAI SDK 모킹 (Moonshot용)
const mockMoonshotCreate = vi.fn();
const mockMoonshotList = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockMoonshotCreate,
      },
    },
    models: {
      list: mockMoonshotList,
    },
  })),
  APIError: class APIError extends Error {
    status?: number;
    code?: string;
    type?: string;
    constructor(message: string, status?: number, code?: string, type?: string) {
      super(message);
      this.status = status;
      this.code = code;
      this.type = type;
      this.name = 'APIError';
    }
  },
}));

describe('LLM Client Integration', () => {
  let mockLogger: Logger;
  let config: LLMClientConfig;

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
      provider: 'anthropic',
      apiKey: 'test-api-key',
      defaultModel: 'claude-3-sonnet-20240229',
      timeout: 60000,
      maxRetries: 3,
    };

    vi.clearAllMocks();
  });

  describe('Multi-Provider Support', () => {
    it('should support multiple LLM providers including moonshot', () => {
      const anthropicConfig: LLMClientConfig = {
        provider: 'anthropic',
        apiKey: 'anthropic-key',
        defaultModel: 'claude-3-sonnet-20240229',
      };

      const moonshotConfig: LLMClientConfig = {
        provider: 'moonshot',
        apiKey: 'moonshot-key',
        defaultModel: 'moonshot-v1-8k',
      };

      const anthropicClient = new AnthropicClient(anthropicConfig, mockLogger);
      const moonshotClient = new MoonshotClient(moonshotConfig, mockLogger);

      expect(anthropicClient.provider).toBe('anthropic');
      expect(moonshotClient.provider).toBe('moonshot');
    });

    it('should handle fallback between providers', async () => {
      // Anthropic 실패
      mockCreate.mockRejectedValueOnce(new Error('Anthropic failed'));

      // Moonshot 성공
      mockMoonshotCreate.mockResolvedValueOnce({
        id: 'fallback-moonshot',
        choices: [{
          message: { role: 'assistant', content: 'Fallback response from Moonshot' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'moonshot-v1-8k',
      });

      const anthropicClient = new AnthropicClient(config, mockLogger);
      const moonshotClient = new MoonshotClient({
        provider: 'moonshot',
        apiKey: 'moonshot-key',
        defaultModel: 'moonshot-v1-8k',
      }, mockLogger);

      // Fallback 체인 시뮬레이션
      let response;
      const providers = [
        { client: anthropicClient, name: 'anthropic' },
        { client: moonshotClient, name: 'moonshot' },
      ];

      for (const provider of providers) {
        try {
          response = await provider.client.complete({
            model: provider.name === 'anthropic' ? 'claude-3-sonnet-20240229' : 'moonshot-v1-8k',
            messages: [{ role: 'user', content: 'Test' }],
          });
          break;
        } catch {
          continue;
        }
      }

      expect(response).toBeDefined();
      expect(response!.message.content).toBe('Fallback response from Moonshot');
    });
  });

  describe('AnthropicClient', () => {
    it('should initialize with correct config', () => {
      const client = new AnthropicClient(config, mockLogger);

      expect(client.id).toBeDefined();
      expect(client.provider).toBe('anthropic');
      expect(client.config).toEqual(expect.objectContaining({
        provider: 'anthropic',
        apiKey: 'test-api-key',
      }));
    });

    it('should complete a chat request', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'msg-123',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      });

      const client = new AnthropicClient(config, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello!' },
      ];

      const response = await client.complete({
        model: 'claude-3-sonnet-20240229',
        messages,
        max_tokens: 100,
      });

      expect(response.id).toBe('msg-123');
      expect(response.message.content).toBe('Hello!');
      expect(response.usage.input_tokens).toBe(10);
      expect(response.usage.output_tokens).toBe(5);
    });

    it('should handle tool calls in response', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'msg-456',
        content: [
          { type: 'text', text: 'Let me check the weather.' },
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'get_weather',
            input: { location: 'Seoul' },
          },
        ],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'tool_use',
        usage: {
          input_tokens: 20,
          output_tokens: 15,
        },
      });

      const client = new AnthropicClient(config, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: 'What is the weather in Seoul?' },
      ];

      const response = await client.complete({
        model: 'claude-3-sonnet-20240229',
        messages,
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
                required: ['location'],
              },
            },
          },
        ],
      });

      expect(response.message.tool_calls).toBeDefined();
      expect(response.message.tool_calls).toHaveLength(1);
      expect(response.message.tool_calls![0].function.name).toBe('get_weather');
      expect(response.stop_reason).toBe('tool_use');
    });

    it('should stream responses', async () => {
      const mockStreamGenerator = async function* () {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } };
        yield { type: 'content_block_stop' };
      };

      mockCreate.mockResolvedValueOnce(mockStreamGenerator());

      const client = new AnthropicClient(config, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Say hello' },
      ];

      const chunks = [];
      for await (const chunk of client.stream({
        model: 'claude-3-sonnet-20240229',
        messages,
        stream: true,
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle API errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const client = new AnthropicClient(config, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      await expect(
        client.complete({
          model: 'claude-3-sonnet-20240229',
          messages,
        })
      ).rejects.toThrow('API Error');
    });

    it('should perform health check', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'health-check',
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      const client = new AnthropicClient(config, mockLogger);
      const health = await client.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });

    it('should list available models', async () => {
      const client = new AnthropicClient(config, mockLogger);
      const models = await client.listModels();

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('claude-3-sonnet-20240229');
    });

    it('should validate API key', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'validation',
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      const client = new AnthropicClient(config, mockLogger);
      const isValid = await client.validateKey();

      expect(isValid).toBe(true);
    });
  });

  describe('MoonshotClient', () => {
    let moonshotConfig: LLMClientConfig;

    beforeEach(() => {
      moonshotConfig = {
        provider: 'moonshot',
        apiKey: 'test-moonshot-key',
        defaultModel: 'moonshot-v1-8k',
        timeout: 60000,
        maxRetries: 3,
      };
    });

    it('should initialize with correct config', () => {
      const client = new MoonshotClient(moonshotConfig, mockLogger);

      expect(client.id).toBeDefined();
      expect(client.provider).toBe('moonshot');
      expect(client.config).toEqual(expect.objectContaining({
        provider: 'moonshot',
        apiKey: 'test-moonshot-key',
      }));
    });

    it('should complete a chat request', async () => {
      mockMoonshotCreate.mockResolvedValueOnce({
        id: 'msg-moonshot-123',
        choices: [{
          message: { role: 'assistant', content: 'Hello from Moonshot!' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'moonshot-v1-8k',
      });

      const client = new MoonshotClient(moonshotConfig, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello!' },
      ];

      const response = await client.complete({
        model: 'moonshot-v1-8k',
        messages,
        max_tokens: 100,
      });

      expect(response.id).toBe('msg-moonshot-123');
      expect(response.message.content).toBe('Hello from Moonshot!');
      expect(response.usage.input_tokens).toBe(10);
      expect(response.usage.output_tokens).toBe(5);
    });

    it('should handle tool calls in response', async () => {
      mockMoonshotCreate.mockResolvedValueOnce({
        id: 'msg-moonshot-456',
        choices: [{
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'tool-1',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"location": "Seoul"}' },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
        model: 'moonshot-v1-8k',
      });

      const client = new MoonshotClient(moonshotConfig, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: 'What is the weather in Seoul?' },
      ];

      const response = await client.complete({
        model: 'moonshot-v1-8k',
        messages,
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information',
              parameters: {
                type: 'object',
                properties: { location: { type: 'string' } },
                required: ['location'],
              },
            },
          },
        ],
      });

      expect(response.message.tool_calls).toBeDefined();
      expect(response.message.tool_calls).toHaveLength(1);
      expect(response.message.tool_calls![0].function.name).toBe('get_weather');
      expect(response.stop_reason).toBe('tool_use');
    });

    it('should stream responses', async () => {
      const mockStreamGenerator = async function* () {
        yield { id: 'chunk-1', choices: [{ delta: { content: 'Hello' } }] };
        yield { id: 'chunk-2', choices: [{ delta: { content: ' from' } }] };
        yield { id: 'chunk-3', choices: [{ delta: { content: ' Moonshot' } }] };
      };

      mockMoonshotCreate.mockResolvedValueOnce(mockStreamGenerator());

      const client = new MoonshotClient(moonshotConfig, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Say hello' },
      ];

      const chunks = [];
      for await (const chunk of client.stream({
        model: 'moonshot-v1-8k',
        messages,
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBe('Hello');
      expect(chunks[1].content).toBe(' from');
      expect(chunks[2].content).toBe(' Moonshot');
    });

    it('should handle API errors', async () => {
      mockMoonshotCreate.mockRejectedValueOnce(new Error('Moonshot API Error'));

      const client = new MoonshotClient(moonshotConfig, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      await expect(
        client.complete({
          model: 'moonshot-v1-8k',
          messages,
        })
      ).rejects.toThrow('Moonshot API Error');
    });

    it('should perform health check', async () => {
      mockMoonshotList.mockResolvedValueOnce({
        data: [{ id: 'moonshot-v1-8k' }],
      });

      const client = new MoonshotClient(moonshotConfig, mockLogger);
      const health = await client.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });

    it('should list available models', async () => {
      mockMoonshotList.mockResolvedValueOnce({
        data: [
          { id: 'moonshot-v1-8k' },
          { id: 'moonshot-v1-32k' },
          { id: 'moonshot-v1-128k' },
        ],
      });

      const client = new MoonshotClient(moonshotConfig, mockLogger);
      const models = await client.listModels();

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(3);
      expect(models).toContain('moonshot-v1-8k');
      expect(models).toContain('moonshot-v1-32k');
      expect(models).toContain('moonshot-v1-128k');
    });

    it('should validate API key', async () => {
      mockMoonshotList.mockResolvedValueOnce({
        data: [{ id: 'moonshot-v1-8k' }],
      });

      const client = new MoonshotClient(moonshotConfig, mockLogger);
      const isValid = await client.validateKey();

      expect(isValid).toBe(true);
    });
  });
});
