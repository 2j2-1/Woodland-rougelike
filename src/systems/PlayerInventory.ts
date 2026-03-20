import type { Player } from '@/entities/Player';
import type { ItemDefinition } from '@/types/content';
import { StatType } from '@/types/stats';
import type { OperationType } from '@/types/stats';
import { PickupEffectRegistry } from '@/effects/PickupEffectRegistry';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

const MAX_ACTIVE = 4;

export class PlayerInventory {
  private player: Player;
  passiveItems: ItemDefinition[] = [];
  activeItems:  ItemDefinition[] = [];
  /**
   * Weapon upgrade set — any string key added here is checked by
   * ProjectileWeapon and DashingKick when they activate.
   * Supported keys: 'multifire' | 'homing' | 'pierce' | 'extra_dash'
   */
  weaponUpgrades: Set<string> = new Set();

  constructor(player: Player) {
    this.player = player;
  }

  addItem(item: ItemDefinition): boolean {
    if (item.category !== 'consumable' && this.activeItems.length >= MAX_ACTIVE) {
      console.warn(`[Inventory] Active item slots full — cannot add ${item.itemId}`);
      return false;
    }

    if (item.category === 'consumable' || item.category === 'weapon') {
      this.activeItems.push(item);
    } else {
      this.passiveItems.push(item);
    }

    ItemEffectApplicator.apply(item, this.player);
    EventBus.emit(GameEvents.ITEM_ACQUIRED, { item });
    return true;
  }

  removeItem(itemId: string): void {
    const all = [...this.passiveItems, ...this.activeItems];
    const item = all.find((i) => i.itemId === itemId);
    if (!item) return;

    this.passiveItems = this.passiveItems.filter((i) => i.itemId !== itemId);
    this.activeItems  = this.activeItems .filter((i) => i.itemId !== itemId);

    // Remove stat modifiers from this item
    this.player.stats.removeModifier(itemId);
    EventBus.emit(GameEvents.ITEM_REMOVED, { item });
  }

  hasItem(itemId: string): boolean {
    return [...this.passiveItems, ...this.activeItems].some((i) => i.itemId === itemId);
  }

  /** Add a weapon upgrade by ID (e.g. 'multifire', 'homing', 'pierce', 'extra_dash'). */
  addWeaponUpgrade(upgradeId: string): void {
    this.weaponUpgrades.add(upgradeId);
    EventBus.emit(GameEvents.WEAPON_UPGRADED, { upgradeId });
  }

  hasWeaponUpgrade(upgradeId: string): boolean {
    return this.weaponUpgrades.has(upgradeId);
  }
}

export const ItemEffectApplicator = {
  apply(item: ItemDefinition, player: Player): void {
    for (const mod of item.statModifiers ?? []) {
      player.stats.applyModifier({
        stat: mod.stat as StatType,
        operation: mod.operation as OperationType,
        value: mod.value,
        source: item.itemId,
      });
    }

    if (item.effectId) {
      const effect = PickupEffectRegistry.get(item.effectId);
      effect?.onPickup(item, player);
    }
  },
} as const;
