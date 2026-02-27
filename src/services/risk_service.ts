/**
 * Risk/analytics service — Greeks, VaR, stress testing, exposure.
 */
import { EventName } from '@stoqey/ib';
import { getConnection } from '../connection/ib_connection';
import { AppError } from '../middleware/error_mapping';
import { toIBContract } from './contract_service';
import { positionsList } from './account_service';
import { historicalData } from './market_data_service';
import type { ContractInput } from '../schemas/common';

// ── Option Price Calculation ────────────────────────────────

export async function optionPriceCalculate(
  contract: ContractInput,
  volatility: number,
  underlyingPrice: number,
): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    const reqId = conn.nextReqId();
    const ibContract = toIBContract(contract);
    const timeout = setTimeout(() => {
      cleanup();
      conn.api.cancelCalculateOptionPrice(reqId);
      reject(new AppError('TIMEOUT', 'Option price calculation timed out'));
    }, 10000);

    const onPrice = (rId: number, price: number, pvDividend: number, _impliedVol: number, delta: number, gamma: number, vega: number, theta: number, undPrice: number) => {
      if (rId !== reqId) return;
      cleanup();
      conn.api.cancelCalculateOptionPrice(reqId);
      resolve({
        contract: { conId: contract.conId, symbol: contract.symbol },
        theoreticalPrice: price,
        pvDividend,
        greeks: { delta, gamma, vega, theta },
        underlyingPrice: undPrice,
        inputVolatility: volatility,
        method: 'IB TWS/Gateway Black-Scholes model',
        assumptions: 'Uses IB internal pricing model. Results may differ from other pricing engines.',
        data_sources: ['IB TWS/Gateway'],
      });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.tickOptionComputation, onPrice);
    };

    conn.api.on(EventName.tickOptionComputation, onPrice as any);
    conn.api.calculateOptionPrice(reqId, ibContract, volatility, underlyingPrice);
  }));
}

// ── Implied Volatility ──────────────────────────────────────

export async function impliedVolatilityCalculate(
  contract: ContractInput,
  optionPrice: number,
  underlyingPrice: number,
): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    const reqId = conn.nextReqId();
    const ibContract = toIBContract(contract);
    const timeout = setTimeout(() => {
      cleanup();
      conn.api.cancelCalculateImpliedVolatility(reqId);
      reject(new AppError('TIMEOUT', 'IV calculation timed out'));
    }, 10000);

    const onComputation = (rId: number, _tickType: number, impliedVol: number, delta: number, _optPrice: number, _pvDividend: number, gamma: number, vega: number, theta: number, undPrice: number) => {
      if (rId !== reqId) return;
      cleanup();
      conn.api.cancelCalculateImpliedVolatility(reqId);
      resolve({
        contract: { conId: contract.conId, symbol: contract.symbol },
        impliedVolatility: impliedVol,
        greeks: { delta, gamma, vega, theta },
        underlyingPrice: undPrice,
        method: 'IB TWS/Gateway IV solver',
        assumptions: 'Uses IB internal model to solve for IV from market price.',
        data_sources: ['IB TWS/Gateway'],
      });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.tickOptionComputation, onComputation);
    };

    conn.api.on(EventName.tickOptionComputation, onComputation as any);
    conn.api.calculateImpliedVolatility(reqId, ibContract, optionPrice, underlyingPrice);
  }));
}

// ── Greeks Calculation ──────────────────────────────────────

export async function greeksCalculate(
  contract: ContractInput,
  underlyingPrice: number,
  volatility: number,
): Promise<Record<string, unknown>> {
  // Use option price calc which returns Greeks
  const result = await optionPriceCalculate(contract, volatility, underlyingPrice);
  return {
    ...result,
    method: 'IB TWS/Gateway pricing model',
    assumptions: 'Greeks computed via IB internal model alongside option pricing.',
    data_sources: ['IB TWS/Gateway'],
  };
}

// ── Portfolio Greeks ────────────────────────────────────────

export async function portfolioGreeks(account?: string): Promise<Record<string, unknown>> {
  const positions = await positionsList(account);
  const optionPositions = positions.filter((p: any) => {
    const secType = p.contract?.secType;
    return secType === 'OPT' || secType === 'FOP';
  });

  return {
    account,
    optionPositionCount: optionPositions.length,
    positions: optionPositions.map((p: any) => ({
      contract: p.contract,
      position: p.position,
      avgCost: p.avgCost,
    })),
    note: 'For live Greeks, use market_data_snapshot on each position with option computation ticks.',
    method: 'Position enumeration — live Greeks require market data subscriptions',
    assumptions: 'Greeks shown are from position data. For real-time Greeks, subscribe to market data.',
    data_sources: ['IB account positions'],
  };
}

