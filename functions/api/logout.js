import { json } from '../lib/util.js';
import { ensureSchema, ensureAdmin } from '../lib/db.js';
import { parseCookies, clearCookie, isSecure } from '../lib/auth.js';

export const onRequest = async ({ request, env }) => {
  await ensureSchema(env);
  await ensureAdmin(env);
  const token = parseCookies(request).session;
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookie(isSecure(request)),
    },
  });
};
