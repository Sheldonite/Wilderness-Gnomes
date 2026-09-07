import { describeMidnightSwat } from './midnightSwat';
import type { AbilityId, AbilityRank, AbilityRanks, PlayerCharacterId, WeaponId } from '../core/types';

export const ABILITY_IDS: AbilityId[] = ['ricochet-charm', 'firefly-orbit', 'bramble-snare', 'spore-trail',
  'acorn-shower', 'barkskin-ward', 'woodland-magnet', 'mystery-double-pounce', 'midnight-mighty-swat',
  'ribbon-sweep', 'inspiring-shout', 'dizzying-flurry'];

/**
 * Abilities that belong to one wanderer alone. Everything not listed here is offered to all of
 * them. Nick and Hailey keep the skills that command their own companions, and Ron's three
 * performance skills are the reason to play the bard.
 */
export const CHARACTER_ONLY_ABILITIES: Partial<Record<AbilityId, PlayerCharacterId>> = {
  'mystery-double-pounce': 'wizard',
  'midnight-mighty-swat': 'hailey',
  'ribbon-sweep': 'ron',
  'inspiring-shout': 'ron',
  'dizzying-flurry': 'ron'
};
export const abilityAllowed = (id: AbilityId, characterId: PlayerCharacterId): boolean =>
  CHARACTER_ONLY_ABILITIES[id] === undefined || CHARACTER_ONLY_ABILITIES[id] === characterId;
export const ABILITY_NAMES: Record<AbilityId, string> = {
  'midnight-mighty-swat': 'Midnight’s Mighty Swat',
  'ricochet-charm': 'Ricochet Charm', 'firefly-orbit': 'Firefly Orbit', 'bramble-snare': 'Bramble Snare',
  'spore-trail': 'Spore Trail', 'acorn-shower': 'Acorn Shower', 'barkskin-ward': 'Barkskin Ward',
  'woodland-magnet': 'Woodland Magnet', 'mystery-double-pounce': 'Mystery’s Double Pounce',
  'ribbon-sweep': 'Ribbon Sweep', 'inspiring-shout': 'Inspiring Shout', 'dizzying-flurry': 'Dizzying Flurry'
};

/**
 * Abilities rank 1 to 10. Ranks 1 to 4 grow numerically, rank 5 is an awakening that changes how the
 * skill plays, ranks 6 to 9 grow again, and rank 10 is an ascension: the awakening at full power.
 * Nothing past rank 5 is offered until the player reaches ASCENSION_PLAYER_LEVEL.
 */
export const MAX_ABILITY_RANK = 10;
export const AWAKENING_RANK = 5;
export const ASCENSION_RANK = 10;
export const ASCENSION_PLAYER_LEVEL = 10;
export const AWAKENING_NAMES: Record<AbilityId, string> = {
  'ricochet-charm': 'Chain Lightning', 'firefly-orbit': 'Firefly Swarm', 'bramble-snare': 'Thornwall',
  'spore-trail': 'Fungal Bloom', 'acorn-shower': 'Oak Fall', 'barkskin-ward': 'Living Bark',
  'woodland-magnet': 'Harvest Wind', 'mystery-double-pounce': 'Feral Frenzy', 'midnight-mighty-swat': 'Sweeping Paw',
  'ribbon-sweep': 'Ribbon Cyclone', 'inspiring-shout': 'Rally Anthem', 'dizzying-flurry': 'Dizzying Vortex'
};
export const ASCENSION_NAMES: Record<AbilityId, string> = {
  'ricochet-charm': 'Storm Front', 'firefly-orbit': 'Firefly Inferno', 'bramble-snare': 'Thornheart',
  'spore-trail': 'Mycelium Tide', 'acorn-shower': 'Worldtree Fall', 'barkskin-ward': 'Heartwood',
  'woodland-magnet': 'Gale Harvest', 'mystery-double-pounce': 'Bloodlust', 'midnight-mighty-swat': 'Midnight Maelstrom',
  'ribbon-sweep': 'Aurora Sweep', 'inspiring-shout': 'Grand Finale', 'dizzying-flurry': 'Carnival Maelstrom'
};
export const isAwakened = (rank: number): boolean => rank >= AWAKENING_RANK;
export const isAscended = (rank: number): boolean => rank >= ASCENSION_RANK;
/** Index into an awakening's `tiers` array, or -1 below the awakening. */
export const awakeningTier = (rank: number): number => isAscended(rank) ? 1 : isAwakened(rank) ? 0 : -1;
/** Whether the given ability rank may be offered at the given player level. */
export const rankUnlocked = (rank: number, playerLevel: number): boolean => rank <= AWAKENING_RANK || playerLevel >= ASCENSION_PLAYER_LEVEL;
export const tierName = (id: AbilityId, rank: number): string | undefined =>
  isAscended(rank) ? ASCENSION_NAMES[id] : isAwakened(rank) ? AWAKENING_NAMES[id] : undefined;

