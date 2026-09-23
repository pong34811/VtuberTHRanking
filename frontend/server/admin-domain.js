import { HTTPException } from 'hono/http-exception';
import { currentMonth } from './ranking-period.js';
import { competitionRanks, nextMonthBoundary, previousMonth } from '../../shared/ranking.js';

export { currentMonth, competitionRanks, nextMonthBoundary, previousMonth };

export const fail = (message, status = 400) => { throw new HTTPException(status, { message }); };
export const choice = (value, values, field) => values.includes(value) ? value : fail(`Invalid ${field}`);
export function str(value, field, max = 200, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`Invalid ${field}`);
  return value.trim();
}
export function month(value) {
  if (typeof value !== 'string' || !/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(value)) fail('Invalid month (YYYY-MM)');
  return value;
}
export function selection(body) {
  const period = choice(body.period || 'monthly', ['monthly', 'alltime'], 'period');
  const category = choice(body.category || 'followers', ['followers', 'views', 'videos'], 'category');
  return { period, category, month: period === 'monthly' ? month(body.month || currentMonth()) + '-01' : null };
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export async function body(c, allowed) {
  if (!c.req.header('Content-Type')?.toLowerCase().startsWith('application/json')) fail('JSON body required', 415);
  let size = 0; const chunks = []; const reader = c.req.raw.body?.getReader();
  if (!reader) fail('JSON body required');
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 32768) { await reader.cancel(); fail('Request body too large', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let parsed; try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail('Invalid JSON'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') fail('Expected JSON object');
  if (Object.keys(parsed).some(key => !allowed.includes(key))) fail('Unknown field');
  return parsed;
}
export function url(value, field) {
  const text = str(value ?? '', field, 2048);
  if (!text) return text;
  try { const parsed = new URL(text); if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) fail(`Invalid ${field}`); }
  catch { fail(`Invalid ${field}`); }
  return text;
}
export const channelFields = ['name','slug','bio','avatar','agency_name','agency_id','country','debut_date','banner_url','youtube_url','twitch_url','x_url','category','affiliation','is_active','channel_url','platform','notes'];
export function channel(data) {
  const result = {};
  for (const field of ['name','slug']) result[field] = str(data[field], field, 100, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug)) fail('Slug must use lowercase letters, numbers and hyphens');
  result.bio = str(data.bio ?? '', 'bio', 5000);
  result.notes = str(data.notes ?? '', 'notes', 2000);
  result.agency_name = str(data.agency_name ?? '', 'agency_name', 100);
  result.country = str(data.country ?? 'Thailand', 'country', 100, true);
  result.debut_date = str(data.debut_date ?? '', 'debut_date', 10);
  if (result.debut_date && (!/^\d{4}-\d{2}-\d{2}$/.test(result.debut_date) || Number.isNaN(Date.parse(result.debut_date)) || new Date(result.debut_date).toISOString().slice(0,10) !== result.debut_date)) fail('Invalid debut_date');
  for (const field of ['avatar','banner_url','youtube_url','twitch_url','x_url','channel_url']) result[field] = url(data[field], field);
  result.category = choice(data.category ?? 'other', ['gaming','singing','chatting','art','asmr','education','other'], 'category');
  result.affiliation = choice(data.affiliation ?? 'indie', ['indie','agency'], 'affiliation');
  const agencyId = data.agency_id ?? null;
  if (result.affiliation === 'agency') {
    if (!Number.isSafeInteger(agencyId) || agencyId < 1) fail('กรุณาเลือกสังกัดในระบบ');
    result.agency_id = agencyId;
  } else {
    result.agency_id = null;
    result.agency_name = '';
  }
  result.platform = choice(data.platform ?? 'youtube', ['youtube','twitch','bilibili','other'], 'platform');
  if (![true,false,0,1].includes(data.is_active ?? true)) fail('Invalid is_active');
  result.is_active = Number(data.is_active ?? true);
  return result;
}
