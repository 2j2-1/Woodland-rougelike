import Phaser from 'phaser';
import { ParticleManager } from '@/effects/ParticleManager';

export class BossIntroEffect {
  static play(scene: Phaser.Scene, bossName: string, particles: ParticleManager): void {
    const { width, height } = scene.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Black-out overlay
    const overlay = scene.add.rectangle(cx, cy, width, height, 0x000000, 0)
      .setScrollFactor(0).setDepth(95);
    scene.tweens.add({ targets: overlay, alpha: 0.85, duration: 500 });

    // Boss name reveal
    const nameText = scene.add.text(cx, cy - 20, bossName, {
      fontFamily: 'Georgia, serif', fontSize: '42px', color: '#ff4422', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(96).setAlpha(0).setScale(0.4);

    scene.tweens.add({
      targets: nameText, alpha: 1, scale: 1, duration: 700, ease: 'Back.easeOut',
    });

    const subText = scene.add.text(cx, cy + 38, 'WARNING: CORPORATE ENTITY DETECTED', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#ffcc44', letterSpacing: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(96).setAlpha(0);

    scene.tweens.add({ targets: subText, alpha: 1, delay: 600, duration: 400 });

    // Particle burst at boss position
    particles.burst({ x: cx, y: cy, colour: 0xff4422, count: 30, speed: 300, gravity: false });

    // Fade out and resume
    scene.time.delayedCall(2200, () => {
      scene.tweens.add({ targets: [overlay, nameText, subText], alpha: 0, duration: 500,
        onComplete: () => {
          overlay.destroy();
          nameText.destroy();
          subText.destroy();
        },
      });
    });
  }
}
