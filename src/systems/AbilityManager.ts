import type { Player } from '@/entities/Player';
import type { IAbility } from '@/abilities/IAbility';

type AbilitySlot = 'primary' | 'secondary';

export class AbilityManager {
  private player: Player;
  private abilities = new Map<AbilitySlot, IAbility>();

  constructor(player: Player) {
    this.player = player;
  }

  setAbility(slot: AbilitySlot, ability: IAbility): void {
    this.abilities.set(slot, ability);
  }

  activateSlot(slot: AbilitySlot): void {
    const ability = this.abilities.get(slot);
    if (!ability) return;
    if (ability.canActivate()) ability.activate();
  }

  update(delta: number): void {
    for (const ability of this.abilities.values()) {
      ability.update(delta);
    }
  }

  getRemainingCooldown(slot: AbilitySlot): number {
    return this.abilities.get(slot)?.remainingCooldown ?? 0;
  }

  void(_player: Player): void {} // suppress unused warning
}

void AbilityManager.prototype.void;
