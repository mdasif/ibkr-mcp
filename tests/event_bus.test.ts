/**
 * Tests for event bus — typed pub/sub.
 */
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/connection/event_bus';

describe('EventBus', () => {
  it('emits and receives events', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('connected', handler);
    bus.emit('connected');

    expect(handler).toHaveBeenCalledOnce();
  });

  it('passes arguments to handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('error', handler);
    bus.emit('error', { code: 502, message: 'Not connected', reqId: 1 });

    expect(handler).toHaveBeenCalledWith({ code: 502, message: 'Not connected', reqId: 1 });
  });

  it('supports multiple listeners', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('tick', h1);
    bus.on('tick', h2);
    bus.emit('tick', 1, 'AAPL', 1, 155.5);

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('removes listeners', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('disconnected', handler);
    bus.off('disconnected', handler);
    bus.emit('disconnected');

    expect(handler).not.toHaveBeenCalled();
  });

  it('once fires only once', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.once('connected', handler);
    bus.emit('connected');
    bus.emit('connected');

    expect(handler).toHaveBeenCalledOnce();
  });
});
