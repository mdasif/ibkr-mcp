/**
 * Orders service — place, modify, cancel, preview, what-if, executions.
 */
import { EventName, type Order, type OrderAction, type OrderType, type TimeInForce, type Contract as IBContract } from '@stoqey/ib';
import { v4 as uuid } from 'uuid';
import { getConnection } from '../connection/ib_connection';
import { eventBus } from '../connection/event_bus';
import { AppError } from '../middleware/error_mapping';
import { enforceGuardrails, enforceWriteAccess, checkDailyLossLimit } from '../middleware/guardrails';
import { logger } from '../middleware/logging';
import { toIBContract } from './contract_service';
import type { ContractInput } from '../schemas/common';

// ── Helpers ─────────────────────────────────────────────────

interface OrderInput {
  contract: ContractInput & { comboLegs?: { conId: number; ratio: number; action: string; exchange: string }[] };
  side: string;
  quantity: number;
  orderType: string;
  limitPrice?: number;
  auxPrice?: number;
  trailingPercent?: number;
  timeInForce?: string;
  goodAfterTime?: string;
  goodTillDate?: string;
  outsideRth?: boolean;
  hidden?: boolean;
  transmit?: boolean;
  parentId?: number;
  account?: string;
  algoStrategy?: string;
  algoParams?: { tag: string; value: string }[];
  scaleInitLevelSize?: number;
  scaleSubsLevelSize?: number;
  scalePriceIncrement?: number;
}

function buildIBOrder(input: OrderInput, orderId: number, account: string): Order {
  const order: Order = {
    orderId,
    action: input.side as OrderAction,
    totalQuantity: input.quantity,
    orderType: input.orderType as OrderType,
    account,
    transmit: input.transmit ?? true,
    tif: (input.timeInForce ?? 'DAY') as TimeInForce,
  };

  if (input.limitPrice !== undefined) order.lmtPrice = input.limitPrice;
  if (input.auxPrice !== undefined) order.auxPrice = input.auxPrice;
  if (input.trailingPercent !== undefined) order.trailingPercent = input.trailingPercent;
  if (input.goodAfterTime) order.goodAfterTime = input.goodAfterTime;
  if (input.goodTillDate) order.goodTillDate = input.goodTillDate;
  if (input.outsideRth !== undefined) order.outsideRth = input.outsideRth;
  if (input.hidden !== undefined) order.hidden = input.hidden;
  if (input.parentId !== undefined) order.parentId = input.parentId;
  if (input.algoStrategy) order.algoStrategy = input.algoStrategy;
  if (input.algoParams) order.algoParams = input.algoParams;
  if (input.scaleInitLevelSize) order.scaleInitLevelSize = input.scaleInitLevelSize;
  if (input.scaleSubsLevelSize) order.scaleSubsLevelSize = input.scaleSubsLevelSize;
  if (input.scalePriceIncrement) order.scalePriceIncrement = input.scalePriceIncrement;

  return order;
}

// ── Order Operations ────────────────────────────────────────

export async function orderPlace(input: OrderInput): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  // Enforce guardrails
  enforceGuardrails({
    symbol: input.contract.symbol,
    secType: input.contract.secType,
    quantity: input.quantity,
    orderType: input.orderType,
    limitPrice: input.limitPrice,
    auxPrice: input.auxPrice,
    outsideRth: input.outsideRth,
    side: input.side,
  });
  checkDailyLossLimit();

  const account = input.account ?? conn.defaultAccount;
  const orderId = conn.nextReqId();
  const ibContract = toIBContract(input.contract);
  const ibOrder = buildIBOrder(input, orderId, account);

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, _reject) => {
    const warnings: string[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      // Resolve with what we have — order may have been placed
      resolve({
        orderId,
        status: 'Submitted',
        warnings,
        note: 'Confirmation timed out — check orders_open_list',
      });
    }, 10000);

    const onStatus = (
      oId: number,
      status: string,
      filled: number,
      remaining: number,
      avgFillPrice: number,
      permId: number,
    ) => {
      if (oId !== orderId) return;
      cleanup();
      resolve({
        orderId,
        permId,
        status,
        filled,
        remaining,
        avgFillPrice,
        warnings,
      });
    };

    const onOpenOrder = (oId: number, _contract: IBContract, _order: Order, orderState: unknown) => {
      if (oId !== orderId) return;
      const state = orderState as Record<string, unknown>;
      if (state['warningText']) {
        warnings.push(String(state['warningText']));
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.orderStatus, onStatus);
      conn.api.off(EventName.openOrder, onOpenOrder);
    };

    conn.api.on(EventName.orderStatus, onStatus as any);
    conn.api.on(EventName.openOrder, onOpenOrder as any);
    conn.api.placeOrder(orderId, ibContract, ibOrder);
    logger.info('Order placed', { orderId, symbol: input.contract.symbol, side: input.side, qty: input.quantity });
  }));
}

