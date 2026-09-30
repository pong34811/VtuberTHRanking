import { CANONICAL_ORIGIN, DEFAULT_SITE_NAME, getPageMetadata } from '../../shared/page-metadata.js';
import { readSiteConfig } from '../server/site-config.js';
import { renderMetadataHtml, renderRobots, renderSitemap } from '../server/seo.js';

const staticPaths = new Set(['/favicon.ico', '/favicon.svg', '/social-card.png', '/social-card.svg', '/vite.svg']);
const adminPath = path => /^\/admin(?:\/|$)/.test(path);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path.startsWith('/api/') || path.startsWith('/assets/') || staticPaths.has(path)) return context.next();
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });

  const isPreview = url.hostname.endsWith('.vtuberthai-ranking.pages.dev');
  const unconfiguredPreview = isPreview && env.ENVIRONMENT === 'production';
  const indexableEnvironment = env.ENVIRONMENT === 'production' && url.origin === CANONICAL_ORIGIN;
  const responseHeaders = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  let metadata = getPageMetadata({ pathname: path, search: url.search });
  const documentResponse = (body, type, status = 200) => {
    responseHeaders.set('Content-Type', `${type}; charset=utf-8`);
    if (!indexableEnvironment || status !== 200) responseHeaders.set('X-Robots-Tag', 'noindex,nofollow');
    return new Response(request.method === 'HEAD' ? null : body, { status, headers: responseHeaders });
  };

  if (unconfiguredPreview) {
    responseHeaders.set('Retry-After', '300');
    return documentResponse('Preview environment requires an isolated staging D1 binding and ENVIRONMENT=staging.', 'text/plain', 503);
  }
  if (path === '/search') return new Response(null, { status: 308, headers: { Location: `/discover${url.search}`, 'Cache-Control': 'no-store' } });
  if (path === '/robots.txt') return documentResponse(renderRobots({ indexable: indexableEnvironment }), 'text/plain');

  try {
    const config = !adminPath(path) && (metadata.status === 200 || path === '/sitemap.xml')
      ? await readSiteConfig(env.DB) : { site_name: DEFAULT_SITE_NAME, site_status: 'active' };
    const maintenance = !adminPath(path) && config.site_status === 'maintenance';
    if (path === '/sitemap.xml' && !maintenance) {
      const { results } = await env.DB.prepare('SELECT slug,updated_at FROM vtubers WHERE is_active=1 ORDER BY id').all();
      return documentResponse(renderSitemap(results), 'application/xml');
    }
    let profile = null;
    if (!maintenance && /^\/profile\/[^/]+$/.test(path)) {
      let slug;
      try { slug = decodeURIComponent(path.slice('/profile/'.length)); } catch { slug = null; }
      profile = slug ? await env.DB.prepare('SELECT name,slug,bio FROM vtubers WHERE slug=? AND is_active=1 LIMIT 1').bind(slug).first() : null;
    }
    metadata = getPageMetadata({ pathname: path, search: url.search, siteName: config.site_name, profile, notFound: /^\/profile\//.test(path) && !profile && !maintenance, maintenance });
  } catch {
    metadata = { ...getPageMetadata({ pathname: path, maintenance: true }), heading: 'เว็บไซต์ยังไม่พร้อมใช้งาน', title: 'เว็บไซต์ยังไม่พร้อมใช้งาน | VTuberThai Ranking', description: 'โหลดข้อมูลเว็บไซต์ไม่สำเร็จ กรุณาลองอีกครั้งภายหลัง' };
  }

  if (!indexableEnvironment) metadata.robots = 'noindex,nofollow';
  if (metadata.status === 503) responseHeaders.set('Retry-After', '300');
  // Request the pretty root path: Pages redirects direct /index.html requests.
  const assetUrl = new URL('/', url);
  const assetRequest = new Request(assetUrl, { method: 'GET', headers: request.headers });
  const asset = env.ASSETS ? await env.ASSETS.fetch(assetRequest) : await context.next(assetRequest);
  if (asset.status >= 500) return asset;
  const body = renderMetadataHtml(await asset.text(), metadata);
  responseHeaders.set('X-Robots-Tag', metadata.robots);
  return documentResponse(body, 'text/html', metadata.status);
}
