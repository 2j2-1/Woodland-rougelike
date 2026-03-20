/**
 * DevScene — developer sandbox environment.
 *
 * Features:
 *  • Live room with a playable character and physics
 *  • Right-side panel: spawn enemies, pick weapons, switch modes
 *  • Play mode: fight enemies, shift/right-click an enemy to inspect & edit stats live
 *  • Map Edit mode: click to place enemy spawn markers and wall obstacles
 *  • Save / load maps to localStorage (maps become the pool for future auto-room generation)
 *  • Selected enemy shows a live HP ring and stat editor via browser prompt
 *
 * Adding a new enemy:  create a JSON in /public/content/enemies/ → manifest.json
 * Adding a new weapon: create a JSON in /public/content/weapons/ → manifest.json
 * Adding a new behaviour: register it in BehaviourRegistry.registerDefaultBehaviours()
 */

import Phaser                       from 'phaser';
import { Player }                   from '@/entities/Player';
import { Enemy }                    from '@/entities/Enemy';
import { EnemyManager }             from '@/systems/EnemyManager';
import { ProjectileManager }        from '@/systems/ProjectileManager';
import { CameraController }         from '@/systems/CameraController';
import { HitPauseManager }          from '@/systems/HitPauseManager';
import { InputManager }             from '@/systems/InputManager';
import { CurrencyManager }          from '@/systems/CurrencyManager';
import { EnemyRegistry, WeaponRegistry } from '@/systems/Registry';
import { ProjectileWeapon }         from '@/abilities/ProjectileWeapon';
import { DashingKick }              from '@/abilities/DashingKick';
import { DamageNumbers }            from '@/effects/DamageNumbers';
import { EventBus }                 from '@/systems/EventBus';
import { GameEvents }               from '@/types/events';
import type { RunState }            from '@/types/game';
import type { GameScene }           from '@/scenes/GameScene';

// ── Layout constants ──────────────────────────────────────────────────────────
const GAME_W   = 960;   // game-area width (leaves 320 px for panel)
const ROOM_PAD = 40;    // visual border around the play area
const PNL_X    = GAME_W;
const PNL_W    = 320;

type DevMode  = 'play' | 'mapedit';
type EditTool = 'enemy' | 'wall' | 'erase';

// ── Map data shape ────────────────────────────────────────────────────────────
export interface DevMapData {
  id:          string;
  name:        string;
  obstacles:   Array<{ x: number; y: number; w: number; h: number }>;
  enemySpawns: Array<{ enemyId: string; x: number; y: number; waveNumber: number }>;
  playerSpawn: { x: number; y: number };
}

// ── Scene ─────────────────────────────────────────────────────────────────────
export class DevScene extends Phaser.Scene {
  // GameScene-compatible duck-type surface (AI behaviours reference these)
  player!:               Player;
  enemyGroup!:           Phaser.Physics.Arcade.Group;
  projectileGroup!:      Phaser.Physics.Arcade.Group;
  enemyProjectileGroup!: Phaser.Physics.Arcade.Group;
  lootGroup!:            Phaser.Physics.Arcade.Group;
  enemyManager!:         EnemyManager;
  projectileManager!:    ProjectileManager;
  cameraController!:     CameraController;
  hitPauseManager!:      HitPauseManager;
  inputManager!:         InputManager;
  currencyManager        = CurrencyManager;

  // Dev state
  private runState!:         RunState;
  private devMode:           DevMode   = 'play';
  private editTool:          EditTool  = 'enemy';
  private selectedEnemyType  = '';
  private selectedEnemy:     Enemy | null = null;
  private damageNumbers!:    DamageNumbers;

  // Physics walls (map edit)
  private wallGroup!:  Phaser.Physics.Arcade.StaticGroup;
  private wallRects:   Phaser.GameObjects.Rectangle[] = [];

  // Enemy spawn markers (map edit)
  private spawnMarkers: Array<{
    rect:      Phaser.GameObjects.Rectangle;
    label:     Phaser.GameObjects.Text;
    spawnData: DevMapData['enemySpawns'][0];
  }> = [];

  // Current map data
  private mapData: DevMapData = this.emptyMap(360);

