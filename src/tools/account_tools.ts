/**
 * Account tools — MCP tool registration for account/portfolio operations.
 */
import { withEnvelope } from '../middleware/error_mapping';
import * as accountService from '../services/account_service';
import {
  AccountSummaryInput, PositionsListInput,
  PnLAccountInput, PnLPositionInput,
  MarginRequirementsInput, BuyingPowerInput,
  CashBalancesInput, LeverageMetricsInput,
  ReplaceFAInput, AccountUpdatesUnsubscribeInput,
} from '../schemas/account_schemas';

export const ACCOUNT_TOOLS = [
  {
    name: 'accounts_list',
    description: 'List all managed accounts associated with the connection.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => accountService.accountsList());
    },
  },
  {
    name: 'account_summary',
    description: 'Get account summary: net liquidation, equity, cash, margin, buying power, etc. Supports filtering by tags.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID (uses default if omitted)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags to request (e.g., NetLiquidation, TotalCashValue)' },
        group: { type: 'string', description: 'Account group (default: All)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = AccountSummaryInput.parse(args);
      return withEnvelope(async () => accountService.accountSummary(input.account, input.tags));
    },
  },
  {
    name: 'account_values',
    description: 'Get all key-value pairs from account: all balances, margin values, etc.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = AccountSummaryInput.parse(args);
      return withEnvelope(async () => accountService.accountValues(input.account));
    },
  },
  {
    name: 'positions_list',
    description: 'List all open positions across all accounts, with conId, size, avgCost, unrealized PnL.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Filter by account' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = PositionsListInput.parse(args);
      return withEnvelope(async () => accountService.positionsList(input.account));
    },
  },
  {
    name: 'portfolio_list',
    description: 'Get portfolio positions with market value, unrealized/realized PnL from the account model.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = AccountSummaryInput.parse(args);
      return withEnvelope(async () => accountService.portfolioList(input.account));
    },
  },
  {
    name: 'pnl_account',
    description: 'Get real-time account PnL: daily, unrealized, realized PnL.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
        modelCode: { type: 'string', description: 'Model code for FA' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = PnLAccountInput.parse(args);
      return withEnvelope(async () => accountService.pnlAccount(input.account));
    },
  },
  {
    name: 'pnl_position',
    description: 'Get real-time PnL for a specific position by conId.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
        conId: { type: 'number', description: 'Contract ID' },
        modelCode: { type: 'string', description: 'Model code for FA' },
      },
      required: ['conId'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = PnLPositionInput.parse(args);
      return withEnvelope(async () => accountService.pnlPosition(input.account, input.conId));
    },
  },
  {
    name: 'account_updates_subscribe',
    description: 'Subscribe to live account updates (values and portfolio changes).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = AccountSummaryInput.parse(args);
      return withEnvelope(async () => accountService.accountUpdatesSubscribe(input.account));
    },
  },
  {
    name: 'account_updates_unsubscribe',
    description: 'Unsubscribe from live account updates.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        subscription_id: { type: 'string', description: 'Subscription ID from subscribe call' },
      },
      required: ['subscription_id'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = AccountUpdatesUnsubscribeInput.parse(args);
      return withEnvelope(async () => accountService.accountUpdatesUnsubscribe(input.subscription_id));
    },
  },
  {
    name: 'buying_power',
    description: 'Get buying power details for an account.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = BuyingPowerInput.parse(args);
      return withEnvelope(async () => accountService.buyingPower(input.account));
    },
  },
  {
    name: 'cash_balances',
    description: 'Get cash balance breakdown by currency.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = CashBalancesInput.parse(args);
      return withEnvelope(async () => accountService.cashBalances(input.account));
    },
  },
  {
    name: 'leverage_metrics',
    description: 'Get leverage and margin utilization metrics: gross/net leverage, margin used vs available, cushion.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = LeverageMetricsInput.parse(args);
      return withEnvelope(async () => accountService.leverageMetrics(input.account));
    },
  },
  {
    name: 'margin_requirements',
    description: 'Get margin requirements for a hypothetical trade (uses order what-if).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        contract: { type: 'object', description: 'Contract specification' },
        quantity: { type: 'number', description: 'Number of shares/contracts' },
        side: { type: 'string', description: 'BUY or SELL', enum: ['BUY', 'SELL'] },
      },
      required: ['contract', 'quantity', 'side'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = MarginRequirementsInput.parse(args);
      return withEnvelope(async () => accountService.marginRequirements(input.contract, input.quantity, input.side));
    },
  },
  // --- FA tools ---
  {
    name: 'fa_groups_list',
    description: 'List Financial Advisor account groups (FA accounts only).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => accountService.faGroups());
    },
  },
  {
    name: 'fa_profiles_list',
    description: 'List Financial Advisor allocation profiles (FA accounts only).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => accountService.faProfiles());
    },
  },
  {
    name: 'fa_aliases_list',
    description: 'List Financial Advisor account aliases (FA accounts only).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => accountService.faAliases());
    },
  },
  {
    name: 'fa_replace',
    description: 'Replace Financial Advisor configuration XML (groups, profiles, or aliases).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        faDataType: { type: 'number', description: '1=Groups, 2=Profiles, 3=Aliases' },
        xml: { type: 'string', description: 'New configuration XML' },
      },
      required: ['faDataType', 'xml'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ReplaceFAInput.parse(args);
      return withEnvelope(async () => accountService.replaceFA(input.faDataType, input.xml));
    },
  },
];
