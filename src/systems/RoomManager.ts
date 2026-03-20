import Phaser from 'phaser';
import type { GameScene } from '@/scenes/GameScene';
import { EnemyManager } from '@/systems/EnemyManager';
import type { EnemySpawnPoint } from '@/systems/EnemyManager';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import type { Direction, RoomNode } from '@/systems/RunGraph';

/** Pixel padding between the screen edge and the room walls. */
const ROOM_PAD = 40;
/** Width/height of the door marker drawn on each wall. */
const DOOR_W   = 32;
const DOOR_H   = 8;
/** Depth of exit indicator rectangles. */
const DOOR_DEPTH = 10;

export class RoomManager {
  private scene: GameScene;
  private enemyManager: EnemyManager;
  private currentMap?: Phaser.Tilemaps.Tilemap;
  private spawnPoints: EnemySpawnPoint[] = [];
  private waves: Map<number, EnemySpawnPoint[]> = new Map();
  private currentWave = 0;
  private totalEnemies = 0;
  private roomCleared = false;
  private blacksmithCounter = 0;

  /** Currently loaded room node. */
  private currentNode?: RoomNode;

  /** Graphics object for the placeholder room – destroyed on cleanup. */
  private roomGraphics?: Phaser.GameObjects.Graphics;

  /** Coloured door indicator rectangles (one per direction that has an exit). */
  private exitIndicators: Map<Direction, Phaser.GameObjects.Rectangle> = new Map();
  /** Physics trigger zones placed after room clear. */
  private exitZones: Map<Direction, Phaser.GameObjects.Zone> = new Map();
  /** Overlap colliders for exit zones. */
  private exitOverlaps: Map<Direction, Phaser.Physics.Arcade.Collider> = new Map();

  /** Whether a transition has already been queued (prevents double-fire). */
  private _transitioning = false;

  // Named listener references for clean unregistration
  private _onEnemyDied?: () => void;
  private _onRewardDismissed?: () => void;

  constructor(scene: GameScene, enemyManager: GameScene['enemyManager']) {
    this.scene        = scene;
    this.enemyManager = enemyManager;
  }

  /**
   * Load a room from a RunGraph node.
   * @param node       The room to load.
   * @param entryDir   The direction the player entered from (so we know which wall to place them near).
   */
  async loadRoom(node: RoomNode, entryDir?: Direction): Promise<void> {
    this.cleanup();
    this.currentNode  = node;
    this.roomCleared  = false;
    this.currentWave  = 0;
    this.waves.clear();
    this._transitioning = false;

    if (this.scene.cache.tilemap.has(node.id)) {
      this.loadTilemap(node.id);
    } else {
      this.createPlaceholderRoom(node);
    }

    // Draw locked door indicators for every exit direction
    this.createExitIndicators(node);

    EventBus.emit(GameEvents.ROOM_LOADED, { templateId: node.id });
    this.activateRoom(entryDir);
  }

  // ── Tilemap path ───────────────────────────────────────────────────────────

  private loadTilemap(key: string): void {
    const map = this.scene.make.tilemap({ key });
    this.currentMap = map;

    const tileset = map.addTilesetImage('forest_tiles', 'forest_tiles');
    if (!tileset) return;

    map.createLayer('ground',     tileset, 0, 0);
    const obstacles = map.createLayer('obstacles',  tileset, 0, 0);
    map.createLayer('decoration', tileset, 0, 0);

    obstacles?.setCollisionByProperty({ collides: true });
    if (obstacles) {
      this.scene.physics.add.collider(this.scene.player, obstacles);
      this.scene.physics.add.collider(this.scene.enemyGroup, obstacles);
    }

    this.scene.cameraController.constrainToRoom(
      map.widthInPixels, map.heightInPixels,
    );

    const groups = map.getObjectLayer('objects');
    if (groups) {
      for (const obj of groups.objects) {
        const props = this.parseProps(obj.properties ?? []);
        if (obj.type === 'enemy_spawn') {
          this.addSpawnPoint(obj as { x: number; y: number }, props);
        }
        if (obj.type === 'player_spawn') {
          this.scene.player.setPosition(obj.x, obj.y);
        }
      }
    }

    this.groupWaves();
  }

