import type { AbilityId, AbilityRank, AbilityRanks, WeaponId } from '../core/types';
import { WEAPONS } from './weapons';

export const ABILITY_IDS: AbilityId[] = ['ricochet-charm', 'firefly-orbit', 'bramble-snare', 'spore-trail',
  'acorn-shower', 'barkskin-ward', 'woodland-magnet', 'mystery-double-pounce'];
export const ABILITY_NAMES: Record<AbilityId, string> = {
  'ricochet-charm': 'Ricochet Charm', 'firefly-orbit': 'Firefly Orbit', 'bramble-snare': 'Bramble Snare',
  'spore-trail': 'Spore Trail', 'acorn-shower': 'Acorn Shower', 'barkskin-ward': 'Barkskin Ward',
  'woodland-magnet': 'Woodland Magnet', 'mystery-double-pounce': 'Mystery’s Double Pounce'
};

/** Abilities rank 1 to 5. Rank 4 is a numeric step; rank 5 is an awakening that changes how the skill plays. */
export const MAX_ABILITY_RANK = 5;
export const AWAKENING_RANK = 5;
export const AWAKENING_NAMES: Record<AbilityId, string> = {
  'ricochet-charm': 'Chain Lightning', 'firefly-orbit': 'Firefly Swarm', 'bramble-snare': 'Thornwall',
  'spore-trail': 'Fungal Bloom', 'acorn-shower': 'Oak Fall', 'barkskin-ward': 'Living Bark',
  'woodland-magnet': 'Harvest Wind', 'mystery-double-pounce': 'Feral Frenzy'
};
export const isAwakened = (rank: number): boolean => rank >= AWAKENING_RANK;

export const ABILITIES = {
  ricochet: { range: 220, retention: .7, chain: { range: 440, retention: 1, splitCount: 3, splitDamage: .5 } },
  firefly: { count: [0, 2, 3, 4, 5, 5], radius: 72, orbitMs: 3000, hitRadius: 10, damage: 8, hitCooldownMs: 500,
    swarm: { damage: 16, huntRange: 260, speed: 420 } },
  bramble: { cooldownMs: 5000, targetRange: 420, radius: 90, slow: [0, .35, .45, .55, .65, .65], lifeMs: [0, 2000, 2500, 3000, 3500, 6000],
    thornwall: { rootMs: 1500, damagePerSecond: 5, tickMs: 500 } },
  spore: { cooldownMs: 750, spacing: 24, radius: 44, lifeMs: 3000, damagePerSecond: [0, 6, 9, 12, 15, 15], tickMs: 500, maxPatches: 4,
    bloom: { lifeMs: 6000, maxPatches: 12 } },
  acorn: { cooldownMs: 4000, targetRange: 420, warningMs: 450, damage: [0, 24, 32, 40, 48, 144], radius: [0, 60, 75, 90, 100, 120],
    oak: { cooldownMs: 8000, rollMs: 2000, rollSpeed: 220, rollRadius: 40, shardCount: 6, shardSpread: 110 } },
  ward: { rechargeMs: [0, 18000, 14000, 10000, 8000, 10000], protectionMs: 500,
    bark: { leaves: 3, burstRange: 200, knockback: 120, rootMs: 1000 } },
  magnet: { cooldownMs: [0, 10000, 8000, 6000, 4500, 0], range: [0, 450, 600, 750, 850, 850], speed: 600,
    harvest: { bonusPerCrystal: .01, maxBonus: .25, durationMs: 10000 } },
  pounce: { range: 180, damageScale: [0, .6, .8, 1, 1.1, 1], frenzy: { maxChain: 6, cooldownScale: .5, healthFraction: .5 } }
} as const;

export function emptyAbilityRanks(): AbilityRanks {
  return Object.fromEntries(ABILITY_IDS.map(id => [id, 0])) as AbilityRanks;
}

export function describeAwakening(id: AbilityId, weaponId: WeaponId = 'spell'): string {
  const c = ABILITIES;
  switch (id) {
    case 'ricochet-charm': return weaponId === 'crossbow'
      ? `Chain Lightning: quarrels keep full damage through every pierce, and after the last hit split into ${c.ricochet.chain.splitCount} seeking bolts at ${Math.round(c.ricochet.chain.splitDamage * 100)}% damage.`
      : `Chain Lightning: bolts keep full damage on every bounce and reach twice as far. After the final bounce the bolt splits into ${c.ricochet.chain.splitCount} seeking bolts at ${Math.round(c.ricochet.chain.splitDamage * 100)}% damage.`;
    case 'firefly-orbit': return `Firefly Swarm: your ${c.firefly.count[5]} fireflies leave orbit to hunt foes within ${c.firefly.swarm.huntRange} pixels, burning for ${c.firefly.swarm.damage} damage a touch, then drift back when nothing is near.`;
    case 'bramble-snare': return `Thornwall: roots become a ring of thorns that holds foes fast for ${c.bramble.thornwall.rootMs / 1000}s, then slows them ${Math.round(c.bramble.slow[5] * 100)}% for the rest of its ${c.bramble.lifeMs[5] / 1000}s. Foes inside take ${c.bramble.thornwall.damagePerSecond} damage a second and thrown acorns cannot cross it.`;
    case 'spore-trail': return `Fungal Bloom: patches linger ${c.spore.bloom.lifeMs / 1000}s and up to ${c.spore.bloom.maxPatches} can grow at once. Any foe slain inside a patch sprouts a fresh patch where it fell.`;
    case 'acorn-shower': return `Oak Fall: every ${c.acorn.oak.cooldownMs / 1000}s a mighty oak acorn lands for ${c.acorn.damage[5]} damage, rolls onward for ${c.acorn.oak.rollMs / 1000}s crushing everything in its path, then shatters into ${c.acorn.oak.shardCount} ordinary acorns.`;
    case 'barkskin-ward': return `Living Bark: the ward holds ${c.ward.bark.leaves} leaves, each blocking one hit, regrowing one every ${c.ward.rechargeMs[5] / 1000}s. When the last leaf falls, a burst throws every nearby foe back and roots them for ${c.ward.bark.rootMs / 1000}s.`;
    case 'woodland-magnet': return `Harvest Wind: a constant wind draws every crystal within ${c.magnet.range[5]} pixels to you. Each crystal gathered adds ${Math.round(c.magnet.harvest.bonusPerCrystal * 100)}% projectile damage for ${c.magnet.harvest.durationMs / 1000}s, up to ${Math.round(c.magnet.harvest.maxBonus * 100)}%.`;
    case 'mystery-double-pounce': return `Feral Frenzy: Mystery keeps leaping from foe to foe at full damage, up to ${c.pounce.frenzy.maxChain} in a row, and pounces twice as often while you are above half health.`;
  }
}

export function describeAbility(id: AbilityId, rank: AbilityRank, weaponId: WeaponId = 'spell'): string {
  if (isAwakened(rank)) return describeAwakening(id, weaponId);
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
