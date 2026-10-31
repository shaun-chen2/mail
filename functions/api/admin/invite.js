import { json } from '../../lib/util.js';
import { ensureSchema, ensureAdmin } from '../../lib/db.js';
import { getSession } from '../../lib/auth.js';

function generateCode(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混字符
  const arr = crypto.getRandomValues(new Uint8Array(len));
  let s = '';
  for (const b of arr) s += chars[b % chars.length];
  return s;
}

export const onRequest = async ({ request, env }) => {
  await ensureSchema(env);
  await ensureAdmin(env);
  const user = await getSession(request, env);
  if (!user || user.role !== 'admin') return json({ error: '需要管理员权限' }, 403);
  if (request.method !== 'POST') return json({ error: '方法不允许' }, 405);

  const code = generateCode(16);
  await env.DB.prepare(
    'INSERT INTO invite_codes (code, created_by, active, created_at) VALUES (?, ?, 1, ?)'
  ).bind(code, user.id, Date.now()).run();

  return json({ ok: true, code });
};
