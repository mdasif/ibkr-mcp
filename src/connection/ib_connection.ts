/**
 * IB Connection Manager — session lifecycle, heartbeat, reconnect, request queue, pacing.
 */
import { IBApi, EventName } from '@stoqey/ib';
import { v4 as uuid } from 'uuid';
import { getConfig } from '../config';
import { type EventBus, eventBus } from './event_bus';
import { logger } from '../middleware/logging';
import { AppError } from '../middleware/error_mapping';

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  uptime: number | null;
  lastConnectTime: string | null;
  lastDisconnectTime: string | null;
  lastReconnectTime: string | null;
  reconnectAttempts: number;
  serverVersion: number | null;
  serverConnectionTime: string | null;
}

interface QueuedRequest<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
  timestamp: number;
}

/** Ring buffer for recent IB errors */
export interface IBErrorEntry {
  timestamp: string;
  code: number;
  message: string;
  reqId?: number;
}

export class IBConnection {
  private ib: IBApi;
  private _connected = false;
  private _connecting = false;
  private _connectTime: Date | null = null;
  private _disconnectTime: Date | null = null;
  private _lastReconnectTime: Date | null = null;
  private _reconnectAttempts = 0;
  private _nextReqId = 1;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _shutdownRequested = false;

  // Request queue for serialization
  private _queue: QueuedRequest<unknown>[] = [];
  private _activeRequests = 0;
  private _maxConcurrency = 1;

  // Pacing
  private _messageTimestamps: number[] = [];
  private _maxMessagesPerSecond = 45; // Leave margin below IB's 50/s

  // Error log ring buffer
  private _errorLog: IBErrorEntry[] = [];
  private _errorLogMaxSize = 200;

  // Subscription tracking
  private _activeSubscriptions = new Map<string, { reqId: number; type: string; contract?: unknown }>();

  // Managed accounts
  private _managedAccounts: string[] = [];
  private _defaultAccount: string | null = null;

  public readonly bus: EventBus;

  constructor() {
    const config = getConfig();
    this.ib = new IBApi({
      host: config.ib.host,
      port: config.ib.port,
      clientId: config.ib.clientId,
    });
    this.bus = eventBus;
    this._setupEventHandlers();
  }

  // ── Public API ────────────────────────────────────────────

  get connected(): boolean { return this._connected; }
  get api(): IBApi { return this.ib; }
  get managedAccounts(): string[] { return this._managedAccounts; }
  get defaultAccount(): string {
    if (this._defaultAccount) return this._defaultAccount;
    throw new AppError('IB_NOT_CONNECTED', 'No account available — not connected');
  }

  getState(): ConnectionState {
    return {
      connected: this._connected,
      connecting: this._connecting,
      uptime: this._connected && this._connectTime
        ? Date.now() - this._connectTime.getTime()
        : null,
      lastConnectTime: this._connectTime?.toISOString() ?? null,
      lastDisconnectTime: this._disconnectTime?.toISOString() ?? null,
      lastReconnectTime: this._lastReconnectTime?.toISOString() ?? null,
      reconnectAttempts: this._reconnectAttempts,
      serverVersion: this._connected ? this.ib.serverVersion : null,
      serverConnectionTime: null,
    };
  }

  getErrorLog(): IBErrorEntry[] {
    return [...this._errorLog];
  }

  clearErrorLog(): void {
    this._errorLog = [];
  }

  getQueueDepth(): number {
    return this._queue.length;
  }

  getActiveSubscriptionCount(): number {
    return this._activeSubscriptions.size;
  }

  getActiveSubscriptions(): Map<string, { reqId: number; type: string; contract?: unknown }> {
    return new Map(this._activeSubscriptions);
  }

  nextReqId(): number {
    return this._nextReqId++;
  }

  registerSubscription(subscriptionId: string, reqId: number, type: string, contract?: unknown): void {
    this._activeSubscriptions.set(subscriptionId, { reqId, type, contract });
  }

  removeSubscription(subscriptionId: string): { reqId: number; type: string } | undefined {
    const sub = this._activeSubscriptions.get(subscriptionId);
    if (sub) {
      this._activeSubscriptions.delete(subscriptionId);
    }
    return sub;
  }

