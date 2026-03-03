# Circuit Grove — Browser Implementation Prompt System
### *Phased prompts for a production-quality browser roguelike*

---

## Architecture Decision Record

Before touching code, understand why we're making each technical choice:

| Decision | Choice | Why |
|----------|--------|-----|
| Renderer | **Phaser 3 (WebGL + Canvas fallback)** | Battle-tested game framework, built-in physics, tilemaps, camera, input, asset loading, tweens. Not reinventing the wheel. |
| Language | **TypeScript** | Type safety on game data models prevents entire categories of config bugs. Autocomplete on your item/enemy definitions. |
| Bundler | **Vite** | Fast HMR during dev, simple config, excellent TS support. Zero config for our use case. |
| State | **Plain TypeScript classes + EventEmitter** | No React overhead in a game loop. Events for cross-system comms. |
| Persistence | **localStorage + IndexedDB** | localStorage for settings/meta, IndexedDB via idb library for large save files. |
| Config | **JSON files in /public/content/** | Loaded at runtime via fetch. Add a file = new content. Zero rebuild required. |
| Art | **Phaser TextureAtlas + AI-generated sprites** | Pack sprites into atlas for GPU batch rendering. Single draw call per atlas. |
| Tilemaps | **Tiled + Phaser Tilemaps** | Industry standard. Export JSON from Tiled editor, Phaser loads natively. |
| Audio | **Howler.js** | Better than Web Audio API directly. Sprite sheets, spatial audio, adaptive music. |
| Deployment | **Static files** | Host anywhere: GitHub Pages, Netlify, Vercel, itch.io. No server needed. |

**What browser-based actually changes vs Unity:**
- ✅ No install, runs in browser — instant player access
- ✅ Deploy is `npm run build` + upload a folder  
- ✅ Hot reload during development is instant
- ✅ Same config-driven JSON architecture, actually easier to implement
- ✅ Debug in Chrome DevTools — far superior to Unity console
- ⚠️ Performance ceiling is lower — design around it (our isometric 2D is fine)
- ⚠️ Audio autoplay restrictions — must be triggered by user interaction first
- ⚠️ No native filesystem — all persistence via Web APIs

---

## Pre-Flight Setup (Do This First)

```bash
# Install Node.js 20 LTS from nodejs.org first

npm create vite@latest circuit-grove -- --template vanilla-ts
cd circuit-grove
npm install phaser@3.80.1
npm install howler @types/howler
npm install idb
npm install -D @types/node

# Your folder structure after setup:
# circuit-grove/
#   src/           ← All TypeScript source
#   public/        ← Static files (loads via fetch at runtime)
#     content/     ← ALL JSON configs go here
#       items/
#       enemies/
#       chips/
#       animals/
#       rooms/
#       dialogue/
#     assets/      ← Sprites, audio
#   index.html
#   vite.config.ts
```

**Tiled Map Editor:** Download from mapeditor.org (free). You'll use this to design room layouts and export them as JSON that Phaser loads natively.

**Golden Rule:** After each phase, `npm run dev` must work with zero console errors. Red errors = stop and fix before continuing.

---

---

# PHASE 1 — PROJECT FOUNDATION & DATA ARCHITECTURE

**Goal:** TypeScript project with all type definitions, content loader, and a Phaser scene that boots.

---

```
You are a senior TypeScript/Phaser 3 game developer building "Circuit Grove" — a browser-based roguelike dungeon crawler. British woodland animals fight corrupted animatronic enemies deployed by an evil corporation. Think Binding of Isaac room structure + Hades narrative.

Stack: Phaser 3.80, TypeScript, Vite, Howler.js for audio, idb for IndexedDB saves.

This is Phase 1. I need the complete project foundation. Give me every file, every line. No pseudocode. No "you would implement this here". Real, working TypeScript that compiles and runs.

## 1. vite.config.ts
Configure Vite for:
- TypeScript strict mode
- /public/content/ accessible via fetch at runtime (not bundled)
- Path alias: @/ maps to src/
- Build output: dist/ as flat static files (no subfolder nesting)

## 2. tsconfig.json
Strict TypeScript config appropriate for a Phaser 3 game. Include:
- strict: true
- DOM lib (for Web APIs)
- Correct module resolution for Phaser

## 3. Complete Type Definitions (src/types/)

Write these files with full JSDoc comments on every type:

**src/types/content.ts** — mirrors JSON config schemas exactly:
```
interface ItemDefinition {
  itemId: string
  category: 'weapon' | 'armour' | 'trinket' | 'consumable' | 'blueprint' | 'techPart' | 'lore'
  displayName: string
  description: string
  flavourText: string
  scrapCost: number
  statModifiers: StatModifier[]
  onPickupEffectId?: string    // references a registered PickupEffect
  onHitEffectId?: string
  allowedAnimals: string[]     // empty = all
  allowedActs: number[]        // empty = all
  allowedBiomes: string[]      // empty = all
  weight: number
  exclusive: boolean
  spriteKey: string
}
```
Define similarly complete interfaces for: EnemyDefinition, ChipDefinition, AnimalDefinition, SkillNode, RoomTemplate, BiomeDefinition, DialogueNode, DialogueTree, AchievementDefinition, PrestigeTrack

**src/types/game.ts** — runtime state (not persisted to disk as-is):
- RunState (current run: scraps, chips, items held, rooms cleared, current act, current animal)
- RoomState ('entering' | 'active' | 'cleared' | 'transitioning')
- GamePhase ('boot' | 'mainMenu' | 'hub' | 'inRun' | 'paused' | 'runComplete' | 'gameOver')

**src/types/stats.ts**:
- StatType enum: HP, MaxHP, Speed, Damage, Defence, Luck, Stamina, MaxStamina
- OperationType: 'add' | 'multiply' | 'override'
- StatModifier: { stat: StatType, operation: OperationType, value: number, source: string }
- PlayerStats class with: base stats, applyModifier(m), removeModifier(source), getFinalValue(stat), event emitter on change

**src/types/events.ts** — all game event names as a const enum (no magic strings anywhere):
```
const GameEvents = {
  ROOM_CLEARED: 'room:cleared',
  ENEMY_DIED: 'enemy:died',
  PLAYER_DAMAGED: 'player:damaged',
  PLAYER_DIED: 'player:died',
  SCRAP_CHANGED: 'currency:scraps_changed',
  CHIP_CHANGED: 'currency:chips_changed',
  ITEM_OBTAINED: 'item:obtained',
  CHIP_APPLIED: 'chip:applied',
  RUN_STARTED: 'run:started',
  RUN_ENDED: 'run:ended',
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  NARRATIVE_FLAG_SET: 'narrative:flag_set',
  ANIMAL_LEVELED_UP: 'progression:leveled_up',
  SKILL_UNLOCKED: 'progression:skill_unlocked',
  PRESTIGE_UNLOCKED: 'prestige:unlocked',
} as const
```

## 4. ContentLoader (src/systems/ContentLoader.ts)
Loads all JSON from /public/content/ at game startup via fetch.

Requirements:
- loadAll(): Promise<void> — fetches a manifest.json first (list of all content files), then parallel-fetches all of them
- Typed registries: Map<string, ItemDefinition>, Map<string, EnemyDefinition>, etc.
- Validates each loaded object has required fields (id field present, no undefined on critical props)
- On validation failure: logs detailed error with file path, skips the broken file, does NOT crash
- Reports at end: "Content loaded: 30 items, 25 enemies, 30 chips, 16 animals" etc.
- getItem(id), getEnemy(id), getChip(id), getAnimal(id), getAllItems(), getItemsForContext(ctx) methods
- getItemsForContext filters by biome, act, animal, and excluded IDs

Write the manifest.json format (I'll maintain this manually or generate it with a script — write the generation script too as a Node.js script: scripts/generateManifest.ts)

## 5. Registry (src/systems/Registry.ts)
Typed singleton registries — NOT ContentLoader (that fetches). Registry just stores and queries.
- ItemRegistry, EnemyRegistry, ChipRegistry, AnimalRegistry
- Each: register(def), get(id), getAll(), getFiltered(predicate), has(id)

## 6. EventBus (src/systems/EventBus.ts)
Simple typed event emitter:
- Wraps Phaser.Events.EventEmitter
- emit<T>(event: keyof typeof GameEvents, data?: T)
- on<T>(event: keyof typeof GameEvents, callback: (data: T) => void, context?: any)
- off(event, callback, context)
- once(event, callback, context)
- Export as singleton

## 7. Main Entry Point (src/main.ts)
Phaser game config and boot sequence:
- WebGL renderer, Canvas fallback
- Resolution: 1280x720 base, scale manager to fit browser window (FIT mode, centred)
- PixelArt: false (we're doing illustrated sprites not pixel art)
- Transparent background: false, background colour #1a1a0a (near-black warm tone)
- Physics: Arcade physics
- Scenes registered (in order): BootScene, PreloadScene, MainMenuScene, HubScene, GameScene, UIScene
- UIScene runs parallel to GameScene (separate camera, handles HUD)

## 8. BootScene (src/scenes/BootScene.ts)
- Shows "Circuit Grove" text on black while loading
- Runs ContentLoader.loadAll()
- Shows loading bar (a simple animated line, not a Unity progress bar — style it)
- On complete: transitions to PreloadScene

## 9. PreloadScene (src/scenes/PreloadScene.ts)
Loads all Phaser assets (sprites, tilemaps, audio) declared in an asset manifest.
- Reads asset list from /public/assets/asset-manifest.json
- Loads: texture atlases (packed sprite sheets), tilemaps, audio sprites
- Progress bar updates in BootScene style
- On complete: transitions to MainMenuScene
- Provide the asset-manifest.json schema

## 10. Sample JSON Content Files
Write complete, valid JSON for:
- /public/content/items/acorn-sling.json (weapon)
- /public/content/items/four-leaf-clover.json (trinket)
- /public/content/items/bark-vest.json (armour)
- /public/content/enemies/robo-pheasant-mk1.json
- /public/content/enemies/badger-bot-3000.json
- /public/content/chips/overclock.json
- /public/content/chips/redundant-core.json
- /public/content/animals/bunny.json
- /public/content/manifest.json (lists all content files)

All must exactly match the TypeScript interface schemas.

## 11. scripts/generateManifest.ts
Node.js script that:
- Scans /public/content/ recursively
- Finds all .json files (excluding manifest.json itself)
- Groups by subdirectory (items, enemies, etc.)
- Writes manifest.json
- Run with: npx ts-node scripts/generateManifest.ts

Deliverable: every file listed above, complete, no gaps.
```

**Verify after Phase 1:**
- `npm run dev` launches, browser opens, BootScene loads ContentLoader, console shows content summary
- No TypeScript errors (`npx tsc --noEmit`)
- All 9 sample JSON files load successfully

---
---

# PHASE 2 — TILEMAP ROOMS & SCENE STRUCTURE

**Goal:** A working room that loads from Tiled JSON, renders correctly, spawns enemies, locks/unlocks, and transitions.

---

```
Continuing Circuit Grove (TypeScript + Phaser 3). Phase 1 complete: content loader, type definitions, boot sequence all working. 

Paste in: your RoomTemplate interface, your GameEvents const, your RunState type.

Now implement Phase 2: the complete room system.

## Tiled Integration

**Room templates are designed in Tiled and exported as JSON.** Phaser loads them natively. Our convention:

Tiled layers (each room JSON has these layers):
- "ground" — floor tiles (Tilemap layer)  
- "obstacles" — walls, rocks, logs (Tilemap layer, with collision)
- "decoration" — visual-only props (Tilemap layer)
- "objects" — Tiled Object layer containing:
  - type "enemy_spawn": {enemyId, waveNumber, x, y}
  - type "exit_door": {exitIndex, biomeHint, x, y}
  - type "player_spawn": {x, y}
  - type "blacksmith_spawn": {x, y} (optional)
  - type "chip_terminal": {x, y} (optional)
  - type "lore_item": {memoId, x, y} (optional)
  - type "hazard": {hazardType, x, y}

Write Tiled setup instructions (which tilesets, which properties to set on each object type).

## RoomManager (src/systems/RoomManager.ts)

Complete implementation:

**loadRoom(templateId: string, biomeId: string): Promise<void>**
- Fetch room template JSON from /public/content/rooms/{templateId}.json
- Create Phaser tilemap from the JSON (scene.make.tilemap)
- Add tileset image (loaded in PreloadScene)
- Create tilemap layers
- Enable collision on "obstacles" layer (setCollisionByProperty or setCollisionBetween)
- Parse Objects layer: create EnemySpawnPoints, ExitDoors, interactables
- Set RoomState to 'entering'
- Emit ROOM_LOADED event

**Enemy Wave System:**
- Group enemies by their waveNumber property
- Spawn wave 1 immediately when RoomState transitions to 'active'
- Track all living enemies in Set<Enemy>
- When Set size < 25% of wave count: spawn next wave
- When Set is empty and all waves spawned: onRoomCleared()

**onRoomCleared():**
- RoomState = 'cleared'
- Animate exit doors opening (tween: door sprite scale from 0.8 to 1.0, colour shift from dark to bright)
- Spawn loot (scraps) from enemies' drop tables
- Emit ROOM_CLEARED event
- Show exit selection UI

**Exit Door System:**
- ExitDoor class: Phaser.GameObjects.Container with door sprite + biome icon + hint icons
- Biome hint icon shows next room's biome (drawn from available rooms in that biome)
- Optional hint icons: scrap bag (if Blacksmith guaranteed next), chip icon (if terminal present)
- Player collides with exit door → triggerExit(exitIndex)
- triggerExit: lock all other doors (dim + non-interactive), begin transition

**Room Transition:**
- TransitionManager.ts: camera fade to black (scene.cameras.main.fadeOut 400ms)
- While black: RoomManager.destroyCurrentRoom(), RoomManager.loadRoom(nextRoomId)
- Camera fade in (400ms)
- Player repositioned to new room's player_spawn point

## GameScene (src/scenes/GameScene.ts)

The main gameplay scene. Implements:
- create(): initialise all systems, load first room
- update(time, delta): game loop — input → physics → AI → UI
- Systems owned by GameScene (instantiate and store references):
  - RoomManager
  - EnemyManager  
  - ProjectileManager
  - LootManager
  - InteractionManager
  - Player (the player object)

**Camera setup:**
- Main camera follows player
- Bounds set to room dimensions on each room load
- Lerp: 0.1 (smooth follow)
- Zoom: 1.0 default (design rooms at 1280x720)

**Physics groups:**
- playerGroup (static, just player)
- enemyGroup
- projectileGroup (player projectiles)
- enemyProjectileGroup
- lootGroup
- Define all colliders: player↔obstacles, enemies↔obstacles, playerProjectiles↔enemies, enemyProjectiles↔player, player↔loot

## UIScene (src/scenes/UIScene.ts)

Runs in parallel with GameScene. Has its own camera (no scroll). Manages:
- HUD: HP bar, Stamina bar, Scrap counter, Chip counter, minimap placeholder
- Pause menu (toggled, blurs GameScene)
- All in-run popups (Blacksmith shop, Chip Terminal, lore memo reader)

UIScene receives data from GameScene via EventBus (never direct scene references).

## EnemyManager (src/systems/EnemyManager.ts)

- spawnEnemy(spawnPoint: EnemySpawnPoint): Enemy
- Uses EnemyFactory to create the correct Enemy subclass
- Adds to Phaser physics group
- Tracks all alive enemies
- onEnemyDied(enemy): remove from tracking, check if room clear condition met

## Enemy Base Class (src/entities/Enemy.ts)

Phaser.Physics.Arcade.Sprite subclass:

Properties (all from EnemyDefinition):
- hp, maxHp, speed, damage, defence
- aggroRadius, attackRange, attackCooldown
- scrapDropMin, scrapDropMax, chipDropChance
- behaviourId (string — looked up in BehaviourRegistry)

Methods:
- takeDamage(amount: number, type: DamageType): void
  - Apply defence reduction: finalDamage = amount * (1 - defence/100)
  - Play hit animation (brief tint flash: 0xff0000 for 80ms)
  - Emit ENEMY_DAMAGED event
  - If HP <= 0: die()
- die(): void
  - Play death animation (particle burst + sprite fadeOut tween)
  - Call LootDropper.drop(this.x, this.y, dropTable)
  - Emit ENEMY_DIED event
  - Destroy after tween completes
- update(time, delta): delegates to IBehaviour.tick()

## IBehaviour Interface + Two Implementations

**IBehaviour (src/ai/IBehaviour.ts):**
```typescript
interface IBehaviour {
  init(owner: Enemy, scene: GameScene): void
  tick(time: number, delta: number): void
  onPlayerDetected(playerX: number, playerY: number): void
  onStaggered(): void
  onDeath(): void
}
```

**MeleeBrawlerBehaviour (src/ai/MeleeBrawlerBehaviour.ts):**
- States: IDLE, PATROL, CHASE, ATTACK, STAGGERED
- IDLE: play idle animation
- PATROL: pick random point within 150px radius, move toward it, wait 2s, repeat
- CHASE: detected player within aggroRadius — move directly toward player using Phaser physics velocity
- ATTACK: within attackRange — stop, play attack animation, deal damage at animation midpoint, cooldown
- Transition: PATROL → CHASE when player enters aggro radius. CHASE → ATTACK when in range. ATTACK → CHASE when cooldown done. Any state → STAGGERED on stagger. STAGGERED → CHASE after 0.6s.

**RangedScoutBehaviour (src/ai/RangedScoutBehaviour.ts):**
- States: IDLE, PATROL, STRAFE, RETREAT, SHOOT
- Preferred distance from player: 250px (strafe to maintain)
- STRAFE: orbit player at preferred distance, perpendicular velocity
- RETREAT: player within 100px — flee directly away
- SHOOT: every {attackCooldown}s, fire projectile toward player.position (NOT player.position + velocity — it aims at current pos, telegraphing is fairer)
- Alert: if player spotted AND another enemy is in the room, spawn visual indicator (exclamation mark particle above enemy) for 1s

## Projectile System (src/systems/ProjectileManager.ts)

Object pool of 50 projectile sprites:

ProjectileConfig:
- speed, damage, damageType, pierceCount, lifetime, spriteKey, scale, tint
- Optional: homing (tracks player/enemy), explosive (AoE on impact), bouncing

ProjectileManager.fire(x, y, angle, config, team: 'player'|'enemy'):
- Gets from pool (or creates if pool exhausted — log warning)
- Sets velocity based on angle + speed
- Handles pierce: on hit, reduce pierceCount; destroy if 0
- Handles lifetime: destroy after n milliseconds
- Returns to pool on destroy

## LootDropper (src/systems/LootDropper.ts)

On enemy death, given a loot table:
- Roll scraps: random between min/max, add slight luck modifier
- Roll chip: Math.random() < chipDropChance (modified by luck)
- Spawn ScrapPickup or ChipPickup GameObjects at drop position
- Pickups: small sprite, slight bounce tween on spawn
- Auto-collect: after 8s, tween toward player position over 0.5s, then collect
- On collect: update CurrencyManager, play pickup SFX, show popup number (+5 scraps)

## Test Room

Provide a complete Tiled-format room JSON for a test room:
- 20x15 tiles, Forest Edge tileset
- 4 obstacle rectangles (corners)
- 2 enemy spawns: RoboPheasant (wave 1), BadgerBot (wave 1)
- 2 exit doors
- 1 player spawn

Give me every file. The room must load, enemies must move and be killable, room must clear and doors must open.
```

**Verify after Phase 2:**
- Room loads from JSON and renders
- Enemies patrol, chase player vicinity (even as placeholder circle), die
- Room clears, doors visually change
- Exit selection begins transition

---
---

# PHASE 3 — PLAYER CHARACTER & COMBAT

**Goal:** Bunny fully playable with movement, Dashing Kick, stat system, inventory foundation, and death.

---

```
Continuing Circuit Grove (TypeScript + Phaser 3). Phases 1-2 complete. Enemy AI, room loading, transitions all working.

Paste in: Enemy.ts, DamageType enum, IBehaviour interface, GameScene create/update, StatType enum.

Implement Phase 3: complete player system.

## Player (src/entities/Player.ts)

Phaser.Physics.Arcade.Sprite subclass.

**Movement:**
- 8-directional movement from WASD or arrow keys (Phaser.Input.Keyboard.createCursorKeys + WASD)
- Also controller support via Gamepad API (scene.input.gamepad)
- Speed from PlayerStats.getFinalValue(StatType.Speed)
- Isometric visual offset: when moving diagonally, apply 0.6 vertical scale factor to velocity.y (creates isometric feel without actual isometric projection — easier for browser)
- Sprite faces direction: 4 animation sets (up/down/left/right), chosen by dominant velocity axis
- Normalise diagonal velocity to prevent faster diagonal movement
- Phaser arcade body: setDragX(800), setDragY(800) — snappy stop feel

**Aim Direction:**
- Mouse: vector from player.x,y to scene.input.activePointer world position
- Gamepad: right stick vector (deadzone 0.15)
- aimAngle computed each frame, used by attacks

**Stamina:**
- Regenerates 15/sec
- Regen pauses 1.5s after any stamina use
- StaminaRegenTimer resets on use

**Invincibility Frames:**
- 0.8s after taking damage
- During iframes: sprite alpha oscillates 1.0 → 0.4 → 1.0 at 10hz (Phaser tween, yoyo, repeat)
- No damage taken during iframes

**PlayerStats integration:**
- Player holds a PlayerStats instance
- On stat change event: update internal cached values used in update loop (avoid calling getFinalValue every frame — cache and invalidate on change)

## Dashing Kick (src/abilities/DashingKick.ts)

Implements IAbility interface:
```typescript
interface IAbility {
  readonly id: string
  readonly staminaCost: number
  readonly cooldown: number
  canActivate(player: Player): boolean
  activate(player: Player, aimAngle: number): void
  update(delta: number): void
  get isOnCooldown(): boolean
  get remainingCooldown(): number
}
```

DashingKick implementation:
- staminaCost: 25
- cooldown: 800ms
- canActivate: !isOnCooldown && player.stamina >= staminaCost && !player.isDashing

activate():
1. Deduct stamina
2. player.isDashing = true, player.isInvincible = true
3. Calculate dash velocity: angle * dashSpeed (dashSpeed: ~900px/s)
4. Apply velocity to physics body
5. Enable TrailEffect (see below)
6. After dashDuration (120ms): stop velocity, player.isDashing = false, player.isInvincible = false, start cooldown
7. During dash: use Phaser overlap (not collide) against enemyGroup
   - On overlap: deal damage (player.stats.damage * 1.5), knockback enemy (physics velocity push), play kickImpact sound
   - Track hit enemies in Set to prevent multi-hit in single dash
8. Check projectile overlaps during dash: reflect them (reverse velocity + add player's dash velocity component)

**TrailEffect (src/effects/TrailEffect.ts):**
- On each frame during dash: spawn a ghost sprite at player's previous position
- Ghost sprite: same texture, alpha 0.5, tints toward green, tweens alpha 0→ over 150ms then destroys
- Object pooled (pool size 10)

## AbilityManager (src/systems/AbilityManager.ts)
- Player holds AbilityManager
- Slots: primary (Space/South Button/Left Click), secondary (Q/Left Bumper)
- Manages cooldown timers
- setAbility(slot, ability): IAbility
- activateSlot(slot): calls ability.canActivate → ability.activate
- update(delta): ticks all ability cooldowns

## PlayerInventory (src/systems/PlayerInventory.ts)
- passiveItems: ItemDefinition[] (unlimited slots, visual limit 8 shown)
- activeItems: ItemDefinition[] (max 4 slots)
- addItem(item): validates slot limits, calls ItemEffectApplicator
- removeItem(itemId)
- hasItem(itemId): boolean
- ItemEffectApplicator.apply(item, player): reads statModifiers, calls PlayerStats.applyModifier for each, calls registered onPickupEffect if present

**IPickupEffect (src/effects/IPickupEffect.ts):**
Interface for items needing custom behaviour beyond stat changes.
Write implementations for:
- HealOnPickup: restore 20 HP immediately
- DashChargeBonus: add 1 extra dash charge to DashingKick
- LuckAura: passive — 10% chance each room to get an extra scrap pickup spawn

Register effects in PickupEffectRegistry.ts (string ID → IPickupEffect instance)

## Input Manager (src/systems/InputManager.ts)
Centralises all input:
- Keyboard: Phaser.Input.Keyboard.KeyCodes
- Gamepad: Phaser.Input.Gamepad.Gamepad (check scene.input.gamepad.pad1)
- Provides: isMoving(), getMoveVector(), getAimAngle(), isActionJustPressed(action), isActionHeld(action)
- Action enum: DASH, ABILITY_PRIMARY, ABILITY_SECONDARY, INTERACT, PAUSE, INVENTORY
- Handles controller connected/disconnected events gracefully (fallback to keyboard)
- Dead zones for gamepad sticks

## Camera System

**CameraController (src/systems/CameraController.ts):**
- Wraps Phaser main camera
- followPlayer(player): camera.startFollow with lerp 0.08
- constrainToRoom(width, height): camera.setBounds
- shake(intensity, duration): camera.shake
- ShakePresets: PLAYER_HIT = {intensity: 0.006, duration: 150}, BOSS_HIT = {intensity: 0.015, duration: 300}, DASH_LAND = {intensity: 0.003, duration: 100}

## Death & Run End

**RunEndManager (src/systems/RunEndManager.ts):**
- Listens to PLAYER_DIED event
- Wait 2 seconds (dramatic pause, slow camera zoom in on player)
- Fade to black
- Calculate run summary: rooms cleared, enemies killed, scraps earned, scraps kept (floor(total * 0.6))
- Emit RUN_ENDED with summary data
- UIScene shows RunSummaryPanel

**RunSummaryPanel (src/ui/RunSummaryPanel.ts):**
Phaser GameObjects (not HTML/DOM):
- Dark overlay
- Panel: animal name, run duration, rooms cleared, enemies defeated
- Scrap breakdown: "Earned: 340 scraps → Kept: 204 scraps (60%)"
- Items collected list
- "Return to The Great Oak" button
- On click: save partial rewards, scene transition to HubScene

## Input Map

Provide complete input mapping:

| Action | Keyboard | Mouse | Gamepad |
|--------|----------|-------|---------|
| Move | WASD | — | Left Stick |
| Aim | — | Mouse position | Right Stick |
| Dash/Kick | Space | Left Click | South Button (A/Cross) |
| Secondary Ability | Q | — | Left Bumper |
| Interact | E | — | West Button (X/Square) |
| Pause | Escape | — | Start |
| Item Use | 1-4 | — | D-Pad |

Give me every file. The dash must feel good — nail the timing and the trail effect.
```

**Verify after Phase 3:**
- Bunny moves smoothly, sprite faces direction
- Dash activates, trail visible, hits enemies, reflects projectiles
- Stamina depletes and regens
- Die, see run summary, return to hub

---
---

# PHASE 4 — CURRENCY, BLACKSMITH & CHIP TERMINAL

**Goal:** Complete economy, Humphrey's shop with real item pool logic, Chip Terminal with tier system.

---

```
Continuing Circuit Grove (TypeScript + Phaser 3). Phases 1-3 complete. Player, rooms, enemies all working.

Paste in: ItemDefinition type, ChipDefinition type, StatModifier type, PlayerStats class, ItemEffectApplicator.

Implement Phase 4: the complete economy and shop systems.

## CurrencyManager (src/systems/CurrencyManager.ts)

Singleton service. Uses EventBus for change events.

- runScraps: number (this run, lost 40% on death)
- runChips: number (this run, lost 100% on death — chips only carry via completion)
- metaScraps: number (persistent wallet for hub purchases)
- totalScrapsEverEarned: number (for prestige tracking)
- totalScrapsEverSpent: number (for prestige tracking)

Methods:
- addRunScraps(amount): update, emit SCRAP_CHANGED
- spendRunScraps(amount): boolean, returns false if insufficient
- addChip(): update, emit CHIP_CHANGED
- onRunDeath(): metaScraps += Math.floor(runScraps * 0.6), totalScrapsEverEarned += runScraps, runScraps = 0, runChips = 0
- onRunComplete(): metaScraps += runScraps, totalScrapsEverEarned += runScraps, runScraps = 0, runChips = 0 (chips banked separately for prestige)
- spendMetaScraps(amount): boolean — for hub purchases

## ItemPoolService (src/systems/ItemPoolService.ts)

The draw engine. Get this exactly right.

```typescript
interface ShopContext {
  biomeId: string
  actNumber: 1 | 2 | 3
  animalId: string
  alreadyHeldItemIds: string[]
  playerLuck: number
}
```

drawForShop(context: ShopContext): ItemDefinition[]
1. Get all items from Registry
2. Filter: remove items where allowedBiomes is non-empty AND doesn't include context.biomeId
3. Filter: remove items where allowedActs is non-empty AND doesn't include context.actNumber
4. Filter: remove items where allowedAnimals is non-empty AND doesn't include context.animalId
5. Filter: remove exclusive items already in alreadyHeldItemIds
6. Filter: remove items already in this run's seenItemIds (tracked per run in RunState)
7. Weight each remaining item: finalWeight = item.weight * (1 + context.playerLuck * 0.025)
8. Weighted random draw WITHOUT replacement: 3 draws using the roulette wheel algorithm
9. If fewer than 3 valid items: return what exists (warn to console: "Item pool exhausted — consider adding more items to act {n}")
10. Emit SHOP_DRAWN event with drawn items (for achievement tracking)
11. Add drawn items to this run's seenItemIds (so they won't appear again this run)

drawForChipTerminal(context: Omit<ShopContext, 'biomeId'>): ChipDefinition[]
- Same logic but on ChipRegistry
- Chips have tier: 'grey' | 'green' | 'gold' | 'red'
- Draw weights per tier: grey 60%, green 25%, gold 12%, red 3%
- Guaranteed at least 1 grey if pool is thin

## BlacksmithRoom (src/rooms/BlacksmithRoom.ts)

Humphrey appears in rooms tagged "blacksmith" in their JSON. BlacksmithRoom extends the normal room flow with:

**Spawn logic:**
RoomManager tracks a blacksmithCounter. Increments per room cleared. At counter 3: next room guaranteed to be a Blacksmith room (resets counter). With 20% chance it appears at counter 2. Uses a room template pool tagged "blacksmith" in /public/content/rooms/blacksmith/.

**Humphrey NPC:**
- Phaser sprite at forge position in room template
- Animated: idle animation (subtle rocking)
- InteractionZone around Humphrey: 80px radius
- When player enters zone: "Press E to trade" hint appears (floating text above Humphrey)
- E key / West Button: open BlacksmithUI

## BlacksmithUI (src/ui/BlacksmithUI.ts)

Phaser GameObjects (no HTML — keeps rendering consistent):

Layout:
- Dark wood-texture panel background (use a NineSlice for the panel border)
- Humphrey portrait (left side, animated)
- 3 item card slots (horizontal row)
- Speech bubble above portrait with current dialogue line
- "Leave" button (bottom right)

Each ItemCard:
- Item sprite (centred, 64x64)
- Item name (bold, white)
- Category badge (coloured pill: green for weapon, blue for trinket, etc.)
- Flavour text (italic, 11px, 2 lines max, overflow hidden)
- Scrap cost (gold coloured, with scrap icon)
- BUY button: disabled + red cost if insufficient scraps, enabled + pulsing outline if affordable
- On BUY: scale tween (1→1.1→0, 150ms), play "purchase" SFX, award item, replace card with "SOLD" stamp visual

**Humphrey Dialogue:**
- 12 lines in dialogue pool (hardcoded for now, config-driven Phase 6)
- One shown per visit (cycles, with NarrativeService influencing selection later)
- Typewriter text effect: characters appear one at a time at 35ms per character
- Skip typewriter: press interact button again

## ScrapPickup (src/entities/ScrapPickup.ts)

Phaser.Physics.Arcade.Sprite:
- Small scrap pile sprite
- On spawn: bounceIn tween (scale 0→1.2→1.0 over 200ms)
- Overlap with player: collect immediately
- After 8s: begin magnetTween — Phaser.Math.Angle.BetweenPoints player→pickup, accelerate toward player at 400px/s, on overlap: collect
- On collect: +scraps SFX, floating "+N" text (DamageNumbers system), emit SCRAP_CHANGED

## ChipTerminal (src/entities/ChipTerminal.ts)

Interactable object placed via room template:
- Phaser sprite: glowing circuit board aesthetic (use a green additive blend mode glow overlay)
- Interaction zone 70px
- "Press E — Chip Terminal" hint
- Opens ChipTerminalUI on interact
- Sets isUsed = true after selection (cannot reopen)
- Visual: dims and stops glowing when used

## ChipTerminalUI (src/ui/ChipTerminalUI.ts)

3 chip cards displayed:

ChipCard:
- Tier-coloured border (grey/green/gold/red with matching glow)
- Chip name (large)
- Tier badge
- Effect description (clear, concrete: "+15% damage" not vague text)
- Animated: cards fly in from top on open (stagger: 0, 100, 200ms delays)

Selection:
- Hover: card lifts (translateY -8px tween), border brightens
- Click/confirm: selected card pulses (scale 1→1.15→1), others fade out, modal closes
- Apply chip: ChipEffectApplicator.apply(chip, player)
- Emit CHIP_APPLIED event

**ChipEffectApplicator (src/systems/ChipEffectApplicator.ts):**
- Reads chip.statModifiers → PlayerStats.applyModifier for each
- Reads chip.effectId → looks up in ChipEffectRegistry
- IChipEffect interface (same pattern as IPickupEffect)
- Write implementations for: Overclock, RedundantCore (survive one lethal hit), JuryRig (convert 3 scraps → 1 chip per room)

## Provide 15 complete item.json files and 15 complete chip.json files

Items (cover all categories, act restrictions, varied costs):
Weapons: Briar Whip, Thunder Talon, Thorn Launcher, Foxfire Wand, Burrow Bomb
Trinkets: Stolen Keycard, Acorn Hoard, Rabbit's Foot Chain, Damp Notebook, Corporate Lanyard (ironic)
Armour: MegaCorp Hard Hat, Bark Vest, Thorn Collar, Mud Camouflage, Salvaged Servo Brace
Consumables: Healing Sap, Smoke Bomb, Mushroom Brew

Chips (all 4 tiers, varied effects):
Grey (5): Efficiency, Reinforced, Nimble, Focused, Grounded
Green (4): Piercing, Momentum, Overclock-Light, Heightened Senses
Gold (4): Overclock, Redundant Core, Jury Rig, Cascade
Red (2): Overcharged, Corporate Takeover

Every JSON must have distinct flavourText that fits the satirical tone.

Give me every file. The item pool draw algorithm must be correct — test it mentally with edge cases.
```

**Verify after Phase 4:**
- Kill enemies, scraps accumulate in HUD
- Enter Blacksmith room, shop opens with 3 items from pool
- Buy an item, stat changes apply (verify with debug display)
- Enter Chip Terminal room, 3 chips appear with tier colours, selection applies

---
---

# PHASE 5 — PROGRESSION, SKILL TREES & ADDITIONAL ANIMALS

**Goal:** Per-animal EXP persisting across runs, full branching skill tree UI, Bunny complete tree, Toad, Badger, Owl added.

---

```
Continuing Circuit Grove (TypeScript + Phaser 3). Phases 1-4 complete. 

Paste in: AnimalDefinition type, SkillNode type, StatModifier type, SaveData structure (from your save system stub), PlayerStats class.

Implement Phase 5: animal progression and skill trees.

## ProgressionService (src/systems/ProgressionService.ts)

**EXP System:**
- animalExp: Map<string, number> (stored in SaveData, never resets)
- getLevel(animalId): computes current level from total EXP using formula: Level n requires cumulative EXP = floor(100 * n^1.4 / 10) * 10
- Write getLevelFromExp(exp): number — iterates until threshold exceeded, returns level
- getExpToNextLevel(animalId): number — remaining EXP for next level
- awardExp(animalId, amount): add to map, check for level up, if level up: award skill point, emit ANIMAL_LEVELED_UP

**Skill Point System:**
- skillPoints: Map<string, number> in SaveData
- unlockedSkills: Map<string, string[]> in SaveData (animalId → nodeIds[])
- canUnlockSkill(animalId, nodeId): checks prerequisiteNodeId is unlocked (or null), player has enough points, not already unlocked
- unlockSkill(animalId, nodeId): deduct point, add to unlocked list, apply effects, emit SKILL_UNLOCKED
- getSkillTree(animalId): fetch from ContentLoader (animals/{id}/skills.json)

**Skill Effects:**
- SkillEffectApplicator.ts: applies node effects to player
- If node.effect.type === 'statModifier': call PlayerStats.applyModifier (permanent for this run)
- If node.effect.type === 'abilityUnlock': register new ability with AbilityManager
- If node.effect.type === 'custom': lookup ISkillEffect in SkillEffectRegistry by node.effect.effectId
- Permanent skill effects re-applied on each run start (read from unlockedSkills, reapply all)

## SkillTreeUI (src/ui/SkillTreeUI.ts)

Visual tree accessible from Hub:

Layout approach (Phaser GameObjects):
- Scrollable container (Phaser.GameObjects.Container with mask)
- Linear nodes: centred row at top
- Branch point: visual "Y" split below linear nodes
- Path A: left column descending
- Path B: right column descending
- Connection lines: Phaser.GameObjects.Graphics, draw lines between connected nodes

SkillNode visual (each node is a Container):
- Circle background (radius 32)
- Inner icon (32x32 sprite)
- State colours: locked = #333333, available = #4a9e6b (pulsing outline), unlocked = #74C69D filled
- Hover: scale 1→1.1, show tooltip
- Tooltip: name, description, cost, effect in readable language

Tooltip (follows cursor or appears below node on gamepad):
- Small panel with node name (bold), description, "Cost: N Skill Points", current effect preview

On click (if available):
- Confirmation: small popup "Unlock [Name] for 1 skill point? YES / NO"
- On confirm: ProgressionService.unlockSkill, node animates to unlocked state, connection line brightens

EXP bar at top: current EXP / next level threshold, level number, animal name.

## Complete Skills JSON + Effects

**Bunny skills.json (complete — all 5 linear + all Path A + all Path B):**
Write the full JSON. For each node requiring a custom ISkillEffect, name the effectId and write the implementation class.

Custom effects needed:
- DashResetOnKill (Kickboxer path): ISkillEffect that hooks ENEMY_DIED event, if kill: reset DashingKick cooldown (internal 1s lockout to prevent infinite chain)
- ComboKick (Kickboxer path): modifies DashingKick behaviour to allow triple-tap — write ComboKickAbility.ts that extends DashingKick
- ShadowStep (Scout path): first dash of each room = invincible AND invisible (alpha 0) — implement via a RoomEnteredListener that sets a "firstDash" flag, consumed on first dash activation
- AcornBarrage (Scout path): new ability, fires 3 acorns in 30-degree spread, each deals 0.4x damage — write AcornBarrageAbility.ts implementing IAbility
- Decoy (Scout path): spawn a decoy sprite that draws enemy aggro (enemies re-target to it) — write DecoyAbility.ts, decoy has an EnemyAggroTarget interface

**Toad skills.json (complete):**
Linear: Lily Pad Stance, Tongue Lash, Iron Skin, Leaping Strike, War Croak
Path A (Samurai): Blade Draw, Parry Window, Focused Breath, Thousand Cuts, [Capstone: Iaijutsu Strike]
Path B (Berserker): Blood Rage, Thick Skull, Cannonball, [path continues], [Capstone: Rampage]

Write ParrySystem.ts:
- Activated by a separate input (Right Click / Left Trigger) during Toad's playtime
- 0.15s active window (visual: brief flash on toad sprite)
- If projectile hits during window: reflect it
- If melee hits during window: stagger attacker, no damage to toad
- 3s cooldown
- Parry window is a Phaser overlap check on a temporary hitbox zone around toad

**Owl skills.json (complete):**
Linear: Keen Eyes, Feather Dart upgrade, Midnight Plumage (stealth bonus), Wind Read, Mana Swell
Path A (Arcane Mage): Arcane Dart, Area Denial (place magic sigil), Familiar (summon small helper), [continues], [Capstone: Meteor]
Path B (Longbow Marksman): Eagle Eye, Pierce Shot, Wind Reading (shots curve slightly), [continues], [Capstone: Storm of Arrows]

Write SlowMotionAim.ts:
- Right click held / Left Trigger held
- Time scale: Phaser.time.timeScale lerps from 1.0 to 0.25 over 0.3s
- Cursor/aim reticle changes to a precise crosshair
- Aim line visible: Phaser.GameObjects.Graphics line from Owl to aim direction, with end marker
- Duration: 2s maximum (stamina drains at 40/sec during slow motion)
- On release: time scale returns to 1.0 over 0.15s
- Fire during slow motion: arrows gain +50% damage, pierce 1 additional enemy
- Cooldown for the time-slow: 8s after releasing

## AnimalSelector (src/ui/AnimalSelector.ts)

Hub screen for choosing character:

Grid layout (4 columns): animal portrait cards
Each card:
- Portrait sprite (placeholder circle with animal name for now)
- Animal name
- Locked: dark overlay, padlock icon, small unlock condition text
- Unlocked: full colour, level badge (Lv. 7), path indicator if advanced (⚔ Kickboxer / 🗡 Scout)
- Selected: bright border, subtle breathing scale animation

Right panel (on selection):
- Large portrait
- Lore blurb (2 sentences)
- Stat bars (HP, Speed, Damage, Defence, Luck, Stamina) — visual bars, not numbers
- EXP progress bar + level
- "View Skill Tree" button
- "Begin Run" button

Animal definitions (write stats.json for each):
Bunny, Hedgehog, Toad, Badger, Owl — provide complete stats.json for all 5.

Give me every file. Skill effects must actually work — test the logic paths mentally.
```

**Verify after Phase 5:**
- Kill enemies, watch Bunny EXP bar fill
- Level up → skill point awarded → open skill tree → unlock Quick Feet → Bunny moves faster
- Unlock AcornBarrage → secondary ability fires 3 projectiles
- Open animal selector, see locked animals with conditions

---
---

# PHASE 6 — HUB, NARRATIVE & SAVE SYSTEM

**Goal:** The Great Oak hub navigable, NarrativeService with story flags, Elderwick and Humphrey dialogue evolving, full SaveService.

---

```
Continuing Circuit Grove (TypeScript + Phaser 3). Phases 1-5 complete.

Paste in: GameEvents const, NarrativeService interface stub, SaveData type structure.

Implement Phase 6: hub scene, narrative system, and save system.

## SaveService (src/systems/SaveService.ts)

Using idb (IndexedDB wrapper) for large structured saves.

SaveData structure:
```typescript
interface SaveData {
  version: number                              // for migration
  metaScraps: number
  totalScrapsEarned: number
  totalScrapsSpent: number
  totalChipsEarned: number
  animalExp: Record<string, number>
  animalSkillPoints: Record<string, number>
  unlockedSkills: Record<string, string[]>
  unlockedAnimals: string[]
  narrativeFlags: Record<string, boolean>
  foundLoreItems: string[]
  achievements: Record<string, boolean>
  prestigeUnlocked: string[]
  settings: SettingsData
  lastRunSummary?: RunSummary
  totalRunsCompleted: number
  totalBossDefeats: number
  totalEnemiesKilled: number
  playtimeSeconds: number
}
```

Methods:
- init(): Promise<void> — open IndexedDB, run migrations
- save(data: SaveData): Promise<void>
- load(): Promise<SaveData | null>
- reset(): Promise<void>
- hasSave(): Promise<boolean>

Auto-save: call save() on ROOM_CLEARED, RUN_ENDED, PRESTIGE_UNLOCKED events.

Corruption safety: 
- After writing, immediately read back and verify version field is present
- If read-back fails: save to localStorage as emergency backup
- On load: if IndexedDB fails, try localStorage backup

Migration system:
- CURRENT_VERSION = 2
- migrations: Map<number, (old: any) => SaveData> 
- On load: if data.version < CURRENT_VERSION, apply migration chain
- Write migration v1→v2 as example

## NarrativeService (src/systems/NarrativeService.ts)

**Flag System:**
- flags: Record<string, boolean> — persisted in SaveData
- setFlag(id: string): persist + emit NARRATIVE_FLAG_SET
- getFlag(id: string): boolean
- Key flags: FIRST_RUN_COMPLETE, FIRST_BOSS_DEFEAT, ACT2_UNLOCKED, etc.

**Dialogue Resolution:**
- loadDialogueTree(npcId): fetch /public/content/dialogue/{npcId}.json
- resolveDialogue(npcId, context): finds best-matching dialogue node
  - Each node has: conditions (array of flagId strings that must be true), priority (int)
  - Find node where ALL conditions are met AND priority is highest
  - Fallback: node with empty conditions array (always matches)
- getNextNode(currentNodeId, npcId): follows nextNodeId chain

**Lore Item Tracking:**
- foundLoreItems: string[] in SaveData
- recordLoreFind(memoId): add to array, set flag "lore_{memoId}_found", check achievements
- hasFoundLore(memoId): boolean

## HubScene (src/scenes/HubScene.ts)

Full navigable scene:

**Player movement in hub:**
- Same PlayerController but enemies disabled
- Smaller, cosier space (single screen, no camera scrolling)
- Trigger zones replace "rooms" — walk into zone = interaction prompt

**Hub layout (define as JSON: /public/content/hub/layout.json):**
```json
{
  "tilemap": "hub_main",
  "npcs": [
    {"id": "humphrey", "x": 180, "y": 520, "interactionRadius": 80},
    {"id": "elderwick", "x": 820, "y": 200, "interactionRadius": 90}
  ],
  "interactables": [
    {"type": "animalSelector", "x": 620, "y": 380, "label": "The Run Board"},
    {"type": "memoArchive", "x": 320, "y": 260, "label": "Comms Intercept Archive"},
    {"type": "prestigeAltar", "x": 960, "y": 480, "label": "The Verdant Altar", "lockedUntil": "FIRST_BOSS_DEFEAT"},
    {"type": "warRoom", "x": 1100, "y": 300, "label": "The War Room", "lockedUntil": "PRESTIGE_RESISTANCE_GROWS"}
  ]
}
```

**HubEventManager (src/hub/HubEventManager.ts):**
- On hub scene create: read narrative flags
- Conditionally show/hide GameObjects based on flags:
  - VictoryBanner: show if FIRST_BOSS_DEFEAT
  - WarRoomDoor (open): show if PRESTIGE_RESISTANCE_GROWS
  - ExtraResistanceAnimals (decorative): show if totalBossDefeats >= 5
- Listens to NARRATIVE_FLAG_SET: dynamically update hub when flags change mid-session

## NPC Dialogue System (src/ui/DialogueBox.ts)

Phaser GameObjects panel (bottom of screen):
- Dark panel with illustrated border (forest-themed NineSlice)
- Speaker portrait (left, 80x80)
- Speaker name (bold, coloured by NPC)
- Dialogue text area (typewriter effect: 35ms/character)
- "▶ Continue" or "▶ [E]" prompt (blinking arrow)
- Skip typewriter: press interact, text completes instantly
- Advance: press interact again to go to nextNodeId, or close if null

## Elderwick Dialogue (complete JSON)

Write /public/content/dialogue/elderwick.json with 8 nodes:

Node 1 (default — no flags): "Before any run. Worried, quiet. Explains the threat vaguely."
Node 2 (condition: FIRST_RUN_COMPLETE): "Relieved player returned. Shares more about the corporation."
Node 3 (condition: FIRST_BOSS_DEFEAT): "Shocked. Grateful. Reveals the corporation knows they're opposed now."
Node 4 (condition: FIRST_BOSS_DEFEAT + run count > 3): "Weary but determined. The humans escalate."
Node 5 (condition: totalBossDefeats >= 5): "Proud. The forest holds. But the fight isn't over."
Nodes 6-8: additional story beats, your design.

Write full dialogue text for all nodes. It must be good — this is the Hades-equivalent voice. British in cadence, gravitas without melodrama.

## Humphrey In-Hub Dialogue (complete JSON)

/public/content/dialogue/humphrey.json — 10 nodes:
Node 1 (default): Gruff but welcoming.
Nodes 2-10: Evolve based on flags. Humphrey becomes warmer as narrative progresses. Include at least one genuinely funny node and one emotionally resonant one.

## MegaCorp Memo Archive (src/ui/MemoArchiveUI.ts)

Accessible from hub:
- Scrollable list of found memos (show count: "7 / 23 Intercepted")
- Each memo: title, date, from/to fields, status badge (NEW / READ)
- Click to open full memo text
- Full memo view: styled as corporate letterhead gone wrong (Times New Roman, MegaCorp header, bureaucratic language)

Write 8 complete memo texts. Corporate satire. Each should:
- Sound genuinely like an evil corporation's internal memo
- Be funny AND reveal something about the lore
- Use business jargon as a weapon (stakeholder alignment, land value extraction, biodiversity optimisation)

Example tone: "RE: WOODLAND RESISTANCE INCIDENTS — Legal has confirmed that under UK property law, the animals have no actionable standing. Please proceed with Phase 2 land optimisation. Any 'distress' exhibited by fauna should be classified as Environmental Adjustment Behaviour in your reports."

Give me every file. Elderwick's dialogue must have actual weight — write it as if it matters.
```

**Verify after Phase 6:**
- Hub loads, player walks around
- Talk to Elderwick, see intro dialogue with typewriter
- Complete a run, return, Elderwick has new dialogue
- Find a lore memo in a run, see it in the archive

---
---

# PHASE 7 — BOSS FIGHTS & PRESTIGE

**Goal:** BUDDY boss with 3 phases, mini-boss system, and Prestige Tracks 1-3 functional.

---

```
Continuing Circuit Grove (TypeScript + Phaser 3). Phases 1-6 complete.

Paste in: Enemy.ts base class, BossPhaseDefinition type stub, NarrativeService, PrestigeService stub.

Implement Phase 7: bosses and prestige.

## Boss Architecture

### BossController (src/entities/BossController.ts)
Extends Enemy with:

**Phase System:**
- phases: BossPhaseDefinition[] (loaded from boss.json)
- currentPhaseIndex: number
- Each phase: { hpThreshold: number, attackPatterns: AttackPattern[], entryDialogue?: string, musicLayerId?: string }
- checkPhaseTransition(): if hp <= phase.hpThreshold: transitionToNextPhase()
- transitionToNextPhase():
  1. Set velocity to 0, boss.active = false (brief)
  2. Phaser.time.timeScale lerp: 1.0 → 0.15 over 200ms (dramatic slowdown)
  3. Wait 800ms
  4. Phaser.time.timeScale lerp: 0.15 → 1.0 over 300ms
  5. Show entry dialogue (if any) — floating text above boss, 3s duration
  6. Activate new phase attack patterns
  7. boss.active = true

**Boss Health Bar (src/ui/BossHealthBar.ts):**
- Large bar at top of screen (via UIScene)
- Shows on BossController.init(), hides on boss death
- Boss name displayed
- HP drains smoothly (tweened to actual value over 0.3s)
- Phase markers: small tick marks on bar at phase transition thresholds
- When phase transitions: bar segment behind tick mark greys out with flash effect

**Telegraph System (src/systems/TelegraphSystem.ts):**
Critical for fairness — bosses are hard but always readable.

TelegraphSystem.show(config):
```typescript
interface TelegraphConfig {
  type: 'ring' | 'cone' | 'line' | 'ground_zone'
  x: number, y: number
  size: number           // radius for ring, length for line, etc.
  angle?: number         // for cone and line
  duration: number       // warning period before attack lands
  colour?: number        // default 0xff4444
}
```
- 'ring': Phaser.GameObjects.Arc, no fill, coloured stroke, pulses opacity
- 'ground_zone': filled rectangle/circle, low opacity (0.3) fills in to full opacity over duration, then attack fires
- 'line': thin line indicating attack direction
- 'cone': triangle shape
- All telegraphs auto-destroy after duration elapses

**IBossAttack (src/bosses/IBossAttack.ts):**
```typescript
interface IBossAttack {
  readonly id: string
  readonly telegraphDuration: number
  telegraph(boss: BossController, playerPos: Vector2): void   // show TelegraphSystem warning
  execute(boss: BossController, playerPos: Vector2): void     // actual attack
}
```

**AttackPattern:** ordered or random sequence of IBossAttack[] with timing between attacks.

### BUDDY Implementation (src/bosses/BuddyBossController.ts)

Write buddy.json config AND BuddyBossController.ts.

BUDDY stats: HP 600, Speed varies by phase, Damage 18, Defence 10%

**Phase 1 — Brand Ambassador (100-60% HP):**
Attacks:
- FriendlyWave: telegraph (ring, 1.2s), then wide melee slam in front. "Brand Ambassador" audio cue.
- PamphletDrop: 4 projectiles in + pattern, slow moving (speed 120), telegraphed (4 ground circles)
- CorporateMarch: BUDDY locks onto player position (at time of telegraph), marches there in 2s, deals AoE on arrival

Entry: BUDDY slides in from off-screen. Jingle plays. Corporate logo appears behind him briefly.
Dialogue on spawn: "Welcome to Bramblewood Forest! MegaCorp: We Own Nature Now."

**Phase 2 — Performance Review (60-25% HP):**
Phase transition dialogue: "Suboptimal. Initiating... performance review."
New attacks:
- EfficiencyProtocol: faster CorporateMarch (1.2s instead of 2s)
- DroneDepoy: spawns 3 small drone sprites that orbit BUDDY at radius 100px, each fires outward every 2s
  - Drones are separate Phaser sprites, each with their own projectile timer
  - Drones die in 2 hits (separate HP)
- Audit: 3 sequential delayed explosions at player position (each telegraphed with 0.6s warning circle, offset by 0.5s each)

**Phase 3 — Hostile Acquisition (25-0% HP):**
Phase transition dialogue: "I... remember... the forest. It was— [OVERRIDE ACCEPTED] —hostile acquisition initiated."
New attacks:
- SystemOverride: BUDDY's movement becomes unpredictable (random velocity changes every 0.4s)
- MemoryLeak: spawns translucent ghost BUDDY that mirrors all current attacks with 0.8s delay
- Desperate Charge: BUDDY charges from one room wall to opposite at speed 600, must dodge sideways

**Death Sequence:**
1. HP reaches 0: BuddyBossController.onDeath()
2. BUDDY velocity = 0, all attacks stop, all drones destroyed
3. Glitch particle effect (static particles around BUDDY)
4. Slow voice line: "I... I remember the forest... Before they..." (typewriter text above BUDDY, no rush)
5. 3s pause
6. BUDDY sprite fadeOut tween (2s)
7. Screen flash white → fade to black
8. Victory scene: counter of run completion, narrative flag FIRST_BOSS_DEFEAT set
9. Transition to hub

### Mini-Boss System (src/entities/MiniBossController.ts)

Lighter version of BossController:
- 2 phases maximum
- Side-of-screen health bar (small, not the dramatic top bar)
- No death cutscene — loot drops, brief particle burst, done

Implement "The Pesticide Sprayer" (RoboBadger MkVII):
- boss.json config + PesticideSprayerController.ts
- Phase 1: charge attacks (telegraph 1.0s cone, then rush in charge direction)
- Phase 2 (at 50% HP): gains poison AoE — each slam now leaves a 100px poison zone for 5s. Entering zone: 3 damage/sec to player.
- Poison zone: Phaser.GameObjects.Arc with additive blend green tint, timer to destroy

## Prestige System

**PrestigeService (src/systems/PrestigeService.ts):**

Tracks which prestige tracks are unlocked. Tracks defined in /public/content/prestige/tracks.json:
```json
{
  "tracks": [
    {
      "id": "resistance_grows",
      "name": "The Resistance Grows",
      "description": "...",
      "condition": {"type": "flag", "flagId": "FIRST_BOSS_DEFEAT"},
      "rewards": [{"type": "unlockFeature", "featureId": "war_room"}, {"type": "narrativeFlag", "flagId": "PRESTIGE_RESISTANCE_GROWS"}]
    }
  ]
}
```

checkAllTracks(): runs after any relevant event, calls canUnlock(track) for each non-unlocked track.
canUnlock(track): evaluates condition type:
- "flag": NarrativeService.getFlag(flagId)
- "stat": SaveData[statField] >= threshold
- "count": SaveData.totalBossDefeats >= count (etc.)

unlockTrack(id): validate, apply rewards, save, emit PRESTIGE_UNLOCKED.

**Reward types implement IPrestigeReward:**
- UnlockFeatureReward: sets a feature flag in SaveData
- NarrativeFlagReward: sets a narrative flag
- PermanentStatReward: adds a permanent modifier to all future runs of specified animal
- UnlockAnimalReward: adds animalId to SaveData.unlockedAnimals

**Implement Tracks 1-3:**

Track 1 — Resistance Grows: Condition: FIRST_BOSS_DEFEAT. Rewards: unlock war_room feature, set PRESTIGE_RESISTANCE_GROWS flag. HubEventManager reacts: War Room area of hub becomes accessible.

Track 2 — Dual Nature: Condition: SaveData.unlockedSkills for any animal has both pathA and pathB capstone. Implementation: dual class switch in AnimalSelector (toggle between paths pre-run). Write DualClassManager.ts: holds activePathOverride per animal, applied on run start.

Track 3 — Scavenger Economy: Condition: totalScrapsSpent >= 5000. Reward: unlock scrapyard feature. ScrapyardController.ts: identical to Blacksmith but draws from premium item pool (all items weighted double for rare tier), costs 30% more.

**PrestigeAltarUI (src/ui/PrestigeAltarUI.ts):**
- List of all tracks
- Locked tracks: dimmed, condition shown ("Defeat BUDDY once")
- Available tracks (condition met, not yet claimed): glowing border, "CLAIM" button
- Claimed: checkmark, greyed
- On claim: fanfare particle burst from altar sprite, track effects apply immediately

Give me every file. BUDDY's death sequence must be emotionally resonant — it's the narrative payoff.
```

**Verify after Phase 7:**
- BUDDY spawns, all 3 phases trigger at correct HP
- Telegraphs appear before attacks (ring visible, then attack lands after warning)
- Death sequence plays with dialogue
- Prestige altar appears, Track 1 can be claimed after boss defeat

---
---

# PHASE 8 — POLISH, JUICE & GAME FEEL

**Goal:** All the systems that make it feel like a *game* not a prototype.

---

```
Continuing Circuit Grove (TypeScript + Phaser 3). Phases 1-7 complete. Fully playable end-to-end.

This phase is entirely about game feel, polish, and juice. Every item in this list is non-negotiable for a shipped game.

## Damage Numbers (src/effects/DamageNumbers.ts)

Object pool of 40 text objects:
- On damage dealt to enemy: "+N" floats up and fades, white
- On crit: larger text, gold colour, slight scale pop
- On player taking damage: "-N" at player position, red, shakes slightly before fading
- On healing: "+N HP" green
- On scrap pickup: "+N" gold at pickup position
- Float direction: slight randomised angle (±15 degrees from straight up)
- Duration: 1.2s float, fade starts at 0.6s
- Font: bold, with text stroke for readability over any background

## Hit Pause (src/systems/HitPauseManager.ts)

When player lands a strong hit:
- Freeze game time for 80ms (Phaser.time.timeScale = 0)
- Resume normally
- This creates the "weight" of impact
- Only trigger for: DashingKick hits, weapon crits, boss hits on player
- Do NOT trigger for weak normal attacks (would feel stuttery)

Implementation: Phaser.time.timeScale = 0, then scene.time.delayedCall(80, () => Phaser.time.timeScale = 1). Note: delayedCall uses real time not game time, so this works during timeScale = 0.

## Screen Shake (src/systems/ScreenShakeManager.ts)

Wraps Phaser camera shake with presets:
- playerHit(): camera.shake(150, 0.006)
- dashImpact(): camera.shake(80, 0.003)
- explosion(): camera.shake(300, 0.012)
- bossSlam(): camera.shake(250, 0.018)
- bossPhaseTransition(): camera.shake(500, 0.025)
- All shakes respect the ReducedMotion setting (multiply intensity by 0 if enabled)

## Particle Effects (src/effects/ParticleManager.ts)

Phaser particle emitters, object pooled:
- dustPuff(x, y): small brown/grey dust, 8 particles, brief burst — on dash landing, on heavy footstep
- scrapSparkle(x, y): gold sparks, 12 particles — on scrap collect
- chipGlow(x, y): green electric sparks, 16 particles — on chip collect
- deathExplosion(x, y, size): burst of parts (mixed colours), 20-30 particles — on enemy death
- healBurst(x, y): soft green upward wisps — on healing
- bossPhaseTransition(x, y): massive multi-colour burst, 60 particles
- poisonCloud(x, y, radius): lingering green particles — for boss/hazard effects

All emitters pre-created on scene init, reused via emitter.explode(count, x, y).

## Adaptive Audio (src/systems/AudioManager.ts using Howler.js)

Music layers:
- ambient: gentle folk background (always playing in run)
- combat_light: adds when 1-3 enemies in room
- combat_heavy: adds when 4+ enemies or elite enemy present
- boss: replaces ambient+combat layers with boss theme
- hub: separate calm theme for hub scene

All layers are Howler sprites or separate Howl instances with loop: true. Volume crossfade on layer change (0.4s fade out old, 0.4s fade in new).

Audio autoplay fix: layers start on first user interaction (click/keypress). Store isAudioUnlocked flag. On first interaction: start ambient layer. Do not attempt to play before this.

SFX registry: read from /public/assets/audio-manifest.json
- playOnce(id): Howl.play() 
- playAtPosition(id, x, y, listenerX, listenerY): spatial audio via Howler stereo panning based on X offset
- Implement 12 essential SFX IDs: dash_kick, enemy_hit, enemy_death, player_hit, scrap_collect, chip_collect, purchase, door_open, boss_roar, boss_phase, victory, game_over

## Visual Feedback Systems

**Room Clear Celebration (src/effects/RoomClearEffect.ts):**
When room clears:
1. Brief white flash (full screen overlay, alpha 0.7, fades in 50ms, out 300ms)
2. "ROOM CLEARED" text appears center screen, scale from 2→1 in 200ms, holds 1s, fades out
3. Door open sound plays
4. Scraps from enemies do the magnet-to-player move
5. Camera unlocks from player for 0.5s, zooms out slightly (zoom 1.0→0.85) to show the whole room, then zooms back and re-locks

**Boss Intro Cinematic (src/effects/BossIntroEffect.ts):**
On boss room enter:
1. Player movement disabled
2. Camera moves to center of room (0.5s tween)
3. BUDDY slides in from off-screen (0.8s tween)
4. Boss health bar slides in from top
5. BUDDY's name appears in stylised text
6. Jingle sting audio cue
7. 1s pause
8. Player control restored
9. Boss.activate()

## UI Polish

**Hover States:** All clickable buttons must have:
- Hover: subtle scale 1→1.03 (100ms ease), slight brightness increase
- Press: scale 1.03→0.97 (50ms), release back to 1.03→1.0 (80ms)
- Implement via Phaser input events (pointerover, pointerout, pointerdown, pointerup)
- Write ButtonFactory.ts: create(text, x, y, onClick) → returns configured interactive GameObject

**Transition Polish:**
- All scene transitions: camera fade (not instant cut)
- Hub → Run: fade black, brief woodland SFX, fade in
- Room transitions: same but faster (400ms)
- Death: slow fade with heart SFX stopping

**Minimap (src/ui/Minimap.ts):**
Simple room map (Binding of Isaac style):
- 8x8 pixel squares represent rooms
- Current room: bright colour
- Visited rooms: dim colour
- Unvisited but known exits: very dim
- Blacksmith room: gold dot
- Boss room: red dot
- Update on each room transition

## Accessibility Implementation

**ColourblindManager (src/systems/ColourblindManager.ts):**
When ColourblindMode enabled:
- All colour-coded elements (chip tiers, item categories, damage numbers) add a symbol overlay
- Grey chip → triangle symbol, Green → circle, Gold → star, Red → X
- Damage numbers: add suffix "CRIT" instead of relying on gold colour alone

**ReducedMotionManager:**
- If enabled: all camera shakes multiply by 0, all particle counts halve, all tweens use linear ease (no bounce/elastic), screen flash effects disabled

## Achievement Toast (src/ui/AchievementToast.ts)

Bottom-right notifications:
- Slides in from right (0.3s ease-out)
- Shows: trophy icon, "Achievement Unlocked", achievement name
- 4s hold, then slides back out (0.3s ease-in)
- Queue system: if multiple unlock simultaneously, show sequentially with 0.5s gap
- Does not interrupt gameplay

Give me every file. The hit pause is the most important — it's the difference between the game feeling cheap and feeling great.
```

**Verify after Phase 8:**
- Dash into enemy: see hit pause, screen shake, damage number, particles
- Room clear: white flash, text, camera zoom out, doors open
- Boss intro plays when entering boss room
- All buttons have hover/press states

---
---

# PHASE 9 — SETTINGS, MAIN MENU & DEPLOYMENT

**Goal:** Complete main menu, settings, achievements, and static site deployment.

---

```
Final phase. Circuit Grove (TypeScript + Phaser 3). Phases 1-8 complete.

Implement Phase 9: main menu, settings system, achievement tracking, and build/deploy pipeline.

## MainMenuScene (src/scenes/MainMenuScene.ts)

Visual design brief: dark forest scene. The Great Oak silhouetted against a warm amber sky. Fireflies (particle system, gentle). Logo fades in.

Elements:
- Background: parallax layers (far trees, mid trees, foreground ferns — each moves at different rates on subtle mouse parallax or auto-drift)
- "CIRCUIT GROVE" logo (Phaser text with custom font loaded in PreloadScene, or BitmapText)
- Subtitle: "They paved paradise. We're taking it back." (italic, smaller)
- Buttons (vertical stack): Continue (greyed if no save), New Game, Settings, Credits, Itch.io (links out)
- Version number (bottom right, small)

Continue: if SaveService.hasSave() → load save → HubScene
New Game: if save exists → confirmation dialog ("This will erase your save. Are you sure?") → clear → HubScene fresh
Credits: simple overlay panel, scroll

Firefly particles: 20 slow-moving point lights (Phaser PointLight or simple circle sprites with additive blend, random wander behaviour, alpha oscillation).

## Settings System

**SettingsData (part of SaveData):**
- masterVolume: 1.0
- musicVolume: 0.7
- sfxVolume: 0.8
- fullscreen: false
- colourblindMode: false
- reducedMotion: false
- textScale: 1.0
- controllerVibration: true
- aimAssistStrength: 0.5
- showDamageNumbers: true
- autosave: true (always true in practice, but let users feel in control)

**SettingsManager (src/systems/SettingsManager.ts):**
- getCurrentSettings(): SettingsData
- updateSetting(key, value): applies immediately + saves
- applyAll(): called on game load to apply saved settings
- Immediate effects: volume changes via AudioManager, colourblind via ColourblindManager, etc.

**SettingsUI (src/ui/SettingsUI.ts):**
Tabbed panel (4 tabs): Audio | Video | Gameplay | Accessibility

Audio tab:
- Master volume slider (0-100, shows value)
- Music volume slider
- SFX volume slider
- Test SFX button (plays a sample sound)

Video tab:
- Fullscreen toggle
- Show damage numbers toggle
- (Resolution handled by browser window resize)

Gameplay tab:
- Controller vibration toggle
- Aim assist strength slider (Owl-relevant: labelled "Aim Assist (Owl)")

Accessibility tab:
- Colourblind mode toggle
- Reduced motion toggle
- Text scale slider (100%-150%, updates all UI text immediately)

## Achievement System

**AchievementService (src/systems/AchievementService.ts):**
- Load /public/content/achievements.json
- Listen to relevant EventBus events
- onEvent: check all uncompleted achievements for condition match
- Condition evaluator: given SaveData + event data, returns boolean
- On achievement complete: save, emit ACHIEVEMENT_UNLOCKED, show toast

Write /public/content/achievements.json with 20 achievements:

Structured list (write complete JSON):
1. "First Blood" — Kill your first animatronic. (hint: obvious, reward: nothing, just feels good)
2. "You Survived" — Complete your first run. Unlock: Hedgehog
3. "Corporate Downsizing" — Kill 100 animatronics total.
4. "Persistent Thorn" — Complete 10 runs.
5. "Hoarder" — Earn 500 scraps in a single run.
6. "Clean Sweep" — Complete Act 1 without being hit. Unlock: Stoat (hint shown)
7. "The Resistance" — Defeat BUDDY. Prestige Track 1 available.
8. "Collector" — Find 20 different items across all runs.
9. "Speed Run" — Clear 5 rooms in under 8 minutes.
10. "Lucky Break" — Have 20+ Luck stat in a single run.
11. "Diplomatic Immunity" — Complete a run using only items from one category.
12. "Tech Salvager" — Spend 3,000 total scraps at Blacksmith. Unlock: Mole
13. "Ghost Protocol" — Complete Act 1 without triggering any enemy's aggro (stealth run).
14. "Memento" — Find 10 MegaCorp memos.
15. "Corporate Spy" — Find all 23 MegaCorp memos. Unlock: Prestige Track — Corporate Espionage
16. "Devoted" — Play as one animal for 20 runs.
17. "Variety" — Win a run with 5 different animals.
18. "Second Nature" — Unlock dual class for any animal.
19. "The Long Game" — Accumulate 10,000 scraps across all runs.
20. "Bramblewood Guardian" — Win 25 total runs.

## Pause Menu (src/ui/PauseMenu.ts)

Toggled by Escape/Start:
- Blurs GameScene (Phaser postFX pipeline or simple dark overlay)
- timeScale = 0 while open
- Buttons: Resume, Items (read-only inventory viewer), Settings (opens SettingsUI), Quit Run (→hub, confirmation), Quit to Desktop (window.close())
- Keyboard navigation (up/down arrow, enter to confirm)

## Build & Deployment

**vite.config.ts additions for build:**
- base: './' (relative paths for itch.io compatibility)
- build.outDir: 'dist'
- build.assetsDir: 'assets'
- Ensure /public/content/ is copied to dist/ verbatim
- Ensure /public/assets/ is copied to dist/ verbatim

**Build script (package.json):**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "generate-manifest": "ts-node scripts/generateManifest.ts",
    "type-check": "tsc --noEmit"
  }
}
```

**Deployment targets:**

GitHub Pages:
- .github/workflows/deploy.yml — on push to main: npm ci → npm run generate-manifest → npm run build → deploy dist/ to gh-pages branch

itch.io:
- npm run build → zip the dist/ folder → upload to itch.io as HTML5 game
- Set viewport to 1280x720, enable fullscreen button
- itch.io requires iframe embed — confirm our Vite build works in iframe (it does, no special config needed)

Netlify (alternative):
- netlify.toml: build command "npm run build", publish "dist"
- Redirects: _redirects file: "/* /index.html 200" (for any path routing)

**Pre-launch checklist (write this as a runnable checklist in LAUNCH_CHECKLIST.md):**
- [ ] npx tsc --noEmit passes with 0 errors
- [ ] npm run build succeeds with no warnings
- [ ] dist/ folder size < 50MB (reasonable for a browser game without audio)
- [ ] Game loads in Chrome, Firefox, Safari, Edge
- [ ] Game works on mobile browser (basic touch controls)
- [ ] Audio plays after first click (autoplay policy respected)
- [ ] Save/load cycle works (play, refresh, continue)
- [ ] Settings persist across sessions
- [ ] All 9 sample JSON content files load without errors
- [ ] Blacksmith shop draws 3 items correctly
- [ ] Boss fight completes and triggers prestige
- [ ] No memory leaks in long session (check DevTools Memory tab after 30 min play)
- [ ] itch.io embed loads correctly

## Touch Controls (Basic Mobile Support)

**TouchInputManager (src/systems/TouchInputManager.ts):**
- Virtual joystick (left side): implemented via Phaser touch events, draw a circle guide + inner stick dot
- Action buttons (right side): Dash button, Interact button
- Aim: swipe direction on right half of screen
- Only active if scene.sys.game.device.input.touch is true
- Scale all touch zones to screen size

Give me every file. The main menu must be beautiful — it's the first thing players see.
```

**Verify after Phase 9:**
- Main menu loads with parallax forest + fireflies
- Settings persist across browser refresh
- npm run build produces dist/ with no errors
- Game runs from dist/ (npm run preview)
- Upload dist/ to itch.io as test — confirm it loads in browser

---
---

# FINAL QUALITY AUDIT PROMPT

**Run this as your last pass before calling it done:**

---

```
Circuit Grove is feature complete (TypeScript + Phaser 3 browser roguelike). Before declaring it done, audit these specific areas:

## 1. Performance Audit

Target: 60fps on a mid-range laptop (integrated graphics, 8GB RAM).

Identify and fix the top performance risks:

**Phaser-specific:**
- Are we using texture atlases everywhere (not individual sprites)?
- Are particle emitters being reused or creating new ones?
- Is the tilemap using the correct layer rendering path (static layers should use StaticTilemapLayer)?
- Are physics bodies correctly sized (too-large bodies = slow broadphase)?
- Are we running `scene.physics.world.debugGraphic` in production? (Should be disabled)
- Is our game loop doing heavy work in update()? (ContentLoader, SaveService should NEVER be called in update)

**JavaScript-specific:**
- Are we creating objects in hot paths (update loops)? Object creation = GC pressure
- Are EventBus listeners being removed when scenes are destroyed? (Memory leak risk)
- Are we using Array.filter/map/reduce in update()? (Use for loops in hot paths)

Give me concrete code fixes for any of the above you'd expect to be a problem in our architecture.

## 2. Game Feel Audit

Review these specific moments and tell me if our implementation is good enough or needs improvement:

a) The Dashing Kick: Is 80ms hit pause enough? Is the trail effect distinctive? Does the knockback look physical?
b) Enemy death: Does it feel impactful or does the enemy just disappear?
c) Room clear: Is the moment rewarding? Does it feel like an accomplishment?
d) Item pickup at Blacksmith: Is there enough ceremony around getting a new item?
e) Chip selection: Is the choice exciting or does it feel like picking from a menu?

For each that needs improvement, give me the specific code change.

## 3. Five Critical Edge Cases

Fix these in code:

a) Player and boss both die simultaneously — who wins? What state does the game enter?
b) Player pauses game during a boss phase transition (timeScale is mid-lerp) — what breaks?
c) ContentLoader finds two JSON files with the same itemId — what happens?
d) Player's browser loses focus mid-run (tab switch) — should the game auto-pause?
e) IndexedDB save fails halfway through — is the player's progress safe?

## 4. What's Missing?

Name the 3 most important systems a real shipped roguelike needs that our spec didn't cover. Give implementation notes for each so I can build them post-launch.

## 5. The Vibe Check

Read back over the game's satirical concept. Does our implementation actually serve the theme? Specifically:

- Do the MegaCorp memos feel sharp and funny?
- Does Elderwick's dialogue have actual weight?
- Does BUDDY's death feel genuinely bittersweet, or is it just a game over screen?
- Does Humphrey feel like a character or a shop interface with a name?

If any of these fall short, write better versions.
```

---

---

# APPENDIX: PROMPT DISCIPLINE RULES

These rules apply to every phase prompt. Read them before pasting anything.

## Before Pasting

**Rule 1 — Paste context.** Every prompt after Phase 1 starts with: *"Continuing Circuit Grove (TypeScript + Phaser 3). Phase N complete. Here are the relevant files from previous work: [paste 3-4 most relevant TypeScript files]."* Without this, the model reinvents interfaces inconsistently.

**Rule 2 — Specify Phaser version.** Always say "Phaser 3.80" — the API changes between major versions.

**Rule 3 — Paste your interfaces.** If Phase 5 uses IBehaviour from Phase 2, paste IBehaviour.ts. Don't assume continuity.

## While Getting Output

**Rule 4 — Reject summaries immediately.** If you see *"here's the general approach"* or *"you would implement X here"* — interrupt: *"Stop. Full implementation of [filename].ts. No summaries."*

**Rule 5 — Request files one at a time if output is long.** For files > 200 lines: *"Give me just the first 100 lines of [file]. I'll ask for the rest."* Prevents truncation.

**Rule 6 — Specific bug reports only.** When something breaks: paste the exact console error + the relevant code block. Ask for the specific fix. Don't ask for a full rewrite.

## Quality Red Flags 🚩

Stop and demand a redo if you see:

- `// TODO: implement` or `// implement actual logic here`
- `return null as any` or `return {} as ItemDefinition`
- `document.getElementById` inside Phaser code (use Phaser GameObjects)
- Magic strings: `emitter.emit('room_cleared')` instead of `emitter.emit(GameEvents.ROOM_CLEARED)`
- `new Enemy()` inside RoomManager (use EnemyFactory — no direct instantiation)
- Untyped `any` in function signatures
- `setInterval` or `setTimeout` in game code (use Phaser timers)
- `console.log` without surrounding `if (DEBUG)` guard
- EventBus listeners added but never removed on scene shutdown

## After Each Phase

```bash
npx tsc --noEmit        # Zero type errors
npm run dev             # Loads without console errors  
git add -A && git commit -m "Phase N: [description]"
```

Only proceed to the next phase after all three pass.

---

## Estimated Timeline

| Phase | Focus | Dev Time (with AI assistance) |
|-------|-------|-------------------------------|
| 1 | Foundation & types | 2-3 hours |
| 2 | Room system | 4-6 hours |
| 3 | Player & combat | 3-5 hours |
| 4 | Economy & shops | 3-4 hours |
| 5 | Skill trees | 4-6 hours |
| 6 | Hub & narrative | 4-5 hours |
| 7 | Bosses & prestige | 5-7 hours |
| 8 | Polish & juice | 3-4 hours |
| 9 | Settings & deploy | 2-3 hours |
| **Total** | | **30-43 hours** |

**This is roughly half the Unity estimate.** The browser stack removes: Unity editor setup, serialization complexity, build pipeline, scene management boilerplate, and compilation cycles. Phaser's API is terse and well-suited to this game type.

The remaining human work: designing and building room layouts in Tiled, sourcing/generating art assets, playtesting and tuning balance, writing all dialogue. The prompts generate the systems — you make it a game.

---

*Circuit Grove — "They paved paradise. We're taking it back."*
*Deploy target: itch.io + GitHub Pages. Stack: TypeScript + Phaser 3 + Vite.*
