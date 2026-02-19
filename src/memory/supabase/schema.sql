-- Supabase PostgreSQL 데이터베이스 스키마
-- doppelgesicht 메모리 시스템을 위한 테이블 정의 (RLS 포함)

-- 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 세션 테이블
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT,
    max_messages INTEGER NOT NULL DEFAULT 100,
    max_tokens INTEGER,
    context_strategy TEXT NOT NULL DEFAULT 'recent_first',
    preserve_system_messages BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 세션 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_sessions_channel_id ON sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);

-- 메시지 테이블
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB DEFAULT NULL,
    tool_results JSONB DEFAULT NULL,
    metadata JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 메시지 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 세션 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 세션 업데이트 트리거
DROP TRIGGER IF EXISTS update_session_timestamp ON sessions;
CREATE TRIGGER update_session_timestamp
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_timestamp();

-- 메시지 추가 시 세션 업데이트 시간 갱신 트리거 함수
CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessions SET updated_at = NOW() WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 메시지 추가 트리거
DROP TRIGGER IF EXISTS update_session_on_message ON messages;
CREATE TRIGGER update_session_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_on_message();

-- Row Level Security (RLS) 정책 설정

-- 세션 테이블 RLS 활성화
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- 메시지 테이블 RLS 활성화
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 세션 정책: 사용자는 자신의 세션만 조회 가능
CREATE POLICY "Users can view own sessions" ON sessions
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

-- 세션 정책: 사용자는 자신의 세션만 생성 가능
CREATE POLICY "Users can create own sessions" ON sessions
    FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- 세션 정책: 사용자는 자신의 세션만 수정 가능
CREATE POLICY "Users can update own sessions" ON sessions
    FOR UPDATE
    USING (user_id = current_setting('app.current_user_id', true));

-- 세션 정책: 사용자는 자신의 세션만 삭제 가능
CREATE POLICY "Users can delete own sessions" ON sessions
    FOR DELETE
    USING (user_id = current_setting('app.current_user_id', true));

-- 메시지 정책: 사용자는 자신의 세션의 메시지만 조회 가능
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT
    USING (
        session_id IN (
            SELECT id FROM sessions
            WHERE user_id = current_setting('app.current_user_id', true)
        )
    );

-- 메시지 정책: 사용자는 자신의 세션에 메시지만 생성 가능
CREATE POLICY "Users can create own messages" ON messages
    FOR INSERT
    WITH CHECK (
        session_id IN (
            SELECT id FROM sessions
            WHERE user_id = current_setting('app.current_user_id', true)
        )
    );

-- 메시지 정책: 사용자는 자신의 세션의 메시지만 수정 가능
CREATE POLICY "Users can update own messages" ON messages
    FOR UPDATE
    USING (
        session_id IN (
            SELECT id FROM sessions
            WHERE user_id = current_setting('app.current_user_id', true)
        )
    );

-- 메시지 정책: 사용자는 자신의 세션의 메시지만 삭제 가능
CREATE POLICY "Users can delete own messages" ON messages
    FOR DELETE
    USING (
        session_id IN (
            SELECT id FROM sessions
            WHERE user_id = current_setting('app.current_user_id', true)
        )
    );

-- 관리자 정책: service_role은 모든 작업 가능 (서버 사이드 사용)
CREATE POLICY "Service role has full access to sessions" ON sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to messages" ON messages
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 익명 사용자 정책: 익명 사용자는 작업 불가 (기본값)
CREATE POLICY "Anonymous users cannot access sessions" ON sessions
    FOR ALL
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Anonymous users cannot access messages" ON messages
    FOR ALL
    TO anon
    USING (false)
    WITH CHECK (false);
