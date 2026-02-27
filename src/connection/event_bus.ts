/**
 * Typed pub/sub event bus for streaming events from IB.
 */
import { EventEmitter } from 'events';
import type { StreamEvent } from '../schemas/common';

export type EventType =
  | 'tick'
  | 'quote'
  | 'depth'
  | 'bar'
  | 'order_status'
  | 'news_bulletin'
  | 'account_update'
  | 'position_update'
  | 'pnl_update'
  | 'execution'
  | 'error'
  | 'connected'
  | 'disconnected'
  | 'reconnecting';

export interface TypedEventMap {
  tick: StreamEvent;
  quote: StreamEvent;
  depth: StreamEvent;
  bar: StreamEvent;
  order_status: StreamEvent;
  news_bulletin: StreamEvent;
  account_update: StreamEvent;
  position_update: StreamEvent;
  pnl_update: StreamEvent;
  execution: StreamEvent;
  error: { code: number; message: string; reqId?: number };
  connected: void;
  disconnected: void;
  reconnecting: { attempt: number };
}

export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);

    // Prevent Node.js ERR_UNHANDLED_ERROR crash when no external 'error'
    // listener is registered. Errors are already logged in ib_connection.ts;
    // this is a safety net so the process stays alive.
    this.emitter.on('error', () => {
      // intentionally swallowed — handled by ib_connection error handler
    });
  }

  on<K extends keyof TypedEventMap>(event: K, listener: (data: TypedEventMap[K]) => void): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof TypedEventMap>(event: K, listener: (data: TypedEventMap[K]) => void): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  once<K extends keyof TypedEventMap>(event: K, listener: (data: TypedEventMap[K]) => void): void {
    this.emitter.once(event, listener as (...args: unknown[]) => void);
  }

  emit<K extends keyof TypedEventMap>(event: K, data: TypedEventMap[K]): void {
    this.emitter.emit(event, data);
  }

  removeAllListeners(event?: keyof TypedEventMap): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  listenerCount(event: keyof TypedEventMap): number {
    return this.emitter.listenerCount(event);
  }
}

export const eventBus = new EventBus();
