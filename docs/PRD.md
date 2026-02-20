# doppelgesicht MVP PRD

## 🎯 핵심 정보

**목적**: 개인 기기에서 실행되는 로컬 AI 어시스턴트 플랫폼으로, 기존 메신저(Telegram, Slack 등)를 통해 응답하며 데이터 프라이버시를 보장
**사용자**: 기술에 익숙한 개인 사용자로, 자신의 데이터를 로컬에서 관리하고 싶어하는 개발자/전문가

---

## 🚶 사용자 여정

```
1. CLI 설치 및 초기 설정 (onboard)
   ↓ doppelgesicht onboard 실행

2. 마스터 비밀번호 설정
   ↓ 자격 증명 암호화 설정 (Argon2id + AES-256-GCM)

3. LLM 프로파일 구성
   ↓ Anthropic/OpenAI/Moonshot API 키 입력 및 암호화 저장

4. 채널 연결 설정
   ↓ Telegram/Slack/Discord 봇 토큰 입력

5. Gateway 시작
   ↓ doppelgesicht gateway 실행

6. 메신저에서 AI 대화 시작
   ↓ 사용자가 Telegram/Slack/Discord에서 메시지 전송

7. AI 응답 수신
   ↓ 도구 실행 필요 시 승인 요청 (CLI 모드: 터미널 UI, Daemon 모드: 자동 거부 또는 화이트리스트)

8. 대화 완료 및 로그아웃
```

---

## ⚡ 기능 명세

### 1. MVP 핵심 기능

| ID | 기능명 | 설명 | MVP 필수 이유 | 관련 페이지 |
|----|--------|------|-------------|------------|
| **F001** | 마스터 키 파생 및 암호화 | Argon2id 기반 마스터 키 생성, AES-256-GCM 자격 증명 암호화 | 데이터 프라이버시 핵심, 평문 저장 방지 | Onboard CLI, 인증 프로파일 관리 |
| **F002** | LLM 클라이언트 통합 | Anthropic Claude, OpenAI GPT, Moonshot Kimi API 연동 | AI 응답 생성 핵심 기능 | Gateway 서버, Agent 대화 |
| **F003** | Auth Profile 관리 | 다중 LLM 프로파일 저장, fallback 체인, rate limiting | 다양한 모델 활용 및 안정성 | 인증 프로파일 관리, Gateway 서버 |
| **F004** | Telegram 채널 연동 | Telegram Bot API를 통한 메시지 수신/발신 | 핵심 메신저 채널 | 채널 설정 |
| **F005** | Slack 채널 연동 | Slack Bolt를 통한 메시지 수신/발신 | 핵심 메신저 채널 | 채널 설정 |
| **F005-1** | Discord 채널 연동 | Discord.js를 통한 메시지 수신/발신 | 핵심 메신저 채널 | 채널 설정 |
| **F006** | Bash 도구 실행 | 터미널 명령어 실행, 출력 캡처 | 파일 시스템 접근 및 작업 수행 | Agent 대화 |
| **F007** | 도구 승인 시스템 | 위험도 기반 실행 전 승인 요청 (CLI/Daemon 모드 차별화) | 안전한 AI 작업 위임 | 승인 UI, Gateway 서버 |
| **F008** | 메모리 시스템 | Supabase 기반 대화 기록 저장, 문맥 관리 | 연속적인 대화 가능 | 데이터 레이어 |
| **F009** | Gateway HTTP/WebSocket | REST API 및 실시간 연결 서버 | 외부 채널 연결 허브 | Gateway 서버 |
| **F010** | CLI 명령어 | onboard, gateway, agent, config, auth, message, browser 명령어 | 사용자 인터페이스 | 전체 CLI |
| **F014** | 메시지 전송 테스트 | CLI에서 직접 채널로 메시지 전송 테스트 | 채널 연결 검증 | message CLI |
| **F015** | Web UI - Chat | 브라우저에서 직접 doppelgesicht와 대화 | 직접 AI 상호작용 | Web UI |
| **F016** | Web UI - Channels | Telegram/Slack/Discord 설정 관리 | 채널 설정 GUI | Web UI |
| **F017** | Web UI - Cron Jobs | 주기적 작업 등록/관리 | 자동화 작업 관리 | Web UI |
| **F018** | Web UI - Agents | LLM 에이전트 프로파일 관리 | 에이전트 설정 GUI | Web UI |
| **F019** | Web UI - Skills | 커스텀 스킬 등록 및 관리 | 스킬 마켓플레이스 | Web UI |
| **F020** | Web UI - Config | 환경변수 및 설정 파일 편집 | 설정 GUI | Web UI |
| **F021** | Web UI - Logs | 실시간 로그 스트리밍 | 로그 모니터링 | Web UI |

### 2. MVP 필수 지원 기능

| ID | 기능명 | 설명 | MVP 필수 이유 | 관련 페이지 |
|----|--------|------|-------------|------------|
| **F011** | 설정 파일 관리 | YAML 기반 설정, 환경변수 참조, 핫 리로드 | 유연한 구성 관리 | 설정 관리 |
| **F012** | 로깅 시스템 | 구조화된 JSON 로깅, 디버그 모드 | 문제 해결 및 모니터링 | 전체 시스템 |
| **F013** | Browser 샌드박스 | isolated-vm 기반 코드 검증, Playwright 실행 (2계층 검증) | 안전한 브라우저 자동화 | browser CLI, Agent 시스템 |

### 3. MVP 이후 기능 (제외)

- WhatsApp, Signal 등 추가 채널
- 음성 통화 기능
- Canvas A2UI 렌더링
- ~~스킬/확장 시스템~~ → F019 포함
- ~~Web UI 대시보드~~ → F015-F021 포함
- 모바일 앱 (iOS/Android)
- 고급 메모리 (LanceDB 벡터 검색)
- 데이터 보존 정책 및 PII 마스킹
- SSO 및 고급 인증

---

## 📱 메뉴 구조

```
🔧 doppelgesicht CLI
├── 🚀 onboard - F010
│   └── 기능: 초기 설정 마법사, 마스터 키 설정 (F001)
├── 🌐 gateway - F010
│   └── 기능: Gateway 서버 시작 (F009, F002, F003, F007)
├── 🤖 agent - F010
│   └── 기능: AI 대화 시작, 도구 실행 (F002, F006, F007)
├── 📨 message - F014
│   └── 기능: 메시지 전송 테스트 (F004, F005, F005-1)
├── ⚙️ config - F010
│   └── 기능: 설정 관리 (F011)
├── 🔐 auth - F010
│   └── 기능: 인증 프로파일 관리 (F001, F003)
└── 🌐 browser - F010
    └── 기능: 브라우저 자동화 (F013)

🌐 Web UI (http://localhost:8080/admin)
├── 💬 Chat - F015
│   └── 기능: 브라우저에서 직접 AI 대화
├── 🎛️ Control
│   ├── 📱 Channels - F016
│   │   └── 기능: Telegram/Slack/Discord 설정 관리
│   └── ⏰ Cron Jobs - F017
│       └── 기능: 주기적 작업 등록/관리
├── 🤖 Agent
│   ├── 🎭 Agents - F018
│   │   └── 기능: LLM 에이전트 프로파일 관리
│   └── 🛠️ Skills - F019
│       └── 기능: 커스텀 스킬 등록 및 관리
└── ⚙️ Settings
    ├── 🔧 Config - F020
    │   └── 기능: 환경변수 및 설정 파일 편집
    └── 📋 Logs - F021
        └── 기능: 실시간 로그 스트리밍

📋 설정 파일 구조 (~/.doppelgesicht/)
├── config.yaml - F011
│   └── 기능: 사용자 설정, 채널 설정, LLM 프로파일
├── auth-profiles.json (암호화) - F001
│   └── 기능: 암호화된 자격 증명 저장
└── supabase/ - F008
    └── 기능: Supabase 연결 설정 및 마이그레이션
```

---

## 📄 페이지별 상세 기능

### Onboard CLI (초기 설정)

> **구현 기능:** `F001`, `F010`, `F011` | **메뉴 위치:** doppelgesicht onboard

| 항목 | 내용 |
|------|------|
| **역할** | 첫 실행 시 마스터 비밀번호 설정 및 초기 구성 수행 |
| **진입 경로** | 터미널에서 `doppelgesicht onboard` 실행 |
| **사용자 행동** | • 마스터 비밀번호 입력 (최소 12자, 복잡도 요구)<br>• 비밀번호 확인 입력<br>• LLM 제공자 선택 (Anthropic/OpenAI/Moonshot)<br>• API 키 입력<br>• Telegram/Slack/Discord 봇 토큰 입력 (선택)<br>• Supabase 연결 설정 (URL, API Key) |
| **주요 기능** | • Argon2id 기반 마스터 키 파생 (64MB memory, 3 iterations, 4 parallelism)<br>• AES-256-GCM 암호화 설정 (256-bit salt, 12-byte nonce, 16-byte auth tag)<br>• 설정 파일 초기 생성 (version: "2")<br>• OS 키체인 통합 시도 (macOS/Windows/Linux)<br>• Supabase 프로젝트 연결 설정 및 초기 테이블 생성<br>• 기존 평문 자격 증명 마이그레이션 프롬프트 (F001-5)<br>• **[완료]** 설정 저장 및 Gateway 시작 안내 |
| **에러 처리** | 비밀번호 불일치 → 재입력 요청<br>OS 키체인 실패 → 파일 기반 폴에러 반환 및 서버 시작 차단 안내<br>API 키 검증 실패 → 재입력 또는 스킵 |
| **다음 이동** | 성공 → Gateway 시작 안내, 실패 → 오류 메시지 및 재시도 |

---

### Gateway 서버

