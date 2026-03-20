import Phaser from 'phaser';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

/**
 * Freezes game time for a short duration on impact.
 * Triggered via EventBus.emit(GameEvents.HIT_PAUSE, { durationMs }).
 */
export class HitPauseManager {
  private scene:     Phaser.Scene;
  private pausing:   boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    EventBus.on(GameEvents.HIT_PAUSE, this.onHitPause, this);
  }

  private onHitPause({ durationMs }: { durationMs: number }): void {
    if (this.pausing) return;
    this.pausing = true;

    // Freeze physics + tweens
    this.scene.physics.world.timeScale = 999;
    this.scene.tweens.timeScale         = 0.02;

    this.scene.time.delayedCall(durationMs, () => {
      this.scene.physics.world.timeScale = 1;
      this.scene.tweens.timeScale         = 1;
      this.pausing                        = false;
    });
  }

  /** Utility: emit a 80ms hit pause (standard strong hit) */
  static triggerStrong(): void {
    EventBus.emit(GameEvents.HIT_PAUSE, { durationMs: 80 });
  }

  /** Utility: emit a 40ms hit pause (standard light hit) */
  static triggerLight(): void {
    EventBus.emit(GameEvents.HIT_PAUSE, { durationMs: 40 });
  }

  destroy(): void {
    EventBus.off(GameEvents.HIT_PAUSE, this.onHitPause, this);
  }
}
