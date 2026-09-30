import { HTTPException } from 'hono/http-exception';

export const JSON_BODY_LIMIT = 32768;
export const AUTH_BODY_LIMIT = 65536;
export const IMPORT_BODY_LIMIT = 8192;
const reject = (message, status = 400) => { throw new HTTPException(status, { message }); };

// Count bytes while reading: Content-Length is untrusted and can be absent.
export async function readJsonObject(c, { maxBytes = JSON_BODY_LIMIT, allowed } = {}) {
  if (!/^application\/json(?:\s*;|$)/i.test(c.req.header('Content-Type') || '')) reject('JSON body required', 415);
  const reader = c.req.raw.body?.getReader();
  if (!reader) reject('JSON body required');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        try { await reader.cancel(); } catch { /* Do not mask the size error. */ }
        reject('Request body too large', 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    reject('Unable to read request body');
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { reject('Invalid JSON'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') reject('Expected JSON object');
  if (allowed && Object.keys(parsed).some(key => !allowed.includes(key))) reject('Unknown field');
  return parsed;
}

export function bodyError(c, error) {
  return c.json({ message: error instanceof HTTPException ? error.message : 'ข้อมูลไม่ถูกต้อง' }, error instanceof HTTPException ? error.status : 400);
}

// Never log exception messages/stacks: provider errors can contain API keys,
// credentialed URLs, request bodies or SQL values.
export function logSafeError(scope) {
  console.error(scope, { type: 'operation_failed' });
}
