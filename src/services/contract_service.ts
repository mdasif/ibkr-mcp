/**
 * Contract service — search, qualify, details, option chain.
 */
import { type Contract as IBContract, type ContractDetails, EventName, type SecType, type OptionType } from '@stoqey/ib';
import { getConnection } from '../connection/ib_connection';
import { getConfig } from '../config';
import { AppError } from '../middleware/error_mapping';
import type { ContractInput } from '../schemas/common';

// ── In-memory cache ─────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const contractCache = new Map<string, CacheEntry<ContractDetails[]>>();
const conIdCache = new Map<string, CacheEntry<number>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ── Helpers ─────────────────────────────────────────────────

export function toIBContract(input: ContractInput): IBContract {
  const c: IBContract = {
    symbol: input.symbol,
    secType: input.secType as SecType,
    exchange: input.exchange ?? 'SMART',
    currency: input.currency ?? 'USD',
  };
  if (input.conId) c.conId = input.conId;
  if (input.lastTradeDateOrContractMonth) c.lastTradeDateOrContractMonth = input.lastTradeDateOrContractMonth;
  if (input.strike) c.strike = input.strike;
  if (input.right) c.right = input.right as OptionType;
  if (input.multiplier) c.multiplier = input.multiplier ? Number(input.multiplier) : undefined;
  if (input.primaryExch) c.primaryExch = input.primaryExch;
  if (input.localSymbol) c.localSymbol = input.localSymbol;
  if (input.tradingClass) c.tradingClass = input.tradingClass;
  return c;
}

export function fromIBContract(c: IBContract): Record<string, unknown> {
  return {
    conId: c.conId,
    symbol: c.symbol,
    secType: c.secType,
    exchange: c.exchange,
    currency: c.currency,
    primaryExch: c.primaryExch,
    lastTradeDateOrContractMonth: c.lastTradeDateOrContractMonth,
    strike: c.strike,
    right: c.right,
    multiplier: c.multiplier,
    localSymbol: c.localSymbol,
    tradingClass: c.tradingClass,
  };
}

// ── Service Methods ─────────────────────────────────────────

export async function contractSearch(query: string, secType?: string, exchange?: string, currency?: string): Promise<Record<string, unknown>[]> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const reqId = conn.nextReqId();
    const timeout = setTimeout(() => {
      conn.api.off(EventName.symbolSamples, handler);
      reject(new AppError('TIMEOUT', 'Contract search timed out'));
    }, 15000);

    const handler = (rId: number, descriptions: unknown[]) => {
      if (rId !== reqId) return;
      clearTimeout(timeout);
      conn.api.off(EventName.symbolSamples, handler);

      let results = (descriptions as {
        conId: number;
        symbol: string;
        secType: string;
        primaryExch: string;
        currency: string;
        derivativeSecTypes?: string[];
        description?: string;
      }[]).map((d) => ({
        conId: d.conId,
        symbol: d.symbol,
        secType: d.secType,
        primaryExch: d.primaryExch,
        exchange: d.primaryExch,
        currency: d.currency,
        description: d.description ?? '',
        derivativeSecTypes: d.derivativeSecTypes ?? [],
      }));

      // Apply filters
      if (secType) results = results.filter((r) => r.secType === secType);
      if (exchange) results = results.filter((r) => r.primaryExch === exchange || r.exchange === exchange);
      if (currency) results = results.filter((r) => r.currency === currency);

      resolve(results);
    };

    conn.api.on(EventName.symbolSamples, handler);
    conn.api.reqMatchingSymbols(reqId, query);
  }));
}

export async function contractDetails(input: ContractInput): Promise<Record<string, unknown>[]> {
  const conn = getConnection();
  conn.ensureConnected();
  const config = getConfig();

  const cacheKey = JSON.stringify(input);
  const cached = getCached(contractCache, cacheKey);
  if (cached) {
    return cached.map(formatContractDetails);
  }

  return conn.enqueue(() => new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const reqId = conn.nextReqId();
    const details: ContractDetails[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      reject(new AppError('TIMEOUT', 'Contract details request timed out'));
    }, 15000);

    const onDetails = (rId: number, detail: ContractDetails) => {
      if (rId !== reqId) return;
      details.push(detail);
    };

    const onEnd = (rId: number) => {
      if (rId !== reqId) return;
      cleanup();
      if (details.length === 0) {
        reject(new AppError('IB_CONTRACT_NOT_FOUND', 'No contract found', { input }));
      } else {
        setCache(contractCache, cacheKey, details, config.cache.contractTtlMs);
        resolve(details.map(formatContractDetails));
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.contractDetails, onDetails);
      conn.api.off(EventName.contractDetailsEnd, onEnd);
    };

    conn.api.on(EventName.contractDetails, onDetails);
    conn.api.on(EventName.contractDetailsEnd, onEnd);
    conn.api.reqContractDetails(reqId, toIBContract(input));
  }));
}

export async function contractQualify(input: ContractInput): Promise<Record<string, unknown>> {
  const results = await contractDetails(input);
  if (results.length === 0) {
    throw new AppError('IB_CONTRACT_NOT_FOUND', 'Could not qualify contract', { input });
  }
  return results[0]!;
}

export async function contractRules(conId: number, exchange?: string): Promise<Record<string, unknown>> {
  // Use contractDetails with conId to get rules
  const results = await contractDetails({
    conId,
    symbol: '',
    secType: 'STK',
    exchange: exchange ?? 'SMART',
    currency: 'USD',
  });
  if (results.length === 0) {
    throw new AppError('IB_CONTRACT_NOT_FOUND', 'Contract not found for rules', { conId });
  }
  const detail = results[0]!;
  return {
    conId,
    exchange,
    minTick: detail['minTick'],
    priceMagnifier: detail['priceMagnifier'],
    validExchanges: detail['validExchanges'],
    tradingHours: detail['tradingHours'],
    liquidHours: detail['liquidHours'],
    orderTypes: detail['orderTypes'],
  };
}

