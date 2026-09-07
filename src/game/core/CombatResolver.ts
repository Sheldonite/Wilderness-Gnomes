import type { Vector2Like } from './types';

export interface CombatTarget {
  id: number;
  isDead: boolean;
  position: Vector2Like;
  radius: number;
  takeDamage(amount: number): boolean;
}
export type DealDamage = (target: CombatTarget, amount: number) => void;

/** All damage sources share this gate. Destruction happens after combat finishes. */
export class CombatResolver {
  private readonly defeated = new Set<number>();
  constructor(private readonly onDefeat: (target: CombatTarget) => void) {}

  readonly damage: DealDamage = (target, amount) => {
    if (target.isDead || this.defeated.has(target.id) || amount <= 0) return;
    if (target.takeDamage(amount)) {
      target.isDead = true;
      this.defeated.add(target.id);
      this.onDefeat(target);
    }
  };

  release(id: number): void { this.defeated.delete(id); }
}
