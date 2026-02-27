/**
 * Pre-trade guardrails — central enforcement for all order mutations.
 */
import { getConfig } from '../config';
import { AppError } from './error_mapping';
import { logger } from './logging';

export interface OrderGuardrailParams {
  symbol: string;
  secType: string;
  quantity: number;
  orderType: string;
  limitPrice?: number;
  auxPrice?: number;
  outsideRth?: boolean;
  side: string;
}

/**
 * Run all pre-trade checks. Throws AppError('RISK_GUARDRAIL_BLOCKED') on failure.
 */
export function enforceGuardrails(params: OrderGuardrailParams): void {
  const config = getConfig();

  // 1. Read-only mode
  if (config.ib.readOnly) {
    throw new AppError('RISK_GUARDRAIL_BLOCKED', 'Order blocked: server is in read-only mode', {
      reason: 'read_only_mode',
    });
  }

  // 2. Max order quantity
  if (params.quantity > config.risk.maxOrderQty) {
    throw new AppError('RISK_GUARDRAIL_BLOCKED', `Order quantity ${params.quantity} exceeds max ${config.risk.maxOrderQty}`, {
      reason: 'max_order_qty',
      limit: config.risk.maxOrderQty,
      attempted: params.quantity,
    });
  }

  // 3. Max order notional
  const price = params.limitPrice ?? params.auxPrice ?? 0;
  if (price > 0) {
    const notional = params.quantity * price;
    if (notional > config.risk.maxOrderNotional) {
      throw new AppError('RISK_GUARDRAIL_BLOCKED', `Order notional $${notional.toFixed(2)} exceeds max $${config.risk.maxOrderNotional}`, {
        reason: 'max_order_notional',
        limit: config.risk.maxOrderNotional,
        attempted: notional,
      });
    }
  }

  // 4. Allowed order types
  if (!config.risk.allowedOrderTypes.includes(params.orderType)) {
    throw new AppError('RISK_GUARDRAIL_BLOCKED', `Order type '${params.orderType}' is not allowed`, {
      reason: 'disallowed_order_type',
      allowed: config.risk.allowedOrderTypes,
      attempted: params.orderType,
    });
  }

  // 5. Symbol allowlist
  if (config.risk.symbolAllowlist && config.risk.symbolAllowlist.length > 0) {
    if (!config.risk.symbolAllowlist.includes(params.symbol.toUpperCase())) {
      throw new AppError('RISK_GUARDRAIL_BLOCKED', `Symbol '${params.symbol}' is not in the allowlist`, {
        reason: 'symbol_not_in_allowlist',
        allowlist: config.risk.symbolAllowlist,
        attempted: params.symbol,
      });
    }
  }

  // 6. Symbol denylist
  if (config.risk.symbolDenylist && config.risk.symbolDenylist.length > 0) {
    if (config.risk.symbolDenylist.includes(params.symbol.toUpperCase())) {
      throw new AppError('RISK_GUARDRAIL_BLOCKED', `Symbol '${params.symbol}' is in the denylist`, {
        reason: 'symbol_in_denylist',
        denylist: config.risk.symbolDenylist,
        attempted: params.symbol,
      });
    }
  }

  // 7. Outside-RTH restriction
  if (params.outsideRth && !config.risk.allowOutsideRth) {
    throw new AppError('RISK_GUARDRAIL_BLOCKED', 'Orders outside regular trading hours are not allowed', {
      reason: 'outside_rth_not_allowed',
      config_setting: 'RISK_ALLOW_OUTSIDE_RTH=false',
    });
  }

  logger.debug('Guardrails passed', { symbol: params.symbol, quantity: params.quantity, orderType: params.orderType });
}

/**
 * Check only read-only mode (for cancel, modify, exercise, etc.)
 */
export function enforceWriteAccess(): void {
  const config = getConfig();
  if (config.ib.readOnly) {
    throw new AppError('RISK_GUARDRAIL_BLOCKED', 'Operation blocked: server is in read-only mode', {
      reason: 'read_only_mode',
    });
  }
}

/** Daily loss tracking (in-memory) */
let _dailyRealized = 0;
let _dailyUnrealized = 0;
let _lastResetDate = new Date().toDateString();

export function updateDailyPnL(realized: number, unrealized: number): void {
  const today = new Date().toDateString();
  if (today !== _lastResetDate) {
    _dailyRealized = 0;
    _dailyUnrealized = 0;
    _lastResetDate = today;
  }
  _dailyRealized = realized;
  _dailyUnrealized = unrealized;
}

export function checkDailyLossLimit(): void {
  const config = getConfig();
  const totalLoss = _dailyRealized + _dailyUnrealized;
  if (totalLoss < -config.risk.dailyLossLimit) {
    throw new AppError('RISK_GUARDRAIL_BLOCKED', `Daily loss limit exceeded: $${Math.abs(totalLoss).toFixed(2)} > $${config.risk.dailyLossLimit}`, {
      reason: 'daily_loss_limit',
      limit: config.risk.dailyLossLimit,
      current_loss: Math.abs(totalLoss),
    });
  }
}
