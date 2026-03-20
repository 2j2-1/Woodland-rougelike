import type { HubScene } from '@/scenes/HubScene';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import { SaveService } from '@/systems/SaveService';

/**
 * Manages contextual hub banners, seasonal decorations, and state-gate objects
 * that appear/disappear based on narrative flags.
 */
export class HubEventManager {
  private scene:   HubScene;
  private banners: Phaser.GameObjects.Text[] = [];

  constructor(scene: HubScene) {
    this.scene = scene;
    this.applyFlags();
    EventBus.on(GameEvents.NARRATIVE_FLAG_SET, this.onFlagSet, this);
  }

  private applyFlags(): void {
    const save = SaveService.getCurrent();
    if (!save) return;

    if (save.narrativeFlags.includes('FIRST_BOSS_DEFEAT')) {
      this.showVictoryBanner();
    }
    if (save.narrativeFlags.includes('FOUND_CIRCUIT_MAP')) {
      this.unlockSecretPath();
    }
  }

  private onFlagSet({ flagId }: { flagId: string }): void {
    if (flagId === 'FIRST_BOSS_DEFEAT') this.showVictoryBanner();
    if (flagId === 'FOUND_CIRCUIT_MAP') this.unlockSecretPath();
  }

  private showVictoryBanner(): void {
    const { width } = this.scene.scale;
    const banner = this.scene.add.text(width / 2, 30, '✦ BUDDY HAS BEEN REPROGRAMMED ✦', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#d4a844',
      backgroundColor: '#0a0a04', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(50);
    this.banners.push(banner);
  }

  private unlockSecretPath(): void {
    // Spawn a secret gate sprite or remove a blocker tile
    // For now signal via EventBus for RoomManager to handle
    EventBus.emit(GameEvents.HUB_SECRET_PATH_UNLOCKED);
  }

  destroy(): void {
    EventBus.off(GameEvents.NARRATIVE_FLAG_SET, this.onFlagSet, this);
    this.banners.forEach(b => b.destroy());
  }
}