export const ABILITIES = {
  ricochet: { range: 220, retention: .7,
    /** [awakened, ascended] */
    chain: [{ range: 440, retention: 1, splitCount: 4, splitDamage: .75, splitBounces: 0 },
            { range: 660, retention: 1, splitCount: 6, splitDamage: 1, splitBounces: 1 }] },
  firefly: { count: [0, 2, 3, 4, 6, 6, 6, 7, 7, 8, 8], radius: 72, orbitMs: 3000, hitRadius: 10, damage: 8, hitCooldownMs: 500,
    swarm: [{ damage: 24, huntRange: 320, speed: 520 }, { damage: 48, huntRange: 460, speed: 640 }] },
  bramble: { cooldownMs: 5000, targetRange: 420, radius: 90,
    slow: [0, .35, .45, .55, .65, .7, .72, .74, .76, .78, .85], lifeMs: [0, 2000, 2500, 3000, 3500, 6000, 6500, 7000, 7500, 8000, 9000],
    thornwall: [{ rootMs: 2000, damagePerSecond: 10, tickMs: 500, rings: 1 }, { rootMs: 3000, damagePerSecond: 25, tickMs: 500, rings: 2 }] },
  spore: { cooldownMs: 750, spacing: 24, radius: 44, lifeMs: 3000, tickMs: 500, maxPatches: 4,
    damagePerSecond: [0, 6, 9, 12, 15, 20, 22, 24, 26, 28, 40],
    bloom: [{ lifeMs: 8000, maxPatches: 16, sproutReach: 0 }, { lifeMs: 12000, maxPatches: 24, sproutReach: 120 }] },
  acorn: { cooldownMs: 4000, targetRange: 420, warningMs: 450,
    damage: [0, 24, 32, 40, 48, 200, 210, 220, 230, 240, 480], radius: [0, 60, 75, 90, 100, 130, 132, 134, 136, 138, 160],
    oak: [{ cooldownMs: 8000, rollMs: 2500, rollSpeed: 220, rollRadius: 50, shardCount: 8, shardSpread: 110 },
          { cooldownMs: 7000, rollMs: 3500, rollSpeed: 260, rollRadius: 65, shardCount: 12, shardSpread: 140 }] },
  ward: { rechargeMs: [0, 18000, 14000, 10000, 8000, 8000, 7500, 7000, 6500, 6000, 5000], protectionMs: 500,
    bark: [{ leaves: 4, burstRange: 240, knockback: 160, rootMs: 1500, burstDamage: 30 },
           { leaves: 5, burstRange: 320, knockback: 220, rootMs: 2000, burstDamage: 90 }] },
  magnet: { cooldownMs: [0, 10000, 8000, 6000, 4500, 0, 0, 0, 0, 0, 0], range: [0, 450, 600, 750, 850, 1000, 1050, 1100, 1150, 1200, 1400], speed: 600,
    harvest: [{ bonusPerCrystal: .015, maxBonus: .4, durationMs: 12000, healPerCrystal: 0 },
              { bonusPerCrystal: .025, maxBonus: .75, durationMs: 15000, healPerCrystal: 1 }] },
  pounce: { range: 180, damageScale: [0, .6, .8, 1, 1.1, 1.2, 1.25, 1.3, 1.35, 1.4, 1.5],
    frenzy: [{ maxChain: 8, cooldownScale: .4, healthFraction: .5 }, { maxChain: 12, cooldownScale: .35, healthFraction: 0 }] },
  /** Ron: a wide ribbon arc in the way he faces, throwing foes back. */
  ribbon: { cooldownMs: 2600, arcDegrees: 150, range: 210,
    damage: [0, 26, 34, 42, 50, 74, 80, 86, 92, 98, 140],
    knockback: [0, 120, 132, 144, 156, 210, 218, 226, 234, 242, 320],
    cyclone: [{ arcDegrees: 360, range: 250, echoMs: 420, echoDamage: .6 },
              { arcDegrees: 360, range: 320, echoMs: 320, echoDamage: 1 }] },
  /** Ron: a rallying call that quickens him and his companion for a few seconds. */
  shout: { cooldownMs: 9000, durationMs: 4000,
    attackSpeed: [0, .12, .16, .2, .24, .34, .36, .38, .4, .42, .55],
    moveSpeed: [0, .08, .1, .12, .14, .2, .21, .22, .23, .24, .32],
    anthem: [{ healPerSecond: 6, waveDamage: 40, waveRadius: 260 },
             { healPerSecond: 14, waveDamage: 95, waveRadius: 340 }] },
  /** Ron: a staff spin that beats on everything close by. */
  flurry: { cooldownMs: 5000, durationMs: 1400, tickMs: 180,
    radius: [0, 92, 102, 112, 122, 156, 160, 164, 168, 172, 210],
    damage: [0, 8, 11, 14, 17, 27, 29, 31, 33, 35, 50],
    vortex: [{ durationMs: 2000, pull: 150, slow: .4 }, { durationMs: 2600, pull: 240, slow: .6 }] }
} as const;

