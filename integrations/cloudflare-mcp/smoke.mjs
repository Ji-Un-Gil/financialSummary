import assert from "node:assert/strict";

const base = process.argv[2] || "http://127.0.0.1:8787";
let protocol = "2025-11-25";
let nextId = 1;
async function rpc(method, params) {
  const id = nextId++;
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": protocol,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.text();
  const messages = response.headers.get("content-type")?.includes("text/event-stream")
    ? body.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => JSON.parse(line.slice(5)))
    : [JSON.parse(body)];
  const message = messages.find(value => value.id === id);
  assert.ok(message, "Matching RPC response required");
  return message;
}

const health = await fetch(`${base}/health`);
assert.equal(health.status, 200);
assert.equal((await health.json()).github_connected, false);
const initialized = await rpc("initialize", {
  protocolVersion: protocol,
  capabilities: {},
  clientInfo: { name: "financial-summary-smoke", version: "0.1.0" },
});
assert.ok(initialized.result?.protocolVersion);
protocol = initialized.result.protocolVersion;
const listed = await rpc("tools/list", {});
assert.equal(listed.result.tools.length, 1);
assert.equal(listed.result.tools[0].name, "check_cloud_connection");
assert.equal(listed.result.tools[0].annotations.readOnlyHint, true);
const call = () => rpc("tools/call", { name: "check_cloud_connection", arguments: { marker: "smoke-test" } });
const before = Date.now();
const first = JSON.parse((await call()).result.content[0].text);
const second = JSON.parse((await call()).result.content[0].text);
assert.equal(first.marker, "smoke-test");
assert.equal(first.github_connected, false);
assert.equal(first.data_saved, false);
assert.ok(Math.abs(Date.parse(first.server_time_utc) - before) < 60000);
assert.match(first.receipt_id, /^[0-9a-f-]{36}$/);
assert.notEqual(first.receipt_id, second.receipt_id);
const invalid = await rpc("tools/call", { name: "check_cloud_connection", arguments: { marker: "not allowed!" } });
assert.ok(invalid.error || invalid.result?.isError, "Invalid marker must fail");
console.log(JSON.stringify({ ok: true, protocol, checks: ["health", "initialize", "one-read-only-tool", "fresh-receipt", "server-time", "invalid-input"], sample: first }, null, 2));
