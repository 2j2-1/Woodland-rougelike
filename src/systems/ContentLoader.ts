import type {
  ItemDefinition,
  EnemyDefinition,
  ChipDefinition,
  AnimalDefinition,
  WeaponDefinition,
  DialogueTree,
  SkillTreeDefinition,
  AchievementDefinition,
  PrestigeTrackDefinition,
  ContentManifest,
} from '@/types/content';
import {
  ItemRegistry,
  EnemyRegistry,
  ChipRegistry,
  AnimalRegistry,
  WeaponRegistry,
} from './Registry';

const BASE = '/content';

// ── Field normalisers ─────────────────────────────────────────────────────
// JSON files may use short `id` instead of `itemId` etc.
// These fill in any missing aliased fields before validation.

/* eslint-disable @typescript-eslint/no-explicit-any */
function normaliseItem(d: any): any {
  d.itemId       = d.itemId     ?? d.id;
  d.flavourText  = d.flavourText ?? d.description ?? '';
  d.category     = d.category   ?? d.type         ?? 'trinket';
  d.allowedBiomes  = d.allowedBiomes  ?? [];
  d.allowedActs    = d.allowedActs    ?? [];
  d.allowedAnimals = d.allowedAnimals ?? [];
  d.exclusive      = d.exclusive      ?? false;
  d.spriteKey      = d.spriteKey      ?? '';
  d.statModifiers  = (d.statModifiers ?? []).map((m: any) => ({
    ...m, operation: m.operation ?? m.type,
  }));
  return d;
}

function normaliseEnemy(d: any): any {
  d.enemyId       = d.enemyId       ?? d.id;
  d.behaviourId   = d.behaviourId   ?? d.behaviour;
  d.damage        = d.damage        ?? d.attackDamage ?? 10;
  d.aggroRadius   = d.aggroRadius   ?? d.detectionRange ?? 180;
  d.attackCooldown = d.attackCooldown ?? 1500;
  d.scrapDropMin  = d.scrapDropMin  ?? 3;
  d.scrapDropMax  = d.scrapDropMax  ?? 8;
  d.chipDropChance = d.chipDropChance ?? 0.08;
  d.spriteKey     = d.spriteKey     ?? '';
  return d;
}

function normaliseChip(d: any): any {
  d.chipId      = d.chipId      ?? d.id;
  d.flavourText = d.flavourText ?? d.description ?? '';
  d.spriteKey   = d.spriteKey   ?? '';
  d.statModifiers = (d.statModifiers ?? []).map((m: any) => ({
    ...m, operation: m.operation ?? m.type,
  }));
  return d;
}

function normaliseAnimal(d: any): any {
  d.animalId   = d.animalId ?? d.id;
  d.lore       = d.lore     ?? d.description ?? '';
  d.spriteKey  = d.spriteKey ?? '';
  if (d.baseStats) {
    d.baseStats.hp     = d.baseStats.hp     ?? d.baseStats.maxHp;
    d.baseStats.damage = d.baseStats.damage ?? d.baseStats.attackPower ?? 10;
    d.baseStats.stamina = d.baseStats.stamina ?? d.baseStats.staminaMax ?? 100;
    d.baseStats.defence = d.baseStats.defence ?? d.baseStats.def ?? 0;
    d.baseStats.luck    = d.baseStats.luck   ?? 0;
    d.baseStats.speed   = d.baseStats.speed  ?? 150;
  }
  d.unlockCondition = d.unlockCondition ?? undefined;
  return d;
}

