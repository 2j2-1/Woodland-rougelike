import type { GameScene } from '@/scenes/GameScene';
import { ScrapPickup } from '@/entities/ScrapPickup';
import { CurrencyManager } from '@/systems/CurrencyManager';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import type { Enemy } from '@/entities/Enemy';

export class LootDropper {
  private scene: GameScene;
  private group: Phaser.Physics.Arcade.Group;
  private pickups: ScrapPickup[] = [];

  constructor(scene: GameScene, group: Phaser.Physics.Arcade.Group) {
    this.scene = scene;
    this.group = group;

    EventBus.on(GameEvents.ENEMY_DIED, ({ enemy }: { enemy: Enemy }) => {
      this.dropFromEnemy(enemy);
    });

    EventBus.on(GameEvents.LOOT_COLLECTED, (d: { amount: number }) => {
      CurrencyManager.addRunScraps(d.amount);
    });
  }

  dropFromEnemy(enemy: Enemy): void {
    // Scraps
    const amount = Phaser.Math.Between(enemy.scrapDropMin, enemy.scrapDropMax);
    if (amount > 0) {
      const scrap = new ScrapPickup(this.scene, enemy.x, enemy.y, amount);
      this.pickups.push(scrap);
      this.group.add(scrap);
    }

    // Chip drop
    if (Math.random() < enemy.chipDropChance) {
      EventBus.emit(GameEvents.CHIP_CHANGED, { runChips: CurrencyManager.runChips + 1 });
      CurrencyManager.addChip();
    }
  }

  update(_time: number, delta: number): void {
    for (const pickup of this.pickups) {
      if (pickup.active) pickup.update(0, delta);
    }
    this.pickups = this.pickups.filter((p) => p.active);
  }
}
