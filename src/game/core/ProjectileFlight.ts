import { ABILITIES } from '../config/abilities';
import type { CombatTarget } from './CombatResolver';
import type { Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

/** Projectile collision state is independent of rendering and never resets its lifetime. */
export class ProjectileFlight {
  readonly hitEnemyIds = new Set<number>();
  constructor(public damage: number, private bouncesRemaining: number) {}

  hit(id: number, position: Vector2Like, enemies: CombatTarget[]): Vector2Like | undefined {
    if (this.hitEnemyIds.has(id)) return undefined;
    this.hitEnemyIds.add(id);
    if (this.bouncesRemaining <= 0) return undefined;
    let closest: CombatTarget | undefined;
    let nearest = ABILITIES.ricochet.range ** 2;
    for (const enemy of enemies) {
      if (enemy.isDead || this.hitEnemyIds.has(enemy.id)) continue;
      const d = distanceSq(position, enemy.position);
      if (d <= nearest) { closest = enemy; nearest = d; }
    }
    if (!closest) return undefined;
    this.bouncesRemaining--;
    this.damage *= ABILITIES.ricochet.retention;
    return normalize(closest.position.x - position.x, closest.position.y - position.y);
  }
}
