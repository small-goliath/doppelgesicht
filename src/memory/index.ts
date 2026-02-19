/**
 * 메모리 시스템 모듈
 * @description SQLite 기반 대화 기록 저장 및 컨텍스트 관리
 *
 * @example
 * ```typescript
 * import { initializeDatabase, initializeMemoryManager } from './memory/index.js';
 *
 * // 데이터베이스 초기화
 * const db = await initializeDatabase({
 *   dbPath: '~/.doppelgesicht/memory.db',
 * });
 *
 * // 메모리 관리자 초기화
 * const memory = initializeMemoryManager(db);
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
  IDatabaseConnection,
  DatabaseConfig,
  QueueTask,
} from './types.js';

// 열거형 재낳ㅇ
export { MessageRole, ContextStrategy } from './types.js';

// 데이터베이스
export {
  DatabaseManager,
  initializeDatabase,
  getDatabase,
  closeDatabase,
} from './database.js';

// 동시성 제어
export { AccessQueue, ReadWriteLock } from './queue.js';

// 모델
export { SessionModel } from './models/session.js';
export { MessageModel } from './models/message.js';

// 메모리 관리자
export {
  MemoryManager,
  initializeMemoryManager,
  getMemoryManager,
  closeMemoryManager,
} from './manager.js';
