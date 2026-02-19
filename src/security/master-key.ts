/**
 * 마스터 키 파생 모듈
 * Argon2id 기반 마스터 키 생성
 */

import { hash, verify, argon2id } from 'argon2';
import { randomBytes } from 'crypto';

// Argon2id 파라미터 설정
const ARGON2_MEMORY_COST = 65536; // 64 MB
const ARGON2_TIME_COST = 3; // 3 iterations
const ARGON2_PARALLELISM = 4; // 4 parallel threads
const SALT_LENGTH = 32; // 32 bytes
const HASH_LENGTH = 32; // 32 bytes (256 bits)

/**
 * 마스터 키 파생 결과 인터페이스
 */
export interface MasterKeyResult {
  /** Base64 인코딩된 마스터 키 해시 (저장용) */
  hash: string;
  /** 마스터 키 원본 (Buffer) - 메모리에만 보관 */
  key: Buffer;
}

/**
 * 사용자 비밀번호로부터 마스터 키를 생성합니다
 * @param password - 사용자 비밀번호
 * @returns 마스터 키 결과 (hash는 저장, key는 메모리에만 보관)
 */
export async function deriveMasterKey(password: string): Promise<MasterKeyResult> {
  // 랜덤 salt 생성
  const salt = randomBytes(SALT_LENGTH);

  // Argon2id로 해시 생성
  const passwordHash = await hash(password, {
    type: argon2id,
    memoryCost: ARGON2_MEMORY_COST,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
    salt,
    hashLength: HASH_LENGTH,
  });

  // 마스터 키 파생: password + salt를 사용하여 키 생성
  // 실제로는 Argon2id의 난수성을 활용하여 키를 생성
  const key = await deriveKeyFromPassword(password, salt);

  return {
    hash: passwordHash,
    key,
  };
}

/**
 * 기존 salt로부터 마스터 키를 파생합니다 (복구 시 사용)
 * @param password - 사용자 비밀번호
 * @param salt - 저장된 salt
 * @returns 마스터 키 (Buffer)
 */
async function deriveKeyFromPassword(password: string, salt: Buffer): Promise<Buffer> {
  // Argon2id로 키 파생
  const derivedHash = await hash(password, {
    type: argon2id,
    memoryCost: ARGON2_MEMORY_COST,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
    salt,
    hashLength: HASH_LENGTH,
    raw: true, // raw buffer 반환
  });

  return Buffer.from(derivedHash);
}

/**
 * 저장된 해시와 비밀번호를 검증하고 마스터 키를 복구합니다
 * @param password - 사용자 비밀번호
 * @param storedHash - 저장된 Argon2id 해시
 * @returns 검증 성공 시 마스터 키, 실패 시 null
 */
export async function verifyAndRecoverKey(
  password: string,
  storedHash: string
): Promise<Buffer | null> {
  try {
    // 비밀번호 검증
    const isValid = await verify(storedHash, password);

    if (!isValid) {
      return null;
    }

    // 해시에서 salt 추출 (Argon2id 해시 형식: $argon2id$v=19$m=...,t=...,p=...$salt$hash)
    const salt = extractSaltFromHash(storedHash);

    // 마스터 키 파생
    const key = await deriveKeyFromPassword(password, salt);

    return key;
  } catch (error) {
    return null;
  }
}

/**
 * Argon2id 해시 문자열에서 salt를 추출합니다
 * @param hashString - Argon2id 해시 문자열
 * @returns salt (Buffer)
 */
function extractSaltFromHash(hashString: string): Buffer {
  // Argon2id 해시 형식: $argon2id$v=19$m=65536,t=3,p=4$salt$hash
  const parts = hashString.split('$');

  if (parts.length < 5) {
    throw new Error('Invalid Argon2id hash format');
  }

  // salt는 4번째 부분 (0-indexed: 4)
  const saltBase64 = parts[4];
  return Buffer.from(saltBase64, 'base64');
}

/**
 * 마스터 키를 안전하게 메모리에서 제거합니다
 * @param key - 제거할 마스터 키
 */
export function clearMasterKey(key: Buffer): void {
  key.fill(0);
}

/**
 * 비밀번호 복잡도를 검증합니다
 * @param password - 검증할 비밀번호
 * @returns 복잡도 검증 결과
 */
export function validatePasswordComplexity(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 최소 길이: 12자
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  // 대문자 포함
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // 소문자 포함
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // 숫자 포함
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  // 특수문자 포함
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
