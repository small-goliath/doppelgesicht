/**
 * Supabase 메모리 모듈
 * @description @supabase/supabase-js 기반 PostgreSQL 연동 및 로컬 캐시 폴리
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
  reconnectSupabase,
  setLocalCacheMode,
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

export {
  migrateToSupabase,
  verifyMigration,
  type MigrationResult,
} from './migrate.js';
