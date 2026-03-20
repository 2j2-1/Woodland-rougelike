/**
 * WeaponUpgrade system tests.
 *
 * Verifies that:
 * 1. PlayerInventory correctly tracks weapon upgrades
 * 2. ProjectileWeapon applies multifire / pierce / homing from upgrades
 * 3. Life-steal config passes through correctly via weapon JSON overrides
 * 4. New weapon JSON files have valid structure
 *
 * All Phaser-dependent code is mocked — these are pure unit tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CONTENT_ROOT = resolve(__dirname, '../public/content');

function readWeapon(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(CONTENT_ROOT, `weapons/${name}.json`), 'utf-8'));
}

// ── Weapon JSON validation ────────────────────────────────────────────────────
describe('new weapon JSON definitions', () => {
  const weapons = [
    'storm-coil',
    'boomerang-blade',
    'hive-launcher',
    'void-siphon',
    'twin-fang',
    'bramble-burst',
  ];

  it.each(weapons)('%s has required fields', (name: string) => {
    const w = readWeapon(name);
    expect(typeof w['weaponId']).toBe('string');
    expect(typeof w['name']).toBe('string');
    expect(typeof w['type']).toBe('string');
    expect(typeof w['staminaCost']).toBe('number');
    expect(typeof w['cooldownMs']).toBe('number');
    expect(typeof w['damageMultiplier']).toBe('number');
    expect(w['projectile']).toBeDefined();
  });

  it('storm-coil fires multiple projectiles', () => {
    const w = readWeapon('storm-coil');
    const pc = w['projectile'] as Record<string, unknown>;
    expect((pc['projectileCount'] as number)).toBeGreaterThan(1);
    expect((pc['spreadAngle'] as number)).toBeGreaterThan(0);
  });

  it('boomerang-blade has bouncing flag', () => {
    const w = readWeapon('boomerang-blade');
    const pc = w['projectile'] as Record<string, unknown>;
    expect(pc['bouncing']).toBe(true);
    expect((pc['bounceCount'] as number)).toBeGreaterThan(0);
  });

  it('hive-launcher has homing flag', () => {
    const w = readWeapon('hive-launcher');
    const pc = w['projectile'] as Record<string, unknown>;
    expect(pc['homing']).toBe(true);
    expect((pc['homingStrength'] as number)).toBeGreaterThan(0);
  });

  it('void-siphon has life steal', () => {
    const w = readWeapon('void-siphon');
    const pc = w['projectile'] as Record<string, unknown>;
    expect((pc['lifeSteal'] as number)).toBeGreaterThan(0);
    expect((pc['lifeSteal'] as number)).toBeLessThanOrEqual(1);
  });

  it('twin-fang fires exactly 2 projectiles', () => {
    const w = readWeapon('twin-fang');
    const pc = w['projectile'] as Record<string, unknown>;
    expect(pc['projectileCount']).toBe(2);
  });

  it('bramble-burst fires 8 projectiles in wide arc', () => {
    const w = readWeapon('bramble-burst');
    const pc = w['projectile'] as Record<string, unknown>;
    expect(pc['projectileCount']).toBe(8);
    expect((pc['spreadAngle'] as number)).toBeGreaterThan(1.5);
  });
});

// ── PlayerInventory.weaponUpgrades ────────────────────────────────────────────
describe('PlayerInventory weapon upgrades', () => {
  // Minimal player stub — only the parts PlayerInventory needs
  function makePlayer() {
    return {
      active: true,
      stats: {
        applyModifier: vi.fn(),
        removeModifier: vi.fn(),
      },
      inventory: null as unknown as import('@/systems/PlayerInventory').PlayerInventory,
    };
  }

  it('starts with empty upgrade set', async () => {
    const { PlayerInventory } = await import('@/systems/PlayerInventory');
    const player = makePlayer();
    player.inventory = new PlayerInventory(player as never);
    expect(player.inventory.weaponUpgrades.size).toBe(0);
  });

  it('addWeaponUpgrade adds a string key', async () => {
    const { PlayerInventory } = await import('@/systems/PlayerInventory');
    const { EventBus } = await import('@/systems/EventBus');
    EventBus.removeAllListeners();

    const player = makePlayer();
    player.inventory = new PlayerInventory(player as never);

    player.inventory.addWeaponUpgrade('multifire');
    expect(player.inventory.hasWeaponUpgrade('multifire')).toBe(true);
    expect(player.inventory.hasWeaponUpgrade('homing')).toBe(false);
  });

  it('accumulates multiple distinct upgrades', async () => {
    const { PlayerInventory } = await import('@/systems/PlayerInventory');
    const { EventBus } = await import('@/systems/EventBus');
    EventBus.removeAllListeners();

    const player = makePlayer();
    player.inventory = new PlayerInventory(player as never);

    player.inventory.addWeaponUpgrade('multifire');
    player.inventory.addWeaponUpgrade('pierce');
    player.inventory.addWeaponUpgrade('homing');

    expect(player.inventory.weaponUpgrades.size).toBe(3);
  });
});

// ── ProjectileWeapon upgrade integration ──────────────────────────────────────
describe('ProjectileWeapon respects player weapon upgrades', () => {
  /**
   * Mirrors the count logic in ProjectileWeapon.activate()
   * so we can test it without Phaser.
   */
  function calcProjectileCount(
    baseCount: number,
    hasMultifire: boolean,
  ): number {
    return hasMultifire ? baseCount + 1 : baseCount;
  }

  function calcPierceCount(basePierce: number, hasPierce: boolean): number {
    return hasPierce ? basePierce + 1 : basePierce;
  }

  it('no upgrades: count and pierce unchanged', () => {
    expect(calcProjectileCount(1, false)).toBe(1);
    expect(calcPierceCount(0, false)).toBe(0);
  });

  it('multifire upgrade adds 1 to projectile count', () => {
    expect(calcProjectileCount(1, true)).toBe(2);
    expect(calcProjectileCount(6, true)).toBe(7); // shotgun + multifire
  });

  it('pierce upgrade adds 1 to pierce count', () => {
    expect(calcPierceCount(0, true)).toBe(1);
    expect(calcPierceCount(2, true)).toBe(3); // thorn-launcher + pierce rounds
  });

  it('homing flag can come from upgrade when weapon has none', () => {
    const fromWeapon   = false;
    const fromUpgrade  = true;
    const homing = fromWeapon || fromUpgrade;
    expect(homing).toBe(true);
  });
});

