/**
 * Tests for error mapping — AppError, envelope builders, IB error code mapping.
 */
import { describe, it, expect } from 'vitest';
import {
  AppError,
  mapIBErrorCode,
  buildMeta,
  buildSuccessResponse,
  buildErrorResponse,
  withEnvelope,
} from '../src/middleware/error_mapping';

describe('AppError', () => {
  it('creates error with correct properties', () => {
    const err = new AppError('IB_NOT_CONNECTED', 'Not connected', { host: '127.0.0.1' }, 502, true);
    expect(err.code).toBe('IB_NOT_CONNECTED');
    expect(err.message).toBe('Not connected');
    expect(err.details).toEqual({ host: '127.0.0.1' });
    expect(err.ibErrorCode).toBe(502);
    expect(err.retriable).toBe(true);
    expect(err.name).toBe('AppError');
  });

  it('converts to ErrorDetail', () => {
    const err = new AppError('VALIDATION_ERROR', 'Bad input');
    const detail = err.toErrorDetail();
    expect(detail.code).toBe('VALIDATION_ERROR');
    expect(detail.message).toBe('Bad input');
    expect(detail.retriable).toBe(false);
    expect(detail.ib_error_code).toBeNull();
  });
});

describe('mapIBErrorCode', () => {
  const cases: Array<[number, string, string]> = [
    [200, 'No matching contract', 'IB_CONTRACT_NOT_FOUND'],
    [162, 'Pacing violation', 'IB_PACING_VIOLATION'],
    [201, 'Order rejected', 'IB_ORDER_REJECTED'],
    [202, 'Order cancelled', 'IB_ORDER_REJECTED'],
    [354, 'No market data', 'IB_MARKET_DATA_UNAVAILABLE'],
    [10090, 'Market data unavailable', 'IB_MARKET_DATA_UNAVAILABLE'],
    [502, 'Not connected', 'IB_NOT_CONNECTED'],
    [504, 'Not connected', 'IB_NOT_CONNECTED'],
    [10187, 'Permission denied', 'IB_PERMISSION_DENIED'],
    [10197, 'Permission denied', 'IB_PERMISSION_DENIED'],
    [1100, 'Connection lost', 'IB_CONNECTION_FAILED'],
    [1300, 'Connection dead', 'IB_CONNECTION_FAILED'],
    [9999, 'Unknown error', 'INTERNAL_ERROR'],
  ];

  it.each(cases)('maps IB code %i to %s', (ibCode, msg, expectedCode) => {
    const err = mapIBErrorCode(ibCode, msg);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe(expectedCode);
    expect(err.ibErrorCode).toBe(ibCode);
  });

  it('marks pacing and connection errors as retriable', () => {
    expect(mapIBErrorCode(162, 'pacing').retriable).toBe(true);
    expect(mapIBErrorCode(502, 'not connected').retriable).toBe(true);
    expect(mapIBErrorCode(1100, 'lost').retriable).toBe(true);
  });

  it('marks contract not found as non-retriable', () => {
    expect(mapIBErrorCode(200, 'not found').retriable).toBe(false);
  });
});

describe('buildMeta', () => {
  it('creates meta with correct fields', () => {
    const start = Date.now() - 42;
    const meta = buildMeta('test-uuid', start);
    expect(meta.request_id).toBe('test-uuid');
    expect(meta.timestamp).toBeDefined();
    expect(meta.latency_ms).toBeGreaterThanOrEqual(42);
  });
});

describe('buildSuccessResponse', () => {
  it('wraps data in success envelope', () => {
    const start = Date.now();
    const resp = buildSuccessResponse({ count: 5 }, 'req-1', start);
    expect(resp.success).toBe(true);
    expect(resp.data).toEqual({ count: 5 });
    expect(resp.error).toBeNull();
    expect(resp.meta.request_id).toBe('req-1');
  });
});

describe('buildErrorResponse', () => {
  it('wraps AppError in error envelope', () => {
    const err = new AppError('TIMEOUT', 'Request timed out');
    const start = Date.now();
    const resp = buildErrorResponse(err, 'req-2', start);
    expect(resp.success).toBe(false);
    expect(resp.data).toBeNull();
    expect(resp.error.code).toBe('TIMEOUT');
    expect(resp.error.message).toBe('Request timed out');
  });
});

describe('withEnvelope', () => {
  it('wraps successful async fn in success envelope', async () => {
    const resp = await withEnvelope(async () => ({ hello: 'world' }));
    expect(resp.success).toBe(true);
    if (resp.success) {
      expect(resp.data).toEqual({ hello: 'world' });
    }
    expect(resp.meta.request_id).toBeDefined();
    expect(resp.meta.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('catches AppError and returns error envelope', async () => {
    const resp = await withEnvelope(async () => {
      throw new AppError('VALIDATION_ERROR', 'bad field');
    });
    expect(resp.success).toBe(false);
    if (!resp.success) {
      expect(resp.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('catches generic errors and wraps as INTERNAL_ERROR', async () => {
    const resp = await withEnvelope(async () => {
      throw new Error('boom');
    });
    expect(resp.success).toBe(false);
    if (!resp.success) {
      expect(resp.error.code).toBe('INTERNAL_ERROR');
      expect(resp.error.message).toBe('boom');
    }
  });

  it('catches non-Error throws and stringifies', async () => {
    const resp = await withEnvelope(async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'string-error';
    });
    expect(resp.success).toBe(false);
    if (!resp.success) {
      expect(resp.error.message).toBe('string-error');
    }
  });
});
