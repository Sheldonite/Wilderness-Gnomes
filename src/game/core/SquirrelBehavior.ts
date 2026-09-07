import { BALANCE } from '../config/balance';
import type { Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

/** Pure movement and throwing rules for grey (ranged) squirrels, kept free of rendering for tests. */
export class RangedSquirrelBehavior {
  private cooldownMs: number;

  constructor(random: () => number = Math.random) {
    // stagger first throws so a fresh group does not volley all at once
    this.cooldownMs = BALANCE.rangedEnemy.throwCooldownMs * (0.4 + random() * 0.6);
  }

  /** Direction to move: approach from afar, hold at the preferred range, back away when crowded. */
  steer(position: Vector2Like, target: Vector2Like): Vector2Like {
    const toward = normalize(target.x - position.x, target.y - position.y);
    const distance = Math.sqrt(distanceSq(position, target));
    if (distance < BALANCE.rangedEnemy.retreatRange) return { x: -toward.x, y: -toward.y };
    if (distance < BALANCE.rangedEnemy.preferredRange) return { x: 0, y: 0 };
    return toward;
  }

  tick(deltaMs: number): void {
    this.cooldownMs -= deltaMs;
  }

  /** Launch velocity for an acorn when ready and in range, else undefined. */
  tryThrow(position: Vector2Like, target: Vector2Like): Vector2Like | undefined {
    if (this.cooldownMs > 0) return undefined;
    if (distanceSq(position, target) > BALANCE.rangedEnemy.throwRange ** 2) return undefined;
    this.cooldownMs = BALANCE.rangedEnemy.throwCooldownMs;
    const aim = normalize(target.x - position.x, target.y - position.y);
    return { x: aim.x * BALANCE.rangedEnemy.acornSpeed, y: aim.y * BALANCE.rangedEnemy.acornSpeed };
  }
}

export type SpawnVariant = 'brown' | 'grey' | 'doe' | 'fawn' | 'buck';

/** Which creature a fresh spawn should be: deer only from the deer level, else squirrels with greys mixed in. */
export function rollSpawnVariant(playerLevel: number, random: () => number = Math.random): SpawnVariant {
  if (playerLevel >= BALANCE.deer.buckLevel && random() < BALANCE.deer.buckChance) return 'buck';
  if (playerLevel >= BALANCE.deer.unlockLevel) return random() < BALANCE.deer.fawnChance ? 'fawn' : 'doe';
  if (playerLevel >= BALANCE.rangedEnemy.unlockLevel && random() < BALANCE.rangedEnemy.spawnChance) return 'grey';
  return 'brown';
}

/** Whether a fresh spawn should be a grey squirrel. */
export function rollRangedSpawn(playerLevel: number, random: () => number = Math.random): boolean {
  return rollSpawnVariant(playerLevel, random) === 'grey';
}