  // ── Connect ───────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this._connected) {
      logger.info('Already connected to IB');
      return;
    }
    if (this._connecting) {
      logger.info('Connection already in progress');
      return;
    }

    this._connecting = true;
    this._shutdownRequested = false;

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new AppError('IB_CONNECTION_FAILED', 'Connection timed out after 30s'));
        }, 30000);

        const onConnected = () => {
          clearTimeout(timeout);
          this.ib.off(EventName.connected, onConnected);
          this.ib.off(EventName.error, onError);
          resolve();
        };

        const onError = (err: Error, code: number, _reqId: number) => {
          if (code === 502 || code === 504 || code === 1100) {
            clearTimeout(timeout);
            this.ib.off(EventName.connected, onConnected);
            this.ib.off(EventName.error, onError);
            reject(new AppError('IB_CONNECTION_FAILED', `Connection failed: ${err.message}`, {}, code));
          }
        };

        this.ib.on(EventName.connected, onConnected);
        this.ib.on(EventName.error, onError);
        this.ib.connect();
      });

      this._connected = true;
      this._connecting = false;
      this._connectTime = new Date();
      this._reconnectAttempts = 0;

      // Request managed accounts
      this.ib.reqManagedAccts();

      // Start heartbeat
      this._startHeartbeat();

      this.bus.emit('connected', undefined);
      logger.info('Connected to IB Gateway/TWS', {
        host: getConfig().ib.host,
        port: getConfig().ib.port,
        clientId: getConfig().ib.clientId,
      });
    } catch (err) {
      this._connecting = false;
      throw err;
    }
  }

  // ── Disconnect ────────────────────────────────────────────

  async disconnect(): Promise<void> {
    if (!this._connected && !this._connecting) return;

    this._shutdownRequested = true;
    this._stopHeartbeat();
    this._cancelReconnect();

    // Cancel all active subscriptions
    await this._cleanupSubscriptions();

    try {
      this.ib.disconnect();
    } catch {
      // Ignore disconnect errors
    }

    this._connected = false;
    this._connecting = false;
    this._disconnectTime = new Date();
    this.bus.emit('disconnected', undefined);
    logger.info('Disconnected from IB');
  }

  // ── Reconnect ─────────────────────────────────────────────

  async reconnect(): Promise<void> {
    logger.info('Forced reconnect requested');
    await this.disconnect();
    await this.connect();
  }

  // ── Request Queue ─────────────────────────────────────────

  async enqueue<T>(execute: () => Promise<T>): Promise<T> {
    this.ensureConnected();
    
    return new Promise<T>((resolve, reject) => {
      this._queue.push({
        id: uuid(),
        execute: execute as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: Date.now(),
      });
      void this._processQueue();
    });
  }

  /** Execute immediately (no queue) — use for simple, non-pacing-sensitive calls */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.ensureConnected();
    await this._waitForPacing();
    this._recordMessage();
    return fn();
  }

  ensureConnected(): void {
    if (!this._connected) {
      throw new AppError('IB_NOT_CONNECTED', 'Not connected to IB. Call ib_connect first.');
    }
  }

  // ── Private ───────────────────────────────────────────────

  private _setupEventHandlers(): void {
    this.ib.on(EventName.error, (err: Error, code: number, reqId: number) => {
      this._addErrorEntry(code, err.message, reqId);
      this.bus.emit('error', { code, message: err.message, reqId });
      logger.error('IB error', { code, message: err.message, reqId });

      // Connection loss
      if (code === 1100 || code === 1300 || code === 504) {
        this._handleConnectionLoss();
      }
    });

    this.ib.on(EventName.disconnected, () => {
      if (this._connected) {
        this._connected = false;
        this._disconnectTime = new Date();
        this.bus.emit('disconnected', undefined);
        if (!this._shutdownRequested) {
          this._handleConnectionLoss();
        }
      }
    });

    this.ib.on(EventName.managedAccounts, (accountsList: string) => {
      this._managedAccounts = accountsList.split(',').map((a) => a.trim()).filter(Boolean);
      const config = getConfig();
      if (config.ib.accountId) {
        this._defaultAccount = config.ib.accountId;
      } else if (this._managedAccounts.length > 0) {
        this._defaultAccount = this._managedAccounts[0]!;
        if (this._managedAccounts.length > 1) {
          logger.warn('Multiple managed accounts found, using first one', {
            accounts: this._managedAccounts,
            selected: this._defaultAccount,
          });
        }
      }
      logger.info('Managed accounts received', { accounts: this._managedAccounts, default: this._defaultAccount });
    });
  }

  private _handleConnectionLoss(): void {
    if (this._shutdownRequested) return;

    this._connected = false;
    this._stopHeartbeat();

    const config = getConfig().reconnect;
    if (this._reconnectAttempts >= config.maxAttempts) {
      logger.error('Max reconnect attempts reached', { attempts: this._reconnectAttempts });
      return;
    }

    this._reconnectAttempts++;
    const delay = this._computeBackoff();
    logger.info('Scheduling reconnect', { attempt: this._reconnectAttempts, delayMs: delay });
    this.bus.emit('reconnecting', { attempt: this._reconnectAttempts });

    this._reconnectTimer = setTimeout(() => {
      void (async () => {
        try {
          await this.connect();
          this._lastReconnectTime = new Date();
          if (getConfig().reconnect.resumeSubscriptions) {
            logger.info('Subscription resume would happen here');
          }
        } catch (err) {
          logger.error('Reconnect failed', {
            attempt: this._reconnectAttempts,
            error: err instanceof Error ? err.message : String(err),
          });
          this._handleConnectionLoss();
        }
      })();
    }, delay);
  }

  private _computeBackoff(): number {
    const cfg = getConfig().reconnect;
    const base = cfg.initialDelayMs * Math.pow(cfg.backoffFactor, this._reconnectAttempts - 1);
    const capped = Math.min(base, cfg.maxDelayMs);
    const jitter = capped * cfg.jitterFraction * (Math.random() * 2 - 1);
    return Math.max(0, capped + jitter);
  }

  private _startHeartbeat(): void {
    this._heartbeatTimer = setInterval(() => {
      if (!this._connected) return;
      try {
        this.ib.reqCurrentTime();
      } catch {
        logger.warn('Heartbeat failed');
        this._handleConnectionLoss();
      }
    }, 30000);
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private _cancelReconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  private async _cleanupSubscriptions(): Promise<void> {
    const subs = Array.from(this._activeSubscriptions.entries());
    for (const [subId, sub] of subs) {
      try {
        switch (sub.type) {
          case 'market_data':
            this.ib.cancelMktData(sub.reqId);
            break;
          case 'market_depth':
            this.ib.cancelMktDepth(sub.reqId, false);
            break;
          case 'realtime_bars':
            this.ib.cancelRealTimeBars(sub.reqId);
            break;
          case 'tick_by_tick':
            this.ib.cancelTickByTickData(sub.reqId);
            break;
          case 'scanner':
            this.ib.cancelScannerSubscription(sub.reqId);
            break;
          case 'news_bulletins':
            this.ib.cancelNewsBulletins();
            break;
          case 'account_updates':
            this.ib.reqAccountUpdates(false, '');
            break;
          case 'pnl':
            this.ib.cancelPnL(sub.reqId);
            break;
          case 'pnl_single':
            this.ib.cancelPnLSingle(sub.reqId);
            break;
        }
      } catch {
        // Best effort cleanup
      }
      this._activeSubscriptions.delete(subId);
    }
    logger.info('Cleaned up subscriptions', { count: subs.length });
  }

  // ── Pacing ────────────────────────────────────────────────

  private _recordMessage(): void {
    this._messageTimestamps.push(Date.now());
    // Keep only last second of timestamps
    const cutoff = Date.now() - 1000;
    this._messageTimestamps = this._messageTimestamps.filter((t) => t > cutoff);
  }

  private async _waitForPacing(): Promise<void> {
    while (this._messageTimestamps.length >= this._maxMessagesPerSecond) {
      const oldest = this._messageTimestamps[0]!;
      const waitMs = 1000 - (Date.now() - oldest) + 10;
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
      const cutoff = Date.now() - 1000;
      this._messageTimestamps = this._messageTimestamps.filter((t) => t > cutoff);
    }
  }

  private async _processQueue(): Promise<void> {
    if (this._activeRequests >= this._maxConcurrency || this._queue.length === 0) return;

    const item = this._queue.shift()!;
    this._activeRequests++;

    try {
      await this._waitForPacing();
      this._recordMessage();
      const result = await item.execute();
      item.resolve(result);
    } catch (err) {
      item.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this._activeRequests--;
      // Process next in queue
      if (this._queue.length > 0) {
        setImmediate(() => void this._processQueue());
      }
    }
  }

  private _addErrorEntry(code: number, message: string, reqId?: number): void {
    this._errorLog.push({
      timestamp: new Date().toISOString(),
      code,
      message,
      reqId,
    });
    if (this._errorLog.length > this._errorLogMaxSize) {
      this._errorLog.shift();
    }
  }

  // ── Shutdown ──────────────────────────────────────────────

  async shutdown(): Promise<void> {
    logger.info('Shutdown sequence initiated');
    this._shutdownRequested = true;

    // 1. Drain queue — reject pending
    while (this._queue.length > 0) {
      const item = this._queue.shift()!;
      item.reject(new AppError('IB_NOT_CONNECTED', 'Server shutting down'));
    }

    // 2. Disconnect (cleans up subscriptions)
    await this.disconnect();

    // 3. Remove all listeners
    this.bus.removeAllListeners();

    logger.info('Shutdown complete');
  }
}

// Singleton
let _instance: IBConnection | null = null;

export function getConnection(): IBConnection {
  if (!_instance) {
    _instance = new IBConnection();
  }
  return _instance;
}

export function resetConnection(): void {
  _instance = null;
}
