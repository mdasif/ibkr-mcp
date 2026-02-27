/**
 * Resources — MCP resource registration for dynamic and static content.
 */
import { getConnection } from '../connection/ib_connection';
import { getConfig } from '../config';
import instructionsMd from './server_instructions.md';

export const INSTRUCTIONS = (instructionsMd as string) ?? 'IBKR MCP Server — see tool descriptions for guidance.';

export const RESOURCES = [
  {
    uri: 'ibkr://instructions',
    name: 'Server Instructions',
    description: 'Agent guidance for using the IBKR MCP server tools effectively.',
    mimeType: 'text/markdown',
    handler: async () => INSTRUCTIONS,
  },
  {
    uri: 'ibkr://status',
    name: 'Connection Status',
    description: 'Live connection status and health information.',
    mimeType: 'application/json',
    handler: async () => {
      const conn = getConnection();
      return JSON.stringify({
        connected: conn.connected,
        serverVersion: conn.getState().serverVersion,
        managedAccounts: conn.managedAccounts,
        activeSubscriptions: conn.getActiveSubscriptionCount(),
        uptime: process.uptime(),
      }, null, 2);
    },
  },
  {
    uri: 'ibkr://config',
    name: 'Server Configuration',
    description: 'Current server configuration (sanitized).',
    mimeType: 'application/json',
    handler: async () => {
      const config = getConfig();
      return JSON.stringify({
        mode: config.ib.mode,
        readOnly: config.ib.readOnly,
        host: config.ib.host,
        port: config.ib.port,
        risk: {
          maxOrderQty: config.risk.maxOrderQty,
          maxOrderNotional: config.risk.maxOrderNotional,
          maxDailyLoss: config.risk.dailyLossLimit,
          allowedOrderTypes: config.risk.allowedOrderTypes,
        },
      }, null, 2);
    },
  },
  {
    uri: 'ibkr://errors',
    name: 'Recent Errors',
    description: 'Recent error log from the IB connection.',
    mimeType: 'application/json',
    handler: async () => {
      const conn = getConnection();
      return JSON.stringify(conn.getErrorLog().slice(-20), null, 2);
    },
  },
];

export function getResourceListings() {
  return RESOURCES.map(({ uri, name, description, mimeType }) => ({
    uri,
    name,
    description,
    mimeType,
  }));
}

export function getResource(uri: string) {
  return RESOURCES.find((r) => r.uri === uri);
}
