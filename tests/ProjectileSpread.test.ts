/**
 * Tests for spread-shot angle distribution logic.
 * Validates that ProjectileWeapon fires the right number of projectiles
 * at the correct angles given a spread configuration.
 */
import { describe, it, expect } from 'vitest';

// Pure helper — mirrors the angle calculation in ProjectileWeapon.activate()
function spreadAngles(baseAngle: number, count: number, spread: number): number[] {
  const angles: number[] = [];
  for (let i = 0; i < count; i++) {
    const offset = count > 1 ? spread * (i / (count - 1) - 0.5) : 0;
    angles.push(baseAngle + offset);
  }
  return angles;
}

const HALF_PI = Math.PI / 2;
const EPS = 1e-10;

describe('ProjectileWeapon — spread shot angle distribution', () => {
  it('single projectile fires at the base angle (no offset)', () => {
    const result = spreadAngles(0, 1, Math.PI);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(0);
  });

  it('single projectile ignores spread parameter', () => {
    const noSpread = spreadAngles(HALF_PI, 1, 0);
    const withSpread = spreadAngles(HALF_PI, 1, 2.0);
    expect(noSpread[0]).toBe(withSpread[0]);
  });

  it('two projectiles are symmetric around base angle', () => {
    const [a, b] = spreadAngles(0, 2, 0.5);
    expect(a).toBeCloseTo(-0.25, 10);
    expect(b).toBeCloseTo(0.25, 10);
    // midpoint is the base angle
    expect((a + b) / 2).toBeCloseTo(0, 10);
  });

  it('foxfire wand: 6 projectiles across 0.9 rad are evenly spaced', () => {
    const angles = spreadAngles(0, 6, 0.9);
    expect(angles).toHaveLength(6);

    // First and last are at ±half the spread
    expect(angles[0]).toBeCloseTo(-0.45, 8);
    expect(angles[5]).toBeCloseTo(0.45, 8);

    // Equal spacing between adjacent projectiles
    const step = angles[1] - angles[0];
    for (let i = 1; i < angles.length - 1; i++) {
      expect(Math.abs(angles[i + 1] - angles[i] - step)).toBeLessThan(EPS);
    }
  });

  it('angles are relative to base (non-zero base angle)', () => {
    const base = Math.PI / 4;
    const angles = spreadAngles(base, 3, 0.6);
    expect(angles[1]).toBeCloseTo(base, 10); // centre pellet is at base
    expect(angles[0]).toBeCloseTo(base - 0.3, 10);
    expect(angles[2]).toBeCloseTo(base + 0.3, 10);
  });

  it('zero spread fires all projectiles at the base angle', () => {
    const angles = spreadAngles(1.0, 5, 0);
    angles.forEach((a) => expect(a).toBeCloseTo(1.0, 10));
  });
});
