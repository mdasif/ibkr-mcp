/**
 * Tests for Zod schemas — validates input parsing and rejection.
 */
import { describe, it, expect } from 'vitest';
import { ContractSearchInput, ContractDetailsInput } from '../src/schemas/contract_schemas';
import { OrderPlaceInput, OrderCancelInput } from '../src/schemas/order_schemas';
import { ErrorCodeEnum, SecTypeEnum } from '../src/schemas/common';

describe('ContractSearchInput', () => {
  it('accepts valid search input', () => {
    const result = ContractSearchInput.safeParse({
      query: 'AAPL',
      secType: 'STK',
      currency: 'USD',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty query', () => {
    const result = ContractSearchInput.safeParse({ query: '' });
    expect(result.success).toBe(false);
  });

  it('allows optional fields to be omitted', () => {
    const result = ContractSearchInput.safeParse({ query: 'AAPL' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid secType', () => {
    const result = ContractSearchInput.safeParse({ query: 'AAPL', secType: 'INVALID' });
    expect(result.success).toBe(false);
  });
});

describe('ContractDetailsInput', () => {
  it('accepts conId', () => {
    const result = ContractDetailsInput.safeParse({ conId: 265598 });
    expect(result.success).toBe(true);
  });

  it('accepts symbol + secType', () => {
    const result = ContractDetailsInput.safeParse({
      symbol: 'AAPL',
      secType: 'STK',
    });
    expect(result.success).toBe(true);
  });
});

describe('OrderPlaceInput', () => {
  it('accepts valid limit order', () => {
    const result = OrderPlaceInput.safeParse({
      contract: { symbol: 'MSFT', secType: 'STK', exchange: 'SMART', currency: 'USD' },
      side: 'BUY',
      quantity: 100,
      orderType: 'LMT',
      limitPrice: 350.50,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid market order', () => {
    const result = OrderPlaceInput.safeParse({
      contract: { symbol: 'MSFT', secType: 'STK', exchange: 'SMART', currency: 'USD' },
      side: 'SELL',
      quantity: 50,
      orderType: 'MKT',
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative quantity', () => {
    const result = OrderPlaceInput.safeParse({
      contract: { symbol: 'MSFT', secType: 'STK', exchange: 'SMART', currency: 'USD' },
      side: 'BUY',
      quantity: -10,
      orderType: 'MKT',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = OrderPlaceInput.safeParse({
      contract: { symbol: 'MSFT', secType: 'STK' },
    });
    expect(result.success).toBe(false);
  });
});

describe('OrderCancelInput', () => {
  it('accepts valid order ID', () => {
    const result = OrderCancelInput.safeParse({ orderId: 42 });
    expect(result.success).toBe(true);
  });

  it('rejects missing orderId', () => {
    const result = OrderCancelInput.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('SecTypeEnum', () => {
  const validTypes = ['STK', 'OPT', 'FUT', 'FOP', 'CASH', 'CFD', 'IND', 'BOND', 'CRYPTO', 'WAR', 'FUND', 'BAG'];

  it.each(validTypes)('accepts %s', (type) => {
    expect(SecTypeEnum.safeParse(type).success).toBe(true);
  });

  it('rejects invalid type', () => {
    expect(SecTypeEnum.safeParse('INVALID').success).toBe(false);
  });
});

describe('ErrorCodeEnum', () => {
  it('accepts known error codes', () => {
    expect(ErrorCodeEnum.safeParse('IB_NOT_CONNECTED').success).toBe(true);
    expect(ErrorCodeEnum.safeParse('VALIDATION_ERROR').success).toBe(true);
    expect(ErrorCodeEnum.safeParse('RISK_GUARDRAIL_BLOCKED').success).toBe(true);
  });

  it('rejects unknown error code', () => {
    expect(ErrorCodeEnum.safeParse('UNKNOWN_CODE').success).toBe(false);
  });
});
