import Phaser from 'phaser';
import { PrestigeService } from '@/systems/PrestigeService';

const DEPTH = 190;

export class PrestigeAltarUI {
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

    const panW = 520;
    const panH = 400;
    const bg  = this.scene.add.rectangle(cx, cy, panW, panH, 0x000000, 0.93).setStrokeStyle(1, 0xaa8822);
    this.container.add(bg);

    this.container.add(
      this.scene.add.text(cx, cy - panH / 2 + 22, 'PRESTIGE ALTAR', {
        fontFamily: 'Georgia, serif', fontSize: '18px', color: '#d4a844',
      }).setOrigin(0.5),
    );

    const tracks = PrestigeService.instance.getClaimableTracks();
    if (tracks.length === 0) {
      this.container.add(
        this.scene.add.text(cx, cy, 'No prestige rewards available yet.\nComplete challenges to earn them.', {
          fontFamily: 'Georgia, serif', fontSize: '13px', color: '#777766',
          align: 'center', lineSpacing: 6,
        }).setOrigin(0.5),
      );
    } else {
      tracks.forEach((track, i) => {
        const y = cy - panH / 2 + 70 + i * 70;
        const row = this.scene.add.rectangle(cx, y, panW - 30, 56, 0x0a0a04, 0.9)
          .setStrokeStyle(1, 0x886622);
        this.container.add(row);

        this.container.add(this.scene.add.text(cx - 220, y - 15, track.name, {
          fontFamily: 'Georgia, serif', fontSize: '13px', color: '#d4c88a',
        }));
        this.container.add(this.scene.add.text(cx - 220, y + 5, track.description, {
          fontFamily: 'Georgia, serif', fontSize: '10px', color: '#999977',
        }));

        const claimBtn = this.scene.add.text(cx + 180, y, '[ CLAIM ]', {
          fontFamily: 'Georgia, serif', fontSize: '12px', color: '#d4a844',
          backgroundColor: '#1a1000', padding: { x: 8, y: 4 },
        }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
        claimBtn.on('pointerup', () => {
          PrestigeService.instance.claimTrack(track.id);
          this.build();
        });
        this.container.add(claimBtn);
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
