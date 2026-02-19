/**
 * doppelgesicht - AI Gateway with Multi-Channel Integration
 * 메인 모듈 엔트리포인트
 */

export const VERSION = '1.0.0';

export function hello(): string {
  return 'Hello, doppelgesicht!';
}

// 모듈 로드 확인용
console.log(`doppelgesicht v${VERSION} loaded`);
