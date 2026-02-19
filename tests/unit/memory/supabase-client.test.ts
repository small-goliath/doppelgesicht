import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseDatabaseManager } from '../../../src/memory/supabase/database.js';
import {
  SupabaseMemoryManager,
  initializeSupabaseMemoryManager,
} from '../../../src/memory/supabase/manager.js';
import { ContextStrategy, MessageRole } from '../../../src/memory/types.js';
import type { SupabaseConfig } from '../../../src/memory/supabase/types.js';

// Supabase 클라이언트 모킹
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    from: mockFrom.mockReturnThis(),
    select: mockSelect.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    delete: mockDelete.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
    limit: mockLimit.mockReturnThis(),
    single: mockSingle.mockReturnThis(),
    removeAllChannels: vi.fn(),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
  })),
}));

describe('Supabase Client Unit Tests', () => {
  let dbManager: SupabaseDatabaseManager;
  let memoryManager: SupabaseMemoryManager;
  const mockConfig: SupabaseConfig = {
    url: 'http://localhost:54321',
    anonKey: 'test-anon-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dbManager = new SupabaseDatabaseManager(mockConfig);
  });

  describe('SupabaseDatabaseManager', () => {
    it('should initialize with config', async () => {
      await dbManager.initialize();
      expect(dbManager).toBeDefined();
    });

    it('should create a session', async () => {
      const mockSession = {
        id: 'test-session-id',
        channel_id: 'telegram',
        user_id: 'user-123',
        title: 'Test Session',
        max_messages: 10,
        max_tokens: 1000,
        context_strategy: ContextStrategy.RECENT_FIRST,
        preserve_system_messages: true,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockFrom.mockImplementation((table) => {
        if (table === 'sessions') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockSession,
                  error: null,
                }),
              }),
            }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
          };
        }
        return {};
      });

      await dbManager.initialize();
      const result = await dbManager.createSession({
        channel_id: 'telegram',
        user_id: 'user-123',
        title: 'Test Session',
        max_messages: 10,
        max_tokens: 1000,
        context_strategy: ContextStrategy.RECENT_FIRST,
        preserve_system_messages: true,
      });

      expect(result.error).toBeNull();
    });

    it('should get a session by id', async () => {
      const mockSession = {
        id: 'test-session-id',
        channel_id: 'telegram',
        user_id: 'user-123',
        title: 'Test Session',
        max_messages: 10,
        max_tokens: 1000,
        context_strategy: ContextStrategy.RECENT_FIRST,
        preserve_system_messages: true,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockFrom.mockImplementation((table) => {
        if (table === 'sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockSession,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      await dbManager.initialize();
      const result = await dbManager.getSession('test-session-id');

      expect(result.error).toBeNull();
      if (result.data) {
        expect(result.data.id).toBe('test-session-id');
      }
    });

    it('should create a message', async () => {
      const mockMessage = {
        id: 'test-message-id',
        session_id: 'test-session-id',
        role: MessageRole.USER,
        content: 'Hello!',
        tool_calls: null,
        tool_results: null,
        metadata: {},
        created_at: new Date().toISOString(),
      };

      mockFrom.mockImplementation((table) => {
        if (table === 'messages') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockMessage,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      await dbManager.initialize();
      const result = await dbManager.createMessage({
        session_id: 'test-session-id',
        role: MessageRole.USER,
        content: 'Hello!',
      });

      expect(result.error).toBeNull();
      if (result.data) {
        expect(result.data.content).toBe('Hello!');
      }
    });

    it('should get messages by session id', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          session_id: 'test-session-id',
          role: MessageRole.USER,
          content: 'Hello!',
          tool_calls: null,
          tool_results: null,
          metadata: {},
          created_at: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          session_id: 'test-session-id',
          role: MessageRole.ASSISTANT,
          content: 'Hi there!',
          tool_calls: null,
          tool_results: null,
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ];

      mockFrom.mockImplementation((table) => {
        if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: mockMessages,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await dbManager.initialize();
      const result = await dbManager.getMessagesBySessionId('test-session-id');

      expect(result.error).toBeNull();
      if (result.data) {
        expect(result.data.length).toBe(2);
        expect(result.data[0].role).toBe(MessageRole.USER);
        expect(result.data[1].role).toBe(MessageRole.ASSISTANT);
      }
    });
  });

  describe('SupabaseMemoryManager', () => {
    it('should be initialized with database manager', async () => {
      await dbManager.initialize();
      memoryManager = initializeSupabaseMemoryManager(dbManager);
      expect(memoryManager).toBeDefined();
    });

    it('should create a session through memory manager', async () => {
      const mockSession = {
        id: 'test-session-id',
        channel_id: 'telegram',
        user_id: 'user-123',
        title: 'Test Session',
        max_messages: 10,
        max_tokens: 1000,
        context_strategy: ContextStrategy.RECENT_FIRST,
        preserve_system_messages: true,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockFrom.mockImplementation((table) => {
        if (table === 'sessions') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockSession,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      await dbManager.initialize();
      memoryManager = initializeSupabaseMemoryManager(dbManager);

      const result = await memoryManager.createSession({
        channelId: 'telegram',
        userId: 'user-123',
        title: 'Test Session',
        contextWindow: {
          maxMessages: 10,
          maxTokens: 1000,
          strategy: ContextStrategy.RECENT_FIRST,
          preserveSystemMessages: true,
        },
      });

      expect(result.channelId).toBe('telegram');
      expect(result.userId).toBe('user-123');
    });

    it('should add a message through memory manager', async () => {
      const mockMessage = {
        id: 'test-message-id',
        session_id: 'test-session-id',
        role: MessageRole.USER,
        content: 'Hello from memory manager!',
        tool_calls: null,
        tool_results: null,
        metadata: {},
        created_at: new Date().toISOString(),
      };

      mockFrom.mockImplementation((table) => {
        if (table === 'messages') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockMessage,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      await dbManager.initialize();
      memoryManager = initializeSupabaseMemoryManager(dbManager);

      const result = await memoryManager.addMessage({
        sessionId: 'test-session-id',
        role: MessageRole.USER,
        content: 'Hello from memory manager!',
      });

      expect(result.role).toBe(MessageRole.USER);
      expect(result.content).toBe('Hello from memory manager!');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockFrom.mockImplementation((table) => {
        if (table === 'sessions') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: new Error('Database connection failed'),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await dbManager.initialize();

      const result = await dbManager.createSession({
        channel_id: 'telegram',
        user_id: 'user-123',
      });

      expect(result.error).toBeDefined();
    });
  });
});
