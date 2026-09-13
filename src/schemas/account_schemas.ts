/**
 * Account schemas — summary, positions, PnL.
 */
import { z } from 'zod';
import { ContractSchema, OrderSideEnum } from './common';

export const AccountSummaryInput = z.object({
  account: z.string().optional().describe('Account ID (defaults to configured account)'),
  tags: z.array(z.string()).optional().describe('Tags to request (e.g. NetLiquidation, TotalCashValue)'),
});

export const AccountValuesInput = z.object({
  account: z.string().optional(),
});

export const AccountUpdatesSubscribeInput = z.object({
  account: z.string().optional(),
});

export const AccountUpdatesUnsubscribeInput = z.object({
  subscription_id: z.string().uuid(),
});

export const PositionsListInput = z.object({
  account: z.string().optional(),
});

export const PortfolioListInput = z.object({
  account: z.string().optional(),
});

export const PnLAccountInput = z.object({
  account: z.string().optional(),
});

export const PnLPositionInput = z.object({
  account: z.string().optional(),
  conId: z.number().describe('Contract ID'),
});

export const MarginRequirementsInput = z.object({
  contract: ContractSchema,
  quantity: z.number().positive(),
  side: OrderSideEnum,
});

export const BuyingPowerInput = z.object({
  account: z.string().optional(),
});

export const CashBalancesInput = z.object({
  account: z.string().optional(),
});

export const LeverageMetricsInput = z.object({
  account: z.string().optional(),
});

export const FAGroupsInput = z.object({});
export const FAProfilesInput = z.object({});
export const FAAliasesInput = z.object({});

export const ReplaceFAInput = z.object({
  faDataType: z.enum(['GROUPS', 'PROFILES', 'ALIASES']),
  xml: z.string().describe('FA allocation XML'),
});
