// Local Workers-runtime test. Uses fake credentials and never calls GitHub.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const origin = 'https://financial-summary-writer.lak2577.workers.dev';
const password = randomBytes(32).toString('hex');
// Miniflare dispatchFetch replaces Host with its loopback address. Restore the
// simulated public Host in this test adapter; production validation is unchanged.
const mf = new Miniflare(convertV4MiniflareOptions({ modules: [
  { type: 'ESModule', path: 'smoke-entry.js', contents: `import worker from './smoke-worker.js'; export default { fetch(request, env, ctx) { const headers = new Headers(request.headers); headers.set('host', new URL(request.url).host); return worker.fetch(new Request(request, {headers}), env, ctx); } };` },
  { type: 'ESModule', path: 'smoke-worker.js', contents: readFileSync('dist/writer/writer.js', 'utf8') },
],
  compatibilityDate: '2026-09-14', compatibilityFlags: ['nodejs_compat'], kvNamespaces: ['OAUTH_KV'],
  bindings: { AUTH_PASSWORD: password, GITHUB_TOKEN: 'fake-test-credential' } }));
const call = (path, options) => mf.dispatchFetch(origin + path, { ...options, headers: { Host: new URL(origin).host, ...options?.headers }, redirect: 'manual' });
try {
  assert.equal((await call('/mcp')).status, 401);
  const register = await call('/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'Local verification', redirect_uris: ['https://chatgpt.com/test-callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code','refresh_token'], response_types: ['code'] }) });
  assert.equal(register.status, 201);
  const client = await register.json();
  const verifier = randomBytes(32).toString('base64url');
  const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: 'https://chatgpt.com/test-callback', response_type: 'code', scope: 'summary:write', state: 'smoke', resource: origin + '/mcp', code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') });
  const authorize = await call('/authorize?' + query);
  assert.equal(authorize.status, 200);
  const cookie = authorize.headers.get('set-cookie').split(';')[0];
  const html = await authorize.text();
  const nonce = html.match(/name="nonce" value="([a-f0-9-]+)"/)[1];
  const consent = await call('/authorize', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ nonce, password }).toString() });
  assert.equal(consent.status, 302);
  const code = new URL(consent.headers.get('location')).searchParams.get('code');
  const token = await call('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client.client_id, redirect_uri: 'https://chatgpt.com/test-callback', code, code_verifier: verifier, resource: origin + '/mcp' }).toString() });
  assert.equal(token.status, 200);
  const credentials = await token.json();
  const headers = { Authorization: `Bearer ${credentials.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  const init = await call('/mcp', { method: 'POST', headers, body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'initialize', params:{ protocolVersion:'2025-11-25', capabilities:{}, clientInfo:{name:'smoke',version:'1'} } }) });
  assert.equal(init.status, 200, await init.text());
  const list = await call('/mcp', { method:'POST', headers, body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list',params:{}}) });
  assert.equal(list.status, 200);
  const body = await list.text();
  assert.ok(body.includes('save_daily_summary'));
  assert.ok(body.includes('save_connection_test'));
  assert.ok(body.includes('"readOnlyHint":false'));
  assert.equal((await call('/mcp', { headers:{ Authorization:'Bearer invalid' } })).status, 401);
  console.log('PASS: unauthenticated denial, PKCE OAuth login, token exchange, authenticated MCP tools, invalid-token denial. No GitHub requests.');
} finally { await mf.dispose(); }
