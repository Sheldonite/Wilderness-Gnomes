import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import type { PlayerStats, UpgradeDefinition } from '../core/types';

export class UpgradeSystem {
  private readonly upgrades: UpgradeDefinition[] = [
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
    }
  ];

  getChoices(): UpgradeDefinition[] {
    const pool = Phaser.Utils.Array.Shuffle([...this.upgrades]);
    return pool.slice(0, BALANCE.leveling.choices);
  }

  applyUpgrade(upgrade: UpgradeDefinition, stats: PlayerStats): void {
    upgrade.apply(stats);
  }
}