> **구현 기능:** `F002`, `F003`, `F007`, `F008`, `F009`, `F012` | **메뉴 위치:** doppelgesicht gateway

| 항목 | 내용 |
|------|------|
| **역할** | HTTP/WebSocket 서버로 채널 연결 및 AI 대화 오케스트레이션 |
| **진입 경로** | 터미널에서 `doppelgesicht gateway` 실행 또는 onboard 완료 후 자동 시작 |
| **사용자 행동** | • 서버 시작 대기<br>• 로그 출력 확인<br>• 메신저에서 메시지 전송<br>• 도구 승인 요청 응답 (CLI 포그라운드 모드에서만) |
| **주요 기능** | • HTTP API 엔드포인트 제공<br>&nbsp;&nbsp;- POST /v1/chat/completions (AI 대화)<br>&nbsp;&nbsp;- GET /v1/models (사용 가능한 모델)<br>&nbsp;&nbsp;- GET /v1/health (헬스 체크)<br>&nbsp;&nbsp;- POST /v1/channels/send (메시지 전송)<br>&nbsp;&nbsp;- GET /v1/channels (채널 목록)<br>• WebSocket 실시간 연결 관리 (심박수, 메시지 큐)<br>• Auth Profile 해결 및 fallback 처리 (라운드 로빈, 건강한 프로파일 우선)<br>• LLM 클라이언트 호출 (Anthropic/OpenAI/Moonshot 스트리밍 응답)<br>• 도구 실행 감지 및 승인 요청 (위험도 평가: low/medium/high/critical)<br>• 메모리 저장/검색 (Supabase PostgreSQL, 실시간 구독 지원)<br>• **[중지]** Ctrl+C로 서버 종료 |
| **에러 처리** | LLM API 실패 → fallback 프로파일로 재시도 (최대 3회)<br>Rate limit 초과 → exponential backoff (1s, 2s, 4s)<br>채널 연결 끊김 → 자동 재연결 (최대 5회)<br>마스터 키 복호화 실패 → 서버 시작 차단, onboard 재실행 안내 |
| **다음 이동** | 실행 중 → 메신저 대화 모드, 종료 → CLI로 복귀 |

---

### Agent 대화 (CLI)

> **구현 기능:** `F002`, `F006`, `F007`, `F010` | **메뉴 위치:** doppelgesicht agent

| 항목 | 내용 |
|------|------|
| **역할** | 터미널에서 직접 AI와 대화하고 도구 실행 |
| **진입 경로** | 터미널에서 `doppelgesicht agent` 실행 |
| **사용자 행동** | • 자연어 프롬프트 입력<br>• 도구 승인/거부 응답 (터미널 인터랙티브 UI)<br>• 대화 종료 명령 입력 |
| **주요 기능** | • 프롬프트 입력 수신 (readline 인터페이스)<br>• LLM API 호출 (스트리밍 응답, 청크 단위 출력)<br>• 도구 호출 감지 (exec, browser, channel_send)<br>• 위험도 평가 및 승인 UI 표시 (@clack/prompts)<br>• 도구 실행 및 결과 전달<br>• **[종료]** exit/quit 명령으로 종료 |
| **에러 처리** | LLM 응답 스트림 중단 → 재시도 버튼 제공<br>도구 실행 실패 → 오류 메시지 AI에 전달<br>타임아웃 (60s) → 자동 거부 처리 |
| **다음 이동** | 종료 → CLI로 복귀 |

---

### 채널 설정

> **구현 기능:** `F004`, `F005`, `F011` | **메뉴 위치:** config.yaml 채널 섹션

| 항목 | 내용 |
|------|------|
| **역할** | Telegram/Slack/Discord 채널 연결 설정 관리 |
| **진입 경로** | onboard 중 또는 `doppelgesicht config`로 설정 파일 편집 |
| **사용자 행동** | • 봇 토큰 입력<br>• 허용 사용자 목록 설정<br>• 채널 활성화/비활성화 |
| **주요 기능** | • Telegram Bot API 토큰 검증 (getMe 호출)<br>• Slack App/Bot 토큰 검증 (auth.test 호출)<br>• Discord Bot 토큰 검증 (gateway 연결 테스트)<br>• allowed_users 화이트리스트 관리<br>• 채널 어댑터 초기화<br>• **[저장]** 설정 파일 저장 및 Gateway 리로드 |
| **에러 처리** | 토큰 검증 실패 → 오류 메시지 표시 (403: 권한 없음, 404: 토큰 무효)<br>중복 채널 ID → 충돌 경고 |
| **다음 이동** | 저장 → Gateway 자동 리로드 또는 수동 재시작 안내 |

---

### 인증 프로파일 관리

> **구현 기능:** `F001`, `F003` | **메뉴 위치:** doppelgesicht auth

| 항목 | 내용 |
|------|------|
| **역할** | LLM 제공자별 API 키 및 인증 정보 암호화 저장 |
| **진입 경로** | `doppelgesicht auth add`, `doppelgesicht auth list`, `doppelgesicht auth remove` 등 |
| **사용자 행동** | • 제공자 선택 (anthropic/openai/moonshot)<br>• 인증 방식 선택 (oauth/api_key)<br>• 자격 증명 입력<br>• 프로파일 목록 확인 |
| **주요 기능** | • AES-256-GCM 암호화 저장 (마스터 키로 암호화)<br>• 마스터 키로 복호화 (런타임에 메모리에만 보관)<br>• 프로파일 우선순위/fallback 설정 (순서 지정)<br>• rate limit 및 health check 설정 (기본값: 60req/min)<br>• 프로파일 상태 모니터링 (healthy/degraded/cooldown)<br>• **[추가/삭제/수정]** 프로파일 관리 |
| **에러 처리** | 마스터 키 없음 → onboard 실행 안내<br>복호화 실패 → 비밀번호 재입력 요청 (최대 3회)<br>API 검증 실패 → 프로파일 상태 degraded로 설정 |
| **다음 이동** | 완료 → 설정 저장, 프로파일 사용 가능 |

---

### 승인 UI (도구 실행 승인)

> **구현 기능:** `F007` | **메뉴 위치:** Gateway/Agent 실행 중 자동 표시

| 항목 | 내용 |
|------|------|
| **역할** | 위험한 도구 실행 전 사용자 승인 요청 |
| **진입 경로** | AI가 exec, file_write 등 위험 도구 호출 시 자동 표시 |
| **사용자 행동** | • 제안된 작업 검토<br>• 승인/거부/항상 허용 선택<br>• 타임아웃 내 응답 |
| **주요 기능** | • **위험도 분류 및 평가:**<br>&nbsp;&nbsp;- Critical (빨강): exec, browser, file_write → 항상 승인 필요<br>&nbsp;&nbsp;- High (주황): file_read, web_fetch → 대부분 승인 필요<br>&nbsp;&nbsp;- Medium (노랑): web_search → 문맥 기반<br>&nbsp;&nbsp;- Low (초록): info → 자동 승인<br>• 색상 기반 위험 표시<br>• 실행 명령 평문 표시 (예: "exec rm -rf /dangerous/path")<br>• 승인 선택지 제공 (Yes/No/Always/Always Deny)<br>• 타임아웃: 기본 60초, 고위험 120초 (타임아웃 시 기본값: 거부)<br>• **실행 모드별 동작:**<br>&nbsp;&nbsp;- **CLI 포그라운드 모드**: 터미널 인터랙티브 UI (@clack/prompts)<br>&nbsp;&nbsp;- **Daemon 모드**: 화이트리스트 기반 자동 승인, 미등록 도구는 자동 거부<br>• **[응답]** 승인 시 실행, 거부 시 AI에 거부 알림 |
| **에러 처리** | 승인 UI 표시 실패 → 자동 거부 (안전 기본값)<br>사용자 인터럽트 (Ctrl+C) → 실행 취소, AI에 알림 |
| **다음 이동** | 승인 → 도구 실행 → 결과 AI 전달, 거부 → AI에 거부 알림 |

---

### 설정 관리 (Config CLI)

> **구현 기능:** `F011`, `F012` | **메뉴 위치:** doppelgesicht config

| 항목 | 내용 |
|------|------|
| **역할** | 설정 파일 조회, 수정, 검증 |
| **진입 경로** | `doppelgesicht config get`, `doppelgesicht config set`, `doppelgesicht config validate` 등 |
| **사용자 행동** | • 설정 키 조회<br>• 설정 값 변경<br>• 설정 파일 검증 |
| **주요 기능** | • YAML 설정 파일 읽기/쓰기<br>• 환경변수 참조 해석 (${VAR} 문법)<br>• 설정 스키마 검증 (Zod 스키마)<br>• 핫 리로드 트리거 (파일 변경 감시)<br>• **[적용]** 변경사항 저장 및 적용 |
| **에러 처리** | 스키마 검증 실패 → 구체적인 오류 위치 표시<br>환경변수 미정의 → 경고 메시지<br>YAML 문법 오류 → 라인 번호 표시 |
| **다음 이동** | 적용 → Gateway 리로드 또는 재시작 필요 시 안내 |

---

### Browser 샌드박스 (browser CLI)

> **구현 기능:** `F013` | **메뉴 위치:** doppelgesicht browser

