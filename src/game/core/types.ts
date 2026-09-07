export type GameRunState = 'Start' | 'Playing' | 'Paused' | 'LevelUpPaused' | 'GameOver';

export type UpgradeId =
  | AbilityId
  | BossAbilityId
  | 'projectile-damage'
  | 'fire-rate'
  | 'move-speed'
  | 'max-health'
  | 'projectile-count'
  | 'gain-companion-mystery'
  | 'gain-companion-midnight';

export type AbilityId = 'ricochet-charm' | 'firefly-orbit' | 'bramble-snare' | 'spore-trail'
  | 'acorn-shower' | 'barkskin-ward' | 'woodland-magnet' | 'mystery-double-pounce';
export type AbilityRank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type BossAbilityId = 'crownfire' | 'stormcall' | 'phoenix-heart';
export type UpgradeSource = 'level' | 'chest' | 'boss';
export type AbilityRanks = Record<AbilityId, AbilityRank>;
export type WeaponId = 'spell' | 'crossbow';

export interface Vector2Like {
  x: number;
  y: number;
}

export interface PlayerStats {
  /** Current player level; ability ranks past the awakening are gated on it. */
  level: number;
  upgradeCounts: Partial<Record<UpgradeId, number>>;
  abilityRanks: AbilityRanks;
  bossAbilityRanks: Record<BossAbilityId, AbilityRank>;
  weaponId: WeaponId;
  maxHealth: number;
  health: number;
  speed: number;
  projectileDamage: number;
  weaponCooldownMs: number;
  projectileCount: number;
  /** Harvest Wind: temporary projectile damage bonus, refreshed by the ability simulation each frame. */
  harvestBonus: number;
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
