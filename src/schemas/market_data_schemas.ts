/**
 * Market data schemas — snapshot, streaming, historical.
 */
import { z } from 'zod';
import { ContractSchema } from './common';

// ── market_data_snapshot ────────────────────────────────────
export const MarketDataSnapshotInput = z.object({
  contract: ContractSchema.describe('Qualified contract'),
  fields: z.array(z.string()).optional().describe('Tick field types (e.g. "bid", "ask", "last", "volume")'),
  regulatorySnapshot: z.boolean().default(false).describe('Regulatory snapshot (costs $0.01)'),
});

// ── market_data_bulk_snapshot ───────────────────────────────
export const MarketDataBulkSnapshotInput = z.object({
  contracts: z.array(ContractSchema).min(1).max(50).describe('List of qualified contracts'),
  fields: z.array(z.string()).optional(),
});

// ── tick_snapshot ───────────────────────────────────────────
export const TickSnapshotInput = z.object({
  contract: ContractSchema,
  tickTypes: z.array(z.string()).optional(),
});

// ── market_depth_snapshot ───────────────────────────────────
export const MarketDepthSnapshotInput = z.object({
  contract: ContractSchema,
  numRows: z.number().min(1).max(50).default(10),
});

// ── realtime_bars_snapshot ──────────────────────────────────
export const RealtimeBarsSnapshotInput = z.object({
  contract: ContractSchema,
  barSize: z.number().default(5).describe('Bar size in seconds'),
  whatToShow: z.string().default('TRADES'),
  useRTH: z.boolean().default(true),
});

// ── historical_data ─────────────────────────────────────────
export const HistoricalDataInput = z.object({
  contract: ContractSchema,
  endDateTime: z.string().default('').describe('End date/time (YYYYMMDD HH:MM:SS or empty for now)'),
  durationStr: z.string().default('1 D').describe('Duration string (e.g. "1 D", "1 W", "1 M", "1 Y")'),
  barSizeSetting: z.string().default('1 hour').describe('Bar size (e.g. "1 min", "5 mins", "1 hour", "1 day")'),
  whatToShow: z.string().default('TRADES').describe('Data type: TRADES, MIDPOINT, BID, ASK, etc.'),
  useRTH: z.boolean().default(true).describe('Use regular trading hours only'),
  formatDate: z.number().default(1).describe('1 = YYYYMMDD HH:MM:SS, 2 = epoch seconds'),
});

// ── historical_ticks ────────────────────────────────────────
export const HistoricalTicksInput = z.object({
  contract: ContractSchema,
  startDateTime: z.string().optional(),
  endDateTime: z.string().optional(),
  numberOfTicks: z.number().default(1000).describe('Max ticks to return'),
  whatToShow: z.string().default('TRADES'),
  useRTH: z.boolean().default(true),
});

// ── fundamental_data ────────────────────────────────────────
export const FundamentalDataInput = z.object({
  contract: ContractSchema,
  reportType: z.enum([
    'ReportsFinSummary', 'ReportsOwnership', 'ReportSnapshot',
    'ReportsFinStatements', 'RESC', 'CalendarReport',
  ]).describe('Type of fundamental report'),
});

// ── implied_volatility_snapshot ─────────────────────────────
export const ImpliedVolatilitySnapshotInput = z.object({
  contract: ContractSchema,
  optionPrice: z.number().optional(),
  underlyingPrice: z.number().optional(),
});

// ── historical_volatility ───────────────────────────────────
export const HistoricalVolatilityInput = z.object({
  contract: ContractSchema,
  period: z.string().default('1 M').describe('Duration string'),
  barSize: z.string().default('1 day'),
});

// ── Streaming subscriptions ─────────────────────────────────
export const MarketDataSubscribeInput = z.object({
  contract: ContractSchema,
  fields: z.array(z.string()).optional(),
});

export const MarketDataUnsubscribeInput = z.object({
  subscription_id: z.string().uuid(),
});

export const TicksSubscribeInput = z.object({
  contract: ContractSchema,
  tickType: z.enum(['Last', 'AllLast', 'BidAsk', 'MidPoint']).default('Last'),
});

export const MarketDepthSubscribeInput = z.object({
  contract: ContractSchema,
  numRows: z.number().min(1).max(50).default(10),
});

export const RealtimeBarsSubscribeInput = z.object({
  contract: ContractSchema,
  barSize: z.number().default(5),
  whatToShow: z.string().default('TRADES'),
  useRTH: z.boolean().default(true),
});

export const ListSubscriptionsInput = z.object({}).optional();