  // Live selection overlay (drawn every frame in update)
  private selectionGfx!: Phaser.GameObjects.Graphics;

  // Stats panel elements (recreated on selection change)
  private statsElems: Phaser.GameObjects.GameObject[] = [];
  private statsHpText?: Phaser.GameObjects.Text;
  private statsBaseY   = 0;
  private statsTimer   = 0;

  // Panel layout cursor
  private pY = 0;

  // Event listener refs
  private onEnemyDied!: (d: { enemy: Enemy }) => void;

  constructor() { super({ key: 'DevScene' }); }

  // ── Phaser create ───────────────────────────────────────────────────────────
  create(): void {
    const { height } = this.scale;

    this.runState = {
      animalId: 'bunny', actNumber: 1, roomsCleared: 0,
      enemiesKilled: 0, scrapsEarned: 0, chipsCollected: 0,
      heldItemIds: [], seenItemIds: [], appliedChipIds: [],
      startTime: Date.now(), isActive: true,
    };

    // Physics world = inner room area
    this.physics.world.setBounds(ROOM_PAD, ROOM_PAD, GAME_W - ROOM_PAD * 2, height - ROOM_PAD * 2);

    this.drawBackground(height);

    // Physics groups
    this.enemyGroup           = this.physics.add.group();
    this.projectileGroup      = this.physics.add.group();
    this.enemyProjectileGroup = this.physics.add.group();
    this.lootGroup            = this.physics.add.group();
    this.wallGroup            = this.physics.add.staticGroup();

    // Systems — cast self as GameScene for duck-typing
    const gs = this as unknown as GameScene;
    this.inputManager     = new InputManager(gs);
    this.hitPauseManager  = new HitPauseManager(this);
    this.projectileManager = new ProjectileManager(gs, this.projectileGroup, this.enemyProjectileGroup);
    this.enemyManager     = new EnemyManager(gs, this.enemyGroup, this.runState);
    this.cameraController = new CameraController(gs);

    // Player at centre of room
    this.player = new Player(gs, GAME_W / 2, height / 2, 'bunny');

    this.setupColliders();
    this.buildPanel(height);
    this.damageNumbers = new DamageNumbers(this);

    // Show floating damage numbers on every hit
    EventBus.on(GameEvents.ENEMY_DAMAGED, ({ enemy, amount }: { enemy: Enemy; amount: number }) => {
      this.damageNumbers.spawn(enemy.x, enemy.y, amount);
    });

    // Default selected enemy type
    const defs = EnemyRegistry.getAll();
    if (defs.length > 0) this.selectedEnemyType = defs[0].enemyId;

    // Selection highlight (single persistent Graphics object, redrawn each frame)
    this.selectionGfx = this.add.graphics().setDepth(50);

    // Pointer input
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onPointerDown(ptr));

    // Enemy death callback
    this.onEnemyDied = ({ enemy }) => {
      if (this.selectedEnemy === enemy) {
        this.selectedEnemy = null;
        this.refreshStats();
      }
      if (this.enemyManager.getAliveCount() === 0) {
        this.toast('Room cleared! Spawn more enemies via the panel →');
      }
    };
    EventBus.on(GameEvents.ENEMY_DIED, this.onEnemyDied);

