-- SQLite 데이터베이스 스키마
-- doppelgesicht 메모리 시스템을 위한 테이블 정의

-- 세션 테이블
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT,
    max_messages INTEGER NOT NULL DEFAULT 100,
    max_tokens INTEGER,
    context_strategy TEXT NOT NULL DEFAULT 'recent_first',
    preserve_system_messages INTEGER NOT NULL DEFAULT 1,
    metadata TEXT, -- JSON 문자열
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 세션 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_sessions_channel_id ON sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);

-- 메시지 테이블
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT NOT NULL,
    tool_calls TEXT, -- JSON 문자열 (ToolCall[])
    tool_results TEXT, -- JSON 문자열 (ToolResult[])
    metadata TEXT, -- JSON 문자열
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 메시지 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 세션 업데이트 트리거
CREATE TRIGGER IF NOT EXISTS update_session_timestamp
AFTER UPDATE ON sessions
BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 메시지 추가 시 세션 업데이트 시간 갱신 트리거
CREATE TRIGGER IF NOT EXISTS update_session_on_message
AFTER INSERT ON messages
BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.session_id;
END;
