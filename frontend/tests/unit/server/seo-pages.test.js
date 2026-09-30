import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../../functions/[[path]].js';

const configuration = vi.hoisted(() => ({ site_name: 'Fixture Ranking', site_status: 'active' }));
vi.mock('../../../server/site-config.js', () => ({
  readSiteConfig: async () => configuration,
}));
afterEach(() => { configuration.site_status = 'active'; });

const html = '<html><head><title>Default</title></head><body><div id="root"></div></body></html>';
function context(path, profile = null, options = {}) {
  return {
    request: new Request(`https://vtuberthai-ranking.pages.dev${path}`, options),
    env: { ENVIRONMENT: 'production', DB: { prepare: vi.fn(() => ({ bind: () => ({ first: async () => profile }), all: async () => ({ results: profile ? [profile] : [] }) })) } },
    next: vi.fn(async () => new Response(html, { headers: { 'Content-Type': 'text/html' } })),
  };
}

describe('route-aware Pages responses', () => {
  it('returns real HTML 404 for unknown pages and missing active profiles', async () => {
    for (const path of ['/missing-page', '/profile/missing']) {
      const response = await onRequest(context(path));
      expect(response.status).toBe(404);
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex,nofollow');
      expect(await response.text()).toContain('ไม่พบ');
    }
  });
  it('returns per-route profile metadata without exposing internal fields', async () => {
    const response = await onRequest(context('/profile/aiko', { name: 'Aiko', slug: 'aiko', bio: 'Gaming', notes: 'private-fixture-note' }));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('โปรไฟล์ Aiko | Fixture Ranking');
    expect(body).not.toContain('private-fixture-note');
  });
  it('returns proper crawler documents, noindex Admin and preserved legacy redirects', async () => {
    const robots = await onRequest(context('/robots.txt'));
    expect(robots.headers.get('Content-Type')).toContain('text/plain');
    expect(await robots.text()).toContain('Sitemap:');
    const sitemap = await onRequest(context('/sitemap.xml', { slug: 'aiko' }));
    expect(sitemap.headers.get('Content-Type')).toContain('application/xml');
    expect(await sitemap.text()).toContain('/profile/aiko');
    expect((await onRequest(context('/admin/channels'))).headers.get('X-Robots-Tag')).toBe('noindex,nofollow');
    const legacy = await onRequest(context('/search?q=Aiko&affiliation=indie'));
    expect(legacy.status).toBe(308);
    expect(legacy.headers.get('Location')).toBe('/discover?q=Aiko&affiliation=indie');
  });
  it('enforces maintenance with Retry-After while Admin remains available', async () => {
    configuration.site_status = 'maintenance';
    const response = await onRequest(context('/home'));
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBeTruthy();
    expect(await response.text()).toContain('เว็บไซต์กำลังปรับปรุง');
    expect((await onRequest(context('/admin/channels'))).status).toBe(200);
  });
  it('fails closed on production-configured preview before reading D1', async () => {
    const ctx = context('/home');
    ctx.request = new Request('https://unconfigured.vtuberthai-ranking.pages.dev/home');
    const response = await onRequest(ctx);
    expect(response.status).toBe(503);
    expect(ctx.env.DB.prepare).not.toHaveBeenCalled();
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex,nofollow');
  });
});
