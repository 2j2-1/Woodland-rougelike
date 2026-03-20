/**
 * Generic typed registry for game definitions.
 * Stores by ID, supports filtering, does NOT do any fetching.
 */
export class Registry<T extends object> {
  private readonly store = new Map<string, T>();
  private readonly idField: keyof T;

  constructor(idField: keyof T) {
    this.idField = idField;
  }

  register(def: T): void {
    const id = def[this.idField] as string;
    if (!id) throw new Error(`Registry: definition missing id field "${String(this.idField)}"`);
    this.store.set(id, def);
  }

  get(id: string): T | undefined {
    return this.store.get(id);
  }

  getOrThrow(id: string): T {
    const val = this.store.get(id);
    if (!val) throw new Error(`Registry: unknown id "${id}"`);
    return val;
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  getAll(): T[] {
    return Array.from(this.store.values());
  }

  getFiltered(predicate: (def: T) => boolean): T[] {
    return this.getAll().filter(predicate);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// ── Typed singleton registries ──────────────────────────────────────────────

import type {
  ItemDefinition,
  EnemyDefinition,
  ChipDefinition,
  AnimalDefinition,
  WeaponDefinition,
} from '@/types/content';

export const ItemRegistry    = new Registry<ItemDefinition>('itemId');
export const EnemyRegistry   = new Registry<EnemyDefinition>('enemyId');
export const ChipRegistry    = new Registry<ChipDefinition>('chipId');
export const AnimalRegistry  = new Registry<AnimalDefinition>('animalId');
/** Config-driven weapons that can be assigned to player ability slots. */
export const WeaponRegistry  = new Registry<WeaponDefinition>('weaponId');
