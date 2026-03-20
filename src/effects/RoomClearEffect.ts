import Phaser from 'phaser';
import { ParticleManager } from '@/effects/ParticleManager';

export class RoomClearEffect {
  static play(scene: Phaser.Scene, particles: ParticleManager): void {
    const { width, height } = scene.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Flash overlay
    const overlay = scene.add.rectangle(cx, cy, width, height, 0x74C69D, 0.18)
      .setScrollFactor(0).setDepth(80);
    scene.tweens.add({
      targets: overlay, alpha: 0, duration: 600,
      onComplete: () => overlay.destroy(),
    });

    // "ROOM CLEAR" text
    const label = scene.add.text(cx, cy - 40, 'ROOM CLEAR', {
      fontFamily: 'Georgia, serif', fontSize: '28px', color: '#74C69D', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(81).setAlpha(0);

    scene.tweens.add({
      targets: label, alpha: 1, y: cy - 60, duration: 300, ease: 'Back.easeOut',
    });
    scene.tweens.add({
      targets: label, alpha: 0, y: cy - 90,
      delay: 1000, duration: 400,
      onComplete: () => label.destroy(),
    });

    // Particles across the room
    particles.roomClear(cx, cy);
  }
}
