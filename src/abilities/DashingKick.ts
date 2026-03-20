import Phaser from 'phaser';
import type { IAbility } from './IAbility';
import type { Player } from '@/entities/Player';
import { TrailEffect } from '@/effects/TrailEffect';
import { HitPauseManager } from '@/systems/HitPauseManager';
import type { GameScene } from '@/scenes/GameScene';

const DASH_SPEED     = 900;
const DASH_DURATION  = 120;
const DAMAGE_MULT    = 1.5;

export class DashingKick implements IAbility {
  readonly id = 'dashing_kick';
  readonly staminaCost = 25;
  readonly cooldownMs  = 800;

  private player: Player;
  private cooldownTimer = 0;
  private hitEnemies = new Set<Phaser.GameObjects.GameObject>();
  private dashTimer = 0;
  /** Extra charges granted by the 'extra_dash' weapon upgrade */
  private charges = 0;

  constructor(player: Player) {
    this.player = player;
  }

  canActivate(): boolean {
    const hasCharge = this.charges > 0;
    return (this.cooldownTimer <= 0 || hasCharge) &&
           !this.player.isDashing &&
           this.player.stamina >= this.staminaCost;
  }

  activate(): void {
    if (!this.canActivate()) return;

    // If on cooldown but we have a stored charge, spend it instead
    if (this.cooldownTimer > 0 && this.charges > 0) {
      this.charges--;
    }

    this.player.useStamina(this.staminaCost);
    this.player.isDashing    = true;
    this.player.isInvincible = true;
    this.dashTimer = DASH_DURATION;
    this.hitEnemies.clear();

    const angle = this.player.getAimAngle();
    const bod = this.player.body as Phaser.Physics.Arcade.Body;
    bod.setVelocity(Math.cos(angle) * DASH_SPEED, Math.sin(angle) * DASH_SPEED);

    this.player.trail.activate();

    const scene = this.player.scene as GameScene;

    // Check enemy collisions during dash
    const overlapCheck = scene.time.addEvent({
      delay: 16,
      repeat: Math.ceil(DASH_DURATION / 16),
      callback: () => this.checkHits(scene),
    });

    scene.time.delayedCall(DASH_DURATION, () => {
      overlapCheck.remove();
      this.endDash();
    });
  }

  private checkHits(scene: GameScene): void {
    const damage = scene.player.stats.getFinalValue
      ? scene.player.stats.getFinalValue(/* StatType.Damage */ 'Damage' as Parameters<typeof scene.player.stats.getFinalValue>[0])
      : 12;

    scene.enemyGroup.getChildren().forEach((enemy) => {
      if (this.hitEnemies.has(enemy)) return;
      const e = enemy as unknown as Phaser.Physics.Arcade.Sprite & { takeDamage?: (n: number) => void };
      if (!e.active) return;

      const d = Phaser.Math.Distance.Between(
        scene.player.x, scene.player.y, e.x, e.y
      );
      if (d < 48) {
        this.hitEnemies.add(enemy);
        e.takeDamage?.(Math.floor(damage * DAMAGE_MULT));

        // Knockback
        const angle = Phaser.Math.Angle.Between(scene.player.x, scene.player.y, e.x, e.y);
        const bod = e.body as Phaser.Physics.Arcade.Body | undefined;
        bod?.setVelocity(Math.cos(angle) * 300, Math.sin(angle) * 300);

        scene.cameraController.shake('dashImpact');
        HitPauseManager.triggerLight();
      }
    });

    // Reflect enemy projectiles
    scene.enemyProjectileGroup.getChildren().forEach((proj) => {
      const p = proj as unknown as Phaser.Physics.Arcade.Sprite;
      const d = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, p.x, p.y);
      if (d < 56) {
        const bod = p.body as Phaser.Physics.Arcade.Body | undefined;
        if (bod) {
          bod.setVelocity(-bod.velocity.x, -bod.velocity.y);
          (p as unknown as { team?: string }).team = 'player';
          scene.projectileGroup.add(p);
          scene.enemyProjectileGroup.remove(p);
        }
      }
    });
  }

  private endDash(): void {
    this.player.isDashing    = false;
    this.player.isInvincible = false;
    this.cooldownTimer = this.cooldownMs;
    this.player.trail.deactivate();

    // Refill charge if player has the upgrade and we've just started cooldown
    if (this.player.inventory.hasWeaponUpgrade('extra_dash') && this.charges < 1) {
      this.charges = 1;
    }

    const bod = this.player.body as Phaser.Physics.Arcade.Body;
    bod.setVelocity(0, 0);
  }

  update(delta: number): void {
    if (this.cooldownTimer > 0) this.cooldownTimer -= delta;
    if (this.dashTimer > 0) this.dashTimer -= delta;
  }

  get remainingCooldown(): number { return Math.max(0, this.cooldownTimer); }
}

void TrailEffect; // used in Player, here for tree-shaking awareness
