/**
 * Account service — summary, positions, PnL, margin, FA allocation.
 */
import { EventName, type Contract as IBContract } from '@stoqey/ib';
import { v4 as uuid } from 'uuid';
import { getConnection } from '../connection/ib_connection';
import { eventBus } from '../connection/event_bus';
import { AppError } from '../middleware/error_mapping';
import { updateDailyPnL } from '../middleware/guardrails';

// ── Account List ────────────────────────────────────────────

export function accountsList(): string[] {
  return getConnection().managedAccounts;
}

function resolveAccount(account?: string): string {
  if (account) return account;
  return getConnection().defaultAccount;
}

// ── Account Summary ─────────────────────────────────────────

const DEFAULT_TAGS = [
  'AccountType', 'NetLiquidation', 'TotalCashValue', 'SettledCash',
  'AccruedCash', 'BuyingPower', 'EquityWithLoanValue', 'PreviousEquityWithLoanValue',
  'GrossPositionValue', 'RegTEquity', 'RegTMargin', 'SMA',
  'InitMarginReq', 'MaintMarginReq', 'AvailableFunds', 'ExcessLiquidity',
  'Cushion', 'FullInitMarginReq', 'FullMaintMarginReq', 'FullAvailableFunds',
  'FullExcessLiquidity', 'LookAheadNextChange', 'LookAheadInitMarginReq',
  'LookAheadMaintMarginReq', 'LookAheadAvailableFunds', 'LookAheadExcessLiquidity',
  'HighestSeverity', 'DayTradesRemaining', 'Leverage',
];

export async function accountSummary(account?: string, tags?: string[]): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();
  const acct = resolveAccount(account);
  const tagList = tags && tags.length > 0 ? tags.join(',') : DEFAULT_TAGS.join(',');

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve) => {
    const reqId = conn.nextReqId();
    const summary: Record<string, { value: string; currency: string }> = {};
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ account: acct, summary });
    }, 10000);

    const onValue = (rId: number, _acc: string, tag: string, value: string, currency: string) => {
      if (rId !== reqId) return;
      summary[tag] = { value, currency };
    };

    const onEnd = (rId: number) => {
      if (rId !== reqId) return;
      cleanup();
      conn.api.cancelAccountSummary(reqId);
      resolve({ account: acct, summary });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.accountSummary, onValue);
      conn.api.off(EventName.accountSummaryEnd, onEnd);
    };

    conn.api.on(EventName.accountSummary, onValue);
    conn.api.on(EventName.accountSummaryEnd, onEnd);
    conn.api.reqAccountSummary(reqId, 'All', tagList);
  }));
}

// ── Account Values ──────────────────────────────────────────

export async function accountValues(account?: string): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();
  const acct = resolveAccount(account);

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve) => {
    const values: Record<string, { value: string; currency: string }> = {};
    const timeout = setTimeout(() => {
      cleanup();
      conn.api.reqAccountUpdates(false, acct);
      resolve({ account: acct, values });
    }, 10000);

    const onValue = (key: string, value: string, currency: string, accountName: string) => {
      if (accountName !== acct) return;
      values[key] = { value, currency };
    };

    const onEnd = (accountName: string) => {
      if (accountName !== acct) return;
      cleanup();
      conn.api.reqAccountUpdates(false, acct);
      resolve({ account: acct, values });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.updateAccountValue, onValue);
      conn.api.off(EventName.accountDownloadEnd, onEnd);
    };

    conn.api.on(EventName.updateAccountValue, onValue);
    conn.api.on(EventName.accountDownloadEnd, onEnd);
    conn.api.reqAccountUpdates(true, acct);
  }));
}

// ── Positions ───────────────────────────────────────────────

export async function positionsList(account?: string): Promise<Record<string, unknown>[]> {
  const conn = getConnection();
  conn.ensureConnected();
  const acctFilter = account;

  return conn.enqueue(() => new Promise<Record<string, unknown>[]>((resolve) => {
    const positions: Record<string, unknown>[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      resolve(positions);
    }, 10000);

    const onPosition = (acct: string, contract: IBContract, pos: number, avgCost: number) => {
      if (acctFilter && acct !== acctFilter) return;
      positions.push({
        account: acct,
        contract: {
          conId: contract.conId,
          symbol: contract.symbol,
          secType: contract.secType,
          exchange: contract.exchange,
          currency: contract.currency,
        },
        position: pos,
        avgCost,
      });
    };

    const onEnd = () => {
      cleanup();
      conn.api.cancelPositions();
      resolve(positions);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.position, onPosition);
      conn.api.off(EventName.positionEnd, onEnd);
    };

    conn.api.on(EventName.position, onPosition as any);
    conn.api.on(EventName.positionEnd, onEnd as any);
    conn.api.reqPositions();
  }));
}

