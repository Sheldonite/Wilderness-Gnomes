export const BALANCE = {
  player: {
    radius: 18,
    maxHealth: 100,
    speed: 235,
    contactInvulnerabilityMs: 420
  },
  enemy: {
    radius: 15,
    health: 20,
    speed: 92,
    contactDamage: 11,
    contactDamageCooldownMs: 520,
    separationRadius: 34,
    xpValue: 8,
    /** Every foe gains this much health per minute of the run. */
    healthPerMinute: 8,
    /** Speed rises per minute, but never past this fraction of the creature's own base speed. */
    speedPerMinute: 6,
    maxSpeedBonus: 0.4,
    /** Contact damage grows by this fraction per minute, so late foes stay dangerous without outrunning you. */
    damagePerMinute: 0.04,
    /** Subtle per-level contact damage scaling so enemy danger grows with player level too. */
    damagePerLevel: 0.03
  },
  /** Crystals dropped per creature: sturdier foes are worth more. */
  enemyXp: { brown: 8, grey: 10, scout: 10, hedgehog: 16, fawn: 8, doe: 14, buck: 30, armadillo: 35, buzzard: 26 },
  /** Bosses shrug off shoves and pulls, and are never slowed below this multiplier. */
  boss: { slowFloor: 0.7 },
  elite: {
    firstMs: 45000,
    everyMs: 75000,
    healthMultiplier: 5,
    damageMultiplier: 1.3,
    scale: 1.35,
    xpMultiplier: 5,
    tint: 0xffd36a
  },
  /** Timed set pieces between bosses. Their clocks only run while the woods are open. */
  events: {
    ringFirstMs: 75000,
    ringEveryMs: 90000,
    ringRadius: 640,
    ringBase: 10,
    ringPerMinute: 2,
    ringMax: 36,
    stampedeFirstMs: 120000,
    stampedeEveryMs: 90000,
    stampedeWarnMs: 1400,
    stampedeCount: 6,
    stampedeSpeed: 430,
    stampedeLength: 1500,
    stampedeSpacing: 58,
    stampedeLaneWidth: 70,
    doubleStampedeMinute: 10,
    /** Set pieces may exceed the spawner's cap by this many creatures, never more. */
    capAllowance: 40,
    /** Woodland Campfire/Shrine cadence and blessing rewards. */
    shrineFirstMs: 90000,
    shrineEveryMs: 150000,
    shrineHeal: 25,
    shrineFrenzyMs: 6000,
    shrineAttackSpeedBonus: 0.25,
    shrineMoveSpeedBonus: 0.18,
    shrineBonusGold: 2,
    shrineXpBurst: 18,
    shrineCollectRange: 42
  },
  deer: {
    unlockLevel: 10,          // from here most spawns are deer
    fawnChance: 0.35,
    buckLevel: 15,            // from here one deer in five is a buck
    buckChance: 0.2,
    squirrelShare: 0.3,       // squirrels still make up this share of spawns once deer arrive
    doe: { health: 70, speed: 118, contactDamage: 12, radius: 22, scale: 1.05 },
    fawn: { health: 34, speed: 150, contactDamage: 6, radius: 15, scale: 0.85 },
    buck: { health: 150, speed: 105, contactDamage: 20, radius: 26, scale: 1.55 }
  },
  /**
   * Buzzards join the regular spawns at player level 25.
   * They fly straight over scenery, and when close they hover, then swoop in a locked straight line.
   */
  buzzard: {
    unlockLevel: 25,
    spawnChance: 0.2,
    health: 110,
    speed: 150,
    contactDamage: 14,
    radius: 20,
    scale: 0.42,
    swoopRange: 300,
    swoopWindupMs: 480,
    swoopSpeed: 520,
    swoopDistance: 380,
    swoopDamage: 20,
    recoverMs: 420,
    swoopCooldownMs: 2600,
    tint: 0xc9a894
  },
  armadillo: {
    unlockLevel: 20,
    spawnChance: 0.25,
    health: 192,
    walkSpeed: 78,
    rollSpeed: 340,
    rollDistance: 260,
    windupRange: 250,
    curlMs: 380,
    recoverMs: 520,
    cooldownMs: 1600,
    walkDamage: 10,
    rollDamage: 20,
    radius: 18,
    scale: 1.2
  },
  rangedEnemy: {
    unlockLevel: 2,
    spawnChance: 0.2,
    health: 17,
    speed: 84,
    preferredRange: 500,
    retreatRange: 300,
    throwRange: 660,
    throwCooldownMs: 2100,
    acornSpeed: 360,
    acornDamage: 6,
    acornRadius: 7,
    acornLifetimeMs: 4000   // 1440px of travel
  },
  scout: {
    unlockLevel: 1,
    spawnChance: 0.14,
    health: 14,
    speed: 152,
    contactDamage: 10,
    radius: 13,
    xpValue: 10
  },
  hedgehog: {
    unlockLevel: 3,
    spawnChance: 0.16,
    health: 36,
    walkSpeed: 88,
    rollSpeed: 370,
    rollDistance: 240,
    windupRange: 230,
    curlMs: 420,
    recoverMs: 500,
    cooldownMs: 1800,
    walkDamage: 10,
    rollDamage: 18,
    radius: 15,
    xpValue: 16
  },
  spawner: {
    initialSpawnIntervalMs: 700,
    minSpawnIntervalMs: 260,
    spawnIntervalReductionPerMinute: 260,
    initialMaxEnemies: 70,
    maxEnemiesCap: 180,
    maxEnemiesAddedPerMinute: 24,
    spawnOutsideViewPadding: 90,
    spawnMinDistance: 640,
    spawnMaxDistance: 780,
    /** A small lead flank opens the run, with the rest arriving from the other side. */
    openingPackCount: 7,
    openingLeadCount: 3,
    openingLeadDistance: 240,
    openingReinforcementDistance: 350,
    openingReinforcementDelayMs: 4500,
    /** From this minute each spawn tick brings a small group, growing every few minutes. */
    batchFromMinute: 0,
    batchEveryMinutes: 2,
    maxBatch: 4
  },
  weapon: {
    cooldownMs: 850,
    projectileSpeed: 560,
    projectileDamage: 18,
    projectileLifetimeMs: 1250,
    projectileRadius: 7,
    projectileCount: 1,
    spreadRadians: 0.22
  },
  companion: {
    mysteryDamage: 40,
    mysteryCooldownMs: 1100,
    mysteryPounceRange: 420,
    mysteryPounceSpeed: 620,
    mysteryReturnSpeed: 260,
    mysteryHitRadius: 24,
    mysteryFollowDistance: 46,
    mysteryPounceTimeoutMs: 650,
    midnightDamage: 88,
    midnightCooldownMs: 850,
    midnightSwatDurationMs: 480,
    midnightSwatHitMs: 240,
    midnightSwatRange: 62,
    midnightApproachRange: 42,
    midnightSeekRange: 200,
    midnightLeashRange: 280,
    midnightWalkSpeed: 260,
    midnightFollowDistance: 46,
    frankieMaxBirds: 5,
    frankieOrbitRadius: 100,
    frankieOrbitMs: 4500,
    frankieHuntRange: 280,
    frankieDiveSpeed: 540,
    frankieReturnSpeed: 320,
    frankieDiveTimeoutMs: 900,
    frankieHitRadius: 22,
    frankieDamage: 14,
    frankieCooldownMs: 1700,
    frankieFeatherMs: 30000,
    frankieFeatherLifeMs: 18000,
    frankieFeatherBonus: 2,
    frankieFeatherCap: 40,
    /** Rank 10 Skypack Frenzy raises feather cap and hastens dive cooldown by 25%. */
    frankieAscendedFeatherCap: 60,
    frankieFrenzyCooldownScale: 0.75,
    /** Rank 5 Gale Stoop adds splash damage in a gust around diving hits. */
    frankieGustRadius: 70,
    frankieGustDamageRatio: 0.5,
    frankieCollectRange: 42,
    /** Tobias the airborne tuna: cruises beside Ron, then torpedoes the nearest foe. */
    tobiasDamage: 34,
    tobiasCooldownMs: 1450,
    /** Rank 5 Tidal Wake splash on torpedo hits; Rank 10 Leviathan Surge chains to nearby targets. */
    tobiasWakeSplashRadius: 75,
    tobiasWakeSplashRatio: 0.6,
    tobiasSurgeMaxChains: 2,
    tobiasSurgeChainRadius: 190,
    tobiasHuntRange: 300,
    tobiasDartSpeed: 620,
    tobiasReturnSpeed: 340,
    tobiasDartTimeoutMs: 800,
    tobiasHitRadius: 26,
    tobiasSwimRadius: 84,
    tobiasSwimMs: 5200,
    tobiasBobPixels: 16,
    tobiasWakeMs: 620
  },
  chest: {
    chancePerLevel: 0.4,
    minSpawnDistance: 120,
    maxSpawnDistance: 260,
    collectRange: 38,
    spacing: 70,
    placementAttempts: 32
  },
  xp: {
    radius: 7,
    maxOrbs: 220,
    magnetRange: 150,
    collectRange: 24,
    magnetSpeed: 420
  },
  leveling: {
    baseThreshold: 116,
    thresholdGrowth: 1.22,
    linearFromLevel: 10,        // past here each level needs a fixed amount more, not a percentage
    linearStepXp: 192,
    choices: 3,
    /** Split Charm can be picked this many times per run. */
    maxSplitPicks: 4
  }
} as const;
