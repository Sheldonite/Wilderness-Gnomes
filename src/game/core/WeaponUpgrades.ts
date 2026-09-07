import { ABILITIES, awakeningTier } from '../config/abilities';
import { WEAPONS } from '../config/weapons';
import type { PlayerStats } from './types';

/** Ricochet adds bounces to every weapon, independently of its innate piercing. */
export function weaponUpgrades(stats: PlayerStats) {
  const arm = WEAPONS[stats.weaponId], rank = stats.abilityRanks['ricochet-charm'];
  return {
    extraTargets: rank > 0 ? rank : arm.baseExtraTargets,
    mode: rank > 0 ? 'bounce' as const : arm.extraTargetMode,
    retention: rank > 0 ? ABILITIES.ricochet.retention : arm.extraTargetRetention,
    pierces: rank > 0 && arm.extraTargetMode === 'pierce' ? arm.baseExtraTargets : 0,
    pierceRetention: arm.extraTargetRetention,
    chainTier: awakeningTier(rank)
  };
}