// ── Portfolio ───────────────────────────────────────────────

export async function portfolioList(account?: string): Promise<Record<string, unknown>[]> {
  const conn = getConnection();
  conn.ensureConnected();
  const acct = resolveAccount(account);

  return conn.enqueue(() => new Promise<Record<string, unknown>[]>((resolve) => {
    const items: Record<string, unknown>[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      conn.api.reqAccountUpdates(false, acct);
      resolve(items);
    }, 10000);

    const onPortfolio = (
      contract: IBContract,
      position: number,
      marketPrice: number,
      marketValue: number,
      avgCost: number,
      unrealizedPNL: number,
      realizedPNL: number,
      accountName: string,
    ) => {
      if (accountName !== acct) return;
      items.push({
        contract: { conId: contract.conId, symbol: contract.symbol, secType: contract.secType },
        position,
        marketPrice,
        marketValue,
        avgCost,
        unrealizedPNL,
        realizedPNL,
        account: accountName,
      });
    };

    const onEnd = (accountName: string) => {
      if (accountName !== acct) return;
      cleanup();
      conn.api.reqAccountUpdates(false, acct);
      resolve(items);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.updatePortfolio, onPortfolio);
      conn.api.off(EventName.accountDownloadEnd, onEnd);
    };

    conn.api.on(EventName.updatePortfolio, onPortfolio as any);
    conn.api.on(EventName.accountDownloadEnd, onEnd as any);
    conn.api.reqAccountUpdates(true, acct);
  }));
}

// ── PnL ─────────────────────────────────────────────────────

export async function pnlAccount(account?: string): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();
  const acct = resolveAccount(account);

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve) => {
    const reqId = conn.nextReqId();
    const timeout = setTimeout(() => {
      cleanup();
      conn.api.cancelPnL(reqId);
      resolve({ account: acct, dailyPnL: null, unrealizedPnL: null, realizedPnL: null });
    }, 10000);

    const onPnL = (rId: number, dailyPnL: number, unrealizedPnL: number, realizedPnL: number) => {
      if (rId !== reqId) return;
      cleanup();
      conn.api.cancelPnL(reqId);
      updateDailyPnL(realizedPnL, unrealizedPnL);
      resolve({ account: acct, dailyPnL, unrealizedPnL, realizedPnL });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.pnl, onPnL);
    };

    conn.api.on(EventName.pnl, onPnL as any);
    conn.api.reqPnL(reqId, acct, '');
  }));
}

export async function pnlPosition(account: string | undefined, conId: number): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();
  const acct = resolveAccount(account);

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve) => {
    const reqId = conn.nextReqId();
    const timeout = setTimeout(() => {
      cleanup();
      conn.api.cancelPnLSingle(reqId);
      resolve({ account: acct, conId, dailyPnL: null, unrealizedPnL: null, realizedPnL: null, position: null, value: null });
    }, 10000);

    const onPnLSingle = (rId: number, pos: number, dailyPnL: number, unrealizedPnL: number, realizedPnL: number, value: number) => {
      if (rId !== reqId) return;
      cleanup();
      conn.api.cancelPnLSingle(reqId);
      resolve({ account: acct, conId, position: pos, dailyPnL, unrealizedPnL, realizedPnL, value });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.pnlSingle, onPnLSingle);
    };

    conn.api.on(EventName.pnlSingle, onPnLSingle as any);
    conn.api.reqPnLSingle(reqId, acct, '', conId);
  }));
}

// ── Account Updates Streaming ───────────────────────────────

