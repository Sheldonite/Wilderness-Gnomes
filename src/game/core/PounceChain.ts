import { ABILITIES, awakeningTier } from '../config/abilities';
import type { CombatTarget } from './CombatResolver';
import type { AbilityRank, Vector2Like } from './types';
import { distanceSq } from '../utils/math';

/** How many extra pounces Mystery may chain after her first hit. */
export function pounceChainLimit(rank: AbilityRank): number {
  if (!rank) return 0;
  const t = awakeningTier(rank);
  return t >= 0 ? ABILITIES.pounce.frenzy[t].maxChain : 1;
}

/** Damage multiplier for a chained pounce. */
export function chainDamageScale(rank: AbilityRank): number {
  return ABILITIES.pounce.damageScale[rank];
}

/** Feral Frenzy / Bloodlust: pounce cooldown multiplier for the player's current health. */
export function pounceCooldownScale(rank: AbilityRank, health: number, maxHealth: number): number {
  const t = awakeningTier(rank);
  if (t < 0) return 1;
  const f = ABILITIES.pounce.frenzy[t];
  return health > maxHealth * f.healthFraction ? f.cooldownScale : 1;
}

export function nextPounceTarget<T extends CombatTarget>(rank: AbilityRank, hitIds: Set<number>, chainedSoFar: number,
  origin: Vector2Like, player: Vector2Like, playerRange: number, enemies: T[]): T | undefined {
  if (chainedSoFar >= pounceChainLimit(rank)) return undefined;
  let nearest = ABILITIES.pounce.range ** 2;
  let target: T | undefined;
  for (const enemy of enemies) {
    if (enemy.isDead || hitIds.has(enemy.id) || distanceSq(enemy.position, player) > playerRange ** 2) continue;
    const distance = distanceSq(origin, enemy.position);
    if (distance <= nearest) { target = enemy; nearest = distance; }
  }
  return target;
}

export function secondPounceTarget<T extends CombatTarget>(rank: AbilityRank, firstId: number,
  origin: Vector2Like, player: Vector2Like, playerRange: number, enemies: T[]): T | undefined {
  return nextPounceTarget(rank, new Set([firstId]), 0, origin, player, playerRange, enemies);
}
