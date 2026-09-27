export const OVEN = {
  level: 10, name: 'Oven', health: 6500, healthPerMinute: 150, contactDamage: 22,
  radius: 22, speed: 64, standOff: 160,
  spawnDistance: 340, introductionMs: 1800, windupMs: 800, flightMs: 1100,
  cooldownMs: 3000, hotCooldownMs: 2200, damage: 18, blastRadius: 42,
  spread: 92, xp: 120, ringRadius: 110,
  /** Tacos in a calm ring, and in each of the two staggered rings once the Oven runs hot. */
  ringTacos: 5, hotRingTacos: 7, secondRingDelayMs: 400,
  /** Upper bound on tacos in the air and salsa on the ground. */
  maxTacos: 14, maxSalsa: 16,
  salsaRadius: 32, salsaLifeMs: 2600, salsaTickMs: 1000, salsaDamage: 4,
  hotSalsaLifeMs: 4000, hotSalsaDamage: 7,
  /** Oven door blast: a telegraphed cone of flame aimed where the player stood. */
  coneWindupMs: 1100, coneRange: 320, coneHalfAngle: .6, coneDamage: 24, coneMs: 450,
  /** Line cooks rush in when the Oven drops past each of these health fractions. */
  addThresholds: [.66, .33], addsPerWave: 7, addTint: 0xff7a55,
  hotFraction: .5
} as const;

export const OVEN_LOOK = { height: 160, stridePixels: 48, shadowWidth: 110, shadowHeight: 28 } as const;
