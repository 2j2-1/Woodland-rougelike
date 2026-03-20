import { SaveService } from './SaveService';
import { EventBus } from './EventBus';
import { GameEvents } from '@/types/events';
import type { Player } from '@/entities/Player';
import { StatType } from '@/types/stats';
import type { OperationType } from '@/types/stats';

/** EXP formula: cumulative EXP required for level n = floor(100 * n^1.4 / 10) * 10 */
function expForLevel(n: number): number {
  return Math.floor(100 * Math.pow(n, 1.4) / 10) * 10;
}

function getLevelFromExp(exp: number): number {
  let level = 1;
  let cumulative = 0;
  while (true) {
    cumulative += expForLevel(level);
    if (exp < cumulative) return level;
    level++;
  }
}

function getExpToNextLevel(exp: number): number {
  const currentLevel = getLevelFromExp(exp);
  let cumulative = 0;
  for (let i = 1; i < currentLevel; i++) {
    cumulative += expForLevel(i);
  }
  const nextThreshold = cumulative + expForLevel(currentLevel);
  return nextThreshold - exp;
}

class ProgressionServiceClass {
  awardExp(animalId: string, amount: number): void {
    const save = SaveService.getCurrent();
    if (!save) return;

    const prev = save.animalExp[animalId] ?? 0;
    const prevLevel = getLevelFromExp(prev);

    save.animalExp[animalId] = prev + amount;
    const newLevel = getLevelFromExp(save.animalExp[animalId]);

    if (newLevel > prevLevel) {
      // Award skill point per level gained
      const gained = newLevel - prevLevel;
      save.skillPoints[animalId] = (save.skillPoints[animalId] ?? 0) + gained;
      EventBus.emit(GameEvents.ANIMAL_LEVELED_UP, {
        animalId,
        level: newLevel,
        skillPointsGained: gained,
      });
    }
  }

  getLevel(animalId: string): number {
    const save = SaveService.getCurrent();
    const exp = save?.animalExp[animalId] ?? 0;
    return getLevelFromExp(exp);
  }

  getExpToNextLevel(animalId: string): number {
    const save = SaveService.getCurrent();
    const exp = save?.animalExp[animalId] ?? 0;
    return getExpToNextLevel(exp);
  }

  getSkillPoints(animalId: string): number {
    return SaveService.getCurrent()?.skillPoints[animalId] ?? 0;
  }

  canUnlockSkill(animalId: string, nodeId: string, prerequisiteNodeId: string | null): boolean {
    const save = SaveService.getCurrent();
    if (!save) return false;
    const unlocked = save.unlockedSkills[animalId] ?? [];
    if (unlocked.includes(nodeId)) return false;
    if (prerequisiteNodeId && !unlocked.includes(prerequisiteNodeId)) return false;
    if ((save.skillPoints[animalId] ?? 0) <= 0) return false;
    return true;
  }

  unlockSkill(animalId: string, nodeId: string, prerequisiteNodeId: string | null): boolean {
    if (!this.canUnlockSkill(animalId, nodeId, prerequisiteNodeId)) return false;
    const save = SaveService.getCurrent()!;
    save.skillPoints[animalId] = (save.skillPoints[animalId] ?? 1) - 1;
    if (!save.unlockedSkills[animalId]) save.unlockedSkills[animalId] = [];
    save.unlockedSkills[animalId].push(nodeId);
    EventBus.emit(GameEvents.SKILL_UNLOCKED, { animalId, nodeId });
    return true;
  }

  isUnlocked(animalId: string, nodeId: string): boolean {
    const save = SaveService.getCurrent();
    return (save?.unlockedSkills[animalId] ?? []).includes(nodeId);
  }

  /** Re-apply ALL unlocked skills for an animal — called at start of each run */
  applyUnlockedSkills(animalId: string, player: Player): void {
    const save = SaveService.getCurrent();
    const nodeIds = save?.unlockedSkills[animalId] ?? [];
    for (const nodeId of nodeIds) {
      this.applySkillEffect(nodeId, player);
    }
  }

  private applySkillEffect(nodeId: string, player: Player): void {
    // Stat modifier nodes are defined in the skill JSON — this would normally
    // look up the SkillNode definition. For now, use a registry pattern.
    const effect = SkillEffectRegistry.get(nodeId);
    if (effect) effect.apply(player);
  }
}

export const ProgressionService = new ProgressionServiceClass();

// ── Skill effect registry ──────────────────────────────────────────────────

interface ISkillEffect {
  apply(player: Player): void;
}

const skillEffectStore = new Map<string, ISkillEffect>();

export const SkillEffectRegistry = {
  register(nodeId: string, effect: ISkillEffect): void {
    skillEffectStore.set(nodeId, effect);
  },
  get(nodeId: string): ISkillEffect | undefined {
    return skillEffectStore.get(nodeId);
  },
};

// Built-in skill effects
SkillEffectRegistry.register('quick_feet', {
  apply(player) {
    player.stats.applyModifier({ stat: StatType.Speed, operation: 'add' as OperationType, value: 20, source: 'skill:quick_feet' });
  },
});
SkillEffectRegistry.register('iron_will', {
  apply(player) {
    player.stats.applyModifier({ stat: StatType.MaxHP, operation: 'add' as OperationType, value: 25, source: 'skill:iron_will' });
  },
});
SkillEffectRegistry.register('lucky_breaks', {
  apply(player) {
    player.stats.applyModifier({ stat: StatType.Luck, operation: 'add' as OperationType, value: 10, source: 'skill:lucky_breaks' });
  },
});