| 항목 | 내용 |
|------|------|
| **역할** | AI 생성 JavaScript 코드의 안전한 브라우저 자동화 실행 |
| **진입 경로** | `doppelgesicht browser` 또는 Agent 대화 중 browser 도구 호출 |
| **사용자 행동** | • URL 입력 또는 JavaScript 코드 제공<br>• 실행 결과 확인 |
| **주요 기능** | • **2계층 검증 시스템:**<br>&nbsp;&nbsp;- **Layer 1 (Node.js)**: 정적 분석 + isolated-vm 샌드박스<br>&nbsp;&nbsp;- **Layer 2 (Browser)**: Playwright CDP로 검증된 코드 실행<br>• 정적 분석 규칙 (Tier 1 - Blocking):<br>&nbsp;&nbsp;- eval-usage: `\beval\s*\(` (Critical)<br>&nbsp;&nbsp;- new-function: `new\s+Function\s*\(` (Critical)<br>&nbsp;&nbsp;- child-process: `require\s*\(\s*['"]child_process['"]\s*\)` (Critical)<br>&nbsp;&nbsp;- fs-access: `require\s*\(\s*['"]fs['"]\s*\)` (High)<br>&nbsp;&nbsp;- network-fetch: `fetch\s*\(|axios|request\s*\(` (High)<br>&nbsp;&nbsp;- env-access: `process\.env` (Medium)<br>• isolated-vm 샌드박스 제약:<br>&nbsp;&nbsp;- 30초 타임아웃<br>&nbsp;&nbsp;- 256MB 메모리 제한<br>&nbsp;&nbsp;- 제한된 console, 파일/네트워크 접근 불가<br>• Playwright 브라우저 컨텍스트 실행 (eval() 없음)<br>• **[실행]** 검증된 코드만 브라우저로 전송 |
| **에러 처리** | 정적 분석 실패 → 오류 메시지 표시 (차단된 패턴 명시)<br>isolated-vm 타임아웃 → 강제 종료, 오류 반환<br>Playwright 연결 실패 → 재시도 (최대 3회) |
| **다음 이동** | 성공 → 결과 반환, 실패 → 오류 메시지 |

---

### 메시지 전송 테스트 (message CLI)

> **구현 기능:** `F014` | **메뉴 위치:** doppelgesicht message

| 항목 | 내용 |
|------|------|
| **역할** | CLI에서 직접 채널로 메시지 전송하여 연결 테스트 |
| **진입 경로** | `doppelgesicht message send --channel <channelId> --text "message"` |
| **사용자 행동** | • 채널 ID 선택<br>• 메시지 텍스트 입력<br>• 전송 실행 |
| **주요 기능** | • 채널 목록 조회<br>• 메시지 전송 실행<br>• 전송 결과 확인 |
| **에러 처리** | 채널 미연결 → 연결 설정 안내<br>전송 실패 → 오류 메시지 (권한/네트워크) |
| **다음 이동** | 성공 → 확인 메시지, 실패 → 오류 표시 |

---

### Web UI - Chat

> **구현 기능:** `F015` | **메뉴 위치:** http://localhost:8080/admin/chat

| 항목 | 내용 |
|------|------|
| **역할** | 브라우저에서 직접 doppelgesicht와 대화 |
| **진입 경로** | Gateway 실행 후 브라우저에서 `/admin/chat` 접속 |
| **사용자 행동** | • 메시지 입력 및 전송<br>• 파일 첨부 (이미지, 문서)<br>• 도구 승인/거부 응답<br>• 대화 세션 저장/불러오기 |
| **주요 기능** | • 실시간 스트리밍 응답 표시<br>• 도구 호출 시 승인 UI 표시 (위험도별 색상)<br>• 대화 기록 로컬 저장 (localStorage)<br>• 파일 드래그 앤 드롭 첨부<br>• **[도구 승인]** Critical/High/Medium/Low 위험도 표시 및 승인/거부 버튼 |
| **에러 처리** | LLM 연결 실패 → 오류 메시지 및 재연결 버튼<br>도구 실행 실패 → 오류 내용 표시<br>파일 첨부 실패 → 파일 크기/형식 오류 표시 |
| **다음 이동** | 지속적인 대화, 다른 페이지 이동 가능 |

---

### Web UI - Channels

> **구현 기능:** `F016` | **메뉴 위치:** http://localhost:8080/admin/control/channels

| 항목 | 내용 |
|------|------|
| **역할** | Telegram/Slack/Discord 채널 설정 및 모니터링 |
| **진입 경로** | `/admin/control/channels` 접속 |
| **사용자 행동** | • 채널 활성화/비활성화 토글<br>• 봇 토큰 입력 및 검증<br>• 허용 사용자 목록 관리<br>• 연결 상태 확인 |
| **주요 기능** | • 채널별 연결 상태 실시간 표시 (WebSocket)<br>• 봇 토큰 입력 및 유효성 검사 (getMe/auth.test)<br>• 허용 사용자 추가/삭제 (사용자 ID 입력)<br>• 연결 테스트 버튼<br>• **[저장]** 설정 변경 시 자동 저장 및 Gateway 핫 리로드 |
| **에러 처리** | 토큰 무효 → 빨간색 오류 표시<br>연결 끊김 → 자동 재연결 시도 상태 표시<br>권한 부족 → 필요한 권한 목록 표시 |
| **다음 이동** | 설정 저장 → 실시간 적용, Chat 페이지에서 테스트 |

---

### Web UI - Cron Jobs

> **구현 기능:** `F017` | **메뉴 위치:** http://localhost:8080/admin/control/cron

| 항목 | 내용 |
|------|------|
| **역할** | 주기적 작업 등록, 관리 및 모니터링 |
| **진입 경로** | `/admin/control/cron` 접속 |
| **사용자 행동** | • 작업 목록 확인<br>• 새 작업 등록 (스케줄, 명령어)<br>• 작업 활성화/비활성화<br>• 즉시 실행 버튼 클릭 |
| **주요 기능** | • Cron 작업 목록 표 (이름, 스케줄, 상태, 마지막/다음 실행)<br>• Cron 표현식 빌더 (분/시/일/월/요일 선택)<br>• 실행할 명령어/스크립트 입력<br>• 작업 실행 로그 조회<br>• **[실행]** 즉시 실행 버튼으로 테스트 |
| **에러 처리** | Cron 표현식 오류 → 실시간 유효성 검사<br>작업 실행 실패 → 로그에 오류 표시<br>중복 작업 이름 → 경고 메시지 |
| **다음 이돤** | 작업 등록 → 자동 스케줄링 시작 |

---

### Web UI - Agents

> **구현 기능:** `F018` | **메뉴 위치:** http://localhost:8080/admin/agent/agents

| 항목 | 내용 |
|------|------|
| **역할** | LLM 에이전트 프로파일 관리 및 모니터링 |
| **진입 경로** | `/admin/agent/agents` 접속 |
| **사용자 행동** | • 에이전트 목록 확인<br>• 새 에이전트 등록 (API 키)<br>• 우선순위/fallback 설정<br>• 상태 확인 |
| **주요 기능** | • 에이전트 카드 목록 (제공자, 모델, 상태, latency)<br>• 새 에이전트 추가 폼 (제공자 선택, API 키, 모델)<br>• 드래그 앤 드롭 우선순위 설정<br>• 상태 표시 (🟢 healthy / 🟡 degraded / 🔴 cooldown)<br>• **[테스트]** API 키 유효성 테스트 버튼 |
| **에러 처리** | API 키 무효 → 빨간색 경고<br>Rate limit 초과 → 쿨다운 상태 표시<br>모든 에이전트 실패 → 경고 배너 표시 |
| **다음 이동** | 설정 저장 → fallback 체인 자동 적용 |

---

### Web UI - Skills

> **구현 기능:** `F019` | **메뉴 위치:** http://localhost:8080/admin/agent/skills

| 항목 | 내용 |
|------|------|
| **역할** | 커스텀 스킬 등록, 설정 및 관리 |
| **진입 경로** | `/admin/agent/skills` 접속 |
| **사용자 행동** | • 스킬 목록 확인<br>• 스킬 등록 (GitHub URL/로컬 경로)<br>• 스킬 활성화/비활성화<br>• 스킬 설정 편집 |
| **주요 기능** | • 스킬 카드 그리드 (이름, 버전, 설명, 활성 상태)<br>• 스킬 등록 모달 (GitHub URL 또는 로컬 경로 입력)<br>• 스킬 설정 JSON/YAML 편집기<br>• 활성화 토글 스위치<br>• **[삭제]** 스킬 제거 버튼 |
| **에러 처리** | 스킬 로드 실패 → 오류 메시지 및 로그<br>설정 스키마 오류 → 편집기에 오류 하이라이트<br>의존성 충족 안됨 → 필요한 도구/스킬 표시 |
| **다음 이동** | 활성화 → Chat/Agent에서 스킬 사용 가능 |

---

### Web UI - Config

> **구현 기능:** `F020` | **메뉴 위치:** http://localhost:8080/admin/settings/config

| 항목 | 내용 |
|------|------|
| **역할** | 환경변수 및 설정 파일 관리 |
| **진입 경로** | `/admin/settings/config` 접속 |
| **사용자 행동** | • 설정 파일 조회<br>• YAML/JSON 편집<br>• 환경변수 관리<br>• 백업/복원 |
| **주요 기능** | • Monaco Editor 기반 YAML/JSON 편집기<br>• 구문 하이라이팅 및 에러 표시<br>• 환경변수 테이블 (키-값, ${VAR:default} 문법 지원)<br>• 설정 검증 버튼 (Zod 스키마 검증)<br>• **[백업]** 설정 백업 다운로드 / **[복원]** 백업 업로드 |
| **에러 처리** | YAML 문법 오류 → 라인 번호 하이라이트<br>스키마 검증 실패 → 구체적인 오류 메시지<br>환경변수 미정의 → 경고 아이콘 표시 |
| **다음 이동** | 저장 → 자동 핫 리로드 또는 재시작 필요 시 알림 |

---

### Web UI - Logs

> **구현 기능:** `F021` | **메뉴 위치:** http://localhost:8080/admin/settings/logs

