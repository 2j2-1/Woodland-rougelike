import type { Enemy } from '@/entities/Enemy';
import type { GameScene } from '@/scenes/GameScene';

export interface IBehaviour {
  /** Called once after Enemy is constructed */
  init(owner: Enemy, scene: GameScene): void;
  /** Called every frame */
  tick(time: number, delta: number): void;
  /** Called when the enemy staggered */
  onStagger(): void;
  /** Called just before the enemy is destroyed */
  onDeath(): void;
}
