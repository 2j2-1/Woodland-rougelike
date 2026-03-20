import { EventBus } from './EventBus';
import { GameEvents } from '@/types/events';
import { SaveService } from './SaveService';

class CurrencyManagerClass {
  runScraps  = 0;
  runChips   = 0;

  addRunScraps(amount: number): void {
    this.runScraps += amount;
    const save = SaveService.getCurrent();
    if (save) {
      save.totalScrapsEarned += amount;
    }
    EventBus.emit(GameEvents.SCRAP_CHANGED, { runScraps: this.runScraps });
  }

  spendRunScraps(amount: number): boolean {
    if (this.runScraps < amount) return false;
    this.runScraps -= amount;
    const save = SaveService.getCurrent();
    if (save) save.totalScrapsSpent += amount;
    EventBus.emit(GameEvents.SCRAP_CHANGED, { runScraps: this.runScraps });
    return true;
  }

  addChip(): void {
    this.runChips++;
    EventBus.emit(GameEvents.CHIP_CHANGED, { runChips: this.runChips });
  }

  onRunDeath(): void {
    const save = SaveService.getCurrent();
    if (save) {
      const kept = Math.floor(this.runScraps * 0.6);
      save.metaScraps += kept;
      EventBus.emit(GameEvents.META_SCRAP_CHANGED, { metaScraps: save.metaScraps });
    }
    this.runScraps = 0;
    this.runChips  = 0;
  }

  onRunComplete(): void {
    const save = SaveService.getCurrent();
    if (save) {
      save.metaScraps += this.runScraps;
      EventBus.emit(GameEvents.META_SCRAP_CHANGED, { metaScraps: save.metaScraps });
    }
    this.runScraps = 0;
    this.runChips  = 0;
  }

  spendMetaScraps(amount: number): boolean {
    const save = SaveService.getCurrent();
    if (!save || save.metaScraps < amount) return false;
    save.metaScraps -= amount;
    save.totalScrapsSpent += amount;
    EventBus.emit(GameEvents.META_SCRAP_CHANGED, { metaScraps: save.metaScraps });
    return true;
  }

  reset(): void {
    this.runScraps = 0;
    this.runChips  = 0;
  }
}

export { CurrencyManagerClass };
export const CurrencyManager = new CurrencyManagerClass();
