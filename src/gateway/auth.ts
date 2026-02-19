/**
 * Gateway 인증 모듈
 * @description JWT 토큰 생성 및 검증, CIDR ACL
 */

import { createHash, randomBytes } from 'crypto';
import type { JWTPayload, CIDRACL } from './types.js';

/**
 * 간단한 JWT 구현 (실제 프로덕션에서는 jsonwebtoken 라이브러리 권장)
 */
export class JWTAuth {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  /**
   * JWT 토큰을 생성합니다
   * @param payload - JWT 페이로드
   * @returns JWT 토큰
   */
  sign(payload: Omit<JWTPayload, 'iat' | 'exp'> & { exp?: number }): string {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = {
      sub: payload.sub,
      sid: payload.sid,
      scopes: payload.scopes,
      iat: now,
      exp: payload.exp || now + 3600,
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = createHash('sha256')
      .update(`${encodedHeader}.${encodedPayload}.${this.secret}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * JWT 토큰을 검증합니다
   * @param token - JWT 토큰
   * @returns 검증된 페이로드
   * @throws 토큰이 유효하지 않으면 에러
   */
  verify(token: string): JWTPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = createHash('sha256')
      .update(`${encodedHeader}.${encodedPayload}.${this.secret}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()) as JWTPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }

    return payload;
  }

  /**
   * Authorization 헤더에서 토큰을 추출합니다
   * @param header - Authorization 헤더 값
   * @returns 토큰 또는 null
   */
  extractFromHeader(header: string | undefined): string | null {
    if (!header) return null;
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  }
}

/**
 * CIDR을 IP 범위로 변환합니다
 * @param cidr - CIDR 표기법 (예: 192.168.1.0/24)
 * @returns [시작 IP, 끝 IP] (정수 형태)
 */
function cidrToRange(cidr: string): [number, number] {
  const [ip, mask] = cidr.split('/');
  const maskBits = parseInt(mask, 10);
  const ipParts = ip.split('.').map(Number);
  const ipInt = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const maskInt = (0xffffffff << (32 - maskBits)) >>> 0;
  const startIp = (ipInt & maskInt) >>> 0;
  const endIp = (startIp | (~maskInt >>> 0)) >>> 0;
  return [startIp, endIp];
}

/**
 * IP 주소를 정수로 변환합니다
 * @param ip - IP 주소
 * @returns 정수 형태의 IP
 */
function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
}

/**
 * CIDR ACL 관리자
 */
export class CIDRACLManager {
  private acl: CIDRACL;

  constructor(acl: CIDRACL = { allow: [], deny: [] }) {
    this.acl = acl;
  }

  /**
   * IP 주소가 허용되는지 확인합니다
   * @param ip - 확인할 IP 주소
   * @returns 허용 여부
   */
  isAllowed(ip: string): boolean {
    // 로컬호스트는 항상 허용
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      return true;
    }

    const ipInt = ipToInt(ip.replace('::ffff:', ''));

    // Deny 목록 체크
    for (const cidr of this.acl.deny) {
      const [start, end] = cidrToRange(cidr);
      if (ipInt >= start && ipInt <= end) {
        return false;
      }
    }

    // Allow 목록이 비어있으면 모든 IP 허용
    if (this.acl.allow.length === 0) {
      return true;
    }

    // Allow 목록 체크
    for (const cidr of this.acl.allow) {
      const [start, end] = cidrToRange(cidr);
      if (ipInt >= start && ipInt <= end) {
        return true;
      }
    }

    return false;
  }

  /**
   * ACL을 업데이트합니다
   * @param acl - 새 ACL 설정
   */
  updateACL(acl: CIDRACL): void {
    this.acl = acl;
  }
}

/**
 * 세션 ID 생성
 * @returns 고유 세션 ID
 */
export function generateSessionId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * 사용자 ID 생성
 * @returns 고유 사용자 ID
 */
export function generateUserId(): string {
  return randomBytes(8).toString('hex');
}
