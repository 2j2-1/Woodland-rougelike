import Phaser from 'phaser';
import { SettingsManager } from '@/systems/SettingsManager';

const DEPTH = 200;

type Tab = 'audio' | 'display' | 'accessibility';

export class SettingsUI {
  private scene:     Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private open:      boolean = false;
  private activeTab: Tab     = 'audio';

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
    const panW = 480;
    const panH = 380;

    this.container.add(
      this.scene.add.rectangle(cx, cy, panW, panH, 0x000000, 0.93).setStrokeStyle(1, 0x446644),
    );
    this.container.add(
      this.scene.add.text(cx, cy - panH / 2 + 22, 'SETTINGS', {
        fontFamily: 'Georgia, serif', fontSize: '17px', color: '#c8c8aa',
      }).setOrigin(0.5),
    );

    // Tabs
    const tabs: Tab[] = ['audio', 'display', 'accessibility'];
    tabs.forEach((tab, i) => {
      const tx    = cx - 100 + i * 100;
      const tabBg = this.scene.add.rectangle(tx, cy - panH / 2 + 50, 90, 26,
        tab === this.activeTab ? 0x224422 : 0x111111, 0.9)
        .setStrokeStyle(1, tab === this.activeTab ? 0x74C69D : 0x333333)
        .setInteractive({ cursor: 'pointer' });
      tabBg.on('pointerup', () => { this.activeTab = tab; this.build(); });

      this.container.add(tabBg);
      this.container.add(this.scene.add.text(tx, cy - panH / 2 + 50, tab.toUpperCase(), {
        fontFamily: 'Georgia, serif', fontSize: '10px',
        color: tab === this.activeTab ? '#74C69D' : '#668866',
      }).setOrigin(0.5));
    });

    const startY = cy - panH / 2 + 90;
    switch (this.activeTab) {
      case 'audio':       this.buildAudio(cx, startY, panW);       break;
      case 'display':     this.buildDisplay(cx, startY, panW);     break;
      case 'accessibility': this.buildA11y(cx, startY, panW);      break;
    }

    const closeBtn = this.scene.add.text(cx + panW / 2 - 16, cy - panH / 2 + 15, '×', {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#aa4444',
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
    closeBtn.on('pointerup', () => this.toggle());
    this.container.add(closeBtn);

    this.container.setVisible(true);
  }

  private buildAudio(cx: number, startY: number, _panW: number): void {
    const s = SettingsManager.settings;
    this.addSlider(cx, startY,       'Master Volume', s.masterVolume, v => SettingsManager.set('masterVolume', v));
    this.addSlider(cx, startY + 60,  'Music Volume',  s.musicVolume,  v => SettingsManager.set('musicVolume', v));
    this.addSlider(cx, startY + 120, 'SFX Volume',    s.sfxVolume,    v => SettingsManager.set('sfxVolume', v));
  }

  private buildDisplay(cx: number, startY: number, _panW: number): void {
    const s = SettingsManager.settings;
    this.addToggle(cx, startY,      'Show Damage Numbers', s.showDamageNumbers, v => SettingsManager.set('showDamageNumbers', v));
    this.addToggle(cx, startY + 50, 'Fullscreen',          s.fullscreen,        v => {
      SettingsManager.set('fullscreen', v);
      if (v) document.documentElement.requestFullscreen?.();
      else   document.exitFullscreen?.();
    });
  }

  private buildA11y(cx: number, startY: number, _panW: number): void {
    const s = SettingsManager.settings;
    this.addToggle(cx, startY,      'Colour-Blind Mode (Deuteranopia)', s.colourblindMode, v => SettingsManager.set('colourblindMode', v));
    this.addToggle(cx, startY + 50, 'Reduced Motion',                   s.reducedMotion,   v => SettingsManager.set('reducedMotion', v));
  }

  private addSlider(cx: number, y: number, label: string, value: number, onChange: (v: number) => void): void {
    this.container.add(this.scene.add.text(cx - 180, y, label, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8c8aa',
    }));

    const BAR_W = 200;
    const barBg = this.scene.add.rectangle(cx + 20, y + 14, BAR_W, 8, 0x222222, 1)
      .setStrokeStyle(1, 0x444444).setOrigin(0, 0.5).setInteractive({ cursor: 'pointer' });
    const fill  = this.scene.add.rectangle(cx + 20, y + 14, BAR_W * value, 8, 0x74C69D, 1)
      .setOrigin(0, 0.5);

    this.container.add(barBg);
    this.container.add(fill);

    barBg.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown) return;
      const pct = Phaser.Math.Clamp((ptr.x - (cx + 20)) / BAR_W, 0, 1);
      fill.width = BAR_W * pct;
      onChange(pct);
    });
    barBg.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const pct = Phaser.Math.Clamp((ptr.x - (cx + 20)) / BAR_W, 0, 1);
      fill.width = BAR_W * pct;
      onChange(pct);
    });
  }

  private addToggle(cx: number, y: number, label: string, value: boolean, onChange: (v: boolean) => void): void {
    this.container.add(this.scene.add.text(cx - 180, y, label, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8c8aa',
    }));
    let current = value;
    const box = this.scene.add.rectangle(cx + 80, y + 8, 44, 22,
      current ? 0x224422 : 0x222222, 1)
      .setStrokeStyle(1, current ? 0x74C69D : 0x444444)
      .setInteractive({ cursor: 'pointer' });
    const knob = this.scene.add.circle(
      current ? cx + 91 : cx + 69, y + 8, 8, current ? 0x74C69D : 0x555555,
    );
    this.container.add(box);
    this.container.add(knob);

    box.on('pointerup', () => {
      current = !current;
      box.fillColor = current ? 0x224422 : 0x222222;
      box.setStrokeStyle(1, current ? 0x74C69D : 0x444444);
      knob.x = current ? cx + 91 : cx + 69;
      knob.fillColor = current ? 0x74C69D : 0x555555;
      onChange(current);
    });
  }

  isOpen(): boolean { return this.open; }
}
