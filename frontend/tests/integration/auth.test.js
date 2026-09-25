import { describe, expect, it } from 'vitest';
import auth from '../../server/auth.js';
import { verifyPassword } from '../../server/password.js';
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

async function postAuth(path, payload, responses = [], env = {}) {
  const { db, calls } = createD1Stub(responses);
  const response = await auth.fetch(new Request(`https://example.com${path}`, {
    method: 'POST',
    headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }), { DB: db, ...env });
  return { response, calls };
}

describe('initial administrator setup', () => {
  const payload = { username: 'reviewadmin', password: 'long-review-password', setupToken: 'private-setup-token' };
  const env = { ADMIN_SETUP_TOKEN: payload.setupToken };
  const unusedSetup = [null, { count: 1 }, null];

  it.each([undefined, '', '   '])('refuses setup when the server token is %s', async token => {
    const { response, calls } = await postAuth('/setup', payload, [], { ADMIN_SETUP_TOKEN: token });
    expect(response.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it('does not create an administrator with the wrong token', async () => {
    const { response, calls } = await postAuth('/setup', { ...payload, setupToken: 'wrong' }, unusedSetup, env);
    expect(response.status).toBe(403);
    expect(calls.some(call => call.sql.includes('INSERT INTO users'))).toBe(false);
  });

  it('requires a long password even with a valid setup token', async () => {
    const { response, calls } = await postAuth('/setup', { ...payload, password: 'abcd' }, unusedSetup, env);
    expect(response.status).toBe(400);
    expect(calls.some(call => call.sql.includes('INSERT INTO users'))).toBe(false);
  });

  it('creates the first manager and starts a session with a valid token', async () => {
    const { response, calls } = await postAuth('/setup', payload, unusedSetup, env);
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toContain('__Host-vt_admin=');
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
    await expect(response.json()).resolves.toMatchObject({ user: { username: payload.username, role: 'manager' } });
    const inserted = calls.find(call => call.sql.includes('INSERT INTO users'));
    await expect(verifyPassword(payload.password, inserted.values[2])).resolves.toBe(true);
  });

  it('does not allow setup again once the bootstrap lock exists', async () => {
    const { response } = await postAuth('/setup', payload, [null, { count: 1 }, { id: 1 }], env);
    expect(response.status).toBe(409);
  });
});

describe('login attempt limits', () => {
  it('accepts the 64-character usernames that managers can create', async () => {
    const username = 'a'.repeat(64);
    const { response, calls } = await postAuth('/login', { username, password: 'wrong-password' }, [null, { count: 1 }, null, { count: 1 }, null]);
    expect(response.status).toBe(401);
    expect(calls.some(call => call.sql.includes('SELECT * FROM users WHERE username=?') && call.values[0] === username)).toBe(true);

    const tooLong = await postAuth('/login', { username: `${username}a`, password: 'wrong-password' });
    expect(tooLong.response.status).toBe(401);
    expect(tooLong.calls).toHaveLength(0);
  });

  it('stops before allocating a username counter when the IP has exhausted its limit', async () => {
    const { response, calls } = await postAuth('/login', { username: 'new-user', password: 'anything' }, [null, { count: 31 }]);
    expect(response.status).toBe(429);
    expect(calls).toHaveLength(2);
  });

  it('also rejects an exhausted username limit from an allowed IP', async () => {
    const { response } = await postAuth('/login', { username: 'admin', password: 'anything' }, [null, { count: 1 }, null, { count: 11 }]);
    expect(response.status).toBe(429);
  });
});
