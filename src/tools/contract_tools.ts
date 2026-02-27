/**
 * Contract tools — MCP tool registration for contract/instrument operations.
 */
import { withEnvelope } from '../middleware/error_mapping';
import * as contractService from '../services/contract_service';
import {
  ContractSearchInput, ContractDetailsInput, ContractQualifyInput,
  ContractRulesInput, SecDefOptParamsInput, OptionChainInput,
  InstrumentMetadataInput, SymbolToConIdInput,
} from '../schemas/contract_schemas';

export const CONTRACT_TOOLS = [
  {
    name: 'contract_search',
    description: 'Search for contracts/instruments by query string. Returns matching candidates with conId, symbol, secType, exchange.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query (symbol, name, or partial)' },
        secType: { type: 'string', description: 'Security type filter (STK, OPT, FUT, etc.)', enum: ['STK', 'OPT', 'FUT', 'FOP', 'CASH', 'CFD', 'IND', 'BOND', 'CRYPTO', 'WAR', 'FUND', 'BAG'] },
        exchange: { type: 'string', description: 'Exchange filter' },
        currency: { type: 'string', description: 'Currency filter' },
      },
      required: ['query'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ContractSearchInput.parse(args);
      return withEnvelope(async () => contractService.contractSearch(input.query, input.secType, input.exchange, input.currency));
    },
  },
  {
    name: 'contract_details',
    description: 'Get full contract details including trading hours, min tick, valid exchanges, etc. Provide conId or contract specification.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Contract ID' },
        symbol: { type: 'string', description: 'Symbol' },
        secType: { type: 'string', description: 'Security type' },
        exchange: { type: 'string', description: 'Exchange' },
        currency: { type: 'string', description: 'Currency' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ContractDetailsInput.parse(args);
      return withEnvelope(async () => contractService.contractDetails(input as any));
    },
  },
  {
    name: 'contract_qualify',
    description: 'Qualify a partial contract specification to get the full conId and resolved exchange. MUST be called before using contracts in market data or order tools.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Symbol to qualify' },
        secType: { type: 'string', description: 'Security type', enum: ['STK', 'OPT', 'FUT', 'FOP', 'CASH', 'CFD', 'IND', 'BOND', 'CRYPTO', 'WAR', 'FUND', 'BAG'] },
        exchange: { type: 'string', description: 'Exchange (default: SMART)' },
        currency: { type: 'string', description: 'Currency (default: USD)' },
        lastTradeDateOrContractMonth: { type: 'string', description: 'Expiry for options/futures' },
        strike: { type: 'number', description: 'Strike price for options' },
        right: { type: 'string', description: 'C or P for options', enum: ['C', 'P'] },
        multiplier: { type: 'string', description: 'Contract multiplier' },
      },
      required: ['symbol', 'secType'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ContractQualifyInput.parse(args);
      return withEnvelope(async () => contractService.contractQualify(input));
    },
  },
  {
    name: 'contract_rules',
    description: 'Get trading rules for a contract: min tick, size increment, valid exchanges, order types.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Contract ID' },
        exchange: { type: 'string', description: 'Exchange' },
      },
      required: ['conId'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ContractRulesInput.parse(args);
      return withEnvelope(async () => contractService.contractRules(input.conId, input.exchange));
    },
  },
  {
    name: 'security_definitions_option_parameters',
    description: 'Get available option expirations, strikes, and trading classes for an underlying.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        underlyingConId: { type: 'number', description: 'Underlying contract ID' },
        exchange: { type: 'string', description: 'Exchange filter' },
        underlyingSecType: { type: 'string', description: 'Underlying security type' },
        underlyingSymbol: { type: 'string', description: 'Underlying symbol' },
      },
      required: ['underlyingConId'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = SecDefOptParamsInput.parse(args);
      return withEnvelope(async () => contractService.secDefOptParams(input.underlyingConId, input.exchange, input.underlyingSecType, input.underlyingSymbol));
    },
  },
  {
    name: 'option_chain',
    description: 'Get the full option chain for an underlying: expirations, strikes, rights (C/P), multipliers.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        underlyingSymbol: { type: 'string', description: 'Underlying symbol' },
        underlyingConId: { type: 'number', description: 'Underlying contract ID' },
        exchange: { type: 'string', description: 'Exchange (default: SMART)' },
        currency: { type: 'string', description: 'Currency (default: USD)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = OptionChainInput.parse(args);
      return withEnvelope(async () => contractService.optionChain(input.underlyingSymbol, input.underlyingConId, input.exchange, input.currency));
    },
  },
  {
    name: 'instrument_metadata',
    description: 'Get metadata for an instrument: symbol, primary exchange, industry, category, subcategory.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Contract ID' },
      },
      required: ['conId'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = InstrumentMetadataInput.parse(args);
      return withEnvelope(async () => contractService.instrumentMetadata(input.conId));
    },
  },
  {
    name: 'symbol_to_conid_mapping',
    description: 'Resolve a symbol to its conId. Results are cached.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Symbol' },
        secType: { type: 'string', description: 'Security type (default: STK)' },
        exchange: { type: 'string', description: 'Exchange (default: SMART)' },
      },
      required: ['symbol'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = SymbolToConIdInput.parse(args);
      return withEnvelope(async () => contractService.symbolToConId(input.symbol, input.secType, input.exchange));
    },
  },
];
