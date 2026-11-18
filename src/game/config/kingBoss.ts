/**
 * King Rumbles, the Armadillo King, is the final story boss.
 * He curls up and rolls, digging in to change direction before he sprays shell shards.
 */
export const KING = {
  name: 'King Rumbles', health: 30000, healthPerMinute: 450, contactDamage: 26,
  radius: 34, speed: 70, standOff: 230, spawnDistance: 360, introductionMs: 2000,
  curlMs: 900, enragedCurlMs: 600,
  rollSpeed: 650, rollDamage: 30, rollKnockback: 170,
  rollLegs: 3, enragedRollLegs: 4,
  rollMinDistance: 340, rollMaxDistance: 700, rollOvershoot: 150,
  turnWindupMs: 420, enragedTurnWindupMs: 300,
  dizzyMs: 1800, dizzyVulnerability: 1.2, cooldownMs: 2200, enragedCooldownMs: 1500,
  shardCount: 10, enragedShardCount: 14, shardSpeed: 300, shardDamage: 8,
  /**
   * Ground ripple: every time he digs in at the end of a roll, the ground shakes.
   * It hurts everywhere it passes except the lane he just rolled in along, which stays safe.
   */
  rippleSpeed: 430, rippleWidth: 34, rippleReach: 1100, rippleDamage: 18, rippleKnockback: 90, rippleSafeHalfWidth: 70,
  addThresholds: [.66, .33], addsPerWave: 4,
  enrageFraction: .4,
  xp: 400
} as const;

export const KING_LOOK = { scale: 2.4, tint: 0xf2c46a, crown: 0xffd84a, laneColor: 0xffc75a, laneEdge: 0x7a4a14 } as const;
