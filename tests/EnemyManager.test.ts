/**
 * EnemyManager — alive-tracking tests.
 *
 * Mocks Phaser physics and the Enemy class so we can exercise
 * the pure bookkeeping logic (alive Set, getAliveCount, etc.)
 * without a running Phaser world.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnemyManager } from '@/systems/EnemyManager';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

// ── Enemy stub ────────────────────────────────────────────────────────────────
function makeEnemy(id: string) {
  return { enemyId: id, active: true } as unknown as import('@/entities/Enemy').Enemy;
}

// ── Scene / Group stub ────────────────────────────────────────────────────────
function makeScene() {
  // EnemyManager.spawnEnemy() calls EnemyRegistry.get() then new Enemy(...).
  // We mock EnemyRegistry so spawnEnemy creates stub enemies.
  return {
    time: { delayedCall: vi.fn() },
    tweens: { add: vi.fn() },
    add: { particles: vi.fn(() => ({ explode: vi.fn(), destroy: vi.fn(), active: true })) },
    physics: { add: { existing: vi.fn() }, world: { setBounds: vi.fn() } },
    textures: { exists: vi.fn(() => false) },
  };
}

function makeGroup() {
  return {
    add: vi.fn(),
    remove: vi.fn(),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('EnemyManager', () => {
  let manager: EnemyManager;

  beforeEach(() => {
    // Clear EventBus listeners
    EventBus.removeAllListeners();

    // We directly manipulate `alive` via ENEMY_DIED events rather than
    // going through spawnEnemy (which needs real Phaser).
    manager = new EnemyManager(makeScene() as never, makeGroup() as never, {
      animalId: 'bunny', actNumber: 1, roomsCleared: 0, enemiesKilled: 0,
      scrapsEarned: 0, chipsCollected: 0, heldItemIds: [], seenItemIds: [],
      appliedChipIds: [], startTime: Date.now(), isActive: true,
    });
  });

  it('starts with 0 alive enemies', () => {
    expect(manager.getAliveCount()).toBe(0);
  });

  it('getAlive() returns empty set initially', () => {
    expect(manager.getAlive().size).toBe(0);
  });

  it('ENEMY_DIED event decrements alive count', () => {
    // Directly add to alive set via the internal exposed method
    const enemy = makeEnemy('robo-pheasant-mk1');
    manager.getAlive().add(enemy);
    expect(manager.getAliveCount()).toBe(1);

    EventBus.emit(GameEvents.ENEMY_DIED, { enemy, def: {} });
    expect(manager.getAliveCount()).toBe(0);
  });

  it('ENEMY_DIED increments runState enemiesKilled', () => {
    const runState = {
      animalId: 'bunny', actNumber: 1, roomsCleared: 0, enemiesKilled: 0,
      scrapsEarned: 0, chipsCollected: 0, heldItemIds: [], seenItemIds: [],
      appliedChipIds: [], startTime: Date.now(), isActive: true,
    };
    EventBus.removeAllListeners();
    const mgr = new EnemyManager(makeScene() as never, makeGroup() as never, runState);
    const enemy = makeEnemy('test');
    mgr.getAlive().add(enemy);
    EventBus.emit(GameEvents.ENEMY_DIED, { enemy, def: {} });
    expect(runState.enemiesKilled).toBe(1);
  });

  it('destroyAll() empties the alive set', () => {
    const e1 = makeEnemy('a');
    const e2 = makeEnemy('b');
    manager.getAlive().add(e1);
    manager.getAlive().add(e2);
    expect(manager.getAliveCount()).toBe(2);
    manager.destroyAll();
    expect(manager.getAliveCount()).toBe(0);
  });

  it('ENEMY_DIED from a non-tracked enemy does not throw', () => {
    const unknown = makeEnemy('ghost');
    expect(() => {
      EventBus.emit(GameEvents.ENEMY_DIED, { enemy: unknown, def: {} });
    }).not.toThrow();
    expect(manager.getAliveCount()).toBe(0);
  });
});