function normaliseWeapon(d: any): any {
  d.weaponId         = d.weaponId         ?? d.id;
  d.description      = d.description      ?? d.flavourText ?? '';
  d.type             = d.type             ?? 'projectile';
  d.staminaCost      = d.staminaCost      ?? 10;
  d.cooldownMs       = d.cooldownMs       ?? 500;
  d.damageMultiplier = d.damageMultiplier ?? 1.0;
  d.spriteKey        = d.spriteKey        ?? '';
  return d;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Fetches all game content JSON from /public/content/ at startup.
 * Validates each file and populates the typed registries.
 */
class ContentLoaderClass {
  private dialogueTrees   = new Map<string, DialogueTree>();
  private skillTrees      = new Map<string, SkillTreeDefinition>();
  private achievements:   AchievementDefinition[]  = [];
  private prestigeTracks: PrestigeTrackDefinition[] = [];
  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) return;

    const manifest = await this.fetchJSON<ContentManifest>(`${BASE}/manifest.json`);

    // Parallel-fetch all content groups
    const [rawItems, rawEnemies, rawChips, rawAnimals, dialogues, rawWeapons] = await Promise.all([
      this.fetchBatch<any>(manifest.items),
      this.fetchBatch<any>(manifest.enemies),
      this.fetchBatch<any>(manifest.chips),
      this.fetchBatch<any>(manifest.animals),
      this.fetchBatch<DialogueTree>(manifest.dialogue),
      manifest.weapons ? this.fetchBatch<any>(manifest.weapons) : Promise.resolve([]),
    ]);

    // Skill trees, achievements, prestige (optional)
    const [skillTrees, achievementsRaw, prestigeRaw] = await Promise.all([
      manifest.skillTrees ? this.fetchBatch<any>(manifest.skillTrees) : Promise.resolve([]),
      manifest.achievements ? this.fetchJSON<{ achievements: AchievementDefinition[] }>(
        `${BASE}/${manifest.achievements}`).catch(() => ({ achievements: [] })) : Promise.resolve({ achievements: [] }),
      manifest.prestige ? this.fetchJSON<{ tracks: PrestigeTrackDefinition[] }>(
        `${BASE}/${manifest.prestige}`).catch(() => ({ tracks: [] })) : Promise.resolve({ tracks: [] }),
    ]);

    rawItems.map(normaliseItem).forEach((d: ItemDefinition) => {
      if (this.validateRequired(d as unknown as Record<string, unknown>, ['itemId', 'name', 'category', 'cost'], String(d.itemId ?? '?')))
        ItemRegistry.register(d);
    });
    rawEnemies.map(normaliseEnemy).forEach((d: EnemyDefinition) => {
      if (this.validateRequired(d as unknown as Record<string, unknown>, ['enemyId', 'name', 'hp', 'behaviourId'], String(d.enemyId ?? '?')))
        EnemyRegistry.register(d);
    });
    rawChips.map(normaliseChip).forEach((d: ChipDefinition) => {
      if (this.validateRequired(d as unknown as Record<string, unknown>, ['chipId', 'name', 'tier'], String(d.chipId ?? '?')))
        ChipRegistry.register(d);
    });
    rawAnimals.map(normaliseAnimal).forEach((d: AnimalDefinition) => {
      if (this.validateRequired(d as unknown as Record<string, unknown>, ['animalId', 'name', 'baseStats'], String(d.animalId ?? '?')))
        AnimalRegistry.register(d);
    });
    rawWeapons.map(normaliseWeapon).forEach((d: WeaponDefinition) => {
      if (this.validateRequired(d as unknown as Record<string, unknown>, ['weaponId', 'name', 'type'], String(d.weaponId ?? '?')))
        WeaponRegistry.register(d);
    });
    dialogues.forEach((d) => {
      if (d?.npcId) this.dialogueTrees.set(d.npcId, d);
    });
    skillTrees.forEach((d: SkillTreeDefinition) => {
      if (d?.id) this.skillTrees.set(d.id, d);
    });
    this.achievements   = achievementsRaw.achievements ?? [];
    this.prestigeTracks = prestigeRaw.tracks ?? [];

    console.log(
      `[ContentLoader] Loaded: ${ItemRegistry.size} items, ` +
      `${EnemyRegistry.size} enemies, ${ChipRegistry.size} chips, ` +
      `${AnimalRegistry.size} animals, ${WeaponRegistry.size} weapons, ` +
      `${this.dialogueTrees.size} dialogue trees, ` +
      `${this.skillTrees.size} skill trees, ${this.achievements.length} achievements`,
    );
    this.loaded = true;
  }

  private async fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[ContentLoader] Failed to fetch ${url}: ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async fetchBatch<T>(paths: string[]): Promise<T[]> {
    const results = await Promise.allSettled(paths.map((p) => {
      const url = p.startsWith('/') ? p : `${BASE}/${p}`;
      return this.fetchJSON<T>(url);
    }));
    const out: T[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') out.push(r.value);
      else console.warn('[ContentLoader] Skipped file:', r.reason);
    }
    return out;
  }

  private validateRequired(obj: Record<string, unknown>, fields: string[], id: string): boolean {
    for (const f of fields) {
      if (obj[f] === undefined || obj[f] === null) {
        console.warn(`[ContentLoader] Skipping "${id}": missing "${f}"`);
        return false;
      }
    }
    return true;
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  getDialogueTree(npcId: string): DialogueTree | undefined {
    return this.dialogueTrees.get(npcId);
  }

  getSkillTree(id: string): SkillTreeDefinition | undefined {
    return this.skillTrees.get(id);
  }

  getAllAnimals(): AnimalDefinition[]           { return AnimalRegistry.getAll(); }
  getAllPrestigeTracks(): PrestigeTrackDefinition[] { return this.prestigeTracks; }
  getAllAchievements(): AchievementDefinition[]    { return this.achievements; }

  /** Filter items by shop context */
  getItemsForContext(ctx: {
    biomeId: string;
    actNumber: number;
    animalId: string;
    excludedIds: string[];
  }): ItemDefinition[] {
    return ItemRegistry.getFiltered((item) => {
      if (item.allowedBiomes.length > 0 && !item.allowedBiomes.includes(ctx.biomeId)) return false;
      if (item.allowedActs.length > 0  && !item.allowedActs.includes(ctx.actNumber))  return false;
      if (item.allowedAnimals.length > 0 && !item.allowedAnimals.includes(ctx.animalId)) return false;
      if (ctx.excludedIds.includes(item.itemId)) return false;
      return true;
    });
  }
}

export const ContentLoader = new ContentLoaderClass();
