import Phaser from 'phaser';
import { Enemy } from '@/entities/Enemy';
import { BossController, type BossPhaseDefinition } from '@/entities/BossController';
import { TelegraphSystem } from '@/systems/TelegraphSystem';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import { StatType } from '@/types/stats';
import type { OperationType } from '@/types/stats';
import type { IBehaviour } from '@/ai/IBehaviour';
import type { GameScene } from '@/scenes/GameScene';

type BossState = 'INTRO' | 'IDLE' | 'FRIENDLY_WAVE' | 'PAMPHLET_DROP' | 'CORPORATE_MARCH'
               | 'DRONE_DEPLOY' | 'SYSTEM_OVERRIDE' | 'MEMORY_LEAK' | 'DESP_CHARGE' | 'DEAD';

const PHASES: BossPhaseDefinition[] = [
  { index: 0, hpThreshold: 1.0,  speedMult: 1.0, attackMult: 1.0 },
  { index: 1, hpThreshold: 0.65, speedMult: 1.3, attackMult: 1.4 },
  { index: 2, hpThreshold: 0.30, speedMult: 1.6, attackMult: 2.0 },
];

const ATTACK_COOLDOWN = 2500;

export class BuddyBossController implements IBehaviour {
  private enemy!:    Enemy;
  private scene!:    GameScene;
  private ctrl!:     BossController;
  private telegraph!: TelegraphSystem;

  private state:    BossState = 'INTRO';
  private timer:    number    = 3000;  // intro delay
  private atkCd:   number    = ATTACK_COOLDOWN;
  private attackCycle = 0;

  init(enemy: Enemy): void {
    this.enemy     = enemy;
    this.scene     = enemy.scene as GameScene;
    this.ctrl      = new BossController(enemy, PHASES);
    this.telegraph = new TelegraphSystem(this.scene);

    // Spawn entrance burst
    this.scene.cameras.main.flash(600, 220, 180, 80);
    enemy.setTint(0xffcc88);

    EventBus.emit(GameEvents.BOSS_SPAWNED, {
      name:   'BUDDY 9000',
      maxHp:  enemy.maxHp,
      phases: PHASES.length,
    });

    EventBus.on(GameEvents.BOSS_PHASE_CHANGED, this.onPhaseChanged, this);
  }

  tick(delta: number): void {
    this.ctrl.update();

    switch (this.state) {
      case 'INTRO':
        this.timer -= delta;
        if (this.timer <= 0) {
          this.enemy.clearTint();
          this.state = 'IDLE';
        }
        break;

      case 'IDLE':
        this.atkCd -= delta;
        this.chasePlayer(80);
        if (this.atkCd <= 0) this.selectAttack();
        break;

      case 'FRIENDLY_WAVE':  this.tickFriendlyWave(delta); break;
      case 'PAMPHLET_DROP':  this.tickPamphletDrop(delta); break;
      case 'CORPORATE_MARCH':this.tickCorporateMarch(delta); break;
      case 'DRONE_DEPLOY':   this.tickDroneDeploy(delta); break;
      case 'SYSTEM_OVERRIDE':this.tickSystemOverride(delta); break;
      case 'MEMORY_LEAK':    this.tickMemoryLeak(delta); break;
      case 'DESP_CHARGE':    this.tickDespCharge(delta); break;
    }
  }

  onStagger(): void { this.timer = 400; }

  onDeath(): void {
    this.state = 'DEAD';
    EventBus.off(GameEvents.BOSS_PHASE_CHANGED, this.onPhaseChanged, this);
    EventBus.emit(GameEvents.BOSS_DIED);
    EventBus.emit(GameEvents.NARRATIVE_FLAG_SET, { flagId: 'FIRST_BOSS_DEFEAT' });
  }

  // ─── Attack Selection ───────────────────────────────────────────────────────

  private selectAttack(): void {
    this.atkCd = ATTACK_COOLDOWN / this.ctrl.phase.attackMult;
    const phase = this.ctrl.phaseIndex;
    const pool  = phase === 0
      ? ['FRIENDLY_WAVE', 'PAMPHLET_DROP', 'CORPORATE_MARCH']
      : phase === 1
      ? ['PAMPHLET_DROP', 'DRONE_DEPLOY', 'SYSTEM_OVERRIDE', 'CORPORATE_MARCH']
      : ['MEMORY_LEAK', 'DESP_CHARGE', 'DRONE_DEPLOY', 'SYSTEM_OVERRIDE'];

    this.state = pool[this.attackCycle % pool.length] as BossState;
    this.attackCycle++;
    this.timer = 0;
  }

  // ─── Attacks ────────────────────────────────────────────────────────────────

