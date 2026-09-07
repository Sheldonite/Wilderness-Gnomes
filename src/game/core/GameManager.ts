import { BALANCE } from '../config/balance';
import { ABILITIES, awakeningTier, emptyAbilityRanks } from '../config/abilities';
import { getWeapon } from '../config/weapons';
import { COMPANION_BY_CHARACTER, companionRankForLevel, companionPower, frankieBirdsForRank } from '../config/companions';
import type { GameRunState, HudSnapshot, PlayerCharacterId, PlayerStats, WeaponId, UpgradeSource } from './types';
import { BossGate } from './BossGate';
import { createRunId, marketBonuses, type MarketProfile } from './MarketProgress';

/** XP needed to finish the given level: exponential early, then a fixed step per level. */
export function xpThreshold(level: number): number {
  const { baseThreshold, thresholdGrowth, linearFromLevel, linearStepXp } = BALANCE.leveling;
  const capped = Math.min(level, linearFromLevel);
  const exponential = baseThreshold * Math.pow(thresholdGrowth, capped - 1);
  return Math.ceil(exponential + Math.max(0, level - linearFromLevel) * linearStepXp);
}

export class GameManager {
  readonly runId = createRunId();
  readonly marketBonuses: ReturnType<typeof marketBonuses>;
  state: GameRunState = 'Playing';
  upgradeSource: UpgradeSource = 'level';
  readonly bossGate = new BossGate();
  bossUpgradeAvailable = false;
  elapsedMs = 0;
  kills = 0;
  level = 1;
  xp = 0;
  xpToNextLevel: number = xpThreshold(1);
  readonly playerStats: PlayerStats;
  private wardWasUnlocked = false;
  private wardReadyAt = 0;
  private wardProtectedUntil = 0;
  /** Living Bark: leaves currently on the ward, and when the next one regrows. */
  wardLeaves = 0;
  private nextLeafAt = 0;
  private barkBurstPending = false;
  private heartRegenMs = 0;

  constructor(weaponId: WeaponId = 'spell', marketProfile?: MarketProfile, characterId: PlayerCharacterId = 'wizard') {
    const arm = getWeapon(weaponId);
    this.marketBonuses = marketBonuses(marketProfile);
    const bonuses = this.marketBonuses;
    const companionId = COMPANION_BY_CHARACTER[characterId] ?? COMPANION_BY_CHARACTER.wizard;
    this.playerStats = {
      level: 1,
      upgradeCounts: {},
      heartRegen: 0,
      abilityRanks: emptyAbilityRanks(),
      bossAbilityRanks: { crownfire: 0, stormcall: 0, 'phoenix-heart': 0 },
      weaponId: arm.id,
      maxHealth: BALANCE.player.maxHealth + bonuses.extraHealth,
      health: BALANCE.player.maxHealth + bonuses.extraHealth,
      speed: BALANCE.player.speed * bonuses.speedMultiplier,
      projectileDamage: arm.projectileDamage * bonuses.damageMultiplier,
      weaponCooldownMs: arm.cooldownMs * bonuses.cooldownMultiplier,
      projectileCount: arm.projectileCount + bonuses.extraProjectiles,
      harvestBonus: 0,
      characterId,
      companionId,
      companionRank: 0,
      // The bound companion is there from the first step; only its rank changes during a run.
      hasMysteryCompanion: companionId === 'mystery',
      hasMidnightCompanion: companionId === 'midnight',
      hasFrankieCompanion: companionId === 'frankie',
      hasTobiasCompanion: companionId === 'tobias',
      frankieCount: companionId === 'frankie' ? frankieBirdsForRank(0) : 0,
      frankieFeatherBonus: 0,
      mysteryDamage: BALANCE.companion.mysteryDamage * bonuses.mysteryDamageMultiplier,
      mysteryCooldownMs: BALANCE.companion.mysteryCooldownMs,
      mysteryPounceRange: BALANCE.companion.mysteryPounceRange,
      mysteryReturnSpeed: BALANCE.companion.mysteryReturnSpeed,
      shoutAttackSpeedBonus: 0,
      shoutMoveSpeedBonus: 0
    };
    this.applyCompanionRank();
  }

  /**
   * Companions grow by themselves. Recomputing from the level (rather than incrementing) keeps
   * skipped levels, boss level jumps and review shortcuts all consistent.
   */
  private applyCompanionRank(): void {
    const stats = this.playerStats;
    const rank = companionRankForLevel(this.level);
    if (rank === stats.companionRank && this.companionPrimed) return;
    this.companionPrimed = true;
    const grew = rank > stats.companionRank;
    stats.companionRank = rank;
    const power = companionPower(rank);
    const bonuses = this.marketBonuses;
    stats.mysteryDamage = BALANCE.companion.mysteryDamage * bonuses.mysteryDamageMultiplier * power;
    stats.mysteryCooldownMs = Math.round(BALANCE.companion.mysteryCooldownMs / (1 + .03 * rank));
    stats.mysteryPounceRange = Math.round(BALANCE.companion.mysteryPounceRange * (1 + .02 * rank));
    if (stats.hasFrankieCompanion) stats.frankieCount = frankieBirdsForRank(rank);
    if (grew) this.companionGrewTo = rank;
  }

