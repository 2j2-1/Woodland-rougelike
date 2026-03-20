import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';
import { SaveService } from '@/systems/SaveService';

const DEPTH    = 200;
const CARD_W   = 130;
const CARD_H   = 160;
const COLS     = 3;
const GAP      = 16;

export class AnimalSelector {
  private scene:     Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private open:      boolean = false;
  private onSelect?: (animalId: string) => void;

  constructor(scene: Phaser.Scene) {
    this.scene     = scene;
    this.container = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0).setVisible(false);
  }

  show(callback: (animalId: string) => void): void {
    this.onSelect = callback;
    this.open     = true;
    this.build();
  }

  hide(): void {
    this.open = false;
    this.container.setVisible(false);
  }

  private build(): void {
    this.container.removeAll(true);
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;

    const animals  = ContentLoader.getAllAnimals();
    const save     = SaveService.getCurrent();
    const unlocked: Set<string> = new Set(save?.unlockedAnimals ?? ['bunny']);

    const panW = (CARD_W + GAP) * COLS + GAP;
    const panH = 60 + Math.ceil(animals.length / COLS) * (CARD_H + GAP) + GAP + 50;

    const bg = this.scene.add.rectangle(cx, cy, panW, panH, 0x000000, 0.93).setStrokeStyle(1, 0x446644);
    this.container.add(bg);

    this.container.add(
      this.scene.add.text(cx, cy - panH / 2 + 22, 'CHOOSE YOUR ANIMAL', {
        fontFamily: 'Georgia, serif', fontSize: '18px', color: '#74C69D',
      }).setOrigin(0.5),
    );

    animals.forEach((animal, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x   = cx - panW / 2 + GAP + CARD_W / 2 + col * (CARD_W + GAP);
      const y   = cy - panH / 2 + 70 + CARD_H / 2 + row * (CARD_H + GAP);

      const isUnlocked = unlocked.has(animal.animalId);
      const alpha      = isUnlocked ? 1 : 0.45;

      const card = this.scene.add.rectangle(x, y, CARD_W, CARD_H, 0x0a1a0a, 0.95)
        .setStrokeStyle(1, isUnlocked ? 0x446644 : 0x333333)
        .setAlpha(alpha);
      this.container.add(card);

      // Animal name
      this.container.add(
        this.scene.add.text(x, y - 52, animal.name, {
          fontFamily: 'Georgia, serif', fontSize: '12px', color: isUnlocked ? '#74C69D' : '#556655',
        }).setOrigin(0.5).setAlpha(alpha),
      );

      // Key stats
      const stats = [
        `HP: ${animal.baseStats.hp}`,
        `SPD: ${animal.baseStats.speed}`,
        `ATK: ${animal.baseStats.damage}`,
        `LCK: ${animal.baseStats.luck}`,
      ];
      stats.forEach((line, li) => {
        this.container.add(
          this.scene.add.text(x, y - 30 + li * 18, line, {
            fontFamily: 'Georgia, serif', fontSize: '11px', color: '#a8c8a8',
          }).setOrigin(0.5).setAlpha(alpha),
        );
      });

      // Passive hint
      this.container.add(
        this.scene.add.text(x, y + 42, '', {
          fontFamily: 'Georgia, serif', fontSize: '9px', color: '#8aaa88', wordWrap: { width: CARD_W - 8 },
        }).setOrigin(0.5).setAlpha(alpha),
      );

      if (isUnlocked) {
        card.setInteractive({ cursor: 'pointer' });
        card.on('pointerup',   () => this.selectAnimal(animal.animalId));
        card.on('pointerover', () => card.setStrokeStyle(2, 0x99eebb));
        card.on('pointerout',  () => card.setStrokeStyle(1, 0x446644));
      } else {
        // Locked overlay
        this.container.add(
          this.scene.add.text(x, y, '🔒 LOCKED', {
            fontFamily: 'Georgia, serif', fontSize: '11px', color: '#555555',
          }).setOrigin(0.5),
        );
      }
    });

    this.container.setVisible(true);
  }

  private selectAnimal(id: string): void {
    this.onSelect?.(id);
    this.hide();
  }

  isOpen(): boolean { return this.open; }
}
