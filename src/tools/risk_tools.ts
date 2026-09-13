/**
 * Risk/analytics tools — MCP tool registration for portfolio risk analytics.
 */
import { withEnvelope } from '../middleware/error_mapping';
import * as riskService from '../services/risk_service';
import {
  OptionPriceCalculateInput, ImpliedVolatilityCalculateInput,
  GreeksCalculateInput, PortfolioGreeksInput, StressTestInput,
  ExposureBySymbolInput, ExposureBySectorInput, ValueAtRiskInput,
  BetaExposureInput, CorrelationMatrixInput, SimulateTradeImpactInput,
  DividendsAndSplitsHistoryInput, CorporateActionsCalendarInput,
} from '../schemas/risk_schemas';
import { toSchema } from './schema_utils';

export const RISK_TOOLS = [
  {
    name: 'option_price_calculate',
    description: 'Calculate theoretical option price using Black-Scholes model via IB API.',
    inputSchema: toSchema(OptionPriceCalculateInput),
    handler: async (args: Record<string, unknown>) => {
      const input = OptionPriceCalculateInput.parse(args);
      return withEnvelope(async () => riskService.optionPriceCalculate(input.contract, input.volatility, input.underlyingPrice));
    },
  },
  {
    name: 'implied_volatility_calculate',
    description: 'Calculate implied volatility from option price using IB API.',
    inputSchema: toSchema(ImpliedVolatilityCalculateInput),
    handler: async (args: Record<string, unknown>) => {
      const input = ImpliedVolatilityCalculateInput.parse(args);
      return withEnvelope(async () => riskService.impliedVolatilityCalculate(input.contract, input.optionPrice, input.underlyingPrice));
    },
  },
  {
    name: 'greeks_calculate',
    description: 'Calculate option Greeks (delta, gamma, theta, vega) for one or more contracts.',
    inputSchema: toSchema(GreeksCalculateInput),
    handler: async (args: Record<string, unknown>) => {
      const input = GreeksCalculateInput.parse(args);
      return withEnvelope(async () => riskService.greeksCalculate(input.contract, input.underlyingPrice, input.volatility));
    },
  },
  {
    name: 'portfolio_greeks',
    description: 'Aggregate Greeks for all option positions in the portfolio. Returns portfolio-level delta, gamma, theta, vega.',
    inputSchema: toSchema(PortfolioGreeksInput),
    handler: async (args: Record<string, unknown>) => {
      const input = PortfolioGreeksInput.parse(args);
      return withEnvelope(async () => riskService.portfolioGreeks(input.account));
    },
  },
  {
    name: 'stress_test_portfolio',
    description: 'Stress test the current portfolio under hypothetical market scenarios: price moves, vol changes, time decay.',
    inputSchema: toSchema(StressTestInput),
    handler: async (args: Record<string, unknown>) => {
      const input = StressTestInput.parse(args);
      return withEnvelope(async () => riskService.stressTestPortfolio(input.scenarios, input.account));
    },
  },
  {
    name: 'exposure_by_symbol',
    description: 'Get portfolio exposure breakdown by symbol: market value, weight, delta exposure.',
    inputSchema: toSchema(ExposureBySymbolInput),
    handler: async (args: Record<string, unknown>) => {
      const input = ExposureBySymbolInput.parse(args);
      return withEnvelope(async () => riskService.exposureBySymbol(input.account));
    },
  },
  {
    name: 'exposure_by_sector',
    description: 'Get portfolio exposure breakdown by sector/industry.',
    inputSchema: toSchema(ExposureBySectorInput),
    handler: async (args: Record<string, unknown>) => {
      const input = ExposureBySectorInput.parse(args);
      return withEnvelope(async () => riskService.exposureBySector(input.account));
    },
  },
  {
    name: 'value_at_risk',
    description: 'Calculate portfolio Value-at-Risk (VaR) using parametric method. Returns 1-day and N-day VaR at given confidence.',
    inputSchema: toSchema(ValueAtRiskInput),
    handler: async (args: Record<string, unknown>) => {
      const input = ValueAtRiskInput.parse(args);
      return withEnvelope(async () => riskService.valueAtRisk(input.account, input.confidenceLevel, input.horizon));
    },
  },
  {
    name: 'beta_exposure',
    description: 'Calculate portfolio beta exposure relative to a benchmark (e.g., SPY).',
    inputSchema: toSchema(BetaExposureInput),
    handler: async (args: Record<string, unknown>) => {
      const input = BetaExposureInput.parse(args);
      return withEnvelope(async () => riskService.betaExposure(input.account, input.benchmark));
    },
  },
  {
    name: 'correlation_matrix',
    description: 'Compute pairwise correlation matrix for a set of symbols based on historical returns.',
    inputSchema: toSchema(CorrelationMatrixInput),
    handler: async (args: Record<string, unknown>) => {
      const input = CorrelationMatrixInput.parse(args);
      return withEnvelope(async () => riskService.correlationMatrix(input.symbols, input.period, input.barSize));
    },
  },
  {
    name: 'simulate_trade_impact',
    description: 'Simulate the impact of a hypothetical trade on portfolio risk metrics (margin, Greeks, VaR).',
    inputSchema: toSchema(SimulateTradeImpactInput),
    handler: async (args: Record<string, unknown>) => {
      const input = SimulateTradeImpactInput.parse(args);
      return withEnvelope(async () => riskService.simulateTradeImpact(input.contract, input.quantity, input.side, input.account));
    },
  },
  {
    name: 'dividends_and_splits_history',
    description: 'Get historical dividends and stock splits for a symbol.',
    inputSchema: toSchema(DividendsAndSplitsHistoryInput),
    handler: async (args: Record<string, unknown>) => {
      const input = DividendsAndSplitsHistoryInput.parse(args);
      return withEnvelope(async () => riskService.dividendsAndSplitsHistory(input.conIdOrSymbol));
    },
  },
  {
    name: 'corporate_actions_calendar',
    description: 'Get upcoming corporate actions (dividends, splits, earnings) for contracts. NOTE: Requires Thomson Reuters subscription.',
    inputSchema: toSchema(CorporateActionsCalendarInput),
    handler: async (args: Record<string, unknown>) => {
      const input = CorporateActionsCalendarInput.parse(args);
      return withEnvelope(async () => riskService.corporateActionsCalendar(input.conIds[0]!));
    },
  },
];
