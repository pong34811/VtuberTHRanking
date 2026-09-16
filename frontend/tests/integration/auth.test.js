import { describe, expect, it } from 'vitest';
import auth from '../../server/auth.js';
import { createD1Stub } from '../helpers/d1.js';

function authRequest(path, init = {}, responses = []) {
  const { db } = createD1Stub(responses);
  return auth.fetch(new Request(`https://example.com${path}`, init), { DB: db });
}

describe('auth routes', () => {
  it('returns an unauthenticated /me response with setupRequired', async () => {
    const response = await authRequest('/me');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'กรุณาเข้าสู่ระบบ', setupRequired: true });
  });

  it('rejects a write request from an invalid origin', async () => {
    const response = await authRequest('/login', {
      method: 'POST',
      headers: { Origin: 'https://outside.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' }),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: 'ไม่อนุญาตคำขอจากภายนอกเว็บไซต์' });
  });

  it('rejects an invalid login payload', async () => {
    const response = await authRequest('/login', {
      method: 'POST',
      headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'a', password: 'x' }),
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  });

  it('rejects logout without a session', async () => {
    const response = await authRequest('/logout', {
      method: 'POST', headers: { Origin: 'https://example.com' },
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'กรุณาเข้าสู่ระบบ', setupRequired: true });
  });
});
