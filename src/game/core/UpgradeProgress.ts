import { midnightSwatPower, describeMidnightSwat } from '../config/midnightSwat';
import { ABILITIES, ABILITY_IDS, ABILITY_NAMES, MAX_ABILITY_RANK, awakeningTier, isAscended, isAwakened, tierName } from '../config/abilities';
import { BALANCE } from '../config/balance';
import { BOSS_ABILITY_IDS, BOSS_ABILITY_NAMES, MAX_BOSS_RANK, bossPower, isBossAbility } from '../config/bossAbilities';
import { CROSSBOW_STAT_UPGRADES } from '../config/weapons';
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
  if (id === 'midnight-mighty-swat') return describeMidnightSwat(rank);
  if (isAbility(id) && isAwakened(rank)) return `${isAscended(rank) ? 'Ascended' : 'Awakened'}: ${tierName(id, rank)} (rank ${rank})`;
  switch (id) {
    case 'ricochet-charm': return `${rank} extra bounces`;
    case 'firefly-orbit': return `${ABILITIES.firefly.count[rank]} orbiting fireflies`;
    case 'bramble-snare': return `${Math.round(ABILITIES.bramble.slow[rank] * 100)}% slow · ${ABILITIES.bramble.lifeMs[rank] / 1000}s duration`;
    case 'spore-trail': return `${ABILITIES.spore.damagePerSecond[rank]} damage / second`;
    case 'acorn-shower': return `${ABILITIES.acorn.damage[rank]} damage · ${ABILITIES.acorn.radius[rank]} radius`;
    case 'barkskin-ward': return `${ABILITIES.ward.rechargeMs[rank] / 1000}s shield recharge`;
    case 'woodland-magnet': return `${ABILITIES.magnet.cooldownMs[rank] / 1000}s interval · ${ABILITIES.magnet.range[rank]} range`;
    case 'mystery-double-pounce': return `${Math.round(ABILITIES.pounce.damageScale[rank] * 100)}% second-pounce damage`;
    case 'projectile-damage': return `${Number(stats.projectileDamage.toFixed(2))} damage per shot`;
    case 'fire-rate': return `${(stats.weaponCooldownMs / 1000).toFixed(2)}s between shots`;
    case 'projectile-count': return `${stats.projectileCount} shots per volley`;
    case 'max-health': return `${stats.maxHealth} maximum health`;
    case 'move-speed': return `${Number(stats.speed.toFixed(2))} movement speed`;
    case 'gain-companion-mystery': return rank ? `${Number(stats.mysteryDamage.toFixed(2))} damage per pounce` : 'Not recruited yet';
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

/** Only show values this pick changes, so repeat upgrades stay easy to compare. */
export function upgradeChanges(choice: UpgradeDefinition, stats: PlayerStats): string {
  const next = { ...stats, abilityRanks: { ...stats.abilityRanks }, bossAbilityRanks: { ...stats.bossAbilityRanks }, upgradeCounts: { ...stats.upgradeCounts } };
  choice.apply(next);
  const metrics = (s: PlayerStats): Record<string, number> => {
    const id = choice.id, r = upgradeRank(id, s), c = ABILITIES;
    if (isBossAbility(id)) {
      const p = bossPower(id, r);
      return { Damage: p.damage, Range: p.radius, ...(Number.isFinite(p.targets) ? { Targets: p.targets } : {}), ...(p.heal ? { Healing: p.heal } : {}) };
    }
    const t = Math.max(0, awakeningTier(r));
    switch (id) {
      case 'midnight-mighty-swat': { const p = midnightSwatPower(r); return { Damage: p.damage, Reach: p.range, 'Cooldown (s)': p.cooldownMs / 1000, 'Arc (degrees)': p.arcDegrees }; }
      case 'projectile-damage': return { Damage: s.projectileDamage };
      case 'fire-rate': return { 'Cooldown (s)': s.weaponCooldownMs / 1000 };
      case 'move-speed': return { Speed: s.speed };
      case 'max-health': return { 'Max health': s.maxHealth, Health: s.health };
      case 'projectile-count': return { Shots: s.projectileCount };
      case 'ricochet-charm': return { Bounces: r };
      case 'firefly-orbit': return { Fireflies: c.firefly.count[r], Damage: isAwakened(r) ? c.firefly.swarm[t].damage : c.firefly.damage };
      case 'bramble-snare': return { 'Slow (%)': Math.round(c.bramble.slow[r] * 100), 'Duration (s)': c.bramble.lifeMs[r] / 1000, 'Damage/s': isAwakened(r) ? c.bramble.thornwall[t].damagePerSecond : 0 };
      case 'spore-trail': return { 'Damage/s': c.spore.damagePerSecond[r], 'Duration (s)': (isAwakened(r) ? c.spore.bloom[t].lifeMs : c.spore.lifeMs) / 1000 };
      case 'acorn-shower': return { Damage: c.acorn.damage[r], Radius: c.acorn.radius[r], 'Cooldown (s)': (isAwakened(r) ? c.acorn.oak[t].cooldownMs : c.acorn.cooldownMs) / 1000 };
      case 'barkskin-ward': return { Shields: isAwakened(r) ? c.ward.bark[t].leaves : 1, 'Recharge (s)': c.ward.rechargeMs[r] / 1000 };
      case 'woodland-magnet': return { Range: c.magnet.range[r], 'Cooldown (s)': c.magnet.cooldownMs[r] / 1000, 'Bonus damage (%)': isAwakened(r) ? Math.round(c.magnet.harvest[t].maxBonus * 100) : 0 };
      case 'mystery-double-pounce': return { 'Pounce damage (%)': Math.round(c.pounce.damageScale[r] * 100), 'Chain targets': isAwakened(r) ? c.pounce.frenzy[t].maxChain : 2 };
      default: return {};
    }
  };
  const before = metrics(stats), after = metrics(next);
  const format = (value: number) => Number(value.toFixed(choice.id === 'midnight-mighty-swat' ? 3 : 2));
  return Object.entries(after).filter(([label, value]) => value !== before[label])
    .map(([label, value]) => `${label}: ${format(before[label])} → ${format(value)}`).join(' · ');
}

/** A compact effect summary for choosing cards; full descriptions remain available. */
export function upgradeSummary(choice: UpgradeDefinition, stats: PlayerStats): string {
  const id = choice.id, rank = choice.rank ?? upgradeRank(id, stats) + 1;
  if (id === 'midnight-mighty-swat') return `Stronger, longer-reaching swats.${rank >= 10 ? ' Hits all around her.' : rank >= 5 ? ' Sweeps a wider arc.' : ''}`;
  const c = ABILITIES, pct = (value: number) => Math.round(value * 100);
  if (isBossAbility(id)) {
    const p = bossPower(id, rank);
    if (id === 'crownfire') return `Fire ring: ${p.damage} damage every 4s.`;
    if (id === 'stormcall') return `Lightning hits ${p.targets} foes for ${p.damage} damage.`;
    return `Heal ${p.heal} health + deal ${p.damage} area damage every 10s.`;
  }
  if (isAbility(id) && isAwakened(rank)) {
    const tier = awakeningTier(rank);
    switch (id) {
      case 'ricochet-charm': return `Full-damage bounces + ${c.ricochet.chain[tier].splitCount} seeking bolts.`;
      case 'firefly-orbit': return `${c.firefly.count[rank]} hunting fireflies. ${c.firefly.swarm[tier].damage} damage each.`;
      case 'bramble-snare': return `Thorns root, block shots, and deal ${c.bramble.thornwall[tier].damagePerSecond} damage/s. ${c.bramble.lifeMs[rank] / 1000}s duration.`;
      case 'spore-trail': return `Spreading mushrooms: ${c.spore.damagePerSecond[rank]} damage/s for ${c.spore.bloom[tier].lifeMs / 1000}s.`;
      case 'acorn-shower': return `Rolling acorns: ${c.acorn.damage[rank]} damage, then ${c.acorn.oak[tier].shardCount} shards.`;
      case 'barkskin-ward': return `${c.ward.bark[tier].leaves} shields. Regrow every ${c.ward.rechargeMs[rank] / 1000}s. Burst when depleted.`;
      case 'woodland-magnet': return `Pull XP from ${c.magnet.range[rank]} range. Gain up to +${pct(c.magnet.harvest[tier].maxBonus)}% damage${isAscended(rank) ? ' + healing' : ''}.`;
      case 'mystery-double-pounce': return `${c.pounce.frenzy[tier].maxChain} chained pounces at ${pct(c.pounce.damageScale[rank])}% damage.${isAscended(rank) ? '' : ' Faster above half health.'}`;
    }
  }
  switch (id) {
    case 'projectile-damage': return '+8 damage per shot.';
    case 'fire-rate': return `Shot cooldown: ${(stats.weaponCooldownMs / 1000).toFixed(2)}s → ${(Math.max(160, Math.floor(stats.weaponCooldownMs * .85)) / 1000).toFixed(2)}s.`;
    case 'move-speed': return '+24 movement speed.';
    case 'max-health': return '+20 max health. Heal 20.';
    case 'projectile-count': return '+1 shot per volley.';
    case 'gain-companion-mystery': return `Pouncing companion. ${Number(stats.mysteryDamage.toFixed(2))} damage per hit.`;
    case 'gain-companion-midnight': return `Swatting companion. ${BALANCE.companion.midnightDamage} damage to nearby foes.`;
    case 'ricochet-charm': return `Shots bounce to ${rank} extra ${rank === 1 ? 'foe' : 'foes'}.`;
    case 'firefly-orbit': return `${c.firefly.count[rank]} orbiting fireflies. ${c.firefly.damage} damage each.`;
    case 'bramble-snare': return `Roots slow foes ${pct(c.bramble.slow[rank])}% for ${c.bramble.lifeMs[rank] / 1000}s.`;
    case 'spore-trail': return `Leave mushrooms that deal ${c.spore.damagePerSecond[rank]} damage/s.`;
    case 'acorn-shower': return `Falling acorns: ${c.acorn.damage[rank]} area damage every 4s.`;
    case 'barkskin-ward': return `Block a hit every ${c.ward.rechargeMs[rank] / 1000}s.`;
    case 'woodland-magnet': return `Pull XP from ${c.magnet.range[rank]} range every ${c.magnet.cooldownMs[rank] / 1000}s.`;
    case 'mystery-double-pounce': return `Mystery pounces again for ${pct(c.pounce.damageScale[rank])}% damage.`;
  }
}
export function ownedUpgrades(stats: PlayerStats): UpgradeId[] {
  return [...ABILITY_IDS, ...BOSS_ABILITY_IDS, ...Object.keys(STAT_NAMES) as UpgradeId[]].filter(id => upgradeRank(id, stats) > 0);
}
