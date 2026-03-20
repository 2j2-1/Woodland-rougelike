import type { ItemDefinition } from './content';

/** Current run state — ephemeral, not persisted directly */
export interface RunState {
  animalId: string;
  actNumber: number;
  roomsCleared: number;
  enemiesKilled: number;
  scrapsEarned: number;
  chipsCollected: number;
  /** Item IDs held this run */
  heldItemIds: string[];
  /** Item IDs seen in shops this run (won't re-appear) */
  seenItemIds: string[];
  /** Chip IDs applied this run */
  appliedChipIds: string[];
  startTime: number;
  isActive: boolean;
}

export type RoomState = 'entering' | 'active' | 'cleared' | 'transitioning';

export type GamePhase =
  | 'boot'
  | 'mainMenu'
  | 'hub'
  | 'inRun'
  | 'paused'
  | 'runComplete'
  | 'gameOver';

export type DamageType = 'physical' | 'poison' | 'electric' | 'fire' | 'true';

/** Serialisable save data written to Vercel Postgres */
export interface SaveData {
  /** Schema version for migrations */
  version: number;
  /** UUID generated on first play, stored in localStorage */
  userId: string;
  /** Unlocked animal IDs */
  unlockedAnimals: string[];
  /** EXP per animal: { bunny: 340, toad: 120 } */
  animalExp: Record<string, number>;
  /** Available skill points per animal */
  skillPoints: Record<string, number>;
  /** Unlocked skill node IDs per animal */
  unlockedSkills: Record<string, string[]>;
  /** Prestige track IDs that have been claimed */
  claimedPrestigeTracks: string[];
  /** Feature flags unlocked by prestige */
  unlockedFeatures: string[];
  /** Narrative flag IDs that are set */
  narrativeFlags: string[];
  /** Memo IDs found across all runs */
  foundMemoIds: string[];
  /** Achievement IDs unlocked */
  unlockedAchievements: string[];
  /** Persistent currency for hub purchases */
  metaScraps: number;
  /** Lifetime scraps for prestige tracking */
  totalScrapsEarned: number;
  totalScrapsSpent: number;
  /** Number of times BUDDY has been defeated */
  totalBossDefeats: number;
  /** Total runs started */
  totalRunsStarted: number;
  /** Total runs completed (reached end) */
  totalRunsCompleted: number;
  /** Per-animal death count */
  deathsPerAnimal: Record<string, number>;
  /** Settings */
  settings: SettingsData;
  playtimeSeconds: number;
  lastSavedAt: string;
}

export interface SettingsData {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  fullscreen: boolean;
  colourblindMode: boolean;
  reducedMotion: boolean;
  textScale: number;
  controllerVibration: boolean;
  aimAssistStrength: number;
  showDamageNumbers: boolean;
  autosave: boolean;
}

export const DEFAULT_SETTINGS: SettingsData = {
  masterVolume: 1.0,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  fullscreen: false,
  colourblindMode: false,
  reducedMotion: false,
  textScale: 1.0,
  controllerVibration: true,
  aimAssistStrength: 0.5,
  showDamageNumbers: true,
  autosave: true,
};

export const DEFAULT_SAVE: Omit<SaveData, 'userId'> = {
  version: 2,
  unlockedAnimals: ['bunny'],
  animalExp: {},
  skillPoints: {},
  unlockedSkills: {},
  claimedPrestigeTracks: [],
  unlockedFeatures: [],
  narrativeFlags: [],
  foundMemoIds: [],
  unlockedAchievements: [],
  metaScraps: 0,
  totalScrapsEarned: 0,
  totalScrapsSpent: 0,
  totalBossDefeats: 0,
  totalRunsStarted: 0,
  totalRunsCompleted: 0,
  deathsPerAnimal: {},
  settings: DEFAULT_SETTINGS,
  playtimeSeconds: 0,
  lastSavedAt: new Date().toISOString(),
};

export interface RunSummary {
  animalId: string;
  animalName: string;
  roomsCleared: number;
  enemiesKilled: number;
  scrapsEarned: number;
  scrapsKept: number;
  chipsCollected: number;
  itemsFound: ItemDefinition[];
  durationSeconds: number;
  completed: boolean;
}
