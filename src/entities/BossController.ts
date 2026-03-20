import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import type { Enemy } from '@/entities/Enemy';

export interface BossPhaseDefinition {
  /** Minimum HP % (0–1) that triggers transition INTO this phase */
  hpThreshold: number;
  /** Phase index (0 = first) */
  index:        number;
  /** Multiplier on move speed in this phase */
  speedMult:    number;
  /** Multiplier on attack rate in this phase */
  attackMult:   number;
}

/**
 * Attached to a boss Enemy. Monitors HP and transitions between phases.
 */
export class BossController {
  readonly enemy:        Enemy;
  private phases:        BossPhaseDefinition[];
  private currentPhase:  number = 0;
  private transitioning: boolean = false;

  constructor(enemy: Enemy, phases: BossPhaseDefinition[]) {
    this.enemy  = enemy;
    this.phases = phases.sort((a, b) => b.hpThreshold - a.hpThreshold);
    EventBus.emit(GameEvents.BOSS_PHASE_CHANGED, { phase: 0 });
  }

  /** Call every frame from the boss behaviour's tick() */
  update(): void {
    if (this.transitioning) return;
    const hpPct = this.enemy.hp / this.enemy.maxHp;
    const nextIdx = this.currentPhase + 1;
    if (nextIdx < this.phases.length && hpPct <= this.phases[nextIdx].hpThreshold) {
      this.transitionToPhase(nextIdx);
    }
  }

  private transitionToPhase(idx: number): void {
    this.transitioning = true;
    this.currentPhase  = idx;

    // Brief invulnerability + visual burst
    this.enemy.setTint(0xffffff);
    this.enemy.scene.time.delayedCall(800, () => {
      this.enemy.clearTint();
      this.transitioning = false;
    });

    EventBus.emit(GameEvents.BOSS_PHASE_CHANGED, { phase: idx });
  }

  get phase(): BossPhaseDefinition { return this.phases[this.currentPhase]; }
  get phaseIndex(): number          { return this.currentPhase; }
}
