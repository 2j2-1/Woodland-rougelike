import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import { SaveService } from '@/systems/SaveService';
import type { PrestigeTrackDefinition } from '@/types/content';
import { ContentLoader } from '@/systems/ContentLoader';

export class PrestigeService {
  private static _instance: PrestigeService;
  static get instance(): PrestigeService {
    if (!this._instance) this._instance = new PrestigeService();
    return this._instance;
  }

  /** Check all tracks and return IDs that are newly completable */
  getClaimableTracks(): PrestigeTrackDefinition[] {
    const save   = SaveService.getCurrent();
    if (!save) return [];
    const tracks = ContentLoader.getAllPrestigeTracks();

    return tracks.filter(track => {
      if (save.claimedPrestigeTracks.includes(track.id)) return false;
      return this.evaluateCondition(track.condition, save);
    });
  }

  claimTrack(trackId: string): void {
    const save = SaveService.getCurrent();
    if (!save) return;
    if (save.claimedPrestigeTracks.includes(trackId)) return;

    const track = ContentLoader.getAllPrestigeTracks().find(t => t.id === trackId);
    if (!track)  return;

    save.claimedPrestigeTracks.push(trackId);
    this.applyReward(track, save);
    SaveService.save(save);
    EventBus.emit(GameEvents.PRESTIGE_TRACK_CLAIMED, { trackId });
  }

  private evaluateCondition(
    condition: PrestigeTrackDefinition['condition'],
    save: ReturnType<typeof SaveService.getCurrent>,
  ): boolean {
    if (!save) return false;
    switch (condition.type) {
      case 'deaths_under':
        return Object.values(save.deathsPerAnimal).every(d => d < condition.value!);
      case 'runs_completed':
        return (save.totalRunsCompleted ?? 0) >= condition.value!;
      case 'flag_set':
        return save.narrativeFlags.includes(condition.flagId!);
      default:
        return false;
    }
  }

  private applyReward(track: PrestigeTrackDefinition, save: NonNullable<ReturnType<typeof SaveService.getCurrent>>): void {
    switch (track.reward.type) {
      case 'unlock_animal':
        if (!save.unlockedAnimals.includes(track.reward.id!))
          save.unlockedAnimals.push(track.reward.id!);
        break;
      case 'meta_scraps':
        save.metaScraps = (save.metaScraps ?? 0) + (track.reward.amount ?? 0);
        break;
      case 'permanent_stat':
        // Store in prestige buff map on save
        (save as any).permanentBuffs = (save as any).permanentBuffs ?? {};
        (save as any).permanentBuffs[track.reward.stat!] =
          ((save as any).permanentBuffs[track.reward.stat!] ?? 0) + (track.reward.amount ?? 0);
        break;
    }
  }
}
