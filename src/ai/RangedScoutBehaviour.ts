import Phaser from 'phaser';
import type { IBehaviour } from './IBehaviour';
import type { Enemy } from '@/entities/Enemy';
import type { GameScene } from '@/scenes/GameScene';

type State = 'IDLE' | 'STRAFE' | 'RETREAT';

const PREFERRED_DIST = 250;
const RETREAT_DIST   = 100;
const STRAFE_SPEED   = 0.02; // radians per ms

export class RangedScoutBehaviour implements IBehaviour {
  private owner!: Enemy;
  private scene!: GameScene;
  private state: State = 'IDLE';
  private shootCooldown = 0;
  private orbitAngle = 0;

  init(owner: Enemy, scene: GameScene): void {
    this.owner = owner;
    this.scene = scene;
    this.state = 'IDLE';
    this.orbitAngle = Math.random() * Math.PI * 2;
  }

  tick(_time: number, delta: number): void {
    const player = this.scene.player;
    const dist = Phaser.Math.Distance.Between(this.owner.x, this.owner.y, player.x, player.y);

    this.shootCooldown = Math.max(0, this.shootCooldown - delta);

    if (dist < this.owner.aggroRadius || this.state !== 'IDLE') {
      if (dist < RETREAT_DIST) {
        this.state = 'RETREAT';
      } else {
        this.state = 'STRAFE';
      }
    }

    switch (this.state) {
      case 'IDLE':
        this.onIdle();
        break;
      case 'STRAFE':
        this.onStrafe(delta, dist, player);
        break;
      case 'RETREAT':
        this.onRetreat(player);
        break;
    }

    // Shoot independently of movement state
    if (dist < this.owner.aggroRadius && this.shootCooldown <= 0) {
      this.shoot(player);
    }
  }

  private onIdle(): void {
    const bod = this.owner.body as Phaser.Physics.Arcade.Body;
    bod.setVelocity(0, 0);
  }

  private onStrafe(delta: number, dist: number, player: { x: number; y: number }): void {
    this.orbitAngle += STRAFE_SPEED * delta;

    // Move to maintain preferred distance while orbiting
    const targetX = player.x + Math.cos(this.orbitAngle) * PREFERRED_DIST;
    const targetY = player.y + Math.sin(this.orbitAngle) * PREFERRED_DIST;

    const angle = Phaser.Math.Angle.Between(this.owner.x, this.owner.y, targetX, targetY);
    const bod = this.owner.body as Phaser.Physics.Arcade.Body;
    const speed = dist > PREFERRED_DIST + 20 ? this.owner.speed : this.owner.speed * 0.6;
    bod.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  private onRetreat(player: { x: number; y: number }): void {
    const angle = Phaser.Math.Angle.Between(player.x, player.y, this.owner.x, this.owner.y);
    const bod = this.owner.body as Phaser.Physics.Arcade.Body;
    bod.setVelocity(Math.cos(angle) * this.owner.speed * 1.2, Math.sin(angle) * this.owner.speed * 1.2);
  }

  private shoot(player: { x: number; y: number }): void {
    this.shootCooldown = this.owner.attackCooldown;
    const angle = Phaser.Math.Angle.Between(this.owner.x, this.owner.y, player.x, player.y);
    this.scene.projectileManager.fire(
      this.owner.x, this.owner.y, angle,
      { speed: 200, damage: this.owner.damage, damageType: 'physical', pierceCount: 0, lifetime: 3000, spriteKey: 'projectile', scale: 0.6, tint: 0xff4444 },
      'enemy'
    );
  }

  onStagger(): void {
    this.state = 'RETREAT';
  }

  onDeath(): void {
    // Nothing
  }
}
