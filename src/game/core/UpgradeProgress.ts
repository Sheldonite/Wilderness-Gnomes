import { ABILITIES, ABILITY_IDS, ABILITY_NAMES, MAX_ABILITY_RANK, isAscended, isAwakened, tierName } from '../config/abilities';
import { BOSS_ABILITY_IDS, BOSS_ABILITY_NAMES, MAX_BOSS_RANK, bossPower, isBossAbility } from '../config/bossAbilities';
import { CROSSBOW_STAT_UPGRADES, WEAPONS } from '../config/weapons';
import type { AbilityId, PlayerStats, UpgradeDefinition, UpgradeId } from './types';

const STAT_NAMES: Partial<Record<UpgradeId, string>> = {
  'projectile-damage': 'Sharper Spell', 'fire-rate': 'Quicker Hex', 'move-speed': 'Restless Boots',
  'max-health': 'Hardier Heart', 'projectile-count': 'Split Charm',
  'gain-companion-mystery': 'Mystery', 'gain-companion-midnight': 'Midnight'
};
export const isAbility = (id: UpgradeId): id is AbilityId => ABILITY_IDS.includes(id as AbilityId);
export const isRanked = (id: UpgradeId): boolean => isAbility(id) || isBossAbility(id);
export const upgradeMaxRank = (id: UpgradeId): number => isBossAbility(id) ? MAX_BOSS_RANK : MAX_ABILITY_RANK;
export function upgradeRank(id: UpgradeId, stats: PlayerStats): number {
  if (isBossAbility(id)) return stats.bossAbilityRanks[id];
  if (isAbility(id)) return stats.abilityRanks[id];
  if (id === 'gain-companion-mystery') return Number(stats.hasMysteryCompanion);
  if (id === 'gain-companion-midnight') return Number(stats.hasMidnightCompanion);
  return stats.upgradeCounts[id] ?? 0;
}
export function upgradeName(id: UpgradeId, stats: PlayerStats): string {
  if (isBossAbility(id)) return BOSS_ABILITY_NAMES[id];
  return isAbility(id) ? ABILITY_NAMES[id] : (stats.weaponId === 'crossbow' ? CROSSBOW_STAT_UPGRADES[id]?.title : undefined) ?? STAT_NAMES[id]!;
}
export function upgradeBenefit(id: UpgradeId, stats: PlayerStats): string {
  const rank = upgradeRank(id, stats);
  if (isBossAbility(id)) {
    if (!rank) return 'Not claimed from a boss yet';
    const power = bossPower(id, rank);
    if (id === 'crownfire') return `${power.damage} damage · ${power.radius}px radius · every 4s`;
    if (id === 'stormcall') return `${power.damage} damage · ${power.targets} targets · every 3.5s`;
    return `${power.heal} healing + ${power.damage} damage · every 10s`;
  }
  if (isAbility(id) && !rank) return 'Not learned yet';
  if (isAbility(id) && isAwakened(rank)) return `${isAscended(rank) ? 'Ascended' : 'Awakened'}: ${tierName(id, rank)} (rank ${rank})`;
  switch (id) {
    case 'ricochet-charm': return stats.weaponId === 'crossbow' ? `${WEAPONS.crossbow.baseExtraTargets + rank} extra pierces` : `${rank} extra bounces`;
    case 'firefly-orbit': return `${ABILITIES.firefly.count[rank]} orbiting fireflies`;
    case 'bramble-snare': return `${Math.round(ABILITIES.bramble.slow[rank] * 100)}% slow · ${ABILITIES.bramble.lifeMs[rank] / 1000}s duration`;
    case 'spore-trail': return `${ABILITIES.spore.damagePerSecond[rank]} damage / second`;
    case 'acorn-shower': return `${ABILITIES.acorn.damage[rank]} damage · ${ABILITIES.acorn.radius[rank]} radius`;
    case 'barkskin-ward': return `${ABILITIES.ward.rechargeMs[rank] / 1000}s shield recharge`;
    case 'woodland-magnet': return `${ABILITIES.magnet.cooldownMs[rank] / 1000}s interval · ${ABILITIES.magnet.range[rank]} range`;
    case 'mystery-double-pounce': return `${Math.round(ABILITIES.pounce.damageScale[rank] * 100)}% second-pounce damage`;
    case 'projectile-damage': return `${stats.projectileDamage} damage per shot`;
    case 'fire-rate': return `${(stats.weaponCooldownMs / 1000).toFixed(2)}s between shots`;
    case 'projectile-count': return `${stats.projectileCount} shots per volley`;
    case 'max-health': return `${stats.maxHealth} maximum health`;
    case 'move-speed': return `${stats.speed} movement speed`;
    case 'gain-companion-mystery': return rank ? 'Pouncing companion' : 'Not recruited yet';
    case 'gain-companion-midnight': return rank ? 'Swatting companion' : 'Not recruited yet';
  }
}
export function upgradePreview(choice: UpgradeDefinition, stats: PlayerStats) {
  const current = upgradeRank(choice.id, stats);
  const nextStats = { ...stats, abilityRanks: { ...stats.abilityRanks }, bossAbilityRanks: { ...stats.bossAbilityRanks }, upgradeCounts: { ...stats.upgradeCounts } };
  choice.apply(nextStats);
  nextStats.upgradeCounts[choice.id] = current + 1;
  return { current, next: current + 1, capped: isRanked(choice.id), maxRank: upgradeMaxRank(choice.id),
    before: upgradeBenefit(choice.id, stats), after: upgradeBenefit(choice.id, nextStats) };
}
export function ownedUpgrades(stats: PlayerStats): UpgradeId[] {
  return [...ABILITY_IDS, ...BOSS_ABILITY_IDS, ...Object.keys(STAT_NAMES) as UpgradeId[]].filter(id => upgradeRank(id, stats) > 0);
}
