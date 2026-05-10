import { BALANCE } from '../config/balance';
import type { GameRunState, HudSnapshot, PlayerStats } from './types';

export class GameManager {
  state: GameRunState = 'Playing';
  elapsedMs = 0;
  kills = 0;
  level = 1;
  xp = 0;
  xpToNextLevel: number = BALANCE.leveling.baseThreshold;
  readonly playerStats: PlayerStats;

  constructor() {
    this.playerStats = {
      maxHealth: BALANCE.player.maxHealth,
      health: BALANCE.player.maxHealth,
      speed: BALANCE.player.speed,
      projectileDamage: BALANCE.weapon.projectileDamage,
      weaponCooldownMs: BALANCE.weapon.cooldownMs,
      projectileCount: BALANCE.weapon.projectileCount
    };
  }

  update(deltaMs: number): void {
    if (this.state !== 'Playing') {
      return;
    }

    this.elapsedMs += deltaMs;
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

    this.xp -= this.xpToNextLevel;
    this.level += 1;
    this.xpToNextLevel = Math.ceil(
      BALANCE.leveling.baseThreshold * Math.pow(BALANCE.leveling.thresholdGrowth, this.level - 1)
    );
    this.state = 'LevelUpPaused';
    return true;
  }

  resumeAfterUpgrade(): void {
    if (this.state === 'LevelUpPaused') {
      this.state = 'Playing';
    }
  }

  damagePlayer(amount: number): void {
    if (this.state !== 'Playing') {
      return;
    }

    this.playerStats.health = Math.max(0, this.playerStats.health - amount);
    if (this.playerStats.health <= 0) {
      this.state = 'GameOver';
    }
  }

  getDifficultyMinutes(): number {
    return this.elapsedMs / 60000;
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
