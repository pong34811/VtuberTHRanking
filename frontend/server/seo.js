import { CANONICAL_ORIGIN } from '../../shared/page-metadata.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function renderMetadataHtml(html, metadata) {
  const head = `
<title>${escapeHtml(metadata.title)}</title>
<meta name="description" content="${escapeHtml(metadata.description)}">
<meta name="robots" content="${escapeHtml(metadata.robots)}">
<link rel="canonical" href="${escapeHtml(metadata.canonical)}">
<meta property="og:title" content="${escapeHtml(metadata.title)}">
<meta property="og:description" content="${escapeHtml(metadata.description)}">
<meta property="og:url" content="${escapeHtml(metadata.canonical)}">
<meta property="og:image" content="${escapeHtml(metadata.image)}">
<meta property="og:type" content="${escapeHtml(metadata.type)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(metadata.title)}">
<meta name="twitter:description" content="${escapeHtml(metadata.description)}">
<meta name="twitter:image" content="${escapeHtml(metadata.image)}">`;
  const cleaned = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name=["'](?:description|robots|twitter:[^"']+)["']|property=["']og:[^"']+["'])[^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '');
  const fallback = `<div id="root"><main><h1>${escapeHtml(metadata.heading)}</h1><p>${escapeHtml(metadata.description)}</p><nav aria-label="สำรวจเว็บไซต์"><a href="/home">ดูอันดับ</a> · <a href="/discover">ค้นหา</a></nav></main></div>`;
  return cleaned.replace(/<\/head>/i, `${head}\n</head>`).replace(/<div\s+id=["']root["']\s*>\s*<\/div>/i, fallback);
}

export function renderRobots({ indexable = true } = {}) {
  return indexable
    ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
}

export function renderSitemap(profiles = []) {
  const paths = ['/', '/home', '/home?affiliation=indie', '/home?affiliation=agency', '/stats', '/discover'];
  const entries = paths.map(path => ({ location: `${CANONICAL_ORIGIN}${path}` }));
  for (const profile of profiles) {
    if (typeof profile.slug !== 'string' || !profile.slug) continue;
    const timestamp = String(profile.updated_at || '').replace(' ', 'T');
    const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(timestamp) ? timestamp : `${timestamp}Z`);
    entries.push({ location: `${CANONICAL_ORIGIN}/profile/${encodeURIComponent(profile.slug)}`, lastmod: Number.isNaN(date.getTime()) ? null : date.toISOString() });
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(entry => `<url><loc>${escapeHtml(entry.location)}</loc>${entry.lastmod ? `<lastmod>${escapeHtml(entry.lastmod)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
}
