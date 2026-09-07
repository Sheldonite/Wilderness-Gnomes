import { BALANCE } from '../config/balance';
import { ABILITY_IDS, ABILITY_NAMES, ASCENSION_RANK, AWAKENING_RANK, MAX_ABILITY_RANK, describeAbility, rankUnlocked, tierName } from '../config/abilities';
import { CROSSBOW_STAT_UPGRADES } from '../config/weapons';
import { BOSS_ABILITY_IDS, BOSS_ABILITY_NAMES, MAX_BOSS_RANK, describeBossAbility, isBossAbility } from '../config/bossAbilities';
import type { GameManager } from '../core/GameManager';
import type { AbilityId, AbilityRank, PlayerStats, UpgradeDefinition } from '../core/types';

export class UpgradeSystem {
  constructor(private readonly random: () => number = Math.random) {}
  private readonly upgrades: UpgradeDefinition[] = [
    {
      id: 'gain-companion-midnight',
      title: 'Gain a Companion: Midnight',
      description: `Midnight joins you with devastating paw swats: ${BALANCE.companion.midnightDamage} damage to every foe in her forward arc, with a ${BALANCE.companion.midnightCooldownMs / 1000}s attack cooldown.`,
      category: 'A FAMILIAR FRIEND',
      isAvailable: (stats) => !stats.hasMidnightCompanion,
      apply: (stats) => { stats.hasMidnightCompanion = true; }
    },
    {
      id: 'projectile-damage',
      title: 'Sharper Spell',
      description: '+8 projectile damage',
      apply: (stats) => {
        stats.projectileDamage += 8;
      }
    },
    {
      id: 'fire-rate',
      title: 'Quicker Hex',
      description: 'Fire 15% faster',
      isAvailable: (stats) => stats.weaponCooldownMs > 160,
      apply: (stats) => {
        stats.weaponCooldownMs = Math.max(160, Math.floor(stats.weaponCooldownMs * 0.85));
      }
    },
    {
      id: 'move-speed',
      title: 'Restless Boots',
      description: '+24 movement speed',
      apply: (stats) => {
        stats.speed += 24;
      }
    },
    {
      id: 'max-health',
      title: 'Hardier Heart',
      description: '+20 max health and heal 20',
      apply: (stats) => {
        stats.maxHealth += 20;
        stats.health = Math.min(stats.maxHealth, stats.health + 20);
      }
    },
    {
      id: 'projectile-count',
      title: 'Split Charm',
      description: '+1 projectile per volley',
      apply: (stats) => {
        stats.projectileCount += 1;
      }
    },
    {
      id: 'gain-companion-mystery',
      title: 'Gain a Companion: Mystery',
      description: `Mystery joins you with powerful pounces: ${BALANCE.companion.mysteryDamage} damage per hit, with a ${BALANCE.companion.mysteryCooldownMs / 1000}s recovery between hunts.`,
      isAvailable: (stats) => !stats.hasMysteryCompanion,
      apply: (stats) => {
        stats.hasMysteryCompanion = true;
      }
    }
  ];

  getChoices(stats: PlayerStats): UpgradeDefinition[] {
    const pool = this.getAvailable(stats);
    const choices: UpgradeDefinition[] = [];
    const choose = (candidates: UpgradeDefinition[]) => {
      if (candidates.length) choices.push(candidates[Math.floor(this.random() * candidates.length)]);
    };
    choose(pool.filter(u => u.rank === 1 || u.id === 'gain-companion-mystery' || u.id === 'gain-companion-midnight'));
    choose(pool.filter(u => u.rank !== undefined && u.rank > 1));
    while (choices.length < BALANCE.leveling.choices) {
      const remaining = pool.filter(u => !choices.some(choice => choice.id === u.id));
      if (!remaining.length) break;
      choose(remaining);
    }
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return choices;
  }

