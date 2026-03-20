import Phaser from 'phaser';
import type { GameScene } from '@/scenes/GameScene';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

export interface ProjectileConfig {
  speed: number;
  damage: number;
  damageType: string;
  pierceCount: number;
  lifetime: number;
  spriteKey: string;
  scale?: number;
  tint?: number;
  /** Steers towards the nearest enemy each frame */
  homing?: boolean;
  /** Radians-per-second angular acceleration (default 3.0) */
  homingStrength?: number;
  /** Reflects off world bounds on impact */
  bouncing?: boolean;
  /** Max number of wall bounces before expiring (default 2) */
  bounceCount?: number;
  /** Fraction of damage healed back to player (0–1) */
  lifeSteal?: number;
}

class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage = 0;
  damageType = 'physical';
  pierceCount = 0;
  team: 'player' | 'enemy' = 'player';
  lifeSteal = 0;
  homing = false;
  homingStrength = 3.0;
  bouncing = false;
  private bouncesLeft = 0;
  private lifeTimer = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, -1000, -1000, 'projectile');
    // Do NOT call scene.add/physics.add here — the owning Group handles
    // both display-list insertion and body creation via group.add(this, true).
  }

  fire(x: number, y: number, angle: number, cfg: ProjectileConfig, team: 'player' | 'enemy'): void {
    this.setActive(true).setVisible(true);

    const bod = this.body as Phaser.Physics.Arcade.Body | null;
    if (!bod) {
      console.error('[Projectile.fire] physics body is null — pool initialisation failed');
      return;
    }

    // Reset position through the body so physics world and display are in sync
    bod.reset(x, y);
    bod.setEnable(true);

    this.damage         = cfg.damage;
    this.damageType     = cfg.damageType;
    this.pierceCount    = cfg.pierceCount;
    this.team           = team;
    this.lifeTimer      = cfg.lifetime;
    this.lifeSteal      = cfg.lifeSteal ?? 0;
    this.homing         = cfg.homing ?? false;
    this.homingStrength = cfg.homingStrength ?? 3.0;
    this.bouncing       = cfg.bouncing ?? false;
    this.bouncesLeft    = cfg.bounceCount ?? 2;
    this.setScale(cfg.scale ?? 1);
    if (cfg.tint) this.setTint(cfg.tint);
    else this.clearTint();

    if (this.bouncing) {
      bod.setBounce(1, 1);
      bod.setCollideWorldBounds(true);
    } else {
      bod.setBounce(0, 0);
      bod.setCollideWorldBounds(false);
    }

    bod.setVelocity(Math.cos(angle) * cfg.speed, Math.sin(angle) * cfg.speed);
  }

  onHit(healCallback?: (amount: number) => void): void {
    if (this.lifeSteal > 0 && healCallback) {
      const healAmount = Math.max(1, Math.floor(this.damage * this.lifeSteal));
      healCallback(healAmount);
    }
    this.pierceCount--;
    if (this.pierceCount < 0) this.expire();
  }

  /** Called each frame while active */
  tick(delta: number, nearestEnemy: { x: number; y: number } | null): void {
    // Homing steering — rotate velocity towards nearest enemy
    if (this.homing && nearestEnemy) {
      const bod = this.body as Phaser.Physics.Arcade.Body | null;
      if (bod) {
        const targetAngle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
        const currentAngle = Math.atan2(bod.velocity.y, bod.velocity.x);
        const currentSpeed = Math.sqrt(bod.velocity.x ** 2 + bod.velocity.y ** 2);
        const diff = Phaser.Math.Angle.Wrap(targetAngle - currentAngle);
        const maxTurn = (this.homingStrength * delta) / 1000;
        const newAngle = currentAngle + Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
        bod.setVelocity(Math.cos(newAngle) * currentSpeed, Math.sin(newAngle) * currentSpeed);
      }
    }

    // Bouncing — count wall hits; expire when out of bounces
    if (this.bouncing) {
      const bod = this.body as Phaser.Physics.Arcade.Body | null;
      if (bod && (bod.blocked.left || bod.blocked.right || bod.blocked.up || bod.blocked.down)) {
        this.bouncesLeft--;
        if (this.bouncesLeft < 0) { this.expire(); return; }
      }
    }

    this.lifeTimer -= delta;
    if (this.lifeTimer <= 0) this.expire();
  }

  /** Legacy shim — kept so callers that don't need life steal can omit the callback */
  updateLife(delta: number): void {
    this.tick(delta, null);
  }

  private expire(): void {
    this.setActive(false).setVisible(false);
    const bod = this.body as Phaser.Physics.Arcade.Body | null;
    if (bod) {
      bod.setVelocity(0, 0);
      bod.setCollideWorldBounds(false);
      bod.reset(-1000, -1000);
    }
  }
}

export class ProjectileManager {
  private scene: GameScene;
  private playerPool: Projectile[] = [];
  private enemyPool:  Projectile[] = [];

  constructor(
    scene: GameScene,
    playerGroup: Phaser.Physics.Arcade.Group,
    enemyGroup: Phaser.Physics.Arcade.Group
  ) {
    this.scene = scene;
    for (let i = 0; i < 80; i++) {
      // group.add(child, addToScene=true) adds to the display list AND physics world,
      // which ensures the body is created regardless of child.active state.
      const p = new Projectile(scene);
      playerGroup.add(p, true);
      p.setActive(false).setVisible(false);
      this.playerPool.push(p);

      const e = new Projectile(scene);
      enemyGroup.add(e, true);
      e.setActive(false).setVisible(false);
      this.enemyPool.push(e);
    }
  }

  fire(x: number, y: number, angle: number, cfg: ProjectileConfig, team: 'player' | 'enemy'): Projectile | null {
    const pool = team === 'player' ? this.playerPool : this.enemyPool;
    const proj = pool.find((p) => !p.active);
    if (!proj) {
      console.warn('[ProjectileManager] Pool exhausted!');
      return null;
    }
    proj.fire(x, y, angle, cfg, team);
    return proj;
  }

  /**
   * Apply hit effect to a projectile: pierce decrement, life-steal heal.
   * Called from GameScene collision handlers instead of calling onHit() directly.
   */
  applyHitEffect(proj: Phaser.GameObjects.GameObject): void {
    const p = proj as unknown as Projectile;
    if (!p.active) return;
    const needsHeal = p.lifeSteal > 0 && p.team === 'player';
    p.onHit(needsHeal ? (amount) => this.healPlayer(amount) : undefined);
  }

  update(_time: number, delta: number): void {
    const nearestEnemy = this.getNearestEnemyPosition();
    for (const p of this.playerPool) {
      if (p.active) p.tick(delta, nearestEnemy);
    }
    for (const p of this.enemyPool) {
      if (p.active) p.tick(delta, null);
    }
  }

  private healPlayer(amount: number): void {
    this.scene.player?.heal(amount);
    EventBus.emit(GameEvents.LIFE_STEAL_HEAL, { amount });
  }

  /** Returns the position of the nearest alive enemy to the player, or null */
  private getNearestEnemyPosition(): { x: number; y: number } | null {
    const player = this.scene.player;
    if (!player) return null;

    let nearest: { x: number; y: number } | null = null;
    let bestDist = Infinity;

    for (const child of this.scene.enemyGroup.getChildren()) {
      const go = child as Phaser.GameObjects.GameObject & { x?: number; y?: number };
      if (!go.active || go.x === undefined || go.y === undefined) continue;
      const dx = (go.x as number) - player.x;
      const dy = (go.y as number) - player.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        nearest = { x: go.x as number, y: go.y as number };
      }
    }
    return nearest;
  }
}