  private tickFriendlyWave(delta: number): void {
    if (this.timer === 0) {
      // Warn with expanding ring
      this.telegraph.show({
        shape: 'circle', x: this.enemy.x, y: this.enemy.y,
        radius: 120, duration: 1000, colour: 0x44aaff,
      });
      this.timer = 1200;
    }
    this.timer -= delta;
    if (this.timer <= 0) {
      // Shockwave: damages player if too close
      const player = this.scene.player;
      const dist   = Phaser.Math.Distance.Between(this.enemy.x, this.enemy.y, player.x, player.y);
      if (dist < 120) player.takeDamage(15, 'physical');
      this.scene.cameras.main.shake(200, 0.008);
      this.returnToIdle();
    }
  }

  private tickPamphletDrop(delta: number): void {
    if (this.timer === 0) {
      // Spray 6 projectiles in a fan
      const pm = this.scene.projectileManager;
      for (let i = 0; i < 6; i++) {
        const angle = (-Math.PI / 2) + (i / 5) * Math.PI;
        pm.fire(this.enemy.x, this.enemy.y, angle,
          { speed: 160, damage: 10, damageType: 'physical', pierceCount: 0, lifetime: 2000, spriteKey: '' },
          'enemy');
      }
      this.timer = 800;
    }
    this.timer -= delta;
    if (this.timer <= 0) this.returnToIdle();
  }

  private tickCorporateMarch(delta: number): void {
    this.chasePlayer(200);
    if (this.timer === 0) this.timer = 2000;
    this.timer -= delta;
    if (this.timer <= 0) this.returnToIdle();
  }

  private tickDroneDeploy(delta: number): void {
    if (this.timer === 0) {
      // Spawn 2 minion enemies around boss
      const em = this.scene.enemyManager;
      const offsets = [{ dx: -80, dy: 0 }, { dx: 80, dy: 0 }];
      offsets.forEach(o => em.spawnEnemy({
        enemyId: 'robo-pheasant-mk1',
        x: this.enemy.x + o.dx,
        y: this.enemy.y + o.dy,
        waveNumber: 0,
      }));
      this.timer = 800;
    }
    this.timer -= delta;
    if (this.timer <= 0) this.returnToIdle();
  }

  private tickSystemOverride(delta: number): void {
    if (this.timer === 0) {
      this.telegraph.show({
        shape: 'ground_zone', x: this.enemy.x, y: this.enemy.y,
        radius: 80, duration: 1500, colour: 0xff6600,
      });
      this.timer = 1800;
    }
    this.timer -= delta;
    if (this.timer <= 0) {
      const player = this.scene.player;
      const dist   = Phaser.Math.Distance.Between(this.enemy.x, this.enemy.y, player.x, player.y);
      if (dist < 80) player.takeDamage(20, 'electric');
      // Slow player
      player.stats.applyModifier({ stat: StatType.Speed, operation: 'multiply' as OperationType, value: 0.6, source: 'sys_override' });
      this.scene.time.delayedCall(3000, () =>
        player.stats.removeModifier('sys_override'));
      this.returnToIdle();
    }
  }

  private tickMemoryLeak(delta: number): void {
    if (this.timer === 0) {
      // Rotating spray of projectiles
      const pm = this.scene.projectileManager;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        pm.fire(this.enemy.x, this.enemy.y, angle,
          { speed: 140, damage: 8, damageType: 'physical', pierceCount: 0, lifetime: 2200, spriteKey: '' },
          'enemy');
      }
      this.timer = 1000;
    }
    this.timer -= delta;
    if (this.timer <= 0) this.returnToIdle();
  }

  private tickDespCharge(delta: number): void {
    if (this.timer === 0) {
      const player = this.scene.player;
      this.telegraph.show({
        shape: 'line', x: this.enemy.x, y: this.enemy.y,
        angle:  Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, player.x, player.y),
        length: 300, width: 50, duration: 1200, colour: 0xff0000,
      });
      this.timer = 1400;
    }
    this.timer -= delta;
    if (this.timer > 0) {
      // Rush toward player
      this.chasePlayer(350);
    } else {
      this.scene.physics.world.pause();
      this.scene.time.delayedCall(50, () => this.scene.physics.world.resume());
      this.returnToIdle();
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private chasePlayer(speed: number): void {
    const player = this.scene.player;
    const angle  = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, player.x, player.y);
    const s = speed * this.ctrl.phase.speedMult;
    this.enemy.setVelocity(Math.cos(angle) * s, Math.sin(angle) * s);
  }

  private returnToIdle(): void {
    this.state  = 'IDLE';
    this.timer  = 0;
    this.enemy.setVelocity(0, 0);
  }

  private onPhaseChanged({ phase }: { phase: number }): void {
    if (phase === 1) {
      this.enemy.setTint(0xff8844);
      this.atkCd     = 1500;
    } else if (phase === 2) {
      this.enemy.setTint(0xff3333);
      this.atkCd     = 1000;
    }
  }
}
