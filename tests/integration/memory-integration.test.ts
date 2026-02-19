import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DatabaseManager } from '../../src/memory/database.js';
import { MemoryManager } from '../../src/memory/manager.js';
import { ContextStrategy, MessageRole } from '../../src/memory/types.js';
import type { Session, Message } from '../../src/memory/types.js';

describe('Memory System Integration', () => {
  let tempDir: string;
  let dbManager: DatabaseManager;
  let memoryManager: MemoryManager;

  beforeAll(async () => {
    tempDir = join(tmpdir(), `doppelgesicht-memory-int-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    dbManager = new DatabaseManager({
      dbPath: join(tempDir, 'test.db'),
    });

    await dbManager.initialize();
    memoryManager = new MemoryManager(dbManager);
  });

  afterAll(() => {
    memoryManager.close();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('Session Lifecycle', () => {
    it('should create and retrieve a session', async () => {
      const session = await memoryManager.createSession({
        channelId: 'telegram',
        userId: 'user-123',
        title: 'Test Session',
        contextWindow: {
          maxMessages: 10,
          maxTokens: 1000,
          strategy: ContextStrategy.RECENT_FIRST,
          preserveSystemMessages: true,
        },
        metadata: { test: true },
      });

      expect(session.id).toBeDefined();
      expect(session.channelId).toBe('telegram');
      expect(session.userId).toBe('user-123');
      expect(session.title).toBe('Test Session');

      const retrieved = await memoryManager.getSession(session.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(session.id);
      expect(retrieved?.metadata).toEqual({ test: true });
    });

    it('should list sessions with filters', async () => {
      // Create multiple sessions
      await memoryManager.createSession({
        channelId: 'telegram',
        userId: 'user-1',
        contextWindow: {
          maxMessages: 10,
          strategy: ContextStrategy.RECENT_FIRST,
          preserveSystemMessages: true,
        },
      });

      await memoryManager.createSession({
        channelId: 'slack',
        userId: 'user-2',
        contextWindow: {
          maxMessages: 10,
          strategy: ContextStrategy.RECENT_FIRST,
          preserveSystemMessages: true,
        },
      });

      const allSessions = await memoryManager.listSessions();
      expect(allSessions.length).toBeGreaterThanOrEqual(2);

      const telegramSessions = await memoryManager.listSessions({ channelId: 'telegram' });
      expect(telegramSessions.every(s => s.channelId === 'telegram')).toBe(true);

      const user1Sessions = await memoryManager.listSessions({ userId: 'user-1' });
      expect(user1Sessions.every(s => s.userId === 'user-1')).toBe(true);
    });

    it('should update a session', async () => {
      const session = await memoryManager.createSession({
        channelId: 'telegram',
        userId: 'user-123',
        title: 'Original Title',
        contextWindow: {
          maxMessages: 10,
          strategy: ContextStrategy.RECENT_FIRST,
          preserveSystemMessages: true,
        },
      });

      const updated = await memoryManager.updateSession(session.id, {
        title: 'Updated Title',
        contextWindow: {
          maxMessages: 20,
          maxTokens: 2000,
          strategy: ContextStrategy.IMPORTANT_FIRST,
          preserveSystemMessages: false,
        },
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.contextWindow.maxMessages).toBe(20);
      expect(updated.contextWindow.strategy).toBe(ContextStrategy.IMPORTANT_FIRST);
    });

    it('should delete a session', async () => {
      const session = await memoryManager.createSession({
        channelId: 'telegram',
        userId: 'user-123',
        contextWindow: {
          maxMessages: 10,
          strategy: ContextStrategy.RECENT_FIRST,
          preserveSystemMessages: true,
        },
      });

      await memoryManager.deleteSession(session.id);

      const retrieved = await memoryManager.getSession(session.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Message Lifecycle', () => {
    let testSession: Session;

    beforeAll(async () => {
      testSession = await memoryManager.createSession({
        channelId: 'telegram',
        userId: 'user-123',
        contextWindow: {
          maxMessages: 10,
          strategy: ContextStrategy.RECENT_FIRST,
          preserveSystemMessages: true,
        },
      });
    });

    it('should add messages to a session', async () => {
      const message = await memoryManager.addMessage({
        sessionId: testSession.id,
        role: MessageRole.USER,
        content: 'Hello, AI!',
      });

      expect(message.id).toBeDefined();
      expect(message.sessionId).toBe(testSession.id);
      expect(message.role).toBe(MessageRole.USER);
      expect(message.content).toBe('Hello, AI!');
    });

    it('should retrieve messages for a session', async () => {
      // Add multiple messages
      await memoryManager.addMessage({
        sessionId: testSession.id,
        role: MessageRole.USER,
        content: 'Message 1',
      });

      await memoryManager.addMessage({
        sessionId: testSession.id,
        role: MessageRole.ASSISTANT,
        content: 'Response 1',
      });

      const messages = await memoryManager.getMessages(testSession.id);
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter messages by role', async () => {
      await memoryManager.addMessage({
        sessionId: testSession.id,
        role: MessageRole.SYSTEM,
        content: 'System prompt',
      });

      const systemMessages = await memoryManager.getMessages(testSession.id, {
        role: MessageRole.SYSTEM,
      });

      expect(systemMessages.every(m => m.role === MessageRole.SYSTEM)).toBe(true);
    });

    it('should delete a message', async () => {
      const message = await memoryManager.addMessage({
        sessionId: testSession.id,
        role: MessageRole.USER,
        content: 'To be deleted',
      });

      await memoryManager.deleteMessage(message.id);

      const messages = await memoryManager.getMessages(testSession.id);
      expect(messages.find(m => m.id === message.id)).toBeUndefined();
    });
  });

  describe('Context Window', () => {
    it('should retrieve context window with system messages preserved', async () => {
      const session = await memoryManager.createSession({
        channelId: 'telegram',
        userId: 'user-123',
        contextWindow: {
          maxMessages: 5,
          strategy: ContextStrategy.RECENT_FIRST,
          preserveSystemMessages: true,
        },
      });

      // Add system message
      await memoryManager.addMessage({
        sessionId: session.id,
        role: MessageRole.SYSTEM,
        content: 'You are a helpful assistant.',
      });

      // Add user messages
      for (let i = 0; i < 10; i++) {
        await memoryManager.addMessage({
          sessionId: session.id,
          role: MessageRole.USER,
          content: `Message ${i}`,
        });
      }

      const contextWindow = await memoryManager.getContextWindow(session.id);

      // System message should be preserved
      expect(contextWindow.some(m => m.role === MessageRole.SYSTEM)).toBe(true);

      // Should respect maxMessages limit (system + recent)
      expect(contextWindow.length).toBeLessThanOrEqual(6); // 1 system + 5 recent
    });
  });
});
