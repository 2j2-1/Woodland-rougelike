import Phaser from 'phaser';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

const DEPTH    = 100;
const BAR_W    = 500;
const BAR_H    = 20;
const TICK_COL = 0xffffff;

export class BossHealthBar {
  private scene:       Phaser.Scene;
  private container:   Phaser.GameObjects.Container;
  private barBg:       Phaser.GameObjects.Rectangle;
  private barFill:     Phaser.GameObjects.Rectangle;
  private nameLabel:   Phaser.GameObjects.Text;
  private phaseLabel:  Phaser.GameObjects.Text;
  private maxHp:       number = 1;
  private numPhases:   number = 3;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width } = scene.scale;
    const cx = width / 2;
    const y  = 30;

    this.barBg = scene.add.rectangle(cx, y, BAR_W, BAR_H, 0x220000, 1).setStrokeStyle(1, 0x664444);
    this.barFill = scene.add.rectangle(cx - BAR_W / 2, y, BAR_W, BAR_H - 4, 0xcc2222, 1).setOrigin(0, 0.5);

    this.nameLabel  = scene.add.text(cx, y - 18, '', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ffcc88',
    }).setOrigin(0.5);

    this.phaseLabel = scene.add.text(cx + BAR_W / 2 + 10, y, 'Phase I', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#ffbbbb',
    }).setOrigin(0, 0.5);

    this.container = scene.add.container(0, 0, [
      this.barBg, this.barFill, this.nameLabel, this.phaseLabel,
    ]).setDepth(DEPTH).setScrollFactor(0).setVisible(false);

    EventBus.on(GameEvents.BOSS_PHASE_CHANGED, this.onPhaseChanged, this);
    EventBus.on(GameEvents.BOSS_DIED,          this.hide, this);
  }

  show(name: string, maxHp: number, numPhases = 3): void {
    this.maxHp     = maxHp;
    this.numPhases = numPhases;
    this.nameLabel.setText(name);
    this.container.setVisible(true);
    this.setHp(maxHp);
    this.drawPhaseTicks();
  }

  hide(): void { this.container.setVisible(false); }

  setHp(hp: number): void {
    const pct = Phaser.Math.Clamp(hp / this.maxHp, 0, 1);
    this.barFill.width = BAR_W * pct;
    // Colour shifts red → orange as health drops
    const r = 0xcc;
    const g = Math.floor(0x22 + pct * 0x88);
    const col = (r << 16) | (g << 8) | 0x22;
    this.barFill.fillColor = col;
  }

  private drawPhaseTicks(): void {
    const { width } = this.scene.scale;
    const cx = width / 2;
    const y  = 30;
    const g  = this.scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    for (let i = 1; i < this.numPhases; i++) {
      const x = cx - BAR_W / 2 + (BAR_W / this.numPhases) * i;
      g.lineStyle(2, TICK_COL, 0.7);
      g.beginPath();
      g.moveTo(x, y - BAR_H / 2);
      g.lineTo(x, y + BAR_H / 2);
      g.strokePath();
    }
    this.container.add(g);
  }

  private onPhaseChanged({ phase }: { phase: number }): void {
    const names = ['Phase I', 'Phase II', 'Phase III', 'FINAL'];
    this.phaseLabel.setText(names[phase] ?? `Phase ${phase + 1}`);
    this.scene.cameras.main.shake(300, 0.01);
  }

  destroy(): void {
    EventBus.off(GameEvents.BOSS_PHASE_CHANGED, this.onPhaseChanged, this);
    EventBus.off(GameEvents.BOSS_DIED,          this.hide, this);
    this.container.destroy();
  }
}
