/**
 * IBKR MCP Server — Main application bootstrap.
 *
 * Wires up the MCP SDK server, registers tools/resources/instructions,
 * connects to IB Gateway, and starts the stdio transport.
 */
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig, getConfig } from './config';
import { getConnection } from './connection/ib_connection';
import { logger } from './middleware/logging';
import { getToolListings, getTool } from './tools/index';
import { INSTRUCTIONS, getResourceListings, getResource } from './resources/index';
import { AppError, buildErrorResponse } from './middleware/error_mapping';

// ─── Server Creation ──────────────────────────────────────────────
const server = new Server(
  {
    name: 'ibkr-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
    instructions: INSTRUCTIONS,
  },
);

// ─── Tools ────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: getToolListings() };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = getTool(name);

  if (!tool) {
    const startTime = Date.now();
    const appErr = new AppError('VALIDATION_ERROR', `Unknown tool: ${name}`, { availableTools: getToolListings().map((t) => t.name) });
    const errResp = buildErrorResponse(
      appErr,
      `err-${Date.now()}`,
      startTime,
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(errResp, null, 2) }],
      isError: true,
    };
  }

  try {
    const result = await tool.handler(args ?? {});
    const isError = result?.success === false;
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError,
    };
  } catch (err: any) {
    logger.error('Tool execution failed', {
      tool: name,
      error: err.message,
      stack: err.stack,
    });
    const startTime = Date.now();
    const appErr = new AppError(err.code ?? 'INTERNAL_ERROR', err.message ?? 'Tool execution failed', { tool: name });
    const errResp = buildErrorResponse(
      appErr,
      `err-${Date.now()}`,
      startTime,
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(errResp, null, 2) }],
      isError: true,
    };
  }
});

// ─── Resources ────────────────────────────────────────────────────
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: getResourceListings() };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const resource = getResource(uri);

  if (!resource) {
    throw new Error(`Resource not found: ${uri}`);
  }

  const content = await resource.handler();
  return {
    contents: [
      {
        uri,
        mimeType: resource.mimeType,
        text: content,
      },
    ],
  };
});

// ─── Startup ──────────────────────────────────────────────────────
async function main() {
  // Load configuration from environment
  loadConfig();
  const config = getConfig();
  logger.info('IBKR MCP Server starting', {
    mode: config.ib.mode,
    host: config.ib.host,
    port: config.ib.port,
    clientId: config.ib.clientId,
    readOnly: config.ib.readOnly,
    logLevel: config.logLevel,
  });

  // Connect to IB Gateway / TWS
  try {
    const conn = getConnection();
    await conn.connect();
    logger.info('Connected to IB Gateway', {
      serverVersion: conn.getState().serverVersion,
      accounts: conn.managedAccounts,
    });
  } catch (err: any) {
    logger.error('Failed to connect to IB Gateway — server will start but tools requiring IB will fail', {
      error: err.message,
    });
    // Don't exit — the server can still serve resources, instructions, and
    // tools will return NOT_CONNECTED errors. Automatic reconnection will
    // attempt recovery in the background.
  }

  // Start MCP transport (stdio)
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server running on stdio transport');
}

// ─── Graceful Shutdown ────────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info(`Received ${signal} — shutting down`);
  try {
    const conn = getConnection();
    await conn.shutdown();
  } catch {
    // Ignore shutdown errors
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled rejection', { reason: reason?.message ?? String(reason) });
});

// Run
main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message, stack: err.stack });
  process.exit(1);
});