    // Auto-respawn player (dev convenience)
    EventBus.on(GameEvents.PLAYER_DIED, () => {
      this.toast('Player died — respawning in 2 s…');
      this.time.delayedCall(2000, () => this.respawnPlayer());
    });
  }

  // ── Background ──────────────────────────────────────────────────────────────
  private drawBackground(height: number): void {
    const g = this.add.graphics();

    // Room floor
    g.fillStyle(0x1c2d10, 1);
    g.fillRect(ROOM_PAD, ROOM_PAD, GAME_W - ROOM_PAD * 2, height - ROOM_PAD * 2);

    // Room border
    g.lineStyle(3, 0x4a7a28, 1);
    g.strokeRect(ROOM_PAD, ROOM_PAD, GAME_W - ROOM_PAD * 2, height - ROOM_PAD * 2);

    // Grid dots
    g.fillStyle(0x2a4a18, 0.45);
    for (let gx = ROOM_PAD + 60; gx < GAME_W - ROOM_PAD; gx += 80)
      for (let gy = ROOM_PAD + 60; gy < height - ROOM_PAD; gy += 80)
        g.fillRect(gx - 1, gy - 1, 2, 2);

    // Panel background
    g.fillStyle(0x0c1209, 0.97);
    g.fillRect(PNL_X, 0, PNL_W, height);
    g.lineStyle(2, 0x2a4a1a, 1);
    g.lineBetween(PNL_X, 0, PNL_X, height);

    // "DEV AREA" corner label
    this.add.text(ROOM_PAD + 6, ROOM_PAD + 4, '[ DEV SANDBOX ]', {
      fontFamily: 'monospace', fontSize: '9px', color: '#3a5a28',
    });
  }

  // ── Colliders ───────────────────────────────────────────────────────────────
  private setupColliders(): void {
    // Player ↔ enemies — solid separation (no overlap)
    this.physics.add.collider(this.player, this.enemyGroup);
    // Player projectiles hit enemies
    this.physics.add.overlap(
      this.projectileGroup, this.enemyGroup,
      (proj, enemy) => {
        (enemy as unknown as Enemy).takeDamageFromProjectile(proj as Phaser.GameObjects.GameObject);
      },
    );
    // Enemy projectiles hit player
    this.physics.add.overlap(
      this.enemyProjectileGroup, this.player,
      (_p, proj) => {
        this.player.takeDamageFromProjectile(proj as Phaser.GameObjects.GameObject);
      },
    );
    // Entities collide with placed walls
    this.physics.add.collider(this.enemyGroup, this.wallGroup);
    this.physics.add.collider(this.player,     this.wallGroup);
  }

  // ── Panel ───────────────────────────────────────────────────────────────────
  private buildPanel(height: number): void {
    this.pY = 8;

    // Title
    this.add.text(PNL_X + PNL_W / 2, this.pY + 10, '⚙  DEV MODE', {
      fontFamily: 'monospace', fontSize: '13px', color: '#74C69D',
    }).setOrigin(0.5);
    this.pY += 30;
    this.pDivider();

    // ── Mode ──
    this.pLabel('MODE');
    this.pBtn('▶ Play',     PNL_X + 75,  this.pY, () => this.setMode('play'));
    this.pBtn('✏ Map Edit', PNL_X + 215, this.pY, () => this.setMode('mapedit'));
    this.pY += 26;
    this.pDivider();

    // ── Spawn enemies ──
    this.pLabel('SPAWN / SELECT ENEMY');
    for (const def of EnemyRegistry.getAll()) {
      const eid = def.enemyId;
      this.pBtn(def.name, PNL_X + PNL_W / 2, this.pY, () => this.spawnOrSelect(eid));
      this.pY += 24;
    }
    this.pDivider();

    // ── Map tools ──
    this.pLabel('MAP EDIT TOOLS');
    this.pBtn('☰ Enemy Spawn', PNL_X + PNL_W / 2, this.pY, () => { this.editTool = 'enemy'; this.toast('Tool: place enemy spawn'); });
    this.pY += 24;
    this.pBtn('█ Place Wall',  PNL_X + PNL_W / 2, this.pY, () => { this.editTool = 'wall';  this.toast('Tool: place wall');        });
    this.pY += 24;
    this.pBtn('✕ Erase',       PNL_X + PNL_W / 2, this.pY, () => { this.editTool = 'erase'; this.toast('Tool: erase objects');     });
    this.pY += 24;
    this.pDivider();

    // ── Weapon switcher ──
    this.pLabel('PLAYER WEAPON');
    this.pBtn('Dashing Kick', PNL_X + PNL_W / 2, this.pY, () => this.equipWeapon('dashing_kick'));
    this.pY += 24;
    for (const wdef of WeaponRegistry.getAll()) {
      const wid = wdef.weaponId;
      this.pBtn(wdef.name, PNL_X + PNL_W / 2, this.pY, () => this.equipWeapon(wid));
      this.pY += 24;
    }
    this.pDivider();

    // ── Map files ──
    this.pLabel('MAP FILES');
    this.pBtn('💾 Save Map', PNL_X + PNL_W / 2, this.pY, () => this.saveMap());
    this.pY += 24;
    this.pBtn('📂 Load Map', PNL_X + PNL_W / 2, this.pY, () => this.loadMapPrompt());
    this.pY += 24;
    this.pBtn('🗑 Clear All', PNL_X + PNL_W / 2, this.pY, () => this.clearAll());
    this.pY += 24;
    this.pDivider();

    // ── Selected enemy ──
    this.pLabel('SELECTED ENEMY');
    this.statsBaseY = this.pY;
    this.refreshStats();

    // Back to menu (pinned to bottom)
    const by = height - 26;
    this.add.graphics().lineStyle(1, 0x1e3a1a).lineBetween(PNL_X + 4, by - 14, PNL_X + PNL_W - 4, by - 14);
    this.pBtn('← Main Menu', PNL_X + PNL_W / 2, by, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MainMenuScene'));
    });
  }

  // ── Stats display (dynamic, below panel static section) ──────────────────
  private refreshStats(): void {
    this.statsElems.forEach((e) => { try { (e as Phaser.GameObjects.GameObject).destroy(); } catch { /**/ } });
    this.statsElems    = [];
    this.statsHpText   = undefined;

    let y = this.statsBaseY;
    const x = PNL_X + 8;

    if (!this.selectedEnemy || !this.selectedEnemy.active) {
      const t = this.add.text(x, y, 'None — right-click or\nShift+click an enemy.', {
        fontFamily: 'monospace', fontSize: '9px', color: '#3a5a30', lineSpacing: 3,
      });
      this.statsElems.push(t);
      return;
    }

    const e = this.selectedEnemy;

    // HP line (updated cheaply via setText in update())
    this.statsHpText = this.add.text(x, y, `HP: ${e.hp} / ${e.maxHp}`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#88ee88',
    });
    this.statsElems.push(this.statsHpText);
    y += 15;

    // Static stats row
    const info = this.add.text(x, y,
      `DMG: ${e.damage}   SPD: ${e.speed}\nDEF: ${e.defence}   AGG: ${e.aggroRadius}\n${e.definition.enemyId}`,
      { fontFamily: 'monospace', fontSize: '9px', color: '#7aaa70', lineSpacing: 2 },
    );
    this.statsElems.push(info);
    y += 50;

    // Action buttons
    const mk = (label: string, col: string, cb: () => void) => {
      const { bg, txt } = this.mkBtn(x + (PNL_W - 16) / 2, y, label, col, cb);
      this.statsElems.push(bg, txt);
      y += 22;
    };

    mk('Edit HP',     '#a0d890', () => {
      const v = window.prompt(`Set HP (max ${e.maxHp}):`, String(e.hp));
      if (v === null) return;
      (e as unknown as { hp: number }).hp = Phaser.Math.Clamp(parseInt(v) || e.hp, 1, e.maxHp);
      this.refreshStats();
    });
    mk('Edit Damage', '#a0d890', () => {
      const v = window.prompt(`Set damage (current ${e.damage}):`, String(e.damage));
      if (v === null) return;
      (e as unknown as { damage: number }).damage = Math.max(0, parseInt(v) || (e.damage));
    });
    mk('☠ Kill',    '#ff6644', () => { (e as unknown as { hp: number }).hp = 0; e.die(); });
    mk('+ Full Heal', '#44dd88', () => {
      (e as unknown as { hp: number }).hp = e.maxHp;
      this.refreshStats();
    });
  }

  // ── Panel helpers ────────────────────────────────────────────────────────
  private pLabel(text: string): void {
    this.add.text(PNL_X + 8, this.pY, text, {
      fontFamily: 'monospace', fontSize: '9px', color: '#3a5a30',
    });
    this.pY += 14;
  }

  private pDivider(): void {
    this.add.graphics().lineStyle(1, 0x1e3a1a)
      .lineBetween(PNL_X + 4, this.pY, PNL_X + PNL_W - 4, this.pY);
    this.pY += 9;
  }

  private pBtn(label: string, x: number, y: number, cb: () => void): void {
    this.mkBtn(x, y + 11, label, '#a0c890', cb);
  }

  private mkBtn(
    x: number, y: number, label: string, color: string, cb: () => void,
  ): { bg: Phaser.GameObjects.Rectangle; txt: Phaser.GameObjects.Text } {
    const bw = PNL_W - 16;
    const bg = this.add.rectangle(x, y, bw, 20, 0x162810, 0.9).setInteractive({ cursor: 'pointer' });
    const txt = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: '10px', color,
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x223c14, 0.95));
    bg.on('pointerout',  () => bg.setFillStyle(0x162810, 0.9));
    bg.on('pointerup',   () => cb());
    return { bg, txt };
  }

  // ── Interaction ──────────────────────────────────────────────────────────
  private onPointerDown(ptr: Phaser.Input.Pointer): void {
    if (ptr.x >= PNL_X) return; // panel handled by individual buttons

    const wx = ptr.worldX;
    const wy = ptr.worldY;

    if (this.devMode === 'play') {
      // Right-click OR shift+click = select enemy
      if (ptr.rightButtonDown() || (ptr.event as MouseEvent).shiftKey) {
        this.selectEnemyAt(wx, wy);
      }
    } else {
      this.handleMapClick(wx, wy);
    }
  }

  private selectEnemyAt(wx: number, wy: number): void {
    let best: Enemy | null = null;
    let bestD = 52;
    for (const e of this.enemyManager.getAlive()) {
      const d = Phaser.Math.Distance.Between(wx, wy, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best) {
      this.selectedEnemy = best;
      this.refreshStats();
    }
  }

  private handleMapClick(wx: number, wy: number): void {
    const cx = Phaser.Math.Clamp(wx, ROOM_PAD + 16, GAME_W - ROOM_PAD - 16);
    const cy = Phaser.Math.Clamp(wy, ROOM_PAD + 16, this.scale.height - ROOM_PAD - 16);

    if (this.editTool === 'wall')  this.placeWall(cx, cy);
    if (this.editTool === 'enemy') this.placeSpawnMarker(cx, cy);
    // 'erase' handled by per-object pointerup listeners
  }

  // ── Map objects ──────────────────────────────────────────────────────────
  private placeWall(cx: number, cy: number): void {
    const data = { x: cx - 16, y: cy - 16, w: 32, h: 32 };
    this.mapData.obstacles.push(data);
    this.createWallRect(cx, cy, data);
  }

  private createWallRect(cx: number, cy: number, data: DevMapData['obstacles'][0]): void {
    const rect = this.add.rectangle(cx, cy, 32, 32, 0x4a3018, 1)
      .setStrokeStyle(1, 0x886644).setInteractive();
    this.wallGroup.add(rect);
    this.wallRects.push(rect);
    rect.on('pointerup', () => {
      if (this.editTool !== 'erase') return;
      const i = this.mapData.obstacles.indexOf(data);
      if (i >= 0) this.mapData.obstacles.splice(i, 1);
      this.wallGroup.remove(rect, true, true);
      const j = this.wallRects.indexOf(rect);
      if (j >= 0) this.wallRects.splice(j, 1);
    });
  }

  private placeSpawnMarker(cx: number, cy: number): void {
    const data: DevMapData['enemySpawns'][0] = {
      enemyId: this.selectedEnemyType, x: cx, y: cy, waveNumber: 1,
    };
    this.mapData.enemySpawns.push(data);
    this.createSpawnMarker(data);
  }

  private createSpawnMarker(data: DevMapData['enemySpawns'][0]): void {
    const tag  = data.enemyId.split('-').map((s) => s[0] ?? '').join('').toUpperCase();
    const rect = this.add.rectangle(data.x, data.y, 24, 24, 0xdd6600, 0.7)
      .setStrokeStyle(2, 0xff9900).setInteractive();
    const lbl  = this.add.text(data.x, data.y - 16, tag, {
      fontFamily: 'monospace', fontSize: '8px', color: '#ff9900',
    }).setOrigin(0.5);

    this.spawnMarkers.push({ rect, label: lbl, spawnData: data });

    rect.on('pointerup', () => {
      if (this.editTool !== 'erase') return;
      const i = this.mapData.enemySpawns.indexOf(data);
      if (i >= 0) this.mapData.enemySpawns.splice(i, 1);
      const j = this.spawnMarkers.findIndex((m) => m.rect === rect);
      if (j >= 0) this.spawnMarkers.splice(j, 1);
      rect.destroy(); lbl.destroy();
    });
  }

  // ── Dev actions ──────────────────────────────────────────────────────────
  private spawnOrSelect(enemyId: string): void {
    if (this.devMode === 'play') {
      // Immediate spawn at random room position
      const padding = 80;
      const rx = ROOM_PAD + padding + Math.random() * (GAME_W - ROOM_PAD * 2 - padding * 2);
      const ry = ROOM_PAD + padding + Math.random() * (this.scale.height - ROOM_PAD * 2 - padding * 2);
      this.enemyManager.spawnEnemy({ enemyId, x: rx, y: ry, waveNumber: 1 });
    } else {
      this.selectedEnemyType = enemyId;
      this.editTool = 'enemy';
      this.toast(`Selected: ${enemyId} — click in room to place spawn`);
    }
  }

  private setMode(mode: DevMode): void {
    this.devMode = mode;
    if (mode === 'play') {
      this.toast('▶ Play mode');
      // Auto-spawn map enemies on switch to play if room is empty
      if (this.enemyManager.getAliveCount() === 0 && this.mapData.enemySpawns.length > 0) {
        this.mapData.enemySpawns.forEach((sp) => this.enemyManager.spawnEnemy(sp));
        this.toast(`Spawned ${this.mapData.enemySpawns.length} enemies from map`);
      }
    } else {
      this.toast('✏ Map edit mode — click to place objects');
    }
  }

  private equipWeapon(weaponId: string): void {
    if (weaponId === 'dashing_kick') {
      this.player.abilityManager.setAbility('primary', new DashingKick(this.player));
      this.toast('Weapon: Dashing Kick');
      return;
    }
    const def = WeaponRegistry.get(weaponId);
    if (def) {
      this.player.abilityManager.setAbility('primary', new ProjectileWeapon(this.player, def));
      this.toast(`Weapon: ${def.name}`);
    }
  }

  private respawnPlayer(): void {
    const { height } = this.scale;
    this.player.setActive(true).setVisible(true).setAlpha(1);
    (this.player as unknown as { hp: number }).hp          = this.player.stats.getFinalValue('MaxHP' as Parameters<typeof this.player.stats.getFinalValue>[0]);
    (this.player as unknown as { isInvincible: boolean }).isInvincible = false;
    (this.player as unknown as { iframeTimer:  number }).iframeTimer   = 0;
    this.player.setPosition(GAME_W / 2, height / 2);
    // Re-attach player-died listener after respawn
    EventBus.once(GameEvents.PLAYER_DIED, () => {
      this.toast('Player died — respawning in 2 s…');
      this.time.delayedCall(2000, () => this.respawnPlayer());
    });
  }

  // ── Map save / load ───────────────────────────────────────────────────────
  private saveMap(): void {
    const name = window.prompt('Map name:', this.mapData.name);
    if (!name) return;
    this.mapData.name        = name;
    this.mapData.id          = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    this.mapData.playerSpawn = { x: this.player.x, y: this.player.y };

    try {
      const store = this.storedMaps();
      store[this.mapData.id] = {
        ...this.mapData,
        obstacles:   [...this.mapData.obstacles],
        enemySpawns: [...this.mapData.enemySpawns],
      };
      localStorage.setItem('cg_devmaps', JSON.stringify(store));
      this.toast(`💾 Saved: "${name}"`);
    } catch {
      this.toast('Save failed (localStorage error)');
    }
  }

  private loadMapPrompt(): void {
    const store = this.storedMaps();
    const keys  = Object.keys(store);
    if (keys.length === 0) { this.toast('No saved maps found.'); return; }
    const list   = keys.map((k, i) => `${i + 1}. ${store[k].name}`).join('\n');
    const choice = window.prompt(`Load map:\n${list}\n\nEnter number:`, '1');
    if (choice === null) return;
    const idx = parseInt(choice) - 1;
    if (idx >= 0 && idx < keys.length) {
      this.applyMap(store[keys[idx]]);
      this.toast(`📂 Loaded: "${store[keys[idx]].name}"`);
    }
  }

  private applyMap(data: DevMapData): void {
    this.clearAll(false);
    // Deep copy so edits don't corrupt stored data
    this.mapData = {
      ...data,
      obstacles:   data.obstacles.map((o) => ({ ...o })),
      enemySpawns: data.enemySpawns.map((s) => ({ ...s })),
    };
    for (const obs of this.mapData.obstacles)
      this.createWallRect(obs.x + obs.w / 2, obs.y + obs.h / 2, obs);
    for (const sp of this.mapData.enemySpawns)
      this.createSpawnMarker(sp);
    if (data.playerSpawn)
      this.player.setPosition(data.playerSpawn.x, data.playerSpawn.y);
  }

  private clearAll(confirm = true): void {
    if (confirm && !window.confirm('Clear all enemies, walls, and spawn markers?')) return;

    this.enemyManager.destroyAll();

    this.wallRects.forEach((r) => this.wallGroup.remove(r, true, true));
    this.wallRects = [];

    this.spawnMarkers.forEach((m) => { m.rect.destroy(); m.label.destroy(); });
    this.spawnMarkers = [];

    this.mapData = this.emptyMap(this.player?.y ?? this.scale.height / 2);

    this.selectedEnemy = null;
    this.refreshStats();
  }

  private storedMaps(): Record<string, DevMapData> {
    try { return JSON.parse(localStorage.getItem('cg_devmaps') ?? '{}') as Record<string, DevMapData>; }
    catch { return {}; }
  }

  private emptyMap(centerY: number): DevMapData {
    return {
      id: 'new-map', name: 'New Map',
      obstacles: [], enemySpawns: [],
      playerSpawn: { x: GAME_W / 2, y: centerY },
    };
  }

  // ── Toast notification ───────────────────────────────────────────────────
  private toast(msg: string): void {
    const t = this.add.text(PNL_X + PNL_W / 2, this.scale.height - 56, msg, {
      fontFamily: 'monospace', fontSize: '10px', color: '#74C69D',
      backgroundColor: '#071007', padding: { x: 6, y: 3 },
      wordWrap: { width: PNL_W - 16 }, align: 'center',
    }).setOrigin(0.5).setDepth(200);
    this.tweens.add({
      targets: t, alpha: 0, y: t.y - 12,
      duration: 2200, delay: 900, ease: 'Sine.easeIn',
      onComplete: () => t.destroy(),
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(time: number, delta: number): void {
    this.inputManager?.update();
    this.player?.update(time, delta);
    this.enemyManager?.update(time, delta);
    this.projectileManager?.update(time, delta);
    this.damageNumbers?.update(delta);

    // Redraw selection overlay every frame
    this.selectionGfx.clear();
    if (this.selectedEnemy?.active) {
      const e = this.selectedEnemy;
      const ratio = e.hp / e.maxHp;
      // Selection ring
      this.selectionGfx.lineStyle(2, 0x00ff88, 0.85).strokeCircle(e.x, e.y, 22);
      // HP bar background
      this.selectionGfx.fillStyle(0x222222, 0.7).fillRect(e.x - 20, e.y - 30, 40, 5);
      // HP bar fill (colour shifts from green → red)
      const col = ratio > 0.5 ? 0x00dd66 : ratio > 0.25 ? 0xddaa00 : 0xdd3300;
      this.selectionGfx.fillStyle(col, 1).fillRect(e.x - 20, e.y - 30, Math.round(40 * ratio), 5);
    }

    // Refresh HP text cheaply every 100 ms
    this.statsTimer += delta;
    if (this.statsTimer >= 100 && this.statsHpText && this.selectedEnemy?.active) {
      this.statsTimer = 0;
      this.statsHpText.setText(`HP: ${this.selectedEnemy.hp} / ${this.selectedEnemy.maxHp}`);
    }

    void time;
  }

  // ── Shutdown ──────────────────────────────────────────────────────────────
  shutdown(): void {
    EventBus.off(GameEvents.ENEMY_DIED, this.onEnemyDied);
    this.enemyGroup?.clear(true, true);
    this.projectileGroup?.clear(true, true);
    this.enemyProjectileGroup?.clear(true, true);
    this.lootGroup?.clear(true, true);
    this.wallGroup?.clear(true, true);
  }
}