  private companionPrimed = false;
  /** Set when the companion just gained a rank, drained by the scene to announce it once. */
  private companionGrewTo = 0;
  consumeCompanionGrowth(): number {
    const rank = this.companionGrewTo;
    this.companionGrewTo = 0;
    return rank;
  }

  update(deltaMs: number): void {
    if (this.state !== 'Playing') {
      return;
    }

    this.elapsedMs += deltaMs;
    if (this.playerStats.heartRegen > 0 && deltaMs > 0) {
      this.heartRegenMs += deltaMs;
      const ticks = Math.floor(this.heartRegenMs / 5000);
      this.heartRegenMs %= 5000;
      this.playerStats.health = Math.min(this.playerStats.maxHealth,
        this.playerStats.health + ticks * this.playerStats.heartRegen);
    }
    if (this.marketBonuses.regenerationPerSecond > 0 && deltaMs > 0) {
      this.playerStats.health = Math.min(this.playerStats.maxHealth,
        this.playerStats.health + this.marketBonuses.regenerationPerSecond * deltaMs / 1000);
    }
    if (this.playerStats.abilityRanks['barkskin-ward'] > 0) this.wardWasUnlocked = true;
    const bark = this.bark;
    if (bark) {
      if (!this.barkGrown) { this.barkGrown = true; this.wardLeaves = bark.leaves; }
      if (this.wardLeaves < bark.leaves && this.elapsedMs >= this.nextLeafAt) {
        this.wardLeaves++;
        this.nextLeafAt = this.elapsedMs + ABILITIES.ward.rechargeMs[this.playerStats.abilityRanks['barkskin-ward']];
      }
    }
  }

  private barkGrown = false;
  /** Living Bark / Heartwood settings for the current ward rank, or undefined below the awakening. */
  get bark() {
    const t = awakeningTier(this.playerStats.abilityRanks['barkskin-ward']);
    return t >= 0 ? ABILITIES.ward.bark[t] : undefined;
  }

  /** True once per Living Bark collapse; the scene turns it into a knockback. */
  consumeBarkBurst(): boolean {
    const pending = this.barkBurstPending;
    this.barkBurstPending = false;
    return pending;
  }

  addKill(): void {
    this.kills += 1;
  }

  addXp(amount: number): boolean {
    if (this.state !== 'Playing') {
      return false;
    }

    this.xp += amount;
    if (this.xp < this.xpToNextLevel || this.bossGate.required(this.level)) {
      return false;
    }

    this.advanceLevel();
    return true;
  }

  private advanceLevel(): void {
    this.upgradeSource = 'level';
    this.xp -= this.xpToNextLevel;
    this.level += 1;
    this.playerStats.level = this.level;
    this.xpToNextLevel = xpThreshold(this.level);
    this.applyCompanionRank();
    this.state = 'LevelUpPaused';
  }

  /** Review pages and boss gates set the level directly; keep the companion in step with it. */
  syncCompanionToLevel(): void {
    this.playerStats.level = this.level;
    this.applyCompanionRank();
  }

  openChestUpgrade(source: 'chest' | 'boss' = 'chest'): boolean {
    if (this.state !== 'Playing') return false;
    this.upgradeSource = source;
    this.bossUpgradeAvailable = source === 'boss';
    this.state = 'LevelUpPaused';
    return true;
  }

  resumeAfterUpgrade(): void {
    if (this.state === 'LevelUpPaused') {
      this.state = 'Playing';
      this.upgradeSource = 'level';
      this.bossUpgradeAvailable = false;
      if (this.xp >= this.xpToNextLevel && !this.bossGate.required(this.level)) this.advanceLevel();
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
    const bark = this.bark;
    if (source === 'contact' && bark) {
      if (!this.barkGrown) { this.barkGrown = true; this.wardLeaves = bark.leaves; }
      if (this.elapsedMs < this.wardProtectedUntil) return;
      if (this.wardLeaves > 0) {
        if (this.wardLeaves === bark.leaves) this.nextLeafAt = this.elapsedMs + ABILITIES.ward.rechargeMs[this.playerStats.abilityRanks['barkskin-ward']];
        this.wardLeaves--;
        this.wardProtectedUntil = this.elapsedMs + ABILITIES.ward.protectionMs;
        if (this.wardLeaves === 0) this.barkBurstPending = true;
        return;
      }
    } else if (source === 'contact' && this.playerStats.abilityRanks['barkskin-ward'] > 0) {
      if (!this.wardWasUnlocked) { this.wardWasUnlocked = true; this.wardReadyAt = this.elapsedMs; }
      if (this.elapsedMs < this.wardProtectedUntil) return;
      if (this.elapsedMs >= this.wardReadyAt) {
        this.wardProtectedUntil = this.elapsedMs + ABILITIES.ward.protectionMs;
        this.wardReadyAt = this.elapsedMs + ABILITIES.ward.rechargeMs[this.playerStats.abilityRanks['barkskin-ward']];
        return;
      }
    }
    this.playerStats.health = Math.max(0, this.playerStats.health - amount * this.marketBonuses.damageTakenMultiplier);
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
    if (this.bark) return this.wardLeaves > 0 ? 'ready' : 'recharging';
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
