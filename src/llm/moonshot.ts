/**
 * Moonshot(Kimi) LLM 클라이언트
 * @description OpenAI 호환 API를 사용한 Moonshot 클라이언트
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
import type { ILogger } from '../logging/index.js';

/**
 * Moonshot API 기본 URL
 */
const MOONSHOT_BASE_URL = 'https://api.moonshot.cn/v1';

/**
 * 기본 지원 모델 목록
 */
const DEFAULT_MODELS = [
  'moonshot-v1-8k',
  'moonshot-v1-32k',
  'moonshot-v1-128k',
];

/**
 * Moonshot 클라이언트 구현
 */
export class MoonshotClient implements ILLMClient {
  readonly id: string;
  readonly provider = 'moonshot' as const;
  readonly config: LLMClientConfig;

  private client: OpenAI;
  private logger: ILogger;
  private lastHealthCheck?: HealthStatus;

  constructor(config: LLMClientConfig, logger: ILogger) {
    this.id = `moonshot-${Date.now()}`;
    this.config = {
      timeout: 60000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
    this.logger = logger.child('MoonshotClient', { clientId: this.id }) as ILogger;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || MOONSHOT_BASE_URL,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    });

    this.logger.debug('Moonshot client initialized');
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
      const moonshotModels = models.data
        .filter(m => m.id.includes('moonshot'))
        .map(m => m.id)
        .sort();

      // API에서 모델을 가져오지 못하면 기본 모델 목록 반환
      return moonshotModels.length > 0 ? moonshotModels : DEFAULT_MODELS;
    } catch (error) {
      this.logger.error('Failed to list models', error as Error);
      // 기본 모델 목록 반환
      return DEFAULT_MODELS;
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
      // instanceof 대신 속성 확인 사용 (테스트 환경 호환성)
      const apiError = error as { status?: number; name?: string };
      if (apiError.status === 401) {
        return false;
      }
      // 다른 에러는 네트워크 등의 문제이므로 true 반환 (키 자체는 유효할 수 있음)
      return true;
    }
  }

  /**
   * 채팅 완성 (OpenAI 스타일 API)
   */
  async chatCompletion(options: {
    model: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
    temperature?: number;
    tools?: Array<{
      type: string;
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }>;
  }): Promise<{
    content: string;
    stopReason?: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  }> {
    const response = await this.complete({
      model: options.model,
      messages: options.messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      tools: options.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: {
            type: 'object' as const,
            properties: (t.function.parameters as { properties?: Record<string, unknown> })?.properties || {},
            required: (t.function.parameters as { required?: string[] })?.required,
          },
        },
      })),
    });

    return {
      content: response.message.content,
      stopReason: response.stop_reason || undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  /**
   * 스트리밍 채팅 완성 (OpenAI 스타일 API)
   */
  async *streamChatCompletion(options: {
    model: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
    temperature?: number;
    tools?: Array<{
      type: string;
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }>;
  }): AsyncGenerator<{
    content: string;
    isComplete?: boolean;
  }> {
    const stream = this.stream({
      model: options.model,
      messages: options.messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      tools: options.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: {
            type: 'object' as const,
            properties: (t.function.parameters as { properties?: Record<string, unknown> })?.properties || {},
            required: (t.function.parameters as { required?: string[] })?.required,
          },
        },
      })),
    });

    for await (const chunk of stream) {
      yield {
        content: chunk.content,
        isComplete: chunk.done,
      };
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
      content: message.content ?? '',
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
    // instanceof 대신 속성 확인 사용 (테스트 환경 호환성)
    const apiError = error as { status?: number; code?: string; type?: string; message?: string; name?: string };
    if (apiError.status !== undefined || apiError.code !== undefined) {
      return new MoonshotError(
        `Moonshot API error: ${apiError.message || 'Unknown error'}`,
        apiError.status,
        apiError.code,
        apiError.type
      );
    }
    return new MoonshotError(`Unknown error: ${(error as Error).message || 'Unknown error'}`);
  }
}

/**
 * Moonshot 에러 클래스
 */
export class MoonshotError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public type?: string
  ) {
    super(message);
    this.name = 'MoonshotError';
  }
}
