import Phaser from 'phaser';
import { PlayerStats, StatType } from '@/types/stats';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import { AbilityManager } from '@/systems/AbilityManager';
import { PlayerInventory } from '@/systems/PlayerInventory';
import { DashingKick } from '@/abilities/DashingKick';
import { TrailEffect } from '@/effects/TrailEffect';
import { AnimalRegistry } from '@/systems/Registry';
import type { GameScene } from '@/scenes/GameScene';
import type { DamageType } from '@/types/game';

const IFRAME_DURATION  = 800;
const IFRAME_ALPHA_HZ  = 10;
const STAMINA_REGEN    = 15; // per second
const STAMINA_REGEN_DELAY = 1500; // ms

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: PlayerStats;
  abilityManager: AbilityManager;
  inventory: PlayerInventory;
  trail: TrailEffect;

  hp: number;
  stamina: number;

  isDashing = false;
  isInvincible = false;

  private aimAngle = 0;
  private iframeTimer = 0;
  private iframeTween?: Phaser.Tweens.Tween;
  private staminaRegenTimer = 0;
  private statCache: Record<StatType, number>;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private leftClickWasDown = false;

  constructor(scene: GameScene, x: number, y: number, animalId: string) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(5);

    const animalDef = AnimalRegistry.get(animalId);
    const baseStats = animalDef
      ? ({ ...animalDef.baseStats } as Record<string, number>)
      : {};

    this.stats = new PlayerStats({
      [StatType.MaxHP]:       (baseStats['hp']      as number) ?? 100,
      [StatType.HP]:          (baseStats['hp']      as number) ?? 100,
      [StatType.Speed]:       (baseStats['speed']   as number) ?? 160,
      [StatType.Damage]:      (baseStats['damage']  as number) ?? 12,
      [StatType.Defence]:     (baseStats['defence'] as number) ?? 0,
      [StatType.Luck]:        (baseStats['luck']    as number) ?? 0,
      [StatType.MaxStamina]:  (baseStats['stamina'] as number) ?? 100,
      [StatType.Stamina]:     (baseStats['stamina'] as number) ?? 100,
    });

    this.hp      = this.stats.getFinalValue(StatType.MaxHP);
    this.stamina = this.stats.getFinalValue(StatType.MaxStamina);

    this.stats.on('statsChanged', () => this.invalidateStatCache());
    this.statCache = this.stats.snapshot();

    const bod = this.body as Phaser.Physics.Arcade.Body;
    bod.setDragX(800);
    bod.setDragY(800);
    bod.setCollideWorldBounds(true);

    // Abilities
    this.abilityManager = new AbilityManager(this);
    this.abilityManager.setAbility('primary', new DashingKick(this));

    // Inventory
    this.inventory = new PlayerInventory(this);

    // Trail
    this.trail = new TrailEffect(scene, this);

    // Input
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.spaceKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.emitStats();
  }

  update(_time: number, delta: number): void {
    if (!this.active) return;

    this.handleMovement(delta);
    this.handleAim();
    this.handleAbilityInput();
    this.updateIFrames(delta);
    this.updateStaminaRegen(delta);
    this.abilityManager.update(delta);
    this.trail.update();
  }

  private handleMovement(delta: number): void {
    if (this.isDashing) return;

    const scene = this.scene as GameScene;
    const speed = this.statCache[StatType.Speed];

    // Use InputManager so keyboard, gamepad, and mobile touch all work
    const vec = scene.inputManager.getMoveVector();
    let vx = vec.x;
    let vy = vec.y;

    // Isometric vertical feel
    vy *= 0.6;

    const bod = this.body as Phaser.Physics.Arcade.Body;
    bod.setVelocity(vx * speed, vy * speed);

    // Animation direction
    if (Math.abs(vx) > Math.abs(vy)) {
      this.setFlipX(vx < 0);
    }

    void delta;
  }

  private handleAim(): void {
    const scene = this.scene as GameScene;
    const pointer = scene.input.activePointer;
    const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y);
  }

  private handleAbilityInput(): void {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.abilityManager.activateSlot('primary');
    }
    // Left click activates primary — only fire on the frame the button is first pressed
    // and only when the pointer is NOT over an interactive UI element (e.g. dev panel buttons).
    const ptr = this.scene.input.activePointer;
    const leftDown = ptr.leftButtonDown();
    if (leftDown && !this.leftClickWasDown) {
      const hits = this.scene.input.hitTestPointer(ptr);
      if (hits.length === 0) {
        this.abilityManager.activateSlot('primary');
      }
    }
    this.leftClickWasDown = leftDown;
  }

  getAimAngle(): number { return this.aimAngle; }

  useStamina(amount: number): boolean {
    const max = this.statCache[StatType.MaxStamina];
    if (this.stamina < amount) return false;
    this.stamina = Math.max(0, this.stamina - amount);
    this.staminaRegenTimer = STAMINA_REGEN_DELAY;
    EventBus.emit(GameEvents.PLAYER_STAMINA_CHANGED, { stamina: this.stamina, maxStamina: max });
    return true;
  }

  takeDamage(amount: number, _type: DamageType = 'physical'): void {
    if (this.isInvincible || this.iframeTimer > 0) return;

    const defence = this.statCache[StatType.Defence];
    const final = Math.max(1, Math.floor(amount * (1 - defence / 100)));

    this.hp = Math.max(0, this.hp - final);
    this.iframeTimer = IFRAME_DURATION;
    this.isInvincible = true;

    // IFrame flicker
    this.iframeTween?.stop();
    this.iframeTween = this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.4 },
      duration: 1000 / IFRAME_ALPHA_HZ,
      yoyo: true,
      repeat: Math.floor(IFRAME_DURATION / (1000 / IFRAME_ALPHA_HZ)) - 1,
      ease: 'Stepped',
      onComplete: () => { this.setAlpha(1); },
    });

    const maxHp = this.statCache[StatType.MaxHP];
    EventBus.emit(GameEvents.PLAYER_DAMAGED, { hp: this.hp, maxHp, amount: final });
    (this.scene as GameScene).cameraController.shake('playerHit');

    if (this.hp <= 0) this.die();
  }

  takeDamageFromProjectile(proj: Phaser.GameObjects.GameObject): void {
    const p = proj as unknown as { damage: number; damageType: DamageType; destroy: () => void };
    this.takeDamage(p.damage, p.damageType);
    p.destroy();
  }

  heal(amount: number): void {
    const maxHp = this.statCache[StatType.MaxHP];
    this.hp = Math.min(maxHp, this.hp + amount);
    EventBus.emit(GameEvents.PLAYER_HEALED, { hp: this.hp, maxHp, amount });
  }

  private die(): void {
    this.isInvincible = true;
    this.setActive(false);
    this.scene.tweens.add({
      targets: this, alpha: 0, duration: 1000, ease: 'Quad.easeIn',
      onComplete: () => EventBus.emit(GameEvents.PLAYER_DIED, undefined),
    });
  }

  private updateIFrames(delta: number): void {
    if (this.iframeTimer > 0) {
      this.iframeTimer -= delta;
      if (this.iframeTimer <= 0) {
        this.iframeTimer = 0;
        this.isInvincible = false;
        this.setAlpha(1);
      }
    }
  }

  private updateStaminaRegen(delta: number): void {
    const max = this.statCache[StatType.MaxStamina];
    if (this.staminaRegenTimer > 0) {
      this.staminaRegenTimer -= delta;
      return;
    }
    if (this.stamina < max) {
      this.stamina = Math.min(max, this.stamina + STAMINA_REGEN * (delta / 1000));
      EventBus.emit(GameEvents.PLAYER_STAMINA_CHANGED, { stamina: this.stamina, maxStamina: max });
    }
  }

  private invalidateStatCache(): void {
    this.statCache = this.stats.snapshot();
    EventBus.emit(GameEvents.PLAYER_STATS_CHANGED, this.statCache);
  }

  private emitStats(): void {
    EventBus.emit(GameEvents.PLAYER_STATS_CHANGED, this.statCache);
    EventBus.emit(GameEvents.PLAYER_HEALED, {
      hp: this.hp,
      maxHp: this.statCache[StatType.MaxHP],
      amount: 0,
    });
    EventBus.emit(GameEvents.PLAYER_STAMINA_CHANGED, {
      stamina: this.stamina,
      maxStamina: this.statCache[StatType.MaxStamina],
    });
  }
}
