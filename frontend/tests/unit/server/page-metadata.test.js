import { describe, expect, it } from 'vitest';
import { getPageMetadata, CANONICAL_ORIGIN } from '../../../../shared/page-metadata.js';
import { renderMetadataHtml, renderRobots, renderSitemap } from '../../../server/seo.js';

describe('public route metadata', () => {
  it('distinguishes the introduction from legacy ranking queries and indexes the root', () => {
    expect(getPageMetadata().canonical).toBe(`${CANONICAL_ORIGIN}/`);
    expect(getPageMetadata().heading).toContain('หน้าแรก');
    expect(getPageMetadata({ search: '?category=views' }).canonical).toBe(`${CANONICAL_ORIGIN}/home`);
    expect(renderSitemap()).toContain(`<loc>${CANONICAL_ORIGIN}/</loc>`);
  });
  it('has distinct Thai route titles, canonical URLs and crawler indexing rules', () => {
    const home = getPageMetadata({ pathname: '/home', search: '?affiliation=indie&utm_source=test', siteName: 'Fixture Ranking' });
    const discover = getPageMetadata({ pathname: '/discover', search: '?q=Aiko' });
    const admin = getPageMetadata({ pathname: '/admin/channels' });
    const missing = getPageMetadata({ pathname: '/missing' });
    expect(home.title).toContain('วีทูปเบอร์อิสระ');
    expect(home.title).toContain('Fixture Ranking');
    expect(home.canonical).toBe(`${CANONICAL_ORIGIN}/home?affiliation=indie`);
    expect(discover.title).not.toBe(home.title);
    expect(discover.canonical).toBe(`${CANONICAL_ORIGIN}/discover`);
    expect(home.robots).toBe('index,follow');
    expect(admin.robots).toBe('noindex,nofollow');
    expect(missing.status).toBe(404);
    expect(missing.robots).toBe('noindex,nofollow');
  });
  it('renders safe route-aware HTML and real crawler documents', () => {
    const html = '<html><head><title>Old</title><meta name="description" content="old"></head><body><div id="root"></div></body></html>';
    const metadata = getPageMetadata({ pathname: '/profile/aiko', profile: { name: '<script>alert(1)</script>', bio: 'A & B "test"' } });
    const output = renderMetadataHtml(html, metadata);
    expect(output).toContain('&lt;script&gt;');
    expect(output).not.toContain('<script>alert(1)</script>');
    expect(output).toContain(`<link rel="canonical" href="${CANONICAL_ORIGIN}/profile/aiko">`);
    expect(output).toContain('property="og:title"');
    expect(output.match(/name="description"/g)).toHaveLength(1);
    expect(renderRobots()).toContain(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`);
    expect(renderRobots()).toContain('Disallow: /admin');
    const sitemap = renderSitemap([{ slug: 'aiko', updated_at: '2026-09-01T00:00:00.000Z' }]);
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(sitemap).toContain(`<loc>${CANONICAL_ORIGIN}/profile/aiko</loc>`);
    expect(sitemap).not.toContain('/admin');
  });
});
