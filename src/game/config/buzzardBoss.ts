/**
 * King Frankie, the great buzzard: the level 25 boss. He circles overhead, where he is hard to hurt,
 * and comes down only to dive. After a dive he lands to catch his breath: that is the moment to strike.
 */
export const BUZZARD = {
  level: 25, name: 'King Frankie', health: 22000, healthPerMinute: 380, contactDamage: 22,
  radius: 36, spawnDistance: 380, introductionMs: 2000,
  /** Circling: he orbits the player at this distance, flying over scenery. The orbit is squashed
   * top to bottom so he stays on a wide, short screen. */
  circleRadius: 280, circleSquash: .62, circleSpeed: .9, flySpeed: 330, circleMs: 2200, enragedCircleMs: 1500,
  /** Damage taken while flying, and while landed after a dive. */
  airborneVulnerability: .5, perchVulnerability: 1.3,
  /** What he does each time he finishes circling, in order, round and round. */
  attackOrder: ['dive', 'volley', 'dive', 'gust'] as readonly ('dive' | 'volley' | 'gust')[],
  diveWindupMs: 750, enragedDiveWindupMs: 520, diveSpeed: 950, diveOvershoot: 320,
  diveDamage: 28, diveKnockback: 150, enragedDives: 2, diveGapMs: 260,
  perchMs: 1700, enragedPerchMs: 1200,
  /** Feather volley: a fan of feathers along a locked aim. */
  volleyWindupMs: 550, volleyFeathers: 7, enragedVolleyFeathers: 11, volleySpread: 1.2, featherSpeed: 400, featherDamage: 9,
  /** Gust: a wing-beat cone that hurls the player back. */
  gustWindupMs: 750, gustRange: 400, gustHalfAngle: .7, gustDamage: 10, gustKnockback: 240,
  enrageFraction: .4,
  xp: 330
} as const;

export const BUZZARD_LOOK = { scale: 1.05, shadowDrop: 60, laneColor: 0x5b4a6e, laneEdge: 0x2a2036, gustColor: 0xd8f0ff, feather: 0x6a5048 } as const;
