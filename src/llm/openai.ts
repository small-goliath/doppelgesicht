/**
 * OpenAI GPT LLM 클라이언트
 * @description openai 4.x 연동
 */

import OpenAI from 'openai';
import type {
  ILLMClient,
  LLMClientConfig,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  ChatMessage,
  HealthStatus,
  ToolCall,
  TokenUsage
} from './types.js';
import type { Logger } from '../logging/index.js';

/**
 * OpenAI 클라이언트 구현
 */
export class OpenAIClient implements ILLMClient {
  readonly id: string;
  readonly provider = 'openai' as const;
  readonly config: LLMClientConfig;

  private client: OpenAI;
  private logger: Logger;
  private lastHealthCheck?: HealthStatus;

  constructor(config: LLMClientConfig, logger: Logger) {
    this.id = `openai-${Date.now()}`;
    this.config = {
      timeout: 60000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
    this.logger = logger.child('OpenAIClient', { clientId: this.id });

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    });

    this.logger.debug('OpenAI client initialized');
  }

  /**
   * 완전 응답 생성
   */
  async complete(options: LLMRequestOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    this.logger.debug('Sending completion request', {
      model: options.model,
      messageCount: options.messages.length
    });

    try {
      const response = await this.client.chat.completions.create({
        model: options.model,
        messages: this.convertMessages(options.messages, options.system),
        max_tokens: options.max_tokens,
        temperature: options.temperature,
        top_p: options.top_p,
        tools: options.tools ? this.convertTools(options.tools) : undefined,
        stream: false,
      });

      const choice = response.choices[0];
      const latency = Date.now() - startTime;

      this.logger.debug('Completion received', {
        latency,
        usage: response.usage
      });

      return {
        id: response.id,
        message: this.convertResponseMessage(choice.message),
        usage: this.convertUsage(response.usage),
        model: response.model,
        stop_reason: this.convertStopReason(choice.finish_reason),
      };
    } catch (error) {
      this.logger.error('Completion failed', error as Error);
      throw this.wrapError(error);
    }
  }

  /**
   * 스트리밍 응답 생성
   */
  async *stream(options: LLMRequestOptions): AsyncGenerator<LLMStreamChunk> {
    const startTime = Date.now();
    this.logger.debug('Starting streaming request', {
      model: options.model,
      messageCount: options.messages.length
    });

    try {
      const stream = await this.client.chat.completions.create({
        model: options.model,
        messages: this.convertMessages(options.messages, options.system),
        max_tokens: options.max_tokens,
        temperature: options.temperature,
        top_p: options.top_p,
        tools: options.tools ? this.convertTools(options.tools) : undefined,
        stream: true,
      });

      let content = '';
      let toolCalls: ToolCall[] = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          content += delta.content;
          yield {
            id: chunk.id,
            content: delta.content,
            done: false,
          };
        }

        if (delta?.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            const existingCall = toolCalls[toolCallDelta.index];

            if (toolCallDelta.id) {
              // 새 도구 호출 시작
              if (!existingCall) {
                toolCalls[toolCallDelta.index] = {
                  id: toolCallDelta.id,
                  type: 'function',
                  function: {
                    name: toolCallDelta.function?.name || '',
                    arguments: toolCallDelta.function?.arguments || '',
                  },
                };
              }
            }

            if (toolCallDelta.function?.arguments) {
              // 인자 누적
              if (existingCall) {
                existingCall.function.arguments += toolCallDelta.function.arguments;
              }
            }

            if (toolCallDelta.function?.name) {
              if (existingCall) {
                existingCall.function.name = toolCallDelta.function.name;
              }
            }
          }

          yield {
            id: chunk.id,
            content: '',
            tool_calls: toolCalls.filter(Boolean),
            done: false,
          };
        }
      }

      const latency = Date.now() - startTime;
      this.logger.debug('Streaming completed', { latency, contentLength: content.length });

      // 종료 청크
      yield {
        id: `${this.id}-${Date.now()}`,
        content: '',
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        done: true,
      };
    } catch (error) {
      this.logger.error('Streaming failed', error as Error);
      throw this.wrapError(error);
    }
  }

  /**
   * 클라이언트 상태 확인
   */
  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // 모델 목록 API로 상태 확인
      await this.client.models.list();

      const latency = Date.now() - startTime;
      this.lastHealthCheck = {
        healthy: true,
        latency,
        lastChecked: new Date(),
      };

      return this.lastHealthCheck;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.lastHealthCheck = {
        healthy: false,
        latency,
        error: (error as Error).message,
        lastChecked: new Date(),
      };

      return this.lastHealthCheck;
    }
  }

  /**
   * 사용 가능한 모델 목록
   */
  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data
        .filter(m => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3'))
        .map(m => m.id)
        .sort();
    } catch (error) {
      this.logger.error('Failed to list models', error as Error);
      // 기본 모델 목록 반환
      return [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
        'o1-preview',
        'o1-mini',
      ];
    }
  }

  /**
   * API 키 검증
   */
  async validateKey(): Promise<boolean> {
    try {
      // 모델 목록 API로 키 검증
      await this.client.models.list();
      return true;
    } catch (error) {
      // 401 에러는 키가 유효하지 않음을 의미
      if (error instanceof OpenAI.APIError && error.status === 401) {
        return false;
      }
      // 다른 에러는 네트워크 등의 문제이므로 true 반환 (키 자체는 유효할 수 있음)
      return true;
    }
  }

  /**
   * 메시지 변환 (내부 형식 -> OpenAI)
   */
  private convertMessages(
    messages: ChatMessage[],
    systemPrompt?: string
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // 시스템 메시지 추가
    if (systemPrompt) {
      result.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // 나머지 메시지 변환
    for (const msg of messages) {
      if (msg.role === 'system') continue; // 이미 추가됨

      if (msg.role === 'tool') {
        result.push({
          role: 'tool',
          tool_call_id: msg.tool_call_id || '',
          content: msg.content,
        });
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        result.push({
          role: 'assistant',
          content: msg.content,
          tool_calls: msg.tool_calls.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        });
      } else {
        result.push({
          role: msg.role,
          content: msg.content,
        } as OpenAI.Chat.ChatCompletionMessageParam);
      }
    }

    return result;
  }

  /**
   * 도구 변환
   */
  private convertTools(
    tools: NonNullable<LLMRequestOptions['tools']>
  ): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  /**
   * 응답 메시지 변환
   */
  private convertResponseMessage(
    message: OpenAI.Chat.ChatCompletionMessage
  ): ChatMessage {
    const toolCalls = message.tool_calls?.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      role: 'assistant',
      content: message.content || '',
      tool_calls: toolCalls?.length ? toolCalls : undefined,
    };
  }

  /**
   * 사용량 변환
   */
  private convertUsage(usage: OpenAI.Completions.CompletionUsage | undefined): TokenUsage {
    return {
      input_tokens: usage?.prompt_tokens || 0,
      output_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
    };
  }

  /**
   * 종료 이유 변환
   */
  private convertStopReason(
    reason: OpenAI.Chat.ChatCompletion.Choice['finish_reason']
  ): LLMResponse['stop_reason'] {
    switch (reason) {
      case 'stop':
        return 'end_turn';
      case 'length':
        return 'max_tokens';
      case 'tool_calls':
        return 'tool_use';
      default:
        return null;
    }
  }

  /**
   * 에러 래핑
   */
  private wrapError(error: unknown): Error {
    if (error instanceof OpenAI.APIError) {
      return new OpenAIError(
        `OpenAI API error: ${error.message}`,
        error.status,
        error.code,
        error.type
      );
    }
    return new OpenAIError(`Unknown error: ${(error as Error).message}`);
  }
}

/**
 * OpenAI 에러 클래스
 */
export class OpenAIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public type?: string
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}
