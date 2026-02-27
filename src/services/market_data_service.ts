/**
 * Market data service — snapshots, streaming, historical data.
 */
import { EventName, type BarSizeSetting, type TickByTickDataType } from '@stoqey/ib';
import type { WhatToShow } from '@stoqey/ib/dist/api/historical/what-to-show';
import { v4 as uuid } from 'uuid';
import { getConnection } from '../connection/ib_connection';
import { eventBus } from '../connection/event_bus';
import { AppError } from '../middleware/error_mapping';
import { logger } from '../middleware/logging';
import { toIBContract } from './contract_service';
import type { ContractInput } from '../schemas/common';

// ── Tick field mapping ──────────────────────────────────────
const TICK_FIELDS: Record<string, number> = {
  bid: 1, ask: 2, last: 4, volume: 8, close: 9,
  open: 14, high: 6, low: 7, halted: 49,
  bidSize: 0, askSize: 3, lastSize: 5,
  avgVolume: 21, optionCallOpenInterest: 27, optionPutOpenInterest: 28,
  shortable: 46, fundamentals: 47,
};

function fieldNamesToGenericTickList(fields?: string[]): string {
  if (!fields || fields.length === 0) return '';
  const ids = fields
    .map((f) => TICK_FIELDS[f])
    .filter((id) => id !== undefined);
  return [...new Set(ids)].join(',');
}

// ── Snapshot ────────────────────────────────────────────────

export async function marketDataSnapshot(
  contract: ContractInput,
  fields?: string[],
  regulatorySnapshot = false,
): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, _reject) => {
    const reqId = conn.nextReqId();
    const ibContract = toIBContract(contract);
    const tickData: Record<string, unknown> = {};
    const genericTickList = fieldNamesToGenericTickList(fields);

    const timeout = setTimeout(() => {
      cleanup();
      // Return what we have even on timeout
      resolve({
        contract: { conId: contract.conId, symbol: contract.symbol },
        ticks: tickData,
        partial: true,
      });
    }, 10000);

    const onPrice = (rId: number, field: number, price: number, attribs: unknown) => {
      if (rId !== reqId) return;
      tickData[`field_${field}`] = { price, attribs };
    };

    const onSize = (rId: number, field: number, size: number) => {
      if (rId !== reqId) return;
      tickData[`field_${field}`] = { size };
    };

    const onString = (rId: number, field: number, value: string) => {
      if (rId !== reqId) return;
      tickData[`field_${field}`] = { value };
    };

    const onSnapshotEnd = (rId: number) => {
      if (rId !== reqId) return;
      cleanup();
      resolve({
        contract: { conId: contract.conId, symbol: contract.symbol },
        ticks: tickData,
        partial: false,
      });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.tickPrice, onPrice);
      conn.api.off(EventName.tickSize, onSize);
      conn.api.off(EventName.tickString, onString);
      conn.api.off(EventName.tickSnapshotEnd, onSnapshotEnd);
    };

    conn.api.on(EventName.tickPrice, onPrice as any);
    conn.api.on(EventName.tickSize, onSize as any);
    conn.api.on(EventName.tickString, onString as any);
    conn.api.on(EventName.tickSnapshotEnd, onSnapshotEnd as any);
    conn.api.reqMktData(reqId, ibContract, genericTickList, true, regulatorySnapshot);
  }));
}

export async function marketDataBulkSnapshot(
  contracts: ContractInput[],
  fields?: string[],
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  for (const c of contracts) {
    try {
      const result = await marketDataSnapshot(c, fields);
      results.push(result);
    } catch (err) {
      results.push({
        contract: { conId: c.conId, symbol: c.symbol },
        error: err instanceof AppError ? err.message : String(err),
      });
    }
  }
  return results;
}

// ── Historical Data ─────────────────────────────────────────

