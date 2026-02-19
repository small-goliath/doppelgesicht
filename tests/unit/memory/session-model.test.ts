import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DatabaseManager } from '../../../src/memory/database.js';
import { SessionModel } from '../../../src/memory/models/session.js';
import { ContextStrategy } from '../../../src/memory/types.js';
import type { Session } from '../../../src/memory/types.js';

describe('SessionModel', () => {
  let tempDir: string;
  let dbManager: DatabaseManager;
  let sessionModel: SessionModel;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `doppelgesicht-session-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    dbManager = new DatabaseManager({
      dbPath: join(tempDir, 'test.db'),
    });

    await dbManager.initialize();
    sessionModel = new SessionModel(dbManager);
  });

  afterEach(() => {
    dbManager.close();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  const createTestSession = (): Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'messages'> => ({
    channelId: 'channel-1',
    userId: 'user-1',
    title: 'Test Session',
    contextWindow: {
      maxMessages: 10,
      maxTokens: 1000,
      strategy: ContextStrategy.RECENT_FIRST,
      preserveSystemMessages: true,
    },
    metadata: { key: 'value' },
  });

  describe('create', () => {
    it('세션을 생성해야 함', async () => {
      const data = createTestSession();
      const session = await sessionModel.create(data);

      expect(session.id).toBeDefined();
      expect(session.channelId).toBe(data.channelId);
      expect(session.userId).toBe(data.userId);
      expect(session.title).toBe(data.title);
      expect(session.contextWindow.maxMessages).toBe(data.contextWindow.maxMessages);
      expect(session.metadata).toEqual(data.metadata);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('제목 없이 세션을 생성할 수 있어야 함', async () => {
      const data = createTestSession();
      delete (data as any).title;

      const session = await sessionModel.create(data);
      expect(session.title).toBeUndefined();
    });

    it('메타데이터 없이 세션을 생성할 수 있어야 함', async () => {
      const data = createTestSession();
      delete (data as any).metadata;

      const session = await sessionModel.create(data);
      expect(session.metadata).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('ID로 세션을 조회해야 함', async () => {
      const data = createTestSession();
      const created = await sessionModel.create(data);

      const found = await sessionModel.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.channelId).toBe(data.channelId);
    });

    it('존재하지 않는 ID는 null을 반환해야 함', async () => {
      const found = await sessionModel.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findMany', () => {
    it('세션 목록을 조회해야 함', async () => {
      const data = createTestSession();
      await sessionModel.create(data);
      await sessionModel.create({ ...data, channelId: 'channel-2' });

      const sessions = await sessionModel.findMany();
      expect(sessions).toHaveLength(2);
    });

    it('channelId로 필터링해야 함', async () => {
      const data = createTestSession();
      await sessionModel.create(data);
      await sessionModel.create({ ...data, channelId: 'channel-2' });

      const sessions = await sessionModel.findMany({ channelId: 'channel-1' });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].channelId).toBe('channel-1');
    });

    it('userId로 필터링해야 함', async () => {
      const data = createTestSession();
      await sessionModel.create(data);
      await sessionModel.create({ ...data, userId: 'user-2' });

      const sessions = await sessionModel.findMany({ userId: 'user-1' });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBe('user-1');
    });

    it('limit으로 결과 수를 제한해야 함', async () => {
      const data = createTestSession();
      await sessionModel.create(data);
      await sessionModel.create(data);
      await sessionModel.create(data);

      const sessions = await sessionModel.findMany({ limit: 2 });
      expect(sessions).toHaveLength(2);
    });

    it('offset으로 결과를 건너뛸 수 있어야 함', async () => {
      const data = createTestSession();
      const session1 = await sessionModel.create(data);
      await sessionModel.create(data);

      const sessions = await sessionModel.findMany({ limit: 1, offset: 1 });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).not.toBe(session1.id);
    });
  });

  describe('update', () => {
    it('세션을 업데이트해야 함', async () => {
      const data = createTestSession();
      const created = await sessionModel.create(data);

      const updated = await sessionModel.update(created.id, {
        title: 'Updated Title',
        contextWindow: {
          maxMessages: 20,
          maxTokens: 2000,
          strategy: ContextStrategy.RECENT_FIRST,
          preserveSystemMessages: false,
        },
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.contextWindow.maxMessages).toBe(20);
      expect(updated.contextWindow.preserveSystemMessages).toBe(false);
    });

    it('일부 필드만 업데이트할 수 있어야 함', async () => {
      const data = createTestSession();
      const created = await sessionModel.create(data);

      const updated = await sessionModel.update(created.id, {
        title: 'Only Title Updated',
      });

      expect(updated.title).toBe('Only Title Updated');
      expect(updated.contextWindow.maxMessages).toBe(data.contextWindow.maxMessages);
    });
  });

  describe('delete', () => {
    it('세션을 삭제해야 함', async () => {
      const data = createTestSession();
      const created = await sessionModel.create(data);

      await sessionModel.delete(created.id);

      const found = await sessionModel.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('getMessageCount', () => {
    it('세션의 메시지 수를 반환해야 함', async () => {
      const data = createTestSession();
      const session = await sessionModel.create(data);

      const count = await sessionModel.getMessageCount(session.id);
      expect(count).toBe(0);
    });
  });
});
