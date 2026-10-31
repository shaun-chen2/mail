import { json } from '../lib/util.js';
import { ensureSchema, ensureAdmin } from '../lib/db.js';
import { getSession } from '../lib/auth.js';

export const onRequest = async ({ request, env }) => {
  await ensureSchema(env);
  await ensureAdmin(env);
  const user = await getSession(request, env);
  if (!user) return json({ loggedIn: false });
  return json({
    loggedIn: true,
    username: user.username,
    role: user.role,
    email: user.email,
  });
};
