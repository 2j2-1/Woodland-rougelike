import Phaser from 'phaser';
import { SaveService } from '@/systems/SaveService';

const DEPTH = 190;

export class MemoArchiveUI {
  private scene:     Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private open:      boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene     = scene;
    this.container = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0).setVisible(false);
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) this.build();
    else           this.container.setVisible(false);
  }

  private build(): void {
    this.container.removeAll(true);
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;

    const save    = SaveService.getCurrent();
    const memos   = save?.foundMemoIds ?? [];

    const panW = 520;
    const panH = 420;

    const bg = this.scene.add.rectangle(cx, cy, panW, panH, 0x000000, 0.93)
      .setStrokeStyle(1, 0x446644);
    this.container.add(bg);

    this.container.add(
      this.scene.add.text(cx, cy - panH / 2 + 22, 'MEMO ARCHIVE', {
        fontFamily: 'Georgia, serif', fontSize: '18px', color: '#d4c88a',
      }).setOrigin(0.5),
    );

    if (memos.length === 0) {
      this.container.add(
        this.scene.add.text(cx, cy, 'No memos found yet.\nExplore Circuit Grove to discover lore fragments.', {
          fontFamily: 'Georgia, serif', fontSize: '13px', color: '#777766',
          align: 'center', lineSpacing: 6,
        }).setOrigin(0.5),
      );
    } else {
      memos.forEach((memoId, i) => {
        const y = cy - panH / 2 + 65 + i * 34;
        const label = this.scene.add.text(cx - 200, y, `📄 ${memoId}`, {
          fontFamily: 'Georgia, serif', fontSize: '12px', color: '#a8c888',
        });
        this.container.add(label);
      });
    }

    const closeBtn = this.scene.add.text(cx + 235, cy - panH / 2 + 15, '×', {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#aa4444',
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
    closeBtn.on('pointerup', () => this.toggle());
    this.container.add(closeBtn);

    this.container.setVisible(true);
  }

  isOpen(): boolean { return this.open; }
}