export async function historicalData(
  contract: ContractInput,
  endDateTime = '',
  durationStr = '1 D',
  barSizeSetting = '1 hour',
  whatToShow = 'TRADES',
  useRTH = true,
  formatDate = 1,
): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    const reqId = conn.nextReqId();
    const ibContract = toIBContract(contract);
    const bars: Record<string, unknown>[] = [];

    const timeout = setTimeout(() => {
      cleanup();
      reject(new AppError('TIMEOUT', 'Historical data request timed out'));
    }, 30000);

    const onData = (rId: number, date: string, open: number, high: number, low: number, close: number, volume: number, count: number, WAP: number, _hasGaps: boolean) => {
      if (rId !== reqId) return;
      if (open === -1) {
        // Completion indicator bar
        cleanup();
        resolve({
          contract: { conId: contract.conId, symbol: contract.symbol },
          bars,
          barCount: bars.length,
        });
      } else {
        bars.push({ date, open, high, low, close, volume, count, wap: WAP });
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.historicalData, onData as any);
    };

    conn.api.on(EventName.historicalData, onData as any);
    conn.api.reqHistoricalData(
      reqId, ibContract, endDateTime, durationStr,
      barSizeSetting as BarSizeSetting, whatToShow as WhatToShow, useRTH ? 1 : 0, formatDate, false
    );
  }));
}

// ── Historical Ticks ────────────────────────────────────────

export async function historicalTicks(
  contract: ContractInput,
  startDateTime?: string,
  endDateTime?: string,
  numberOfTicks = 1000,
  whatToShow = 'TRADES',
  useRTH = true,
): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    const reqId = conn.nextReqId();
    const ibContract = toIBContract(contract);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new AppError('TIMEOUT', 'Historical ticks request timed out'));
    }, 30000);

    const ticks: Record<string, unknown>[] = [];

    const onTicks = (rId: number, tickList: unknown[], done: boolean) => {
      if (rId !== reqId) return;
      if (Array.isArray(tickList)) {
        ticks.push(...tickList.map((t) => t as Record<string, unknown>));
      }
      if (done) {
        cleanup();
        resolve({ contract: { conId: contract.conId, symbol: contract.symbol }, ticks, count: ticks.length });
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.historicalTicksLast, onTicks as any);
      conn.api.off(EventName.historicalTicksBidAsk, onTicks as any);
      conn.api.off(EventName.historicalTicks, onTicks as any);
    };

    conn.api.on(EventName.historicalTicksLast, onTicks as any);
    conn.api.on(EventName.historicalTicksBidAsk, onTicks as any);
    conn.api.on(EventName.historicalTicks, onTicks as any);
    conn.api.reqHistoricalTicks(
      reqId, ibContract, startDateTime ?? '', endDateTime ?? '',
      numberOfTicks, whatToShow as WhatToShow, useRTH ? 1 : 0, false
    );
  }));
}

// ── Fundamental Data ────────────────────────────────────────

export async function fundamentalData(
  contract: ContractInput,
  reportType: string,
): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    const reqId = conn.nextReqId();
    const ibContract = toIBContract(contract);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new AppError('TIMEOUT', 'Fundamental data request timed out'));
    }, 15000);

    const onData = (rId: number, data: string) => {
      if (rId !== reqId) return;
      cleanup();
      resolve({
        contract: { conId: contract.conId, symbol: contract.symbol },
        reportType,
        data,
      });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.fundamentalData, onData);
    };

    conn.api.on(EventName.fundamentalData, onData);
    conn.api.reqFundamentalData(reqId, ibContract, reportType, []);
  }));
}

// ── Market Depth Snapshot ───────────────────────────────────