export async function orderModify(input: OrderInput & { orderId: number }): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();
  enforceGuardrails({
    symbol: input.contract.symbol,
    secType: input.contract.secType,
    quantity: input.quantity,
    orderType: input.orderType,
    limitPrice: input.limitPrice,
    auxPrice: input.auxPrice,
    outsideRth: input.outsideRth,
    side: input.side,
  });

  const account = input.account ?? conn.defaultAccount;
  const ibContract = toIBContract(input.contract);
  const ibOrder = buildIBOrder(input, input.orderId, account);

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, _reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ orderId: input.orderId, status: 'ModifySubmitted' });
    }, 10000);

    const onStatus = (oId: number, status: string, filled: number, remaining: number, avgFillPrice: number, permId: number) => {
      if (oId !== input.orderId) return;
      cleanup();
      resolve({ orderId: input.orderId, permId, status, filled, remaining, avgFillPrice });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.orderStatus, onStatus);
    };

    conn.api.on(EventName.orderStatus, onStatus as any);
    conn.api.placeOrder(input.orderId, ibContract, ibOrder);
    logger.info('Order modified', { orderId: input.orderId });
  }));
}

export async function orderCancel(orderId: number, manualCancelOrderTime?: string): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();
  enforceWriteAccess();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ orderId, status: 'CancelSubmitted' });
    }, 5000);

    const onStatus = (oId: number, status: string) => {
      if (oId !== orderId) return;
      if (status === 'Cancelled' || status === 'ApiCancelled') {
        cleanup();
        resolve({ orderId, status });
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.orderStatus, onStatus);
    };

    conn.api.on(EventName.orderStatus, onStatus);
    conn.api.cancelOrder(orderId, manualCancelOrderTime ?? '');
    logger.info('Order cancel requested', { orderId });
  }));
}

export async function ordersCancelAll(): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();
  enforceWriteAccess();

  conn.api.reqGlobalCancel();
  logger.info('Global cancel requested');
  return { status: 'GlobalCancelSubmitted' };
}

export async function ordersOpenList(_account?: string): Promise<Record<string, unknown>[]> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>[]>((resolve) => {
    const orders: Record<string, unknown>[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      resolve(orders);
    }, 10000);

    const onOpenOrder = (orderId: number, contract: IBContract, order: Order, orderState: unknown) => {
      const state = orderState as Record<string, unknown>;
      orders.push({
        orderId,
        permId: order.permId,
        contract: {
          conId: contract.conId,
          symbol: contract.symbol,
          secType: contract.secType,
          exchange: contract.exchange,
          currency: contract.currency,
        },
        action: order.action,
        totalQuantity: order.totalQuantity,
        orderType: order.orderType,
        lmtPrice: order.lmtPrice,
        auxPrice: order.auxPrice,
        tif: order.tif,
        status: state['status'],
        filled: state['filled'],
        remaining: state['remaining'],
        avgFillPrice: state['avgFillPrice'],
      });
    };

    const onEnd = () => {
      cleanup();
      resolve(orders);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.openOrder, onOpenOrder);
      conn.api.off(EventName.openOrderEnd, onEnd);
    };

    conn.api.on(EventName.openOrder, onOpenOrder);
    conn.api.on(EventName.openOrderEnd, onEnd);
    conn.api.reqOpenOrders();
  }));
}

export async function ordersCompletedList(apiOnly = false): Promise<Record<string, unknown>[]> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>[]>((resolve) => {
    const orders: Record<string, unknown>[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      resolve(orders);
    }, 10000);

    const onOrder = (orderId: number, contract: IBContract, order: Order, orderState: unknown) => {
      const state = orderState as Record<string, unknown>;
      orders.push({
        orderId,
        permId: order.permId,
        contract: { conId: contract.conId, symbol: contract.symbol, secType: contract.secType },
        action: order.action,
        totalQuantity: order.totalQuantity,
        orderType: order.orderType,
        status: state['status'],
      });
    };

    const onEnd = () => {
      cleanup();
      resolve(orders);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.completedOrder, onOrder);
      conn.api.off(EventName.completedOrdersEnd, onEnd);
    };

    conn.api.on(EventName.completedOrder, onOrder as any);
    conn.api.on(EventName.completedOrdersEnd, onEnd as any);
    conn.api.reqCompletedOrders(apiOnly);
  }));
}

export async function executionsList(filter: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>[]>((resolve) => {
    const executions: Record<string, unknown>[] = [];
    const reqId = conn.nextReqId();
    const timeout = setTimeout(() => {
      cleanup();
      resolve(executions);
    }, 10000);

    const onExec = (rId: number, contract: IBContract, execution: unknown) => {
      if (rId !== reqId) return;
      const exec = execution as Record<string, unknown>;
      executions.push({
        contract: { conId: contract.conId, symbol: contract.symbol, secType: contract.secType },
        execId: exec['execId'],
        time: exec['time'],
        side: exec['side'],
        shares: exec['shares'],
        price: exec['price'],
        orderId: exec['orderId'],
        avgPrice: exec['avgPrice'],
        cumQty: exec['cumQty'],
      });
    };

    const onEnd = (rId: number) => {
      if (rId !== reqId) return;
      cleanup();
      resolve(executions);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.execDetails, onExec);
      conn.api.off(EventName.execDetailsEnd, onEnd);
    };

    conn.api.on(EventName.execDetails, onExec);
    conn.api.on(EventName.execDetailsEnd, onEnd);
    conn.api.reqExecutions(reqId, filter as any);
  }));
}