export async function secDefOptParams(
  underlyingConId: number,
  exchange: string,
  underlyingSecType: string,
  underlyingSymbol: string,
): Promise<Record<string, unknown>[]> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>[]>((resolve, _reject) => {
    const reqId = conn.nextReqId();
    const results: Record<string, unknown>[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      resolve(results); // may be partial
    }, 15000);

    const onData = (
      rId: number,
      ex: string,
      underConId: number,
      tradingClass: string,
      multiplier: string,
      expirations: string[],
      strikes: number[],
    ) => {
      if (rId !== reqId) return;
      results.push({
        exchange: ex,
        underlyingConId: underConId,
        tradingClass,
        multiplier,
        expirations,
        strikes,
      });
    };

    const onEnd = (rId: number) => {
      if (rId !== reqId) return;
      cleanup();
      resolve(results);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.securityDefinitionOptionParameter, onData);
      conn.api.off(EventName.securityDefinitionOptionParameterEnd, onEnd);
    };

    conn.api.on(EventName.securityDefinitionOptionParameter, onData);
    conn.api.on(EventName.securityDefinitionOptionParameterEnd, onEnd);
    conn.api.reqSecDefOptParams(reqId, underlyingSymbol, exchange, underlyingSecType as SecType, underlyingConId);
  }));
}

export async function optionChain(
  underlyingSymbol?: string,
  underlyingConId?: number,
  exchange = 'SMART',
  currency = 'USD',
): Promise<Record<string, unknown>> {
  // First qualify the underlying to get conId
  let conId = underlyingConId;
  if (!conId && underlyingSymbol) {
    const details = await contractDetails({
      symbol: underlyingSymbol,
      secType: 'STK',
      exchange,
      currency,
    });
    if (details.length === 0) {
      throw new AppError('IB_CONTRACT_NOT_FOUND', 'Underlying not found', { underlyingSymbol });
    }
    conId = details[0]!['conId'] as number;
  }
  if (!conId) {
    throw new AppError('VALIDATION_ERROR', 'Either underlyingSymbol or underlyingConId is required');
  }

  const params = await secDefOptParams(conId, exchange, 'STK', underlyingSymbol ?? '');
  return {
    underlyingConId: conId,
    exchange,
    chains: params,
  };
}

export async function instrumentMetadata(conId: number): Promise<Record<string, unknown>> {
  const details = await contractDetails({
    conId,
    symbol: '',
    secType: 'STK',
    exchange: 'SMART',
    currency: 'USD',
  });
  if (details.length === 0) {
    throw new AppError('IB_CONTRACT_NOT_FOUND', 'Contract not found', { conId });
  }
  const d = details[0]!;
  return {
    conId,
    symbol: d['symbol'],
    secType: d['secType'],
    primaryExch: d['primaryExch'],
    exchange: d['exchange'],
    currency: d['currency'],
    industry: d['industry'],
    category: d['category'],
    subcategory: d['subcategory'],
    longName: d['longName'],
    marketName: d['marketName'],
  };
}

export async function symbolToConId(
  symbol: string,
  secType = 'STK',
  exchange = 'SMART',
): Promise<{ conId: number; symbol: string; secType: string; exchange: string }> {
  const cacheKey = `${symbol}|${secType}|${exchange}`;
  const cachedConId = getCached(conIdCache, cacheKey);
  if (cachedConId !== undefined) {
    return { conId: cachedConId, symbol, secType, exchange };
  }

  const details = await contractDetails({
    symbol,
    secType: secType as any,
    exchange,
    currency: 'USD',
  });
  if (details.length === 0) {
    throw new AppError('IB_CONTRACT_NOT_FOUND', 'Symbol not found', { symbol, secType, exchange });
  }
  const conId = details[0]!['conId'] as number;
  setCache(conIdCache, cacheKey, conId, getConfig().cache.contractTtlMs);
  return { conId, symbol, secType, exchange };
}

// ── Formatters ──────────────────────────────────────────────

function formatContractDetails(d: ContractDetails): Record<string, unknown> {
  return {
    conId: d.contract?.conId,
    symbol: d.contract?.symbol,
    secType: d.contract?.secType,
    exchange: d.contract?.exchange,
    currency: d.contract?.currency,
    primaryExch: d.contract?.primaryExch,
    localSymbol: d.contract?.localSymbol,
    tradingClass: d.contract?.tradingClass,
    lastTradeDateOrContractMonth: d.contract?.lastTradeDateOrContractMonth,
    strike: d.contract?.strike,
    right: d.contract?.right,
    multiplier: d.contract?.multiplier,
    longName: d.longName,
    marketName: d.marketName,
    minTick: d.minTick,
    priceMagnifier: d.priceMagnifier,
    orderTypes: d.orderTypes,
    validExchanges: d.validExchanges,
    tradingHours: d.tradingHours,
    liquidHours: d.liquidHours,
    industry: d.industry,
    category: d.category,
    subcategory: d.subcategory,
    timeZoneId: d.timeZoneId,
    evMultiplier: d.evMultiplier,
    aggGroup: d.aggGroup,
    underSymbol: d.underSymbol,
    underSecType: d.underSecType,
    contractMonth: d.contractMonth,
    stockType: d.stockType,
  };
}
