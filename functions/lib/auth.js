// 认证相关：Cookie 解析、密码哈希/校验、会话创建/校验、Cookie 辅助

export function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// PBKDF2-SHA256，10 万次迭代，生成 salt + hash（均 base64）
export async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return { salt: bufToB64(salt), hash: bufToB64(new Uint8Array(bits)) };
}

export async function verifyPassword(password, saltB64, hashB64) {
  const enc = new TextEncoder();
  const salt = b64ToBuf(saltB64);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return bufToB64(new Uint8Array(bits)) === hashB64;
}

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000; // 7 天

export async function createSession(env, userId) {
  const token = bufToB64(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  const expires = now + SESSION_TTL_MS;
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(token, userId, now, expires).run();
  return { token, expires };
}

export async function getSession(request, env) {
  const token = parseCookies(request).session;
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT s.expires_at, u.id AS user_id, u.username, u.role, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`
  ).bind(token).first();
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }
  return { id: row.user_id, username: row.username, role: row.role, email: row.email };
}

export function sessionCookie(token, expires, secure) {
  const maxAge = Math.floor((expires - Date.now()) / 1000);
  let c = `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  if (secure) c += '; Secure';
  return c;
}

export function clearCookie(secure) {
  let c = 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  if (secure) c += '; Secure';
  return c;
}

export function isSecure(request) {
  return new URL(request.url).protocol === 'https:';
}
