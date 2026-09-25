import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DUMMY_PASSWORD_HASH, hashPassword, validatePassword, verifyPassword } from './password.js';

const auth = new Hono();
const lifetime = 8 * 60 * 60;
const usernamePattern = /^[a-z0-9_.-]{3,64}$/i;
const now = () => Math.floor(Date.now() / 1000);
const digest = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');
const cookieName = c => new URL(c.req.url).protocol === 'https:' ? '__Host-vt_admin' : 'vt_admin';
const cookieOptions = c => ({ httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Strict', path: '/', maxAge: lifetime });
export const publicUser = u => ({ id: u.id, username: u.username, display_name: u.display_name, email: u.email, role: u.role, status: u.status });

function equal(a, b) {
  return typeof a === 'string' && typeof b === 'string' && timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
}
export function validOrigin(c) { return c.req.header('Origin') === new URL(c.req.url).origin; }
export async function jsonBody(c) {
  if (!c.req.header('Content-Type')?.toLowerCase().startsWith('application/json')) throw new Error('กรุณาส่งข้อมูล JSON');
  const text = await c.req.text();
  if (text.length > 65536) throw new Error('ข้อมูลมีขนาดใหญ่เกินไป');
  const body = JSON.parse(text);
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('ข้อมูลไม่ถูกต้อง');
  return body;
}
async function setupRequired(c) { return !(await c.env.DB.prepare('SELECT id FROM bootstrap_lock WHERE id=1').first()); }
async function consumeAttempt(c, key, limit) {
  const time = now();
  await c.env.DB.prepare('DELETE FROM auth_attempts WHERE window_start < ?').bind(time - 900).run();
  const result = await c.env.DB.prepare(`INSERT INTO auth_attempts(key,count,window_start) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start < ? THEN 1 ELSE count+1 END,
    window_start=CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END RETURNING count`)
    .bind(digest(key), time, time - 900, time - 900).first();
  return result.count <= limit;
}
async function authenticate(c) {
  const raw = getCookie(c, cookieName(c));
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const session = await c.env.DB.prepare(`SELECT s.*, u.username,u.display_name,u.email,u.role,u.status
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'`)
    .bind(digest(raw), now()).first();
  if (!session) return null;
  c.set('session', session);
  const user = publicUser({ ...session, id: session.user_id });
  c.set('user', user);
  return user;
}
export async function requireUser(c, next) {
  c.header('Cache-Control', 'no-store');
  const user = await authenticate(c);
  if (!user) return c.json({ message: 'กรุณาเข้าสู่ระบบ', setupRequired: await setupRequired(c) }, 401);
  if (!['GET','HEAD','OPTIONS'].includes(c.req.method) && (!validOrigin(c) || !equal(c.req.header('X-CSRF-Token'), c.get('session').csrf_token))) {
    return c.json({ message: 'คำขอไม่ผ่านการตรวจสอบ กรุณารีเฟรชหน้า' }, 403);
  }
  return next();
}
async function startSession(c, user) {
  const raw = token(), csrf = token(), time = now();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(time),
    c.env.DB.prepare('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES (?,?,?,?,?)').bind(digest(raw),user.id,csrf,time+lifetime,time),
    c.env.DB.prepare("UPDATE users SET last_login_at=datetime('now') WHERE id=?").bind(user.id),
    c.env.DB.prepare("INSERT INTO audit_logs(id,user_id,action,target_type,target_id,details) VALUES (?,?,'LOGIN','user',?,'{}')").bind(crypto.randomUUID(),user.id,user.id),
  ]);
  setCookie(c,cookieName(c),raw,cookieOptions(c));
  return c.json({ user: publicUser(user), csrfToken: csrf });
}