export function emptyAbilityRanks(): AbilityRanks {
  return Object.fromEntries(ABILITY_IDS.map(id => [id, 0])) as AbilityRanks;
}

export function describeAwakening(id: AbilityId, rank: number, weaponId: WeaponId = 'spell'): string {
  const t = awakeningTier(rank), name = tierName(id, rank);
  const c = ABILITIES, pct = (v: number) => Math.round(v * 100);
  switch (id) {
    case 'midnight-mighty-swat': return `${name}: ${describeMidnightSwat(rank)}`;
    case 'ricochet-charm': {
      const ch = c.ricochet.chain[t];
      const again = ch.splitBounces ? ` Each split bolt bounces ${ch.splitBounces} more time.` : '';
      return `${name}: shots keep full damage on every bounce and reach ${ch.range} pixels. After the final hit they split into ${ch.splitCount} seeking bolts at ${pct(ch.splitDamage)}% damage.${again}`;
    }
    case 'firefly-orbit': { const s = c.firefly.swarm[t];
      return `${name}: your ${c.firefly.count[rank]} fireflies leave orbit to hunt foes within ${s.huntRange} pixels, burning for ${s.damage} damage a touch, then drift back when nothing is near.`; }
    case 'bramble-snare': { const w = c.bramble.thornwall[t];
      return `${name}: ${w.rings === 1 ? 'roots become a ring of thorns' : `every cast raises ${w.rings} rings of thorns`} that hold foes fast for ${w.rootMs / 1000}s, then slow them ${pct(c.bramble.slow[rank])}% for the rest of ${c.bramble.lifeMs[rank] / 1000}s. Foes inside take ${w.damagePerSecond} damage a second and thrown acorns cannot cross.`; }
    case 'spore-trail': { const b = c.spore.bloom[t];
      return `${name}: patches deal ${c.spore.damagePerSecond[rank]} damage a second, linger ${b.lifeMs / 1000}s, and up to ${b.maxPatches} can grow at once. Any foe slain ${b.sproutReach ? `within ${b.sproutReach} pixels of` : 'inside'} a patch sprouts a fresh patch where it fell.`; }
    case 'acorn-shower': { const o = c.acorn.oak[t];
      return `${name}: every ${o.cooldownMs / 1000}s a mighty acorn lands for ${c.acorn.damage[rank]} damage across ${c.acorn.radius[rank]} pixels, rolls onward for ${o.rollMs / 1000}s crushing everything in its path, then shatters into ${o.shardCount} ordinary acorns.`; }
    case 'barkskin-ward': { const b = c.ward.bark[t];
      return `${name}: the ward holds ${b.leaves} leaves, each blocking one hit, regrowing one every ${c.ward.rechargeMs[rank] / 1000}s. When the last leaf falls, a burst deals ${b.burstDamage} damage to every foe within ${b.burstRange} pixels, throws them back and roots them for ${b.rootMs / 1000}s.`; }
    case 'woodland-magnet': { const h = c.magnet.harvest[t];
      return `${name}: a constant wind draws every crystal within ${c.magnet.range[rank]} pixels to you. Each crystal adds ${h.bonusPerCrystal * 100}% projectile damage for ${h.durationMs / 1000}s, up to ${pct(h.maxBonus)}%${h.healPerCrystal ? `, and heals ${h.healPerCrystal}` : ''}.`; }
    case 'mystery-double-pounce': { const f = c.pounce.frenzy[t];
      return `${name}: Mystery keeps leaping from foe to foe at ${pct(c.pounce.damageScale[rank])}% damage, up to ${f.maxChain} in a row, and pounces ${Math.round(1 / f.cooldownScale * 10) / 10}x as often${f.healthFraction ? ' while you are above half health' : ', always'}.`; }
    case 'ribbon-sweep': { const y = c.ribbon.cyclone[t];
      return `${name}: the ribbon whirls the whole way around you, out to ${y.range} pixels for ${c.ribbon.damage[rank]} damage, hurling foes back ${c.ribbon.knockback[rank]} pixels. A trailing echo strikes again ${y.echoMs / 1000}s later for ${pct(y.echoDamage)}% damage.`; }
    case 'inspiring-shout': { const a = c.shout.anthem[t];
      return `${name}: for ${c.shout.durationMs / 1000}s you attack ${pct(c.shout.attackSpeed[rank])}% faster and move ${pct(c.shout.moveSpeed[rank])}% faster, and the song mends ${a.healPerSecond} health a second. The opening note blasts every foe within ${a.waveRadius} pixels for ${a.waveDamage} damage.`; }
    case 'dizzying-flurry': { const v = c.flurry.vortex[t];
      return `${name}: the spin lasts ${v.durationMs / 1000}s, striking every ${c.flurry.tickMs / 1000}s for ${c.flurry.damage[rank]} damage within ${c.flurry.radius[rank]} pixels, dragging foes toward you and leaving them ${pct(v.slow)}% slower.`; }
  }
}

