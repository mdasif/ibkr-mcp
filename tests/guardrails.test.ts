/**
 * Tests for pre-trade guardrails — validates all safety checks.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enforceGuardrails, enforceWriteAccess, type OrderGuardrailParams } from '../src/middleware/guardrails';
import { AppError } from '../src/middleware/error_mapping';
import { resetConfig } from '../src/config';

function validOrder(overrides: Partial<OrderGuardrailParams> = {}): OrderGuardrailParams {
  return {
    symbol: 'AAPL',
    secType: 'STK',
    quantity: 10,
    orderType: 'LMT',
    limitPrice: 150,
    side: 'BUY',
    ...overrides,
  };
}

describe('enforceGuardrails', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfig();
    process.env['IB_READ_ONLY'] = 'false';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfig();
  });

  it('passes for a valid order within all limits', () => {
    expect(() => enforceGuardrails(validOrder())).not.toThrow();
  });

  it('blocks orders in read-only mode', () => {
    process.env['IB_READ_ONLY'] = 'true';
    resetConfig();

    expect(() => enforceGuardrails(validOrder())).toThrow(AppError);
    try {
      enforceGuardrails(validOrder());
    } catch (e) {
      expect((e as AppError).code).toBe('RISK_GUARDRAIL_BLOCKED');
      expect((e as AppError).details['reason']).toBe('read_only_mode');
    }
  });

  it('blocks orders exceeding max quantity', () => {
    process.env['RISK_MAX_ORDER_QTY'] = '5';
    resetConfig();

    expect(() => enforceGuardrails(validOrder({ quantity: 10 }))).toThrow(AppError);
    try {
      enforceGuardrails(validOrder({ quantity: 10 }));
    } catch (e) {
      expect((e as AppError).details['reason']).toBe('max_order_qty');
    }
  });

  it('blocks orders exceeding max notional', () => {
    process.env['RISK_MAX_ORDER_NOTIONAL'] = '100';
    resetConfig();

    // 10 * 150 = 1500 > 100
    expect(() => enforceGuardrails(validOrder({ quantity: 10, limitPrice: 150 }))).toThrow(AppError);
    try {
      enforceGuardrails(validOrder({ quantity: 10, limitPrice: 150 }));
    } catch (e) {
      expect((e as AppError).details['reason']).toBe('max_order_notional');
    }
  });

  it('skips notional check when no price is provided', () => {
    process.env['RISK_MAX_ORDER_NOTIONAL'] = '100';
    resetConfig();

    // Market order with no price
    expect(() => enforceGuardrails(validOrder({ orderType: 'MKT', limitPrice: undefined, auxPrice: undefined }))).not.toThrow();
  });

  it('blocks disallowed order types', () => {
    process.env['RISK_ALLOWED_ORDER_TYPES'] = 'LMT,STP';
    resetConfig();

    expect(() => enforceGuardrails(validOrder({ orderType: 'MKT' }))).toThrow(AppError);
    try {
      enforceGuardrails(validOrder({ orderType: 'MKT' }));
    } catch (e) {
      expect((e as AppError).details['reason']).toBe('disallowed_order_type');
    }
  });

  it('blocks symbols not in allowlist', () => {
    process.env['RISK_SYMBOL_ALLOWLIST'] = 'MSFT,GOOG';
    resetConfig();

    expect(() => enforceGuardrails(validOrder({ symbol: 'AAPL' }))).toThrow(AppError);
    try {
      enforceGuardrails(validOrder({ symbol: 'AAPL' }));
    } catch (e) {
      expect((e as AppError).details['reason']).toBe('symbol_not_in_allowlist');
    }
  });

  it('allows symbols in allowlist', () => {
    process.env['RISK_SYMBOL_ALLOWLIST'] = 'AAPL,MSFT';
    resetConfig();

    expect(() => enforceGuardrails(validOrder({ symbol: 'AAPL' }))).not.toThrow();
  });

  it('blocks symbols in denylist', () => {
    process.env['RISK_SYMBOL_DENYLIST'] = 'AAPL,TSLA';
    resetConfig();

    expect(() => enforceGuardrails(validOrder({ symbol: 'AAPL' }))).toThrow(AppError);
    try {
      enforceGuardrails(validOrder({ symbol: 'AAPL' }));
    } catch (e) {
      expect((e as AppError).details['reason']).toBe('symbol_in_denylist');
    }
  });

  it('blocks outside-RTH when not allowed', () => {
    process.env['RISK_ALLOW_OUTSIDE_RTH'] = 'false';
    resetConfig();

    expect(() => enforceGuardrails(validOrder({ outsideRth: true }))).toThrow(AppError);
    try {
      enforceGuardrails(validOrder({ outsideRth: true }));
    } catch (e) {
      expect((e as AppError).details['reason']).toBe('outside_rth_not_allowed');
    }
  });

  it('allows outside-RTH when configured', () => {
    process.env['RISK_ALLOW_OUTSIDE_RTH'] = 'true';
    resetConfig();

    expect(() => enforceGuardrails(validOrder({ outsideRth: true }))).not.toThrow();
  });
});

describe('enforceWriteAccess', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfig();
  });

  it('does not throw when read-only is disabled', () => {
    process.env['IB_READ_ONLY'] = 'false';
    resetConfig();
    expect(() => enforceWriteAccess()).not.toThrow();
  });

  it('throws when read-only is enabled', () => {
    process.env['IB_READ_ONLY'] = 'true';
    resetConfig();
    expect(() => enforceWriteAccess()).toThrow(AppError);
  });
});
