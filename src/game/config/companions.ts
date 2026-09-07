import { BALANCE } from './balance';
import type { CompanionId, PlayerCharacterId, PlayerStats } from '../core/types';

/**
 * Every wanderer travels with one companion, always, from the first step of a run. Companions
 * are no longer offered as upgrade cards: each one grows on its own every few levels, so the
 * choice of wanderer is the choice of companion.
 */
export const COMPANION_BY_CHARACTER: Record<PlayerCharacterId, CompanionId> = {
  wizard: 'mystery',
  hailey: 'midnight',
  sheldon: 'frankie',
  ron: 'tobias'
};

export const COMPANION_NAMES: Record<CompanionId, string> = {
  mystery: 'Mystery',
  midnight: 'Midnight',
  frankie: 'Frankie',
  tobias: 'Tobias'
};


/** One companion rank for every this many player levels. Level 3 gives rank 1, level 30 rank 10. */
export const COMPANION_LEVELS_PER_RANK = 3;
export const MAX_COMPANION_RANK = 10;

export function companionRankForLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(MAX_COMPANION_RANK, Math.floor(level / COMPANION_LEVELS_PER_RANK)));
}

/** The player level at which the given rank arrives, for "next growth at level N" copy. */
export function levelForCompanionRank(rank: number): number {
  return Math.min(MAX_COMPANION_RANK, Math.max(0, rank)) * COMPANION_LEVELS_PER_RANK;
}

/** Damage and effect multiplier a companion carries at the given rank. Rank 10 is 2.35x. */
export function companionPower(rank: number): number {
  return 1 + 0.15 * Math.max(0, Math.min(MAX_COMPANION_RANK, rank));
}

/** Frankie's flock grows with rank instead of with a card: 1 bird, then one more every 2 ranks. */
export function frankieBirdsForRank(rank: number): number {
  const clamped = Math.max(0, Math.min(MAX_COMPANION_RANK, rank));
  return Math.max(1, Math.min(BALANCE.companion.frankieMaxBirds, 1 + Math.floor(clamped / 2)));
}

/** What the companion gains at this rank, for the HUD and the rank-up banner. */
export function describeCompanionRank(id: CompanionId, rank: number, stats?: PlayerStats): string {
  const power = Math.round((companionPower(rank) - 1) * 100);
  const b = BALANCE.companion;
  switch (id) {
    case 'mystery': {
      const damage = stats ? Number(stats.mysteryDamage.toFixed(0)) : Math.round(b.mysteryDamage * companionPower(rank));
      return `${damage} damage per pounce${power ? ` · +${power}% from rank ${rank}` : ''}`;
    }
    case 'midnight':
      return `${Math.round(b.midnightDamage * companionPower(rank))} damage per swat${power ? ` · +${power}% from rank ${rank}` : ''}`;
    case 'frankie': {
      const birds = frankieBirdsForRank(rank);
      return `${birds} of ${b.frankieMaxBirds} buzzard${birds === 1 ? '' : 's'} · ${Math.round(b.frankieDamage * companionPower(rank))} damage per stoop`;
    }
    case 'tobias':
      return `${Math.round(b.tobiasDamage * companionPower(rank))} damage per dart${power ? ` · +${power}% from rank ${rank}` : ''}`;
  }
}
