import { ItemRegistry, ChipRegistry } from './Registry';
import type { ItemDefinition, ChipDefinition } from '@/types/content';
import { EventBus } from './EventBus';
import { GameEvents } from '@/types/events';

export interface ShopContext {
  biomeId: string;
  actNumber: number;
  animalId: string;
  alreadyHeldItemIds: string[];
  seenItemIds: string[];
  playerLuck: number;
}

/** Weighted draw WITHOUT replacement using the roulette wheel algorithm */
function weightedDrawWithoutReplacement<T extends { weight: number }>(
  pool: T[],
  count: number
): T[] {
  const remaining = [...pool];
  const drawn: T[] = [];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((s, item) => s + item.weight, 0);
    let roll = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < remaining.length - 1; idx++) {
      roll -= remaining[idx].weight;
      if (roll <= 0) break;
    }
    drawn.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return drawn;
}

export const ItemPoolService = {
  drawForShop(ctx: ShopContext): ItemDefinition[] {
    let pool = ItemRegistry.getAll();

    // Filter by biome
    pool = pool.filter((i) => i.allowedBiomes.length === 0 || i.allowedBiomes.includes(ctx.biomeId));
    // Filter by act
    pool = pool.filter((i) => i.allowedActs.length === 0 || i.allowedActs.includes(ctx.actNumber));
    // Filter by animal
    pool = pool.filter((i) => i.allowedAnimals.length === 0 || i.allowedAnimals.includes(ctx.animalId));
    // Remove exclusive items already held
    pool = pool.filter((i) => !(i.exclusive && ctx.alreadyHeldItemIds.includes(i.itemId)));
    // Remove already-seen this run
    pool = pool.filter((i) => !ctx.seenItemIds.includes(i.itemId));

    if (pool.length < 3) {
      console.warn(`[ItemPoolService] Item pool thin (${pool.length}) for act ${ctx.actNumber}. Add more items.`);
    }

    // Apply luck weight bonus
    const weighted = pool.map((i) => ({
      ...i,
      weight: i.weight * (1 + ctx.playerLuck * 0.025),
    }));

    const drawn = weightedDrawWithoutReplacement(weighted, 3);
    EventBus.emit(GameEvents.SHOP_DRAWN, { items: drawn });
    return drawn;
  },

  drawForChipTerminal(ctx: Omit<ShopContext, 'biomeId'>): ChipDefinition[] {
    const TIER_WEIGHTS = { grey: 60, green: 25, gold: 12, red: 3 };
    let pool = ChipRegistry.getAll().filter((c) => !ctx.seenItemIds.includes(c.chipId));

    if (pool.length === 0) pool = ChipRegistry.getAll();

    // Apply tier weighting
    const weighted = pool.map((c) => ({
      ...c,
      weight: TIER_WEIGHTS[c.tier] * (1 + ctx.playerLuck * 0.025),
    }));

    const drawn = weightedDrawWithoutReplacement(weighted, 3);

    // Guarantee at least 1 grey if pool is thin
    if (drawn.length < 3 && drawn.every((c) => c.tier !== 'grey')) {
      const greys = pool.filter((c) => c.tier === 'grey');
      if (greys.length > 0) drawn[drawn.length - 1] = greys[0];
    }

    return drawn;
  },
} as const;
