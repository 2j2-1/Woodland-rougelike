import Phaser from 'phaser';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import type { GameScene } from '@/scenes/GameScene';
import type { IBehaviour } from '@/ai/IBehaviour';
import { BehaviourRegistry } from '@/ai/BehaviourRegistry';
import type { EnemyDefinition } from '@/types/content';
import type { DamageType } from '@/types/game';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  readonly speed: number;
  readonly damage: number;
  readonly defence: number;
  readonly aggroRadius: number;
  readonly attackRange: number;
  readonly attackCooldown: number;
  readonly scrapDropMin: number;
  readonly scrapDropMax: number;
  readonly chipDropChance: number;
  readonly definition: EnemyDefinition;

  private behaviour!: IBehaviour;

  constructor(scene: GameScene, x: number, y: number, def: EnemyDefinition) {
    super(scene, x, y, def.spriteKey || 'enemy');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.definition = def;
    this.hp         = def.hp;
    this.maxHp      = def.hp;
    this.speed      = def.speed;
    this.damage     = def.damage;
    this.defence    = def.defence;
    this.aggroRadius    = def.aggroRadius;
    this.attackRange    = def.attackRange;
    this.attackCooldown = def.attackCooldown;
    this.scrapDropMin   = def.scrapDropMin;
    this.scrapDropMax   = def.scrapDropMax;
    this.chipDropChance = def.chipDropChance;

    const bod = this.body as Phaser.Physics.Arcade.Body;
    bod.setCollideWorldBounds(true);

    // Assign behaviour
    const BehaviourClass = BehaviourRegistry.get(def.behaviourId);
    if (BehaviourClass) {
      this.behaviour = new BehaviourClass();
      this.behaviour.init(this, scene);
    } else {
      console.warn(`[Enemy] Unknown behaviourId: ${def.behaviourId}`);
    }

    EventBus.emit(GameEvents.ENEMY_SPAWNED, { enemyId: def.enemyId, x, y });
  }

  takeDamage(amount: number, _type: DamageType = 'physical'): void {
    const final = Math.max(1, Math.floor(amount * (1 - this.defence / 100)));
    this.hp = Math.max(0, this.hp - final);

    // Hit flash — red tint + brief scale pulse for clear feedback
    this.setTint(0xff3322);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.25, scaleY: 1.25,
      duration: 60, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => { this.clearTint(); },
    });

    EventBus.emit(GameEvents.ENEMY_DAMAGED, { enemy: this, amount: final });

    if (this.hp <= 0) this.die();
  }

  takeDamageFromProjectile(proj: Phaser.GameObjects.GameObject): void {
    const p = proj as unknown as { damage: number; damageType: DamageType };
    this.takeDamage(p.damage);
    // Delegate pierce + life-steal to the projectile manager so it can heal the player
    (this.scene as GameScene).projectileManager?.applyHitEffect(proj);
  }

  die(): void {
    if (!this.active) return; // already dying
    this.setActive(false);
    this.body?.destroy();

    // Death burst — only if the scene and particle texture are still available
    try {
      if (this.scene?.textures?.exists('particle')) {
        const px = this.x;
        const py = this.y;
        const scene = this.scene as GameScene;
        const particles = scene.add.particles(px, py, 'particle', {
          speed: { min: 40, max: 120 },
          scale: { start: 0.6, end: 0 },
          quantity: 12,
          lifespan: 400,
          tint: [0xdd6622, 0xffaa44, 0x884400],
          emitting: false,
        });
        particles.explode(12, px, py);
        scene.time.delayedCall(600, () => { if (particles?.active) particles.destroy(); });
      }
    } catch (err) {
      console.warn('[Enemy.die] Particle effect failed:', err);
    }

    this.scene.tweens.add({
      targets: this, alpha: 0, duration: 300,
      onComplete: () => {
        try {
          EventBus.emit(GameEvents.ENEMY_DIED, { enemy: this, def: this.definition });
          this.destroy();
        } catch (err) {
          console.warn('[Enemy.die] Cleanup error:', err);
        }
      },
    });
  }

  update(time: number, delta: number): void {
    if (!this.active) return;
    this.behaviour?.tick(time, delta);
  }
}
