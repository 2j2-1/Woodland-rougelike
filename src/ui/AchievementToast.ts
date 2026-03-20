import Phaser from 'phaser';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

export class AchievementToast {
  private scene:   Phaser.Scene;
  private queue:   Array<{ name: string; description: string }> = [];
  private showing: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    EventBus.on(GameEvents.ACHIEVEMENT_UNLOCKED, this.onAchievement, this);
  }

  private onAchievement({ name, description }: { id: string; name: string; description: string }): void {
    this.queue.push({ name, description });
    if (!this.showing) this.showNext();
  }

  private showNext(): void {
    if (this.queue.length === 0) { this.showing = false; return; }
    this.showing = true;
    const item = this.queue.shift()!;
    const { width } = this.scene.scale;

    const bg = this.scene.add.rectangle(width - 20, 80, 280, 58, 0x000000, 0.9)
      .setOrigin(1, 0.5).setStrokeStyle(1, 0xd4a844).setScrollFactor(0).setDepth(250)
      .setX(width + 150);

    const title = this.scene.add.text(width - 30, 68, '🏆 ACHIEVEMENT UNLOCKED', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#d4a844',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(251).setX(width + 150);

    const nameT = this.scene.add.text(width - 30, 82, item.name, {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(251).setX(width + 150);

    const descT = this.scene.add.text(width - 30, 98, item.description, {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#aaaaaa',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(251).setX(width + 150);

    const targets = [bg, title, nameT, descT];
    const targetX = width - 20;

    // Slide in
    this.scene.tweens.add({
      targets, x: targetX, duration: 400, ease: 'Back.easeOut',
      onComplete: () => {
        // Hold, then slide out
        this.scene.time.delayedCall(2800, () => {
          this.scene.tweens.add({
            targets, x: width + 150, duration: 350, ease: 'Back.easeIn',
            onComplete: () => {
              targets.forEach(t => t.destroy());
              this.showNext();
            },
          });
        });
      },
    });
  }

  destroy(): void {
    EventBus.off(GameEvents.ACHIEVEMENT_UNLOCKED, this.onAchievement, this);
  }
}
