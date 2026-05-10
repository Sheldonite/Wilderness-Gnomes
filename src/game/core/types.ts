export type GameRunState = 'Start' | 'Playing' | 'LevelUpPaused' | 'GameOver';

export type UpgradeId =
  | 'projectile-damage'
  | 'fire-rate'
  | 'move-speed'
  | 'max-health'
  | 'projectile-count';

export interface Vector2Like {
  x: number;
  y: number;
}

export interface PlayerStats {
  maxHealth: number;
  health: number;
  speed: number;
  projectileDamage: number;
  weaponCooldownMs: number;
  projectileCount: number;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  title: string;
  description: string;
  apply: (stats: PlayerStats) => void;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  xp: number;
  xpToNextLevel: number;
  level: number;
  elapsedSeconds: number;
  kills: number;
}
