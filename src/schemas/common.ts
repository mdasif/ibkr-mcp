/**
 * Common schemas: response envelope, error model, shared types.
 */
import { z } from 'zod';

// ── Error Model ─────────────────────────────────────────────

export const ErrorCodeEnum = z.enum([
  'IB_CONNECTION_FAILED',
  'IB_NOT_CONNECTED',
  'IB_PERMISSION_DENIED',
  'IB_PACING_VIOLATION',
  'IB_CONTRACT_NOT_FOUND',
  'IB_ORDER_REJECTED',
  'IB_MARKET_DATA_UNAVAILABLE',
  'VALIDATION_ERROR',
  'RISK_GUARDRAIL_BLOCKED',
  'NOT_SUPPORTED',
  'TIMEOUT',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCodeEnum>;

export const ErrorDetailSchema = z.object({
  code: ErrorCodeEnum,
  message: z.string(),
  details: z.record(z.unknown()).optional().default({}),
  ib_error_code: z.number().nullable().optional().default(null),
  retriable: z.boolean().default(false),
});
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

// ── Response Envelope ───────────────────────────────────────

export const MetaSchema = z.object({
  request_id: z.string().uuid(),
  timestamp: z.string().datetime(),
  latency_ms: z.number(),
});
export type Meta = z.infer<typeof MetaSchema>;

export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    error: z.null(),
    meta: MetaSchema,
  });

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  error: ErrorDetailSchema,
  meta: MetaSchema,
});

export interface SuccessResponse<T> {
  success: true;
  data: T;
  error: null;
  meta: Meta;
}

export interface ErrorResponse {
  success: false;
  data: null;
  error: ErrorDetail;
  meta: Meta;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// ── Shared Contract Types ───────────────────────────────────

export const SecTypeEnum = z.enum([
  'STK', 'OPT', 'FUT', 'FOP', 'CASH', 'CFD', 'IND', 'BOND', 'CRYPTO', 'WAR', 'FUND', 'BAG',
]);
export type SecType = z.infer<typeof SecTypeEnum>;

export const ContractSchema = z.object({
  conId: z.number().optional(),
  symbol: z.string(),
  secType: SecTypeEnum,
  exchange: z.string().default('SMART'),
  currency: z.string().default('USD'),
  lastTradeDateOrContractMonth: z.string().optional(),
  strike: z.number().optional(),
  right: z.enum(['C', 'P']).optional(),
  multiplier: z.string().optional(),
  primaryExch: z.string().optional(),
  localSymbol: z.string().optional(),
  tradingClass: z.string().optional(),
});
export type ContractInput = z.infer<typeof ContractSchema>;

export const ComboLegSchema = z.object({
  conId: z.number(),
  ratio: z.number().default(1),
  action: z.enum(['BUY', 'SELL']),
  exchange: z.string(),
});

export const ContractWithLegsSchema = ContractSchema.extend({
  comboLegs: z.array(ComboLegSchema).optional(),
});

// ── Order Types ─────────────────────────────────────────────

export const OrderSideEnum = z.enum(['BUY', 'SELL']);
export const OrderTypeEnum = z.enum([
  'MKT', 'LMT', 'STP', 'STP_LMT', 'TRAIL', 'TRAIL_LIMIT',
  'MOC', 'LOC', 'MIT', 'LIT',
]);
export const TimeInForceEnum = z.enum(['GTC', 'DAY', 'IOC', 'FOK', 'OPG', 'DTC']);

// ── Streaming Event ─────────────────────────────────────────

export const StreamEventSchema = z.object({
  subscription_id: z.string().uuid(),
  contract_id: z.number().optional(),
  event_type: z.string(),
  event_time: z.string().datetime(),
  sequence: z.number(),
  payload: z.record(z.unknown()),
});
export type StreamEvent = z.infer<typeof StreamEventSchema>;

// ── Helpers ─────────────────────────────────────────────────

export function makeContractKey(c: ContractInput): string {
  return [c.conId, c.symbol, c.secType, c.exchange, c.currency, c.lastTradeDateOrContractMonth, c.strike, c.right].join('|');
}