  applyUpgrade(upgrade: UpgradeDefinition, stats: PlayerStats): void {
    if (isBossAbility(upgrade.id)) return;
    if (upgrade.rank !== undefined && stats.abilityRanks[upgrade.id as AbilityId] !== upgrade.rank - 1) return;
    if (upgrade.isAvailable && !upgrade.isAvailable(stats)) return;
    upgrade.apply(stats);
    stats.upgradeCounts[upgrade.id] = (stats.upgradeCounts[upgrade.id] ?? 0) + 1;
  }

  getAvailable(stats: PlayerStats): UpgradeDefinition[] {
    const abilities = ABILITY_IDS.filter(id => stats.abilityRanks[id] < MAX_ABILITY_RANK &&
      rankUnlocked(stats.abilityRanks[id] + 1, stats.level) &&
      (id !== 'mystery-double-pounce' || stats.hasMysteryCompanion)).map(id => {
      const rank = (stats.abilityRanks[id] + 1) as AbilityRank;
      const tier = rank === AWAKENING_RANK || rank === ASCENSION_RANK ? tierName(id, rank) : undefined;
      return {
        id, rank, title: tier ? `${ABILITY_NAMES[id]}: ${tier}` : ABILITY_NAMES[id],
        description: describeAbility(id, rank, stats.weaponId),
        category: rank === 1 ? 'NEW ABILITY' : rank === AWAKENING_RANK ? 'AWAKENING' : rank === ASCENSION_RANK ? 'ASCENSION' : `RANK ${rank} OF ${MAX_ABILITY_RANK}`,
        isAvailable: (s: PlayerStats) => s.abilityRanks[id] === rank - 1 && rankUnlocked(rank, s.level) && (id !== 'mystery-double-pounce' || s.hasMysteryCompanion),
        apply: (s: PlayerStats) => { s.abilityRanks[id] = rank; }
      };
    });
    return [...this.upgrades.filter(u => !u.isAvailable || u.isAvailable(stats)).map(u => this.flavor(u, stats)), ...abilities];
  }

  getBossChoices(stats: PlayerStats): UpgradeDefinition[] {
    return BOSS_ABILITY_IDS.filter(id => stats.bossAbilityRanks[id] < MAX_BOSS_RANK).map(id => {
      const rank = (stats.bossAbilityRanks[id] + 1) as AbilityRank;
      return { id, rank, title: BOSS_ABILITY_NAMES[id], category: 'BOSS RELIC',
        description: `${describeBossAbility(id, rank)} Only boss chests can upgrade this ability.`,
        isAvailable: (s: PlayerStats) => s.bossAbilityRanks[id] === rank - 1,
        apply: (s: PlayerStats) => { s.bossAbilityRanks[id] = rank; } };
    });
  }

  applyBossUpgrade(upgrade: UpgradeDefinition, game: GameManager): boolean {
    if (game.state !== 'LevelUpPaused' || game.upgradeSource !== 'boss' || !game.bossUpgradeAvailable || !isBossAbility(upgrade.id)) return false;
    const offer = this.getBossChoices(game.playerStats).find(choice => choice.id === upgrade.id && choice.rank === upgrade.rank);
    if (!offer) return false;
    offer.apply(game.playerStats);
    game.playerStats.upgradeCounts[offer.id] = (game.playerStats.upgradeCounts[offer.id] ?? 0) + 1;
    game.bossUpgradeAvailable = false;
    return true;
  }

  private flavor(upgrade: UpgradeDefinition, stats: PlayerStats): UpgradeDefinition {
    if (upgrade.id === 'gain-companion-mystery') return { ...upgrade,
      description: `Mystery joins you with powerful pounces: ${Number(stats.mysteryDamage.toFixed(2))} damage per hit, with a ${stats.mysteryCooldownMs / 1000}s recovery between hunts.` };
    if (stats.weaponId !== 'crossbow') return upgrade;
    const copy = CROSSBOW_STAT_UPGRADES[upgrade.id];
    return copy ? { ...upgrade, title: copy.title, description: copy.description } : upgrade;
  }

  getReviewChoices(): UpgradeDefinition[] {
    return this.upgrades.filter(upgrade => ['projectile-damage', 'move-speed', 'gain-companion-mystery'].includes(upgrade.id));
  }
}
