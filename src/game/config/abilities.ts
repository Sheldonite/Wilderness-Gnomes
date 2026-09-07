import type { AbilityId, AbilityRank, AbilityRanks, WeaponId } from '../core/types';
import { WEAPONS } from './weapons';

export const ABILITY_IDS: AbilityId[] = ['ricochet-charm', 'firefly-orbit', 'bramble-snare', 'spore-trail',
  'acorn-shower', 'barkskin-ward', 'woodland-magnet', 'mystery-double-pounce'];
export const ABILITY_NAMES: Record<AbilityId, string> = {
  'ricochet-charm': 'Ricochet Charm', 'firefly-orbit': 'Firefly Orbit', 'bramble-snare': 'Bramble Snare',
  'spore-trail': 'Spore Trail', 'acorn-shower': 'Acorn Shower', 'barkskin-ward': 'Barkskin Ward',
  'woodland-magnet': 'Woodland Magnet', 'mystery-double-pounce': 'Mystery’s Double Pounce'
};
export const ABILITIES = {
  ricochet: { range: 220, retention: .7 },
  firefly: { count: [0, 2, 3, 4], radius: 72, orbitMs: 3000, hitRadius: 10, damage: 8, hitCooldownMs: 500 },
  bramble: { cooldownMs: 5000, targetRange: 420, radius: 90, slow: [0, .35, .45, .55], lifeMs: [0, 2000, 2500, 3000] },
  spore: { cooldownMs: 750, spacing: 24, radius: 44, lifeMs: 3000, damagePerSecond: [0, 6, 9, 12], tickMs: 500, maxPatches: 4 },
  acorn: { cooldownMs: 4000, targetRange: 420, warningMs: 450, damage: [0, 24, 32, 40], radius: [0, 60, 75, 90] },
  ward: { rechargeMs: [0, 18000, 14000, 10000], protectionMs: 500 },
  magnet: { cooldownMs: [0, 10000, 8000, 6000], range: [0, 450, 600, 750], speed: 600 },
  pounce: { range: 180, damageScale: [0, .6, .8, 1] }
} as const;

export function emptyAbilityRanks(): AbilityRanks {
  return Object.fromEntries(ABILITY_IDS.map(id => [id, 0])) as AbilityRanks;
}

export function describeAbility(id: AbilityId, rank: AbilityRank, weaponId: WeaponId = 'spell'): string {
  switch (id) {
    case 'ricochet-charm': {
      if (weaponId === 'crossbow') {
        const extra = WEAPONS.crossbow.baseExtraTargets + rank;
        const keep = Math.round(WEAPONS.crossbow.extraTargetRetention * 100);
        return `Quarrels punch through ${extra} additional ${extra === 1 ? 'enemy' : 'enemies'}, retaining ${keep}% damage after each hit.`;
      }
      return `Spell bolts bounce to ${rank} additional ${rank === 1 ? 'enemy' : 'enemies'}, retaining 70% damage each bounce.`;
    }
    case 'firefly-orbit': return `${ABILITIES.firefly.count[rank]} golden fireflies orbit you, dealing 8 contact damage. Each foe can be hit every 0.5s.`;
    case 'bramble-snare': return `Every 5s, grow roots that slow foes by ${Math.round(ABILITIES.bramble.slow[rank] * 100)}% for ${ABILITIES.bramble.lifeMs[rank] / 1000}s.`;
    case 'spore-trail': return `Moving leaves mushroom patches for 3s, dealing ${ABILITIES.spore.damagePerSecond[rank]} damage per second.`;
    case 'acorn-shower': return `Every 4s, a falling acorn deals ${ABILITIES.acorn.damage[rank]} area damage within ${ABILITIES.acorn.radius[rank]} pixels.`;
    case 'barkskin-ward': return `Block a hit and gain 0.5s protection. The leafy shield recharges in ${ABILITIES.ward.rechargeMs[rank] / 1000}s.`;
    case 'woodland-magnet': return `Every ${ABILITIES.magnet.cooldownMs[rank] / 1000}s, draw XP crystals from ${ABILITIES.magnet.range[rank]} pixels away.`;
    case 'mystery-double-pounce': return `Mystery leaps to a second nearby foe for ${Math.round(ABILITIES.pounce.damageScale[rank] * 100)}% pounce damage before returning.`;
  }
}
