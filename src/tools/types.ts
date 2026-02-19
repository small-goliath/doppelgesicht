/**
 * 도구 공통 타입 정의
 * @description 모든 도구(Bash, Browser 등)의 공통 인터페이스
 */

import type { Logger } from '../logging/index.js';

/**
 * 도구 실행 결과 기본 인터페이스
 */
export interface ToolResult {
  /** 성공 여부 */
  success: boolean;
  /** 결과 데이터 */
  data?: unknown;
  /** 에러 메시지 */
  error?: string;
  /** 실행 시간 (ms) */
  duration: number;
}

/**
 * 도구 인터페이스
 */
export interface ITool {
  /** 도구 이름 */
  readonly name: string;
  /** 도구 설명 */
  readonly description: string;

  /**
   * 도구 실행
   * @param params 실행 파라미터
   * @param logger 로거
   */
  execute(params: Record<string, unknown>, logger: Logger): Promise<ToolResult>;
}

/**
 * 도구 레지스트리
 */
export interface ToolRegistry {
  /**
   * 도구 등록
   */
  register(tool: ITool): void;

  /**
   * 도구 조회
   */
  get(name: string): ITool | undefined;

  /**
   * 모든 도구 목록
   */
  getAll(): ITool[];

  /**
   * 도구 제거
   */
  unregister(name: string): boolean;
}
