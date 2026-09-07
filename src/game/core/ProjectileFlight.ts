import { ABILITIES } from '../config/abilities';
import type { ExtraTargetMode } from '../config/weapons';
import type { CombatTarget } from './CombatResolver';
import type { Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

export interface ProjectileSplit { directions: Vector2Like[]; damage: number; bounces: number; }

/** Projectile collision state is independent of rendering and never resets its lifetime. */
export class ProjectileFlight {
  readonly hitEnemyIds = new Set<number>();
  /** Chain Lightning: set once, when the bolt has spent its last bounce. */
  pendingSplit?: ProjectileSplit;
  constructor(
    public damage: number,
    private extraTargetsRemaining: number,
    private readonly mode: ExtraTargetMode = 'bounce',
    private retention: number = ABILITIES.ricochet.retention,
    /** Awakening tier for Chain Lightning: -1 for none, 0 awakened, 1 ascended. */
    private readonly chainTier = -1
  ) {
    if (chainTier >= 0) this.retention = ABILITIES.ricochet.chain[chainTier].retention;
  }

  private get chain() { return this.chainTier >= 0 ? ABILITIES.ricochet.chain[this.chainTier] : undefined; }

  hit(
    id: number,
    position: Vector2Like,
    enemies: CombatTarget[],
    continueDirection?: Vector2Like
  ): Vector2Like | undefined {
    if (this.hitEnemyIds.has(id)) return undefined;
    this.hitEnemyIds.add(id);
    if (this.extraTargetsRemaining <= 0) return this.finish(position, enemies, continueDirection);
    this.extraTargetsRemaining--;
    this.damage *= this.retention;
    if (this.mode === 'pierce') {
      return continueDirection ? normalize(continueDirection.x, continueDirection.y) : { x: 1, y: 0 };
    }
    const closest = this.nearest(position, enemies, this.chain?.range ?? ABILITIES.ricochet.range);
    if (!closest) return this.finish(position, enemies, continueDirection);
    return normalize(closest.position.x - position.x, closest.position.y - position.y);
  }

  private finish(position: Vector2Like, enemies: CombatTarget[], continueDirection?: Vector2Like): undefined {
    const chain = this.chain;
    if (!chain || this.pendingSplit) return undefined;
    const directions: Vector2Like[] = [];
    const taken = new Set(this.hitEnemyIds);
    for (let i = 0; i < chain.splitCount; i++) {
      const target = this.nearest(position, enemies, chain.range, taken);
      if (!target) break;
      taken.add(target.id);
      directions.push(normalize(target.position.x - position.x, target.position.y - position.y));
    }
    // fan out any spare bolts around the travel direction so the split always fires
    const base = continueDirection ? Math.atan2(continueDirection.y, continueDirection.x) : 0;
    for (let i = directions.length; i < chain.splitCount; i++) {
      const a = base + (i - (chain.splitCount - 1) / 2) * 0.6;
      directions.push({ x: Math.cos(a), y: Math.sin(a) });
    }
    this.pendingSplit = { directions, damage: this.damage * chain.splitDamage, bounces: chain.splitBounces };
    return undefined;
  }

  private nearest(position: Vector2Like, enemies: CombatTarget[], range: number, exclude: Set<number> = this.hitEnemyIds): CombatTarget | undefined {
    let closest: CombatTarget | undefined;
    let nearest = range ** 2;
    for (const enemy of enemies) {
      if (enemy.isDead || exclude.has(enemy.id)) continue;
      const d = distanceSq(position, enemy.position);
      if (d <= nearest) { closest = enemy; nearest = d; }
    }
    return closest;
  }
}
