import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MoonshotClient } from '../../../src/llm/moonshot.js';
import type { Logger } from '../../../src/logging/types.js';
import type { LLMClientConfig } from '../../../src/llm/types.js';

/**
 * Moonshot 통합 테스트
 * @description 실제 API 호출 없이 Gateway 서버와의 통합 시나리오 테스트
 */

// OpenAI SDK 모킹
const mockCreate = vi.fn();
const mockList = vi.fn();

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

describe('Moonshot Integration', () => {
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
      apiKey: 'test-api-key',
      defaultModel: 'moonshot-v1-8k',
      timeout: 60000,
      maxRetries: 3,
    };

    vi.clearAllMocks();
  });

  describe('Gateway 통합 시나리오', () => {
    it('여러 클라이언트가 동시에 요청을 처리할 수 있어야 함', async () => {
      mockCreate
        .mockResolvedValueOnce({
          id: 'req-1',
          choices: [{ message: { role: 'assistant', content: '응답 1' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          model: 'moonshot-v1-8k',
        })
        .mockResolvedValueOnce({
          id: 'req-2',
          choices: [{ message: { role: 'assistant', content: '응답 2' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          model: 'moonshot-v1-8k',
        })
        .mockResolvedValueOnce({
          id: 'req-3',
          choices: [{ message: { role: 'assistant', content: '응답 3' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          model: 'moonshot-v1-8k',
        });

      const client1 = new MoonshotClient(config, mockLogger);
      const client2 = new MoonshotClient(config, mockLogger);
      const client3 = new MoonshotClient(config, mockLogger);

      const [response1, response2, response3] = await Promise.all([
        client1.complete({
          model: 'moonshot-v1-8k',
          messages: [{ role: 'user', content: '요청 1' }],
        }),
        client2.complete({
          model: 'moonshot-v1-8k',
          messages: [{ role: 'user', content: '요청 2' }],
        }),
        client3.complete({
          model: 'moonshot-v1-8k',
          messages: [{ role: 'user', content: '요청 3' }],
        }),
      ]);

      expect(response1.message.content).toBe('응답 1');
      expect(response2.message.content).toBe('응답 2');
      expect(response3.message.content).toBe('응답 3');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('Fallback 체인에서 Moonshot이 사용될 수 있어야 함', async () => {
      // 첫 번째 클라이언트 실패
      mockCreate
        .mockRejectedValueOnce(new Error('Primary client failed'))
        // Moonshot 클라이언트 성공
        .mockResolvedValueOnce({
          id: 'fallback-1',
          choices: [{ message: { role: 'assistant', content: 'Moonshot 응답' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          model: 'moonshot-v1-8k',
        });

      const moonshotClient = new MoonshotClient(config, mockLogger);

      // Fallback 시뮬레이션
      let response;
      const providers = [
        { name: 'primary', complete: mockCreate },
        { name: 'moonshot', complete: () => moonshotClient.complete({
          model: 'moonshot-v1-8k',
          messages: [{ role: 'user', content: 'Fallback test' }],
        })},
      ];

      for (const provider of providers) {
        try {
          if (provider.name === 'primary') {
            await provider.complete();
          } else {
            response = await provider.complete();
            break;
          }
        } catch {
          continue;
        }
      }

      expect(response).toBeDefined();
      expect(response!.message.content).toBe('Moonshot 응답');
    });

    it('스트리밍 응답을 Gateway를 통해 전달할 수 있어야 함', async () => {
      const mockStreamGenerator = async function* () {
        yield { id: 's1', choices: [{ delta: { content: '첫' } }] };
        yield { id: 's2', choices: [{ delta: { content: '번째' } }] };
        yield { id: 's3', choices: [{ delta: { content: '청크' } }] };
      };

      mockCreate.mockResolvedValueOnce(mockStreamGenerator());

      const client = new MoonshotClient(config, mockLogger);
      const chunks: string[] = [];

      for await (const chunk of client.stream({
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: '스트리밍 테스트' }],
      })) {
        if (!chunk.done) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks).toEqual(['첫', '번째', '청크']);
    });
  });

  describe('다양한 모델 지원', () => {
    it('moonshot-v1-8k 모델을 사용할 수 있어야 함', async () => {
      mockCreate.mockResolvedValueOnce({
        id: '8k-test',
        choices: [{ message: { role: 'assistant', content: '8k 응답' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'moonshot-v1-8k',
      });

      const client = new MoonshotClient(config, mockLogger);
      const response = await client.complete({
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: 'Test' }],
      });

      expect(response.model).toBe('moonshot-v1-8k');
    });

    it('moonshot-v1-32k 모델을 사용할 수 있어야 함', async () => {
      mockCreate.mockResolvedValueOnce({
        id: '32k-test',
        choices: [{ message: { role: 'assistant', content: '32k 응답' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'moonshot-v1-32k',
      });

      const client = new MoonshotClient(
        { ...config, defaultModel: 'moonshot-v1-32k' },
        mockLogger
      );
      const response = await client.complete({
        model: 'moonshot-v1-32k',
        messages: [{ role: 'user', content: 'Test' }],
      });

      expect(response.model).toBe('moonshot-v1-32k');
    });

    it('moonshot-v1-128k 모델을 사용할 수 있어야 함', async () => {
      mockCreate.mockResolvedValueOnce({
        id: '128k-test',
        choices: [{ message: { role: 'assistant', content: '128k 응답' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'moonshot-v1-128k',
      });

      const client = new MoonshotClient(
        { ...config, defaultModel: 'moonshot-v1-128k' },
        mockLogger
      );
      const response = await client.complete({
        model: 'moonshot-v1-128k',
        messages: [{ role: 'user', content: 'Test' }],
      });

      expect(response.model).toBe('moonshot-v1-128k');
    });
  });

  describe('에러 복구 시나리오', () => {
    it('일시적인 에러 후 재시도할 수 있어야 함', async () => {
      // 첫 번째 호출 실패, 두 번째 호출 성공
      mockCreate
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          id: 'retry-success',
          choices: [{ message: { role: 'assistant', content: '재시도 성공' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          model: 'moonshot-v1-8k',
        });

      const client = new MoonshotClient(config, mockLogger);

      // 실제로는 SDK 내부에서 재시도하지만, 여기서는 수동으로 시뮬레이션
      let response;
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        try {
          response = await client.complete({
            model: 'moonshot-v1-8k',
            messages: [{ role: 'user', content: 'Test' }],
          });
          break;
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) throw error;
        }
      }

      expect(response).toBeDefined();
      expect(response!.message.content).toBe('재시도 성공');
    });

    it('Rate limit 에러를 적절히 처리해야 함', async () => {
      const { APIError } = await import('openai');
      const rateLimitError = new APIError(
        'Rate limit exceeded',
        429,
        'rate_limit_exceeded',
        'rate_limit_error'
      );
      mockCreate.mockRejectedValueOnce(rateLimitError);

      const client = new MoonshotClient(config, mockLogger);

      await expect(
        client.complete({
          model: 'moonshot-v1-8k',
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('인증 에러를 적절히 처리해야 함', async () => {
      const { APIError } = await import('openai');
      const authError = new APIError(
        'Invalid authentication',
        401,
        'invalid_api_key',
        'authentication_error'
      );
      mockCreate.mockRejectedValueOnce(authError);

      const client = new MoonshotClient(config, mockLogger);

      await expect(
        client.complete({
          model: 'moonshot-v1-8k',
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow('Invalid authentication');
    });
  });

  describe('도구 사용 시나리오', () => {
    it('복잡한 도구 호출 체인을 처리할 수 있어야 함', async () => {
      // 첫 번째 응답: 날씨 도구 호출
      mockCreate
        .mockResolvedValueOnce({
          id: 'tool-chain-1',
          choices: [{
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [{
                id: 'call-weather',
                type: 'function',
                function: { name: 'get_weather', arguments: '{"location": "Seoul"}' },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
          model: 'moonshot-v1-8k',
        })
        // 두 번째 응답: 번역 도구 호출
        .mockResolvedValueOnce({
          id: 'tool-chain-2',
          choices: [{
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [{
                id: 'call-translate',
                type: 'function',
                function: { name: 'translate', arguments: '{"text": "Sunny", "target": "ko"}' },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
          model: 'moonshot-v1-8k',
        })
        // 세 번째 응답: 최종 답변
        .mockResolvedValueOnce({
          id: 'tool-chain-3',
          choices: [{
            message: { role: 'assistant', content: '서울은 맑은 날씨입니다.' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 80, completion_tokens: 15, total_tokens: 95 },
          model: 'moonshot-v1-8k',
        });

      const client = new MoonshotClient(config, mockLogger);

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
          {
            type: 'function',
            function: {
              name: 'translate',
              description: 'Translate text',
              parameters: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  target: { type: 'string' },
                },
                required: ['text', 'target'],
              },
            },
          },
        ],
      });

      expect(response1.message.tool_calls).toHaveLength(1);
      expect(response1.message.tool_calls![0].function.name).toBe('get_weather');

      // 두 번째 요청 (도구 결과 포함)
      const response2 = await client.complete({
        model: 'moonshot-v1-8k',
        messages: [
          { role: 'user', content: '서울 날씨 알려주세요' },
          {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'call-weather',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"location": "Seoul"}' },
            }],
          },
          { role: 'tool', content: '{"condition": "Sunny", "temp": 25}', tool_call_id: 'call-weather' },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'translate',
              description: 'Translate text',
              parameters: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  target: { type: 'string' },
                },
                required: ['text', 'target'],
              },
            },
          },
        ],
      });

      expect(response2.message.tool_calls![0].function.name).toBe('translate');

      // 세 번째 요청
      const response3 = await client.complete({
        model: 'moonshot-v1-8k',
        messages: [
          { role: 'user', content: '서울 날씨 알려주세요' },
          {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'call-weather',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"location": "Seoul"}' },
            }],
          },
          { role: 'tool', content: '{"condition": "Sunny", "temp": 25}', tool_call_id: 'call-weather' },
          {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'call-translate',
              type: 'function',
              function: { name: 'translate', arguments: '{"text": "Sunny", "target": "ko"}' },
            }],
          },
          { role: 'tool', content: '"맑음"', tool_call_id: 'call-translate' },
        ],
      });

      expect(response3.message.content).toBe('서울은 맑은 날씨입니다.');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('헬스 체크 및 모니터링', () => {
    it('주기적인 헬스 체크를 수행할 수 있어야 함', async () => {
      mockList
        .mockResolvedValueOnce({ data: [{ id: 'moonshot-v1-8k' }] }) // 첫 번째 체크
        .mockResolvedValueOnce({ data: [{ id: 'moonshot-v1-8k' }] }) // 두 번째 체크
        .mockRejectedValueOnce(new Error('Connection failed')) // 세 번째 체크 실패
        .mockResolvedValueOnce({ data: [{ id: 'moonshot-v1-8k' }] }); // 네 번째 체크 복구

      const client = new MoonshotClient(config, mockLogger);

      const results = [];
      for (let i = 0; i < 4; i++) {
        results.push(await client.healthCheck());
      }

      expect(results[0].healthy).toBe(true);
      expect(results[1].healthy).toBe(true);
      expect(results[2].healthy).toBe(false);
      expect(results[3].healthy).toBe(true);
    });

    it('모델 목록을 주기적으로 갱신할 수 있어야 함', async () => {
      mockList
        .mockResolvedValueOnce({
          data: [
            { id: 'moonshot-v1-8k' },
            { id: 'moonshot-v1-32k' },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            { id: 'moonshot-v1-8k' },
            { id: 'moonshot-v1-32k' },
            { id: 'moonshot-v1-128k' },
            { id: 'moonshot-v1-256k' },
          ],
        });

      const client = new MoonshotClient(config, mockLogger);

      const models1 = await client.listModels();
      const models2 = await client.listModels();

      expect(models1).toHaveLength(2);
      expect(models2).toHaveLength(4);
      expect(models2).toContain('moonshot-v1-256k');
    });
  });
});
