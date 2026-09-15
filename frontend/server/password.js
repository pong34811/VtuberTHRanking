import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 600000;
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 15 || password.length > 128) {
    throw new Error('รหัสผ่านต้องยาว 15–128 ตัวอักษร');
  }
  return password;
}
export async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256').toString('hex');
  return `pbkdf2-sha256$${ITERATIONS}$${salt}$${hash}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [scheme, iterations, salt, hash] = String(encoded).split('$');
  if (scheme !== 'pbkdf2-sha256' || Number(iterations) !== ITERATIONS || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  const actual = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