  // ── Placeholder room ───────────────────────────────────────────────────────

  private createPlaceholderRoom(node: RoomNode): void {
    const { width, height } = this.scene.scale;

    const g = this.scene.add.graphics();
    g.setDepth(0);
    this.roomGraphics = g;

    // Floor fill
    g.fillStyle(0x1a2a10, 1);
    g.fillRect(ROOM_PAD, ROOM_PAD, width - ROOM_PAD * 2, height - ROOM_PAD * 2);

    // Wall border
    g.lineStyle(2, 0x446622, 1);
    g.strokeRect(ROOM_PAD, ROOM_PAD, width - ROOM_PAD * 2, height - ROOM_PAD * 2);

    // Decorative grid dots
    g.fillStyle(0x2a4a18, 0.4);
    for (let gx = ROOM_PAD + 60; gx < width - ROOM_PAD; gx += 80) {
      for (let gy = ROOM_PAD + 60; gy < height - ROOM_PAD; gy += 80) {
        g.fillRect(gx - 1, gy - 1, 2, 2);
      }
    }

    // Use the node's enemy pool for varied spawns
    const pool = node.enemyPool;
    const cx = width / 2;
    const cy = height / 2;
    this.spawnPoints = pool.map((enemyId, i) => {
      // Scatter spawn points around the room to avoid clustering
      const angle = (i / Math.max(pool.length, 1)) * Math.PI * 2;
      const radius = 150;
      return {
        enemyId,
        waveNumber: 1,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    });

    // Physics world bounds match the visible room
    this.scene.physics.world.setBounds(
      ROOM_PAD, ROOM_PAD, width - ROOM_PAD * 2, height - ROOM_PAD * 2,
    );
    this.scene.cameraController.constrainToRoom(width, height);

    this.groupWaves();
  }

  // ── Exit door indicators ───────────────────────────────────────────────────

  /**
   * Draw a coloured rectangle on each wall that has an exit.
   * Initially red (locked). Turned green when the room is cleared.
   */
  private createExitIndicators(node: RoomNode): void {
    const { width, height } = this.scene.scale;
    const dirs = Object.keys(node.exits) as Direction[];

    for (const dir of dirs) {
      const [x, y, w, h] = this.doorGeometry(dir, width, height);
      const rect = this.scene.add.rectangle(x, y, w, h, 0xcc2222, 0.9);
      rect.setDepth(DOOR_DEPTH);
      rect.setStrokeStyle(1, 0xff4444, 0.8);
      this.exitIndicators.set(dir, rect);
    }
  }

  /**
   * Returns [x, y, w, h] for a door indicator on the given wall.
   * The door is centred on the wall edge.
   */
  private doorGeometry(
    dir: Direction, sceneW: number, sceneH: number,
  ): [number, number, number, number] {
    const mx = sceneW / 2;
    const my = sceneH / 2;
    switch (dir) {
      case 'N': return [mx, ROOM_PAD,            DOOR_W, DOOR_H];
      case 'S': return [mx, sceneH - ROOM_PAD,   DOOR_W, DOOR_H];
      case 'E': return [sceneW - ROOM_PAD, my,   DOOR_H, DOOR_W];
      case 'W': return [ROOM_PAD,          my,   DOOR_H, DOOR_W];
    }
  }

  // ── Room activation ────────────────────────────────────────────────────────

  private activateRoom(entryDir?: Direction): void {
    if (this._onEnemyDied) {
      EventBus.off(GameEvents.ENEMY_DIED, this._onEnemyDied);
    }
    if (this._onRewardDismissed) {
      EventBus.off(GameEvents.ROOM_REWARD_DISMISSED, this._onRewardDismissed);
    }

    EventBus.emit(GameEvents.ROOM_ACTIVE, undefined);
    this.countTotalEnemies();
    this.spawnWave(1);

    this._onEnemyDied = () => this.checkClearCondition();
    EventBus.on(GameEvents.ENEMY_DIED, this._onEnemyDied);

    // Reposition player near the entry door (if we came from another room)
    if (entryDir) {
      this.repositionPlayerAtEntry(entryDir);
    }
  }

  /** Place player just inside the door they entered through. */
  private repositionPlayerAtEntry(entryDir: Direction): void {
    const { width, height } = this.scene.scale;
    const INSET = 80; // pixels inside the wall
    const cx = width / 2;
    const cy = height / 2;

    const positions: Record<Direction, { x: number; y: number }> = {
      N: { x: cx, y: ROOM_PAD + INSET },
      S: { x: cx, y: height - ROOM_PAD - INSET },
      E: { x: width  - ROOM_PAD - INSET, y: cy },
      W: { x: ROOM_PAD + INSET,          y: cy },
    };

    const pos = positions[entryDir];
    this.scene.player.setPosition(pos.x, pos.y);
    // Zero out velocity so player doesn't drift through the entry zone again
    const body = this.scene.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
  }

  // ── Wave management ────────────────────────────────────────────────────────

  private spawnWave(waveNum: number): void {
    this.currentWave = waveNum;
    const points = this.waves.get(waveNum) ?? [];
    this.enemyManager.spawnWave(points);
  }

  private checkClearCondition(): void {
    if (this.roomCleared) return;
    if (this.enemyManager.getAliveCount() > 0) return;

    const nextWave = this.currentWave + 1;
    if (this.waves.has(nextWave)) {
      this.spawnWave(nextWave);
      return;
    }

    this.onRoomCleared();
  }

  private onRoomCleared(): void {
    this.roomCleared = true;
    this.blacksmithCounter++;
    EventBus.emit(GameEvents.ROOM_CLEARED, { blacksmithCounter: this.blacksmithCounter });

    // Camera zoom-out celebration
    this.scene.cameraController.zoomTo(0.85, 500);
    this.scene.time.delayedCall(800, () => {
      this.scene.cameraController.zoomTo(1.0, 400);
    });

    // Offer reward; exits open after the player dismisses the reward UI
    this.scene.time.delayedCall(1200, () => {
      EventBus.emit(GameEvents.ROOM_REWARD_OPEN, undefined);

      this._onRewardDismissed = () => this.openExits();
      EventBus.on(GameEvents.ROOM_REWARD_DISMISSED, this._onRewardDismissed);
    });
  }

  // ── Exit management ────────────────────────────────────────────────────────

  /** Turn door indicators green and add physics trigger zones. */
  private openExits(): void {
    if (!this.currentNode) return;

    // Clean up left-over listener immediately
    if (this._onRewardDismissed) {
      EventBus.off(GameEvents.ROOM_REWARD_DISMISSED, this._onRewardDismissed);
      this._onRewardDismissed = undefined;
    }

    const dirs = Object.keys(this.currentNode.exits) as Direction[];
    for (const dir of dirs) {
      // Turn indicator green
      const indicator = this.exitIndicators.get(dir);
      if (indicator) {
        indicator.setFillStyle(0x22cc44, 0.9);
        indicator.setStrokeStyle(1, 0x44ff66, 0.9);
      }

      // Create physics trigger zone just inside the wall
      const { width, height } = this.scene.scale;
      const zone = this.createExitZone(dir, width, height);
      this.exitZones.set(dir, zone);

      const overlap = this.scene.physics.add.overlap(
        this.scene.player,
        zone,
        () => this.onPlayerEnterExit(dir),
      );
      this.exitOverlaps.set(dir, overlap);
    }

    EventBus.emit(GameEvents.ROOM_EXIT_OPENED, undefined);
  }

  /**
   * Create a thin physics trigger zone at the given wall.
   * Zone is placed just inside the physics world bounds so the player
   * can reach it while colliding with the world boundary.
   */
  private createExitZone(dir: Direction, sceneW: number, sceneH: number): Phaser.GameObjects.Zone {
    const ZONE_THICK = 20;
    const mx = sceneW / 2;
    const my = sceneH / 2;

    let x: number, y: number, w: number, h: number;
    switch (dir) {
      case 'N': x = mx;           y = ROOM_PAD + ZONE_THICK / 2; w = DOOR_W; h = ZONE_THICK; break;
      case 'S': x = mx;           y = sceneH - ROOM_PAD - ZONE_THICK / 2; w = DOOR_W; h = ZONE_THICK; break;
      case 'E': x = sceneW - ROOM_PAD - ZONE_THICK / 2; y = my; w = ZONE_THICK; h = DOOR_W; break;
      case 'W': x = ROOM_PAD + ZONE_THICK / 2; y = my; w = ZONE_THICK; h = DOOR_W; break;
    }

    const zone = this.scene.add.zone(x, y, w, h);
    this.scene.physics.world.enable(zone, Phaser.Physics.Arcade.STATIC_BODY);
    return zone;
  }

  private onPlayerEnterExit(dir: Direction): void {
    if (this._transitioning || !this.currentNode) return;
    const targetRoomId = this.currentNode.exits[dir];
    if (!targetRoomId) return;

    this._transitioning = true;
    EventBus.emit(GameEvents.ROOM_TRANSITION_START, { direction: dir, targetRoomId });
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  private cleanup(): void {
    if (this._onEnemyDied) {
      EventBus.off(GameEvents.ENEMY_DIED, this._onEnemyDied);
      this._onEnemyDied = undefined;
    }
    if (this._onRewardDismissed) {
      EventBus.off(GameEvents.ROOM_REWARD_DISMISSED, this._onRewardDismissed);
      this._onRewardDismissed = undefined;
    }

    // Destroy exit door objects
    for (const rect of this.exitIndicators.values()) rect.destroy();
    this.exitIndicators.clear();

    for (const overlap of this.exitOverlaps.values()) overlap.destroy();
    this.exitOverlaps.clear();

    for (const zone of this.exitZones.values()) zone.destroy();
    this.exitZones.clear();

    // Destroy room graphics
    this.roomGraphics?.destroy();
    this.roomGraphics = undefined;

    // Clear gameplay objects
    this.scene.enemyGroup.clear(true);
    this.scene.lootGroup.clear(true);

    this.currentMap?.destroy();
    this.currentMap = undefined;

    this.spawnPoints = [];
    this.waves.clear();
    this.currentWave  = 0;
    this.totalEnemies = 0;
    this.roomCleared  = false;
    this.currentNode  = undefined;
  }

  destroy(): void {
    this.cleanup();
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  private addSpawnPoint(obj: { x: number; y: number }, props: Record<string, unknown>): void {
    this.spawnPoints.push({
      enemyId: String(props['enemyId'] ?? 'robo-pheasant-mk1'),
      waveNumber: Number(props['waveNumber'] ?? 1),
      x: obj.x,
      y: obj.y,
    });
  }

  private groupWaves(): void {
    this.waves.clear();
    for (const sp of this.spawnPoints) {
      const arr = this.waves.get(sp.waveNumber) ?? [];
      arr.push(sp);
      this.waves.set(sp.waveNumber, arr);
    }
  }

  private countTotalEnemies(): void {
    this.totalEnemies = this.spawnPoints.length;
    void this.totalEnemies;
  }

  private parseProps(props: Array<{ name: string; value: unknown }>): Record<string, unknown> {
    return Object.fromEntries(props.map((p) => [p.name, p.value]));
  }
}