export function describeAbility(id: AbilityId, rank: AbilityRank, weaponId: WeaponId = 'spell'): string {
  if (isAwakened(rank)) return describeAwakening(id, rank, weaponId);
  switch (id) {
    case 'midnight-mighty-swat': return describeMidnightSwat(rank);
    case 'ricochet-charm': {
      return `Shots bounce to ${rank} additional ${rank === 1 ? 'enemy' : 'enemies'}, retaining 70% damage each bounce. Crossbow shots also keep their built-in pierce.`;
    }
    case 'firefly-orbit': return `${ABILITIES.firefly.count[rank]} golden fireflies orbit you, dealing 8 contact damage. Each foe can be hit every 0.5s.`;
    case 'bramble-snare': return `Every 5s, grow roots that slow foes by ${Math.round(ABILITIES.bramble.slow[rank] * 100)}% for ${ABILITIES.bramble.lifeMs[rank] / 1000}s.`;
    case 'spore-trail': return `Moving leaves mushroom patches for 3s, dealing ${ABILITIES.spore.damagePerSecond[rank]} damage per second.`;
    case 'acorn-shower': return `Every 4s, a falling acorn deals ${ABILITIES.acorn.damage[rank]} area damage within ${ABILITIES.acorn.radius[rank]} pixels.`;
    case 'barkskin-ward': return `Block a hit and gain 0.5s protection. The leafy shield recharges in ${ABILITIES.ward.rechargeMs[rank] / 1000}s.`;
    case 'woodland-magnet': return `Every ${ABILITIES.magnet.cooldownMs[rank] / 1000}s, draw XP crystals from ${ABILITIES.magnet.range[rank]} pixels away.`;
    case 'mystery-double-pounce': return `Mystery leaps to a second nearby foe for ${Math.round(ABILITIES.pounce.damageScale[rank] * 100)}% pounce damage before returning.`;
    case 'ribbon-sweep': return `Every ${ABILITIES.ribbon.cooldownMs / 1000}s, sweep the ribbon staff through a wide arc ahead for ${ABILITIES.ribbon.damage[rank]} damage, throwing foes back ${ABILITIES.ribbon.knockback[rank]} pixels.`;
    case 'inspiring-shout': return `Every ${ABILITIES.shout.cooldownMs / 1000}s, call out for ${ABILITIES.shout.durationMs / 1000}s: attack ${Math.round(ABILITIES.shout.attackSpeed[rank] * 100)}% faster and move ${Math.round(ABILITIES.shout.moveSpeed[rank] * 100)}% faster.`;
    case 'dizzying-flurry': return `Every ${ABILITIES.flurry.cooldownMs / 1000}s, spin the staff for ${ABILITIES.flurry.durationMs / 1000}s, hitting everything within ${ABILITIES.flurry.radius[rank]} pixels for ${ABILITIES.flurry.damage[rank]} damage every ${ABILITIES.flurry.tickMs / 1000}s.`;
  }
}
