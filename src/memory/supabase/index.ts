/**
 * Supabase 메모리 모듈
 * @description @supabase/supabase-js 기반 PostgreSQL 연동
 */

export type {
  SupabaseConfig,
  SupabaseMemoryConfig,
  SupabaseSessionRow,
  SupabaseMessageRow,
  SupabaseConnectionState,
  SupabaseRealtimeConfig,
  SupabaseRealtimePayload,
  SupabaseQueryResult,
  SupabaseQueryListResult,
  CreateSessionInput,
  CreateMessageInput,
  UpdateSessionInput,
} from './types.js';

export {
  initializeSupabaseClient,
  getSupabaseClient,
  isSupabaseInitialized,
  testSupabaseConnection,
  getSupabaseConnectionState,
  closeSupabaseClient,
  subscribeToTable,
} from './client.js';

export {
  SupabaseDatabaseManager,
  initializeSupabaseDatabase,
  getSupabaseDatabase,
  closeSupabaseDatabase,
} from './database.js';

export {
  SupabaseMemoryManager,
  initializeSupabaseMemoryManager,
  getSupabaseMemoryManager,
  closeSupabaseMemoryManager,
} from './manager.js';

