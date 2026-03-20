/**
 * Content-loading integration tests.
 *
 * Reads every JSON file referenced in the manifest and validates
 * the structural shape expected by the game's types. These tests run
 * on the *raw* file system, so they catch broken JSON, missing required
 * fields, and typos without a browser or Phaser.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CONTENT_ROOT = resolve(__dirname, '../public/content');

function readContent<T>(rel: string): T {
  const raw = readFileSync(resolve(CONTENT_ROOT, rel), 'utf-8');
  return JSON.parse(raw) as T;
}

// ── manifest ──────────────────────────────────────────────────────────────────
describe('content/manifest.json', () => {
  it('parses as valid JSON', () => {
    const m = readContent<{ items: string[]; enemies: string[]; weapons?: string[] }>('manifest.json');
    expect(Array.isArray(m.items)).toBe(true);
    expect(Array.isArray(m.enemies)).toBe(true);
  });
});

// ── weapons ───────────────────────────────────────────────────────────────────
describe('weapons', () => {
  const manifest = readContent<{ weapons?: string[] }>('manifest.json');
  const weaponPaths = manifest.weapons ?? [];

  it.each(weaponPaths)('%s — required fields present', (rel: string) => {
    const w = readContent<Record<string, unknown>>(rel);
    expect(typeof w['weaponId'],  `${rel}: weaponId missing`).toBe('string');
    expect(typeof w['name'],      `${rel}: name missing`).toBe('string');
    expect(typeof w['type'],      `${rel}: type missing`).toBe('string');
    expect(typeof w['staminaCost'], `${rel}: staminaCost missing`).toBe('number');
    expect(typeof w['cooldownMs'], `${rel}: cooldownMs missing`).toBe('number');
  });

  it('foxfire-wand has spread-shot config', () => {
    const w = readContent<{
      projectile?: { projectileCount?: number; spreadAngle?: number }
    }>('weapons/foxfire-wand.json');
    expect(w.projectile?.projectileCount).toBeGreaterThan(1);
    expect(w.projectile?.spreadAngle).toBeGreaterThan(0);
  });
});

// ── enemies ───────────────────────────────────────────────────────────────────
// Raw enemy JSON uses "id" (normalised to "enemyId" by ContentLoader),
// "attackDamage" (normalised to "damage"), "behaviour" (normalised to "behaviourId").
describe('enemies', () => {
  const manifest = readContent<{ enemies: string[] }>('manifest.json');

  it.each(manifest.enemies)('%s — required fields present', (rel: string) => {
    const e = readContent<Record<string, unknown>>(rel);
    // Either short "id" or long "enemyId" must exist
    const id = e['enemyId'] ?? e['id'];
    expect(id, `${rel}: id/enemyId missing`).toBeDefined();
    expect(typeof e['name'], `${rel}: name missing`).toBe('string');
    expect(typeof e['hp'],   `${rel}: hp must be number`).toBe('number');
    expect((e['hp'] as number), `${rel}: hp must be positive`).toBeGreaterThan(0);
    expect(typeof e['speed'], `${rel}: speed must be number`).toBe('number');
    // "behaviour" or "behaviourId" must exist
    const beh = e['behaviourId'] ?? e['behaviour'];
    expect(beh, `${rel}: behaviour/behaviourId missing`).toBeDefined();
  });
});

// ── chips ─────────────────────────────────────────────────────────────────────
// Raw chip JSON uses "id" (normalised to "chipId" by ContentLoader).
describe('chips', () => {
  const manifest = readContent<{ chips: string[] }>('manifest.json');

  it.each(manifest.chips)('%s — required fields present', (rel: string) => {
    const c = readContent<Record<string, unknown>>(rel);
    const id = c['chipId'] ?? c['id'];
    expect(id, `${rel}: id/chipId missing`).toBeDefined();
    expect(typeof c['name'], `${rel}: name`).toBe('string');
    expect(['grey','green','gold','red']).toContain(c['tier'] as string);
  });
});

// ── animals ───────────────────────────────────────────────────────────────────
// Raw animal JSON uses "id" (normalised to "animalId"), "baseStats.maxHp" (→ hp),
// "baseStats.attackPower" (→ damage).
describe('animals', () => {
  const manifest = readContent<{ animals: string[] }>('manifest.json');

  it.each(manifest.animals)('%s — required baseStats fields present', (rel: string) => {
    const a = readContent<{ id?: string; animalId?: string; baseStats?: Record<string, unknown> }>(rel);
    const id = a.animalId ?? a.id;
    expect(id, `${rel}: id/animalId missing`).toBeDefined();
    expect(a.baseStats, `${rel}: baseStats missing`).toBeDefined();
    // Must have at least a speed stat; hp may be "maxHp" before normalisation
    const hp = a.baseStats?.['hp'] ?? a.baseStats?.['maxHp'];
    expect(hp, `${rel}: baseStats.hp/maxHp missing`).toBeDefined();
    expect(typeof a.baseStats?.['speed'], `${rel}: baseStats.speed`).toBe('number');
  });
});

// ── items ─────────────────────────────────────────────────────────────────────
// Raw item JSON uses "id" (normalised to "itemId" by ContentLoader).
describe('items', () => {
  const manifest = readContent<{ items: string[] }>('manifest.json');

  it.each(manifest.items)('%s — required fields present', (rel: string) => {
    const item = readContent<Record<string, unknown>>(rel);
    const id = item['itemId'] ?? item['id'];
    expect(id, `${rel}: id/itemId missing`).toBeDefined();
    expect(typeof item['name'], `${rel}: name`).toBe('string');
    expect(typeof item['cost'], `${rel}: cost`).toBe('number');
  });
});

// ── achievements ──────────────────────────────────────────────────────────────
describe('achievements.json', () => {
  it('parses as object with achievements array containing required fields', () => {
    const manifest = readContent<{ achievements?: string }>('manifest.json');
    if (!manifest.achievements) return; // optional

    const wrapper = readContent<{ achievements?: Array<Record<string, unknown>> }>(manifest.achievements);
    const list = wrapper.achievements ?? (wrapper as unknown as Array<Record<string, unknown>>);
    expect(Array.isArray(list)).toBe(true);
    (list as Array<Record<string, unknown>>).forEach((a, i) => {
      expect(typeof a['id'],   `achievement[${i}]: id`).toBe('string');
      expect(typeof a['name'], `achievement[${i}]: name`).toBe('string');
    });
  });
});
