import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DatabaseManager } from '../../../src/memory/database.js';
import { SessionModel } from '../../../src/memory/models/session.js';
import { MessageModel } from '../../../src/memory/models/message.js';
import { ContextStrategy, MessageRole } from '../../../src/memory/types.js';
import type { Session, Message } from '../../../src/memory/types.js';

describe('MessageModel', () => {
  let tempDir: string;
  let dbManager: DatabaseManager;
  let sessionModel: SessionModel;
  let messageModel: MessageModel;
  let testSession: Session;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `doppelgesicht-message-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    dbManager = new DatabaseManager({
      dbPath: join(tempDir, 'test.db'),
    });

    await dbManager.initialize();
    sessionModel = new SessionModel(dbManager);
    messageModel = new MessageModel(dbManager);

    // 테스트용 세션 생성
    testSession = await sessionModel.create({
      channelId: 'channel-1',
      userId: 'user-1',
      contextWindow: {
        maxMessages: 10,
        maxTokens: 1000,
        strategy: ContextStrategy.RECENT_FIRST,
        preserveSystemMessages: true,
      },
    });
  });

  afterEach(() => {
    dbManager.close();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  const createTestMessage = (
    overrides: Partial<Omit<Message, 'id' | 'createdAt'>> = {}
  ): Omit<Message, 'id' | 'createdAt'> => ({
    sessionId: testSession.id,
    role: MessageRole.USER,
    content: 'Test message content',
    ...overrides,
  });

  describe('create', () => {
    it('메시지를 생성해야 함', async () => {
      const data = createTestMessage();
      const message = await messageModel.create(data);

      expect(message.id).toBeDefined();
      expect(message.sessionId).toBe(data.sessionId);
      expect(message.role).toBe(data.role);
      expect(message.content).toBe(data.content);
      expect(message.createdAt).toBeInstanceOf(Date);
    });

    it('tool_calls와 함께 메시지를 생성해야 함', async () => {
      const data = createTestMessage({
        role: MessageRole.ASSISTANT,
        content: '',
        toolCalls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'test_function',
              arguments: '{"arg": "value"}',
            },
          },
        ],
      });

      const message = await messageModel.create(data);
      expect(message.toolCalls).toHaveLength(1);
      expect(message.toolCalls?.[0].function.name).toBe('test_function');
    });

    it('metadata와 함께 메시지를 생성해야 함', async () => {
      const data = createTestMessage({
        metadata: { tokens: 100, model: 'gpt-4' },
      });

      const message = await messageModel.create(data);
      expect(message.metadata).toEqual({ tokens: 100, model: 'gpt-4' });
    });
  });

  describe('findById', () => {
    it('ID로 메시지를 조회해야 함', async () => {
      const data = createTestMessage();
      const created = await messageModel.create(data);

      const found = await messageModel.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.content).toBe(data.content);
    });

    it('존재하지 않는 ID는 null을 반환해야 함', async () => {
      const found = await messageModel.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findMany', () => {
    it('메시지 목록을 조회해야 함', async () => {
      await messageModel.create(createTestMessage());
      await messageModel.create(createTestMessage());

      const messages = await messageModel.findMany();
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });

    it('sessionId로 필터링해야 함', async () => {
      await messageModel.create(createTestMessage());

      const messages = await messageModel.findMany({ sessionId: testSession.id });
      expect(messages.every((m) => m.sessionId === testSession.id)).toBe(true);
    });

    it('role로 필터링해야 함', async () => {
      await messageModel.create(createTestMessage({ role: MessageRole.USER }));
      await messageModel.create(createTestMessage({ role: MessageRole.ASSISTANT }));

      const userMessages = await messageModel.findMany({ role: MessageRole.USER });
      expect(userMessages.every((m) => m.role === MessageRole.USER)).toBe(true);
    });

    it('limit으로 결과 수를 제한해야 함', async () => {
      await messageModel.create(createTestMessage());
      await messageModel.create(createTestMessage());
      await messageModel.create(createTestMessage());

      const messages = await messageModel.findMany({ limit: 2 });
      expect(messages).toHaveLength(2);
    });
  });

  describe('findBySessionId', () => {
    it('세션의 모든 메시지를 조회해야 함', async () => {
      await messageModel.create(createTestMessage());
      await messageModel.create(createTestMessage());

      const messages = await messageModel.findBySessionId(testSession.id);
      expect(messages).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('메시지를 삭제해야 함', async () => {
      const data = createTestMessage();
      const created = await messageModel.create(data);

      await messageModel.delete(created.id);

      const found = await messageModel.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('deleteBySessionId', () => {
    it('세션의 모든 메시지를 삭제해야 함', async () => {
      await messageModel.create(createTestMessage());
      await messageModel.create(createTestMessage());

      await messageModel.deleteBySessionId(testSession.id);

      const messages = await messageModel.findBySessionId(testSession.id);
      expect(messages).toHaveLength(0);
    });
  });

  describe('count', () => {
    it('메시지 수를 반환해야 함', async () => {
      await messageModel.create(createTestMessage());
      await messageModel.create(createTestMessage());

      const count = await messageModel.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('sessionId로 필터링하여 카운트해야 함', async () => {
      await messageModel.create(createTestMessage());

      const count = await messageModel.count({ sessionId: testSession.id });
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('role로 필터링하여 카운트해야 함', async () => {
      await messageModel.create(createTestMessage({ role: MessageRole.USER }));

      const count = await messageModel.count({ role: MessageRole.USER });
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
