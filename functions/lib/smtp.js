// 纯前端无法直连 SMTP（浏览器禁端口 + CORS），本模块在 Cloudflare Worker 运行时
// 用 cloudflare:sockets 直连你的 SMTP 服务器发信，凭据来自环境变量，绝不暴露给浏览器。
import { connect } from 'cloudflare:sockets';

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// 非 ASCII 邮件头做 RFC2047 编码，避免乱码
function mimeEncodeHeader(value) {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return '=?UTF-8?B?' + b64(value) + '?=';
}

export async function sendMail({ host, port, user, pass, from, to, subject, text, replyTo }) {
  const portNum = Number(port) || 465;
  const useImplicitTls = portNum === 465;
  let socket = connect(`${host}:${portNum}`, useImplicitTls ? { secureTransport: 'on' } : {});
  let writer = socket.writable.getWriter();
  let reader = socket.readable.getReader();
  let buf = '';

  const sendLine = async (line) => { await writer.write(enc.encode(line + '\r\n')); };

  // 读取一条完整的 SMTP 回复（以 "NNN " 结尾，多行回复取终止行）
  const readReply = async () => {
    while (true) {
      const idx = buf.indexOf('\r\n');
      if (idx === -1) {
        const { value, done } = await reader.read();
        if (done) { const left = buf; buf = ''; return left; }
        buf += dec.decode(value, { stream: true });
        continue;
      }
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      if (/^\d{3} /.test(line)) return line;
      // 多行续行（^\d{3}-），继续读取
    }
  };

  const expect = async (prefixes) => {
    const r = await readReply();
    const list = Array.isArray(prefixes) ? prefixes : [prefixes];
    if (!list.some((p) => r && r.startsWith(p))) {
      throw new Error('SMTP 错误：' + (r || '(无响应)'));
    }
    return r;
  };

  try {
    await expect('220');                 // 服务就绪
    await sendLine('EHLO ' + host);
    await expect('250');
    if (!useImplicitTls) {               // 587/25 走 STARTTLS
      await sendLine('STARTTLS');
      await expect('220');
      socket = await socket.startTls({ hostname: host });
      writer = socket.writable.getWriter();
      reader = socket.readable.getReader();
      buf = '';
      await sendLine('EHLO ' + host);
      await expect('250');
    }

    // AUTH PLAIN（TLS 之上，凭据安全）
    await sendLine('AUTH PLAIN ' + b64('\u0000' + user + '\u0000' + pass));
    await expect('235');

    await sendLine('MAIL FROM:<' + from + '>');
    await expect('250');
    await sendLine('RCPT TO:<' + to + '>');
    await expect('250');
    await sendLine('DATA');
    await expect('354');

    // 正文换行统一为 CRLF，并做点填充（dot-stuffing）
    const body = String(text)
      .replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
      .replace(/^\./gm, '..');

    const headers = [
      'From: ' + from,
      'To: ' + to,
    ];
    if (replyTo) headers.push('Reply-To: ' + replyTo);
    headers.push('Subject: ' + mimeEncodeHeader(subject || ''));
    headers.push('Date: ' + new Date().toUTCString());
    headers.push('MIME-Version: 1.0');
    headers.push('Content-Type: text/plain; charset=UTF-8');
    headers.push('Content-Transfer-Encoding: 8bit');

    const msg = headers.join('\r\n') + '\r\n\r\n' + body;
    await sendLine(msg);
    await sendLine('.');                 // 数据结束
    await expect('250');
    await sendLine('QUIT');
    await expect('221');
    return true;
  } finally {
    try { await writer.close(); } catch (e) { /* 忽略关闭异常 */ }
  }
}