| 항목 | 내용 |
|------|------|
| **역할** | 실시간 로그 스트리밍 및 조회 |
| **진입 경로** | `/admin/settings/logs` 접속 |
| **사용자 행동** | • 실시간 로그 모니터링<br>• 로그 레벨 필터링<br>• 키워드 검색<br>• 로그 다운로드 |
| **주요 기능** | • WebSocket 기반 실시간 로그 스트리밍 (자동 스크롤)<br>• 로그 레벨 필터 (debug/info/warn/error 체크박스)<br>• 검색어 하이라이트 및 필터링<br>• 로그 라인 클릭 → 상세 정보 확장 (JSON)<br>• **[다운로드]** 특정 기간 로그 다운로드 / **[정리]** 오래된 로그 정리 |
| **에러 처리** | WebSocket 끊김 → 자동 재연결<br>로그 파일 접근 실패 → 권한 오류 표시<br>검색 결과 없음 → "결과 없음" 메시지 |
| **다음 이동** | 지속적인 모니터링, 다른 설정 페이지 이동 |

---

## 🗄️ 데이터 모델

### AuthProfile (암호화된 인증 프로파일)

| 필드 | 설명 | 타입 |
|------|------|------|
| id | 프로파일 고유 식별자 | string |
| provider | LLM 제공자 (anthropic/openai/moonshot/bedrock/ollama) | string |
| type | 인증 방식 (oauth/api_key) | string |
| credentials | AES-256-GCM 암호화된 자격 증명 | EncryptedData |
| rateLimits | API 호출 제한 설정 | { requestsPerMinute: number } |
| health | 프로파일 상태 (healthy/degraded/cooldown) | string |
| lastUsed | 마지마 사용 시간 | ISO8601 |
| failCount | 연속 실패 횟수 | number |
| priority | fallback 체인 우선순위 | number |

### Session (대화 세션)

| 필드 | 설명 | 타입 |
|------|------|------|
| id | 세션 고유 식별자 | string |
| channelId | 채널 식별자 | string |
| userId | 사용자 식별자 | string |
| messages | 메시지 배열 (role, content, timestamp) | Message[] |
| contextWindow | 컨텍스트 윈도우 관리 정보 | { tokens: number, compressed: boolean } |
| createdAt | 생성 시간 | ISO8601 |
| updatedAt | 마지막 업데이트 시간 | ISO8601 |

### ChannelConfig (채널 설정)

| 필드 | 설명 | 타입 |
|------|------|------|
| id | 채널 식별자 | string |
| type | 채널 타입 (telegram/slack/discord) | string |
| enabled | 활성화 여부 | boolean |
| credentials | 채널별 인증 정보 (토큰 등, 암호화) | EncryptedData |
| allowedUsers | 허용된 사용자 목록 | string[] |
| capabilities | 채널 지원 기능 | { text, images, audio, reactions, threads } |

### ApprovalRequest (승인 요청)

| 필드 | 설명 | 타입 |
|------|------|------|
| requestId | 요청 고유 식별자 | UUID |
| tool | 도구 이름 | string |
| params | 도구 파라미터 | Record<string, unknown> |
| riskLevel | 위험 수준 (low/medium/high/critical) | string |
| riskScore | 위험 점수 (0.0 - 1.0) | number |
| timestamp | 요청 시간 | ISO8601 |
| status | 상태 (pending/approved/denied) | string |
| mode | 실행 모드 (foreground/daemon) | string |

---

## 🛠️ 기술 스택 (최신 버전)

### 🎨 코어 런타임

- **Node.js 22.12.0+** - LTS 런타임 (>=22.12.0)
- **TypeScript 5.9+** - 타입 시스템
- **pnpm 10.23.0** - 패키지 매니저

### 🖥️ CLI & Gateway

- **Commander.js 14.0.3** - CLI 프레임워크
- **Express 5.2.1** - HTTP 서버
- **ws 8.19.0** - WebSocket 서버

### 🤖 LLM 클라이언트

- **@anthropic-ai/sdk 0.24.3** - Claude API
- **openai 4.x** - OpenAI API
- **@moonshot-ai/sdk** (또는 OpenAI 호환 API) - Moonshot Kimi API

### 💬 메신저 채널

- **grammy 1.40.0** - Telegram Bot API
- **@slack/bolt 4.6.0** - Slack 프레임워크
- **@slack/web-api 7.14.0** - Slack Web API
- **discord.js 14.x** - Discord Bot API

### 🗄️ 데이터 저장

- **@supabase/supabase-js 2.x** - Supabase 클라이언트 (PostgreSQL + 실시간)
- **supabase** - 클라우드 PostgreSQL 데이터베이스

### 🔒 보안

- **argon2** - 마스터 키 파생 (Argon2id)
  - memoryCost: 65536 (64 MB)
  - timeCost: 3
  - parallelism: 4
  - saltLength: 32
  - hashLength: 32
- **isolated-vm** - JavaScript 샌드박스
- **playwright-core 1.58.2** - 브라우저 자동화

### 📝 검증 & 유틸리티

- **zod 4.3.6** - 스키마 검증
- **@sinclair/typebox 0.34.48** - JSON Schema
- **chalk 5.6.2** - 터미널 색상
- **@clack/prompts 1.0.1** - CLI 인터랙티브 프롬프트

### 🧪 개발 도구

- **Vitest** - 테스트 프레임워크
- **oxlint** - 린팅 (type-aware)
- **oxfmt** - 코드 포맷팅
- **tsx** - TypeScript 실행
- **tsdown/rolldown** - 번들링

---

## ⚙️ 비기능 요구사항

### 성능 목표

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| LLM 응답 시작 시간 | < 2초 (첫 번째 청크) | API 호출부터 첫 응답까지 |
| 메신저 메시지 처리 | < 500ms (end-to-end) | 메시지 수신부터 응답 발송까지 |
| 도구 승인 UI 표시 | < 100ms | 요청부터 UI 표시까지 |
| Gateway 시작 시간 | < 3초 | 프로세스 시작부터 API 사용 가능까지 |
| 암호화 오버헤드 | < 50ms | 프로파일 복호화 시간 |
| 샌드박스 시작 시간 | < 500ms | isolated-vm 초기화 시간 |

### 에러 처리 및 복구 전략

| 시나리오 | 처리 방안 | 복구 메커니즘 |
|----------|-----------|---------------|
| **LLM API 장애** | fallback 프로파일로 자동 전환 | 최대 3회 재시도, exponential backoff (1s, 2s, 4s) |
| **Rate limit 초과** | 요청 큐잉 및 지연 처리 | 헤더의 Retry-After 대기, 자동 재시도 |
| **채널 연결 끊김** | 자동 재연결 시도 | 최대 5회 재연결, 1초 간격 |
| **마스터 키 분실** | 복구 불가, 재설정 필요 | 데이터 초기화 및 onboard 재실행 안내 |
| **Supabase 연결 실패** | 에러 반환 및 서버 시작 차단 | 연결 설정 확인 안내, 올바른 URL/API Key 요구 |
| **메모리 제한 초과** | 프로세스 재시작 | graceful shutdown 및 상태 복구 |

### 동시성 제어

```typescript
// Supabase 연결 풀 설정
interface SupabaseConfig {
  url: string;
  anonKey: string;
  options: {
    auth: {
      persistSession: true;
    };
    db: {
      schema: "public";
    };
  };
}

// 실시간 구독 설정
interface RealtimeConfig {
  enabled: true;
  tables: ["sessions", "messages"];
}

// 세션 격리
interface SessionIsolation {
  perUser: true;     // 사용자별 세션 분리
  perChannel: true;  // 채널별 세션 분리
  rowLevelSecurity: true;  // Supabase RLS 활성화
}
```

---

## 🧪 테스트 전략

### 테스트 범위

| 테스트 유형 | 커버리지 목표 | 주요 시나리오 |
|-------------|---------------|---------------|
| **단위 테스트** | 70%+ | 유틸리티 함수, 암호화/복호화, 스키마 검증 |
| **통합 테스트** | 핵심 경로 | Gateway API, 채널 어댑터, LLM 클라이언트 |
| **E2E 테스트** | 주요 사용자 여정 | onboard → gateway → 메신저 대화 흐름 |
| **보안 테스트** | Critical 경로 | 암호화 검증, 샌드박스 우회 시도, 승인 시스템 |

### E2E 테스트 시나리오

1. **정상 플로우**: onboard → gateway 시작 → Telegram/Slack/Discord 메시지 → AI 응답
2. **fallback 시나리오**: Primary LLM(Anthropic) 실패 → Secondary LLM(OpenAI/Moonshot) 전환 → 응답 완료
3. **승인 플로우**: 위험 도구 호출 → 승인 UI 표시 → 사용자 승인 → 실행 → 결과 반환
4. **오류 복구**: 채널 연결 끊김 → 자동 재연결 → 메시지 처리 재개
5. **멀티 채널**: Telegram 메시지 → Supabase 저장 → Discord에서 동일 세션 조회

---

## 🔒 보안 상세

### 마스터 키 파생 (Argon2id)

```typescript
const argon2Params = {
  type: "argon2id",
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,       // 4 threads
  saltLength: 32,       // 256-bit salt
  hashLength: 32        // 256-bit output
};
```

### 암호화 데이터 구조

```typescript
interface EncryptedAuthProfile {
  version: 2;
  metadata: {
    createdAt: ISO8601;
    updatedAt: ISO8601;
    keyId: string;
  };
  encryption: {
    algorithm: "AES-256-GCM";
    salt: Base64;           // 32 bytes
    nonce: Base64;          // 12 bytes (GCM)
    tag: Base64;            // 16 bytes auth tag
  };
  ciphertext: Base64;
}
```

### Gateway 네트워크 보안