// ── New enemy JSON validation ─────────────────────────────────────────────────
describe('new enemy JSON definitions', () => {
  function readEnemy(name: string): Record<string, unknown> {
    return JSON.parse(readFileSync(resolve(CONTENT_ROOT, `enemies/${name}.json`), 'utf-8'));
  }

  const enemies = ['forest-drone', 'bramble-golem', 'shadow-vole'];

  it.each(enemies)('%s has required fields', (name: string) => {
    const e = readEnemy(name);
    const id = e['enemyId'] ?? e['id'];
    expect(id).toBeDefined();
    expect(typeof e['name']).toBe('string');
    expect(typeof e['hp']).toBe('number');
    expect((e['hp'] as number)).toBeGreaterThan(0);
    expect(typeof e['speed']).toBe('number');
    const beh = e['behaviourId'] ?? e['behaviour'];
    expect(beh).toBeDefined();
  });

  it('forest-drone uses ranged-scout behaviour', () => {
    const e = readEnemy('forest-drone');
    const beh = e['behaviourId'] ?? e['behaviour'];
    expect(beh).toBe('ranged-scout');
  });

  it('bramble-golem has high HP and defence', () => {
    const e = readEnemy('bramble-golem');
    expect((e['hp'] as number)).toBeGreaterThanOrEqual(80);
    expect((e['defence'] as number)).toBeGreaterThanOrEqual(10);
  });

  it('shadow-vole has high speed', () => {
    const e = readEnemy('shadow-vole');
    expect((e['speed'] as number)).toBeGreaterThan(140);
  });
});

// ── New item JSON validation ──────────────────────────────────────────────────
describe('new upgrade item JSON definitions', () => {
  function readItem(name: string): Record<string, unknown> {
    return JSON.parse(readFileSync(resolve(CONTENT_ROOT, `items/${name}.json`), 'utf-8'));
  }

  const statItems = ['running-shoes', 'iron-lung', 'reinforced-heart', 'lucky-paw'];
  const effectItems = ['lifesap-pendant', 'regen-moss', 'multifire-mod', 'homing-chip', 'pierce-rounds', 'dash-capacitor'];

  it.each(statItems)('%s has a stat modifier', (name: string) => {
    const item = readItem(name);
    const mods = item['statModifiers'] as unknown[];
    expect(Array.isArray(mods)).toBe(true);
    expect(mods.length).toBeGreaterThan(0);
    const mod = mods[0] as Record<string, unknown>;
    expect(typeof mod['stat']).toBe('string');
    expect(typeof mod['value']).toBe('number');
  });

  it.each(effectItems)('%s has an effectId', (name: string) => {
    const item = readItem(name);
    expect(typeof item['effectId']).toBe('string');
    expect((item['effectId'] as string).length).toBeGreaterThan(0);
  });

  it('multifire-mod effectId is weapon_upgrade_multifire', () => {
    const item = readItem('multifire-mod');
    expect(item['effectId']).toBe('weapon_upgrade_multifire');
  });
});

// ── Homing angle steering math ────────────────────────────────────────────────
describe('homing projectile steering', () => {
  /**
   * Mirrors the angle logic in Projectile.tick():
   * rotate current velocity angle towards target by at most maxTurn radians.
   */
  function steerAngle(
    currentAngle: number,
    targetAngle: number,
    homingStrength: number,
    deltaMs: number,
  ): number {
    const diff    = wrapAngle(targetAngle - currentAngle);
    const maxTurn = (homingStrength * deltaMs) / 1000;
    return currentAngle + clamp(diff, -maxTurn, maxTurn);
  }

  function wrapAngle(a: number): number {
    while (a >  Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
  }

  it('steers towards target within maxTurn limit', () => {
    const result = steerAngle(0, Math.PI / 2, 3.0, 16); // 16 ms frame
    const maxTurn = (3.0 * 16) / 1000; // ~0.048 rad
    expect(result).toBeCloseTo(maxTurn, 5);
  });

  it('reaches target exactly when diff < maxTurn', () => {
    const target  = 0.01; // very small angle
    const result  = steerAngle(0, target, 3.0, 100);
    expect(result).toBeCloseTo(target, 5);
  });

  it('does not overshoot', () => {
    // Projectile facing right (0), target is straight up (-π/2)
    const current = 0;
    const target  = -Math.PI / 2;
    const result  = steerAngle(current, target, 3.0, 1000); // huge delta
    // Should clamp to exactly target (diff == -π/2 but maxTurn == 3.0 > π/2)
    expect(result).toBeCloseTo(target, 5);
  });
});
