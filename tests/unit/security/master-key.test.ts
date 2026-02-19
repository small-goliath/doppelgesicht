import { describe, it, expect } from 'vitest';
import {
  deriveMasterKey,
  verifyAndRecoverKey,
  clearMasterKey,
  validatePasswordComplexity,
} from '../../../src/security/master-key.js';

describe('Master Key Module', () => {
  describe('deriveMasterKey', () => {
    it('should derive master key from password', async () => {
      const password = 'TestPassword123!';

      const result = await deriveMasterKey(password);

      expect(result.hash).toBeDefined();
      expect(result.key).toBeInstanceOf(Buffer);
      expect(result.key.length).toBe(32); // 256 bits

      // Argon2id 해시 형식 확인
      expect(result.hash).toContain('$argon2id$');
    });

    it('should produce different keys for different passwords', async () => {
      const result1 = await deriveMasterKey('Password123!');
      const result2 = await deriveMasterKey('Password456!');

      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.key.equals(result2.key)).toBe(false);
    });

    it('should produce different keys for same password (different salt)', async () => {
      const password = 'SamePassword123!';

      const result1 = await deriveMasterKey(password);
      const result2 = await deriveMasterKey(password);

      // 같은 비밀번호라도 다른 salt로 인해 다른 키 생성
      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.key.equals(result2.key)).toBe(false);
    });
  });

  describe('verifyAndRecoverKey', () => {
    it('should verify correct password and recover key', async () => {
      const password = 'TestPassword123!';
      const result = await deriveMasterKey(password);

      // 키 복구
      const recoveredKey = await verifyAndRecoverKey(password, result.hash);

      expect(recoveredKey).not.toBeNull();
      expect(recoveredKey!.equals(result.key)).toBe(true);
    });

    it('should return null for incorrect password', async () => {
      const password = 'TestPassword123!';
      const result = await deriveMasterKey(password);

      // 잘못된 비밀번호로 시도
      const recoveredKey = await verifyAndRecoverKey('WrongPassword!', result.hash);

      expect(recoveredKey).toBeNull();
    });

    it('should return null for invalid hash', async () => {
      const recoveredKey = await verifyAndRecoverKey('password', 'invalid-hash');

      expect(recoveredKey).toBeNull();
    });
  });

  describe('clearMasterKey', () => {
    it('should clear master key buffer', () => {
      const key = Buffer.from('secret-key-data-32-bytes-long!!!', 'utf-8');

      clearMasterKey(key);

      // 버퍼가 0으로 채워졌는지 확인
      expect(key.toString('hex')).toBe('00'.repeat(32));
    });
  });

  describe('validatePasswordComplexity', () => {
    it('should validate strong password', () => {
      const result = validatePasswordComplexity('StrongP@ssw0rd!');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 12 characters', () => {
      const result = validatePasswordComplexity('Short1!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long');
    });

    it('should reject password without uppercase', () => {
      const result = validatePasswordComplexity('lowercase123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = validatePasswordComplexity('UPPERCASE123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without digit', () => {
      const result = validatePasswordComplexity('NoDigitsHere!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one digit');
    });

    it('should reject password without special character', () => {
      const result = validatePasswordComplexity('NoSpecialChars123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should report multiple errors', () => {
      const result = validatePasswordComplexity('weak');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
