/**
 * SQLite to Supabase 마이그레이션 스크립트
 * @description 기존 SQLite 데이터를 Supabase PostgreSQL로 마이그레이션
 */

import { existsSync } from 'fs';
import type { DatabaseConfig } from '../types.js';
import type { SupabaseConfig } from './types.js';
import { DatabaseManager } from '../database.js';
import { SupabaseDatabaseManager } from './database.js';

/**
 * 마이그레이션 결과
 */
export interface MigrationResult {
  success: boolean;
  sessionsMigrated: number;
  messagesMigrated: number;
  errors: string[];
}

/**
 * SQLite에서 Supabase로 데이터 마이그레이션
 * @param sqliteConfig - SQLite 데이터베이스 설정
 * @param supabaseConfig - Supabase 연결 설정
 * @returns 마이그레이션 결과
 */
export async function migrateToSupabase(
  sqliteConfig: DatabaseConfig,
  supabaseConfig: SupabaseConfig
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    sessionsMigrated: 0,
    messagesMigrated: 0,
    errors: [],
  };

  // SQLite 데이터베이스 존재 확인
  if (!existsSync(sqliteConfig.dbPath)) {
    result.errors.push(`SQLite database not found: ${sqliteConfig.dbPath}`);
    return result;
  }

  // SQLite 데이터베이스 초기화
  const sqliteDb = new DatabaseManager(sqliteConfig);
  await sqliteDb.initialize();

  // Supabase 데이터베이스 초기화 (로컬 캐시 없이)
  const supabaseDb = new SupabaseDatabaseManager(supabaseConfig);
  await supabaseDb.initialize();

  try {
    // 세션 데이터 조회
    const sessions = await sqliteDb.runInQueue(() => {
      const stmt = sqliteDb.prepare('SELECT * FROM sessions');
      return stmt.all() as Array<{
        id: string;
        channel_id: string;
        user_id: string;
        title: string | null;
        max_messages: number;
        max_tokens: number | null;
        context_strategy: string;
        preserve_system_messages: number;
        metadata: string | null;
        created_at: string;
        updated_at: string;
      }>;
    });

    // 메시지 데이터 조회
    const messages = await sqliteDb.runInQueue(() => {
      const stmt = sqliteDb.prepare('SELECT * FROM messages');
      return stmt.all() as Array<{
        id: string;
        session_id: string;
        role: string;
        content: string;
        tool_calls: string | null;
        tool_results: string | null;
        metadata: string | null;
        created_at: string;
      }>;
    });

    console.log(`Found ${sessions.length} sessions and ${messages.length} messages to migrate`);

    // 세션 마이그레이션
    for (const session of sessions) {
      try {
        const { error } = await supabaseDb.createSession({
          channel_id: session.channel_id,
          user_id: session.user_id,
          title: session.title || undefined,
          max_messages: session.max_messages,
          max_tokens: session.max_tokens || undefined,
          context_strategy: session.context_strategy,
          preserve_system_messages: session.preserve_system_messages === 1,
          metadata: session.metadata ? JSON.parse(session.metadata) : undefined,
        });

        if (error) {
          result.errors.push(`Failed to migrate session ${session.id}: ${error.message}`);
        } else {
          result.sessionsMigrated++;
        }
      } catch (error) {
        result.errors.push(`Failed to migrate session ${session.id}: ${(error as Error).message}`);
      }
    }

    // 메시지 마이그레이션
    for (const message of messages) {
      try {
        const { error } = await supabaseDb.createMessage({
          session_id: message.session_id,
          role: message.role,
          content: message.content,
          tool_calls: message.tool_calls ? JSON.parse(message.tool_calls) : undefined,
          tool_results: message.tool_results ? JSON.parse(message.tool_results) : undefined,
          metadata: message.metadata ? JSON.parse(message.metadata) : undefined,
        });

        if (error) {
          result.errors.push(`Failed to migrate message ${message.id}: ${error.message}`);
        } else {
          result.messagesMigrated++;
        }
      } catch (error) {
        result.errors.push(`Failed to migrate message ${message.id}: ${(error as Error).message}`);
      }
    }

    result.success = result.errors.length === 0;

    console.log(`Migration completed:`);
    console.log(`  Sessions migrated: ${result.sessionsMigrated}/${sessions.length}`);
    console.log(`  Messages migrated: ${result.messagesMigrated}/${messages.length}`);
    console.log(`  Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error) => console.log(`  - ${error}`));
    }

    return result;
  } finally {
    // 연결 종료
    sqliteDb.close();
    await supabaseDb.close();
  }
}

/**
 * 마이그레이션 결과 검증
 * @param sqliteConfig - SQLite 데이터베이스 설정
 * @param supabaseConfig - Supabase 연결 설정
 * @returns 검증 결과
 */
export async function verifyMigration(
  sqliteConfig: DatabaseConfig,
  supabaseConfig: SupabaseConfig
): Promise<{
  valid: boolean;
  sessionCount: { sqlite: number; supabase: number };
  messageCount: { sqlite: number; supabase: number };
  errors: string[];
}> {
  const result = {
    valid: false,
    sessionCount: { sqlite: 0, supabase: 0 },
    messageCount: { sqlite: 0, supabase: 0 },
    errors: [] as string[],
  };

  // SQLite 데이터베이스 초기화
  const sqliteDb = new DatabaseManager(sqliteConfig);
  await sqliteDb.initialize();

  // Supabase 데이터베이스 초기화
  const supabaseDb = new SupabaseDatabaseManager(supabaseConfig);
  await supabaseDb.initialize();

  try {
    // SQLite 카운트
    const sqliteSessionCount = await sqliteDb.runInQueue(() => {
      const stmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM sessions');
      const row = stmt.get() as { count: number };
      return row.count;
    });

    const sqliteMessageCount = await sqliteDb.runInQueue(() => {
      const stmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM messages');
      const row = stmt.get() as { count: number };
      return row.count;
    });

    // Supabase 카운트
    const supabaseSessionCount = await supabaseDb.listSessions();
    const supabaseMessageCount = await supabaseDb.listMessages();

    result.sessionCount.sqlite = sqliteSessionCount;
    result.sessionCount.supabase = supabaseSessionCount.data?.length || 0;
    result.messageCount.sqlite = sqliteMessageCount;
    result.messageCount.supabase = supabaseMessageCount.data?.length || 0;

    // 검증
    if (result.sessionCount.sqlite !== result.sessionCount.supabase) {
      result.errors.push(
        `Session count mismatch: SQLite=${result.sessionCount.sqlite}, Supabase=${result.sessionCount.supabase}`
      );
    }

    if (result.messageCount.sqlite !== result.messageCount.supabase) {
      result.errors.push(
        `Message count mismatch: SQLite=${result.messageCount.sqlite}, Supabase=${result.messageCount.supabase}`
      );
    }

    result.valid = result.errors.length === 0;

    return result;
  } finally {
    sqliteDb.close();
    await supabaseDb.close();
  }
}
