/** Wonky, the lopsided old stag: the level 15 boss. Three points on his left antler, five on his right. */
export const STAG = {
  level: 15, name: 'Wonky', health: 15000, healthPerMinute: 300, contactDamage: 24,
  radius: 34, speed: 96, standOff: 230,
  spawnDistance: 380, introductionMs: 2000,
  windupMs: 750, enragedWindupMs: 500,
  chargeSpeed: 820, chargeDistance: 640, chargeDamage: 34, chargeKnockback: 150,
  stompRadius: 150, stompDamage: 14,
  recoverMs: 1100, cooldownMs: 1800, enragedCooldownMs: 1200,
  enrageFraction: .5, enragedCharges: 2,
  /** What he does each time he finishes stalking, in order, round and round. */
  attackOrder: ['charge', 'volley', 'charge', 'bellow'] as readonly ('charge' | 'volley' | 'bellow')[],
  /** Charging into a tree stuns him, and a stunned stag takes extra damage. */
  stunMs: 2200, stunVulnerability: 1.25,
  /** Stay close too long and he sweeps his antlers through the half circle in front of him. */
  sweepTriggerRange: 150, sweepHoldMs: 1500, sweepWindupMs: 600,
  sweepRange: 175, sweepDamage: 22, sweepKnockback: 190, sweepRestMs: 700,
  /** Velvet volley: he shakes his head and flings a fan of antler shards at the player. */
  volleyWindupMs: 550, volleyShards: 5, rutVolleyShards: 8, volleySpread: 1.1, volleySpeed: 380, volleyDamage: 10, volleyRestMs: 500,
  /** Bellow: he rears and roars. Anyone close is shaken and slowed, and he charges straight after. */
  bellowWindupMs: 800, bellowRadius: 360, bellowSlow: .5, bellowSlowMs: 2500,
  /** Enraged, every other charge is a feint: the lane swings to the player's new spot partway through. */
  feintExtraMs: 320,
  /** Enraged follow-up charges aim where the player is heading, up to this far ahead. */
  leadMaxMs: 700,
  /** Rut: below this health he is in a frenzy. Triple charges, faster everything, shorter stuns. */
  rutFraction: .3, rutCharges: 3, rutWindupMs: 420, rutRecoverMs: 650, rutStunMs: 1600,
  rutChargeSpeed: 1.15, rutStalkSpeed: 1.6, rutTint: 0xffb8a0,
  /** He calls the herd as he passes each of these health fractions. */
  stampedeThresholds: [.5, .25], stampedeLanes: 2, stampedeCount: 5,
  xp: 260
} as const;

export const STAG_LOOK = { height: 190, stridePixels: 56, shadowWidth: 150, shadowHeight: 34, laneColor: 0xb8e06a, laneEdge: 0x3a5a22,
  feintColor: 0xff8a5a, feintEdge: 0x7a2a14, velvet: 0xd2b286 } as const;
