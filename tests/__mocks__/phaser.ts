/**
 * Minimal Phaser stub for testing.
 * Only implements the surface area actually used by the game's non-scene systems.
 */
import { EventEmitter as NodeEventEmitter } from 'events';

// ── Events ────────────────────────────────────────────────────────────────────
class EventEmitter extends NodeEventEmitter {
  // Phaser's EventEmitter omits the second arg to `off` but Node's requires it
  override off(event: string, listener?: (...args: unknown[]) => void): this {
    if (listener) super.off(event, listener);
    else super.removeAllListeners(event);
    return this;
  }
}

// ── Math helpers ──────────────────────────────────────────────────────────────
const Math = {
  Distance: {
    Between: (x1: number, y1: number, x2: number, y2: number) =>
      global.Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
  },
  Angle: {
    Between: (x1: number, y1: number, x2: number, y2: number) =>
      global.Math.atan2(y2 - y1, x2 - x1),
  },
  Clamp: (value: number, min: number, max: number) =>
    global.Math.min(max, global.Math.max(min, value)),
  Between: (min: number, max: number) =>
    global.Math.floor(global.Math.random() * (max - min + 1)) + min,
};

// ── Physics stubs ─────────────────────────────────────────────────────────────
class ArcadeBody {
  velocity = { x: 0, y: 0 };
  x = 0;
  y = 0;
  enable = true;

  setVelocity(vx: number, vy: number) { this.velocity.x = vx; this.velocity.y = vy; return this; }
  setEnable(v: boolean) { this.enable = v; return this; }
  reset(x: number, y: number) { this.x = x; this.y = y; this.velocity.x = 0; this.velocity.y = 0; return this; }
  setCollideWorldBounds() { return this; }
  setDragX() { return this; }
  setDragY() { return this; }
  destroy() { /* no-op */ }
}

class ArcadeSprite {
  x = 0;
  y = 0;
  active = true;
  visible = true;
  alpha = 1;
  scaleX = 1;
  scaleY = 1;
  body: ArcadeBody = new ArcadeBody();

  constructor(_scene: unknown, x = 0, y = 0) { this.x = x; this.y = y; }
  setActive(v: boolean) { this.active = v; return this; }
  setVisible(v: boolean) { this.visible = v; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setScale(sx: number, sy = sx) { this.scaleX = sx; this.scaleY = sy; return this; }
  setTint() { return this; }
  clearTint() { return this; }
  setAlpha(a: number) { this.alpha = a; return this; }
  setFlipX() { return this; }
  destroy() { /* no-op */ }
}

class StaticGroup {}

// ── Keyboard stubs ────────────────────────────────────────────────────────────
const Input = {
  Keyboard: {
    KeyCodes: { W: 87, A: 65, S: 83, D: 68, SPACE: 32 },
    JustDown: () => false,
  },
};

// ── Export as default (mirrors `import Phaser from 'phaser'`) ─────────────────
const Phaser = {
  Events: { EventEmitter },
  Math,
  Physics: {
    Arcade: {
      Sprite: ArcadeSprite,
      StaticGroup,
      Body: ArcadeBody,
    },
  },
  Input,
  GameObjects: {
    Sprite: ArcadeSprite,
    GameObject: class {},
  },
};

export default Phaser;

// Named re-exports for `import { ... } from 'phaser'`
export { EventEmitter, Math, Input };
