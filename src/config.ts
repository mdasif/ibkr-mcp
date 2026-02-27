/**
 * Environment-driven configuration for the IBKR MCP Server.
 * All values sourced from environment variables with safe defaults.
 */

export interface IBConfig {
  host: string;
  port: number;
  clientId: number;
  accountId: string | null;
  readOnly: boolean;
  mode: 'paper' | 'live';
}

export interface RiskConfig {
  maxOrderQty: number;
  maxOrderNotional: number;
  dailyLossLimit: number;
  allowedOrderTypes: string[];
  symbolAllowlist: string[] | null;
  symbolDenylist: string[] | null;
  allowOutsideRth: boolean;
}

export interface CacheConfig {
  contractTtlMs: number;
  optionChainTtlMs: number;
}

export interface ReconnectConfig {
  maxAttempts: number;
  resumeSubscriptions: boolean;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitterFraction: number;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  ib: IBConfig;
  risk: RiskConfig;
  cache: CacheConfig;
  reconnect: ReconnectConfig;
  logLevel: LogLevel;
}

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v.toLowerCase() === 'true' || v === '1';
}

function envList(key: string, fallback: string[] | null): string[] | null {
  const v = process.env[key];
  if (v === undefined || v.trim() === '') return fallback;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export function loadConfig(): AppConfig {
  const mode = envStr('IB_MODE', 'paper') as 'paper' | 'live';

  return {
    ib: {
      host: envStr('IB_HOST', '127.0.0.1'),
      port: envInt('IB_PORT', mode === 'live' ? 4001 : 4002),
      clientId: envInt('IB_CLIENT_ID', 1),
      accountId: process.env['IB_ACCOUNT_ID'] ?? null,
      readOnly: envBool('IB_READ_ONLY', true),
      mode,
    },
    risk: {
      maxOrderQty: envInt('RISK_MAX_ORDER_QTY', 1000),
      maxOrderNotional: envInt('RISK_MAX_ORDER_NOTIONAL', 100000),
      dailyLossLimit: envInt('RISK_DAILY_LOSS_LIMIT', 10000),
      allowedOrderTypes: envList('RISK_ALLOWED_ORDER_TYPES', ['MKT', 'LMT', 'STP', 'STP_LMT', 'TRAIL'])!,
      symbolAllowlist: envList('RISK_SYMBOL_ALLOWLIST', null),
      symbolDenylist: envList('RISK_SYMBOL_DENYLIST', null),
      allowOutsideRth: envBool('RISK_ALLOW_OUTSIDE_RTH', false),
    },
    cache: {
      contractTtlMs: envInt('CACHE_CONTRACT_TTL_MS', 3_600_000),
      optionChainTtlMs: envInt('CACHE_OPTION_CHAIN_TTL_MS', 1_800_000),
    },
    reconnect: {
      maxAttempts: envInt('RECONNECT_MAX_ATTEMPTS', 10),
      resumeSubscriptions: envBool('RECONNECT_RESUME_SUBSCRIPTIONS', true),
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      backoffFactor: 2,
      jitterFraction: 0.25,
    },
    logLevel: envStr('LOG_LEVEL', 'info') as LogLevel,
  };
}

/** Singleton config instance */
let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/** Reset config (for testing) */
export function resetConfig(): void {
  _config = null;
}
