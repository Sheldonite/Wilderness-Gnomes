import { BOSS_ABILITY_IDS, bossPower } from '../config/bossAbilities';
import type { BossAbilityId, Vector2Like } from './types';
import type { CombatTarget, DealDamage } from './CombatResolver';
import type { GameManager } from './GameManager';
import { distanceSq } from '../utils/math';

export interface BossPowerEvent { kind: BossAbilityId; position: Vector2Like; radius: number; path: Vector2Like[] }

export class BossPowerSimulation {
  readonly events: BossPowerEvent[] = [];
  private elapsedMs = 0;
  private readonly readyAt: Record<BossAbilityId, number> = { crownfire: 0, stormcall: 0, 'phoenix-heart': 0 };

  update(deltaMs: number, game: GameManager, player: Vector2Like, enemies: CombatTarget[], damage: DealDamage): void {
    this.events.length = 0;
    if (game.state !== 'Playing') return;
    this.elapsedMs += deltaMs;
    for (const id of BOSS_ABILITY_IDS) {
      const rank = game.playerStats.bossAbilityRanks[id];
      if (!rank || this.elapsedMs < this.readyAt[id]) continue;
      const power = bossPower(id, rank);
      const nearby = enemies.filter(enemy => !enemy.isDead && distanceSq(player, enemy.position) <= (power.radius + enemy.radius) ** 2);
      const needsHealing = id === 'phoenix-heart' && game.playerStats.health < game.playerStats.maxHealth;
      if (!nearby.length && !needsHealing) continue;
      const path: Vector2Like[] = [{ ...player }];
      if (id === 'stormcall') {
        let origin = player;
        const hit = new Set<number>();
        for (let i = 0; i < power.targets; i++) {
          const target = enemies.filter(enemy => !enemy.isDead && !hit.has(enemy.id) && distanceSq(origin, enemy.position) <= (power.radius + enemy.radius) ** 2)
            .sort((a, b) => distanceSq(origin, a.position) - distanceSq(origin, b.position))[0];
          if (!target) break;
          hit.add(target.id); origin = { ...target.position }; path.push(origin); damage(target, power.damage);
        }
      } else {
        for (const enemy of nearby) damage(enemy, power.damage);
        game.playerStats.health = Math.min(game.playerStats.maxHealth, game.playerStats.health + power.heal);
      }
      this.readyAt[id] = this.elapsedMs + power.cooldownMs;
      this.events.push({ kind: id, position: { ...player }, radius: power.radius, path });
    }
  }
}
