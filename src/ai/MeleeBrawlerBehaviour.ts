import Phaser from 'phaser';
import type { IBehaviour } from './IBehaviour';
import type { Enemy } from '@/entities/Enemy';
import type { GameScene } from '@/scenes/GameScene';

type State = 'IDLE' | 'PATROL' | 'CHASE' | 'ATTACK' | 'STAGGERED';

export class MeleeBrawlerBehaviour implements IBehaviour {
  private owner!: Enemy;
  private scene!: GameScene;
  private state: State = 'IDLE';
  private patrolTarget?: Phaser.Math.Vector2;
  private patrolWaitTimer = 0;
  private attackCooldownTimer = 0;
  private staggerTimer = 0;

  init(owner: Enemy, scene: GameScene): void {
    this.owner = owner;
    this.scene = scene;
    this.state = 'PATROL';
    this.pickNewPatrolTarget();
  }

  tick(_time: number, delta: number): void {
    const player = this.scene.player;
    const dist = Phaser.Math.Distance.Between(this.owner.x, this.owner.y, player.x, player.y);

    this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - delta);

    switch (this.state) {
      case 'IDLE':
        this.onIdle(delta);
        if (dist < this.owner.aggroRadius) this.state = 'CHASE';
        break;

      case 'PATROL':
        this.onPatrol(delta);
        if (dist < this.owner.aggroRadius) this.state = 'CHASE';
        break;

      case 'CHASE':
        this.moveToward(player.x, player.y);
        if (dist <= this.owner.attackRange && this.attackCooldownTimer <= 0) {
          this.state = 'ATTACK';
        }
        break;

      case 'ATTACK':
        this.onAttack(dist);
        break;

      case 'STAGGERED':
        this.staggerTimer -= delta;
        if (this.staggerTimer <= 0) this.state = 'CHASE';
        break;
    }
  }

  private onIdle(_delta: number): void {
    const bod = this.owner.body as Phaser.Physics.Arcade.Body;
    bod.setVelocity(0, 0);
  }

  private onPatrol(delta: number): void {
    if (this.patrolWaitTimer > 0) {
      this.patrolWaitTimer -= delta;
      const bod = this.owner.body as Phaser.Physics.Arcade.Body;
      bod.setVelocity(0, 0);
      return;
    }
    if (!this.patrolTarget) { this.pickNewPatrolTarget(); return; }

    const dist = Phaser.Math.Distance.Between(
      this.owner.x, this.owner.y,
      this.patrolTarget.x, this.patrolTarget.y
    );
    if (dist < 8) {
      this.patrolTarget = undefined;
      this.patrolWaitTimer = 2000;
    } else {
      this.moveToward(this.patrolTarget.x, this.patrolTarget.y, this.owner.speed * 0.5);
    }
  }

  private onAttack(distToPlayer: number): void {
    const bod = this.owner.body as Phaser.Physics.Arcade.Body;
    bod.setVelocity(0, 0);

    if (distToPlayer <= this.owner.attackRange) {
      // Deal damage
      this.scene.player.takeDamage(this.owner.damage);
      this.attackCooldownTimer = this.owner.attackCooldown;
      this.state = 'CHASE';
    } else {
      this.state = 'CHASE';
    }
  }

  private moveToward(tx: number, ty: number, speed?: number): void {
    const s = speed ?? this.owner.speed;
    const angle = Phaser.Math.Angle.Between(this.owner.x, this.owner.y, tx, ty);
    const bod = this.owner.body as Phaser.Physics.Arcade.Body;
    bod.setVelocity(Math.cos(angle) * s, Math.sin(angle) * s);
  }

  private pickNewPatrolTarget(): void {
    const ox = this.owner.x;
    const oy = this.owner.y;
    const r = 150;
    this.patrolTarget = new Phaser.Math.Vector2(
      ox + Phaser.Math.Between(-r, r),
      oy + Phaser.Math.Between(-r, r)
    );
  }

  onStagger(): void {
    this.state = 'STAGGERED';
    this.staggerTimer = 600;
  }

  onDeath(): void {
    // Nothing extra needed
  }
}
