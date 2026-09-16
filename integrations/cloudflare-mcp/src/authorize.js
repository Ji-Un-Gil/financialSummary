import { timingSafeEqual, createHash } from 'node:crypto';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digest = value => createHash('sha256').update(value).digest();
const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };

export const authorizationHandler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ service: 'financial-summary-writer', authentication_required: true });
    if (url.pathname !== '/authorize') return new Response('Not found', { status: 404 });
    if (!env.AUTH_PASSWORD || env.AUTH_PASSWORD.length < 32 || !env.GITHUB_TOKEN) return new Response('Not configured', { status: 503 });
    if (request.method === 'GET') {
      let auth;
      try { auth = await env.OAUTH_PROVIDER.parseAuthRequest(request); }
      catch { return new Response('Invalid authorization request', { status: 400 }); }
      const client = await env.OAUTH_PROVIDER.lookupClient(auth.clientId);
      if (!client) return new Response('Unknown client', { status: 400 });
      const nonce = crypto.randomUUID();
      await env.OAUTH_KV.put(`login:${nonce}`, JSON.stringify(auth), { expirationTtl: 600 });
      return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>금융 요약 저장 연결</title><h1>금융 요약 저장 연결</h1><p>요청 앱: ${escape(client.clientName || auth.clientId)}</p><p>돌아갈 주소: ${escape(auth.redirectUri)}</p><p>Ji-Un-Gil/financialSummary의 날짜별 보고서와 검증표, 연결 시험 파일을 새로 추가합니다. 기존 문서는 덮어쓰지 않습니다.</p><form method="post" action="/authorize"><input type="hidden" name="nonce" value="${nonce}"><label>서버 연결 암호 <input name="password" type="password" required autocomplete="off"></label><button type="submit">이 앱에 저장 권한 연결</button></form></html>`, {
        headers: { ...headers, 'Set-Cookie': `fs_auth=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/authorize; Max-Age=600` },
      });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (request.headers.get('origin') !== url.origin) return new Response('Forbidden', { status: 403 });
    if (Number(request.headers.get('content-length')) > 4096) return new Response('Too large', { status: 413 });
    const body = await request.text();
    if (body.length > 4096) return new Response('Too large', { status: 413 });
    const form = new URLSearchParams(body);
    const nonce = form.get('nonce') || '';
    const cookie = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith('fs_auth='))?.slice(8);
    if (!/^[0-9a-f-]{36}$/.test(nonce) || cookie !== nonce) return new Response('Invalid session', { status: 403 });
    const pending = await env.OAUTH_KV.get(`login:${nonce}`);
    if (!pending || !timingSafeEqual(digest(form.get('password') || ''), digest(env.AUTH_PASSWORD))) return new Response('Invalid session or password', { status: 403 });
    await env.OAUTH_KV.delete(`login:${nonce}`);
    const auth = JSON.parse(pending);
    const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({ request: auth,
      userId: 'Ji-Un-Gil', metadata: { repository: 'Ji-Un-Gil/financialSummary' },
      scope: ['summary:write'], props: { userId: 'Ji-Un-Gil', scopes: ['summary:write'] } });
    return new Response(null, { status: 302, headers: { ...headers, Location: redirectTo,
      'Set-Cookie': 'fs_auth=; HttpOnly; Secure; SameSite=Lax; Path=/authorize; Max-Age=0' } });
  },
};
