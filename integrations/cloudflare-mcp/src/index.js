import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer() {
  const server = new McpServer({
    name: "financial-summary-mcp-probe",
    version: "0.1.0",
  });
  server.registerTool(
    "check_cloud_connection",
    {
      description:
        "Test an actual remote MCP call. Returns server UTC time and a fresh receipt ID. " +
        "Read-only connectivity probe: does not collect news, save data, or access GitHub. " +
        "Pass a short non-secret test marker; report returned values exactly. " +
        "A successful call does not prove scheduled or unattended write support.",
      inputSchema: {
        marker: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ marker }) => ({
      content: [{
        type: "text",
        text: JSON.stringify({
          service: "financial-summary-mcp-probe",
          version: "0.1.0",
          marker,
          server_time_utc: new Date().toISOString(),
          receipt_id: crypto.randomUUID(),
          github_connected: false,
          data_saved: false,
        }),
      }],
    }),
  );
  return server;
}

const mcp = createMcpHandler(createServer);

export default {
  fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/health" && request.method === "GET") {
      return Response.json({ service: "financial-summary-mcp-probe", version: "0.1.0", github_connected: false });
    }
    if (path === "/mcp") return mcp(request, env, ctx);
    return new Response("MCP endpoint: /mcp\nHealth check: /health\n", {
      status: path === "/" ? 200 : 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
