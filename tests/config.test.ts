/**
 * Tests for config module — environment parsing, defaults, edge cases.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, resetConfig, getConfig } from '../src/config';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfig();
  });

  it('returns default config when no env vars are set', () => {
    // Clear IB-related env vars
    delete process.env['IB_HOST'];
    delete process.env['IB_PORT'];
    delete process.env['IB_CLIENT_ID'];
    delete process.env['IB_ACCOUNT_ID'];
    delete process.env['IB_MODE'];
    delete process.env['IB_READ_ONLY'];
    delete process.env['LOG_LEVEL'];

    const config = loadConfig();

    expect(config.ib.host).toBe('127.0.0.1');
    expect(config.ib.port).toBe(4002); // paper mode default
    expect(config.ib.clientId).toBe(1);
    expect(config.ib.accountId).toBeNull();
    expect(config.ib.readOnly).toBe(true);
    expect(config.ib.mode).toBe('paper');
    expect(config.logLevel).toBe('info');
  });

  it('uses live port 4001 when IB_MODE=live', () => {
    delete process.env['IB_PORT'];
    process.env['IB_MODE'] = 'live';

    const config = loadConfig();

    expect(config.ib.mode).toBe('live');
    expect(config.ib.port).toBe(4001);
  });

  it('respects explicit IB_PORT even in live mode', () => {
    process.env['IB_MODE'] = 'live';
    process.env['IB_PORT'] = '7497';

    const config = loadConfig();

    expect(config.ib.port).toBe(7497);
  });

  it('parses boolean env vars correctly', () => {
    process.env['IB_READ_ONLY'] = 'false';
    const config = loadConfig();
    expect(config.ib.readOnly).toBe(false);

    process.env['IB_READ_ONLY'] = 'true';
    const config2 = loadConfig();
    expect(config2.ib.readOnly).toBe(true);

    process.env['IB_READ_ONLY'] = '1';
    const config3 = loadConfig();
    expect(config3.ib.readOnly).toBe(true);
  });

  it('parses comma-separated list env vars', () => {
    process.env['RISK_ALLOWED_ORDER_TYPES'] = 'MKT,LMT,STP';
    const config = loadConfig();
    expect(config.risk.allowedOrderTypes).toEqual(['MKT', 'LMT', 'STP']);
  });

  it('handles empty list env vars as null', () => {
    process.env['RISK_SYMBOL_ALLOWLIST'] = '';
    const config = loadConfig();
    expect(config.risk.symbolAllowlist).toBeNull();
  });

  it('uses fallback for non-numeric IB_PORT', () => {
    process.env['IB_PORT'] = 'abc';
    delete process.env['IB_MODE'];
    const config = loadConfig();
    expect(config.ib.port).toBe(4002);
  });

  it('provides sensible risk defaults', () => {
    delete process.env['RISK_MAX_ORDER_QTY'];
    delete process.env['RISK_MAX_ORDER_NOTIONAL'];
    delete process.env['RISK_DAILY_LOSS_LIMIT'];

    const config = loadConfig();

    expect(config.risk.maxOrderQty).toBe(1000);
    expect(config.risk.maxOrderNotional).toBe(100000);
    expect(config.risk.dailyLossLimit).toBe(10000);
    expect(config.risk.allowOutsideRth).toBe(false);
  });

  it('provides sensible reconnect defaults', () => {
    const config = loadConfig();

    expect(config.reconnect.maxAttempts).toBe(10);
    expect(config.reconnect.resumeSubscriptions).toBe(true);
    expect(config.reconnect.initialDelayMs).toBe(1000);
    expect(config.reconnect.backoffFactor).toBe(2);
  });
});

describe('getConfig singleton', () => {
  afterEach(() => {
    resetConfig();
  });

  it('returns the same instance on repeated calls', () => {
    const a = getConfig();
    const b = getConfig();
    expect(a).toBe(b);
  });

  it('returns a new instance after resetConfig', () => {
    const a = getConfig();
    resetConfig();
    const b = getConfig();
    expect(a).not.toBe(b);
  });
});
