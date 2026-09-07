export type GameRunState = 'Start' | 'Playing' | 'Paused' | 'LevelUpPaused' | 'GameOver';

export type UpgradeId =
  | AbilityId
  | 'projectile-damage'
  | 'fire-rate'
  | 'move-speed'
  | 'max-health'
  | 'projectile-count'
  | 'gain-companion-mystery'
  | 'gain-companion-midnight';

export type AbilityId = 'ricochet-charm' | 'firefly-orbit' | 'bramble-snare' | 'spore-trail'
  | 'acorn-shower' | 'barkskin-ward' | 'woodland-magnet' | 'mystery-double-pounce';
export type AbilityRank = 0 | 1 | 2 | 3;
export type AbilityRanks = Record<AbilityId, AbilityRank>;

export interface Vector2Like {
  x: number;
  y: number;
}

export interface PlayerStats {
  abilityRanks: AbilityRanks;
  maxHealth: number;
  health: number;
  speed: number;
  projectileDamage: number;
  weaponCooldownMs: number;
  projectileCount: number;
  hasMysteryCompanion: boolean;
  hasMidnightCompanion: boolean;
  mysteryDamage: number;
  mysteryCooldownMs: number;
  mysteryPounceRange: number;
  mysteryReturnSpeed: number;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  title: string;
  description: string;
  category?: string;
  rank?: AbilityRank;
  isAvailable?: (stats: PlayerStats) => boolean;
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
