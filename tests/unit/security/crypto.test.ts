import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  encryptString,
  decryptToString,
  serializeEncryptedData,
  deserializeEncryptedData,
} from '../../../src/security/crypto.js';

describe('Crypto Module', () => {
  // 테스트용 마스터 키 (32 bytes = 256 bits)
  const testMasterKey = Buffer.from('a'.repeat(32), 'utf-8');

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'Hello, World!';

      // 암호화
      const encrypted = encryptString(plaintext, testMasterKey);

      // 필드 검증
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.nonce).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      // 복호화
      const decrypted = decryptToString(encrypted, testMasterKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt Buffer data', () => {
      const plaintext = Buffer.from('Binary data: \x00\x01\x02\x03', 'binary');

      // 암호화
      const encrypted = encrypt(plaintext, testMasterKey);

      // 복호화
      const decrypted = decrypt(encrypted, testMasterKey);
      expect(decrypted.equals(plaintext)).toBe(true);
    });

    it('should produce different ciphertext for same plaintext (different salt)', () => {
      const plaintext = 'Same text';

      const encrypted1 = encryptString(plaintext, testMasterKey);
      const encrypted2 = encryptString(plaintext, testMasterKey);

      // 같은 평문도 다른 salt로 인해 다른 암호문 생성
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.nonce).not.toBe(encrypted2.nonce);

      // 하지만 둘 다 정상 복호화 가능
      expect(decryptToString(encrypted1, testMasterKey)).toBe(plaintext);
      expect(decryptToString(encrypted2, testMasterKey)).toBe(plaintext);
    });

    it('should fail decryption with wrong key', () => {
      const plaintext = 'Secret message';
      const encrypted = encryptString(plaintext, testMasterKey);

      // 잘못된 키로 복호화 시도
      const wrongKey = Buffer.from('b'.repeat(32), 'utf-8');

      expect(() => {
        decryptToString(encrypted, wrongKey);
      }).toThrow('Decryption failed');
    });

    it('should fail decryption with corrupted data', () => {
      const plaintext = 'Secret message';
      const encrypted = encryptString(plaintext, testMasterKey);

      // 데이터 변조
      encrypted.ciphertext = encrypted.ciphertext.substring(0, encrypted.ciphertext.length - 4);

      expect(() => {
        decryptToString(encrypted, testMasterKey);
      }).toThrow('Decryption failed');
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize encrypted data', () => {
      const plaintext = 'Test data';
      const encrypted = encryptString(plaintext, testMasterKey);

      // 직렬화
      const serialized = serializeEncryptedData(encrypted);

      // 역직렬화
      const deserialized = deserializeEncryptedData(serialized);

      // 복호화 가능 여부 확인
      expect(decryptToString(deserialized, testMasterKey)).toBe(plaintext);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => {
        deserializeEncryptedData('invalid json');
      }).toThrow();
    });

    it('should throw error for missing fields', () => {
      expect(() => {
        deserializeEncryptedData('{"ciphertext":"test"}');
      }).toThrow('Invalid encrypted data format');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const plaintext = '';
      const encrypted = encryptString(plaintext, testMasterKey);
      const decrypted = decryptToString(encrypted, testMasterKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Hello 世界 🌍 Привет мир';
      const encrypted = encryptString(plaintext, testMasterKey);
      const decrypted = decryptToString(encrypted, testMasterKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle large data', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encryptString(plaintext, testMasterKey);
      const decrypted = decryptToString(encrypted, testMasterKey);
      expect(decrypted).toBe(plaintext);
    });
  });
});
