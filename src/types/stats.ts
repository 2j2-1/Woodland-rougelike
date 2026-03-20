import Phaser from 'phaser';

export enum StatType {
  HP = 'HP',
  MaxHP = 'MaxHP',
  Speed = 'Speed',
  Damage = 'Damage',
  Defence = 'Defence',
  Luck = 'Luck',
  Stamina = 'Stamina',
  MaxStamina = 'MaxStamina',
}

export type OperationType = 'add' | 'multiply' | 'override';

export interface StatModifier {
  stat: StatType;
  operation: OperationType;
  value: number;
  /** Source identifier — used for removal (e.g. item ID, chip ID, skill node ID) */
  source: string;
}

const BASE_STATS: Record<StatType, number> = {
  [StatType.HP]: 100,
  [StatType.MaxHP]: 100,
  [StatType.Speed]: 160,
  [StatType.Damage]: 12,
  [StatType.Defence]: 0,
  [StatType.Luck]: 0,
  [StatType.Stamina]: 100,
  [StatType.MaxStamina]: 100,
};

export class PlayerStats extends Phaser.Events.EventEmitter {
  private baseValues: Record<StatType, number>;
  private modifiers: StatModifier[] = [];
  /** Cached final values — invalidated whenever modifiers change */
  private cache: Partial<Record<StatType, number>> = {};

  constructor(baseOverrides?: Partial<Record<StatType, number>>) {
    super();
    this.baseValues = { ...BASE_STATS, ...(baseOverrides ?? {}) };
  }

  applyModifier(m: StatModifier): void {
    this.modifiers.push(m);
    delete this.cache[m.stat];
    this.emit('statsChanged', m.stat);
  }

  removeModifier(source: string): void {
    const affected = new Set(
      this.modifiers.filter((m) => m.source === source).map((m) => m.stat)
    );
    this.modifiers = this.modifiers.filter((m) => m.source !== source);
    affected.forEach((stat) => {
      delete this.cache[stat];
      this.emit('statsChanged', stat);
    });
  }

  getFinalValue(stat: StatType): number {
    if (this.cache[stat] !== undefined) return this.cache[stat]!;

    let value = this.baseValues[stat];
    const relevant = this.modifiers.filter((m) => m.stat === stat);

    // Apply in order: overrides first, then adds, then multiplies
    const overrides = relevant.filter((m) => m.operation === 'override');
    if (overrides.length > 0) {
      value = overrides[overrides.length - 1].value;
    }

    const adds = relevant.filter((m) => m.operation === 'add');
    for (const a of adds) value += a.value;

    const multiplies = relevant.filter((m) => m.operation === 'multiply');
    for (const mul of multiplies) value *= mul.value;

    this.cache[stat] = value;
    return value;
  }

  setBase(stat: StatType, value: number): void {
    this.baseValues[stat] = value;
    delete this.cache[stat];
    this.emit('statsChanged', stat);
  }

  getBase(stat: StatType): number {
    return this.baseValues[stat];
  }

  /** Snapshot all final values — used for debug display */
  snapshot(): Record<StatType, number> {
    const result = {} as Record<StatType, number>;
    for (const stat of Object.values(StatType)) {
      result[stat] = this.getFinalValue(stat);
    }
    return result;
  }
}
