/** All game-wide event names as const — no magic strings anywhere */
export const GameEvents = {
  // Room
  ROOM_LOADED: 'room:loaded',
  ROOM_ACTIVE: 'room:active',
  ROOM_CLEARED: 'room:cleared',
  ROOM_TRANSITIONING: 'room:transitioning',
  // Currency
  SCRAP_CHANGED: 'currency:scrap_changed',
  CHIP_CHANGED: 'currency:chip_changed',
  META_SCRAP_CHANGED: 'currency:meta_scrap_changed',
  // Player
  PLAYER_DAMAGED: 'player:damaged',
  PLAYER_HEALED: 'player:healed',
  PLAYER_DIED: 'player:died',
  PLAYER_STAMINA_CHANGED: 'player:stamina_changed',
  PLAYER_STATS_CHANGED: 'player:stats_changed',
  // Enemy
  ENEMY_SPAWNED: 'enemy:spawned',
  ENEMY_DAMAGED: 'enemy:damaged',
  ENEMY_DIED: 'enemy:died',
  // Items & chips
  ITEM_ACQUIRED: 'item:acquired',
  ITEM_REMOVED: 'item:removed',
  CHIP_APPLIED: 'chip:applied',
  SHOP_DRAWN: 'shop:drawn',
  // Run lifecycle
  RUN_STARTED: 'run:started',
  RUN_ENDED: 'run:ended',
  ACT_CHANGED: 'run:act_changed',
  // Narrative
  NARRATIVE_FLAG_SET: 'narrative:flag_set',
  DIALOGUE_STARTED: 'dialogue:started',
  DIALOGUE_ENDED: 'dialogue:ended',
  LORE_FOUND: 'lore:found',
  // Progression
  ANIMAL_LEVELED_UP: 'progression:leveled_up',
  SKILL_UNLOCKED: 'progression:skill_unlocked',
  // Prestige
  PRESTIGE_UNLOCKED: 'prestige:unlocked',
  // Achievements
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  // Boss
  BOSS_SPAWNED: 'boss:spawned',
  BOSS_PHASE_CHANGED: 'boss:phase_changed',
  BOSS_DIED: 'boss:died',
  // Audio
  AUDIO_UNLOCKED: 'audio:unlocked',
  // Settings
  SETTINGS_CHANGED: 'settings:changed',
  // Combat
  COMBO_HIT: 'combat:combo_hit',
  CRIT_HIT: 'combat:crit',
  HIT_PAUSE: 'combat:hit_pause',
  // Loot
  LOOT_SPAWNED: 'loot:spawned',
  LOOT_COLLECTED: 'loot:collected',
  // Prestige
  PRESTIGE_TRACK_CLAIMED: 'prestige:track_claimed',
  // Hub
  HUB_SECRET_PATH_UNLOCKED: 'hub:secret_path_unlocked',
  // UI panel requests (used by non-UIScene callers to open an overlay)
  UI_PANEL_OPEN: 'ui:panel_open',
  // Room reward
  ROOM_REWARD_OPEN:       'room:reward_open',
  ROOM_REWARD_TAKEN:      'room:reward_taken',
  /** Fires when the reward UI closes for any reason (take OR skip). */
  ROOM_REWARD_DISMISSED:  'room:reward_dismissed',
  // Room navigation / transitions
  ROOM_EXIT_OPENED:        'room:exit_opened',
  ROOM_TRANSITION_START:   'room:transition_start',
  ROOM_TRANSITION_COMPLETE:'room:transition_complete',
  /** Emitted once after RunGraph is built; payload: { graph: RunGraph } */
  GRAPH_READY:             'run:graph_ready',
  /** Emitted whenever the active room changes; payload: { col, row, cleared } */
  ROOM_ENTERED:            'room:entered',
  // Weapon upgrades
  WEAPON_UPGRADED:   'weapon:upgraded',
  // Combat — life-steal heal
  LIFE_STEAL_HEAL:   'combat:life_steal_heal',
} as const;

export type GameEventKey = keyof typeof GameEvents;
export type GameEventValue = (typeof GameEvents)[GameEventKey];
