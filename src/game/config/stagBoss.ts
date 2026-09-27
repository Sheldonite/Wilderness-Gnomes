/** Wonky, the lopsided old stag: the level 15 boss. Three points on his left antler, five on his right. */
export const STAG = {
  level: 15, name: 'Wonky', health: 15000, healthPerMinute: 300, contactDamage: 24,
  radius: 34, speed: 96, standOff: 230,
  spawnDistance: 380, introductionMs: 2000,
  windupMs: 900, enragedWindupMs: 550,
  chargeSpeed: 820, chargeDistance: 640, chargeDamage: 30, chargeKnockback: 150,
  stompRadius: 150, stompDamage: 14,
  recoverMs: 1400, cooldownMs: 2600, enragedCooldownMs: 1800,
  enrageFraction: .5, enragedCharges: 2,
  /** Charging into a tree stuns him, and a stunned stag takes extra damage. */
  stunMs: 2500, stunVulnerability: 1.25,
  /** Stay close too long and he sweeps his antlers through the half circle in front of him. */
  sweepTriggerRange: 150, sweepHoldMs: 1500, sweepWindupMs: 600,
  sweepRange: 175, sweepDamage: 22, sweepKnockback: 190, sweepRestMs: 700,
  /** Enraged follow-up charges aim where the player is heading, up to this far ahead. */
  leadMaxMs: 700,
  /** He calls the herd as he passes each of these health fractions. */
  stampedeThresholds: [.5, .25], stampedeLanes: 2, stampedeCount: 5,
  xp: 260
} as const;

export const STAG_LOOK = { height: 150, stridePixels: 56, shadowWidth: 150, shadowHeight: 34, laneColor: 0xb8e06a, laneEdge: 0x3a5a22 } as const;
