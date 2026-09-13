/**
 * Account tools — MCP tool registration for account/portfolio operations.
 */
import { withEnvelope } from '../middleware/error_mapping';
import * as accountService from '../services/account_service';
import {
  AccountSummaryInput, AccountValuesInput, PositionsListInput,
  PortfolioListInput, PnLAccountInput, PnLPositionInput,
  AccountUpdatesSubscribeInput, AccountUpdatesUnsubscribeInput,
  BuyingPowerInput, CashBalancesInput, LeverageMetricsInput,
  MarginRequirementsInput, FAGroupsInput, FAProfilesInput,
  FAAliasesInput, ReplaceFAInput,
} from '../schemas/account_schemas';
import { toSchema, EMPTY_SCHEMA } from './schema_utils';

export const ACCOUNT_TOOLS = [
  {
    name: 'accounts_list',
    description: 'List all managed accounts associated with the connection.',
    inputSchema: EMPTY_SCHEMA,
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => accountService.accountsList());
    },
  },
  {
    name: 'account_summary',
    description: 'Get account summary: net liquidation, equity, cash, margin, buying power, etc. Supports filtering by tags.',
    inputSchema: toSchema(AccountSummaryInput),
    handler: async (args: Record<string, unknown>) => {
      const input = AccountSummaryInput.parse(args);
      return withEnvelope(async () => accountService.accountSummary(input.account, input.tags));
    },
  },
  {
    name: 'account_values',
    description: 'Get all key-value pairs from account: all balances, margin values, etc.',
    inputSchema: toSchema(AccountValuesInput),
    handler: async (args: Record<string, unknown>) => {
      const input = AccountValuesInput.parse(args);
      return withEnvelope(async () => accountService.accountValues(input.account));
    },
  },
  {
    name: 'positions_list',
    description: 'List all open positions across all accounts, with conId, size, avgCost, unrealized PnL.',
    inputSchema: toSchema(PositionsListInput),
    handler: async (args: Record<string, unknown>) => {
      const input = PositionsListInput.parse(args);
      return withEnvelope(async () => accountService.positionsList(input.account));
    },
  },
  {
    name: 'portfolio_list',
    description: 'Get portfolio positions with market value, unrealized/realized PnL from the account model.',
    inputSchema: toSchema(PortfolioListInput),
    handler: async (args: Record<string, unknown>) => {
      const input = PortfolioListInput.parse(args);
      return withEnvelope(async () => accountService.portfolioList(input.account));
    },
  },
  {
    name: 'pnl_account',
    description: 'Get real-time account PnL: daily, unrealized, realized PnL.',
    inputSchema: toSchema(PnLAccountInput),
    handler: async (args: Record<string, unknown>) => {
      const input = PnLAccountInput.parse(args);
      return withEnvelope(async () => accountService.pnlAccount(input.account));
    },
  },
  {
    name: 'pnl_position',
    description: 'Get real-time PnL for a specific position by conId.',
    inputSchema: toSchema(PnLPositionInput),
    handler: async (args: Record<string, unknown>) => {
      const input = PnLPositionInput.parse(args);
      return withEnvelope(async () => accountService.pnlPosition(input.account, input.conId));
    },
  },
  {
    name: 'account_updates_subscribe',
    description: 'Subscribe to live account updates (values and portfolio changes).',
    inputSchema: toSchema(AccountUpdatesSubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = AccountUpdatesSubscribeInput.parse(args);
      return withEnvelope(async () => accountService.accountUpdatesSubscribe(input.account));
    },
  },
  {
    name: 'account_updates_unsubscribe',
    description: 'Unsubscribe from live account updates.',
    inputSchema: toSchema(AccountUpdatesUnsubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = AccountUpdatesUnsubscribeInput.parse(args);
      return withEnvelope(async () => accountService.accountUpdatesUnsubscribe(input.subscription_id));
    },
  },
  {
    name: 'buying_power',
    description: 'Get buying power details for an account.',
    inputSchema: toSchema(BuyingPowerInput),
    handler: async (args: Record<string, unknown>) => {
      const input = BuyingPowerInput.parse(args);
      return withEnvelope(async () => accountService.buyingPower(input.account));
    },
  },
  {
    name: 'cash_balances',
    description: 'Get cash balance breakdown by currency.',
    inputSchema: toSchema(CashBalancesInput),
    handler: async (args: Record<string, unknown>) => {
      const input = CashBalancesInput.parse(args);
      return withEnvelope(async () => accountService.cashBalances(input.account));
    },
  },
  {
    name: 'leverage_metrics',
    description: 'Get leverage and margin utilization metrics: gross/net leverage, margin used vs available, cushion.',
    inputSchema: toSchema(LeverageMetricsInput),
    handler: async (args: Record<string, unknown>) => {
      const input = LeverageMetricsInput.parse(args);
      return withEnvelope(async () => accountService.leverageMetrics(input.account));
    },
  },
  {
    name: 'margin_requirements',
    description: 'Get margin requirements for a hypothetical trade (uses order what-if).',
    inputSchema: toSchema(MarginRequirementsInput),
    handler: async (args: Record<string, unknown>) => {
      const input = MarginRequirementsInput.parse(args);
      return withEnvelope(async () => accountService.marginRequirements(input.contract, input.quantity, input.side));
    },
  },
  // --- FA tools ---
  {
    name: 'fa_groups_list',
    description: 'List Financial Advisor account groups (FA accounts only).',
    inputSchema: toSchema(FAGroupsInput),
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => accountService.faGroups());
    },
  },
  {
    name: 'fa_profiles_list',
    description: 'List Financial Advisor allocation profiles (FA accounts only).',
    inputSchema: toSchema(FAProfilesInput),
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => accountService.faProfiles());
    },
  },
  {
    name: 'fa_aliases_list',
    description: 'List Financial Advisor account aliases (FA accounts only).',
    inputSchema: toSchema(FAAliasesInput),
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => accountService.faAliases());
    },
  },
  {
    name: 'fa_replace',
    description: 'Replace Financial Advisor configuration XML (groups, profiles, or aliases).',
    inputSchema: toSchema(ReplaceFAInput),
    handler: async (args: Record<string, unknown>) => {
      const input = ReplaceFAInput.parse(args);
      return withEnvelope(async () => accountService.replaceFA(input.faDataType, input.xml));
    },
  },
];