export async function accountUpdatesSubscribe(account?: string): Promise<{ subscription_id: string }> {
  const conn = getConnection();
  conn.ensureConnected();
  const acct = resolveAccount(account);
  const subscriptionId = uuid();
  const reqId = conn.nextReqId();

  const onValue = (key: string, value: string, currency: string, accountName: string) => {
    if (accountName !== acct) return;
    eventBus.emit('account_update', {
      subscription_id: subscriptionId,
      event_type: 'account_update',
      event_time: new Date().toISOString(),
      sequence: Date.now(),
      payload: { key, value, currency, account: accountName },
    });
  };

  conn.api.on(EventName.updateAccountValue, onValue);
  conn.api.reqAccountUpdates(true, acct);
  conn.registerSubscription(subscriptionId, reqId, 'account_updates');

  return { subscription_id: subscriptionId };
}

export async function accountUpdatesUnsubscribe(subscriptionId: string): Promise<{ cancelled: boolean }> {
  const conn = getConnection();
  const sub = conn.removeSubscription(subscriptionId);
  if (!sub) return { cancelled: false };
  try { conn.api.reqAccountUpdates(false, ''); } catch { /* noop */ }
  return { cancelled: true };
}

// ── Margin / Buying Power / Cash ────────────────────────────

export async function buyingPower(account?: string): Promise<Record<string, unknown>> {
  const summary = await accountSummary(account, ['BuyingPower', 'AvailableFunds', 'ExcessLiquidity']);
  return { account: resolveAccount(account), ...summary };
}

export async function cashBalances(account?: string): Promise<Record<string, unknown>> {
  const summary = await accountSummary(account, ['TotalCashValue', 'SettledCash', 'AccruedCash']);
  return { account: resolveAccount(account), ...summary };
}

export async function leverageMetrics(account?: string): Promise<Record<string, unknown>> {
  const summary = await accountSummary(account, [
    'NetLiquidation', 'GrossPositionValue', 'InitMarginReq', 'MaintMarginReq', 'Leverage',
  ]);
  return { account: resolveAccount(account), ...summary };
}

export async function marginRequirements(
  contract: Record<string, unknown>,
  quantity: number,
  side: string,
): Promise<Record<string, unknown>> {
  // Use order what-if to get margin impact
  const { orderWhatIf } = await import('./orders_service');
  return orderWhatIf({
    contract: contract as any,
    side,
    quantity,
    orderType: 'MKT',
  });
}

// ── FA Allocation ───────────────────────────────────────────

export async function faGroups(): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new AppError('NOT_SUPPORTED', 'FA groups not available — may not be an FA account'));
    }, 10000);

    const onFA = (faDataType: number, faXmlData: string) => {
      if (faDataType !== 1) return; // 1 = GROUPS
      cleanup();
      resolve({ faDataType: 'GROUPS', xml: faXmlData });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.receiveFA, onFA);
    };

    conn.api.on(EventName.receiveFA, onFA);
    conn.api.requestFA(1); // 1 = GROUPS
  }));
}

export async function faProfiles(): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new AppError('NOT_SUPPORTED', 'FA profiles not available'));
    }, 10000);

    const onFA = (faDataType: number, faXmlData: string) => {
      if (faDataType !== 2) return; // 2 = PROFILES
      cleanup();
      resolve({ faDataType: 'PROFILES', xml: faXmlData });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.receiveFA, onFA);
    };

    conn.api.on(EventName.receiveFA, onFA);
    conn.api.requestFA(2);
  }));
}

export async function faAliases(): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new AppError('NOT_SUPPORTED', 'FA aliases not available'));
    }, 10000);

    const onFA = (faDataType: number, faXmlData: string) => {
      if (faDataType !== 3) return; // 3 = ALIASES
      cleanup();
      resolve({ faDataType: 'ALIASES', xml: faXmlData });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.receiveFA, onFA);
    };

    conn.api.on(EventName.receiveFA, onFA);
    conn.api.requestFA(3);
  }));
}

export async function replaceFA(faDataType: string, xml: string): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();
  await enforceWriteAccessImport();

  const typeMap: Record<string, number> = { GROUPS: 1, PROFILES: 2, ALIASES: 3 };
  const typeNum = typeMap[faDataType];
  if (!typeNum) throw new AppError('VALIDATION_ERROR', `Invalid FA data type: ${faDataType}`);

  conn.api.replaceFA(conn.nextReqId(), typeNum, xml);
  return { status: 'ReplaceSubmitted', faDataType };
}

async function enforceWriteAccessImport(): Promise<void> {
  const { enforceWriteAccess: ewa } = await import('../middleware/guardrails');
  ewa();
}
