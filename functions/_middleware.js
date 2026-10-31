// 全局中间件：为所有响应补充安全头
export async function onRequest(context, next) {
  const resp = await next();
  const headers = new Headers(resp.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return new Response(resp.body, { ...resp, headers });
}
