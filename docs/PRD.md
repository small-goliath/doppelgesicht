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
- 스킬/확장 시스템
- Web UI 대시보드
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
| 7.3 스킬 시스템 | ❌ (MVP 이후) | MVP 이후 기능으로 분류 |
| 14. 보안 개선사항 | ✅ | F001, F007, F013, 보안 상세 섹션 |
| 14.1 보안 취약점 개요 | ✅ | F001, F007, F013 |
| 14.2 보안 요구사항 (F001-F008) | ✅ | F001(암호화), F007(승인), F013(샌드박스) 반영 |
| 14.3 데이터 모델 | ✅ | 데이터 모델 섹션 |
| 14.5 성공 기준 | ✅ | 성능 목표, 테스트 전략 |
| 14.6 사용자 스토리 | ✅ | 사용자 여정 참고 |
| 14.8 위협 모델 | ✅ | 보안 상세 섹션 참고 |

**누락된 항목**: 없음 (모든 핵심 내용이 MVP 또는 MVP 이후 기능으로 분류됨)

---