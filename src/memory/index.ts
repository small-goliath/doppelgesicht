/**
 * 메모리 시스템 모듈
 * @description Supabase PostgreSQL 기반 대화 기록 저장 및 컨텍스트 관리
 *
 * @example
 * ```typescript
 * import { initializeSupabaseDatabase, initializeSupabaseMemoryManager } from './memory/index.js';
 *
 * // Supabase 데이터베이스 초기화
 * const db = await initializeSupabaseDatabase({
 *   url: process.env.SUPABASE_URL!,
 *   anonKey: process.env.SUPABASE_ANON_KEY!,
 * });
 *
 * // 메모리 관리자 초기화
 * const memory = initializeSupabaseMemoryManager(db);
 *
 * // 세션 생성
 * const session = await memory.createSession({
 *   channelId: 'telegram:123456',
 *   userId: 'user:789',
 *   contextWindow: {
 *     maxMessages: 100,
 *     strategy: ContextStrategy.RECENT_FIRST,
 *     preserveSystemMessages: true,
 *   },
 * });
 *
 * // 메시지 추가
 * await memory.addMessage({
 *   sessionId: session.id,
 *   role: MessageRole.USER,
 *   content: 'Hello!',
 * });
 *
 * // 컨텍스트 윈도우 조회
 * const context = await memory.getContextWindow(session.id);
 * ```
 */

// 타입 재낳ㅇ
export type {
  Session,
  Message,
  ToolCall,
  ToolResult,
  ContextWindowConfig,
  SessionQueryOptions,
  MessageQueryOptions,
  IMemoryManager,
} from './types.js';

// 열거형 재낳ㅇ
export { MessageRole, ContextStrategy } from './types.js';

// Supabase 모듈 (F008)
export * as supabase from './supabase/index.js';

// Supabase 편의 export
export {
  SupabaseDatabaseManager,
  initializeSupabaseDatabase,
  getSupabaseDatabase,
  closeSupabaseDatabase,
} from './supabase/database.js';

export {
  SupabaseMemoryManager,
  initializeSupabaseMemoryManager,
  getSupabaseMemoryManager,
  closeSupabaseMemoryManager,
} from './supabase/manager.js';

export type {
  SupabaseConfig,
  SupabaseMemoryConfig,
} from './supabase/types.js';
