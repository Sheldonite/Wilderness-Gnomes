/**
 * King Rumbles, the Armadillo King: the level 30 boss and the end of the run.
 * He curls up and rolls, ricocheting off the arena's edge, then sprays shell shards when he stops.
 */
export const KING = {
  level: 30, name: 'King Rumbles', health: 30000, healthPerMinute: 450, contactDamage: 26,
  radius: 34, speed: 70, standOff: 230, spawnDistance: 360, introductionMs: 2000,
  curlMs: 900, enragedCurlMs: 600,
  rollSpeed: 650, rollDamage: 30, rollKnockback: 170, bounces: 2, enragedBounces: 3,
  /** Safety net: a roll ends after this long even if it never runs out of bounces. */
  rollMaxMs: 7000,
  dizzyMs: 1800, dizzyVulnerability: 1.2, cooldownMs: 2200, enragedCooldownMs: 1500,
  shardCount: 10, enragedShardCount: 14, shardSpeed: 300, shardDamage: 8,
  /**
   * Ground ripple: every wall (or tree) he rolls into sends a ring rolling out across the ground.
   * It hurts everywhere it passes except the lane he just rolled in along, which stays safe.
   */
  rippleSpeed: 430, rippleWidth: 34, rippleReach: 1100, rippleDamage: 18, rippleKnockback: 90, rippleSafeHalfWidth: 70,
  addThresholds: [.66, .33], addsPerWave: 4,
  enrageFraction: .4,
  xp: 400
} as const;

export const KING_LOOK = { scale: 2.4, tint: 0xf2c46a, crown: 0xffd84a, laneColor: 0xffc75a, laneEdge: 0x7a4a14 } as const;
