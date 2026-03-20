import Phaser from 'phaser';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import type { GameScene } from '@/scenes/GameScene';

/**
 * ScrapPickup — dropped on enemy death, magnetises to player after 8s.
 */
export class ScrapPickup extends Phaser.Physics.Arcade.Sprite {
  private amount: number;
  private magnetTimer: number;
  private magnetising = false;
  private collected = false;

  constructor(scene: GameScene, x: number, y: number, amount: number) {
    super(scene, x, y, 'scrap');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    scene.lootGroup.add(this);

    this.amount = amount;
    this.magnetTimer = 8000;

    const bod = this.body as Phaser.Physics.Arcade.Body;
    bod.setAllowGravity(false);

    // Bounce-in tween
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;

    EventBus.emit(GameEvents.LOOT_COLLECTED, { type: 'scrap', amount: this.amount });
    EventBus.emit(GameEvents.SCRAP_CHANGED, {
      runScraps: 0, // CurrencyManager will update the real value
    });

    this.scene.tweens.add({
      targets: this, scale: 0, alpha: 0, duration: 100,
      onComplete: () => this.destroy(),
    });
  }

  update(_time: number, delta: number): void {
    if (this.collected) return;
    if (this.magnetising) return;

    this.magnetTimer -= delta;
    if (this.magnetTimer <= 0) {
      this.magnetising = true;
      const player = (this.scene as GameScene).player;
      this.scene.tweens.add({
        targets: this,
        x: player.x,
        y: player.y,
        duration: 500,
        ease: 'Quad.easeIn',
        onComplete: () => this.collect(),
      });
    }
  }
}
