import { json } from '../lib/util.js';
import { ensureSchema, ensureAdmin } from '../lib/db.js';
import { getSession } from '../lib/auth.js';
import { sendMail } from '../lib/smtp.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequest = async ({ request, env }) => {
  await ensureSchema(env);
  await ensureAdmin(env);
  if (request.method !== 'POST') return json({ error: '方法不允许' }, 405);

  const user = await getSession(request, env);
  if (!user) return json({ error: '未登录' }, 401);

  const { to, subject, body } = await request.json().catch(() => ({}));
  if (!to || !subject || !body) {
    return json({ error: '收件人、主题、正文均必填' }, 400);
  }
  if (!EMAIL_RE.test(to)) return json({ error: '收件人邮箱格式不正确' }, 400);

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return json({ error: 'SMTP 未配置，请联系管理员' }, 500);
  }

  try {
    await sendMail({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 465,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.SMTP_USER,         // 系统统一发信邮箱
      to,
      subject,
      text: body,
      replyTo: user.email || undefined,
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: '发送失败：' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
