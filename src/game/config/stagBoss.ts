/** Hollowcrown, the great four-point stag: the level 15 boss. */
export const STAG = {
  level: 15, name: 'Hollowcrown, the Old Stag', health: 2600, radius: 34, speed: 96, standOff: 230,
  spawnDistance: 380, introductionMs: 2000,
  windupMs: 900, enragedWindupMs: 550,
  chargeSpeed: 820, chargeDistance: 640, chargeDamage: 30, chargeKnockback: 150,
  stompRadius: 150, stompDamage: 14,
  recoverMs: 1400, cooldownMs: 2600, enragedCooldownMs: 1800,
  enrageFraction: .5, enragedCharges: 2,
  xp: 260
} as const;

export const STAG_LOOK = { height: 150, stridePixels: 56, shadowWidth: 150, shadowHeight: 34, laneColor: 0xb8e06a, laneEdge: 0x3a5a22 } as const;
