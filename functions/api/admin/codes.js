import { json } from '../../lib/util.js';
import { ensureSchema, ensureAdmin } from '../../lib/db.js';
import { getSession } from '../../lib/auth.js';

export const onRequest = async ({ request, env }) => {
  await ensureSchema(env);
  await ensureAdmin(env);
  const user = await getSession(request, env);
  if (!user || user.role !== 'admin') return json({ error: '需要管理员权限' }, 403);

  const result = await env.DB.prepare(
    'SELECT code, active, used_by, created_at, used_at FROM invite_codes ORDER BY created_at DESC'
  ).all();

  return json({ ok: true, codes: result.results || [] });
};
