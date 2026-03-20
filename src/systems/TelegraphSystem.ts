import Phaser from 'phaser';

export type TelegraphShape = 'circle' | 'cone' | 'line' | 'ground_zone';

export interface TelegraphOptions {
  shape:       TelegraphShape;
  x:           number;
  y:           number;
  /** Ring/zone radius (circle, ground_zone) */
  radius?:     number;
  /** Cone/line angle in radians */
  angle?:      number;
  /** Half-arc of cone in radians */
  arc?:        number;
  /** Line length */
  length?:     number;
  /** Line half-width */
  width?:      number;
  /** Warning duration (ms) */
  duration:    number;
  colour?:     number;
}

const DEPTH = 60;

export class TelegraphSystem {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Create a warning telegraph that auto-destroys after options.duration ms */
  show(opts: TelegraphOptions): void {
    const g     = this.scene.add.graphics().setDepth(DEPTH);
    const col   = opts.colour ?? 0xff3300;
    const alpha = 0.35;

    g.fillStyle(col, alpha);
    g.lineStyle(2, col, 0.8);

    switch (opts.shape) {
      case 'circle':
      case 'ground_zone': {
        const r = opts.radius ?? 60;
        g.strokeCircle(opts.x, opts.y, r);
        break;
      }
      case 'cone': {
        const angle  = opts.angle ?? 0;
        const arc    = opts.arc   ?? Math.PI / 4;
        const length = opts.length ?? 150;
        g.beginPath();
        g.moveTo(opts.x, opts.y);
        g.arc(opts.x, opts.y, length, angle - arc, angle + arc, false, 0.05);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      }
      case 'line': {
        const hw     = (opts.width ?? 20) / 2;
        const length = opts.length ?? 200;
        const a      = opts.angle ?? 0;
        const ex     = opts.x + Math.cos(a) * length;
        const ey     = opts.y + Math.sin(a) * length;
        g.fillRect(
          Math.min(opts.x, ex) - hw,
          Math.min(opts.y, ey) - hw,
          Math.abs(ex - opts.x) + hw * 2,
          Math.abs(ey - opts.y) + hw * 2,
        );
        break;
      }
    }

    // Pulse alpha tween, then destroy
    this.scene.tweens.add({
      targets: g, alpha: { from: 1, to: 0.2 },
      yoyo: true, repeat: -1, duration: opts.duration / 4, ease: 'Sine.easeInOut',
    });
    this.scene.time.delayedCall(opts.duration, () => g.destroy());
  }
}