auth.use('*', async (c,next) => {
  c.header('Cache-Control','no-store');
  if (c.req.method !== 'GET' && !validOrigin(c)) return c.json({message:'ไม่อนุญาตคำขอจากภายนอกเว็บไซต์'},403);
  return next();
});
auth.get('/me', requireUser, c => c.json({user:c.get('user'),csrfToken:c.get('session').csrf_token}));
auth.post('/setup', async c => {
  if (!c.env.ADMIN_SETUP_TOKEN?.trim()) return c.json({message:'ยังไม่ได้กำหนดรหัสตั้งค่าผู้ดูแลบนเซิร์ฟเวอร์'},503);
  const ip=c.req.header('CF-Connecting-IP') || 'local';
  if (!await consumeAttempt(c,`setup:${ip}`,10)) return c.json({message:'ลองใหม่ในอีก 15 นาที'},429);
  if (!await setupRequired(c)) return c.json({message:'ระบบมีผู้ดูแลแล้ว'},409);
  let body;
  try { body=await jsonBody(c); } catch { return c.json({message:'ข้อมูลไม่ถูกต้อง'},400); }
  if (!equal(body.setupToken,c.env.ADMIN_SETUP_TOKEN)) return c.json({message:'รหัสตั้งค่าไม่ถูกต้อง'},403);
  const {username,password}=body;
  if (typeof username!=='string' || !usernamePattern.test(username)) return c.json({message:'ชื่อผู้ใช้ไม่ถูกต้อง'},400);
  try { validatePassword(password); } catch(err) { return c.json({message:err.message},400); }
  const user={id:crypto.randomUUID(),username:username.toLowerCase(),display_name:username,email:`${username}@admin.local`,role:'manager',status:'active'};
  const hash=await hashPassword(password);
  try {
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO bootstrap_lock(id) VALUES (1)'),
      c.env.DB.prepare('INSERT INTO users(id,username,password_hash,display_name,email,role,status) VALUES (?,?,?,?,?,?,?)').bind(user.id,user.username,hash,user.display_name,user.email,user.role,user.status),
      c.env.DB.prepare("INSERT INTO audit_logs(id,user_id,action,target_type,target_id,details) VALUES (?,?,'SETUP','user',?,'{}')").bind(crypto.randomUUID(),user.id,user.id),
    ]);
  } catch { return c.json({message:'ระบบถูกตั้งค่าแล้ว หรือชื่อผู้ใช้/อีเมลซ้ำ'},409); }
  return startSession(c,user);
});
auth.post('/login', async c => {
  let body;
  try {body=await jsonBody(c);} catch {return c.json({message:'ข้อมูลไม่ถูกต้อง'},400);}
  const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
  if (!usernamePattern.test(username) || typeof body.password!=='string' || body.password.length>128) return c.json({message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'},401);
  const ip=c.req.header('CF-Connecting-IP') || 'local';
  if (!await consumeAttempt(c,`login-ip:${ip}`,30) || !await consumeAttempt(c,`login-user:${username}`,10)) return c.json({message:'เข้าสู่ระบบถี่เกินไป กรุณาลองใหม่ในอีก 15 นาที'},429);
  const user=await c.env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
  // A fixed valid-shaped dummy hash makes nonexistent users take the same KDF path.
  const valid=await verifyPassword(body.password,user?.password_hash||DUMMY_PASSWORD_HASH);
  if (!valid || user?.status!=='active') return c.json({message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'},401);
  return startSession(c,user);
});
auth.post('/logout',requireUser,async c=>{
  await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(c.get('session').token_hash).run();
  deleteCookie(c,cookieName(c),cookieOptions(c));
  return c.json({ok:true});
});
auth.post('/password',requireUser,async c=>{
  let body;
  try {body=await jsonBody(c);validatePassword(body.newPassword);} catch(err){return c.json({message:err.message},400);}
  const user=await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(c.get('user').id).first();
  if (!await verifyPassword(body.currentPassword,user.password_hash)) return c.json({message:'รหัสผ่านเดิมไม่ถูกต้อง'},400);
  const hash=await hashPassword(body.newPassword);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET password_hash=?,updated_at=datetime('now') WHERE id=?").bind(hash,user.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id),
    c.env.DB.prepare("INSERT INTO audit_logs(id,user_id,action,target_type,target_id,details) VALUES (?,?,'PASSWORD_CHANGE','user',?,'{}')").bind(crypto.randomUUID(),user.id,user.id),
  ]);
  deleteCookie(c,cookieName(c),cookieOptions(c));
  return c.json({ok:true,message:'เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่'});
});
export default auth;
