/**
 * Risk/analytics schemas.
 */
import { z } from 'zod';
import { ContractSchema } from './common';

export const OptionPriceCalculateInput = z.object({
  contract: ContractSchema,
  volatility: z.number().positive(),
  underlyingPrice: z.number().positive(),
});

export const ImpliedVolatilityCalculateInput = z.object({
  contract: ContractSchema,
  optionPrice: z.number().positive(),
  underlyingPrice: z.number().positive(),
});

export const GreeksCalculateInput = z.object({
  contract: ContractSchema,
  underlyingPrice: z.number().positive(),
  volatility: z.number().positive(),
});

export const PortfolioGreeksInput = z.object({
  account: z.string().optional(),
});

export const StressTestInput = z.object({
  scenarios: z.array(z.object({
    name: z.string().optional(),
    spotMovePct: z.number().describe('Spot price move in %'),
    volMovePct: z.number().default(0).describe('Volatility move in %'),
  })).min(1).max(20),
  account: z.string().optional(),
});

export const SimulateTradeImpactInput = z.object({
  contract: ContractSchema,
  quantity: z.number().positive(),
  side: z.enum(['BUY', 'SELL']),
  account: z.string().optional(),
});

export const ExposureBySymbolInput = z.object({
  account: z.string().optional(),
});

export const ExposureBySectorInput = z.object({
  account: z.string().optional(),
});

export const ValueAtRiskInput = z.object({
  account: z.string().optional(),
  confidenceLevel: z.number().min(0.9).max(0.999).default(0.95),
  horizon: z.number().min(1).max(30).default(1).describe('Horizon in days'),
});

export const BetaExposureInput = z.object({
  account: z.string().optional(),
  benchmark: z.string().describe('Benchmark symbol (e.g. SPY)'),
});

export const CorrelationMatrixInput = z.object({
  symbols: z.array(z.string()).min(2).max(20),
  period: z.string().default('3 M'),
  barSize: z.string().default('1 day'),
});

export const DividendsAndSplitsHistoryInput = z.object({
  conIdOrSymbol: z.union([z.number().int().positive(), z.string().min(1)])
    .describe('Contract ID or ticker symbol'),
});

export const CorporateActionsCalendarInput = z.object({
  conIds: z.array(z.number().int().positive()).min(1).describe('Contract IDs to check'),
});
