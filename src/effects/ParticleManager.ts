import Phaser from 'phaser';

interface ParticleBurst {
  x: number; y: number; colour: number; count: number; speed: number; gravity: boolean;
}

/**
 * Centralised particle effects using Phaser Graphics object pool.
 * Uses primitive rectangles to avoid requiring a texture atlas.
 */
export class ParticleManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** General-purpose particle burst */
  burst({ x, y, colour, count = 8, speed = 120, gravity = false }: ParticleBurst): void {
    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const spd   = Phaser.Math.FloatBetween(speed * 0.5, speed);
      const vx    = Math.cos(angle) * spd;
      const vy    = Math.sin(angle) * spd;
      const size  = Phaser.Math.Between(3, 6);

      const g = this.scene.add.rectangle(x, y, size, size, colour, 1).setDepth(65);

      const grav  = gravity ? 200 : 0;
      let   elapsed = 0;
      const life    = 600;

      this.scene.time.addEvent({
        delay: 16, repeat: Math.floor(life / 16),
        callback: () => {
          elapsed += 16;
          g.x     += (vx * 16) / 1000;
          g.y     += (vy * 16) / 1000 + (grav * (elapsed / 1000) * 16) / 1000;
          g.alpha  = 1 - elapsed / life;
          if (elapsed >= life) g.destroy();
        },
      });
    }
  }

  /** Scrap sparkle */
  scrapPickup(x: number, y: number): void {
    this.burst({ x, y, colour: 0xd4a844, count: 6, speed: 80, gravity: false });
  }

  /** Enemy death splatter */
  enemyDeath(x: number, y: number): void {
    this.burst({ x, y, colour: 0x774411, count: 12, speed: 150, gravity: true });
  }

  /** Boss death explosion */
  bossDeath(x: number, y: number): void {
    for (let wave = 0; wave < 3; wave++) {
      this.scene.time.delayedCall(wave * 200, () => {
        this.burst({ x: x + Phaser.Math.Between(-40, 40), y: y + Phaser.Math.Between(-40, 40), colour: 0xff4422, count: 20, speed: 200, gravity: false });
        this.burst({ x, y, colour: 0xffcc22, count: 12, speed: 180, gravity: false });
      });
    }
  }

  /** Room clear stars */
  roomClear(cx: number, cy: number): void {
    for (let i = 0; i < 5; i++) {
      this.scene.time.delayedCall(i * 80, () => {
        const x = cx + Phaser.Math.Between(-100, 100);
        const y = cy + Phaser.Math.Between(-60, 60);
        this.burst({ x, y, colour: 0x74C69D, count: 8, speed: 100, gravity: false });
      });
    }
  }
}
