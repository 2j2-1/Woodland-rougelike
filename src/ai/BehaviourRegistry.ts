import type { IBehaviour } from './IBehaviour';
import { MeleeBrawlerBehaviour } from './MeleeBrawlerBehaviour';
import { RangedScoutBehaviour } from './RangedScoutBehaviour';

type BehaviourConstructor = new () => IBehaviour;

const registry = new Map<string, BehaviourConstructor>();

export const BehaviourRegistry = {
  register(id: string, cls: BehaviourConstructor): void {
    registry.set(id, cls);
  },
  get(id: string): BehaviourConstructor | undefined {
    return registry.get(id);
  },
  getAll(): Map<string, BehaviourConstructor> {
    return registry;
  },
};

/**
 * Registers all built-in behaviours. Melee/ranged use direct (synchronous) imports
 * so they are ready immediately when the first enemy spawns — no async race condition.
 * Both hyphen and underscore variants are registered to match JSON `behaviour` field values.
 * Boss controller is still loaded lazily to avoid pulling in heavy boss-specific imports.
 */
export function registerDefaultBehaviours(): void {
  // Canonical underscore IDs used internally
  BehaviourRegistry.register('melee_brawler', MeleeBrawlerBehaviour as unknown as BehaviourConstructor);
  BehaviourRegistry.register('ranged_scout',  RangedScoutBehaviour  as unknown as BehaviourConstructor);
  // Hyphen variants that existing JSON files use
  BehaviourRegistry.register('melee-brawler', MeleeBrawlerBehaviour as unknown as BehaviourConstructor);
  BehaviourRegistry.register('ranged-scout',  RangedScoutBehaviour  as unknown as BehaviourConstructor);

  // Boss — kept async to avoid circular dependency chains
  import('@/bosses/BuddyBossController').then(({ BuddyBossController }) => {
    BehaviourRegistry.register('buddy-boss', BuddyBossController as unknown as BehaviourConstructor);
  });
}
