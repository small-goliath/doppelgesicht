/**
 * Gateway HTTP/WebSocket 서버
 * @description Express 기반 HTTP 서버와 ws 기반 WebSocket 서버
 */

import { createServer, type Server as HTTPServer } from 'http';
import express, { type Request, type Response, type NextFunction, type Application } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { Logger } from '../logging/index.js';
import type { ILLMClient } from '../llm/types.js';
import type { IChannelAdapter } from '../channels/types.js';
import type { ApprovalManager } from '../tools/approval/index.js';
import type { MemoryManager } from '../memory/index.js';
import {
  JWTAuth,
  CIDRACLManager,
  generateSessionId,
  generateUserId,
} from './auth.js';
import type {
  GatewayServerConfig,
  WebSocketClient,
  WebSocketMessage,
  APIResponse,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ServerStatus,
  ChannelsListResponse,
  ChannelSendRequest,
  ModelInfo,
} from './types.js';

/**
 * Gateway 서버 클래스
 */
export class GatewayServer {
  private app: Application;
  private httpServer: HTTPServer | null = null;
  private wsServer: WebSocketServer | null = null;
  private config: GatewayServerConfig;
  private logger: Logger;
  private jwtAuth: JWTAuth;
  private aclManager: CIDRACLManager;
  private clients: Map<string, WebSocketClient> = new Map();
  private llmClients: ILLMClient[] = [];
  private channels: Map<string, IChannelAdapter> = new Map();
  private approvalManager?: ApprovalManager;
  private memoryManager?: MemoryManager;
  private startedAt: Date = new Date();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    config: GatewayServerConfig,
    logger: Logger,
    options?: {
      llmClients?: ILLMClient[];
      channels?: IChannelAdapter[];
      approvalManager?: ApprovalManager;
      memoryManager?: MemoryManager;
    }
  ) {
    this.config = config;
    this.logger = logger;
    this.jwtAuth = new JWTAuth(config.jwtSecret);
    this.aclManager = new CIDRACLManager(config.acl);
    this.app = express();

    if (options?.llmClients) {
      this.llmClients = options.llmClients;
    }
    if (options?.channels) {
      for (const channel of options.channels) {
        this.channels.set(channel.id, channel);
      }
    }
    if (options?.approvalManager) {
      this.approvalManager = options.approvalManager;
    }
    if (options?.memoryManager) {
      this.memoryManager = options.memoryManager;
    }

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 미들웨어를 설정합니다
   */
  private setupMiddleware(): void {
    // JSON 파싱
    this.app.use(express.json({ limit: '10mb' }));

    // CORS
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      const allowedOrigins = this.config.cors?.origins || ['http://localhost:3000'];

      if (origin && allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // IP ACL 체크
    this.app.use((req, res, next) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      if (!this.aclManager.isAllowed(ip)) {
        this.logger.warn('Access denied from IP', { ip });
        res.status(403).json(this.createErrorResponse('ACCESS_DENIED', 'Access denied'));
        return;
      }
      next();
    });

    // 요청 로깅
    this.app.use((req, res, next) => {
      const requestId = randomUUID();
      (req as Request & { requestId: string }).requestId = requestId;
      this.logger.debug(`${req.method} ${req.path}`, { requestId, ip: req.ip });
      next();
    });
  }

  /**
   * 라우트를 설정합니다
   */
  private setupRoutes(): void {
    // 헬스 체크
    this.app.get('/v1/health', this.handleHealth.bind(this));

    // 인증 미들웨어 (이후 라우트에 적용)
    this.app.use(this.authenticate.bind(this));

    // 모델 목록
    this.app.get('/v1/models', this.handleModels.bind(this));

    // 채팅 완성
    this.app.post('/v1/chat/completions', this.handleChatCompletions.bind(this));

    // 채널 목록
    this.app.get('/v1/channels', this.handleChannels.bind(this));

    // 채널 메시지 전송
    this.app.post('/v1/channels/send', this.handleChannelSend.bind(this));

    // 404 핸들러
    this.app.use((req, res) => {
      res.status(404).json(this.createErrorResponse('NOT_FOUND', 'Endpoint not found'));
    });

    // 에러 핸들러
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      this.logger.error('Request error', { error: err.message, path: req.path });
      res.status(500).json(this.createErrorResponse('INTERNAL_ERROR', 'Internal server error'));
    });
  }

  /**
   * 인증 미들웨어
   */
  private authenticate(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    const token = this.jwtAuth.extractFromHeader(authHeader);

    if (!token) {
      res.status(401).json(this.createErrorResponse('UNAUTHORIZED', 'Authentication required'));
      return;
    }

    try {
      const payload = this.jwtAuth.verify(token);
      (req as Request & { user: typeof payload }).user = payload;
      next();
    } catch (error) {
      this.logger.warn('Invalid token', { error: (error as Error).message });
      res.status(401).json(this.createErrorResponse('UNAUTHORIZED', 'Invalid or expired token'));
    }
  }

  /**
   * 헬스 체크 핸들러
   */
  private handleHealth(req: Request, res: Response): void {
    const status: ServerStatus = {
      status: 'healthy',
      http: this.httpServer !== null,
      websocket: this.wsServer !== null,
      connections: this.clients.size,
      startedAt: this.startedAt.toISOString(),
      version: '1.0.0',
    };

    res.json(this.createSuccessResponse(status));
  }

  /**
   * 모델 목록 핸들러
   */
  private handleModels(req: Request, res: Response): void {
    const models: ModelInfo[] = [
      {
        id: 'claude-3-opus-20240229',
        owned_by: 'anthropic',
        created: 1708905600,
        permission: [],
      },
      {
        id: 'claude-3-sonnet-20240229',
        owned_by: 'anthropic',
        created: 1708905600,
        permission: [],
      },
      {
        id: 'claude-3-haiku-20240307',
        owned_by: 'anthropic',
        created: 1708905600,
        permission: [],
      },
      {
        id: 'gpt-4',
        owned_by: 'openai',
        created: 1708905600,
        permission: [],
      },
      {
        id: 'gpt-4-turbo',
        owned_by: 'openai',
        created: 1708905600,
        permission: [],
      },
      {
        id: 'gpt-3.5-turbo',
        owned_by: 'openai',
        created: 1708905600,
        permission: [],
      },
    ];

    res.json(this.createSuccessResponse({ data: models }));
  }

  /**
   * 채팅 완성 핸들러
   */
  private async handleChatCompletions(req: Request, res: Response): Promise<void> {
    const body = req.body as ChatCompletionRequest;
    const requestId = (req as Request & { requestId: string }).requestId;

    // 요청 검증
    if (!body.model || !body.messages || body.messages.length === 0) {
      res.status(400).json(this.createErrorResponse('INVALID_REQUEST', 'Missing required fields'));
      return;
    }

    try {
      if (body.stream) {
        // 스트리밍 응답
        await this.handleStreamingChat(req, res, body, requestId);
      } else {
        // 일반 응답
        await this.handleNonStreamingChat(req, res, body, requestId);
      }
    } catch (error) {
      this.logger.error('Chat completion error', { error: (error as Error).message });
      res.status(500).json(this.createErrorResponse('COMPLETION_ERROR', 'Failed to generate completion'));
    }
  }

  /**
   * 스트리밍 채팅 처리
   */
  private async handleStreamingChat(
    req: Request,
    res: Response,
    body: ChatCompletionRequest,
    requestId: string
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const completionId = `chatcmpl-${randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);

    try {
      // 첫 번째 클라이언트로 스트리밍 요청
      const client = this.llmClients[0];
      if (!client) {
        res.write(`data: ${JSON.stringify({ error: 'No LLM client available' })}\n\n`);
        res.end();
        return;
      }

      const stream = await client.streamChatCompletion({
        model: body.model,
        messages: body.messages,
        maxTokens: body.max_tokens,
        temperature: body.temperature,
        tools: body.tools,
      });

      for await (const chunk of stream) {
        const responseChunk: ChatCompletionChunk = {
          id: completionId,
          model: body.model,
          created,
          choices: [
            {
              index: 0,
              delta: {
                content: chunk.content || '',
              },
              finish_reason: chunk.isComplete ? 'stop' : null,
            },
          ],
        };

        res.write(`data: ${JSON.stringify(responseChunk)}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      this.logger.error('Streaming error', { error: (error as Error).message });
      res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
      res.end();
    }
  }

  /**
   * 비스트리밍 채팅 처리
   */
  private async handleNonStreamingChat(
    req: Request,
    res: Response,
    body: ChatCompletionRequest,
    requestId: string
  ): Promise<void> {
    const client = this.llmClients[0];
    if (!client) {
      res.status(503).json(this.createErrorResponse('NO_CLIENT', 'No LLM client available'));
      return;
    }

    const result = await client.chatCompletion({
      model: body.model,
      messages: body.messages,
      maxTokens: body.max_tokens,
      temperature: body.temperature,
      tools: body.tools,
    });

    const response: ChatCompletionResponse = {
      id: `chatcmpl-${randomUUID()}`,
      model: body.model,
      created: Math.floor(Date.now() / 1000),
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.content || '',
          },
          finish_reason: result.stopReason || 'stop',
        },
      ],
      usage: {
        prompt_tokens: result.usage?.inputTokens || 0,
        completion_tokens: result.usage?.outputTokens || 0,
        total_tokens: result.usage?.totalTokens || 0,
      },
    };

    res.json(this.createSuccessResponse(response));
  }

  /**
   * 채널 목록 핸들러
   */
  private handleChannels(req: Request, res: Response): void {
    const channels: ChannelsListResponse['channels'] = Array.from(this.channels.entries()).map(
      ([id, adapter]) => ({
        id,
        name: adapter.name,
        type: adapter.type as 'telegram' | 'slack',
        status: adapter.isConnected() ? 'connected' : 'disconnected',
      })
    );

    res.json(this.createSuccessResponse({ channels }));
  }

  /**
   * 채널 메시지 전송 핸들러
   */
  private async handleChannelSend(req: Request, res: Response): Promise<void> {
    const body = req.body as ChannelSendRequest;

    if (!body.channelId || !body.recipientId || !body.content) {
      res.status(400).json(this.createErrorResponse('INVALID_REQUEST', 'Missing required fields'));
      return;
    }

    const channel = this.channels.get(body.channelId);
    if (!channel) {
      res.status(404).json(this.createErrorResponse('CHANNEL_NOT_FOUND', 'Channel not found'));
      return;
    }

    if (!channel.isConnected()) {
      res.status(503).json(this.createErrorResponse('CHANNEL_DISCONNECTED', 'Channel is not connected'));
      return;
    }

    try {
      await channel.sendMessage({
        recipientId: body.recipientId,
        content: body.content,
        attachments: body.attachments,
      });

      res.json(this.createSuccessResponse({ sent: true }));
    } catch (error) {
      this.logger.error('Channel send error', { error: (error as Error).message });
      res.status(500).json(this.createErrorResponse('SEND_ERROR', 'Failed to send message'));
    }
  }

  /**
   * WebSocket 서버를 설정합니다
   */
  private setupWebSocket(): void {
    if (!this.httpServer) return;

    this.wsServer = new WebSocketServer({
      server: this.httpServer,
      path: '/ws',
      verifyClient: (info, cb) => {
        const ip = info.req.socket.remoteAddress || 'unknown';
        if (!this.aclManager.isAllowed(ip)) {
          cb(false, 403, 'Access denied');
          return;
        }
        cb(true);
      },
    });

    this.wsServer.on('connection', (ws, req) => {
      const clientId = randomUUID();
      const client: WebSocketClient = {
        id: clientId,
        ws,
        connectedAt: new Date(),
        lastPingAt: new Date(),
        metadata: {},
      };

      this.clients.set(clientId, client);
      this.logger.info('WebSocket client connected', { clientId, ip: req.socket.remoteAddress });

      ws.on('message', (data) => this.handleWebSocketMessage(client, data));
      ws.on('close', () => this.handleWebSocketClose(client));
      ws.on('error', (error) => {
        this.logger.error('WebSocket error', { clientId, error: error.message });
      });

      // 연결 성공 메시지
      this.sendWebSocketMessage(client, {
        type: 'auth',
        payload: { clientId, message: 'Connected' },
        timestamp: new Date().toISOString(),
      });
    });

    // 심박수 체크 시작
    this.startHeartbeat();
  }

  /**
   * WebSocket 메시지를 처리합니다
   */
  private handleWebSocketMessage(client: WebSocketClient, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      client.lastPingAt = new Date();

      switch (message.type) {
        case 'ping':
          this.sendWebSocketMessage(client, {
            type: 'pong',
            timestamp: new Date().toISOString(),
          });
          break;

        case 'auth':
          this.handleWebSocketAuth(client, message.payload);
          break;

        case 'subscribe':
          // 구독 처리 (구현 예정)
          break;

        case 'message':
          // 메시지 처리 (구현 예정)
          break;

        default:
          this.sendWebSocketMessage(client, {
            type: 'error',
            payload: { message: 'Unknown message type' },
            timestamp: new Date().toISOString(),
          });
      }
    } catch (error) {
      this.logger.error('WebSocket message error', { error: (error as Error).message });
      this.sendWebSocketMessage(client, {
        type: 'error',
        payload: { message: 'Invalid message format' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * WebSocket 인증 처리
   */
  private handleWebSocketAuth(client: WebSocketClient, payload: unknown): void {
    const { token } = payload as { token?: string };

    if (!token) {
      this.sendWebSocketMessage(client, {
        type: 'error',
        payload: { message: 'Token required' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const payload = this.jwtAuth.verify(token);
      client.session = payload;
      this.sendWebSocketMessage(client, {
        type: 'auth',
        payload: { success: true, userId: payload.sub },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendWebSocketMessage(client, {
        type: 'error',
        payload: { message: 'Invalid token' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * WebSocket 연결 종료 처리
   */
  private handleWebSocketClose(client: WebSocketClient): void {
    this.clients.delete(client.id);
    this.logger.info('WebSocket client disconnected', { clientId: client.id });
  }

  /**
   * WebSocket 메시지를 전송합니다
   */
  private sendWebSocketMessage(client: WebSocketClient, message: WebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 심박수 체크를 시작합니다
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60초 타임아웃

      for (const client of this.clients.values()) {
        if (now - client.lastPingAt.getTime() > timeout) {
          this.logger.warn('Client heartbeat timeout', { clientId: client.id });
          client.ws.close();
          this.clients.delete(client.id);
        }
      }
    }, 30000); // 30초마다 체크
  }

  /**
   * 성공 응답을 생성합니다
   */
  private createSuccessResponse<T>(data: T): APIResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: randomUUID(),
      },
    };
  }

  /**
   * 에러 응답을 생성합니다
   */
  private createErrorResponse(code: string, message: string): APIResponse {
    return {
      success: false,
      error: {
        code,
        message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: randomUUID(),
      },
    };
  }

  /**
   * 서버를 시작합니다
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer(this.app);

      this.httpServer.listen(this.config.httpPort, this.config.host, () => {
        this.logger.info(`HTTP server started on ${this.config.host}:${this.config.httpPort}`);

        // WebSocket 서버 설정
        this.setupWebSocket();

        resolve();
      });

      this.httpServer.on('error', (error) => {
        this.logger.error('HTTP server error', { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * 서버를 중지합니다
   */
  async stop(): Promise<void> {
    // 심박수 체크 중지
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // 모든 WebSocket 클라이언트 종료
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();

    // WebSocket 서버 종료
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }

    // HTTP 서버 종료
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer!.close(() => {
          this.logger.info('HTTP server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * 새로운 세션 토큰을 생성합니다
   * @param scopes - 권한 목록
   * @returns JWT 토큰
   */
  createSessionToken(scopes: string[] = []): string {
    return this.jwtAuth.sign({
      sub: generateUserId(),
      sid: generateSessionId(),
      exp: Math.floor(Date.now() / 1000) + this.config.tokenExpiry,
      scopes,
    });
  }

  /**
   * 현재 연결된 클라이언트 수를 반환합니다
   */
  getConnectionCount(): number {
    return this.clients.size;
  }
}
