/**
 * LLM 클라이언트 모듈
 * @description Anthropic, OpenAI 등 다양한 LLM 제공자 통합
 */

export type {
  ILLMClient,
  LLMClientConfig,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  ChatMessage,
  ToolCall,
  ToolDefinition,
  TokenUsage,
  HealthStatus,
  LLMProvider,
  MessageRole,
} from './types.js';

export { AnthropicClient, LLMError } from './anthropic.js';
export { OpenAIClient, OpenAIError } from './openai.js';

import type { ILLMClient, LLMClientConfig, LLMProvider } from './types.js';
import { AnthropicClient } from './anthropic.js';
import { OpenAIClient } from './openai.js';
import type { Logger } from '../logging/index.js';

interface FallbackResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: {
    clientId: string;
    provider: LLMProvider;
    success: boolean;
    error?: string;
  }[];
}

/**
 * LLM 클라이언트 팩토리
 */
export function createLLMClient(
  config: LLMClientConfig,
  logger: Logger
): ILLMClient {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicClient(config, logger);
    case 'openai':
      return new OpenAIClient(config, logger);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Fallback 체인으로 LLM 요청 실행
 */
export async function executeWithFallback<T>(
  clients: ILLMClient[],
  operation: (client: ILLMClient) => Promise<T>,
  logger?: Logger
): Promise<FallbackResult<T>> {
  const attempts: FallbackResult<T>['attempts'] = [];

  for (const client of clients) {
    try {
      logger?.debug(`Trying client: ${client.id}`);
      const result = await operation(client);

      attempts.push({
        clientId: client.id,
        provider: client.provider,
        success: true,
      });

      return {
        success: true,
        result,
        attempts,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger?.warn(`Client ${client.id} failed`, { error: errorMessage });

      attempts.push({
        clientId: client.id,
        provider: client.provider,
        success: false,
        error: errorMessage,
      });
    }
  }

  return {
    success: false,
    attempts,
    error: new Error('All clients failed'),
  };
}
