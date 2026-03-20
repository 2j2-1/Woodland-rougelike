import Phaser from 'phaser';
import { SaveService } from '@/systems/SaveService';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

/**
 * MainMenuScene — animated forest backdrop, parallax layers, fireflies, main buttons.
 */
export class MainMenuScene extends Phaser.Scene {
  private fireflies: Phaser.GameObjects.Arc[] = [];
  private parallaxLayers: Phaser.GameObjects.Image[] = [];
  private hasSave = false;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  async create(): Promise<void> {
    const { width, height } = this.scale;
    const cx = width / 2;

    this.cameras.main.setBackgroundColor('#0d0d08');

    // Parallax backgrounds (placeholder colours until art is loaded)
    this.createParallaxLayers(width, height);

    // Fireflies
    this.spawnFireflies(width, height);

    // Logo
    const logo = this.add
      .text(cx, 200, 'CIRCUIT GROVE', {
        fontFamily: 'Georgia, serif',
        fontSize: '56px',
        color: '#74C69D',
        stroke: '#0a1a0a',
        strokeThickness: 4,
        letterSpacing: 8,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: logo, alpha: 1, duration: 800, ease: 'Quad.easeIn' });

    this.add
      .text(cx, 262, "They paved paradise. We're taking it back.", {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#a0a890',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    this.hasSave = await SaveService.hasSave();
    this.buildButtons(cx);

    // Version
    this.add.text(width - 10, height - 10, 'v0.1.0', {
      fontFamily: 'monospace', fontSize: '10px', color: '#444433',
    }).setOrigin(1, 1);

    // Unlock audio on first interaction
    this.input.once('pointerdown', () => {
      EventBus.emit(GameEvents.AUDIO_UNLOCKED, undefined);
    });
  }

  update(): void {
    // Parallax scroll — layers drift slightly with time
    const time = this.time.now * 0.00008;
    for (const layer of this.parallaxLayers) {
      const factor = (layer as unknown as { parallaxFactor: number }).parallaxFactor;
      layer.setX(Math.sin(time * (1 + factor)) * 18 * factor);
    }
  }

  private createParallaxLayers(width: number, height: number): void {
    // Placeholder rectangles — replace with actual art in production
    const layers = [
      { depth: 0, color: 0x0a1008 },    // far trees
      { depth: 0.4, color: 0x0d1a0a },  // mid trees
      { depth: 0.8, color: 0x111e0e },  // foreground ferns
    ];
    for (const l of layers) {
      const g = this.add.graphics();
      g.fillStyle(l.color, 1);
      g.fillRect(0, height * (0.3 + l.depth * 0.3), width, height * 0.7);
      (g as unknown as { parallaxFactor: number }).parallaxFactor = l.depth;
      this.parallaxLayers.push(g as unknown as Phaser.GameObjects.Image);
    }
  }

  private spawnFireflies(width: number, height: number): void {
    for (let i = 0; i < 20; i++) {
      const ff = this.add.arc(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(height * 0.2, height * 0.9),
        2 + Math.random() * 3,
        0,
        360,
        false,
        0xd4ff8a,
        0.6 + Math.random() * 0.4
      );
      ff.setBlendMode(Phaser.BlendModes.ADD);
      this.fireflies.push(ff);

      // Wander + alpha oscillation
      this.time.addEvent({
        delay: 2000 + Math.random() * 3000,
        callback: () => this.wanderFirefly(ff, width, height),
        loop: true,
        startAt: Math.random() * 2000,
      });
      this.tweens.add({
        targets: ff,
        alpha: { from: 0.2, to: 0.9 },
        duration: 1200 + Math.random() * 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1000,
      });
    }
  }

  private wanderFirefly(ff: Phaser.GameObjects.Arc, width: number, height: number): void {
    const nx = Phaser.Math.Clamp(ff.x + Phaser.Math.Between(-60, 60), 0, width);
    const ny = Phaser.Math.Clamp(ff.y + Phaser.Math.Between(-40, 40), height * 0.2, height * 0.9);
    this.tweens.add({ targets: ff, x: nx, y: ny, duration: 2000, ease: 'Sine.easeInOut' });
  }

  private buildButtons(cx: number): void {
    let y = 340;
    const gap = 52;

    if (this.hasSave) {
      this.menuButton('Continue', cx, y, () => this.scene.start('HubScene'));
      y += gap;
    }

    this.menuButton('New Game', cx, y, () => this.startNewGame());
    y += gap;
    this.menuButton('Settings', cx, y, () => this.openSettings());
    y += gap;
    this.menuButton('Help', cx, y, () => this.openHelp());
    y += gap;
    this.menuButton('Credits', cx, y, () => this.showCredits());
    y += gap;

    // Dev mode entry — styled distinctly so it's easy to spot
    this.menuButton('[ Dev Sandbox ]', cx, y, () => this.openDevMode(), true);
  }

  private menuButton(label: string, x: number, y: number, onClick: () => void, isDev = false): void {
    const fillColor = isDev ? 0x0a1a2a : 0x1a2a1a;
    const textColor = isDev ? '#6ab0d0' : '#c8e6c2';
    const hoverColor = isDev ? 0x0f2e44 : 0x2a3e2a;
    const bg = this.add.rectangle(x, y, 220, 40, fillColor, 0.85).setInteractive({ cursor: 'pointer' });
    const text = this.add.text(x, y, label, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: textColor,
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      this.tweens.add({ targets: [bg, text], scaleX: 1.04, scaleY: 1.04, duration: 80 });
      bg.setFillStyle(hoverColor, 0.95);
    });
    bg.on('pointerout', () => {
      this.tweens.add({ targets: [bg, text], scaleX: 1, scaleY: 1, duration: 80 });
      bg.setFillStyle(fillColor, 0.85);
    });
    bg.on('pointerdown', () => this.tweens.add({ targets: [bg, text], scaleX: 0.97, scaleY: 0.97, duration: 50 }));
    bg.on('pointerup', () => {
      this.tweens.add({ targets: [bg, text], scaleX: 1, scaleY: 1, duration: 80 });
      onClick();
    });
  }

  private openDevMode(): void {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('DevScene'));
  }