| 기능 | 설정 | 기본값 |
|------|------|--------|
| 바인딩 주소 | `host` | `127.0.0.1` (localhost만) |
| 인터페이스 화이트리스트 | `allowedInterfaces` | `[]` (명시적 설정 필요) |
| CIDR 기반 ACL | `cidrAllowList` | `["127.0.0.1/32"]` |
| JWT 세션 | `auth.jwt.enabled` | `true` |

---

## 📋 doppelgesicht.md 기반 검증 체크리스트

| 원본 섹션 | PRD 반영 여부 | 위치 |
|-----------|---------------|------|
| 1. 프로젝트 개요 | ✅ | 핵심 정보 |
| 2. 아키텍처 개요 | ✅ | 기능 명세, 데이터 흐름 |
| 3. 디렉토리 구조 | ✅ | 기술 스택 참고 |
| 4.1 CLI 시스템 | ✅ | 페이지별 상세 기능 - 각 CLI 명령어 |
| 4.2 Gateway 시스템 | ✅ | Gateway 서버 페이지 |
| 4.3 Agent 시스템 | ✅ | Agent 대화 페이지, Auth Profile 관리 |
| 4.4 채널 시스템 | ✅ | 채널 설정 페이지 |
| 5. 기술 스택 | ✅ | 기술 스택 섹션 |
| 6. 데이터 흐름 | ✅ | 사용자 여정, 페이지별 기능 |
| 7.1 다중 LLM 지원 | ✅ | F002, F003 |
| 7.2 채널 기능 행렬 | ✅ | F004, F005, ChannelConfig 모델 |
| 7.3 스킬 시스템 | ✅ (MVP 포함) | F019 반영, Web UI에서 관리 |
| 14. 보안 개선사항 | ✅ | F001, F007, F013, 보안 상세 섹션 |
| 14.1 보안 취약점 개요 | ✅ | F001, F007, F013 |
| 14.2 보안 요구사항 (F001-F008) | ✅ | F001(암호화), F007(승인), F013(샌드박스) 반영 |
| 14.3 데이터 모델 | ✅ | 데이터 모델 섹션 |
| 14.5 성공 기준 | ✅ | 성능 목표, 테스트 전략 |
| 14.6 사용자 스토리 | ✅ | 사용자 여정 참고 |
| 14.8 위협 모델 | ✅ | 보안 상세 섹션 참고 |

**누락된 항목**: 없음 (모든 핵심 내용이 MVP 또는 MVP 이후 기능으로 분류됨)

---

## 🌐 Web UI (Browser Interface)

### 개요

Gateway에 내장된 웹 기반 관리 인터페이스. 브라우저를 통해 doppelgesicht를 직접 제어하고 설정할 수 있는 싱글 페이지 애플리케이션.

### 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                     Web UI Architecture                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌─────────────────────────────────┐   │
│  │   Browser    │◀────────│          Gateway Server          │   │
│  │   (SPA)      │  HTTP   │          (Express.js)            │   │
│  │              │  WS     │                                  │   │
│  │ - Vanilla JS │────────▶│  ┌──────────┐  ┌──────────────┐ │   │
│  │ - Tailwind   │         │  │ REST API │  │ LLM Clients  │ │   │
│  │ - No build   │         │  │ WebSocket│  │ - Anthropic  │ │   │
│  └──────────────┘         │  │ Routes   │  │ - OpenAI     │ │   │
│                           │  └──────────┘  │ - Moonshot   │ │   │
│                           │                └──────────────┘ │   │
│                           │  ┌──────────┐  ┌──────────────┐ │   │
│                           │  │ Channels │  │    Tools     │ │   │
│                           │  │ - Discord│  │ - exec       │ │   │
│                           │  │ - Slack  │  │ - web_fetch  │ │   │
│                           │  │ - Telegram│  │ - browser    │ │   │
│                           │  └──────────┘  └──────────────┘ │   │
│                           │  ┌──────────┐  ┌──────────────┐ │   │
│                           │  │   Cron   │  │   Memory     │ │   │
│                           │  │Scheduler │  │  (Supabase)  │ │   │
│                           │  └──────────┘  └──────────────┘ │   │
│                           └─────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

**참고**: "Backend Services"는 Gateway 서버 낸부의 기존 기능들을 의미합니다.
별도의 독립적인 백엔드 서비스가 아닌 Gateway의 내장 기능입니다.
```

### 기능 명세

| ID | 기능명 | 설명 | MVP 필수 | 관련 페이지 |
|----|--------|------|----------|-------------|
| **F015** | Chat Interface | 브라우저에서 직접 doppelgesicht와 대화 | ✅ | `/chat` |
| **F016** | Channel Control | Telegram/Slack/Discord 설정 관리 | ✅ | `/control/channels` |
| **F017** | Cron Job Management | 주기적 작업 등록/관리 | ✅ | `/control/cron` |
| **F018** | Agent Management | LLM 에이전트 설정 및 프로파일 관리 | ✅ | `/agent/agents` |
| **F019** | Skill Management | 커스텀 스킬 등록 및 관리 | ✅ | `/agent/skills` |
| **F020** | Config Editor | 환경변수 및 설정 파일 편집 | ✅ | `/settings/config` |
| **F021** | Log Viewer | 실시간 로그 스트리밍 | ✅ | `/settings/logs` |

### 페이지 구조

```
🌐 Web UI
│
├── 💬 Chat (/chat)
│   ├── 기능: 실시간 AI 대화
│   ├── 도구 호출 시 승인/거부 UI
│   ├── 대화 기록 저장/불러오기
│   └── 파일 첨부 (이미지, 문서)
│
├── 🎛️ Control
│   │
│   ├── 📱 Channels (/control/channels)
│   │   ├── Telegram 설정 (봇 토큰, 허용 사용자)
│   │   ├── Slack 설정 (App/Bot 토큰, 워크스페이스)
│   │   ├── Discord 설정 (Bot 토큰, 서버, 채널)
│   │   └── 연결 상태 모니터링 (실시간 ping)
│   │
│   └── ⏰ Cron Jobs (/control/cron)
│       ├── 작업 목록 (스케줄, 마지막 실행, 다음 실행)
│       ├── 새 작업 등록 (cron 표현식, 명령어)
│       ├── 작업 활성화/비활성화
│       └── 실행 로그 조회
│
├── 🤖 Agent
│   │
│   ├── 🎭 Auth Profiles (/agent/profiles)
│   │   ├── LLM 인증 프로파일 목록
│   │   ├── 새 프로파일 추가 (Anthropic/OpenAI/Moonshot)
│   │   ├── 우선순위/fallback 설정
│   │   └── 상태 모니터링 (healthy/degraded/cooldown)
│   │
│   └── 🛠️ Skills (/agent/skills)
│       ├── 스킬 목록 (이름, 버전, 설명)
│       ├── 스킬 등록 (GitHub URL 또는 로컬 경로)
│       ├── 스킬 활성화/비활성화
│       └── 스킬 설정 편집
│
└── ⚙️ Settings
    │
    ├── 🔧 Config (/settings/config)
    │   ├── 환경변수 관리
    │   ├── 설정 파일 YAML 편집기
    │   ├── 핫 리로드 설정
    │   └── 설정 검증/백업/복원
    │
    └── 📋 Logs (/settings/logs)
        ├── 실시간 로그 스트리밍 (WebSocket)
        ├── 로그 레벨 필터링 (debug/info/warn/error)
        ├── 로그 검색/하이라이트
        └── 로그 다운로드/정리
```

### API 엔드포인트

```typescript
// Chat
POST   /v1/chat/completions      # AI 대화
GET    /v1/chat/sessions          # 세션 목록
GET    /v1/chat/sessions/:id      # 세션 조회
DELETE /v1/chat/sessions/:id      # 세션 삭제

// Control - Channels
GET    /v1/admin/channels         # 채널 목록
GET    /v1/admin/channels/:id     # 채널 조회
PUT    /v1/admin/channels/:id     # 채널 설정 업데이트
POST   /v1/admin/channels/:id/test # 연결 테스트

// Control - Cron Jobs
GET    /v1/admin/cron             # 크론 작업 목록
POST   /v1/admin/cron             # 새 작업 등록
PUT    /v1/admin/cron/:id         # 작업 수정
DELETE /v1/admin/cron/:id         # 작업 삭제
POST   /v1/admin/cron/:id/run     # 즉시 실행

// Agent - Agents
GET    /v1/admin/agents           # 에이전트 목록
POST   /v1/admin/agents           # 새 에이전트 등록
PUT    /v1/admin/agents/:id       # 에이전트 수정
DELETE /v1/admin/agents/:id       # 에이전트 삭제

// Agent - Skills
GET    /v1/admin/skills           # 스킬 목록
POST   /v1/admin/skills           # 스킬 등록
PUT    /v1/admin/skills/:id       # 스킬 수정
DELETE /v1/admin/skills/:id       # 스킬 삭제

// Settings - Config
GET    /v1/admin/config           # 전체 설정 조회
PUT    /v1/admin/config           # 설정 업데이트
POST   /v1/admin/config/validate  # 설정 검증
POST   /v1/admin/config/backup    # 설정 백업

// Settings - Logs
GET    /v1/admin/logs             # 로그 조회 (SSE/WS)
DELETE /v1/admin/logs             # 로그 정리
```

### Cron Job 시스템 (F017 백엔드 명세)

#### 개요
Gateway에 내장된 작업 스케줄러. Node.js의 `node-cron` 라이브러리를 사용하여 주기적인 작업을 실행합니다.

#### 아키텍처
```
┌─────────────────────────────────────────────────────────────┐
│                    Cron Job System                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │   Config     │────▶│   Scheduler  │────▶│   Executor   │ │
│  │   (YAML)     │     │ (node-cron)  │     │   (Worker)   │ │
│  └──────────────┘     └──────────────┘     └──────────────┘ │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │  Job Store   │     │   Trigger    │     │    Tool      │ │
│  │  (Supabase)  │     │   Engine     │     │   Caller     │ │
│  └──────────────┘     └──────────────┘     └──────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 데이터 모델

