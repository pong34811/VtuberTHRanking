import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminApi, authApi, request } from '@/admin/api';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('rejects a successful HTML response instead of treating it as a saved object', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>fallback</html>', { headers: { 'Content-Type': 'text/html' } })));
  await expect(adminApi('/categories')).rejects.toThrow(/ตอบกลับไม่ถูกต้อง/);
});

it.each(['GET', 'POST', 'download'])('emits exactly one session event for an unauthorized %s request', async (method) => {
  const onExpired = vi.fn();
  window.addEventListener('admin:unauthorized', onExpired);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('expired', { status: 401 })));
  try {
    await expect(adminApi(method === 'download' ? '/reports/3/download' : '/categories', {
      method: method === 'POST' ? 'POST' : 'GET', raw: method === 'download',
    })).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
  } finally { window.removeEventListener('admin:unauthorized', onExpired); }
});

it('does not cause an auth/me or rejected-login event loop', async () => {
  const onExpired = vi.fn();
  window.addEventListener('admin:unauthorized', onExpired);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'expired' }, { status: 401 })));
  try {
    await expect(authApi('/me')).rejects.toMatchObject({ status: 401 });
    await expect(authApi('/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 });
    expect(onExpired).not.toHaveBeenCalled();
  } finally { window.removeEventListener('admin:unauthorized', onExpired); }
});

it.each(['null', '[]', '"saved"', '{broken'])('rejects an invalid JSON success body %s', async (body) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'application/json' } })));
  await expect(adminApi('/users')).rejects.toThrow(/ตอบกลับไม่ถูกต้อง/);
});

it('accepts CSV downloads but rejects an HTML download success', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response('rank,name\n1,A', { headers: { 'Content-Type': 'text/csv; charset=utf-8' } }))
    .mockResolvedValueOnce(new Response('<html>wrong</html>', { headers: { 'Content-Type': 'text/html' } })));
  expect(await (await adminApi('/reports/3/download', { raw: true })).text()).toContain('1,A');
  await expect(adminApi('/reports/3/download', { raw: true })).rejects.toThrow(/ตอบกลับไม่ถูกต้อง/);
});

it('aborts a timed-out request and clears the timer and caller listener', async () => {
  vi.useFakeTimers();
  const caller = new AbortController();
  const remove = vi.spyOn(caller.signal, 'removeEventListener');
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  const pending = request('/api/v1/admin/categories', { signal: caller.signal, timeoutMs: 30 });
  const rejected = expect(pending).rejects.toThrow(/นานเกินไป/);
  await vi.advanceTimersByTimeAsync(30);
  await rejected;
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});

it('honors caller cancellation without turning it into an unauthorized event', async () => {
  const caller = new AbortController();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  const pending = adminApi('/categories', { signal: caller.signal });
  caller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
