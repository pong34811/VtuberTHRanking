import { describe, expect, it } from 'vitest';
import { pbkdf2Sync } from 'node:crypto';
import { hashPassword, validatePassword, verifyPassword } from '../../../server/password.js';

describe('passwords', () => {
  it.each([4, 11])('rejects a new password with length %i', length => {
    expect(() => validatePassword('a'.repeat(length))).toThrow('รหัสผ่านต้องยาว 12–128 ตัวอักษร');
  });

  it('accepts a password with length 12', () => {
    expect(validatePassword('a'.repeat(12))).toBe('a'.repeat(12));
  });

  it('accepts a password with length 128', () => {
    const password = 'a'.repeat(128);
    expect(validatePassword(password)).toBe(password);
  });

  it('rejects a password with length 129', () => {
    expect(() => validatePassword('a'.repeat(129))).toThrow('รหัสผ่านต้องยาว 12–128 ตัวอักษร');
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

  it('still verifies an existing short password without allowing a new one', async () => {
    const salt = '0123456789abcdef0123456789abcdef';
    const hash = pbkdf2Sync('abcd', salt, 100000, 32, 'sha256').toString('hex');
    await expect(verifyPassword('abcd', `pbkdf2-sha256$100000$${salt}$${hash}`)).resolves.toBe(true);
    expect(() => validatePassword('abcd')).toThrow();
  });

  it.each([
    'not-a-hash',
    'pbkdf2-sha256$100000$short$not-a-hash',
    'pbkdf2-sha256$99999$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000',
  ])('returns false for malformed encoded hash %s', async encoded => {
    await expect(verifyPassword('valid-password', encoded)).resolves.toBe(false);
  });
});
