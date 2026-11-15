import { BALANCE } from '../config/balance';
import { ABILITIES, ABILITY_NAMES, awakeningTier, emptyAbilityRanks } from '../config/abilities';
import { BOSS_ABILITY_NAMES } from '../config/bossAbilities';
import { getWeapon } from '../config/weapons';
import { COMPANION_BY_CHARACTER, COMPANION_NAMES, companionRankForLevel, companionPower, frankieBirdsForRank } from '../config/companions';
import { CHARACTER_PASSIVES } from '../config/playerCharacters';
import type {
  AbilityId,
  BossAbilityId,
  DamageBreakdownEntry,
  DamageSourceId,
  GameRunState,
  HudSnapshot,
  PlayerCharacterId,
  PlayerStats,
  WeaponId,
  UpgradeSource
} from './types';
import { BossGate } from './BossGate';
import { createRunId, marketBonuses, type MarketProfile } from './MarketProgress';
import { WOODLAND_SHRINE_REWARD, type ShrineReward } from './RunEvents';

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
  /** Set once the final boss falls; the run may continue as an encore. */
  victorious = false;
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
  private slowUntil = 0;
  private slowFactor = 1;
  rerollsRemaining: number;
  bonusGold = 0;
  private shrineFrenzyRemainingMs = 0;
  private readonly damageBySource = new Map<DamageSourceId, number>();

  constructor(weaponId: WeaponId = 'spell', marketProfile?: MarketProfile, characterId: PlayerCharacterId = 'wizard') {
    const arm = getWeapon(weaponId);
    this.marketBonuses = marketBonuses(marketProfile);
    const bonuses = this.marketBonuses;
    const passive = CHARACTER_PASSIVES[characterId] ?? CHARACTER_PASSIVES.wizard;
    this.rerollsRemaining = 1 + ((bonuses as any).extraRerolls ?? 0) + passive.extraRerolls;
    const companionId = COMPANION_BY_CHARACTER[characterId] ?? COMPANION_BY_CHARACTER.wizard;
    this.playerStats = {
      level: 1,
      upgradeCounts: {},
      heartRegen: 0,
      abilityRanks: emptyAbilityRanks(),
      bossAbilityRanks: { crownfire: 0, stormcall: 0, 'phoenix-heart': 0 },
      weaponId: arm.id,
      maxHealth: BALANCE.player.maxHealth + bonuses.extraHealth + passive.extraHealth,
      health: BALANCE.player.maxHealth + bonuses.extraHealth + passive.extraHealth,
      speed: BALANCE.player.speed * bonuses.speedMultiplier * passive.speedMultiplier,
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
      shoutMoveSpeedBonus: 0,
      spellPowerMultiplier: passive.spellPowerMultiplier,
      abilityPowerMultiplier: passive.abilityPowerMultiplier,
      xpMagnetRangeMultiplier: passive.xpMagnetRangeMultiplier,
      shoutRemainingMs: 0,
      shrineAttackSpeedBonus: 0,
      shrineMoveSpeedBonus: 0
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
    this.playerStats.moveSlow = this.elapsedMs < this.slowUntil ? this.slowFactor : 1;
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
    if (this.shrineFrenzyRemainingMs > 0 && deltaMs > 0) {
      this.shrineFrenzyRemainingMs = Math.max(0, this.shrineFrenzyRemainingMs - deltaMs);
      if (this.shrineFrenzyRemainingMs <= 0) {
        this.playerStats.shrineAttackSpeedBonus = 0;
        this.playerStats.shrineMoveSpeedBonus = 0;
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

  /** Consumes one upgrade card reroll if any remain. */
  consumeReroll(): boolean {
    if (this.rerollsRemaining <= 0) return false;
    this.rerollsRemaining -= 1;
    return true;
  }

  /** Forgoes an upgrade pick in exchange for +15 health (capped at maxHealth) and +1 bonus gold. */
  skipUpgradeForBonus(): { healed: number; bonusGold: number } {
    if (this.state === 'GameOver') {
      return { healed: 0, bonusGold: this.bonusGold };
    }
    const before = this.playerStats.health;
    this.playerStats.health = Math.min(this.playerStats.maxHealth, this.playerStats.health + 15);
    this.bonusGold += 1;
    this.resumeAfterUpgrade();
    return { healed: this.playerStats.health - before, bonusGold: this.bonusGold };
  }

  /** Grants the choice-free Woodland Shrine blessing (+HP, frenzy, +bonus gold, XP burst). */
  grantShrineReward(reward: ShrineReward = WOODLAND_SHRINE_REWARD): void {
    if (this.state === 'GameOver') return;
    this.playerStats.health = Math.min(this.playerStats.maxHealth, this.playerStats.health + reward.heal);
    this.bonusGold += reward.bonusGold;
    this.shrineFrenzyRemainingMs = Math.max(this.shrineFrenzyRemainingMs, reward.frenzyMs);
    this.playerStats.shrineAttackSpeedBonus = reward.attackSpeedBonus;
    this.playerStats.shrineMoveSpeedBonus = reward.moveSpeedBonus;
    if (reward.xpBurst > 0) {
      this.addXp(reward.xpBurst);
    }
  }

  /** Records damage attributed to a weapon, companion, active ability, or boss relic. */
  recordDamage(source: DamageSourceId, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.damageBySource.set(source, (this.damageBySource.get(source) ?? 0) + amount);
  }

  /** Returns per-source run damage sorted descending for pause/game-over breakdowns. */
  getDamageBreakdown(): DamageBreakdownEntry[] {
    const labelFor = (source: DamageSourceId): string => {
      if (source === 'weapon') return getWeapon(this.playerStats.weaponId).name;
      if (source === 'companion') return COMPANION_NAMES[this.playerStats.companionId] ?? 'Companion';
      if (source in ABILITY_NAMES) return ABILITY_NAMES[source as AbilityId];
      if (source in BOSS_ABILITY_NAMES) return BOSS_ABILITY_NAMES[source as BossAbilityId];
      return source;
    };
    return Array.from(this.damageBySource.entries())
      .filter(([, dmg]) => dmg > 0)
      .map(([id, damage]) => ({ id, label: labelFor(id), damage }))
      .sort((a, b) => b.damage - a.damage);
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

  /** Hinder the player's movement to `factor` of normal for a while (the strongest current slow wins). */
  slowPlayer(ms: number, factor: number): void {
    if (this.elapsedMs >= this.slowUntil || factor <= this.slowFactor) this.slowFactor = factor;
    this.slowUntil = Math.max(this.slowUntil, this.elapsedMs + ms);
    this.playerStats.moveSlow = this.slowFactor;
  }

  get playerSlowed(): boolean { return this.elapsedMs < this.slowUntil; }

  /** End the run on the player's terms (after a victory). */
  finishRun(): void {
    if (this.state === 'Playing' || this.state === 'Paused') this.state = 'GameOver';
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
    const milestone = this.bossGate.nextBossMilestone(this.level);
    const wardMaxLeaves = this.bark?.leaves ?? (this.playerStats.abilityRanks['barkskin-ward'] > 0 ? 1 : 0);
    const wardStatus = this.wardStatus;
    const wardLeaves = this.bark ? this.wardLeaves : (wardStatus === 'ready' ? 1 : 0);
    return {
      health: this.playerStats.health,
      maxHealth: this.playerStats.maxHealth,
      xp: this.xp,
      xpToNextLevel: this.xpToNextLevel,
      level: this.level,
      elapsedSeconds: Math.floor(this.elapsedMs / 1000),
      kills: this.kills,
      rerollsRemaining: this.rerollsRemaining,
      bonusGold: this.bonusGold,
      wardStatus,
      wardLeaves,
      wardMaxLeaves,
      shoutRemainingMs: this.playerStats.shoutRemainingMs ?? 0,
      harvestBonus: this.playerStats.harvestBonus,
      nextBossLevel: milestone.level,
      nextBossName: milestone.name
    };
  }
}
