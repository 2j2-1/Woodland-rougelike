import Phaser from 'phaser';
import { ItemPoolService } from '@/systems/ItemPoolService';
import type { ChipDefinition } from '@/types/content';
import type { GameScene } from '@/scenes/GameScene';
import { ChipEffectApplicator } from '@/systems/ChipEffectApplicator';
import { StatType } from '@/types/stats';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

const TIER_COLOURS: Record<string, number> = {
  grey:  0x888888,
  green: 0x44cc66,
  gold:  0xd4a844,
  red:   0xff4444,
};

export class ChipTerminalUI {
  private scene: GameScene;
  private container!: Phaser.GameObjects.Container;

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  open(): void {
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;

    const chips = ItemPoolService.drawForChipTerminal({
      actNumber:          1,
      animalId:           'bunny',
      alreadyHeldItemIds: this.scene.runState?.appliedChipIds ?? [],
      seenItemIds:        this.scene.runState?.appliedChipIds ?? [],
      playerLuck:         this.scene.player?.stats.getFinalValue(StatType.Luck) ?? 0,
    });

    const overlay = this.scene.add.rectangle(cx, cy, width, height, 0x000000, 0.7);
    const title   = this.scene.add.text(cx, cy - 160, 'CHIP TERMINAL', {
      fontFamily: 'monospace', fontSize: '20px', color: '#22cc44',
    }).setOrigin(0.5);

    const sub = this.scene.add.text(cx, cy - 135, 'Select one chip to install:', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#666655', fontStyle: 'italic',
    }).setOrigin(0.5);

    const cards = chips.map((chip, i) => {
      const cardX = cx - 180 + i * 180;
      return this.buildChipCard(chip, cardX, cy, i * 120);
    });

    const skip = this.scene.add.text(cx, cy + 165, '[ Skip ]', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#555544',
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
    skip.on('pointerup', () => this.close());

    this.container = this.scene.add.container(0, 0, [overlay, title, sub, ...cards.flat(), skip]);
  }

  private buildChipCard(chip: ChipDefinition, x: number, y: number, flyDelay: number): Phaser.GameObjects.GameObject[] {
    const tierColour = TIER_COLOURS[chip.tier] ?? 0x888888;

    const bg = this.scene.add.rectangle(x, y - 120, 160, 220, 0x0a0a08, 0.95);
    bg.setStrokeStyle(2, tierColour);
    bg.setAlpha(0);
    this.scene.tweens.add({
      targets: bg, alpha: 1, y: y,
      duration: 300, ease: 'Back.easeOut', delay: flyDelay,
    });

    const tierBadge = this.scene.add.text(x, y - 75, chip.tier.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '9px',
      color: '#' + tierColour.toString(16).padStart(6, '0'),
      backgroundColor: '#050503', padding: { x: 4, y: 2 },
    }).setOrigin(0.5);

    const name = this.scene.add.text(x, y - 50, chip.name, {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#e8e8cc', align: 'center',
      wordWrap: { width: 140 },
    }).setOrigin(0.5);

    const desc = this.scene.add.text(x, y + 5, chip.flavourText, {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#888877',
      fontStyle: 'italic', wordWrap: { width: 140 }, align: 'center',
    }).setOrigin(0.5);

    // Effect summary
    const effectSummary = chip.statModifiers.map((m) => {
      const sign = m.operation === 'add' ? (m.value >= 0 ? '+' : '') : '×';
      return `${m.stat}: ${sign}${m.value}${m.operation === 'multiply' ? '' : ''}`;
    }).join('\n');

    const effects = this.scene.add.text(x, y + 55, (effectSummary || chip.effectId) ?? '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#' + tierColour.toString(16).padStart(6, '0'),
      align: 'center',
    }).setOrigin(0.5);

    const selectBtn = this.scene.add.text(x, y + 90, 'INSTALL', {
      fontFamily: 'monospace', fontSize: '13px', color: '#' + tierColour.toString(16).padStart(6, '0'),
      backgroundColor: '#0a110a', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

    selectBtn.on('pointerover', () => {
      this.scene.tweens.add({ targets: bg, scaleY: 1.04, duration: 80 });
      bg.setStrokeStyle(3, tierColour);
    });
    selectBtn.on('pointerout', () => {
      this.scene.tweens.add({ targets: bg, scaleY: 1, duration: 80 });
      bg.setStrokeStyle(2, tierColour);
    });
    selectBtn.on('pointerup', () => this.selectChip(chip));

    return [bg, tierBadge, name, desc, effects, selectBtn];
  }

  private selectChip(chip: ChipDefinition): void {
    ChipEffectApplicator.apply(chip, this.scene.player);

    if (this.scene.runState && !this.scene.runState.appliedChipIds.includes(chip.chipId)) {
      this.scene.runState.appliedChipIds.push(chip.chipId);
      this.scene.runState.chipsCollected++;
    }

    EventBus.emit(GameEvents.CHIP_APPLIED, { chip });
    this.close();
  }

  private close(): void {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 200,
      onComplete: () => this.container?.destroy(),
    });
  }
}
