import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MoonshotClient, MoonshotError } from '../../../src/llm/moonshot.js';
import type { Logger } from '../../../src/logging/types.js';
import type { LLMClientConfig, ChatMessage } from '../../../src/llm/types.js';

// OpenAI SDK 모킹
const mockCreate = vi.fn();
const mockList = vi.fn();
const mockStream = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
    models: {
      list: mockList,
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

describe('MoonshotClient', () => {
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
      provider: 'moonshot',
      apiKey: 'test-moonshot-api-key',
      defaultModel: 'moonshot-v1-8k',
      timeout: 60000,
      maxRetries: 3,
    };

    vi.clearAllMocks();
  });

  describe('초기화', () => {
    it('올바른 설정으로 초기화되어야 함', () => {
      const client = new MoonshotClient(config, mockLogger);

      expect(client.id).toBeDefined();
      expect(client.id).toContain('moonshot-');
      expect(client.provider).toBe('moonshot');
      expect(client.config).toEqual(expect.objectContaining({
        provider: 'moonshot',
        apiKey: 'test-moonshot-api-key',
        defaultModel: 'moonshot-v1-8k',
        timeout: 60000,
        maxRetries: 3,
        retryDelay: 1000,
      }));
    });

    it('기본값이 적용되어야 함', () => {
      const minimalConfig: LLMClientConfig = {
        provider: 'moonshot',
        apiKey: 'test-key',
      };

      const client = new MoonshotClient(minimalConfig, mockLogger);

      expect(client.config.timeout).toBe(60000);
      expect(client.config.maxRetries).toBe(3);
      expect(client.config.retryDelay).toBe(1000);
    });

    it('커스텀 baseURL이 적용되어야 함', () => {
      const customConfig: LLMClientConfig = {
        provider: 'moonshot',
        apiKey: 'test-key',
        baseURL: 'https://custom.moonshot.cn/v1',
      };

      const client = new MoonshotClient(customConfig, mockLogger);

      expect(client.config.baseURL).toBe('https://custom.moonshot.cn/v1');
    });
  });

  describe('validateKey', () => {
    it('유효한 API 키를 검증해야 함', async () => {
      mockList.mockResolvedValueOnce({
        data: [
          { id: 'moonshot-v1-8k' },
          { id: 'moonshot-v1-32k' },
        ],
      });

      const client = new MoonshotClient(config, mockLogger);
      const isValid = await client.validateKey();

      expect(isValid).toBe(true);
      expect(mockList).toHaveBeenCalled();
    });

    it('401 에러시 false를 반환해야 함', async () => {
      const { APIError } = await import('openai');
      const apiError = new APIError(
        'Unauthorized',
        401,
        'invalid_api_key',
        undefined
      );
      mockList.mockRejectedValueOnce(apiError);

      const client = new MoonshotClient(config, mockLogger);
      const isValid = await client.validateKey();

      expect(isValid).toBe(false);
    });

    it('네트워크 에러시 true를 반환해야 함 (키 자체는 유효할 수 있음)', async () => {
      mockList.mockRejectedValueOnce(new Error('Network error'));

      const client = new MoonshotClient(config, mockLogger);
      const isValid = await client.validateKey();

      expect(isValid).toBe(true);
    });
  });

  describe('listModels', () => {
    it('API에서 모델 목록을 가져와야 함', async () => {
      mockList.mockResolvedValueOnce({
        data: [
          { id: 'moonshot-v1-8k' },
          { id: 'moonshot-v1-32k' },
          { id: 'moonshot-v1-128k' },
          { id: 'other-model' },
        ],
      });

      const client = new MoonshotClient(config, mockLogger);
      const models = await client.listModels();

      expect(models).toContain('moonshot-v1-8k');
      expect(models).toContain('moonshot-v1-32k');
      expect(models).toContain('moonshot-v1-128k');
      expect(models).not.toContain('other-model');
      expect(models).toEqual([
        'moonshot-v1-128k',
        'moonshot-v1-32k',
        'moonshot-v1-8k',
      ]); // 정렬 확인
    });

    it('API 실패시 기본 모델 목록을 반환해야 함', async () => {
      mockList.mockRejectedValueOnce(new Error('API Error'));

      const client = new MoonshotClient(config, mockLogger);
      const models = await client.listModels();

      expect(models).toContain('moonshot-v1-8k');
      expect(models).toContain('moonshot-v1-32k');
      expect(models).toContain('moonshot-v1-128k');
    });

    it('moonshot 모델이 없을 때 기본 목록을 반환해야 함', async () => {
      mockList.mockResolvedValueOnce({
        data: [
          { id: 'other-model-1' },
          { id: 'other-model-2' },
        ],
      });

      const client = new MoonshotClient(config, mockLogger);
      const models = await client.listModels();

      expect(models).toContain('moonshot-v1-8k');
      expect(models).toContain('moonshot-v1-32k');
      expect(models).toContain('moonshot-v1-128k');
    });
  });

  describe('complete', () => {
    it('완전한 응답을 생성해야 함', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'chatcmpl-123',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '안녕하세요! 무엇을 도와드릴까요?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
        model: 'moonshot-v1-8k',
      });

      const client = new MoonshotClient(config, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: '안녕하세요!' },
      ];

      const response = await client.complete({
        model: 'moonshot-v1-8k',
        messages,
        max_tokens: 100,
      });

      expect(response.id).toBe('chatcmpl-123');
      expect(response.message.content).toBe('안녕하세요! 무엇을 도와드릴까요?');
      expect(response.message.role).toBe('assistant');
      expect(response.usage.input_tokens).toBe(10);
      expect(response.usage.output_tokens).toBe(20);
      expect(response.usage.total_tokens).toBe(30);
      expect(response.model).toBe('moonshot-v1-8k');
      expect(response.stop_reason).toBe('end_turn');
    });

    it('도구 호출을 포함한 응답을 처리해야 함', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'chatcmpl-456',
        choices: [
          {
            message: {
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
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 15,
          total_tokens: 35,
        },
        model: 'moonshot-v1-8k',
      });

      const client = new MoonshotClient(config, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: '서울 날씨 알려주세요' },
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
      expect(response.message.tool_calls![0].function.arguments).toBe('{"location": "Seoul"}');
      expect(response.stop_reason).toBe('tool_use');
    });

    it('시스템 프롬프트를 포함한 요청을 처리해야 함', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'chatcmpl-789',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '시스템 프롬프트를 받았습니다.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        model: 'moonshot-v1-8k',
      });

      const client = new MoonshotClient(config, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: '안녕하세요' },
      ];

      await client.complete({
        model: 'moonshot-v1-8k',
        messages,
        system: '당신은 도움이 되는 AI 어시스턴트입니다.',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0]).toEqual({
        role: 'system',
        content: '당신은 도움이 되는 AI 어시스턴트입니다.',
      });
    });

    it('max_tokens 도달시 stop_reason이 max_tokens여야 함', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'chatcmpl-length',
        choices: [
          {
            message: { role: 'assistant', content: 'Truncated' },
            finish_reason: 'length',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'moonshot-v1-8k',
      });

      const client = new MoonshotClient(config, mockLogger);
      const response = await client.complete({
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 5,
      });

      expect(response.stop_reason).toBe('max_tokens');
    });

    it('API 에러를 적절히 처리해야 함', async () => {
      const { APIError } = await import('openai');
      const apiError = new APIError(
        'Rate limit exceeded',
        429,
        'rate_limit_exceeded',
        'rate_limit_error'
      );
      mockCreate.mockRejectedValueOnce(apiError);

      const client = new MoonshotClient(config, mockLogger);

      await expect(
        client.complete({
          model: 'moonshot-v1-8k',
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow('Moonshot API error: Rate limit exceeded');
    });

    it('알 수 없는 에러를 적절히 처리해야 함', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Unknown error'));

      const client = new MoonshotClient(config, mockLogger);

      await expect(
        client.complete({
          model: 'moonshot-v1-8k',
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow('Unknown error: Unknown error');
    });
  });

  describe('stream', () => {
    it('스트리밍 응답을 생성해야 함', async () => {
      const mockStreamGenerator = async function* () {
        yield {
          id: 'chatcmpl-stream-1',
          choices: [{ delta: { content: '안녕' } }],
        };
        yield {
          id: 'chatcmpl-stream-2',
          choices: [{ delta: { content: '하세요' } }],
        };
        yield {
          id: 'chatcmpl-stream-3',
          choices: [{ delta: { content: '!' } }],
        };
      };

      mockCreate.mockResolvedValueOnce(mockStreamGenerator());

      const client = new MoonshotClient(config, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: '인사해주세요' },
      ];

      const chunks = [];
      for await (const chunk of client.stream({
        model: 'moonshot-v1-8k',
        messages,
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBe('안녕');
      expect(chunks[1].content).toBe('하세요');
      expect(chunks[2].content).toBe('!');
      expect(chunks[chunks.length - 1].done).toBe(true);
    });

    it('스트리밍 도구 호출을 처리해야 함', async () => {
      const mockStreamGenerator = async function* () {
        yield {
          id: 'chatcmpl-tool-1',
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call-1',
                    function: { name: 'get_weather', arguments: '' },
                  },
                ],
              },
            },
          ],
        };
        yield {
          id: 'chatcmpl-tool-2',
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: '{"location": "Seoul"}' },
                  },
                ],
              },
            },
          ],
        };
      };

      mockCreate.mockResolvedValueOnce(mockStreamGenerator());

      const client = new MoonshotClient(config, mockLogger);
      const messages: ChatMessage[] = [
        { role: 'user', content: '날씨 알려주세요' },
      ];

      const chunks = [];
      for await (const chunk of client.stream({
        model: 'moonshot-v1-8k',
        messages,
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
      })) {
        chunks.push(chunk);
      }

      const toolCallChunks = chunks.filter(c => c.tool_calls);
      expect(toolCallChunks.length).toBeGreaterThan(0);
      expect(toolCallChunks[toolCallChunks.length - 1].tool_calls![0].function.name).toBe('get_weather');
      expect(toolCallChunks[toolCallChunks.length - 1].tool_calls![0].function.arguments).toBe('{"location": "Seoul"}');
    });

    it('스트리밍 에러를 적절히 처리해야 함', async () => {
      const mockStreamGenerator = async function* () {
        yield { id: 'chunk-1', choices: [{ delta: { content: 'Hello' } }] };
        throw new Error('Stream error');
      };

      mockCreate.mockResolvedValueOnce(mockStreamGenerator());

      const client = new MoonshotClient(config, mockLogger);

      const stream = client.stream({
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: 'Test' }],
      });

      await expect(async () => {
        for await (const chunk of stream) {
          // 소비
        }
      }).rejects.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('정상 상태를 반환해야 함', async () => {
      mockList.mockResolvedValueOnce({
        data: [{ id: 'moonshot-v1-8k' }],
      });

      const client = new MoonshotClient(config, mockLogger);
      const health = await client.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.lastChecked).toBeInstanceOf(Date);
      expect(health.error).toBeUndefined();
    });

    it('비정상 상태를 반환해야 함', async () => {
      mockList.mockRejectedValueOnce(new Error('Connection failed'));

      const client = new MoonshotClient(config, mockLogger);
      const health = await client.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.error).toBe('Connection failed');
      expect(health.lastChecked).toBeInstanceOf(Date);
    });
  });

  describe('chatCompletion', () => {
    it('OpenAI 스타일 채팅 완성을 처리해야 함', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'chatcmpl-chat',
        choices: [
          {
            message: { role: 'assistant', content: '응답입니다' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
        model: 'moonshot-v1-8k',
      });

      const client = new MoonshotClient(config, mockLogger);
      const result = await client.chatCompletion({
        model: 'moonshot-v1-8k',
        messages: [
          { role: 'system', content: '시스템 프롬프트' },
          { role: 'user', content: '안녕하세요' },
        ],
        maxTokens: 100,
        temperature: 0.7,
      });

      expect(result.content).toBe('응답입니다');
      expect(result.stopReason).toBe('end_turn');
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
    });
  });

  describe('streamChatCompletion', () => {
    it('OpenAI 스타일 스트리밍 채팅 완성을 처리해야 함', async () => {
      const mockStreamGenerator = async function* () {
        yield { id: 's1', choices: [{ delta: { content: 'Hello' } }] };
        yield { id: 's2', choices: [{ delta: { content: ' World' } }] };
      };

      mockCreate.mockResolvedValueOnce(mockStreamGenerator());

      const client = new MoonshotClient(config, mockLogger);
      const chunks = [];

      for await (const chunk of client.streamChatCompletion({
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBe('Hello');
      expect(chunks[1].content).toBe(' World');
      expect(chunks[chunks.length - 1].isComplete).toBe(true);
    });
  });

  describe('MoonshotError', () => {
    it('MoonshotError가 올바른 속성을 가져야 함', () => {
      const error = new MoonshotError(
        'Test error message',
        400,
        'bad_request',
        'invalid_request_error'
      );

      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('MoonshotError');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('bad_request');
      expect(error.type).toBe('invalid_request_error');
    });

    it('선택적 속성 없이 생성할 수 있어야 함', () => {
      const error = new MoonshotError('Simple error');

      expect(error.message).toBe('Simple error');
      expect(error.statusCode).toBeUndefined();
      expect(error.code).toBeUndefined();
      expect(error.type).toBeUndefined();
    });
  });
});

describe('MoonshotClient 통합 시나리오', () => {
  let mockLogger: Logger;

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

    vi.clearAllMocks();
  });

  it('전체 대화 흐름을 시뮬레이션해야 함', async () => {
    // 첫 번째 응답: 도구 호출
    mockCreate
      .mockResolvedValueOnce({
        id: 'conv-1',
        choices: [
          {
            message: {
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
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
        model: 'moonshot-v1-8k',
      })
      // 두 번째 응답: 최종 답변
      .mockResolvedValueOnce({
        id: 'conv-2',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '서울의 현재 날씨는 맑고 25도입니다.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 40, completion_tokens: 20, total_tokens: 60 },
        model: 'moonshot-v1-8k',
      });

    const client = new MoonshotClient(
      {
        provider: 'moonshot',
        apiKey: 'test-key',
        defaultModel: 'moonshot-v1-8k',
      },
      mockLogger
    );

    // 첫 번째 요청
    const response1 = await client.complete({
      model: 'moonshot-v1-8k',
      messages: [{ role: 'user', content: '서울 날씨 알려주세요' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: {
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
            },
          },
        },
      ],
    });

    expect(response1.message.tool_calls).toHaveLength(1);

    // 도구 결과를 포함한 두 번째 요청
    const response2 = await client.complete({
      model: 'moonshot-v1-8k',
      messages: [
        { role: 'user', content: '서울 날씨 알려주세요' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call-1',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"location": "Seoul"}' },
            },
          ],
        },
        {
          role: 'tool',
          content: '{"temperature": 25, "condition": "sunny"}',
          tool_call_id: 'call-1',
        },
      ],
    });

    expect(response2.message.content).toBe('서울의 현재 날씨는 맑고 25도입니다.');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