export async function orderWhatIf(input: OrderInput): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  const account = input.account ?? conn.defaultAccount;
  const orderId = conn.nextReqId();
  const ibContract = toIBContract(input.contract);
  const ibOrder = buildIBOrder(input, orderId, account);
  ibOrder.whatIf = true;

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new AppError('TIMEOUT', 'What-if request timed out'));
    }, 10000);

    const onOpenOrder = (oId: number, _contract: IBContract, _order: Order, orderState: unknown) => {
      if (oId !== orderId) return;
      cleanup();
      const state = orderState as Record<string, unknown>;
      resolve({
        orderId,
        initMarginBefore: state['initMarginBefore'],
        maintMarginBefore: state['maintMarginBefore'],
        initMarginAfter: state['initMarginAfter'],
        maintMarginAfter: state['maintMarginAfter'],
        initMarginChange: state['initMarginChange'],
        maintMarginChange: state['maintMarginChange'],
        equityWithLoanBefore: state['equityWithLoanBefore'],
        equityWithLoanAfter: state['equityWithLoanAfter'],
        commission: state['commission'],
        maxCommission: state['maxCommission'],
        minCommission: state['minCommission'],
        commissionCurrency: state['commissionCurrency'],
        warningText: state['warningText'],
      });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.openOrder, onOpenOrder);
    };

    conn.api.on(EventName.openOrder, onOpenOrder);
    conn.api.placeOrder(orderId, ibContract, ibOrder);
  }));
}

export async function orderPreview(input: OrderInput): Promise<Record<string, unknown>> {
  return orderWhatIf(input);
}

export async function exerciseOptions(
  contract: ContractInput,
  exerciseAction: string,
  exerciseQuantity: number,
  account?: string,
  override = false,
): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();
  enforceWriteAccess();

  const acct = account ?? conn.defaultAccount;
  const ibContract = toIBContract(contract);

  // IB's exerciseOptions API expects 1=exercise, 2=lapse. This is a real-money,
  // irreversible action on an options position — an unrecognized action string
  // must never silently fall through to "lapse" (e.g. a typo like 'Exercise'
  // or 'EXCERCISE' would otherwise forfeit an in-the-money option instead of
  // exercising it).
  const EXERCISE_ACTION_CODES: Record<'EXERCISE' | 'LAPSE', 1 | 2> = { EXERCISE: 1, LAPSE: 2 };
  if (exerciseAction !== 'EXERCISE' && exerciseAction !== 'LAPSE') {
    throw new AppError('VALIDATION_ERROR', `exerciseAction must be 'EXERCISE' or 'LAPSE', got '${exerciseAction}'`);
  }
  const action = EXERCISE_ACTION_CODES[exerciseAction];

  conn.api.exerciseOptions(
    conn.nextReqId(),
    ibContract,
    action,
    exerciseQuantity,
    acct,
    override ? 1 : 0, // IB API override flag: 1 = override system's default exercise decision, 0 = use default
  );

  return { status: 'ExerciseSubmitted', contract: { symbol: contract.symbol }, exerciseAction, exerciseQuantity };
}

export async function requestGlobalCancel(): Promise<Record<string, unknown>> {
  return ordersCancelAll();
}

// ── Order Status Stream ─────────────────────────────────────

export async function orderStatusStreamSubscribe(orderIdFilter?: number): Promise<{ subscription_id: string }> {
  const conn = getConnection();
  conn.ensureConnected();

  const subscriptionId = uuid();
  const reqId = conn.nextReqId();

  const onStatus = (orderId: number, status: string, filled: number, remaining: number, avgFillPrice: number, permId: number) => {
    if (orderIdFilter && orderId !== orderIdFilter) return;
    eventBus.emit('order_status', {
      subscription_id: subscriptionId,
      contract_id: undefined,
      event_type: 'order_status',
      event_time: new Date().toISOString(),
      sequence: Date.now(),
      payload: { orderId, status, filled, remaining, avgFillPrice, permId },
    });
  };

  conn.api.on(EventName.orderStatus, onStatus as any);
  conn.registerSubscription(subscriptionId, reqId, 'order_status');

  return { subscription_id: subscriptionId };
}

export async function orderStatusStreamUnsubscribe(subscriptionId: string): Promise<{ cancelled: boolean }> {
  const conn = getConnection();
  const sub = conn.removeSubscription(subscriptionId);
  return { cancelled: !!sub };
}
