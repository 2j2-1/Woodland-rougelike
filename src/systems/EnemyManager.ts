import type { GameScene } from '@/scenes/GameScene';
import { Enemy } from '@/entities/Enemy';
import { EnemyRegistry } from '@/systems/Registry';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import type { RunState } from '@/types/game';

export interface EnemySpawnPoint {
  enemyId: string;
  waveNumber: number;
  x: number;
  y: number;
}

export class EnemyManager {
  private scene: GameScene;
  private group: Phaser.Physics.Arcade.Group;
  private alive = new Set<Enemy>();
  private runState: RunState;

  constructor(scene: GameScene, group: Phaser.Physics.Arcade.Group, runState: RunState) {
    this.scene    = scene;
    this.group    = group;
    this.runState = runState;

    EventBus.on(
      GameEvents.ENEMY_DIED,
      ({ enemy }: { enemy: Enemy }) => this.onEnemyDied(enemy)
    );
  }

  spawnEnemy(point: EnemySpawnPoint): Enemy | null {
    const def = EnemyRegistry.get(point.enemyId);
    if (!def) {
      console.warn(`[EnemyManager] Unknown enemyId: ${point.enemyId}`);
      return null;
    }
    const enemy = new Enemy(this.scene, point.x, point.y, def);
    this.group.add(enemy);
    this.alive.add(enemy);
    return enemy;
  }

  spawnWave(points: EnemySpawnPoint[]): void {
    for (const p of points) this.spawnEnemy(p);
  }

  private onEnemyDied(enemy: Enemy): void {
    this.alive.delete(enemy);
    this.runState.enemiesKilled++;
  }

  getAliveCount(): number { return this.alive.size; }
  getAlive(): Set<Enemy>  { return this.alive; }

  /** Hard-remove all alive enemies immediately (no tween, no ENEMY_DIED event). Used by DevScene. */
  destroyAll(): void {
    for (const e of [...this.alive]) {
      this.group.remove(e, true, true);
    }
    this.alive.clear();
  }

  update(time: number, delta: number): void {
    for (const enemy of this.alive) {
      enemy.update(time, delta);
    }
  }
}
