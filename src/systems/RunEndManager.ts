import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import { CurrencyManager } from '@/systems/CurrencyManager';
import { SaveService } from '@/systems/SaveService';
import type { GameScene } from '@/scenes/GameScene';
import type { RunSummary } from '@/types/game';

/**
 * Listens for PLAYER_DIED, waits dramatically, then shows run summary.
 */
export class RunEndManager {
  private scene: GameScene;

  constructor(scene: GameScene) {
    this.scene = scene;

    EventBus.once(GameEvents.PLAYER_DIED, () => this.onPlayerDied(), this);
  }

  private onPlayerDied(): void {
    // Lock player input
    this.scene.player.setActive(false);

    // Dramatic zoom to player
    this.scene.cameraController.zoomTo(1.8, 2000);

    this.scene.time.delayedCall(2000, () => {
      this.scene.cameraController.fadeOut(600);
      this.scene.time.delayedCall(700, () => this.triggerRunEnd(false));
    });
  }

  private triggerRunEnd(completed: boolean): void {
    const rs = this.scene.runState;
    const durationSecs = Math.floor((Date.now() - rs.startTime) / 1000);
    const scrapsKept = Math.floor(CurrencyManager.runScraps * 0.6);

    const summary: RunSummary = {
      animalId:       rs.animalId,
      animalName:     rs.animalId,
      roomsCleared:   rs.roomsCleared,
      enemiesKilled:  rs.enemiesKilled,
      scrapsEarned:   CurrencyManager.runScraps,
      scrapsKept,
      chipsCollected: rs.chipsCollected,
      itemsFound:     [],
      durationSeconds: durationSecs,
      completed,
    };

    CurrencyManager.onRunDeath();
    const save = SaveService.getCurrent();
    if (save) {
      save.deathsPerAnimal[rs.animalId] = (save.deathsPerAnimal[rs.animalId] ?? 0) + 1;
    }

    EventBus.emit(GameEvents.RUN_ENDED, summary);

    // Show summary panel
    this.showSummary(summary);
  }

  private showSummary(summary: RunSummary): void {
    const panel = new RunSummaryPanel(this.scene, summary);
    panel.show();
  }
}

class RunSummaryPanel {
  private scene: GameScene;
  private summary: RunSummary;

  constructor(scene: GameScene, summary: RunSummary) {
    this.scene   = scene;
    this.summary = summary;
  }

  show(): void {
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;

    const overlay = this.scene.add.rectangle(cx, cy, width, height, 0x000000, 0.85).setScrollFactor(0);
    const panel   = this.scene.add.rectangle(cx, cy, 440, 360, 0x0a0a08, 0.97).setScrollFactor(0);
    panel.setStrokeStyle(1, 0x446644);

    const s = this.summary;

    this.text(cx, cy - 150, 'RUN ENDED', '24px', '#cc4422');
    this.text(cx, cy - 110, s.animalName.toUpperCase(), '18px', '#74C69D');
    this.text(cx - 160, cy - 75,  `Rooms cleared: ${s.roomsCleared}`, '13px', '#c8c8aa');
    this.text(cx - 160, cy - 55,  `Enemies killed: ${s.enemiesKilled}`, '13px', '#c8c8aa');
    this.text(cx - 160, cy - 35,  `Duration: ${this.formatTime(s.durationSeconds)}`, '13px', '#c8c8aa');
    this.text(cx - 160, cy - 5,   `Scraps earned: ${s.scrapsEarned}`, '13px', '#d4a844');
    this.text(cx - 160, cy + 15,  `Scraps kept (60%): ${s.scrapsKept}`, '13px', '#d4aa22');

    const returnBtn = this.scene.add.text(cx, cy + 140, '[ Return to The Great Oak ]', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#74C69D',
      backgroundColor: '#0a1a0a', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ cursor: 'pointer' });

    returnBtn.on('pointerup', () => {
      const save = SaveService.getCurrent();
      if (save) SaveService.save(save);
      this.scene.scene.stop('UIScene');
      this.scene.scene.start('HubScene');
    });

    void overlay; void panel;
  }

  private text(x: number, y: number, str: string, size: string, colour: string): void {
    this.scene.add.text(x, y, str, {
      fontFamily: 'Georgia, serif', fontSize: size, color: colour,
    }).setOrigin(0.5).setScrollFactor(0);
  }

  private formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}
