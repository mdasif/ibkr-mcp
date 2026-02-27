/**
 * Contract schemas — input/output for contract tools.
 */
import { z } from 'zod';
import { SecTypeEnum } from './common';

// ── contract_search ─────────────────────────────────────────
export const ContractSearchInput = z.object({
  query: z.string().min(1).describe('Search query (symbol, name, or partial)'),
  secType: SecTypeEnum.optional().describe('Security type filter'),
  exchange: z.string().optional().describe('Exchange filter'),
  currency: z.string().optional().describe('Currency filter'),
});

export const ContractSearchResult = z.object({
  conId: z.number(),
  symbol: z.string(),
  secType: z.string(),
  primaryExch: z.string().optional(),
  exchange: z.string(),
  currency: z.string(),
  description: z.string().optional(),
  derivativeSecTypes: z.array(z.string()).optional(),
});

// ── contract_details ────────────────────────────────────────
export const ContractDetailsInput = z.object({
  conId: z.number().optional().describe('Contract ID'),
  symbol: z.string().optional().describe('Symbol'),
  secType: SecTypeEnum.optional(),
  exchange: z.string().optional(),
  currency: z.string().optional(),
});

// ── contract_qualify ────────────────────────────────────────
export const ContractQualifyInput = z.object({
  symbol: z.string().describe('Symbol to qualify'),
  secType: SecTypeEnum.describe('Security type'),
  exchange: z.string().default('SMART').describe('Exchange'),
  currency: z.string().default('USD').describe('Currency'),
  lastTradeDateOrContractMonth: z.string().optional(),
  strike: z.number().optional(),
  right: z.enum(['C', 'P']).optional(),
  multiplier: z.string().optional(),
});

// ── contract_rules ──────────────────────────────────────────
export const ContractRulesInput = z.object({
  conId: z.number().describe('Contract ID'),
  exchange: z.string().optional().describe('Exchange'),
});

// ── security_definitions_option_parameters ──────────────────
export const SecDefOptParamsInput = z.object({
  underlyingConId: z.number().describe('Underlying contract ID'),
  exchange: z.string().default('').describe('Exchange filter'),
  underlyingSecType: SecTypeEnum.default('STK'),
  underlyingSymbol: z.string().default(''),
});

// ── option_chain ────────────────────────────────────────────
export const OptionChainInput = z.object({
  underlyingSymbol: z.string().optional().describe('Underlying symbol'),
  underlyingConId: z.number().optional().describe('Underlying contract ID'),
  exchange: z.string().default('SMART'),
  currency: z.string().default('USD'),
});

// ── instrument_metadata ─────────────────────────────────────
export const InstrumentMetadataInput = z.object({
  conId: z.number().describe('Contract ID'),
});

// ── symbol_to_conid_mapping ─────────────────────────────────
export const SymbolToConIdInput = z.object({
  symbol: z.string().describe('Symbol'),
  secType: SecTypeEnum.default('STK'),
  exchange: z.string().default('SMART'),
});
