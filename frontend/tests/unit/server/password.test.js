import { describe, expect, it } from 'vitest';
import { hashPassword, validatePassword, verifyPassword } from '../../../server/password.js';

describe('passwords', () => {
  it('rejects a password with length 3', () => {
    expect(() => validatePassword('abc')).toThrow('รหัสผ่านต้องยาว 4–128 ตัวอักษร');
  });

  it('accepts a password with length 4', () => {
    expect(validatePassword('abcd')).toBe('abcd');
  });

  it('accepts a password with length 128', () => {
    const password = 'a'.repeat(128);
    expect(validatePassword(password)).toBe(password);
  });

  it('rejects a password with length 129', () => {
    expect(() => validatePassword('a'.repeat(129))).toThrow('รหัสผ่านต้องยาว 4–128 ตัวอักษร');
  });

  it('round-trips a valid password', async () => {
    const password = 'correct horse battery staple';
    const encoded = await hashPassword(password);

    expect(typeof encoded).toBe('string');
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
  });

  it('rejects a wrong password for a valid encoded hash', async () => {
    const encoded = await hashPassword('correct-password');
    await expect(verifyPassword('wrong-password', encoded)).resolves.toBe(false);
  });

  it.each([
    'not-a-hash',
    'pbkdf2-sha256$100000$short$not-a-hash',
    'pbkdf2-sha256$99999$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000',
  ])('returns false for malformed encoded hash %s', async encoded => {
    await expect(verifyPassword('valid-password', encoded)).resolves.toBe(false);
  });
});