```typescript
// CronJob 테이블 (Supabase)
interface CronJob {
  id: string;                    // UUID
  name: string;                  // 작업 이름 (고유)
  description?: string;          // 설명
  schedule: string;              // Cron 표현식 (e.g., "0 9 * * 1-5")
  timezone: string;              // 타임존 (기본: "Asia/Seoul")
  command: string;               // 실행할 명령어/스크립트
  commandType: 'bash' | 'skill' | 'message';  // 명령 유형
  enabled: boolean;              // 활성화 상태
  createdAt: ISO8601;
  updatedAt: ISO8601;
  createdBy: string;             // 사용자 ID
  metadata?: {
    timeout: number;             // 실행 제한 시간 (초, 기본: 300)
    retryCount: number;          // 실패 시 재시도 횟수
    environment: Record<string, string>;  // 환경변수
  };
}

// CronJobExecution 테이블 (실행 로그)
interface CronJobExecution {
  id: string;
  jobId: string;                 // 참조: CronJob.id
  status: 'running' | 'success' | 'failed' | 'timeout';
  startedAt: ISO8601;
  finishedAt?: ISO8601;
  duration?: number;             // 실행 시간 (ms)
  output?: string;               // 표준 출력
  error?: string;                // 에러 메시지
  exitCode?: number;             // 종료 코드
}
```

#### 스케줄러 구현

```typescript
class CronJobScheduler {
  private jobs: Map<string, CronJob> = new Map();
  private scheduledTasks: Map<string, CronJobTask> = new Map();
  private logger: Logger;

  // 작업 등록
  register(job: CronJob): void {
    // 기존 작업 중지
    this.unregister(job.id);

    // Cron 작업 생성
    const task = cron.schedule(job.schedule, async () => {
      await this.execute(job);
    }, {
      timezone: job.timezone,
      scheduled: job.enabled,
    });

    this.jobs.set(job.id, job);
    this.scheduledTasks.set(job.id, task);
  }

  // 작업 실행
  private async execute(job: CronJob): Promise<void> {
    const executionId = generateUUID();
    const startTime = Date.now();

    // 실행 시작 기록
    await this.logExecutionStart(executionId, job.id);

    try {
      let result: ExecutionResult;

      switch (job.commandType) {
        case 'bash':
          result = await this.executeBash(job.command, job.metadata);
          break;
        case 'skill':
          result = await this.executeSkill(job.command, job.metadata);
          break;
        case 'message':
          result = await this.sendMessage(job.command, job.metadata);
          break;
        default:
          throw new Error(`Unknown command type: ${job.commandType}`);
      }

      // 성공 기록
      await this.logExecutionComplete(executionId, {
        status: 'success',
        duration: Date.now() - startTime,
        output: result.output,
        exitCode: result.exitCode,
      });
    } catch (error) {
      // 실패 기록
      await this.logExecutionComplete(executionId, {
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message,
      });

      // 재시도 로직
      if (job.metadata?.retryCount > 0) {
        await this.retryExecution(job, executionId);
      }
    }
  }

  // Bash 명령 실행
  private async executeBash(command: string, metadata?: CronJobMetadata): Promise<ExecutionResult> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync(command, {
      timeout: (metadata?.timeout || 300) * 1000,
      env: { ...process.env, ...metadata?.environment },
    });

    return {
      output: stdout || stderr,
      exitCode: 0,
    };
  }

  // WebSocket으로 실시간 알림
  private async notifyWebSocket(event: string, data: unknown): Promise<void> {
    const message = JSON.stringify({ type: `cron:${event}`, payload: data });
    gatewayServer.broadcastToAdmins(message);
  }
}
```

#### CLI 명령어

```
doppelgesicht cron list              # 작업 목록 조회
doppelgesicht cron add <name>       # 새 작업 등록 (대화형)
doppelgesicht cron remove <id>      # 작업 삭제
doppelgesicht cron run <id>         # 즉시 실행
doppelgesicht cron logs <id>        # 실행 로그 조회
doppelgesicht cron enable <id>      # 작업 활성화
doppelgesicht cron disable <id>     # 작업 비활성화
```

#### Cron 표현식 지원 형식

| 필드 | 허용값 | 특수문자 |
|------|--------|----------|
| 분 | 0-59 | , - * / |
| 시 | 0-23 | , - * / |
| 일 | 1-31 | , - * ? / L W |
| 월 | 1-12 또는 JAN-DEC | , - * / |
| 요일 | 0-7 (0=일, 7=일) 또는 SUN-SAT | , - * ? / L # |

**예시:**
- `0 9 * * 1-5` - 평일 오전 9시
- `0 */6 * * *` - 6시간마다
- `0 0 * * 0` - 매주 일요일 자정
- `0 0 1 * *` - 매월 1일 자정

---

### API 엔드포인트 상세 명세 (OpenAPI 스타일)

#### 공통 사항

**Base URL**: `http://localhost:8080`

**인증**: 모든 Admin API는 Authorization 헤더에 Bearer JWT 토큰이 필요합니다.
```
Authorization: Bearer <jwt_token>
```

**응답 형식**:
```typescript
// 성공 응답
interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

// 에러 응답
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}
```

#### Chat API

##### POST /v1/admin/chat/completions
AI와 대화를 생성합니다. Web UI 전용으로 세션 관리 기능이 포함됩니다.

**Request**:
```typescript
interface ChatCompletionRequest {
  sessionId?: string;           // 기존 세션 ID (없으면 새로 생성)
  message: string;              // 사용자 메시지
  model?: string;               // 사용할 모델 (기본: config.llm.defaultModel)
  stream?: boolean;             // 스트리밍 여부 (기본: true)
  tools?: string[];             // 사용할 도구 목록 (기본: 전체)
  attachments?: Array<{
    type: 'image' | 'document';
    url: string;
    name?: string;
  }>;
}
```

**Response** (Non-streaming):
```typescript
interface ChatCompletionResponse {
  id: string;
  sessionId: string;
  message: {
    role: 'assistant';
    content: string;
    tool_calls?: ToolCall[];
  };
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  finish_reason: 'stop' | 'max_tokens' | 'tool_calls';
}
```

**Error Codes**:
- `400 INVALID_REQUEST`: 필수 필드 누락
- `401 UNAUTHORIZED`: 인증 실패
- `429 RATE_LIMITED`: 요청 한도 초과
- `503 LLM_UNAVAILABLE`: 모든 LLM 클라이언트 실패

##### GET /v1/admin/chat/sessions
사용자의 대화 세션 목록을 조회합니다.

**Query Parameters**:
- `page` (number, 기본: 1): 페이지 번호
- `perPage` (number, 기본: 20): 페이지당 항목 수
- `sort` (string, 기본: 'updatedAt:desc'): 정렬 기준

