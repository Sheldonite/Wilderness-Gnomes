import { BALANCE } from '../config/balance';
import { ABILITIES, emptyAbilityRanks } from '../config/abilities';
import { getWeapon } from '../config/weapons';
import type { GameRunState, HudSnapshot, PlayerStats, WeaponId } from './types';

export class GameManager {
  state: GameRunState = 'Playing';
  elapsedMs = 0;
  kills = 0;
  level = 1;
  xp = 0;
  xpToNextLevel: number = BALANCE.leveling.baseThreshold;
  readonly playerStats: PlayerStats;
  private wardWasUnlocked = false;
  private wardReadyAt = 0;
  private wardProtectedUntil = 0;

  constructor(weaponId: WeaponId = 'spell') {
    const arm = getWeapon(weaponId);
    this.playerStats = {
      upgradeCounts: {},
      abilityRanks: emptyAbilityRanks(),
      weaponId: arm.id,
      maxHealth: BALANCE.player.maxHealth,
      health: BALANCE.player.maxHealth,
      speed: BALANCE.player.speed,
      projectileDamage: arm.projectileDamage,
      weaponCooldownMs: arm.cooldownMs,
      projectileCount: arm.projectileCount,
      hasMysteryCompanion: false,
      hasMidnightCompanion: false,
      mysteryDamage: BALANCE.companion.mysteryDamage,
      mysteryCooldownMs: BALANCE.companion.mysteryCooldownMs,
      mysteryPounceRange: BALANCE.companion.mysteryPounceRange,
      mysteryReturnSpeed: BALANCE.companion.mysteryReturnSpeed
    };
  }

  update(deltaMs: number): void {
    if (this.state !== 'Playing') {
      return;
    }

    this.elapsedMs += deltaMs;
    if (this.playerStats.abilityRanks['barkskin-ward'] > 0) this.wardWasUnlocked = true;
  }

  addKill(): void {
    this.kills += 1;
  }

  addXp(amount: number): boolean {
    if (this.state !== 'Playing') {
      return false;
    }

    this.xp += amount;
    if (this.xp < this.xpToNextLevel) {
      return false;
    }

    this.advanceLevel();
    return true;
  }

  private advanceLevel(): void {
    this.xp -= this.xpToNextLevel;
    this.level += 1;
    this.xpToNextLevel = Math.ceil(
      BALANCE.leveling.baseThreshold * Math.pow(BALANCE.leveling.thresholdGrowth, this.level - 1)
    );
    this.state = 'LevelUpPaused';
  }

  resumeAfterUpgrade(): void {
    if (this.state === 'LevelUpPaused') {
      this.state = 'Playing';
      if (this.xp >= this.xpToNextLevel) this.advanceLevel();
    }
  }

  pause(): void {
    if (this.state === 'Playing') {
      this.state = 'Paused';
    }
  }

  resume(): void {
    if (this.state === 'Paused') {
      this.state = 'Playing';
    }
  }

  togglePause(): void {
    if (this.state === 'Playing') {
      this.pause();
      return;
    }

    if (this.state === 'Paused') {
      this.resume();
    }
  }

  damagePlayer(amount: number, source: 'contact' | 'direct' = 'direct'): void {
    if (this.state !== 'Playing') {
      return;
    }

    if (amount <= 0) return;
    if (source === 'contact' && this.playerStats.abilityRanks['barkskin-ward'] > 0) {
      if (!this.wardWasUnlocked) { this.wardWasUnlocked = true; this.wardReadyAt = this.elapsedMs; }
      if (this.elapsedMs < this.wardProtectedUntil) return;
      if (this.elapsedMs >= this.wardReadyAt) {
        this.wardProtectedUntil = this.elapsedMs + ABILITIES.ward.protectionMs;
        this.wardReadyAt = this.elapsedMs + ABILITIES.ward.rechargeMs[this.playerStats.abilityRanks['barkskin-ward']];
        return;
      }
    }
    this.playerStats.health = Math.max(0, this.playerStats.health - amount);
    if (this.playerStats.health <= 0) {
      this.state = 'GameOver';
    }
  }

  getDifficultyMinutes(): number {
    return this.elapsedMs / 60000;
  }

  get wardStatus(): 'locked' | 'ready' | 'protecting' | 'recharging' {
    if (!this.playerStats.abilityRanks['barkskin-ward']) return 'locked';
    if (this.elapsedMs < this.wardProtectedUntil) return 'protecting';
    return this.elapsedMs >= this.wardReadyAt ? 'ready' : 'recharging';
  }

  getHudSnapshot(): HudSnapshot {
    return {
      health: this.playerStats.health,
      maxHealth: this.playerStats.maxHealth,
      xp: this.xp,
      xpToNextLevel: this.xpToNextLevel,
      level: this.level,
      elapsedSeconds: Math.floor(this.elapsedMs / 1000),
      kills: this.kills
    };
  }
}
