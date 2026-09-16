export const REPOSITORY = 'Ji-Un-Gil/financialSummary';
export const BRANCH = 'master';

export function buildFiles(input) {
  if (input.kind === 'test') {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(input.marker)) throw new Error('Invalid marker');
    return [{ path: `integration-tests/${input.marker}.json`, content: JSON.stringify({
      purpose: 'Cloud GitHub write connectivity test; not a news report', marker: input.marker,
    }, null, 2) + '\n' }];
  }
  const { date, report, evidence } = input;
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error('Invalid date');
  }
  for (const value of [report, evidence]) {
    if (typeof value !== 'string' || value.length < 100 || new TextEncoder().encode(value).length > 150000) {
      throw new Error('Each document must contain 100 characters to 150 KB');
    }
  }
  // These are completeness checks, not a claim that the article is true.
  for (const heading of ['수집 상태', '수집 한계', '정정 기록']) {
    if (!report.includes(heading)) throw new Error(`Report missing ${heading}`);
  }
  for (const heading of ['출처', '주장 대조', '발행 전 검토 결과']) {
    if (!evidence.includes(heading)) throw new Error(`Evidence missing ${heading}`);
  }
  if (!report.includes(date) || !evidence.includes(date)) throw new Error('Document date missing');
  const base = `${date.slice(0, 4)}/${date.slice(5, 7)}/${date}`;
  return [
    { path: `briefings/${base}.md`, content: report },
    { path: `evidence/${base}.md`, content: evidence },
  ];
}

export async function saveFiles(token, files, fetcher = fetch) {
  if (!token) throw new Error('GitHub credential is not configured');
  async function api(path, method = 'GET', body, allow404 = false) {
    const response = await fetcher(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
      method, redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'financial-summary-writer',
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (allow404 && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub ${method} failed (${response.status}); no overwrite or force retry performed`);
    return response.json();
  }
  const ref = await api(`git/ref/heads/${BRANCH}`);
  const parent = ref.object.sha;
  const commit = await api(`git/commits/${parent}`);
  let present = 0;
  for (const file of files) {
    const existing = await api(`contents/${file.path}?ref=${parent}`, 'GET', undefined, true);
    if (existing) {
      if (existing.encoding !== 'base64' || typeof existing.content !== 'string') throw new Error('Cannot verify existing file');
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(existing.content.replace(/\s/g, '')), c => c.charCodeAt(0)));
      if (decoded !== file.content) throw new Error('Existing published file differs; refusing overwrite');
      present++;
    }
  }
  if (present && present !== files.length) throw new Error('Partial existing publication; manual review required');
  if (present === files.length) return { saved: true, already_present: true, commit: parent,
    urls: files.map(f => `https://github.com/${REPOSITORY}/blob/${parent}/${f.path}`) };
  let entries = files;
  if (files[0].path.startsWith('briefings/')) {
    const index = await api(`contents/briefings/README.md?ref=${parent}`);
    if (index.encoding !== 'base64') throw new Error('Cannot verify report index');
    const previous = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(index.content.replace(/\s/g, '')), c => c.charCodeAt(0)));
    const relative = files[0].path.slice('briefings/'.length);
    const date = relative.slice(-13, -3);
    if (previous.includes(relative)) throw new Error('Index already references this date; manual review required');
    entries = [...files, { path: 'briefings/README.md', content: previous.trimEnd() + `\n| ${date} | [금융 뉴스](${relative}) | 본문 수집 상태 참조 |\n` }];
  }
  const tree = await api('git/trees', 'POST', { base_tree: commit.tree.sha,
    tree: entries.map(f => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })) });
  const created = await api('git/commits', 'POST', { message: `Add cloud summary: ${files[0].path}`, tree: tree.sha, parents: [parent] });
  await api(`git/refs/heads/${BRANCH}`, 'PATCH', { sha: created.sha, force: false });
  // Verify the committed content, not only a successful mutation response.
  for (const file of entries) {
    const saved = await api(`contents/${file.path}?ref=${created.sha}`);
    if (saved.encoding !== 'base64') throw new Error('Saved content verification failed');
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(saved.content.replace(/\s/g, '')), c => c.charCodeAt(0)));
    if (decoded !== file.content) throw new Error('Saved content verification failed');
  }
  return { saved: true, already_present: false, commit: created.sha,
    urls: files.map(f => `https://github.com/${REPOSITORY}/blob/${created.sha}/${f.path}`) };
}
