import { describe, it, expect, vi, beforeEach } from 'vitest';

// EventBus uses `Phaser.Events.EventEmitter` — mocked via alias in vitest.config.ts
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

describe('EventBus', () => {
  beforeEach(() => {
    // Remove all listeners between tests to avoid bleed
    EventBus.removeAllListeners();
  });

  it('emits events to registered listeners', () => {
    const handler = vi.fn();
    EventBus.on(GameEvents.ENEMY_SPAWNED, handler);
    EventBus.emit(GameEvents.ENEMY_SPAWNED, { enemyId: 'test', x: 0, y: 0 });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ enemyId: 'test', x: 0, y: 0 });
  });

  it('does not call listeners after off()', () => {
    const handler = vi.fn();
    EventBus.on(GameEvents.ENEMY_DIED, handler);
    EventBus.off(GameEvents.ENEMY_DIED, handler);
    EventBus.emit(GameEvents.ENEMY_DIED, { enemy: {}, def: {} });
    expect(handler).not.toHaveBeenCalled();
  });

  it('once() fires exactly once', () => {
    const handler = vi.fn();
    EventBus.once(GameEvents.ROOM_CLEARED, handler);
    EventBus.emit(GameEvents.ROOM_CLEARED, { blacksmithCounter: 1 });
    EventBus.emit(GameEvents.ROOM_CLEARED, { blacksmithCounter: 2 });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('multiple listeners all receive the same event', () => {
    const a = vi.fn();
    const b = vi.fn();
    EventBus.on(GameEvents.PLAYER_DAMAGED, a);
    EventBus.on(GameEvents.PLAYER_DAMAGED, b);
    EventBus.emit(GameEvents.PLAYER_DAMAGED, { hp: 50, maxHp: 100, amount: 10 });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('emitting with no listeners does not throw', () => {
    expect(() => EventBus.emit(GameEvents.RUN_STARTED, {} as never)).not.toThrow();
  });

  it('preserves event payload data types', () => {
    let received: unknown;
    EventBus.on(GameEvents.PLAYER_STAMINA_CHANGED, (d: unknown) => { received = d; });
    const payload = { stamina: 75.5, maxStamina: 100 };
    EventBus.emit(GameEvents.PLAYER_STAMINA_CHANGED, payload);
    expect(received).toEqual(payload);
  });
});
