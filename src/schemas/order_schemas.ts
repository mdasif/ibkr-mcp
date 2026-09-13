/**
 * Order schemas — place, modify, cancel, preview, what-if.
 */
import { z } from 'zod';
import { ContractSchema, ContractWithLegsSchema, OrderSideEnum, OrderTypeEnum, TimeInForceEnum } from './common';

// ── order_place ─────────────────────────────────────────────
export const OrderPlaceInput = z.object({
  contract: ContractWithLegsSchema.describe('Qualified contract'),
  side: OrderSideEnum.describe('BUY or SELL'),
  quantity: z.number().positive().describe('Number of shares/contracts'),
  orderType: OrderTypeEnum.describe('Order type'),
  limitPrice: z.number().optional().describe('Limit price (required for LMT, STP_LMT)'),
  auxPrice: z.number().optional().describe('Stop/aux price (STP, STP_LMT, TRAIL)'),
  trailingPercent: z.number().optional().describe('Trailing percentage for TRAIL'),
  timeInForce: TimeInForceEnum.default('DAY'),
  goodAfterTime: z.string().optional(),
  goodTillDate: z.string().optional(),
  outsideRth: z.boolean().default(false),
  hidden: z.boolean().default(false),
  transmit: z.boolean().default(true).describe('false = create but don\'t transmit'),
  parentId: z.number().optional().describe('Parent order ID for bracket/OCO'),
  account: z.string().optional().describe('Account override'),
  algoStrategy: z.string().optional().describe('Algo strategy name (e.g. Adaptive, VWAP)'),
  algoParams: z.array(z.object({
    tag: z.string(),
    value: z.string(),
  })).optional(),
  scaleInitLevelSize: z.number().optional(),
  scaleSubsLevelSize: z.number().optional(),
  scalePriceIncrement: z.number().optional(),
}).superRefine((data, ctx) => {
  // IB rejects LMT/STP_LMT orders with no limit price and STP/STP_LMT/TRAIL
  // orders with no aux (stop/trail) price — but only after a round trip to
  // the gateway. Catching it here gives a clear, immediate validation error
  // instead of a confusing runtime rejection.
  if ((data.orderType === 'LMT' || data.orderType === 'STP_LMT') && data.limitPrice == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['limitPrice'], message: `limitPrice is required for orderType '${data.orderType}'` });
  }
  if ((data.orderType === 'STP' || data.orderType === 'STP_LMT' || data.orderType === 'TRAIL') && data.auxPrice == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['auxPrice'], message: `auxPrice is required for orderType '${data.orderType}'` });
  }
});

// ── order_modify ────────────────────────────────────────────
export const OrderModifyInput = z.object({
  orderId: z.number().describe('Local order ID to modify'),
  contract: ContractWithLegsSchema.describe('Qualified contract'),
  side: OrderSideEnum,
  quantity: z.number().positive(),
  orderType: OrderTypeEnum,
  limitPrice: z.number().optional(),
  auxPrice: z.number().optional(),
  trailingPercent: z.number().optional(),
  timeInForce: TimeInForceEnum.default('DAY'),
  outsideRth: z.boolean().default(false),
  transmit: z.boolean().default(true),
  account: z.string().optional(),
});

// ── order_cancel ────────────────────────────────────────────
export const OrderCancelInput = z.object({
  orderId: z.number().describe('Order ID to cancel'),
  manualCancelOrderTime: z.string().optional(),
});

// ── orders_open_list ────────────────────────────────────────
export const OrdersOpenListInput = z.object({
  account: z.string().optional(),
});

// ── orders_completed_list ───────────────────────────────────
export const OrdersCompletedListInput = z.object({
  apiOnly: z.boolean().default(false),
});

// ── executions_list ─────────────────────────────────────────
export const ExecutionsListInput = z.object({
  clientId: z.number().optional(),
  acctCode: z.string().optional(),
  time: z.string().optional().describe('Filter: executions after this time'),
  symbol: z.string().optional(),
  secType: z.string().optional(),
  exchange: z.string().optional(),
  side: OrderSideEnum.optional(),
});

// ── order_preview / order_what_if ───────────────────────────
export const OrderPreviewInput = OrderPlaceInput;
export const OrderWhatIfInput = OrderPlaceInput;

// ── exercise_options ────────────────────────────────────────
export const ExerciseOptionsInput = z.object({
  contract: ContractSchema,
  exerciseAction: z.enum(['EXERCISE', 'LAPSE']).describe('Exercise or lapse'),
  exerciseQuantity: z.number().positive(),
  account: z.string().optional(),
  override: z.boolean().default(false).describe('Override option out-of-the-money check'),
});

// ── orders_status_stream ────────────────────────────────────
export const OrderStatusStreamSubscribeInput = z.object({
  orderId: z.number().optional().describe('Filter to specific order'),
});

export const OrderStatusStreamUnsubscribeInput = z.object({
  subscription_id: z.string().uuid(),
});

// ── Bracket/Algo helpers ────────────────────────────────────
export const BracketOrderInput = z.object({
  contract: ContractWithLegsSchema,
  side: OrderSideEnum,
  quantity: z.number().positive(),
  entryOrderType: OrderTypeEnum.default('LMT'),
  entryPrice: z.number().describe('Entry limit price'),
  takeProfitPrice: z.number().describe('Take profit limit price'),
  stopLossPrice: z.number().describe('Stop loss price'),
  timeInForce: TimeInForceEnum.default('GTC'),
  outsideRth: z.boolean().default(false),
  account: z.string().optional(),
  transmit: z.boolean().default(true),
});

export const OCOOrderInput = z.object({
  orders: z.array(OrderPlaceInput).min(2).max(10).describe('Orders in the OCO group'),
  ocoGroup: z.string().optional().describe('OCO group name (auto-generated if omitted)'),
});

export const TrailingStopInput = z.object({
  contract: ContractWithLegsSchema,
  side: OrderSideEnum,
  quantity: z.number().positive(),
  trailingAmount: z.number().optional().describe('Dollar trailing amount'),
  trailingPercent: z.number().optional().describe('Percentage trailing amount'),
  auxPrice: z.number().optional(),
  timeInForce: TimeInForceEnum.default('GTC'),
  outsideRth: z.boolean().default(false),
  account: z.string().optional(),
});

export const ScaleOrderInput = z.object({
  contract: ContractWithLegsSchema,
  side: OrderSideEnum,
  totalQuantity: z.number().positive(),
  orderType: OrderTypeEnum.default('LMT'),
  limitPrice: z.number(),
  scaleInitLevelSize: z.number().positive(),
  scaleSubsLevelSize: z.number().positive(),
  scalePriceIncrement: z.number().positive(),
  timeInForce: TimeInForceEnum.default('GTC'),
  account: z.string().optional(),
});
