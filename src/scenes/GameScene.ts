import Phaser from 'phaser';
import { Player } from '@/entities/Player';
import { RoomManager } from '@/systems/RoomManager';
import { EnemyManager } from '@/systems/EnemyManager';
import { ProjectileManager } from '@/systems/ProjectileManager';
import { LootDropper } from '@/systems/LootDropper';
import { CameraController } from '@/systems/CameraController';
import { CurrencyManager, type CurrencyManagerClass } from '@/systems/CurrencyManager';
import { InputManager } from '@/systems/InputManager';
import { HitPauseManager } from '@/systems/HitPauseManager';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import { DamageNumbers } from '@/effects/DamageNumbers';
import { RoomRewardUI } from '@/ui/RoomRewardUI';
import { RunGraph, OPPOSITE_DIR } from '@/systems/RunGraph';
import type { Direction } from '@/systems/RunGraph';
import type { RunState } from '@/types/game';
import type { Enemy } from '@/entities/Enemy';

/**
 * GameScene — the main gameplay scene.
 * Owns all in-run systems and drives the game loop.
 */
export class GameScene extends Phaser.Scene {
  player!: Player;
  roomManager!: RoomManager;
  enemyManager!: EnemyManager;
  projectileManager!: ProjectileManager;
  lootDropper!: LootDropper;
  cameraController!: CameraController;
  currencyManager!: CurrencyManagerClass;
  inputManager!: InputManager;
  hitPauseManager!: HitPauseManager;
  damageNumbers!: DamageNumbers;
  roomRewardUI!: RoomRewardUI;

  // Physics groups
  playerGroup!: Phaser.Physics.Arcade.StaticGroup;
  enemyGroup!: Phaser.Physics.Arcade.Group;
  projectileGroup!: Phaser.Physics.Arcade.Group;
  enemyProjectileGroup!: Phaser.Physics.Arcade.Group;
  lootGroup!: Phaser.Physics.Arcade.Group;

