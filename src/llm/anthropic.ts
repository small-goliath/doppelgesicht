/**
 * Anthropic Claude LLM 클라이언트
 * @description @anthropic-ai/sdk 0.24.3 연동
 */

import Anthropic from '@anthropic-ai/sdk';
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
 * Anthropic 클라이언트 구현
 */
export class AnthropicClient implements ILLMClient {
  readonly id: string;
  readonly provider = 'anthropic' as const;
  readonly config: LLMClientConfig;

  private client: Anthropic;
  private logger: ILogger;
  private lastHealthCheck?: HealthStatus;

  constructor(config: LLMClientConfig, logger: ILogger) {
    this.id = `anthropic-${Date.now()}`;
    this.config = {
      timeout: 60000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
    this.logger = logger.child('AnthropicClient', { clientId: this.id }) as ILogger;

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    });

    this.logger.debug('Anthropic client initialized');
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
      const response = await this.client.messages.create({
        model: options.model,
        max_tokens: options.max_tokens || 4096,
        temperature: options.temperature,
        top_p: options.top_p,
        system: options.system,
        messages: this.convertMessages(options.messages),
        tools: options.tools ? this.convertTools(options.tools) : undefined,
      });

      const latency = Date.now() - startTime;
      this.logger.debug('Completion received', {
        latency,
        usage: response.usage
      });

      return {
        id: response.id,
        message: this.convertResponseMessage(response),
        usage: this.convertUsage(response.usage),
        model: response.model,
        stop_reason: this.convertStopReason(response.stop_reason),
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
      const stream = await this.client.messages.create({
        model: options.model,
        max_tokens: options.max_tokens || 4096,
        temperature: options.temperature,
        top_p: options.top_p,
        system: options.system,
        messages: this.convertMessages(options.messages),
        tools: options.tools ? this.convertTools(options.tools) : undefined,
        stream: true,
      });

      let content = '';
      let toolCalls: ToolCall[] = [];

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          const text = chunk.delta.type === 'text_delta' ? chunk.delta.text : '';
          content += text;

          yield {
            id: `${this.id}-${Date.now()}`,
            content: text,
            done: false,
          };
        } else if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
          const toolCall: ToolCall = {
            id: chunk.content_block.id,
            type: 'function',
            function: {
              name: chunk.content_block.name,
              arguments: JSON.stringify(chunk.content_block.input),
            },
          };
          toolCalls.push(toolCall);

          yield {
            id: `${this.id}-${Date.now()}`,
            content: '',
            tool_calls: [toolCall],
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
      // 간단한 API 호출로 상태 확인
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });

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
    // Anthropic은 현재 모델 목록 API를 제공하지 않음
    // 문서에 명시된 모델 반환
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-sonnet-20241022',
    ];
  }

  /**
   * API 키 검증
   */
  async validateKey(): Promise<boolean> {
    try {
      // 간단한 API 호출로 키 검증
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return true;
    } catch (error) {
      // 401 에러는 키가 유효하지 않음을 의미
      if (error instanceof Anthropic.APIError && error.status === 401) {
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
   * 메시지 변환 (내부 형식 -> Anthropic)
   */
  private convertMessages(messages: ChatMessage[]): Anthropic.Messages.MessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'user' as const,
          content: [{
            type: 'tool_result' as const,
            tool_use_id: msg.tool_call_id || '',
            content: msg.content,
          }],
        };
      }

      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      };
    });
  }

  /**
   * 도구 변환
   */
  private convertTools(tools: NonNullable<LLMRequestOptions['tools']>): Anthropic.Messages.Tool[] {
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters as Anthropic.Messages.Tool.InputSchema,
    }));
  }

  /**
   * 응답 메시지 변환
   */
  private convertResponseMessage(response: Anthropic.Messages.Message): ChatMessage {
    const contentBlocks = response.content;
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of contentBlocks) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      role: 'assistant',
      content,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * 사용량 변환
   */
  private convertUsage(usage: Anthropic.Messages.Usage): TokenUsage {
    return {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      total_tokens: usage.input_tokens + usage.output_tokens,
    };
  }

  /**
   * 종료 이유 변환
   */
  private convertStopReason(
    reason: Anthropic.Messages.Message['stop_reason']
  ): LLMResponse['stop_reason'] {
    switch (reason) {
      case 'end_turn':
        return 'end_turn';
      case 'max_tokens':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      case 'tool_use':
        return 'tool_use';
      default:
        return null;
    }
  }

  /**
   * 에러 래핑
   */
  private wrapError(error: unknown): Error {
    if (error instanceof Anthropic.APIError) {
      return new LLMError(
        `Anthropic API error: ${error.message}`,
        error.status,
        // Anthropic APIError doesn't have a code property, use status as code
        String(error.status)
      );
    }
    return new LLMError(`Unknown error: ${(error as Error).message}`);
  }
}

/**
 * LLM 에러 클래스
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
