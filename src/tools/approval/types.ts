/**
 * 도구 승인 시스템 타입 정의
 * @description 위험도 기반 실행 전 승인 요청 시스템
 */

/**
 * 위험도 레벨
 */
export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low';

/**
 * 승인 요청 상태
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

/**
 * 실행 모드
 */
export type ExecutionMode = 'cli' | 'daemon';

/**
 * 도구 카테고리별 위험도 매핑
 */
export const TOOL_RISK_LEVELS: Record<string, RiskLevel> = {
  // Critical: 시스템에 직접적인 변경을 가하는 위험한 도구
  exec: 'Critical',
  browser: 'Critical',
  file_write: 'Critical',
  file_delete: 'Critical',

  // High: 민감한 정보 접근이나 외부 통신
  file_read: 'High',
  web_fetch: 'High',
  web_search: 'Medium',

  // Low: 정보 조회만 하는 안전한 도구
  info: 'Low',
  help: 'Low',
  version: 'Low',
};

/**
 * 위험도별 기본 점수
 */
export const RISK_SCORES: Record<RiskLevel, number> = {
  Critical: 100,
  High: 75,
  Medium: 50,
  Low: 25,
};

/**
 * 위험도별 타임아웃 (초)
 */
export const RISK_TIMEOUTS: Record<RiskLevel, number> = {
  Critical: 120, // 2분
  High: 90,      // 1분 30초
  Medium: 60,    // 1분
  Low: 60,       // 1분
};

/**
 * 승인 요청 모델
 */
export interface ApprovalRequest {
  /** 고유 요청 ID */
  requestId: string;
  /** 요청된 도구 이름 */
  tool: string;
  /** 도구 실행 파라미터 */
  params: Record<string, unknown>;
  /** 위험도 레벨 */
  riskLevel: RiskLevel;
  /** 위험도 점수 (0-100) */
  riskScore: number;
  /** 요청 생성 시간 */
  timestamp: Date;
  /** 요청 상태 */
  status: ApprovalStatus;
  /** 실행 모드 */
  mode: ExecutionMode;
  /** 요청 만료 시간 */
  expiresAt: Date;
  /** 승인/거부 시간 */
  resolvedAt?: Date;
  /** 승인자 정보 (CLI 모드에서는 사용자, Daemon 모드에서는 화이트리스트 규칙) */
  resolvedBy?: string;
  /** 거부 시 사유 */
  rejectionReason?: string;
  /** 추가 컨텍스트 정보 */
  context?: {
    /** 세션 ID */
    sessionId?: string;
    /** 사용자 ID (있는 경우) */
    userId?: string;
    /** 요청 출처 */
    source?: string;
    /** 추가 메타데이터 */
    metadata?: Record<string, unknown>;
  };
}

/**
 * 승인 결과
 */
export interface ApprovalResult {
  /** 승인 여부 */
  approved: boolean;
  /** 결과 메시지 */
  message: string;
  /** 승인 요청 객체 */
  request?: ApprovalRequest;
}

/**
 * 승인 설정
 */
export interface ApprovalConfig {
  /** 기본 타임아웃 (초) */
  defaultTimeout: number;
  /** 고위험 타임아웃 (초) */
  highRiskTimeout: number;
  /** 자동 승인 화이트리스트 (Daemon 모드용) */
  whitelist: WhitelistRule[];
  /** 글로벌 승인 정책 */
  policy: ApprovalPolicy;
}

/**
 * 화이트리스트 규칙
 */
export interface WhitelistRule {
  /** 규칙 ID */
  id: string;
  /** 적용 대상 도구 */
  tool: string;
  /** 파라미터 패턴 (정규식 또는 와일드카드) */
  paramPattern?: Record<string, string>;
  /** 위험도 제한 */
  maxRiskLevel: RiskLevel;
  /** 규칙 설명 */
  description: string;
  /** 생성 시간 */
  createdAt: Date;
  /** 만료 시간 (선택) */
  expiresAt?: Date;
}

/**
 * 승인 정책
 */
export interface ApprovalPolicy {
  /** Critical 위험도 자동 차단 */
  blockCritical: boolean;
  /** Daemon 모드에서 화이트리스트만 허용 */
  whitelistOnly: boolean;
  /** 동일 도구 연속 실행 시 묻지 않음 시간 (초, 0=비활성화) */
  rememberDuration: number;
}

/**
 * 승인 UI 옵션
 */
export interface ApprovalUIOptions {
  /** 타임아웃 (초) */
  timeout?: number;
  /** 커스텀 메시지 */
  message?: string;
  /** 상세 정보 표시 여부 */
  showDetails: boolean;
  /** 기본 선택 (true=승인, false=거부) */
  defaultAction?: boolean;
}

/**
 * 승인 이벤트 타입
 */
export type ApprovalEventType =
  | 'request.created'
  | 'request.approved'
  | 'request.rejected'
  | 'request.expired'
  | 'request.cancelled';

/**
 * 승인 이벤트 리스너
 */
export type ApprovalEventListener = (
  event: ApprovalEventType,
  request: ApprovalRequest
) => void | Promise<void>;
