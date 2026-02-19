/**
 * LLM 클라이언트 타입 정의
 * @description Anthropic, OpenAI 등 다양한 LLM 제공자의 공통 인터페이스
 */

import type { Logger } from '../logging/index.js';

/**
 * LLM 제공자 타입
 */
export type LLMProvider = 'anthropic' | 'openai' | 'moonshot' | 'bedrock' | 'ollama';

/**
 * 메시지 역할
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * 대화 메시지
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

/**
 * 도구 호출 정보
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 도구 정의
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * LLM 요청 옵션
 */
export interface LLMRequestOptions {
  /** 모델 ID */
  model: string;
  /** 대화 메시지 목록 */
  messages: ChatMessage[];
  /** 사용 가능한 도구 목록 */
  tools?: ToolDefinition[];
  /** 최대 토큰 수 */
  max_tokens?: number;
  /** 온도 (0-2) */
  temperature?: number;
  /** 상위 P 샘플링 */
  top_p?: number;
  /** 스트리밍 여부 */
  stream?: boolean;
  /** 시스템 프롬프트 */
  system?: string;
}

/**
 * LLM 응답 청크 (스트리밍)
 */
export interface LLMStreamChunk {
  /** 청크 ID */
  id: string;
  /** 생성된 콘텐츠 */
  content: string;
  /** 도구 호출 */
  tool_calls?: ToolCall[];
  /** 사용량 정보 */
  usage?: TokenUsage;
  /** 종료 여부 */
  done: boolean;
}

/**
 * LLM 완전 응답
 */
export interface LLMResponse {
  /** 응답 ID */
  id: string;
  /** 생성된 메시지 */
  message: ChatMessage;
  /** 사용량 정보 */
  usage: TokenUsage;
  /** 모델 정보 */
  model: string;
  /** 종료 이유 */
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
}

/**
 * 토큰 사용량
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

/**
 * LLM 클라이언트 설정
 */
export interface LLMClientConfig {
  /** 제공자 */
  provider: LLMProvider;
  /** API 키 */
  apiKey: string;
  /** 기본 모델 */
  defaultModel?: string;
  /** 기본 URL (선택사항) */
  baseURL?: string;
  /** 타임아웃 (ms) */
  timeout?: number;
  /** 최대 재시도 횟수 */
  maxRetries?: number;
  /** 재시도 지연 (ms) */
  retryDelay?: number;
}

/**
 * LLM 클라이언트 인터페이스
 */
export interface ILLMClient {
  /** 클라이언트 ID */
  readonly id: string;
  /** 제공자 */
  readonly provider: LLMProvider;
  /** 설정 */
  readonly config: LLMClientConfig;

  /**
   * 완전 응답 생성 (별칭: complete)
   */
  complete(options: LLMRequestOptions): Promise<LLMResponse>;

  /**
   * 채팅 완성 (OpenAI 스타일 API)
   */
  chatCompletion(options: {
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
  }>;

  /**
   * 스트리밍 응답 생성 (별칭: stream)
   */
  stream(options: LLMRequestOptions): AsyncGenerator<LLMStreamChunk>;

  /**
   * 스트리밍 채팅 완성 (OpenAI 스타일 API)
   */
  streamChatCompletion(options: {
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
  }>;

  /**
   * 클라이언트 상태 확인
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * 사용 가능한 모델 목록
   */
  listModels(): Promise<string[]>;

  /**
   * API 키 검증
   */
  validateKey(): Promise<boolean>;
}

/**
 * 클라이언트 상태
 */
export interface HealthStatus {
  healthy: boolean;
  latency: number;
  error?: string;
  lastChecked: Date;
}

/**
 * LLM 클라이언트 팩토리 옵션
 */
export interface LLMClientFactoryOptions {
  logger?: Logger;
}

/**
 * Fallback 체인 결과
 */
export interface FallbackResult<T> {
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
