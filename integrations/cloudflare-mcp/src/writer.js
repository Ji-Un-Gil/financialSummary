import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { z } from 'zod';
import { authorizationHandler } from './authorize.js';
import { buildFiles, saveFiles } from './github-writer.js';

const origin = 'https://financial-summary-writer.lak2577.workers.dev';
const respond = async (env, input) => {
  try {
    const result = await saveFiles(env.GITHUB_TOKEN, buildFiles(input));
    return { content: [{ type: 'text', text: JSON.stringify({ ...result,
      server_time_utc: new Date().toISOString(), factual_accuracy_verified_by_server: false }) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
};

export default new OAuthProvider({
  apiRoute: '/mcp',
  apiHandler: {
    async fetch(request, env, ctx) {
      if (ctx.props?.userId !== 'Ji-Un-Gil' || !ctx.props.scopes?.includes('summary:write')) return new Response('Forbidden', { status: 403 });
      const handler = createMcpHandler(() => {
        const server = new McpServer({ name: 'financial-summary-writer', version: '1.0.0' });
        const annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true };
        server.registerTool('save_connection_test', { description: 'Create only a harmless connectivity receipt in integration-tests of Ji-Un-Gil/financialSummary. No news content. Report actual returned commit and URL. Existing different content is never overwritten.',
          inputSchema: { marker: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/) }, annotations,
        }, ({ marker }) => respond(env, { kind: 'test', marker }));
        server.registerTool('save_daily_summary', { description: 'Publish a source-verified Korean financial report and evidence record as one Git commit in Ji-Un-Gil/financialSummary. Read editorial-policy, daily-run and both templates first. Every factual, explanatory and visual claim needs evidence from a directly opened original source. Exclude uncertain claims. Never invent timestamps. Disclose incomplete collection. This server does not fact-check content. Only new date-derived files are allowed; no overwrite. Never claim saved unless this call succeeds with a commit URL.',
          inputSchema: { date: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/), report: z.string().min(100).max(150000), evidence: z.string().min(100).max(150000) }, annotations,
        }, input => respond(env, { ...input, kind: 'daily' }));
        return server;
      });
      return handler(request, env, ctx);
    },
  },
  defaultHandler: authorizationHandler,
  authorizeEndpoint: '/authorize', tokenEndpoint: '/oauth/token', clientRegistrationEndpoint: '/oauth/register',
  scopesSupported: ['summary:write'], allowPlainPKCE: false,
  clientIdMetadataDocumentEnabled: false,
  resourceMetadata: { resource: `${origin}/mcp`, authorization_servers: [origin], scopes_supported: ['summary:write'], resource_name: 'Financial Summary Writer' },
});
