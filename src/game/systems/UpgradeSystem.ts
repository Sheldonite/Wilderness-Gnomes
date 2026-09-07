import { BALANCE } from '../config/balance';
import { ABILITY_IDS, ABILITY_NAMES, describeAbility } from '../config/abilities';
import { CROSSBOW_STAT_UPGRADES } from '../config/weapons';
import type { AbilityId, AbilityRank, PlayerStats, UpgradeDefinition } from '../core/types';

export class UpgradeSystem {
  constructor(private readonly random: () => number = Math.random) {}
  private readonly upgrades: UpgradeDefinition[] = [
    {
      id: 'gain-companion-midnight',
      title: 'Gain a Companion: Midnight',
      description: 'Midnight joins you, walks up to nearby foes and swats them with her paw.',
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
      description: 'Mystery joins you and pounces at nearby enemies.',
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
    if (upgrade.rank !== undefined && stats.abilityRanks[upgrade.id as AbilityId] !== upgrade.rank - 1) return;
    if (upgrade.isAvailable && !upgrade.isAvailable(stats)) return;
    upgrade.apply(stats);
  }

  getAvailable(stats: PlayerStats): UpgradeDefinition[] {
    const abilities = ABILITY_IDS.filter(id => stats.abilityRanks[id] < 3 &&
      (id !== 'mystery-double-pounce' || stats.hasMysteryCompanion)).map(id => {
      const rank = (stats.abilityRanks[id] + 1) as AbilityRank;
      return {
        id, rank, title: ABILITY_NAMES[id], description: describeAbility(id, rank, stats.weaponId),
        category: rank === 1 ? 'NEW ABILITY' : `RANK ${rank} OF 3`,
        isAvailable: (s: PlayerStats) => s.abilityRanks[id] === rank - 1 && (id !== 'mystery-double-pounce' || s.hasMysteryCompanion),
        apply: (s: PlayerStats) => { s.abilityRanks[id] = rank; }
      };
    });
    return [...this.upgrades.filter(u => !u.isAvailable || u.isAvailable(stats)).map(u => this.flavor(u, stats)), ...abilities];
  }

  private flavor(upgrade: UpgradeDefinition, stats: PlayerStats): UpgradeDefinition {
    if (stats.weaponId !== 'crossbow') return upgrade;
    const copy = CROSSBOW_STAT_UPGRADES[upgrade.id];
    return copy ? { ...upgrade, title: copy.title, description: copy.description } : upgrade;
  }

  getReviewChoices(): UpgradeDefinition[] {
    return this.upgrades.filter(upgrade => ['projectile-damage', 'move-speed', 'gain-companion-mystery'].includes(upgrade.id));
  }
}
