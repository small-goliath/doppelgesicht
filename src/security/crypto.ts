/**
 * 암호화/복호화 유틸리티 모듈
 * AES-256-GCM 암호화 구현
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

// AES-256-GCM 설정
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32; // 256-bit salt
const NONCE_LENGTH = 12; // 12-byte nonce (GCM 권장값)
const KEY_LENGTH = 32; // 256-bit key

/**
 * 암호화 결과 인터페이스
 */
export interface EncryptedData {
  /** Base64 인코딩된 암호문 */
  ciphertext: string;
  /** Base64 인코딩된 salt */
  salt: string;
  /** Base64 인코딩된 nonce (IV) */
  nonce: string;
  /** Base64 인코딩된 auth tag */
  authTag: string;
}

/**
 * 마스터 키에서 암호화 키를 파생합니다 (scrypt 사용)
 * @param masterKey - 마스터 키 (Buffer)
 * @param salt - salt 값 (Buffer)
 * @returns 파생된 256-bit 키
 */
export function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
  // scrypt를 사용하여 키 파생 (Argon2id는 마스터 키 생성에 사용)
  return scryptSync(masterKey, salt, KEY_LENGTH);
}

/**
 * 데이터를 AES-256-GCM으로 암호화합니다
 * @param plaintext - 암호화할 평문 (Buffer 또는 string)
 * @param masterKey - 마스터 키 (Buffer)
 * @returns 암호화된 데이터
 */
export function encrypt(plaintext: Buffer | string, masterKey: Buffer): EncryptedData {
  // 평문을 Buffer로 변환
  const plainBuffer = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf-8');

  // 랜덤 salt 생성
  const salt = randomBytes(SALT_LENGTH);

  // 랜덤 nonce 생성
  const nonce = randomBytes(NONCE_LENGTH);

  // 키 파생
  const key = deriveKey(masterKey, salt);

  // AES-256-GCM 암호화
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);

  // auth tag 추출
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    salt: salt.toString('base64'),
    nonce: nonce.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * AES-256-GCM 암호화된 데이터를 복호화합니다
 * @param encryptedData - 암호화된 데이터
 * @param masterKey - 마스터 키 (Buffer)
 * @returns 복호화된 평문 (Buffer)
 * @throws 복호화 실패 시 에러 (잘못된 키, 변조된 데이터 등)
 */
export function decrypt(encryptedData: EncryptedData, masterKey: Buffer): Buffer {
  // Base64 디코딩
  const salt = Buffer.from(encryptedData.salt, 'base64');
  const nonce = Buffer.from(encryptedData.nonce, 'base64');
  const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');

  // 키 파생
  const key = deriveKey(masterKey, salt);

  // AES-256-GCM 복호화
  const decipher = createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: invalid key or corrupted data');
  }
}

/**
 * 문자열을 암호화하고 Base64로 인코딩된 결과를 반환합니다
 * @param plaintext - 암호화할 문자열
 * @param masterKey - 마스터 키 (Buffer)
 * @returns 암호화된 데이터
 */
export function encryptString(plaintext: string, masterKey: Buffer): EncryptedData {
  return encrypt(plaintext, masterKey);
}

/**
 * 암호화된 데이터를 복호화하여 문자열로 반환합니다
 * @param encryptedData - 암호화된 데이터
 * @param masterKey - 마스터 키 (Buffer)
 * @returns 복호화된 문자열
 */
export function decryptToString(encryptedData: EncryptedData, masterKey: Buffer): string {
  const decrypted = decrypt(encryptedData, masterKey);
  return decrypted.toString('utf-8');
}

/**
 * 암호화된 데이터를 JSON 문자열로 직렬화합니다
 * @param encryptedData - 암호화된 데이터
 * @returns JSON 문자열
 */
export function serializeEncryptedData(encryptedData: EncryptedData): string {
  return JSON.stringify(encryptedData);
}

/**
 * JSON 문자열에서 암호화된 데이터를 역직렬화합니다
 * @param json - JSON 문자열
 * @returns 암호화된 데이터
 */
export function deserializeEncryptedData(json: string): EncryptedData {
  const parsed = JSON.parse(json);

  // 필수 필드 검증
  if (!parsed.ciphertext || !parsed.salt || !parsed.nonce || !parsed.authTag) {
    throw new Error('Invalid encrypted data format');
  }

  return {
    ciphertext: parsed.ciphertext,
    salt: parsed.salt,
    nonce: parsed.nonce,
    authTag: parsed.authTag,
  };
}
