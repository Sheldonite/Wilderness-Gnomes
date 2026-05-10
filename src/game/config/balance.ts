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
    thresholdGrowth: 1.35,
    choices: 3
  }
} as const;
