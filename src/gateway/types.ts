/**
 * Gateway 서버 타입 정의
 * @description HTTP/WebSocket 서버 관련 타입
 */

import type { Request, Response } from 'express';
import type { WebSocket } from 'ws';

/**
 * HTTP 요청 핸들러 타입
 */
export type HTTPHandler = (req: Request, res: Response) => Promise<void> | void;

/**
 * WebSocket 클라이언트 정보
 */
export interface WebSocketClient {
  /** 클라이언트 ID */
  id: string;
  /** WebSocket 인스턴스 */
  ws: WebSocket;
  /** 연결 시간 */
  connectedAt: Date;
  /** 마지막 ping 시간 */
  lastPingAt: Date;
  /** 인증된 세션 */
  session?: JWTPayload;
  /** 메타데이터 */
  metadata: Record<string, unknown>;
}

/**
 * JWT 페이로드
 */
export interface JWTPayload {
  /** 사용자 ID */
  sub: string;
  /** 세션 ID */
  sid: string;
  /** 발급 시간 */
  iat: number;
  /** 만료 시간 */
  exp: number;
  /** 권한 */
  scopes: string[];
}

/**
 * 에러 정보
 */
export interface APIError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * API 응답 표준 형식
 */
export interface APIResponse<T = unknown> {
  /** 성공 여부 */
  success: boolean;
  /** 응답 데이터 */
  data?: T;
  /** 에러 정보 */
  error?: APIError;
  /** 메타데이터 */
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

/**
 * 채팅 완성 요청
 */
export interface ChatCompletionRequest {
  /** 모델 ID */
  model: string;
  /** 메시지 목록 */
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  /** 스트리밍 여부 */
  stream?: boolean;
  /** 최대 토큰 수 */
  max_tokens?: number;
  /** 온도 */
  temperature?: number;
  /** 도구 목록 */
  tools?: Array<{
    type: string;
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

/**
 * 채팅 완성 응답
 */
export interface ChatCompletionResponse {
  /** 응답 ID */
  id: string;
  /** 모델 ID */
  model: string;
  /** 생성 시간 */
  created: number;
  /** 선택지 목록 */
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  /** 사용량 */
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 스트리밍 청크 응답
 */
export interface ChatCompletionChunk {
  /** 응답 ID */
  id: string;
  /** 모델 ID */
  model: string;
  /** 생성 시간 */
  created: number;
  /** 선택지 */
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * 모델 정보
 */
export interface ModelInfo {
  /** 모델 ID */
  id: string;
  /** 소유자 */
  owned_by: string;
  /** 생성 시간 */
  created: number;
  /** 권한 */
  permission: Array<{
    id: string;
    object: string;
    created: number;
    allow_create_engine: boolean;
    allow_sampling: boolean;
    allow_logprobs: boolean;
    allow_search_indices: boolean;
    allow_view: boolean;
    allow_fine_tuning: boolean;
    organization: string;
    group: string | null;
    is_blocking: boolean;
  }>;
}

/**
 * 채널 목록 응답
 */
export interface ChannelsListResponse {
  /** 채널 목록 */
  channels: Array<{
    id: string;
    name: string;
    type: 'telegram' | 'slack';
    status: 'connected' | 'disconnected' | 'error';
  }>;
}

/**
 * 채널 메시지 전송 요청
 */
export interface ChannelSendRequest {
  /** 채널 ID */
  channelId: string;
  /** 수신자 ID */
  recipientId: string;
  /** 메시지 내용 */
  content: string;
  /** 첨부 파일 */
  attachments?: Array<{
    name: string;
    type: string;
    content: string;
  }>;
}

/**
 * WebSocket 메시지 타입
 */
export type WebSocketMessageType =
  | 'ping'
  | 'pong'
  | 'auth'
  | 'subscribe'
  | 'unsubscribe'
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'error';

/**
 * WebSocket 메시지
 */
export interface WebSocketMessage {
  /** 메시지 타입 */
  type: WebSocketMessageType;
  /** 메시지 ID */
  id?: string;
  /** 페이로드 */
  payload?: unknown;
  /** 타임스탬프 */
  timestamp: string;
}

/**
 * CIDR ACL 설정
 */
export interface CIDRACL {
  /** 허용 CIDR 목록 */
  allow: string[];
  /** 차단 CIDR 목록 */
  deny: string[];
}

/**
 * Gateway 설정
 */
export interface GatewayServerConfig {
  /** HTTP 포트 */
  httpPort: number;
  /** WebSocket 포트 */
  wsPort: number;
  /** 호스트 */
  host: string;
  /** JWT 시크릿 */
  jwtSecret: string;
  /** 토큰 만료 시간 (초) */
  tokenExpiry: number;
  /** CIDR ACL */
  acl?: CIDRACL;
  /** CORS 설정 */
  cors?: {
    origins: string[];
  };
}

/**
 * LLM 클라이언트 상태
 */
export interface LLMClientStatus {
  /** 클라이언트 ID */
  id: string;
  /** 제공자 */
  provider: string;
  /** 상태 */
  healthy: boolean;
  /** 지연 시간 (ms) */
  latency?: number;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 서버 상태
 */
export interface ServerStatus {
  /** 서버 상태 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** HTTP 서버 상태 */
  http: boolean;
  /** WebSocket 서버 상태 */
  websocket: boolean;
  /** 활성 연결 수 */
  connections: number;
  /** 시작 시간 */
  startedAt: string;
  /** 버전 */
  version: string;
  /** LLM 클라이언트 상태 목록 */
  llmClients?: LLMClientStatus[];
}
