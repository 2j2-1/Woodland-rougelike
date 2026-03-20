import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';
import { SaveService } from '@/systems/SaveService';

/**
 * BootScene — first scene loaded.
 * Initialises SaveService, runs ContentLoader, shows a branded loading bar.
 */
export class BootScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBg!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Generate procedural textures used by the game (no external assets needed)
    this.generateTextures();

    // Background
    this.cameras.main.setBackgroundColor('#0a0a06');

    // Title
    this.add
      .text(cx, cy - 80, 'CIRCUIT GROVE', {
        fontFamily: 'Georgia, serif',
        fontSize: '42px',
        color: '#74C69D',
        letterSpacing: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 30, 'They paved paradise. We\'re taking it back.', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#a0a090',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    // Progress bar background
    this.progressBg = this.add.graphics();
    this.progressBg.fillStyle(0x222210, 1);
    this.progressBg.fillRect(cx - 200, cy + 30, 400, 12);

    // Progress bar fill
    this.progressBar = this.add.graphics();

    this.statusText = this.add
      .text(cx, cy + 60, 'Initialising...', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#666655',
      })
      .setOrigin(0.5);

    this.boot();
  }

  private async boot(): Promise<void> {
    try {
      this.setProgress(0.1, 'Identifying agent...');
      SaveService.init();

      this.setProgress(0.3, 'Loading world data...');
      await ContentLoader.loadAll();

      this.setProgress(0.7, 'Preparing the forest...');
      await SaveService.load();
      SaveService.setupAutoSave();

      this.setProgress(1.0, 'Ready.');
      await this.delay(300);

      this.scene.start('PreloadScene');
    } catch (err) {
      console.error('[BootScene] Fatal boot error:', err);
      this.statusText.setText('Error loading — check console. Refresh to retry.');
      this.statusText.setStyle({ color: '#ff6644' });
    }
  }

  private setProgress(fraction: number, status: string): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.progressBar.clear();
    this.progressBar.fillStyle(0x74c69d, 1);
    this.progressBar.fillRect(cx - 200, cy + 30, Math.floor(400 * fraction), 12);

    this.statusText.setText(status);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }

  /**
   * Generate simple procedural textures so the game works without external image assets.
   * These are only created if the key doesn't already exist (e.g. overridden by asset manifest).
   */
  private generateTextures(): void {
    const make = (key: string, size: number, drawFn: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 });
      g.setVisible(false);
      drawFn(g);
      g.generateTexture(key, size, size);
      g.destroy();
    };

    // Soft circular particle (used for death bursts and effects)
    make('particle', 8, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
    });

    // Player — rounded square with highlight
    make('player', 24, (g) => {
      g.fillStyle(0x74c69d, 1);
      g.fillRoundedRect(1, 1, 22, 22, 4);
      g.fillStyle(0xaaffcc, 0.6);
      g.fillRoundedRect(4, 4, 8, 8, 2);
    });

    // Enemy — slightly angular shape in red-orange
    make('enemy', 24, (g) => {
      g.fillStyle(0xdd4422, 1);
      g.fillRect(2, 2, 20, 20);
      g.fillStyle(0xff6644, 0.5);
      g.fillRect(4, 4, 8, 8);
    });

    // Projectile — small bright oval
    make('projectile', 10, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(5, 5, 4);
    });
  }
}
