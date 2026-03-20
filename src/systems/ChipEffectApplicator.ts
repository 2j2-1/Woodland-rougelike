import type { ChipDefinition } from '@/types/content';
import type { Player } from '@/entities/Player';
import { StatType } from '@/types/stats';
import type { OperationType } from '@/types/stats';

export interface IChipEffect {
  onApply(chip: ChipDefinition, player: Player): void;
}

class OverclockEffect implements IChipEffect {
  onApply(_chip: ChipDefinition, player: Player): void {
    player.stats.applyModifier({
      stat: StatType.Speed, operation: 'multiply', value: 1.3, source: 'chip:overclock',
    });
    player.stats.applyModifier({
      stat: StatType.Damage, operation: 'multiply', value: 1.2, source: 'chip:overclock',
    });
  }
}

class RedundantCoreEffect implements IChipEffect {
  onApply(_chip: ChipDefinition, player: Player): void {
    // Grant 1 free death prevention — stored as a flag on player
    (player as unknown as { hasRedundantCore: boolean }).hasRedundantCore = true;
  }
}

class JuryRigEffect implements IChipEffect {
  onApply(_chip: ChipDefinition, player: Player): void {
    // Convert 3 scraps → 1 chip on each room clear (handled by EventBus listener)
    import('@/systems/EventBus').then(({ EventBus }) => {
      import('@/types/events').then(({ GameEvents }) => {
        import('@/systems/CurrencyManager').then(({ CurrencyManager }) => {
          EventBus.on(GameEvents.ROOM_CLEARED, () => {
            if (CurrencyManager.spendRunScraps(3)) CurrencyManager.addChip();
          }, player);
        });
      });
    });
  }
}

class ChipEffectRegistryClass {
  private store = new Map<string, IChipEffect>([
    ['overclock',      new OverclockEffect()],
    ['redundant_core', new RedundantCoreEffect()],
    ['jury_rig',       new JuryRigEffect()],
  ]);

  register(id: string, effect: IChipEffect): void {
    this.store.set(id, effect);
  }

  get(id: string): IChipEffect | undefined {
    return this.store.get(id);
  }
}

const ChipEffectRegistry = new ChipEffectRegistryClass();

export const ChipEffectApplicator = {
  apply(chip: ChipDefinition, player: Player): void {
    for (const mod of chip.statModifiers ?? []) {
      player.stats.applyModifier({
        stat:      mod.stat as StatType,
        operation: mod.operation as OperationType,
        value:     mod.value,
        source:    `chip:${chip.chipId}`,
      });
    }
    if (chip.effectId) {
      ChipEffectRegistry.get(chip.effectId)?.onApply(chip, player);
    }
  },
} as const;
