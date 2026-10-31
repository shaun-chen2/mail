import { json } from '../lib/util.js';
import { ensureSchema, ensureAdmin } from '../lib/db.js';
import { verifyPassword, createSession, sessionCookie, isSecure } from '../lib/auth.js';

export const onRequest = async ({ request, env }) => {
  await ensureSchema(env);
  await ensureAdmin(env);
  if (request.method !== 'POST') return json({ error: '方法不允许' }, 405);

  const { username, password } = await request.json().catch(() => ({}));
  if (!username || !password) return json({ error: '缺少用户名或密码' }, 400);

  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?')
    .bind(username).first();
  if (!user || !(await verifyPassword(password, user.salt, user.password_hash))) {
    return json({ error: '用户名或密码错误' }, 401);
  }

  const { token, expires } = await createSession(env, user.id);
  return new Response(JSON.stringify({ ok: true, role: user.role }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookie(token, expires, isSecure(request)),
    },
  });
};
