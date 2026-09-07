import type { BossAbilityId, UpgradeId } from '../core/types';

export const BOSS_ABILITY_IDS: BossAbilityId[] = ['crownfire', 'stormcall', 'phoenix-heart'];
export const MAX_BOSS_RANK = 3;
export const BOSS_ABILITY_NAMES: Record<BossAbilityId, string> = {
  crownfire: 'Crownfire', stormcall: 'Stormcall', 'phoenix-heart': 'Phoenix Heart'
};
export const isBossAbility = (id: UpgradeId): id is BossAbilityId => BOSS_ABILITY_IDS.includes(id as BossAbilityId);
export function bossPower(id: BossAbilityId, rank: number) {
  const r = Math.max(1, Math.min(MAX_BOSS_RANK, rank));
  if (id === 'crownfire') return { damage: 120 * r, radius: 180 + r * 30, cooldownMs: 4000, targets: Infinity, heal: 0 };
  if (id === 'stormcall') return { damage: 80 * r, radius: 420, cooldownMs: 3500, targets: 1 + r * 2, heal: 0 };
  return { damage: 60 * r, radius: 180 + r * 20, cooldownMs: 10000, targets: Infinity, heal: 8 * r };
}
export function describeBossAbility(id: BossAbilityId, rank: number): string {
  const p = bossPower(id, rank);
  if (id === 'crownfire') return `Every ${p.cooldownMs / 1000}s, unleash a ring of fire for ${p.damage} damage within ${p.radius} pixels.`;
  if (id === 'stormcall') return `Every ${p.cooldownMs / 1000}s, chain lightning through ${p.targets} distinct foes for ${p.damage} damage each.`;
  return `Every ${p.cooldownMs / 1000}s, restore ${p.heal} health and release a phoenix pulse for ${p.damage} damage within ${p.radius} pixels.`;
}