// ── Stress Test ─────────────────────────────────────────────

export async function stressTestPortfolio(
  scenarios: { name?: string; spotMovePct: number; volMovePct: number }[],
  account?: string,
): Promise<Record<string, unknown>> {
  const positions = await positionsList(account);

  const results = scenarios.map((scenario) => {
    const posImpacts = positions.map((p: any) => {
      const pos = p.position ?? 0;
      const avgCost = p.avgCost ?? 0;
      const notional = Math.abs(pos * avgCost);
      const pnlImpact = notional * (scenario.spotMovePct / 100);

      return {
        contract: p.contract,
        position: pos,
        notional,
        estimatedPnL: pos > 0 ? pnlImpact : -pnlImpact,
      };
    });

    const totalPnL = posImpacts.reduce((sum, p) => sum + (p.estimatedPnL ?? 0), 0);

    return {
      scenario: scenario.name ?? `Spot ${scenario.spotMovePct}% / Vol ${scenario.volMovePct}%`,
      spotMovePct: scenario.spotMovePct,
      volMovePct: scenario.volMovePct,
      positions: posImpacts,
      totalEstimatedPnL: totalPnL,
    };
  });

  return {
    account,
    scenarios: results,
    method: 'Linear approximation based on position notional values',
    assumptions: 'Uses simple linear scaling for equity positions. Options stress testing requires Greeks (use with caution). Does not account for correlation, gamma, or convexity.',
    data_sources: ['IB account positions', 'Average cost basis'],
  };
}

// ── Exposure ────────────────────────────────────────────────

export async function exposureBySymbol(account?: string): Promise<Record<string, unknown>> {
  const positions = await positionsList(account);
  const bySymbol: Record<string, { position: number; notional: number }> = {};

  for (const p of positions) {
    const pos = p as any;
    const symbol = pos.contract?.symbol ?? 'UNKNOWN';
    if (!bySymbol[symbol]) bySymbol[symbol] = { position: 0, notional: 0 };
    bySymbol[symbol].position += pos.position ?? 0;
    bySymbol[symbol].notional += Math.abs((pos.position ?? 0) * (pos.avgCost ?? 0));
  }

  return {
    account,
    exposures: Object.entries(bySymbol).map(([symbol, data]) => ({
      symbol,
      ...data,
    })),
    method: 'Position * average cost',
    assumptions: 'Notional based on average cost, not current market value.',
    data_sources: ['IB account positions'],
  };
}

export async function exposureBySector(account?: string): Promise<Record<string, unknown>> {
  return {
    account,
    note: 'Sector classification requires contract details lookup for each position. Use instrument_metadata for individual positions.',
    exposures: [],
    method: 'Best-effort — requires IB contract details for sector classification',
    assumptions: 'Sector data depends on IB fundamental data availability.',
    data_sources: ['IB contract details', 'IB fundamental data'],
  };
}

// ── VaR ─────────────────────────────────────────────────────

export async function valueAtRisk(
  account: string | undefined,
  confidenceLevel = 0.95,
  horizon = 1,
): Promise<Record<string, unknown>> {
  const positions = await positionsList(account);
  const totalNotional = positions.reduce((sum, p: any) => {
    return sum + Math.abs((p.position ?? 0) * (p.avgCost ?? 0));
  }, 0);

  // Parametric VaR (simplified)
  const zScores: Record<string, number> = { '0.9': 1.28, '0.95': 1.645, '0.99': 2.326, '0.999': 3.09 };
  const z = zScores[confidenceLevel.toString()] ?? 1.645;
  const dailyVol = 0.02; // Assumed 2% daily vol (simplified)
  const var_ = totalNotional * z * dailyVol * Math.sqrt(horizon);

  return {
    account,
    confidenceLevel,
    horizon,
    totalNotional,
    valueAtRisk: var_,
    method: 'Parametric VaR (variance-covariance) with simplified assumptions',
    assumptions: 'Assumes 2% daily portfolio volatility, normal distribution. For accurate VaR, historical simulation with actual returns is recommended.',
    data_sources: ['IB account positions', 'Assumed volatility parameter'],
  };
}

// ── Beta Exposure ───────────────────────────────────────────

export async function betaExposure(
  account: string | undefined,
  benchmark: string,
): Promise<Record<string, unknown>> {
  return {
    account,
    benchmark,
    note: 'Beta calculation requires historical return data for portfolio and benchmark. Use correlation_matrix and historical_data tools for custom analysis.',
    method: 'Requires historical returns — not computed inline',
    assumptions: 'N/A',
    data_sources: ['Would require: historical portfolio returns, benchmark returns'],
  };
}

