import { describe, it, expect } from 'vitest';
import type {
  ChatMessage,
  ToolCall,
  ToolDefinition,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
  HealthStatus,
} from '../../../src/llm/types.js';

describe('LLM Types', () => {
  describe('ChatMessage', () => {
    it('유효한 채팅 메시지를 생성해야 함', () => {
      const message: ChatMessage = {
        role: 'user',
        content: 'Hello, AI!',
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, AI!');
    });

    it('tool_calls를 포함한 메시지를 생성해야 함', () => {
      const message: ChatMessage = {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location": "Seoul"}',
            },
          },
        ],
      };

      expect(message.tool_calls).toHaveLength(1);
      expect(message.tool_calls?.[0].function.name).toBe('get_weather');
    });

    it('tool 응답 메시지를 생성해야 함', () => {
      const message: ChatMessage = {
        role: 'tool',
        content: '{"temperature": 25}',
        tool_call_id: 'call-1',
      };

      expect(message.role).toBe('tool');
      expect(message.tool_call_id).toBe('call-1');
    });
  });

  describe('ToolDefinition', () => {
    it('유효한 도구 정의를 생성해야 함', () => {
      const tool: ToolDefinition = {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather information for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'City name',
              },
            },
            required: ['location'],
          },
        },
      };

      expect(tool.type).toBe('function');
      expect(tool.function.name).toBe('get_weather');
      expect(tool.function.parameters.required).toContain('location');
    });
  });

  describe('LLMRequestOptions', () => {
    it('유효한 요청 옵션을 생성해야 함', () => {
      const options: LLMRequestOptions = {
        model: 'claude-3-sonnet-20240229',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      };

      expect(options.model).toBe('claude-3-sonnet-20240229');
      expect(options.messages).toHaveLength(1);
      expect(options.temperature).toBe(0.7);
    });

    it('도구를 포함한 요청 옵션을 생성해야 함', () => {
      const options: LLMRequestOptions = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather',
              parameters: {
                type: 'object',
                properties: {},
              },
            },
          },
        ],
      };

      expect(options.tools).toHaveLength(1);
    });
  });

  describe('LLMResponse', () => {
    it('유효한 응답을 생성해야 함', () => {
      const usage: TokenUsage = {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      };

      const response: LLMResponse = {
        id: 'resp-123',
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you?',
        },
        usage,
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
      };

      expect(response.id).toBe('resp-123');
      expect(response.message.content).toBe('Hello! How can I help you?');
      expect(response.usage.total_tokens).toBe(30);
      expect(response.stop_reason).toBe('end_turn');
    });
  });

  describe('LLMStreamChunk', () => {
    it('유효한 스트림 청크를 생성해야 함', () => {
      const chunk: LLMStreamChunk = {
        id: 'chunk-1',
        content: 'Hello',
        done: false,
      };

      expect(chunk.content).toBe('Hello');
      expect(chunk.done).toBe(false);
    });

    it('종료 청크를 생성해야 함', () => {
      const chunk: LLMStreamChunk = {
        id: 'chunk-final',
        content: '',
        done: true,
      };

      expect(chunk.done).toBe(true);
    });
  });

  describe('HealthStatus', () => {
    it('정상 상태를 생성해야 함', () => {
      const status: HealthStatus = {
        healthy: true,
        latency: 150,
        lastChecked: new Date(),
      };

      expect(status.healthy).toBe(true);
      expect(status.latency).toBe(150);
    });

    it('비정상 상태를 생성해야 함', () => {
      const status: HealthStatus = {
        healthy: false,
        latency: 5000,
        error: 'Connection timeout',
        lastChecked: new Date(),
      };

      expect(status.healthy).toBe(false);
      expect(status.error).toBe('Connection timeout');
    });
  });
});
