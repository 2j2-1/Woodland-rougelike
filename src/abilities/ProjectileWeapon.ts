import type { IAbility }         from './IAbility';
import type { Player }            from '@/entities/Player';
import type { GameScene }         from '@/scenes/GameScene';
import type { WeaponDefinition }  from '@/types/content';
import { StatType }               from '@/types/stats';

/**
 * A fully config-driven projectile weapon.
 * To add a new ranged weapon, create a JSON file in /public/content/weapons/
 * and reference it in manifest.json — no code changes required.
 *
 * Weapon upgrades held by the player (multifire, homing, pierce, bounce,
 * lifesteal) are read from PlayerInventory.weaponUpgrades and layered on
 * top of the weapon's base projectile config each time it fires.
 *
 * Melee / area weapons should implement their own IAbility classes.
 */
export class ProjectileWeapon implements IAbility {
  readonly id:          string;
  readonly staminaCost: number;
  readonly cooldownMs:  number;

  private player:        Player;
  private def:           WeaponDefinition;
  private cooldownTimer  = 0;

  constructor(player: Player, def: WeaponDefinition) {
    this.player      = player;
    this.def         = def;
    this.id          = def.weaponId;
    this.staminaCost = def.staminaCost;
    this.cooldownMs  = def.cooldownMs;
  }

  canActivate(): boolean {
    return this.cooldownTimer <= 0 && this.player.stamina >= this.staminaCost;
  }

  activate(): void {
    if (!this.canActivate()) return;

    const pc = this.def.projectile;
    if (!pc) return; // safety guard for non-projectile type entries

    this.player.useStamina(this.staminaCost);
    this.cooldownTimer = this.cooldownMs;

    const scene     = this.player.scene as GameScene;
    const baseAngle = this.player.getAimAngle();
    const damage    = this.player.stats.getFinalValue(StatType.Damage);
    const pdmg      = Math.max(1, Math.floor(damage * (this.def.damageMultiplier ?? 1)));
    const upgrades  = this.player.inventory.weaponUpgrades;

    // Projectile count: base + multifire upgrade bonus
    const baseCount = pc.projectileCount ?? 1;
    const count     = upgrades.has('multifire') ? baseCount + 1 : baseCount;
    const spread    = pc.spreadAngle ?? 0;

    // Pierce: base + upgrade bonus
    const basePierce = pc.pierceCount ?? 0;
    const pierce     = upgrades.has('pierce') ? basePierce + 1 : basePierce;

    // Homing: from weapon OR upgrade
    const homing        = (pc.homing ?? false) || upgrades.has('homing');
    const homingStrength = pc.homingStrength ?? 3.0;

    // Bouncing: from weapon only (upgrade is handled via separate item)
    const bouncing   = pc.bouncing ?? false;
    const bounceCount = pc.bounceCount ?? 2;

    // Life steal: from weapon only (upgrade via lifesap-pendant item effect)
    const lifeSteal = pc.lifeSteal ?? 0;

    for (let i = 0; i < count; i++) {
      const offset = count > 1 ? spread * (i / (count - 1) - 0.5) : 0;
      const angle  = baseAngle + offset;

      scene.projectileManager.fire(
        this.player.x,
        this.player.y,
        angle,
        {
          speed:          pc.speed,
          damage:         pdmg,
          damageType:     pc.damageType  ?? 'physical',
          pierceCount:    pierce,
          lifetime:       pc.lifetime    ?? 2000,
          spriteKey:      pc.spriteKey   ?? 'projectile',
          scale:          pc.scale       ?? 0.8,
          tint:           pc.tint,
          homing,
          homingStrength,
          bouncing,
          bounceCount,
          lifeSteal,
        },
        'player',
      );
    }
  }

  update(delta: number): void {
    if (this.cooldownTimer > 0) this.cooldownTimer -= delta;
  }

  get remainingCooldown(): number {
    return Math.max(0, this.cooldownTimer);
  }
}
