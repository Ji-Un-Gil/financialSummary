import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFiles, saveFiles } from './src/github-writer.js';
import { authorizationHandler } from './src/authorize.js';

test('date and marker cannot escape permitted directories', () => {
  for (const marker of ['../README', 'a/b', '', 'a'.repeat(65)]) assert.throws(() => buildFiles({ kind: 'test', marker }));
  for (const date of ['2026-02-30', '../2026-01', '2026-13-01']) assert.throws(() => buildFiles({ date, report: 'x', evidence: 'x' }));
  assert.equal(buildFiles({ kind: 'test', marker: 'scheduled-1' })[0].path, 'integration-tests/scheduled-1.json');
});

function githubMock({ existing, race = false } = {}) {
  const calls = [];
  let content;
  const fetcher = async (url, options) => {
    calls.push({ url, ...options });
    assert.ok(url.startsWith('https://api.github.com/repos/Ji-Un-Gil/financialSummary/'));
    assert.equal(options.redirect, 'error');
    const path = url.split('financialSummary/')[1];
    if (path === 'git/ref/heads/master') return Response.json({ object: { sha: 'parent' } });
    if (path === 'git/commits/parent') return Response.json({ tree: { sha: 'base' } });
    if (path.startsWith('contents/')) {
      const value = path.endsWith('ref=new') ? content : existing;
      return value === undefined ? new Response('', { status: 404 }) : Response.json({ encoding: 'base64', content: Buffer.from(value).toString('base64') });
    }
    if (path === 'git/trees') { content = JSON.parse(options.body).tree[0].content; return Response.json({ sha: 'tree' }); }
    if (path === 'git/commits') return Response.json({ sha: 'new' });
    if (path === 'git/refs/heads/master') return race ? new Response('', { status: 422 }) : Response.json({ object: { sha: 'new' } });
    throw new Error(`Unexpected path: ${path}`);
  };
  return { calls, fetcher };
}

test('new commit uses non-force ref update and verifies saved content', async () => {
  const mock = githubMock();
  const result = await saveFiles('test-credential', buildFiles({ kind: 'test', marker: 'smoke' }), mock.fetcher);
  assert.equal(result.saved, true);
  assert.equal(result.commit, 'new');
  assert.deepEqual(JSON.parse(mock.calls.find(c => c.method === 'PATCH').body), { sha: 'new', force: false });
  assert.ok(mock.calls.at(-1).url.endsWith('ref=new'));
});
test('different existing content is never overwritten', async () => {
  const mock = githubMock({ existing: 'old published report' });
  await assert.rejects(saveFiles('test-credential', buildFiles({ kind: 'test', marker: 'smoke' }), mock.fetcher), /refusing overwrite/);
  assert.ok(mock.calls.every(c => c.method === 'GET'));
});
test('identical retry causes no mutation', async () => {
  const files = buildFiles({ kind: 'test', marker: 'smoke' });
  const mock = githubMock({ existing: files[0].content });
  const result = await saveFiles('test-credential', files, mock.fetcher);
  assert.equal(result.already_present, true);
  assert.ok(mock.calls.every(c => c.method === 'GET'));
});
test('concurrent branch change is reported without force retry', async () => {
  const mock = githubMock({ race: true });
  await assert.rejects(saveFiles('test-credential', buildFiles({ kind: 'test', marker: 'smoke' }), mock.fetcher), /422/);
  assert.equal(mock.calls.filter(c => c.method === 'PATCH').length, 1);
});
test('report, evidence, and appended index share one tree and commit', async () => {
  const report = '# 2026-09-16 금융 뉴스\n수집 상태: 부분 수집\n수집 한계\n정정 기록\n' + '검증한 내용만 발행한다. '.repeat(10);
  const evidence = '# 2026-09-16 검증 기록\n출처\n주장 대조\n발행 전 검토 결과\n' + '확인할 수 없는 항목은 제외한다. '.repeat(10);
  const files = buildFiles({ kind: 'daily', date: '2026-09-16', report, evidence });
  const index = '# 일일 보고서\n\n| 날짜 | 보고서 | 수집 상태 |\n| --- | --- | --- |\n';
  let entries;
  let mutations = 0;
  const fetcher = async (url, options) => {
    const path = url.split('financialSummary/')[1];
    if (path === 'git/ref/heads/master') return Response.json({ object: { sha: 'parent' } });
    if (path === 'git/commits/parent') return Response.json({ tree: { sha: 'base' } });
    if (path.startsWith('contents/')) {
      const file = path.slice(9).split('?')[0];
      const content = path.endsWith('ref=new') ? entries.find(e => e.path === file)?.content : file === 'briefings/README.md' ? index : undefined;
      return content === undefined ? new Response('', { status: 404 }) : Response.json({ encoding:'base64',content:Buffer.from(content).toString('base64') });
    }
    mutations++;
    if (path === 'git/trees') { entries = JSON.parse(options.body).tree; return Response.json({sha:'tree'}); }
    if (path === 'git/commits') return Response.json({sha:'new'});
    if (path === 'git/refs/heads/master') return Response.json({});
    throw new Error('Unexpected request');
  };
  assert.equal((await saveFiles('test', files, fetcher)).saved, true);
  assert.deepEqual(entries.map(e => e.path), ['briefings/2026/09/2026-09-16.md','evidence/2026/09/2026-09-16.md','briefings/README.md']);
  assert.ok(entries[2].content.startsWith(index));
  assert.ok(entries[2].content.includes('| 2026-09-16 |'));
  assert.equal(mutations, 3);
});
test('authorization fails closed without secrets and rejects cross-origin posts', async () => {
  assert.equal((await authorizationHandler.fetch(new Request('https://example.com/authorize'), {})).status, 503);
  const env = { AUTH_PASSWORD: 'x'.repeat(40), GITHUB_TOKEN: 'test' };
  assert.equal((await authorizationHandler.fetch(new Request('https://example.com/authorize', { method: 'POST', headers: { Origin: 'https://attacker.example' } }), env)).status, 403);
});
test('authorization requires a cookie-bound session and correct password', async () => {
  let grants = 0;
  const nonce = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const env = { AUTH_PASSWORD: 'x'.repeat(40), GITHUB_TOKEN: 'test',
    OAUTH_KV: { get: async () => '{}', delete: async () => {} },
    OAUTH_PROVIDER: { completeAuthorization: async () => { grants++; return { redirectTo: 'https://chatgpt.com/' }; } } };
  const req = (password, cookie = nonce) => new Request('https://example.com/authorize', { method: 'POST',
    headers: { Origin: 'https://example.com', Cookie: `fs_auth=${cookie}` }, body: new URLSearchParams({ nonce, password }) });
  assert.equal((await authorizationHandler.fetch(req('wrong'), env)).status, 403);
  assert.equal((await authorizationHandler.fetch(req(env.AUTH_PASSWORD, 'other'), env)).status, 403);
  assert.equal(grants, 0);
  const consent = await authorizationHandler.fetch(req(env.AUTH_PASSWORD), env);
  assert.equal(consent.status, 200);
  assert.match(await consent.text(), /href="https:\/\/chatgpt.com\/"/);
  assert.equal(consent.headers.get('location'), null);
  assert.equal(grants, 1);
});
