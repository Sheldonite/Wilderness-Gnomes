export const BALANCE = {
  player: {
    radius: 18,
    maxHealth: 100,
    speed: 235,
    contactInvulnerabilityMs: 420
  },
  enemy: {
    radius: 15,
    health: 28,
    speed: 92,
    contactDamage: 8,
    contactDamageCooldownMs: 520,
    separationRadius: 34,
    xpValue: 8
  },
  deer: {
    unlockLevel: 10,          // from here every spawn is a deer; squirrels stop
    fawnChance: 0.35,
    buckLevel: 15,            // from here one deer in five is a buck
    buckChance: 0.2,
    doe: { health: 70, speed: 118, contactDamage: 12, radius: 22, scale: 1.05 },
    fawn: { health: 34, speed: 150, contactDamage: 6, radius: 15, scale: 0.85 },
    buck: { health: 150, speed: 105, contactDamage: 20, radius: 26, scale: 1.55 }
  },
  rangedEnemy: {
    unlockLevel: 5,
    spawnChance: 0.2,
    health: 22,
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
  spawner: {
    initialSpawnIntervalMs: 1200,
    minSpawnIntervalMs: 260,
    spawnIntervalReductionPerMinute: 260,
    initialMaxEnemies: 45,
    maxEnemiesCap: 180,
    maxEnemiesAddedPerMinute: 24,
    spawnOutsideViewPadding: 90
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
    mysteryDamage: 16,
    mysteryCooldownMs: 2200,
    mysteryPounceRange: 420,
    mysteryPounceSpeed: 620,
    mysteryReturnSpeed: 260,
    mysteryHitRadius: 24,
    mysteryFollowDistance: 46,
    mysteryPounceTimeoutMs: 650,
    midnightDamage: 22,
    midnightCooldownMs: 1500,
    midnightSwatDurationMs: 480,
    midnightSwatHitMs: 240,
    midnightSwatRange: 62,
    midnightApproachRange: 42,
    midnightSeekRange: 200,
    midnightLeashRange: 280,
    midnightWalkSpeed: 260,
    midnightFollowDistance: 46
  },
  xp: {
    radius: 7,
    maxOrbs: 220,
    magnetRange: 150,
    collectRange: 24,
    idleSpeed: 0,
    magnetSpeed: 420
  },
  leveling: {
    baseThreshold: 24,
    thresholdGrowth: 1.22,
    linearFromLevel: 10,        // past here each level needs a fixed amount more, not a percentage
    linearStepXp: 30,
    choices: 3
  }
} as const;
