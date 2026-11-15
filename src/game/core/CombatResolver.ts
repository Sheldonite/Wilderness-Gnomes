import type { DamageSourceId, Vector2Like } from './types';

export interface CombatTarget {
  id: number;
  isDead: boolean;
  position: Vector2Like;
  radius: number;
  takeDamage(amount: number): boolean;
}
export type DealDamage = (target: CombatTarget, amount: number, source?: DamageSourceId) => void;
export type DamageListener = (amount: number, source: DamageSourceId, target: CombatTarget) => void;

/** All damage sources share this gate. Destruction happens after combat finishes. */
export class CombatResolver {
  private readonly defeated = new Set<number>();
  constructor(
    private readonly onDefeat: (target: CombatTarget) => void,
    private readonly onDamage?: DamageListener
  ) {}

  readonly damage: DealDamage = (target, amount, source = 'weapon') => {
    if (target.isDead || this.defeated.has(target.id) || amount <= 0) return;
    this.onDamage?.(amount, source, target);
    if (target.takeDamage(amount)) {
      target.isDead = true;
      this.defeated.add(target.id);
      this.onDefeat(target);
    }
  };

  release(id: number): void { this.defeated.delete(id); }
}