// ── Correlation Matrix ──────────────────────────────────────

export async function correlationMatrix(
  symbols: string[],
  period = '3 M',
  barSize = '1 day',
): Promise<Record<string, unknown>> {
  // Fetch historical data for each symbol
  const returnsBySymbol: Record<string, number[]> = {};

  for (const symbol of symbols) {
    try {
      const data = await historicalData(
        { symbol, secType: 'STK', exchange: 'SMART', currency: 'USD' },
        '', period, barSize, 'TRADES', true, 1,
      );
      const bars = (data['bars'] as { close: number }[]) ?? [];
      const returns: number[] = [];
      for (let i = 1; i < bars.length; i++) {
        const prev = bars[i - 1]!.close;
        const curr = bars[i]!.close;
        if (prev > 0) returns.push((curr - prev) / prev);
      }
      returnsBySymbol[symbol] = returns;
    } catch {
      returnsBySymbol[symbol] = [];
    }
  }

  // Compute correlation matrix
  const matrix: Record<string, Record<string, number>> = {};
  for (const s1 of symbols) {
    matrix[s1] = {};
    for (const s2 of symbols) {
      if (s1 === s2) {
        matrix[s1][s2] = 1.0;
      } else {
        matrix[s1][s2] = computeCorrelation(returnsBySymbol[s1] ?? [], returnsBySymbol[s2] ?? []);
      }
    }
  }

  return {
    symbols,
    period,
    barSize,
    matrix,
    method: 'Pearson correlation from historical daily returns',
    assumptions: 'Uses closing prices, daily returns. Correlation is backwards-looking and may not predict future relationships.',
    data_sources: ['IB historical data (TRADES)'],
  };
}

function computeCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);

  const meanX = xSlice.reduce((a, b) => a + b, 0) / n;
  const meanY = ySlice.reduce((a, b) => a + b, 0) / n;

  let covXY = 0, varX = 0, varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xSlice[i]! - meanX;
    const dy = ySlice[i]! - meanY;
    covXY += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const denom = Math.sqrt(varX * varY);
  return denom === 0 ? 0 : covXY / denom;
}

// ── Simulate Trade Impact ───────────────────────────────────

export async function simulateTradeImpact(
  contract: ContractInput,
  quantity: number,
  side: string,
  _account?: string,
): Promise<Record<string, unknown>> {
  // Use what-if order to get margin impact
  try {
    const { orderWhatIf } = await import('./orders_service');
    const result = await orderWhatIf({
      contract,
      side,
      quantity,
      orderType: 'MKT',
    });
    return {
      ...result,
      method: 'IB order what-if simulation',
      assumptions: 'Simulated at current market conditions. Actual impact may differ.',
      data_sources: ['IB TWS/Gateway what-if engine'],
    };
  } catch (err) {
    return {
      contract: { symbol: contract.symbol },
      quantity,
      side,
      note: 'What-if simulation failed — may require active market data subscription',
      error: err instanceof Error ? err.message : String(err),
      method: 'IB order what-if (failed)',
      assumptions: 'N/A',
      data_sources: ['IB TWS/Gateway'],
    };
  }
}

// ── Dividends & Splits ──────────────────────────────────────

export async function dividendsAndSplitsHistory(
  conIdOrSymbol: number | string,
): Promise<Record<string, unknown>> {
  // Use fundamental data API
  const contract: ContractInput = typeof conIdOrSymbol === 'number'
    ? { conId: conIdOrSymbol, symbol: '', secType: 'STK', exchange: 'SMART', currency: 'USD' }
    : { symbol: conIdOrSymbol, secType: 'STK', exchange: 'SMART', currency: 'USD' };

  try {
    const { fundamentalData } = await import('./market_data_service');
    const data = await fundamentalData(contract, 'ReportsFinSummary');
    return data;
  } catch {
    return {
      note: 'Dividends and splits history requires IB fundamental data subscription.',
      data: null,
    };
  }
}

export async function corporateActionsCalendar(
  _conIdOrSymbol: number | string,
): Promise<Record<string, unknown>> {
  throw new AppError('NOT_SUPPORTED', 'Corporate actions calendar is not directly available from the IBKR API.', {
    guidance: 'Use dividends_and_splits_history or fundamental_data for available corporate action data, or use external data sources.',
    documentation_url: 'https://interactivebrokers.github.io/tws-api/fundamental_data.html',
  });
}
