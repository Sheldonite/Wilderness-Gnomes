import Phaser from 'phaser';
import { BOSS_ABILITY_IDS, bossPower } from '../config/bossAbilities';
import { BossPowerSimulation, type BossPowerEvent } from '../core/BossPowerSimulation';
import { reducedMotion } from '../config/presentation';
import type { GameManager } from '../core/GameManager';
import type { BossAbilityId, Vector2Like } from '../core/types';
import type { CombatTarget, DealDamage } from '../core/CombatResolver';
import { distanceSq } from '../utils/math';

export class BossPowerSystem {
  readonly simulation = new BossPowerSimulation();
  private readonly graphics: Phaser.GameObjects.Graphics;
  private bursts: (BossPowerEvent & { age: number })[] = [];
  private shadowElapsedMs = 0;
  private readonly shadowReadyAt: Record<BossAbilityId, number> = { crownfire: 0, stormcall: 0, 'phoenix-heart': 0 };
  constructor(scene: Phaser.Scene) { this.graphics = scene.add.graphics().setDepth(23); }

  update(deltaMs: number, game: GameManager, player: Vector2Like, enemies: CombatTarget[], damage: DealDamage): void {
    if (game.state !== 'Playing') return;
    this.shadowElapsedMs += deltaMs;
    const candidates = BOSS_ABILITY_IDS.filter(
      id => game.playerStats.bossAbilityRanks[id] > 0 && this.shadowElapsedMs >= this.shadowReadyAt[id]
    );
    let cursor = 0;
    let currentHits = 0;
    const hitInAbility = new Set<number>();
    const attributedDamage: DealDamage = (target, amount) => {
      while (cursor < candidates.length) {
        const id = candidates[cursor];
        const power = bossPower(id, game.playerStats.bossAbilityRanks[id]);
        const inCrownRange = id !== 'crownfire'
          || distanceSq(player, target.position) <= (power.radius + target.radius + 1) ** 2;
        const limitReached = id === 'stormcall' && currentHits >= power.targets;
        if (amount === power.damage && !hitInAbility.has(target.id) && inCrownRange && !limitReached) {
          hitInAbility.add(target.id);
          currentHits += 1;
          damage(target, amount, id);
          return;
        }
        cursor += 1;
        currentHits = 0;
        hitInAbility.clear();
      }
      damage(target, amount);
    };

    this.simulation.update(deltaMs, game, player, enemies, attributedDamage);
    this.bursts = this.bursts.filter(burst => (burst.age += deltaMs) < 650);
    for (const event of this.simulation.events) {
      const rank = game.playerStats.bossAbilityRanks[event.kind];
      if (rank > 0) this.shadowReadyAt[event.kind] = this.shadowElapsedMs + bossPower(event.kind, rank).cooldownMs;
      this.bursts.push({ ...event, age: 0 });
    }
    const g = this.graphics.clear();
    for (const burst of this.bursts) {
      const fade = 1 - burst.age / 650;
      const color = burst.kind === 'stormcall' ? 0xaee9ff : burst.kind === 'crownfire' ? 0xff954d : 0xffc7e0;
      if (burst.kind === 'stormcall') {
        for (let i = 1; i < burst.path.length; i++) {
          const a = burst.path[i - 1], b = burst.path[i];
          const mx = (a.x + b.x) / 2 + 12, my = (a.y + b.y) / 2 - 12;
          g.lineStyle(8, color, fade * .22).lineBetween(a.x, a.y, b.x, b.y);
          g.lineStyle(3, color, fade).lineBetween(a.x, a.y, mx, my).lineBetween(mx, my, b.x, b.y);
          g.fillStyle(0xffffff, fade).fillCircle(b.x, b.y, 6);
        }
      } else {
        const radius = burst.radius * (reducedMotion() ? 1 : .25 + .75 * (1 - fade));
        const { x, y } = burst.position;
        g.fillStyle(color, fade * .08).fillCircle(x, y, radius);
        g.lineStyle(5, color, fade * .8).strokeCircle(x, y, radius);
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI / 6;
          const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius;
          g.fillStyle(color, fade).fillTriangle(px - 5, py, px, py - 18, px + 5, py);
        }
        if (burst.kind === 'phoenix-heart') g.lineStyle(5, 0xfff3bd, fade).lineBetween(x - 10, y - 25, x + 10, y - 25).lineBetween(x, y - 35, x, y - 15);
      }
    }
  }

  destroy(): void { this.graphics.destroy(); this.bursts = []; }
}
