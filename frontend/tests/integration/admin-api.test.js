import { describe, expect, it } from 'vitest';
import admin from '../../server/admin.js';
import { createD1Stub } from '../helpers/d1.js';

function adminRequest(path, init = {}) {
  const { db } = createD1Stub();
  return admin.fetch(new Request(`https://example.com${path}`, init), { DB: db });
}

describe('admin API authentication', () => {
  it('rejects an unauthenticated read request', async () => {
    const response = await adminRequest('/vtubers');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Authentication required' });
  });

  it('rejects an unauthenticated write request', async () => {
    const response = await adminRequest('/vtubers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', slug: 'test' }),
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Authentication required' });
  });
});