**Response**:
```typescript
interface ChatSessionsResponse {
  sessions: Array<{
    id: string;
    title: string;           // 첫 메시지 요약
    messageCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

#### Channels API

##### GET /v1/admin/channels
등록된 채널 목록과 상태를 조회합니다.

**Response**:
```typescript
interface ChannelsResponse {
  channels: Array<{
    id: string;
    type: 'discord' | 'telegram' | 'slack';
    name: string;
    enabled: boolean;
    status: 'connected' | 'disconnected' | 'error';
    lastError?: string;
    latency?: number;        // ms
    connectedAt?: string;
    stats: {
      messagesReceived: number;
      messagesSent: number;
      errors: number;
    };
    config: {
      allowedUsers: string[];
      allowedChannels?: string[];
      allowDMs?: boolean;
    };
  }>;
}
```

##### PUT /v1/admin/channels/:id
채널 설정을 업데이트합니다.

**Request**:
```typescript
interface UpdateChannelRequest {
  enabled?: boolean;
  config?: {
    botToken?: string;       // 민감 정보는 마스킹되어 반환됨
    allowedUsers?: string[];
    allowedChannels?: string[];
    allowedGuilds?: string[];
    allowDMs?: boolean;
  };
}
```

**Validation Rules**:
- `botToken`: 최소 10자 이상
- `allowedUsers`: 유효한 사용자 ID 배열

#### Cron Jobs API

##### GET /v1/admin/cron
크론 작업 목록을 조회합니다.

**Response**:
```typescript
interface CronJobsResponse {
  jobs: Array<{
    id: string;
    name: string;
    description?: string;
    schedule: string;
    timezone: string;
    enabled: boolean;
    lastRunAt?: string;
    lastRunStatus?: 'success' | 'failed';
    nextRunAt?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

##### POST /v1/admin/cron
새 크론 작업을 등록합니다.

**Request**:
```typescript
interface CreateCronJobRequest {
  name: string;              // 고유 이름 (필수)
  description?: string;
  schedule: string;          // Cron 표현식 (필수)
  timezone?: string;         // 기본: "Asia/Seoul"
  command: string;           // 실행 명령 (필수)
  commandType: 'bash' | 'skill' | 'message';
  enabled?: boolean;         // 기본: true
  metadata?: {
    timeout?: number;        // 기본: 300 (초)
    retryCount?: number;     // 기본: 0
    environment?: Record<string, string>;
  };
}
```

**Validation Rules**:
- `name`: 1-100자, 알파벳/숫자/하이픈/언더스코어
- `schedule`: 유효한 Cron 표현식
- `command`: 1-10000자
- `metadata.timeout`: 10-3600 (초)
- `metadata.retryCount`: 0-5

##### GET /v1/admin/cron/:id/logs
작업 실행 로그를 조회합니다.

**Query Parameters**:
- `page` (number, 기본: 1)
- `perPage` (number, 기본: 20, 최대: 100)
- `status` (string, 선택): 'success' | 'failed' | 'timeout'
- `from` (ISO8601, 선택): 시작 날짜
- `to` (ISO8601, 선택): 종료 날짜

**Response**:
```typescript
interface CronJobLogsResponse {
  logs: Array<{
    id: string;
    jobId: string;
    status: 'running' | 'success' | 'failed' | 'timeout';
    startedAt: string;
    finishedAt?: string;
    duration?: number;
    output?: string;         // 최대 10000자
    error?: string;
    exitCode?: number;
  }>;
}
```

#### Agents API

##### GET /v1/admin/agents
LLM 에이전트(프로파일) 목록을 조회합니다.

**Response**:
```typescript
interface AgentsResponse {
  agents: Array<{
    id: string;
    name: string;
    provider: 'anthropic' | 'openai' | 'moonshot';
    model: string;
    priority: number;
    enabled: boolean;
    status: 'healthy' | 'degraded' | 'cooldown' | 'unavailable';
    health: {
      lastCheckedAt: string;
      latency?: number;
      error?: string;
    };
    rateLimits: {
      requestsPerMinute: number;
      remainingRequests?: number;
    };
    lastUsedAt?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

##### POST /v1/admin/agents
새 에이전트를 등록합니다.

**Request**:
```typescript
interface CreateAgentRequest {
  name: string;              // 고유 이름 (필수)
  provider: 'anthropic' | 'openai' | 'moonshot';
  type: 'api_key';          // 향후 oauth 지원 예정
  credentials: {
    apiKey: string;          // 암호화되어 저장됨
    baseUrl?: string;        // 커스텀 엔드포인트 (선택)
  };
  model?: string;            // 기본: 제공자별 기본 모델
  priority?: number;         // 기본: 0 (낮을수록 높음)
  rateLimits?: {
    requestsPerMinute?: number;  // 기본: 60
  };
}
```

**Validation Rules**:
- `name`: 1-100자, 고유해야 함
- `credentials.apiKey`: 최소 10자

#### Skills API

##### GET /v1/admin/skills
등록된 스킬 목록을 조회합니다.

**Response**:
```typescript
interface SkillsResponse {
  skills: Array<{
    id: string;
    name: string;
    version: string;
    description: string;
    author?: string;
    source: {
      type: 'github' | 'local' | 'npm';
      url: string;
    };
    enabled: boolean;
    config: Record<string, unknown>;
    tools: string[];         // 제공하는 도구 목록
    dependencies: string[];  // 필요한 다른 스킬
    createdAt: string;
    updatedAt: string;
  }>;
}
```

##### POST /v1/admin/skills
새 스킬을 등록합니다.

**Request**:
```typescript
interface CreateSkillRequest {
  source: {
    type: 'github' | 'local' | 'npm';
    url: string;             // GitHub URL, 로컬 경로, 또는 npm 패키지명
    ref?: string;            // GitHub 브랜치/태그 (기본: main)
  };
  enabled?: boolean;
  config?: Record<string, unknown>;
}
```

**동작**:
1. 소스에서 스킬 메타데이터 로드 (skill.json 또는 package.json)
2. 의존성 검증
3. 스킬 코드 다운로드/복사
4. 스키마 검증
5. 데이터베이스 저장

---

### WebSocket 프로토콜 상세 명세

#### 연결 및 인증

```typescript
// 1. WebSocket 연결
wss://localhost:8081/ws

// 2. 인증 (연결 후 즉시 전송)
// Client → Server
{
  type: 'auth',
  payload: {
    token: string;           // JWT 토큰 (필수)
    clientInfo?: {
      name: string;          // 예: "doppelgesicht-web"
      version: string;       // 예: "1.0.0"
    };
  },
  id: string;                // 요청 추적용 UUID (선택)
}

// Server → Client (성공)
{
  type: 'auth:success',
  payload: {
    userId: string;
    sessionId: string;
    permissions: string[];   // ['admin', 'chat', 'config:read', ...]
    expiresAt: string;       // ISO8601
  },
  timestamp: string;
  id: string;                // 요청 ID와 동일
}

// Server → Client (실패)
{
  type: 'auth:error',
  payload: {
    code: 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'INSUFFICIENT_PERMISSIONS';
    message: string;
  },
  timestamp: string;
  id: string;
}
```

#### 채팅 이벤트

```typescript
// Client → Server: 메시지 전송
{
  type: 'chat:message',
  payload: {
    sessionId?: string;      // 없으면 새 세션 생성
    content: string;         // 사용자 메시지
    attachments?: Array<{
      type: 'image' | 'document';
      url: string;
      name?: string;
    }>;
    options?: {
      model?: string;
      stream?: boolean;      // 기본: true
    };
  },
  id: string;
}

// Server → Client: 스트리밍 응답 (chunk)
{
  type: 'chat:response:chunk',
  payload: {
    sessionId: string;
    messageId: string;
    content: string;         // 이번 청크의 내용
    fullContent: string;     // 지금까지의 전체 내용
    done: boolean;           // 마지막 청크 여부
  },
  timestamp: string;
  id: string;                // 요청 ID와 동일
}

// Server → Client: 도구 호출 요청 (승인 필요)
{
  type: 'chat:tool_call',
  payload: {
    requestId: string;       // 승인/거부 시 사용
    sessionId: string;
    tool: {
      id: string;
      name: string;          // 'exec' | 'web_fetch' | 'file_write' | ...
      description: string;
    };
    params: Record<string, unknown>;  // 도구 파라미터
    risk: {
      level: 'low' | 'medium' | 'high' | 'critical';
      score: number;         // 0.0 - 1.0
      reasons: string[];     // 위험 평가 사유
    };
    timeout: number;         // 승인 제한 시간 (초)
  },
  timestamp: string;
}

// Client → Server: 도구 승인
{
  type: 'tool:approve',
  payload: {
    requestId: string;       // tool_call의 requestId
    remember?: boolean;      // 동일 도구에 대해 기억할지 여부
  },
  id: string;
}

// Client → Server: 도구 거부
{
  type: 'tool:deny',
  payload: {
    requestId: string;
    reason?: string;         // 거부 사유 (선택)
    remember?: boolean;
  },
  id: string;
}

// Server → Client: 도구 실행 결과
{
  type: 'chat:tool_result',
  payload: {
    requestId: string;
    sessionId: string;
    success: boolean;
    output?: string;         // 성공 시 출력
    error?: string;          // 실패 시 에러
    duration: number;        // 실행 시간 (ms)
  },
  timestamp: string;
}
```

#### 세션 관리

```typescript
// Client → Server: 세션 목록 요청
{
  type: 'session:list',
  payload: {
    page?: number;
    perPage?: number;
  },
  id: string;
}

// Server → Client: 세션 목록 응답
{
  type: 'session:list:response',
  payload: {
    sessions: Array<{
      id: string;
      title: string;
      messageCount: number;
      createdAt: string;
      updatedAt: string;
    }>;
    pagination: {
      page: number;
      perPage: number;
      total: number;
    };
  },
  id: string;
}

// Client → Server: 세션 삭제
{
  type: 'session:delete',
  payload: {
    sessionId: string;
  },
  id: string;
}

// Server → Client: 세션 삭제 결과
{
  type: 'session:delete:response',
  payload: {
    success: boolean;
    sessionId: string;
  },
  id: string;
}
```

#### 로그 구독

```typescript
// Client → Server: 로그 구독
{
  type: 'logs:subscribe',
  payload: {
    levels: ('debug' | 'info' | 'warn' | 'error')[];  // 기본: ['info', 'warn', 'error']
    sources?: string[];    // 필터링할 로그 소스 (선택)
    search?: string;       // 검색어 (선택)
  },
  id: string;
}

// Server → Client: 로그 항목 (실시간)
{
  type: 'logs:entry',
  payload: {
    timestamp: string;     // ISO8601
    level: 'debug' | 'info' | 'warn' | 'error';
    source: string;        // 'Gateway' | 'DiscordAdapter' | 'LLMClient' | ...
    message: string;
    metadata?: Record<string, unknown>;  // 추가 컨텍스트
  }
}

// Client → Server: 로그 구독 취소
{
  type: 'logs:unsubscribe',
  id: string;
}
```

#### 채널 및 시스템 상태

```typescript
// Server → Client: 채널 상태 변경 (실시간)
{
  type: 'channel:status',
  payload: {
    id: string;            // 채널 ID
    type: 'discord' | 'telegram' | 'slack';
    status: 'connected' | 'disconnected' | 'error';
    latency?: number;      // ms (connected 상태일 때)
    lastError?: string;    // error 상태일 때
    timestamp: string;
  }
}

// Server → Client: 시스템 상태
{
  type: 'system:status',
  payload: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    uptime: number;        // 초
    timestamp: string;
    metrics: {
      activeConnections: number;
      messagesPerMinute: number;
      llmLatency: number;  // ms
      memoryUsage: {
        used: number;      // MB
        total: number;     // MB
      };
    };
  }
}

// Server → Client: 설정 변경 알림
{
  type: 'config:changed',
  payload: {
    path: string;          // 변경된 설정 경로 (예: 'channels.discord.enabled')
    value: unknown;        // 새 값
    changedBy: string;     // 변경한 사용자 ID
    timestamp: string;
  }
}
```

#### Cron Job 이벤트

```typescript
// Server → Client: 크론 작업 실행 시작
{
  type: 'cron:started',
  payload: {
    jobId: string;
    executionId: string;
    startedAt: string;
  }
}

// Server → Client: 크론 작업 실행 완료
{
  type: 'cron:completed',
  payload: {
    jobId: string;
    executionId: string;
    status: 'success' | 'failed' | 'timeout';
    duration: number;      // ms
    output?: string;
    error?: string;
    finishedAt: string;
  }
}

// Client → Server: 크론 작업 즉시 실행 요청
{
  type: 'cron:run',
  payload: {
    jobId: string;
  },
  id: string;
}
```

#### 에러 및 기타

```typescript
// Server → Client: 일반 에러
{
  type: 'error',
  payload: {
    code: string;          // 'INVALID_MESSAGE' | 'RATE_LIMITED' | 'INTERNAL_ERROR' | ...
    message: string;
    details?: unknown;
    requestId?: string;    // 관련된 요청 ID (있는 경우)
  },
  timestamp: string;
}

// Client → Server: 핑
{
  type: 'ping',
  payload: {
    timestamp: string;
  },
  id: string;
}

// Server → Client: 퐁 (핑 응답)
{
  type: 'pong',
  payload: {
    timestamp: string;
    serverTime: string;
  },
  id: string;
}
```

#### 연결 관리

```typescript
// Server → Client: 연결 종료 예고
{
  type: 'connection:closing',
  payload: {
    reason: 'server_shutdown' | 'new_connection' | 'timeout' | 'auth_expired';
    message: string;
    reconnectAfter?: number;  // 재연결 권장 시간 (초)
  },
  timestamp: string;
}
```

### 기술 스택

| 구성요소 | 기술 | 선택 이유 |
|----------|------|-----------|
| **Frontend** | Vanilla JS + Tailwind CDN | 빌드 없이 Gateway에서 직접 서빙 |
| **Routing** | Hash-based SPA | 서버 사이드 설정 없이 클라이언트 라우팅 |
| **State** | Native EventTarget | 별도 라이브러리 없이 상태 관리 |
| **API** | Fetch API + WebSocket | 표준 웹 API 사용 |
| **Icons** | Lucide CDN (SVG) | 가벼운 아이콘 라이브러리 |
| **Editor** | Monaco Editor (CDN) | VS Code 스타일 YAML/JSON 편집 |
| **Charts** | Chart.js (CDN) | 메트릭스 시각화 |

### 보안 상세 명세

#### 인증 및 세션 관리

| 기능 | 구현 | 상세 |
|------|------|------|
| **인증** | JWT Bearer Token | Gateway와 동일한 JWT 검증 사용 |
| **세션 저장** | httpOnly 쿠키 (권장) | `Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600` |
| **세션 폴퍼** | localStorage (대안) | XSS 취약성 주의, 민감한 환경에서는 권장하지 않음 |
| **권한 검사** | RBAC (Role-Based Access Control) | `admin`, `user`, `readonly` 역할 지원 |
| **토큰 갱신** | 자동 갱신 | 만료 5분 전 자동 갱신 요청 |

#### CSRF 방어

```typescript
// CSRF 토큰 생성 및 검증
interface CSRFProtection {
  // 응답에 CSRF 토큰 포함
  'X-CSRF-Token': string;  // 헤더 또는 메타 태그로 전달

