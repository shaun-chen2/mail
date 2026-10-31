// 全局中间件：为所有响应补充安全头
export async function onRequest(context, next) {
  const resp = await next();
  const headers = new Headers(resp.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // 显式保留原响应的状态码，避免错误码被重置为 200
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}