export async function marketDepthSnapshot(
  contract: ContractInput,
  numRows = 10,
): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, _reject) => {
    const reqId = conn.nextReqId();
    const ibContract = toIBContract(contract);
    const bids: Record<string, unknown>[] = [];
    const asks: Record<string, unknown>[] = [];

    const timeout = setTimeout(() => {
      cleanup();
      conn.api.cancelMktDepth(reqId, false);
      resolve({
        contract: { conId: contract.conId, symbol: contract.symbol },
        bids,
        asks,
        numRows,
      });
    }, 5000);

    const onDepth = (rId: number, position: number, operation: number, side: number, price: number, size: number) => {
      if (rId !== reqId) return;
      const entry = { position, operation, price, size };
      if (side === 0) { // Ask
        asks.push(entry);
      } else { // Bid
        bids.push(entry);
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.updateMktDepth, onDepth);
    };

    conn.api.on(EventName.updateMktDepth, onDepth as any);
    conn.api.reqMktDepth(reqId, ibContract, numRows, false, []);
  }));
}

// ── Streaming Subscriptions ─────────────────────────────────

export async function marketDataSubscribe(
  contract: ContractInput,
  fields?: string[],
): Promise<{ subscription_id: string; reqId: number }> {
  const conn = getConnection();
  conn.ensureConnected();

  const subscriptionId = uuid();
  const reqId = conn.nextReqId();
  const ibContract = toIBContract(contract);
  const genericTickList = fieldNamesToGenericTickList(fields);

  // Set up event forwarding
  const onPrice = (rId: number, field: number, price: number, attribs: unknown) => {
    if (rId !== reqId) return;
    eventBus.emit('tick', {
      subscription_id: subscriptionId,
      contract_id: contract.conId,
      event_type: 'tick',
      event_time: new Date().toISOString(),
      sequence: Date.now(),
      payload: { field, price, attribs },
    });
  };

  const onSize = (rId: number, field: number, size: number) => {
    if (rId !== reqId) return;
    eventBus.emit('tick', {
      subscription_id: subscriptionId,
      contract_id: contract.conId,
      event_type: 'tick',
      event_time: new Date().toISOString(),
      sequence: Date.now(),
      payload: { field, size },
    });
  };

  conn.api.on(EventName.tickPrice, onPrice as any);
  conn.api.on(EventName.tickSize, onSize as any);
  conn.api.reqMktData(reqId, ibContract, genericTickList, false, false);

  conn.registerSubscription(subscriptionId, reqId, 'market_data', contract);
  logger.info('Market data subscription started', { subscriptionId, reqId, symbol: contract.symbol });

  return { subscription_id: subscriptionId, reqId };
}

export async function marketDataUnsubscribe(subscriptionId: string): Promise<{ cancelled: boolean }> {
  const conn = getConnection();
  const sub = conn.removeSubscription(subscriptionId);
  if (!sub) {
    return { cancelled: false }; // Idempotent
  }
  try {
    conn.api.cancelMktData(sub.reqId);
  } catch {
    // Best effort
  }
  logger.info('Market data subscription cancelled', { subscriptionId });
  return { cancelled: true };
}

export async function ticksSubscribe(
  contract: ContractInput,
  tickType = 'Last',
): Promise<{ subscription_id: string; reqId: number }> {
  const conn = getConnection();
  conn.ensureConnected();

  const subscriptionId = uuid();
  const reqId = conn.nextReqId();
  const ibContract = toIBContract(contract);

  const onTickByTick = (rId: number, tickT: number, time: number, price: number, size: number, tickAttribs: unknown, exchange: string, specialConditions: string) => {
    if (rId !== reqId) return;
    eventBus.emit('tick', {
      subscription_id: subscriptionId,
      contract_id: contract.conId,
      event_type: 'tick',
      event_time: new Date(time * 1000).toISOString(),
      sequence: time,
      payload: { tickType: tickT, price, size, exchange, specialConditions, attribs: tickAttribs },
    });
  };

  conn.api.on(EventName.tickByTickAllLast, onTickByTick as any);
  conn.api.reqTickByTickData(reqId, ibContract, tickType as TickByTickDataType, 0, false);
  conn.registerSubscription(subscriptionId, reqId, 'tick_by_tick', contract);

  return { subscription_id: subscriptionId, reqId };
}

