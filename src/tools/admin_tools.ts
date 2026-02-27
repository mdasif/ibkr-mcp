/**
 * Admin/health tools — MCP tool registration for connection management and
 * server diagnostics.
 */
import { withEnvelope } from '../middleware/error_mapping';
import { getConnection } from '../connection/ib_connection';
import { getConfig } from '../config';

export const ADMIN_TOOLS = [
  {
    name: 'connection_status',
    description: 'Check the IB Gateway/TWS connection status: connected, server version, managed accounts, error buffer, active subscriptions count.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => {
        const conn = getConnection();
        return {
          connected: conn.connected,
          serverVersion: conn.getState().serverVersion,
          managedAccounts: conn.managedAccounts,
          activeSubscriptions: conn.getActiveSubscriptionCount(),
          recentErrors: conn.getErrorLog().slice(-10),
          uptime: process.uptime(),
        };
      });
    },
  },
  {
    name: 'connection_reconnect',
    description: 'Force a reconnect to IB Gateway/TWS. Disconnects and reconnects the session.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => {
        const conn = getConnection();
        await conn.disconnect();
        await conn.connect();
        return {
          connected: conn.connected,
          serverVersion: conn.getState().serverVersion,
          managedAccounts: conn.managedAccounts,
        };
      });
    },
  },
  {
    name: 'server_config',
    description: 'Get the current server configuration (sanitized — no secrets). Shows mode, risk limits, cache TTL, reconnect settings.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => {
        const config = getConfig();
        return {
          mode: config.ib.mode,
          host: config.ib.host,
          port: config.ib.port,
          clientId: config.ib.clientId,
          readOnly: config.ib.readOnly,
          logLevel: config.logLevel,
          risk: {
            maxOrderQty: config.risk.maxOrderQty,
            maxOrderNotional: config.risk.maxOrderNotional,
            dailyLossLimit: config.risk.dailyLossLimit,
            allowedOrderTypes: config.risk.allowedOrderTypes,
            allowOutsideRth: config.risk.allowOutsideRth,
          },
          cache: {
            contractTtlMs: config.cache.contractTtlMs,
            optionChainTtlMs: config.cache.optionChainTtlMs,
          },
          reconnect: {
            maxAttempts: config.reconnect.maxAttempts,
            initialDelayMs: config.reconnect.initialDelayMs,
            maxDelayMs: config.reconnect.maxDelayMs,
          },
        };
      });
    },
  },
  {
    name: 'error_log',
    description: 'Get the recent error log ring buffer. Returns the last N errors from the IB connection.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        count: { type: 'number', description: 'Number of recent errors to return (default: 50, max: 200)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      return withEnvelope(async () => {
        const conn = getConnection();
        const count = Math.min(Math.max(Number(args['count']) || 50, 1), 200);
        return {
          errors: conn.getErrorLog().slice(-count),
          totalSubscriptions: conn.getActiveSubscriptionCount(),
        };
      });
    },
  },
  {
    name: 'subscriptions_list',
    description: 'List all active streaming subscriptions (market data, ticks, depth, bars, order status).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => {
        const conn = getConnection();
        return {
          count: conn.getActiveSubscriptionCount(),
          subscriptions: Array.from(conn.getActiveSubscriptions().entries()).map(
            ([key, val]) => ({
              id: key,
              type: val?.type ?? 'unknown',
              createdAt: (val as any)?.createdAt,
            }),
          ),
        };
      });
    },
  },
  {
    name: 'server_time',
    description: 'Request current server time from IB Gateway. Useful for health checks and clock sync verification.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => {
        const conn = getConnection();
        const ib = conn.api;
        return new Promise<{ serverTime: string; localTime: string }>((resolve, reject) => {
          const timeout = setTimeout(() => { reject(new Error('Server time request timed out')); }, 5000);
          ib.once('currentTime', (time: number) => {
            clearTimeout(timeout);
            resolve({
              serverTime: new Date(time * 1000).toISOString(),
              localTime: new Date().toISOString(),
            });
          });
          ib.reqCurrentTime();
        });
      });
    },
  },
  {
    name: 'ping',
    description: 'Simple health check — returns "pong" with uptime and connection status.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => {
        const conn = getConnection();
        return {
          status: 'pong',
          connected: conn.connected,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        };
      });
    },
  },
];
