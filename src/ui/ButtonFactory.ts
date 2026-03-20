import Phaser from 'phaser';

export interface ButtonConfig {
  x:       number;
  y:       number;
  label:   string;
  width?:  number;
  height?: number;
  color?:  string;
  hoverColor?: string;
  fontSize?: string;
  depth?:  number;
  scrollFactor?: number;
  onClick: () => void;
}

/** Factory for consistent hover/press style buttons */
export class ButtonFactory {
  static create(scene: Phaser.Scene, cfg: ButtonConfig): Phaser.GameObjects.Container {
    const w    = cfg.width  ?? 200;
    const h    = cfg.height ?? 36;
    const col  = cfg.color       ?? '#74C69D';
    const hCol = cfg.hoverColor  ?? '#99eebb';
    const font = cfg.fontSize    ?? '14px';
    const sf   = cfg.scrollFactor ?? 0;
    const d    = cfg.depth        ?? 100;

    const bg = scene.add.rectangle(0, 0, w, h, 0x0a1a0a, 0.9)
      .setStrokeStyle(1, 0x446644);

    const label = scene.add.text(0, 0, cfg.label, {
      fontFamily: 'Georgia, serif', fontSize: font, color: col,
    }).setOrigin(0.5);

    const con = scene.add.container(cfg.x, cfg.y, [bg, label])
      .setDepth(d).setScrollFactor(sf);

    bg.setInteractive({ cursor: 'pointer' });
    bg.on('pointerover',  () => { bg.setStrokeStyle(2, 0x99eebb); label.setColor(hCol); });
    bg.on('pointerout',   () => { bg.setStrokeStyle(1, 0x446644); label.setColor(col); });
    bg.on('pointerdown',  () => { bg.setScale(0.97); });
    bg.on('pointerup',    () => { bg.setScale(1); cfg.onClick(); });

    return con;
  }
}