export async function ticksUnsubscribe(subscriptionId: string): Promise<{ cancelled: boolean }> {
  const conn = getConnection();
  const sub = conn.removeSubscription(subscriptionId);
  if (!sub) return { cancelled: false };
  try { conn.api.cancelTickByTickData(sub.reqId); } catch { /* noop */ }
  return { cancelled: true };
}

export async function marketDepthSubscribe(
  contract: ContractInput,
  numRows = 10,
): Promise<{ subscription_id: string; reqId: number }> {
  const conn = getConnection();
  conn.ensureConnected();

  const subscriptionId = uuid();
  const reqId = conn.nextReqId();
  const ibContract = toIBContract(contract);

  const onDepth = (rId: number, position: number, operation: number, side: number, price: number, size: number) => {
    if (rId !== reqId) return;
    eventBus.emit('depth', {
      subscription_id: subscriptionId,
      contract_id: contract.conId,
      event_type: 'depth',
      event_time: new Date().toISOString(),
      sequence: Date.now(),
      payload: { position, operation, side: side === 0 ? 'ASK' : 'BID', price, size },
    });
  };

  conn.api.on(EventName.updateMktDepth, onDepth as any);
  conn.api.reqMktDepth(reqId, ibContract, numRows, false, []);
  conn.registerSubscription(subscriptionId, reqId, 'market_depth', contract);

  return { subscription_id: subscriptionId, reqId };
}

export async function marketDepthUnsubscribe(subscriptionId: string): Promise<{ cancelled: boolean }> {
  const conn = getConnection();
  const sub = conn.removeSubscription(subscriptionId);
  if (!sub) return { cancelled: false };
  try { conn.api.cancelMktDepth(sub.reqId, false); } catch { /* noop */ }
  return { cancelled: true };
}

export async function realtimeBarsSubscribe(
  contract: ContractInput,
  barSize = 5,
  whatToShow = 'TRADES',
  useRTH = true,
): Promise<{ subscription_id: string; reqId: number }> {
  const conn = getConnection();
  conn.ensureConnected();

  const subscriptionId = uuid();
  const reqId = conn.nextReqId();
  const ibContract = toIBContract(contract);

  const onBar = (rId: number, date: number, open: number, high: number, low: number, close: number, volume: number, wap: number, count: number) => {
    if (rId !== reqId) return;
    eventBus.emit('bar', {
      subscription_id: subscriptionId,
      contract_id: contract.conId,
      event_type: 'bar',
      event_time: new Date(date * 1000).toISOString(),
      sequence: date,
      payload: { date, open, high, low, close, volume, wap, count },
    });
  };

  conn.api.on(EventName.realtimeBar, onBar as any);
  conn.api.reqRealTimeBars(reqId, ibContract, barSize, whatToShow as WhatToShow, useRTH);
  conn.registerSubscription(subscriptionId, reqId, 'realtime_bars', contract);

  return { subscription_id: subscriptionId, reqId };
}

export async function realtimeBarsUnsubscribe(subscriptionId: string): Promise<{ cancelled: boolean }> {
  const conn = getConnection();
  const sub = conn.removeSubscription(subscriptionId);
  if (!sub) return { cancelled: false };
  try { conn.api.cancelRealTimeBars(sub.reqId); } catch { /* noop */ }
  return { cancelled: true };
}

export function listMarketDataSubscriptions(): Record<string, unknown>[] {
  const conn = getConnection();
  const subs = conn.getActiveSubscriptions();
  const result: Record<string, unknown>[] = [];
  for (const [id, sub] of subs) {
    if (['market_data', 'market_depth', 'realtime_bars', 'tick_by_tick'].includes(sub.type)) {
      result.push({
        subscription_id: id,
        reqId: sub.reqId,
        type: sub.type,
        contract: sub.contract,
      });
    }
  }
  return result;
}