  runState!: RunState;
  runGraph!: RunGraph;
  currentRoomId!: string;
  private isTransitioning = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { runState?: RunState }): void {
    this.runState = data.runState ?? {
      animalId: 'bunny',
      actNumber: 1,
      roomsCleared: 0,
      enemiesKilled: 0,
      scrapsEarned: 0,
      chipsCollected: 0,
      heldItemIds: [],
      seenItemIds: [],
      appliedChipIds: [],
      startTime: Date.now(),
      isActive: true,
    };
  }

  create(): void {
    // Physics world bounds are set by RoomManager.createPlaceholderRoom() / loadTilemap()
    // to match the visible room border (with padding), so don't set them here to full canvas.
    const { width, height } = this.scale;

    // Physics groups
    this.playerGroup   = this.physics.add.staticGroup();
    this.enemyGroup    = this.physics.add.group();
    this.projectileGroup      = this.physics.add.group();
    this.enemyProjectileGroup = this.physics.add.group();
    this.lootGroup     = this.physics.add.group();

    // Systems
    this.inputManager      = new InputManager(this);
    this.currencyManager   = CurrencyManager;
    this.hitPauseManager   = new HitPauseManager(this);
    this.projectileManager = new ProjectileManager(this, this.projectileGroup, this.enemyProjectileGroup);
    this.enemyManager      = new EnemyManager(this, this.enemyGroup, this.runState);
    this.lootDropper       = new LootDropper(this, this.lootGroup);
    this.cameraController  = new CameraController(this);
    this.damageNumbers     = new DamageNumbers(this);

    // Show floating damage numbers on every hit
    EventBus.on(GameEvents.ENEMY_DAMAGED, ({ enemy, amount }: { enemy: Enemy; amount: number }) => {
      this.damageNumbers.spawn(enemy.x, enemy.y, amount);
    });

    // Player
    this.player = new Player(this, width / 2, height / 2, this.runState.animalId);
    this.playerGroup.add(this.player);

    // Camera
    this.cameraController.followPlayer(this.player);

    // Room manager
    this.roomManager = new RoomManager(this, this.enemyManager);

    // Room reward UI — listens for ROOM_REWARD_OPEN and shows item choices
    this.roomRewardUI = new RoomRewardUI(this);

    // Colliders
    this.setupColliders();

    // Parallel UI scene
    this.scene.launch('UIScene', { gameScene: this });

    // Build the run graph and load the starting room
    this.runGraph = new RunGraph();
    this.currentRoomId = this.runGraph.startId;
    const startNode = this.runGraph.getRoom(this.currentRoomId)!;
    this.roomManager.loadRoom(startNode);

    // Listen for player-entered-exit events to handle transitions
    EventBus.on(
      GameEvents.ROOM_TRANSITION_START,
      ({ direction, targetRoomId }: { direction: Direction; targetRoomId: string }) => {
        this.transitionToRoom(direction, targetRoomId);
      },
    );

    // Mark graph cleared + update minimap when a room is cleared
    EventBus.on(GameEvents.ROOM_CLEARED, () => {
      this.runGraph.markCleared(this.currentRoomId);
      const node = this.runGraph.getRoom(this.currentRoomId);
      if (node) {
        EventBus.emit(GameEvents.ROOM_ENTERED, { col: node.col, row: node.row, cleared: true });
      }
    });

    EventBus.emit(GameEvents.RUN_STARTED, this.runState);
    // Broadcast graph so UIScene can wire the minimap
    EventBus.emit(GameEvents.GRAPH_READY, { graph: this.runGraph });
    // Announce the starting room position
    EventBus.emit(GameEvents.ROOM_ENTERED, {
      col:     startNode.col,
      row:     startNode.row,
      cleared: startNode.cleared,
    });
  }

  private setupColliders(): void {
    // player ↔ obstacles handled by RoomManager's tilemap layer
    // player ↔ enemies — solid separation (no overlap)
    this.physics.add.collider(this.player, this.enemyGroup);
    // enemies ↔ projectiles
    this.physics.add.overlap(
      this.projectileGroup,
      this.enemyGroup,
      (proj, enemy) => {
        (enemy as unknown as { takeDamageFromProjectile: (p: Phaser.GameObjects.GameObject) => void })
          .takeDamageFromProjectile(proj as Phaser.GameObjects.GameObject);
      }
    );
    // enemy projectiles ↔ player
    this.physics.add.overlap(
      this.enemyProjectileGroup,
      this.player,
      (_player, proj) => {
        this.player.takeDamageFromProjectile(proj as Phaser.GameObjects.GameObject);
      }
    );
    // player ↔ loot
    this.physics.add.overlap(
      this.player,
      this.lootGroup,
      (_player, loot) => {
        (loot as unknown as { collect: () => void }).collect();
      }
    );
  }

  /**
   * Fade the camera out, swap to the target room, then fade back in.
   * Called when the player walks into an open exit zone.
   */
  private transitionToRoom(direction: Direction, targetRoomId: string): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Load new room; player is repositioned inside loadRoom
      this.currentRoomId = targetRoomId;
      const node = this.runGraph.getRoom(targetRoomId)!;
      const entryDir = OPPOSITE_DIR[direction];
      this.roomManager.loadRoom(node, entryDir);
      this.runState.roomsCleared = this.runGraph.allRooms().filter((r) => r.cleared).length;

      // Announce new room to UIScene minimap
      EventBus.emit(GameEvents.ROOM_ENTERED, { col: node.col, row: node.row, cleared: node.cleared });

      this.cameras.main.fadeIn(280, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.isTransitioning = false;
        EventBus.emit(GameEvents.ROOM_TRANSITION_COMPLETE, undefined);
      });
    });
  }

  update(time: number, delta: number): void {
    this.inputManager.update();
    this.player.update(time, delta);
    this.enemyManager.update(time, delta);
    this.projectileManager.update(time, delta);
    this.lootDropper.update(time, delta);
    this.damageNumbers.update(delta);
  }

  /**
   * Shutdown handler — called when scene stops.
   * Cleans up all listeners and resources.
   */
  shutdown(): void {
    // Let managers clean up their own listeners
    // RoomManager cleans up in destroy()
    // HitPauseManager has destroy() for its listener

    // Clear physics groups
    if (this.playerGroup)            this.playerGroup.clear(true);
    if (this.enemyGroup)             this.enemyGroup.clear(true);
    if (this.projectileGroup)        this.projectileGroup.clear(true);
    if (this.enemyProjectileGroup)   this.enemyProjectileGroup.clear(true);
    if (this.lootGroup)              this.lootGroup.clear(true);

    // Shutdown managers that have destroy methods
    if (this.hitPauseManager)        this.hitPauseManager.destroy?.();
    if (this.roomManager)            this.roomManager.destroy?.();
    if (this.roomRewardUI)           this.roomRewardUI.destroy?.();

    this.runState.isActive = false;
  }
}
