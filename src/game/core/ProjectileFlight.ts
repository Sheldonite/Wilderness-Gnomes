import { ABILITIES } from '../config/abilities';
import type { ExtraTargetMode } from '../config/weapons';
import type { CombatTarget } from './CombatResolver';
import type { Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

/** Projectile collision state is independent of rendering and never resets its lifetime. */
export class ProjectileFlight {
  readonly hitEnemyIds = new Set<number>();
  constructor(
    public damage: number,
    private extraTargetsRemaining: number,
    private readonly mode: ExtraTargetMode = 'bounce',
    private readonly retention: number = ABILITIES.ricochet.retention
  ) {}

  hit(
    id: number,
    position: Vector2Like,
    enemies: CombatTarget[],
    continueDirection?: Vector2Like
  ): Vector2Like | undefined {
    if (this.hitEnemyIds.has(id)) return undefined;
    this.hitEnemyIds.add(id);
    if (this.extraTargetsRemaining <= 0) return undefined;
    this.extraTargetsRemaining--;
    this.damage *= this.retention;
    if (this.mode === 'pierce') {
      return continueDirection ? normalize(continueDirection.x, continueDirection.y) : { x: 1, y: 0 };
    }
    let closest: CombatTarget | undefined;
    let nearest = ABILITIES.ricochet.range ** 2;
    for (const enemy of enemies) {
      if (enemy.isDead || this.hitEnemyIds.has(enemy.id)) continue;
      const d = distanceSq(position, enemy.position);
      if (d <= nearest) { closest = enemy; nearest = d; }
    }
    if (!closest) return undefined;
    return normalize(closest.position.x - position.x, closest.position.y - position.y);
  }
}
