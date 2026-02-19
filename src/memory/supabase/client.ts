/**
 * Supabase 클라이언트 초기화 모듈
 * @description @supabase/supabase-js 기반 클라이언트 생성 및 관리
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseConfig, SupabaseConnectionState } from './types.js';

/**
 * Supabase 클라이언트 인스턴스
 */
let supabaseClient: SupabaseClient<any, 'public', any> | null = null;

/**
 * 연결 상태
 */
let connectionState: SupabaseConnectionState = {
  connected: false,
  authenticated: false,
  reconnectAttempts: 0,
};

/**
 * Supabase 클라이언트 초기화
 * @param config - Supabase 연결 설정
 * @returns Supabase 클라이언트 인스턴스
 */
export function initializeSupabaseClient(config: SupabaseConfig): SupabaseClient<any, 'public', any> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: config.options?.auth?.persistSession ?? true,
      autoRefreshToken: config.options?.auth?.autoRefreshToken ?? true,
    },
    db: {
      schema: config.options?.db?.schema ?? 'public',
    },
  }) as SupabaseClient<any, 'public', any>;

  supabaseClient = client;
  return client;
}

/**
 * Supabase 클라이언트 조회
 * @returns 초기화된 Supabase 클라이언트 또는 null
 */
export function getSupabaseClient(): SupabaseClient<any, 'public', any> | null {
  return supabaseClient;
}

/**
 * Supabase 클라이언트가 초기화되었는지 확인
 * @returns 초기화 여부
 */
export function isSupabaseInitialized(): boolean {
  return supabaseClient !== null;
}

/**
 * Supabase 연결 테스트
 * @returns 연결 성공 여부
 */
export async function testSupabaseConnection(): Promise<boolean> {
  if (!supabaseClient) {
    return false;
  }

  try {
    // 간단한 쿼리로 연결 테스트
    const { error } = await supabaseClient.from('sessions').select('id').limit(1);

    if (error) {
      connectionState.connected = false;
      connectionState.lastError = error.message;
      return false;
    }

    connectionState.connected = true;
    connectionState.lastError = undefined;
    connectionState.reconnectAttempts = 0;
    return true;
  } catch (error) {
    connectionState.connected = false;
    connectionState.lastError = (error as Error).message;
    return false;
  }
}

/**
 * Supabase 연결 상태 조회
 * @returns 현재 연결 상태
 */
export function getSupabaseConnectionState(): SupabaseConnectionState {
  return { ...connectionState };
}

/**
 * Supabase 클라이언트 종료
 */
export function closeSupabaseClient(): void {
  if (supabaseClient) {
    supabaseClient.removeAllChannels();
    supabaseClient = null;
  }

  connectionState = {
    connected: false,
    authenticated: false,
    reconnectAttempts: 0,
  };
}

/**
 * 실시간 구독 설정
 * @param table - 구독할 테이블
 * @param callback - 이벤트 콜백
 * @returns 구독 해제 함수
 */
export function subscribeToTable(
  table: 'sessions' | 'messages',
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown> | null;
    old: Record<string, unknown> | null;
  }) => void
): () => void {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const subscription = supabaseClient
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as Record<string, unknown> | null,
          old: payload.old as Record<string, unknown> | null,
        });
      }
    )
    .subscribe();

  // 구독 해제 함수 반환
  return () => {
    subscription.unsubscribe();
  };
}