  // 상태 변경 요청 시 검증
  validateCSRFToken(request: Request): boolean {
    const headerToken = request.headers['x-csrf-token'];
    const cookieToken = request.cookies['csrf_token'];
    return headerToken === cookieToken && secureCompare(headerToken, cookieToken);
  }
}
```

#### Rate Limiting

| 대상 | 제한 | 기간 | 동작 |
|------|------|------|------|
| **IP 기반** | 100 요청 | 1분 | 초과 시 429 응답 |
| **사용자 기반** | 60 요청 | 1분 | 인증된 사용자별 |
| **로그인 시도** | 5회 | 5분 | 초과 시 계정 잠금 |
| **WebSocket 연결** | 10 연결 | IP당 | 초과 시 기존 연결 종료 |

```typescript
// Rate Limit 응답
429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "retryAfter": 30  // 초 후 재시도 가능
  }
}
```

#### 입력 검증

| 검증 유형 | 구현 | 예시 |
|-----------|------|------|
| **요청 본문** | Zod 스키마 | 모든 POST/PUT 요청 |
| **경로 파라미터** | 정규식 + Zod | UUID 형식 검증 |
| **쿼리 파라미터** | Zod | 페이지네이션, 필터 |
| **파일 업로드** | 크기/타입 제한 | 최대 10MB, 이미지/문서만 |

```typescript
// 공통 검증 스키마 예시
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

const UUIDSchema = z.string().uuid();
```

#### XSS 방어

| 계층 | 구현 | 설명 |
|------|------|------|
| **입력 Sanitization** | DOMPurify | 사용자 입력 HTML 정제 |
| **출력 인코딩** | 템플릿 자동 이스케이프 | innerHTML 대신 textContent 사용 |
| **CSP (Content Security Policy)** | HTTP 헤더 | `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' cdn.tailwindcss.com;` |
| **쿠키 플래그** | HttpOnly, Secure, SameSite | XSS로부터 세션 보호 |

```typescript
// CSP 헤더 설정
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
    "img-src 'self' data: https:",
    "connect-src 'self' wss:",
    "font-src 'self'",
  ].join('; '));
  next();
});
```

#### 감사 로깅 (Audit Logging)

| 이벤트 | 로그 내용 | 저장 위치 |
|--------|-----------|-----------|
| **로그인/로그아웃** | 사용자 ID, IP, 시간, 성공/실패 | Supabase audit_logs |
| **설정 변경** | 변경 경로, 이전 값, 새 값, 사용자 ID | Supabase audit_logs |
| **에이전트 등록/삭제** | 에이전트 ID, 작업 유형, 사용자 ID | Supabase audit_logs |
| **크론 작업 변경** | 작업 ID, 작업 유형, 사용자 ID | Supabase audit_logs |
| **도구 승인/거부** | 도구명, 파라미터, 결정, 사용자 ID | Supabase audit_logs |

```typescript
// 감사 로그 데이터 모델
interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userIp: string;
  userAgent: string;
  action: 'login' | 'logout' | 'config:update' | 'agent:create' | 'agent:delete' | 'cron:create' | 'tool:approve' | 'tool:deny';
  resource: string;          // 대상 리소스 (예: 'config.channels.discord')
  resourceId?: string;       // 리소스 ID
  changes?: {
    before: unknown;
    after: unknown;
  };
  metadata?: Record<string, unknown>;
}
```

#### 보안 헤더

```typescript
// 모든 응답에 적용되는 보안 헤더
app.use((req, res, next) => {
  // HSTS (HTTPS 강제)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // 클릭재킹 방지
  res.setHeader('X-Frame-Options', 'DENY');

  // MIME 스니핑 방지
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer 정책
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 권한 정책
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  next();
});
```

#### 에러 메시지 보안

| 환경 | 에러 응답 | 설명 |
|------|-----------|------|
| **Production** | 일반화된 메시지 | "Internal server error" - 구체적 정보 노출 방지 |
| **Development** | 상세 스택 트레이스 | 디버깅을 위한 상세 정보 |

```typescript
// 프로덕션 에러 응답
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "uuid-for-tracking"  // 납부 로그 조회용
  }
}
```

### 파일 구조

```
src/gateway/
├── admin/                    # Web UI 정적 파일
│   ├── index.html           # 진입점
│   ├── css/
│   │   └── app.css          # Tailwind + 커스텀 스타일
│   ├── js/
│   │   ├── app.ts           # 메인 앱, 라우터
│   │   ├── api.ts           # API 클라이언트
│   │   ├── ws.ts            # WebSocket 관리
│   │   ├── auth.ts          # 인증 모듈
│   │   ├── types/
│   │   │   ├── api.ts       # API 타입 정의
│   │   │   ├── websocket.ts # WebSocket 타입 정의
│   │   │   └── index.ts     # 공통 타입
│   │   ├── utils/
│   │   │   ├── dom.ts       # DOM 조작 유틸리티
│   │   │   ├── validators.ts# 입력 검증 유틸리티
│   │   │   └── formatters.ts# 포맷팅 유틸리티
│   │   └── components/
│   │       ├── chat.ts      # 채팅 인터페이스
│   │       ├── channels.ts  # 채널 관리
│   │       ├── cron.ts      # 크론 관리
│   │       ├── agents.ts    # 에이전트 관리
│   │       ├── skills.ts    # 스킬 관리
│   │       ├── config.ts    # 설정 편집
│   │       └── logs.ts      # 로그 뷰어
│   └── assets/
│       └── logo.svg
├── cron/                    # Cron Job 백엔드
│   ├── scheduler.ts         # node-cron 래퍼
│   ├── executor.ts          # 작업 실행기
│   ├── store.ts             # 작업 저장소
│   └── types.ts             # Cron Job 타입
└── server.ts                # 정적 파일 서빙 라우트 추가
```

### 구현 체크리스트

| 기능 | Backend API | Frontend UI | WebSocket | Auth | Tests | 상태 |
|------|-------------|-------------|-----------|------|-------|------|
| **Chat** | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 미구현 |
| **Channels** | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 미구현 |
| **Cron Jobs** | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 미구현 |
| **Agents** | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 미구현 |
| **Skills** | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 미구현 |
| **Config** | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 미구현 |
| **Logs** | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 미구현 |
| **Auth System** | ⬜ | ⬜ | ⬜ | - | ⬜ | 미구현 |

**범례:**
- Backend API: REST API 구현
- Frontend UI: 브라우저 UI 구현
- WebSocket: 실시간 양방향 통신
- Auth: 인증/인가 적용
- Tests: 단위/통합 테스트 작성

---