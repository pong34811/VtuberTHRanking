import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

// ponytail: 600000 iterations exceeds Cloudflare Workers' pbkdf2 limit (100000),
// which made every login/setup call 500. Lowered to 100000 — still slow enough to
// resist offline brute force, and matches the Workers runtime ceiling.
const ITERATIONS = 100000;
export function validatePassword(password) {
  // ponytail: ง่ายสุดแค่ username+password ยาว >=4 ก็พอ
  if (typeof password !== 'string' || password.length < 4 || password.length > 128) {
    throw new Error('รหัสผ่านต้องยาว 4–128 ตัวอักษร');
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
