import Phaser from 'phaser';
import { ItemPoolService } from '@/systems/ItemPoolService';
import { CurrencyManager } from '@/systems/CurrencyManager';
import type { ItemDefinition } from '@/types/content';
import type { GameScene } from '@/scenes/GameScene';
import { StatType } from '@/types/stats';

const HUMPHREY_LINES = [
  "I don't trust anything with a corporate logo. You shouldn't either.",
  "MegaCorp sent tax inspectors to the oak last spring. Elderwick chased 'em off with a stick.",
  "Everything here's salvaged. 'Sustainable sourcing,' they'd call it. I call it survival.",
  "Three acorns to every bolt. That's the real exchange rate no one talks about.",
  "You've got that look. The one that says you've decided to keep fighting. Good.",
  "I welded this forge together from a MegaCorp surveying drone. Seemed fitting.",
  "Don't let them tell you the forest isn't worth defending. It's worth everything.",
  "Killed a few of them animatronics myself. Back in my prime. Still could.",
  "If you find any corporate memos out there — post 'em. The colony deserves to know.",
  "The first rule of the Great Oak: no brand ambassadors. The second rule is the same.",
  "Had an apprentice once. Good lad. Moved to a MegaCorp town. Breaks my heart.",
  "I charge fair prices. Don't let anyone tell you otherwise.",
];

/**
 * BlacksmithUI — Humphrey's shop panel.
 * Built entirely from Phaser GameObjects (no DOM).
 */
export class BlacksmithUI {
  private scene: GameScene;
  private container!: Phaser.GameObjects.Container;
  private items: ItemDefinition[] = [];
  private dialogueIndex = 0;

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  open(): void {
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;

    const player = this.scene.player;
    const save = this.scene.sys.game.registry.get('saveData') as { metaScraps?: number };
    void save;

    this.items = ItemPoolService.drawForShop({
      biomeId:            'forest',
      actNumber:          1,
      animalId:           player ? 'bunny' : 'bunny',
      alreadyHeldItemIds: this.scene.player?.inventory.passiveItems.map((i) => i.itemId) ?? [],
      seenItemIds:        this.scene.runState?.seenItemIds ?? [],
      playerLuck:         player?.stats.getFinalValue(StatType.Luck) ?? 0,
    });

    // Add to seen items
    if (this.scene.runState) {
      for (const item of this.items) {
        if (!this.scene.runState.seenItemIds.includes(item.itemId)) {
          this.scene.runState.seenItemIds.push(item.itemId);
        }
      }
    }

    const panel     = this.scene.add.rectangle(cx, cy, 600, 320, 0x1a1a0a, 0.97);
    panel.setStrokeStyle(2, 0x664422);

    const title = this.scene.add.text(cx, cy - 130, "HUMPHREY'S FORGE", {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#d4a844',
    }).setOrigin(0.5);

    const line = HUMPHREY_LINES[this.dialogueIndex % HUMPHREY_LINES.length];
    this.dialogueIndex++;
    const dialogue = this.scene.add.text(cx - 260, cy - 100, `"${line}"`, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8b888',
      fontStyle: 'italic', wordWrap: { width: 520 },
    });

    const cards = this.items.map((item, i) => this.buildCard(item, cx - 180 + i * 180, cy + 20));

    const closeBtn = this.scene.add.text(cx, cy + 135, '[ Leave ]', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#888866',
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
    closeBtn.on('pointerup', () => this.close());

    this.container = this.scene.add.container(0, 0, [
      panel, title, dialogue, ...cards.flat(), closeBtn,
    ]);
  }

  private buildCard(item: ItemDefinition, x: number, y: number): Phaser.GameObjects.GameObject[] {
    const affordable = CurrencyManager.spendRunScraps.length > 0 &&
                       CurrencyManager.runScraps >= item.cost;

    const bg = this.scene.add.rectangle(x, y, 160, 200, 0x111108, 0.9);
    bg.setStrokeStyle(1, affordable ? 0x446644 : 0x442222);

    const nameText = this.scene.add.text(x, y - 75, item.name, {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#e8e8cc', align: 'center',
      wordWrap: { width: 140 },
    }).setOrigin(0.5);

    const cat = this.scene.add.text(x, y - 50, item.category.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '9px', color: this.categoryColour(item.category),
      backgroundColor: '#0a0a08', padding: { x: 4, y: 2 },
    }).setOrigin(0.5);

    const flavour = this.scene.add.text(x, y - 10, item.flavourText, {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#888877', fontStyle: 'italic',
      wordWrap: { width: 140 }, align: 'center',
    }).setOrigin(0.5);

    const cost = this.scene.add.text(x, y + 55, `⚙ ${item.cost}`, {
      fontFamily: 'monospace', fontSize: '14px', color: affordable ? '#d4a844' : '#aa4444',
    }).setOrigin(0.5);

    const buyBtn = this.scene.add.text(x, y + 80, 'BUY', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: affordable ? '#74C69D' : '#555544',
      backgroundColor: affordable ? '#1a2a1a' : '#111110',
      padding: { x: 12, y: 4 },
    }).setOrigin(0.5);

    if (affordable) {
      buyBtn.setInteractive({ cursor: 'pointer' });
      buyBtn.on('pointerover', () => buyBtn.setStyle({ color: '#ffffff' }));
      buyBtn.on('pointerout',  () => buyBtn.setStyle({ color: '#74C69D' }));
      buyBtn.on('pointerup',   () => this.purchaseItem(item, buyBtn, cost));
    }

    return [bg, nameText, cat, flavour, cost, buyBtn];
  }

  private purchaseItem(item: ItemDefinition, buyBtn: Phaser.GameObjects.Text, costText: Phaser.GameObjects.Text): void {
    if (!CurrencyManager.spendRunScraps(item.cost)) return;

    this.scene.player.inventory.addItem(item);

    // Sold animation
    this.scene.tweens.add({
      targets: buyBtn,
      scaleX: { from: 1, to: 0 },
      duration: 150,
      onComplete: () => {
        buyBtn.setText('SOLD').setStyle({ color: '#888866', backgroundColor: '#0a0a08' });
        this.scene.tweens.add({ targets: buyBtn, scaleX: 1, duration: 100 });
      },
    });
    costText.setStyle({ color: '#444433' });
  }

  private categoryColour(cat: string): string {
    switch (cat) {
      case 'weapon':     return '#ff8866';
      case 'trinket':    return '#aaaaff';
      case 'armour':     return '#44aaff';
      case 'consumable': return '#44cc88';
      default:           return '#aaaaaa';
    }
  }

  private close(): void {
    this.container?.destroy();
    this.scene.physics.resume();
  }
}
