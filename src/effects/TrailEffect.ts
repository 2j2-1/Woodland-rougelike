import Phaser from 'phaser';
import type { Player } from '@/entities/Player';
import type { GameScene } from '@/scenes/GameScene';

/** Ghost sprite pool for the dash trail effect */
export class TrailEffect {
  private scene: GameScene;
  private player: Player;
  private active = false;
  private pool: Phaser.GameObjects.Sprite[] = [];
  private poolSize = 10;

  constructor(scene: GameScene, player: Player) {
    this.scene  = scene;
    this.player = player;

    for (let i = 0; i < this.poolSize; i++) {
      const ghost = scene.add.sprite(-1000, -1000, 'player').setAlpha(0).setTint(0x44ff88);
      this.pool.push(ghost);
    }
  }

  activate(): void { this.active = true; }
  deactivate(): void { this.active = false; }

  update(): void {
    if (!this.active) return;

    const ghost = this.getFromPool();
    if (!ghost) return;

    ghost.setPosition(this.player.x, this.player.y);
    ghost.setAlpha(0.5);
    ghost.setScale(this.player.scaleX, this.player.scaleY);
    ghost.setFlipX(this.player.flipX);

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 0.8,
      duration: 150,
      ease: 'Linear',
      onComplete: () => this.returnToPool(ghost),
    });
  }

  private getFromPool(): Phaser.GameObjects.Sprite | undefined {
    return this.pool.find((g) => g.alpha === 0);
  }

  private returnToPool(ghost: Phaser.GameObjects.Sprite): void {
    ghost.setPosition(-1000, -1000).setAlpha(0);
  }
}
