import type { AchievementDefinition } from '@/types/content';
import { ContentLoader } from '@/systems/ContentLoader';
import { SaveService } from '@/systems/SaveService';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

export class AchievementService {
  private static unlocked: Set<string> = new Set();

  static init(): void {
    const save = SaveService.getCurrent();
    if (!save) return;
    (save.unlockedAchievements ?? []).forEach(id => this.unlocked.add(id));
  }

  /** Check if a specific achievement has been unlocked */
  static isUnlocked(id: string): boolean { return this.unlocked.has(id); }

  /** Unlock an achievement by ID (no-op if already unlocked) */
  static unlock(id: string): void {
    if (this.unlocked.has(id)) return;
    const def = ContentLoader.getAllAchievements().find(a => a.id === id);
    if (!def) return;

    this.unlocked.add(id);
    const save = SaveService.getCurrent();
    if (save) {
      save.unlockedAchievements = [...(save.unlockedAchievements ?? []), id];
      SaveService.save(save);
    }

    EventBus.emit(GameEvents.ACHIEVEMENT_UNLOCKED, { id, name: def.name, description: def.description });
  }

  /** Evaluate all achievement conditions against current save state */
  static checkAll(): void {
    const save  = SaveService.getCurrent();
    if (!save) return;
    const defs  = ContentLoader.getAllAchievements();

    defs.forEach(def => {
      if (this.unlocked.has(def.id)) return;
      if (this.evaluate(def, save)) this.unlock(def.id);
    });
  }

  private static evaluate(
    def: AchievementDefinition,
    save: NonNullable<ReturnType<typeof SaveService.getCurrent>>,
  ): boolean {
    switch (def.condition.type) {
      case 'kills':
        return (save.totalBossDefeats ?? 0) >= (def.condition.value ?? 0);
      case 'runs_completed':
        return (save.totalRunsCompleted ?? 0) >= (def.condition.value ?? 0);
      case 'flag_set':
        return save.narrativeFlags.includes(def.condition.flagId!);
      case 'items_collected':
        return (save.totalScrapsEarned ?? 0) >= (def.condition.value ?? 0);
      default:
        return false;
    }
  }

  static getAll(): AchievementDefinition[] { return ContentLoader.getAllAchievements(); }
  static getAllUnlocked(): string[]          { return [...this.unlocked]; }
}
