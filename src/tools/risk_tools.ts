/**
 * Risk/analytics tools — MCP tool registration for risk and analytics operations.
 */
import { withEnvelope } from '../middleware/error_mapping';
import * as riskService from '../services/risk_service';
import {
  OptionPriceCalculateInput, ImpliedVolatilityCalculateInput,
  GreeksCalculateInput, StressTestInput, ValueAtRiskInput,
  BetaExposureInput, CorrelationMatrixInput,
  ExposureBySymbolInput, ExposureBySectorInput,
  SimulateTradeImpactInput,
} from '../schemas/risk_schemas';

export const RISK_TOOLS = [
  {
    name: 'option_price_calculate',
    description: 'Calculate theoretical option price using Black-Scholes model via IB API.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Option contract ID' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        volatility: { type: 'number', description: 'Implied volatility (decimal, e.g. 0.30 for 30%)' },
        underPrice: { type: 'number', description: 'Underlying price' },
      },
      required: ['conId', 'volatility', 'underPrice'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = OptionPriceCalculateInput.parse(args);
      return withEnvelope(async () => riskService.optionPriceCalculate(input.contract, input.volatility, input.underlyingPrice));
    },
  },
  {
    name: 'implied_volatility_calculate',
    description: 'Calculate implied volatility from option price using IB API.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Option contract ID' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        optionPrice: { type: 'number', description: 'Current option price' },
        underPrice: { type: 'number', description: 'Underlying price' },
      },
      required: ['conId', 'optionPrice', 'underPrice'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ImpliedVolatilityCalculateInput.parse(args);
      return withEnvelope(async () => riskService.impliedVolatilityCalculate(input.contract, input.optionPrice, input.underlyingPrice));
    },
  },
  {
    name: 'greeks_calculate',
    description: 'Calculate option Greeks (delta, gamma, theta, vega) for one or more contracts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Option contract ID' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
      },
      required: ['conId'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = GreeksCalculateInput.parse(args);
      return withEnvelope(async () => riskService.greeksCalculate(input.contract, input.underlyingPrice, input.volatility));
    },
  },
  {
    name: 'portfolio_greeks',
    description: 'Aggregate Greeks for all option positions in the portfolio. Returns portfolio-level delta, gamma, theta, vega.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      return withEnvelope(async () => riskService.portfolioGreeks((args as any).account));
    },
  },
  {
    name: 'stress_test_portfolio',
    description: 'Stress test the current portfolio under hypothetical market scenarios: price moves, vol changes, time decay.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
        scenarios: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Scenario name' },
              priceChangePercent: { type: 'number', description: 'Price change %' },
              volChangePercent: { type: 'number', description: 'Vol change %' },
              daysForward: { type: 'number', description: 'Days to project forward' },
            },
            required: ['name'],
          },
          description: 'Array of stress scenarios',
        },
      },
      required: ['scenarios'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = StressTestInput.parse(args);
      return withEnvelope(async () => riskService.stressTestPortfolio(input.scenarios, input.account));
    },
  },
  {
    name: 'exposure_by_symbol',
    description: 'Get portfolio exposure breakdown by symbol: market value, weight, delta exposure.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ExposureBySymbolInput.parse(args);
      return withEnvelope(async () => riskService.exposureBySymbol(input.account));
    },
  },
  {
    name: 'exposure_by_sector',
    description: 'Get portfolio exposure breakdown by sector/industry.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ExposureBySectorInput.parse(args);
      return withEnvelope(async () => riskService.exposureBySector(input.account));
    },
  },
  {
    name: 'value_at_risk',
    description: 'Calculate portfolio Value-at-Risk (VaR) using parametric method. Returns 1-day and N-day VaR at given confidence.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
        confidenceLevel: { type: 'number', description: 'Confidence level (e.g., 0.95 for 95%)' },
        holdingPeriodDays: { type: 'number', description: 'Holding period in days (default: 1)' },
        lookbackDays: { type: 'number', description: 'Historical lookback for vol estimation (default: 252)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ValueAtRiskInput.parse(args);
      return withEnvelope(async () => riskService.valueAtRisk(input.account, input.confidenceLevel, input.horizon));
    },
  },
  {
    name: 'beta_exposure',
    description: 'Calculate portfolio beta exposure relative to a benchmark (e.g., SPY).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
        benchmarkSymbol: { type: 'string', description: 'Benchmark symbol (default: SPY)' },
        lookbackDays: { type: 'number', description: 'Historical lookback in days (default: 252)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = BetaExposureInput.parse(args);
      return withEnvelope(async () => riskService.betaExposure(input.account, input.benchmark));
    },
  },
  {
    name: 'correlation_matrix',
    description: 'Compute pairwise correlation matrix for a set of symbols based on historical returns.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbols: { type: 'array', items: { type: 'string' }, description: 'List of symbols (max 20)' },
        lookbackDays: { type: 'number', description: 'Historical lookback in days (default: 252)' },
        barSize: { type: 'string', description: 'Bar size for returns (default: "1 day")' },
      },
      required: ['symbols'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = CorrelationMatrixInput.parse(args);
      return withEnvelope(async () => riskService.correlationMatrix(input.symbols, input.period, input.barSize));
    },
  },
  {
    name: 'simulate_trade_impact',
    description: 'Simulate the impact of a hypothetical trade on portfolio risk metrics (margin, Greeks, VaR).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account ID' },
        conId: { type: 'number', description: 'Contract ID for hypothetical trade' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        side: { type: 'string', enum: ['BUY', 'SELL'] },
        quantity: { type: 'number' },
        limitPrice: { type: 'number' },
      },
      required: ['conId', 'side', 'quantity'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = SimulateTradeImpactInput.parse(args);
      return withEnvelope(async () => riskService.simulateTradeImpact(input.contract, input.quantity, input.side, input.account));
    },
  },
  {
    name: 'dividends_and_splits_history',
    description: 'Get historical dividends and stock splits for a symbol.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Contract ID' },
        symbol: { type: 'string', description: 'Symbol' },
      },
      required: ['conId'],
    },
    handler: async (args: Record<string, unknown>) => {
      return withEnvelope(async () => riskService.dividendsAndSplitsHistory((args as any).conId ?? (args as any).symbol));
    },
  },
  {
    name: 'corporate_actions_calendar',
    description: 'Get upcoming corporate actions (dividends, splits, earnings) for contracts. NOTE: Requires Thomson Reuters subscription.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conIds: { type: 'array', items: { type: 'number' }, description: 'Contract IDs to check' },
      },
      required: ['conIds'],
    },
    handler: async (args: Record<string, unknown>) => {
      return withEnvelope(async () => riskService.corporateActionsCalendar((args as any).conIds?.[0]));
    },
  },
];
