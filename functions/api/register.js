import { json } from '../lib/util.js';
import { ensureSchema, ensureAdmin } from '../lib/db.js';
import { hashPassword } from '../lib/auth.js';

export const onRequest = async ({ request, env }) => {
  await ensureSchema(env);
  await ensureAdmin(env);
  if (request.method !== 'POST') return json({ error: '方法不允许' }, 405);

  const { username, password, inviteCode, email } = await request.json().catch(() => ({}));
  if (!username || !password || !inviteCode) {
    return json({ error: '缺少用户名、密码或邀请码' }, 400);
  }
  if (password.length < 6) return json({ error: '密码至少 6 位' }, 400);
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
    return json({ error: '用户名仅限 3-32 位字母、数字或下划线' }, 400);
  }

  // 校验邀请码：存在、启用、未被使用
  const code = await env.DB.prepare('SELECT * FROM invite_codes WHERE code = ?')
    .bind(inviteCode).first();
  if (!code || code.active === 0 || code.used_by) {
    return json({ error: '邀请码无效或已被使用' }, 400);
  }

  const exist = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username).first();
  if (exist) return json({ error: '用户名已存在' }, 400);

  const { salt, hash } = await hashPassword(password);
  const res = await env.DB.prepare(
    'INSERT INTO users (username, password_hash, salt, role, email, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(username, hash, salt, 'user', email || null, Date.now()).run();
  const userId = res.meta && res.meta.last_row_id;

  await env.DB.prepare(
    'UPDATE invite_codes SET used_by = ?, used_at = ?, active = 0 WHERE code = ?'
  ).bind(userId, Date.now(), inviteCode).run();

  return json({ ok: true });
};
