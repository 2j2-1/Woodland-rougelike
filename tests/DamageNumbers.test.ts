/**
 * DamageNumbers — pool management tests.
 *
 * We mock the Phaser scene's add.text() to return minimal stub objects
 * so we can verify pool logic without a browser.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DamageNumbers } from '@/effects/DamageNumbers';

// ── minimal Phaser text stub ──────────────────────────────────────────────────
function makeTextStub() {
  return {
    _text: '',
    _color: '',
    x: 0,
    y: 0,
    alpha: 1,
    _scale: 1,
    _visible: false,
    setText(t: string)    { this._text = t; return this; },
    setColor(c: string)   { this._color = c; return this; },
    setPosition(px: number, py: number) { this.x = px; this.y = py; return this; },
    setAlpha(a: number)   { this.alpha = a; return this; },
    setScale(s: number)   { this._scale = s; return this; },
    setVisible(v: boolean){ this._visible = v; return this; },
    setDepth()            { return this; },
  };
}

function makeMockScene() {
  return {
    add: {
      text: vi.fn().mockImplementation(() => makeTextStub()),
    },
    time: {
      delayedCall: vi.fn(),
    },
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('DamageNumbers', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dn: DamageNumbers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockScene: ReturnType<typeof makeMockScene>;

  beforeEach(() => {
    mockScene = makeMockScene();
    dn = new DamageNumbers(mockScene as never);
  });

  it('creates a pool of text objects on construction', () => {
    // Pool size is 40 (POOL_SIZE constant in DamageNumbers.ts)
    expect(mockScene.add.text).toHaveBeenCalledTimes(40);
  });

  it('activates a label on spawn()', () => {
    dn.spawn(100, 200, 15);
    // First text stub should now be visible
    const firstLabel = (mockScene.add.text as ReturnType<typeof vi.fn>).mock.results[0].value as ReturnType<typeof makeTextStub>;
    expect(firstLabel._visible).toBe(true);
    expect(firstLabel._text).toBe('-15');
  });

  it('uses green colour and + prefix for heal type', () => {
    dn.spawn(0, 0, 20, 'heal');
    const firstLabel = (mockScene.add.text as ReturnType<typeof vi.fn>).mock.results[0].value as ReturnType<typeof makeTextStub>;
    expect(firstLabel._text).toBe('+20');
    expect(firstLabel._color).toMatch(/#55ff88/i);
  });

  it('uses yellow colour for electric dmg', () => {
    dn.spawn(0, 0, 10, 'electric');
    const firstLabel = (mockScene.add.text as ReturnType<typeof vi.fn>).mock.results[0].value as ReturnType<typeof makeTextStub>;
    expect(firstLabel._color).toMatch(/#ffee44/i);
  });

  it('uses red colour for fire dmg', () => {
    dn.spawn(0, 0, 10, 'fire');
    const firstLabel = (mockScene.add.text as ReturnType<typeof vi.fn>).mock.results[0].value as ReturnType<typeof makeTextStub>;
    expect(firstLabel._color).toMatch(/#ff6622/i);
  });

  it('label becomes invisible after lifetime expires', () => {
    dn.spawn(50, 50, 5);
    const firstLabel = (mockScene.add.text as ReturnType<typeof vi.fn>).mock.results[0].value as ReturnType<typeof makeTextStub>;
    // Expire the label by advancing more than LIFETIME (900 ms)
    dn.update(1000);
    expect(firstLabel._visible).toBe(false);
  });

  it('reuses expired pool slots for subsequent spawns', () => {
    // Fill the pool completely
    const POOL_SIZE = 40;
    for (let i = 0; i < POOL_SIZE; i++) dn.spawn(i, i, i + 1);

    // Expire all by updating past lifetime
    dn.update(2000);

    // Now spawn one more — should NOT warn about pool exhaustion
    const warnSpy = vi.spyOn(console, 'warn');
    dn.spawn(0, 0, 1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does nothing when pool is exhausted (no throw)', () => {
    const POOL_SIZE = 40;
    for (let i = 0; i < POOL_SIZE + 5; i++) {
      expect(() => dn.spawn(i, i, 1)).not.toThrow();
    }
  });
});
