import Phaser from 'phaser';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import { ItemPoolService } from '@/systems/ItemPoolService';
import type { ItemDefinition } from '@/types/content';
import { StatType } from '@/types/stats';
import type { GameScene } from '@/scenes/GameScene';

const CARD_W   = 200;
const CARD_H   = 270;
const CARD_GAP = 30;
const TOTAL_W  = CARD_W * 3 + CARD_GAP * 2;

const CAT_COLOURS: Record<string, number> = {
  weapon:     0x4466ff,
  trinket:    0xffdd44,
  armour:     0x44bbff,
  consumable: 0x66dd66,
};

/**
 * RoomRewardUI — shown after every room is cleared.
 *
 * Presents three item cards to the player. Clicking one grants the item for
 * free and resumes gameplay. The UI blocks player input until a choice is made.
 *
 * Listening for ROOM_REWARD_OPEN event (payload: void).
 */
export class RoomRewardUI {
  private scene: GameScene;
  private container?: Phaser.GameObjects.Container;
  private visible = false;

  constructor(scene: GameScene) {
    this.scene = scene;
    EventBus.on(GameEvents.ROOM_REWARD_OPEN, () => this.open());
  }

  private open(): void {
    if (this.visible) return;
    this.visible = true;

    // Pause player movement while choosing
    const player = this.scene.player;
    if (player?.body) {
      (player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }

    const { width, height } = this.scene.scale;
    const cx = width  / 2;
    const cy = height / 2;

    const runState  = this.scene.runState;
    const luck      = player?.stats.getFinalValue(StatType.Luck) ?? 0;
    const animalId  = runState.animalId;
    const actNumber = runState.actNumber;

    const items = ItemPoolService.drawForShop({
      biomeId:            'forest',
      actNumber,
      animalId,
      alreadyHeldItemIds: runState.heldItemIds,
      seenItemIds:        runState.seenItemIds,
      playerLuck:         luck,
    });

    // Register shown items as seen even if skipped
    for (const item of items) {
      if (!runState.seenItemIds.includes(item.itemId)) {
        runState.seenItemIds.push(item.itemId);
      }
    }

    // ── Backdrop ──────────────────────────────────────────────────────────────
    const backdrop = this.scene.add.rectangle(cx, cy, width, height, 0x000000, 0.55);
    backdrop.setDepth(200);

    // ── Panel ─────────────────────────────────────────────────────────────────
    const panelBg = this.scene.add.rectangle(cx, cy, TOTAL_W + 80, CARD_H + 120, 0x1a2a10, 1);
    panelBg.setStrokeStyle(2, 0x446622);
    panelBg.setDepth(201);

    // ── Header ────────────────────────────────────────────────────────────────
    const header = this.scene.add.text(cx, cy - CARD_H / 2 - 40, 'ROOM CLEAR — CHOOSE A REWARD', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#aaddaa',
    }).setOrigin(0.5).setDepth(202);

    // ── Cards ─────────────────────────────────────────────────────────────────
    const cardObjects: Phaser.GameObjects.GameObject[] = [];

    items.forEach((item, i) => {
      const startX = cx - TOTAL_W / 2 + CARD_W / 2 + i * (CARD_W + CARD_GAP);
      const card   = this.buildCard(startX, cy, item, () => this.pick(item));
      cardObjects.push(...card);
    });

    // ── Skip button ───────────────────────────────────────────────────────────
    const skipBtn = this.scene.add.text(cx, cy + CARD_H / 2 + 55, '[ Skip ]', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#889988',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(202);
    skipBtn.on('pointerover', () => skipBtn.setColor('#ccddcc'));
    skipBtn.on('pointerout',  () => skipBtn.setColor('#889988'));
    skipBtn.on('pointerdown', () => this.close());

    this.container = this.scene.add.container(0, 0, [
      backdrop, panelBg, header, ...cardObjects, skipBtn,
    ]);
    this.container.setDepth(200);

    // Fade in
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 220 });
  }

  private buildCard(
    cx:   number,
    cy:   number,
    item: ItemDefinition,
    onPick: () => void,
  ): Phaser.GameObjects.GameObject[] {
    const DEPTH = 202;
    const catColour = CAT_COLOURS[item.category] ?? 0xffffff;

    // Card background
    const bg = this.scene.add.rectangle(cx, cy, CARD_W, CARD_H, 0x223318, 1)
      .setStrokeStyle(2, catColour)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH);

    // Category badge
    const badge = this.scene.add.rectangle(cx, cy - CARD_H / 2 + 18, CARD_W, 24, catColour, 0.25)
      .setDepth(DEPTH);

    const catLabel = this.scene.add.text(cx, cy - CARD_H / 2 + 18, item.category.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(DEPTH + 1);

    // Name
    const nameText = this.scene.add.text(cx, cy - CARD_H / 2 + 48, item.name, {
      fontFamily: 'monospace', fontSize: '13px', color: '#eeffee',
      wordWrap: { width: CARD_W - 16 }, align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH + 1);

    // Divider
    const divider = this.scene.add.rectangle(cx, cy - 30, CARD_W - 20, 1, catColour, 0.4)
      .setDepth(DEPTH);

    // Flavour text
    const flavour = this.scene.add.text(cx, cy - 10, item.flavourText, {
      fontFamily: 'monospace', fontSize: '10px', color: '#99bb99',
      wordWrap: { width: CARD_W - 20 }, align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH + 1);

    // Take button
    const btnBg = this.scene.add.rectangle(cx, cy + CARD_H / 2 - 28, CARD_W - 16, 28, catColour, 0.18)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH);
    const btnText = this.scene.add.text(cx, cy + CARD_H / 2 - 28, 'TAKE', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(DEPTH + 1);

    const pickFn = () => onPick();
    bg.on('pointerover',  () => { bg.setFillStyle(0x2d4a22); });
    bg.on('pointerout',   () => { bg.setFillStyle(0x223318); });
    bg.on('pointerdown',  pickFn);
    btnBg.on('pointerover',  () => { btnBg.setFillStyle(catColour, 0.35); });
    btnBg.on('pointerout',   () => { btnBg.setFillStyle(catColour, 0.18); });
    btnBg.on('pointerdown',  pickFn);

    return [bg, badge, catLabel, nameText, divider, flavour, btnBg, btnText];
  }

  private pick(item: ItemDefinition): void {
    this.scene.player?.inventory.addItem(item);
    const runState = this.scene.runState;
    if (!runState.heldItemIds.includes(item.itemId)) {
      runState.heldItemIds.push(item.itemId);
    }
    EventBus.emit(GameEvents.ROOM_REWARD_TAKEN, { item });
    this.close();
  }

  private close(): void {
    if (!this.visible) return;
    this.visible = false;

    // Notify room manager that the reward phase is over (take OR skip)
    EventBus.emit(GameEvents.ROOM_REWARD_DISMISSED, undefined);

    if (this.container) {
      this.scene.tweens.add({
        targets: this.container,
        alpha:   0,
        duration: 180,
        onComplete: () => {
          this.container?.destroy();
          this.container = undefined;
        },
      });
    }
  }

  destroy(): void {
    EventBus.off(GameEvents.ROOM_REWARD_OPEN, () => this.open());
    this.container?.destroy();
  }
}
