import type { Player } from '@/entities/Player';

export interface IAbility {
  readonly id: string;
  readonly staminaCost: number;
  readonly cooldownMs: number;
  canActivate(): boolean;
  activate(): void;
  update(delta: number): void;
  get remainingCooldown(): number;
}
