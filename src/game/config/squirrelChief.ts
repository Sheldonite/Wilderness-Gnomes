/** Squirrel Chief: the first woodland boss. */
export const SQUIRREL_CHIEF = {
  name: 'Squirrel Chief',
  health: 1100,
  healthPerMinute: 0,
  contactDamage: 16,
  radius: 26,
  speed: 105,
  scale: 1.7,
  tint: 0xffb36b,
  vulnerableTint: 0xffe2a2,
  spawnDistance: 360,
  introductionMs: 1200,
  stalkMs: 1300,
  /** Acorn Barrage: 5-acorn spread fan aimed at the player. */
  barrageWindupMs: 500,
  barrageCount: 5,
  barrageSpread: 0.85,
  barrageSpeed: 370,
  barrageRestMs: 450,
  /** Chief Charge: telegraphed 650ms locked lane 380px dash at 560 speed. */
  chargeWindupMs: 650,
  chargeDistance: 380,
  chargeSpeed: 560,
  chargeDamage: 24,
  /** Brief catch-breath window after a charge where he takes 1.3x damage. */
  catchBreathMs: 900,
  vulnerableMultiplier: 1.3,
  xp: 120
} as const;

export const SQUIRREL_CHIEF_LOOK = {
  shadowWidth: 72,
  shadowHeight: 20,
  laneColor: 0xff8a47,
  laneEdge: 0x7a2414,
  acornWarnColor: 0xffd27d
} as const;
