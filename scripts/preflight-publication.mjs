// Read-only preflight: use the same document validation and index row as MCP.
// This does not fact-check sources, stage files, commit, or push.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildFiles, buildIndexRow, REPOSITORY, BRANCH } from '../integrations/cloudflare-mcp/src/github-writer.js';
const date = process.argv[2];
if (!/^20\d{2}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Usage: node scripts/preflight-publication.mjs YYYY-MM-DD');
const base = `${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.md`;
const report = readFileSync(new URL(`../briefings/${base}`, import.meta.url), 'utf8');
const evidence = readFileSync(new URL(`../evidence/${base}`, import.meta.url), 'utf8');
const files = buildFiles({kind: 'daily', date, report, evidence});
console.log(JSON.stringify({repository: REPOSITORY, branch: BRANCH, date,
  files: files.map(f => ({path: f.path, bytes: Buffer.byteLength(f.content), sha256: createHash('sha256').update(f.content).digest('hex')})),
  index_row: buildIndexRow(date, report), factual_accuracy_verified: false}, null, 2));
