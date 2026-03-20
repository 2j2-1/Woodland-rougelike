/** Mirrors /public/content/items/*.json */
export interface StatModifierDefinition {
  stat: import('@/types/stats').StatType;
  operation: 'add' | 'multiply' | 'override';
  value: number;
}

export interface ItemDefinition {
  /** Unique identifier, matches filename without .json */
  itemId: string;
  /** Display name */
  name: string;
  /** Brief flavour text shown in shop */
  flavourText: string;
  /** Weapon | Trinket | Armour | Consumable */
  category: 'weapon' | 'trinket' | 'armour' | 'consumable';
  /** Scrap cost in the Blacksmith shop */
  cost: number;
  /** Roulette draw weight — higher = more common */
  weight: number;
  /** Stat changes when held */
  statModifiers: StatModifierDefinition[];
  /** Optional custom pickup behaviour ID */
  effectId?: string;
  /** If set, only appears when biome matches */
  allowedBiomes: string[];
  /** If set, only appears in these acts (1, 2, 3) */
  allowedActs: number[];
  /** If set, only available to these animal IDs */
  allowedAnimals: string[];
  /** If true, removed from pool once picked up */
  exclusive: boolean;
  /** Phaser texture key after atlas is loaded */
  spriteKey: string;
}

/** Mirrors /public/content/enemies/*.json */
export interface EnemyDefinition {
  enemyId: string;
  name: string;
  hp: number;
  speed: number;
  /** Base attack damage before defence calc */
  damage: number;
  /** 0-100, percentage damage reduction */
  defence: number;
  aggroRadius: number;
  attackRange: number;
  /** Milliseconds between attacks */
  attackCooldown: number;
  scrapDropMin: number;
  scrapDropMax: number;
  chipDropChance: number;
  /** Registered behaviour class identifier */
  behaviourId: string;
  spriteKey: string;
  isMini?: boolean;
  isBoss?: boolean;
}

/** Mirrors /public/content/chips/*.json */
export interface ChipDefinition {
  chipId: string;
  name: string;
  flavourText: string;
  tier: 'grey' | 'green' | 'gold' | 'red';
  /** Stat changes applied permanently for the run */
  statModifiers: StatModifierDefinition[];
  /** Optional custom chip effect ID */
  effectId?: string;
  spriteKey: string;
  weight: number;
}

/** Mirrors /public/content/animals/*.json */
export interface AnimalDefinition {
  animalId: string;
  name: string;
  lore: string;
  /** Base stats object */
  baseStats: {
    hp: number;
    speed: number;
    damage: number;
    defence: number;
    luck: number;
    stamina: number;
  };
  unlockCondition?: string;
  spriteKey: string;
}

/** Single node in an animal skill tree */
export interface SkillNode {
  /** Unique ID for this node */
  id: string;
  name: string;
  description: string;
  /** IDs of nodes that must be unlocked first (empty = root) */
  requires: string[];
  /** Skill points to unlock */
  cost: number;
  /** Optional effect handler registered in SkillEffectRegistry */
  effectId?: string;
  position?: { col: number; row: number };
}

/** Skill tree definition — flat node list */
export interface SkillTreeDefinition {
  id: string;
  name: string;
  nodes: SkillNode[];
}

/** Tiled room template definition */
export interface RoomTemplate {
  roomId: string;
  tilemapKey: string;
  biome: string;
  tags: string[];
  width: number;
  height: number;
}

/** Biome definition for grouping rooms + theming */
export interface BiomeDefinition {
  biomeId: string;
  name: string;
  tilesetKey: string;
  musicLayerId: string;
  ambientParticleId?: string;
}

/** Single line of dialogue for an NPC */
export interface DialogueNode {
  nodeId: string;
  speakerId: string;
  text: string;
  /** Flag IDs that must ALL be true for this node to be selectable */
  conditions: string[];
  /** Higher wins when multiple nodes match */
  priority: number;
  /** Next node ID to auto-chain, or null to close */
  nextNodeId: string | null;
}

/** Full dialogue tree for one NPC */
export interface DialogueTree {
  npcId: string;
  nodes: DialogueNode[];
}

/** Achievement definition */
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  condition: {
    type: 'kills' | 'runs_completed' | 'flag_set' | 'items_collected';
    value?: number;
    flagId?: string;
  };
  icon?: string;
}

/** Prestige track definition */
export interface PrestigeTrackDefinition {
  id: string;
  name: string;
  description: string;
  condition: {
    type: 'deaths_under' | 'runs_completed' | 'flag_set' | 'items_collected';
    value?: number;
    flagId?: string;
  };
  reward: {
    type: 'unlock_animal' | 'meta_scraps' | 'permanent_stat';
    id?: string;
    amount?: number;
    stat?: string;
  };
}

/** Content manifest loaded at boot */
export interface ContentManifest {
  items: string[];
  enemies: string[];
  chips: string[];
  animals: string[];
  weapons?: string[];
  rooms?: string[];
  dialogue: string[];
  skillTrees?: string[];
  achievements?: string;
  prestige?: string;
}

// ── Weapon definitions ────────────────────────────────────────────────────────
// Config-driven weapons that can be assigned to the player's ability slots.
// Add a new JSON file in /public/content/weapons/ and reference it in manifest.json
// to make it available in-game and in the dev mode weapon switcher.

export interface WeaponProjectileConfig {
  speed:          number;
  damageType?:    string;
  pierceCount?:   number;
  lifetime?:      number;
  spriteKey?:     string;
  scale?:         number;
  tint?:          number;
  /** Number of projectiles fired per shot (default 1). Set >1 for spread/shotgun weapons. */
  projectileCount?: number;
  /** Total spread arc in radians across all projectiles (default 0). */
  spreadAngle?:   number;
  /** If true the projectile steers towards the nearest enemy each frame. */
  homing?:        boolean;
  /** Steering angular acceleration (radians per second). Default 3.0. */
  homingStrength?: number;
  /** If true the projectile reflects off world bounds instead of expiring. */
  bouncing?:      boolean;
  /** Maximum number of wall bounces before expiring (default 2). */
  bounceCount?:   number;
  /** Fraction of dealt damage healed back to player (0–1). Default 0. */
  lifeSteal?:     number;
}

/**
 * Weapon upgrade — passively upgrades all projectile weapons the player fires.
 * Stored as items with a special effectId; applied via PickupEffectRegistry.
 */
export interface WeaponUpgradeDefinition {
  upgradeId:   string;
  name:        string;
  description: string;
  /** Which projectile fields to override/enhance when the upgrade is active */
  overrides:   Partial<WeaponProjectileConfig>;
}

export interface WeaponDefinition {
  weaponId:          string;
  name:              string;
  description:       string;
  /** 'projectile' fires a physics-based shot. 'melee' and 'area' reserved for future types. */
  type:              'projectile' | 'melee' | 'area';
  staminaCost:       number;
  cooldownMs:        number;
  /** Multiplier on top of the player's Damage stat. Default 1.0. */
  damageMultiplier?: number;
  spriteKey?:        string;
  projectile?:       WeaponProjectileConfig;
}