  private async startNewGame(): Promise<void> {
    if (this.hasSave) {
      // Show confirmation dialog
      const confirmed = await this.confirmDialog('Erase your save and start fresh?');
      if (!confirmed) return;
      await SaveService.reset();
      await SaveService.load();
    }
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HubScene'));
  }

  private confirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const { width, height } = this.scale;
      const cx = width / 2;
      const cy = height / 2;

      const overlay = this.add.rectangle(cx, cy, width, height, 0x000000, 0.7);
      const panel = this.add.rectangle(cx, cy, 360, 140, 0x1a1a0a, 0.95);
      panel.setStrokeStyle(1, 0x446644);
      const msg = this.add.text(cx, cy - 30, message, {
        fontFamily: 'Georgia, serif', fontSize: '15px', color: '#c8e6c2',
        wordWrap: { width: 320 }, align: 'center',
      }).setOrigin(0.5);

      const cleanup = () => { overlay.destroy(); panel.destroy(); msg.destroy(); yesBtn.destroy(); noBtn.destroy(); };

      const yesBtn = this.add.text(cx - 50, cy + 35, 'YES', {
        fontFamily: 'Georgia, serif', fontSize: '16px', color: '#ff8866',
      }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
      yesBtn.on('pointerup', () => { cleanup(); resolve(true); });

      const noBtn = this.add.text(cx + 50, cy + 35, 'NO', {
        fontFamily: 'Georgia, serif', fontSize: '16px', color: '#74C69D',
      }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
      noBtn.on('pointerup', () => { cleanup(); resolve(false); });
    });
  }

  private openSettings(): void {
    EventBus.emit(GameEvents.UI_PANEL_OPEN, { mode: 'settings' });
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene', { mode: 'settings' });
    }
  }

  private openHelp(): void {
    EventBus.emit(GameEvents.UI_PANEL_OPEN, { mode: 'help' });
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene', { mode: 'help' });
    }
  }

  private showCredits(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000, 0.85);
    const text = this.add.text(cx, cy, 'Circuit Grove\n\nDesign & Code: You\nPowered by Phaser 3, TypeScript, Vercel\n\nClick to close', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#c8e6c2', align: 'center',
    }).setOrigin(0.5);
    overlay.setInteractive();
    overlay.once('pointerup', () => { overlay.destroy(); text.destroy(); });
  }
}
