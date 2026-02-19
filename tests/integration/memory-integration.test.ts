import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SupabaseDatabaseManager } from '../../src/memory/supabase/database.js';
import { SupabaseMemoryManager, initializeSupabaseMemoryManager } from '../../src/memory/supabase/manager.js';
import { ContextStrategy, MessageRole } from '../../src/memory/types.js';
import type { Session } from '../../src/memory/types.js';

describe('Memory System Integration', () => {
  let dbManager: SupabaseDatabaseManager;
  let memoryManager: SupabaseMemoryManager;

  beforeAll(async () => {
    // Note: These should be set in environment variables for actual tests
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'test-key';

    dbManager = new SupabaseDatabaseManager({
      url: supabaseUrl,
      anonKey: supabaseKey,
    });

    await dbManager.initialize();
    memoryManager = initializeSupabaseMemoryManager(dbManager);
  });

  afterAll(async () => {
    await memoryManager.close();
  });

  describe('Session Lifecycle', () => {
    it('should create and retrieve a session', async () => {
      const result = await memoryManager.createSession({
        channel_id: 'telegram',
        user_id: 'user-123',
        title: 'Test Session',
        max_messages: 10,
        max_tokens: 1000,
        context_strategy: ContextStrategy.RECENT_FIRST,
        preserve_system_messages: true,
        metadata: { test: true },
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data!.id).toBeDefined();
      expect(result.data!.channelId).toBe('telegram');
      expect(result.data!.userId).toBe('user-123');
      expect(result.data!.title).toBe('Test Session');

      const retrieved = await memoryManager.getSession(result.data!.id);
      expect(retrieved.error).toBeNull();
      expect(retrieved.data).not.toBeNull();
      expect(retrieved.data!.id).toBe(result.data!.id);
    });

    it('should list sessions with filters', async () => {
      // Create multiple sessions
      await memoryManager.createSession({
        channel_id: 'telegram',
        user_id: 'user-1',
        max_messages: 10,
        context_strategy: ContextStrategy.RECENT_FIRST,
        preserve_system_messages: true,
      });

      await memoryManager.createSession({
        channel_id: 'slack',
        user_id: 'user-2',
        max_messages: 10,
        context_strategy: ContextStrategy.RECENT_FIRST,
        preserve_system_messages: true,
      });

      const allSessions = await memoryManager.listSessions();
      expect(allSessions.error).toBeNull();
      expect(allSessions.data!.length).toBeGreaterThanOrEqual(2);

      const telegramSessions = await memoryManager.listSessions({ channelId: 'telegram' });
      expect(telegramSessions.error).toBeNull();
      expect(telegramSessions.data!.every(s => s.channelId === 'telegram')).toBe(true);

      const user1Sessions = await memoryManager.listSessions({ userId: 'user-1' });
      expect(user1Sessions.error).toBeNull();
      expect(user1Sessions.data!.every(s => s.userId === 'user-1')).toBe(true);
    });

    it('should update a session', async () => {
      const created = await memoryManager.createSession({
        channel_id: 'telegram',
        user_id: 'user-123',
        title: 'Original Title',
        max_messages: 10,
        context_strategy: ContextStrategy.RECENT_FIRST,
        preserve_system_messages: true,
      });

      const updated = await memoryManager.updateSession(created.data!.id, {
        title: 'Updated Title',
        max_messages: 20,
        max_tokens: 2000,
        context_strategy: ContextStrategy.IMPORTANT_FIRST,
        preserve_system_messages: false,
      });

      expect(updated.error).toBeNull();
      expect(updated.data!.title).toBe('Updated Title');
      expect(updated.data!.contextWindow.maxMessages).toBe(20);
      expect(updated.data!.contextWindow.strategy).toBe(ContextStrategy.IMPORTANT_FIRST);
    });

    it('should delete a session', async () => {
      const created = await memoryManager.createSession({
        channel_id: 'telegram',
        user_id: 'user-123',
        max_messages: 10,
        context_strategy: ContextStrategy.RECENT_FIRST,
        preserve_system_messages: true,
      });

      const deleted = await memoryManager.deleteSession(created.data!.id);
      expect(deleted.error).toBeNull();

      const retrieved = await memoryManager.getSession(created.data!.id);
      expect(retrieved.data).toBeNull();
    });
  });

  describe('Message Lifecycle', () => {
    let testSession: Session;

    beforeAll(async () => {
      const result = await memoryManager.createSession({
        channel_id: 'telegram',
        user_id: 'user-123',
        max_messages: 10,
        context_strategy: ContextStrategy.RECENT_FIRST,
        preserve_system_messages: true,
      });
      testSession = result.data!;
    });

    it('should add messages to a session', async () => {
      const result = await memoryManager.createMessage({
        session_id: testSession.id,
        role: MessageRole.USER,
        content: 'Hello, AI!',
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data!.sessionId).toBe(testSession.id);
      expect(result.data!.role).toBe(MessageRole.USER);
      expect(result.data!.content).toBe('Hello, AI!');
    });

    it('should retrieve messages for a session', async () => {
      // Add multiple messages
      await memoryManager.createMessage({
        session_id: testSession.id,
        role: MessageRole.USER,
        content: 'Message 1',
      });

      await memoryManager.createMessage({
        session_id: testSession.id,
        role: MessageRole.ASSISTANT,
        content: 'Response 1',
      });

      const messages = await memoryManager.getMessagesBySessionId(testSession.id);
      expect(messages.error).toBeNull();
      expect(messages.data!.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter messages by role', async () => {
      await memoryManager.createMessage({
        session_id: testSession.id,
        role: MessageRole.SYSTEM,
        content: 'System prompt',
      });

      const systemMessages = await memoryManager.listMessages({
        sessionId: testSession.id,
        role: MessageRole.SYSTEM,
      });

      expect(systemMessages.error).toBeNull();
      expect(systemMessages.data!.every(m => m.role === MessageRole.SYSTEM)).toBe(true);
    });

    it('should delete a message', async () => {
      const created = await memoryManager.createMessage({
        session_id: testSession.id,
        role: MessageRole.USER,
        content: 'To be deleted',
      });

      await memoryManager.deleteMessage(created.data!.id);

      const messages = await memoryManager.getMessagesBySessionId(testSession.id);
      expect(messages.data!.find(m => m.id === created.data!.id)).toBeUndefined();
    });
  });

  describe('Context Window', () => {
    it('should retrieve context window with system messages preserved', async () => {
      const sessionResult = await memoryManager.createSession({
        channel_id: 'telegram',
        user_id: 'user-123',
        max_messages: 5,
        context_strategy: ContextStrategy.RECENT_FIRST,
        preserve_system_messages: true,
      });
      const session = sessionResult.data!;

      // Add system message
      await memoryManager.createMessage({
        session_id: session.id,
        role: MessageRole.SYSTEM,
        content: 'You are a helpful assistant.',
      });

      // Add user messages
      for (let i = 0; i < 10; i++) {
        await memoryManager.createMessage({
          session_id: session.id,
          role: MessageRole.USER,
          content: `Message ${i}`,
        });
      }

      const contextWindow = await memoryManager.getContextWindow(session.id);

      // System message should be preserved
      expect(contextWindow.some(m => m.role === MessageRole.SYSTEM)).toBe(true);
    });
  });
});
