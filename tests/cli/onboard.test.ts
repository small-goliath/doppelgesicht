import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePasswordComplexity } from '../../src/security/master-key.js';

describe('Onboard CLI', () => {
  describe('Password Validation', () => {
    it('12자 미만 비밀번호는 거부해야 함', () => {
      const result = validatePasswordComplexity('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('12'))).toBe(true);
    });

    it('대문자가 없는 비밀번호는 거부해야 함', () => {
      const result = validatePasswordComplexity('lowercase123!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
    });

    it('소문자가 없는 비밀번호는 거부해야 함', () => {
      const result = validatePasswordComplexity('UPPERCASE123!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
    });

    it('숫자가 없는 비밀번호는 거부해야 함', () => {
      const result = validatePasswordComplexity('NoNumbers!@#');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('digit'))).toBe(true);
    });

    it('특수문자가 없는 비밀번호는 거부해야 함', () => {
      const result = validatePasswordComplexity('NoSpecial123');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('special'))).toBe(true);
    });

    it('복잡한 비밀번호는 허용해야 함', () => {
      const result = validatePasswordComplexity('ComplexP@ssw0rd!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('모든 요구사항을 충족하는 비밀번호', () => {
      const passwords = [
        'MyStr0ng!Pass',
        'C0mpl3x@P@ssw0rd',
        'S3cur3!K3y#2024',
      ];

      for (const password of passwords) {
        const result = validatePasswordComplexity(password);
        expect(result.valid).toBe(true);
      }
    });
  });
});
