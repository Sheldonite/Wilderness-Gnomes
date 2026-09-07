import { ABILITIES } from '../config/abilities';
import type { CombatTarget } from './CombatResolver';
import type { AbilityRank, Vector2Like } from './types';
import { distanceSq } from '../utils/math';

export function secondPounceTarget<T extends CombatTarget>(rank: AbilityRank, firstId: number,
  origin: Vector2Like, player: Vector2Like, playerRange: number, enemies: T[]): T | undefined {
  if (!rank) return undefined;
  let nearest = ABILITIES.pounce.range ** 2;
  let target: T | undefined;
  for (const enemy of enemies) {
    if (enemy.isDead || enemy.id === firstId || distanceSq(enemy.position, player) > playerRange ** 2) continue;
    const distance = distanceSq(origin, enemy.position);
    if (distance <= nearest) { target = enemy; nearest = distance; }
  }
  return target;
}
