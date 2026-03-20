import type { Player } from '@/entities/Player';
import type { ItemDefinition } from '@/types/content';
import { StatType } from '@/types/stats';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

export interface IPickupEffect {
  onPickup(item: ItemDefinition, player: Player): void;
}

class HealOnPickup implements IPickupEffect {
  onPickup(_item: ItemDefinition, player: Player): void {
    player.heal(20);
  }
}

class DashChargeBonus implements IPickupEffect {
  onPickup(_item: ItemDefinition, _player: Player): void {
    // Stub — DashingKick would need extra charge logic
  }
}

class LuckAura implements IPickupEffect {
  onPickup(_item: ItemDefinition, player: Player): void {
    player.stats.applyModifier({
      stat: StatType.Luck,
      operation: 'add',
      value: 5,
      source: 'luck_aura_passive',
    });
  }
}

/**
 * Lifesteal — registers a one-time ENEMY_DAMAGED listener that heals the
 * player for a fraction of every hit they deal. The effect persists for the
 * entire run (listener is never removed) which is correct for a passive item.
 */
class LifestealEffect implements IPickupEffect {
  private static readonly FRACTION = 0.15; // 15 % of damage dealt

  onPickup(_item: ItemDefinition, player: Player): void {
    EventBus.on(
      GameEvents.ENEMY_DAMAGED,
      ({ amount }: { amount: number }) => {
        if (!player.active) return;
        const heal = Math.max(1, Math.floor(amount * LifestealEffect.FRACTION));
        player.heal(heal);
      },
    );
  }
}

/**
 * Regen — ticks a small heal every second for the rest of the run.
 * Uses a simple interval stored on the player's scene so it auto-cleans
 * with the scene lifecycle.
 */
class RegenEffect implements IPickupEffect {
  private static readonly HP_PER_SEC = 2;
  private static readonly INTERVAL   = 1000; // ms

  onPickup(_item: ItemDefinition, player: Player): void {
    // Guard: only register once (idempotent)
    if ((player as unknown as Record<string, unknown>)['_regenRegistered']) return;
    (player as unknown as Record<string, unknown>)['_regenRegistered'] = true;

    player.scene.time.addEvent({
      delay: RegenEffect.INTERVAL,
      loop: true,
      callback: () => {
        if (player.active) player.heal(RegenEffect.HP_PER_SEC);
      },
    });
  }
}

/** Weapon upgrade pickups — each one adds a string key to the player's weaponUpgrades set */
class WeaponUpgradeEffect implements IPickupEffect {
  constructor(private upgradeId: string) {}

  onPickup(_item: ItemDefinition, player: Player): void {
    player.inventory.addWeaponUpgrade(this.upgradeId);
  }
}

class PickupEffectRegistryClass {
  private store = new Map<string, IPickupEffect>([
    ['heal_on_pickup',               new HealOnPickup()],
    ['dash_charge_bonus',            new DashChargeBonus()],
    ['luck_aura',                    new LuckAura()],
    ['lifesteal',                    new LifestealEffect()],
    ['regen',                        new RegenEffect()],
    ['weapon_upgrade_multifire',     new WeaponUpgradeEffect('multifire')],
    ['weapon_upgrade_homing',        new WeaponUpgradeEffect('homing')],
    ['weapon_upgrade_pierce',        new WeaponUpgradeEffect('pierce')],
    ['weapon_upgrade_extra_dash',    new WeaponUpgradeEffect('extra_dash')],
  ]);

  register(id: string, effect: IPickupEffect): void {
    this.store.set(id, effect);
  }

  get(id: string): IPickupEffect | undefined {
    return this.store.get(id);
  }
}

export const PickupEffectRegistry = new PickupEffectRegistryClass();
