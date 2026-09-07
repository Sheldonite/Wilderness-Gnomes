export const OVEN = {
  level: 10, name: 'Oven', health: 1200, radius: 22, speed: 64, standOff: 160,
  spawnDistance: 340, introductionMs: 1800, windupMs: 800, flightMs: 1100,
  cooldownMs: 3000, hotCooldownMs: 2200, damage: 18, blastRadius: 42,
  spread: 92, xp: 120, maxTacos: 5, ringRadius: 110,
  salsaRadius: 32, salsaLifeMs: 2600, salsaTickMs: 1000, salsaDamage: 4
} as const;

export const OVEN_LOOK = { height: 160, stridePixels: 48, shadowWidth: 110, shadowHeight: 28 } as const;
