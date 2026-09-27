import Phaser from 'phaser';
import { KING, KING_LOOK } from '../config/kingBoss';
import { scaledBossHealth } from '../core/BossGate';
import { KingEncounter, distanceToEdge, type KingArena, type KingHit } from '../core/KingEncounter';
import type { GameManager } from '../core/GameManager';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import type { EnemyController } from '../entities/EnemyController';
import { KingBoss } from '../entities/KingBoss';
import type { SummonAdds } from './BossSummons';

/** Launch shell shards from `origin` along each direction. */
export type FireShards = (origin: Vector2Like, directions: Vector2Like[]) => void;

export class KingBossSystem {
  readonly encounter = new KingEncounter();
  boss?: KingBoss;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hud: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly caption: HTMLElement;
  private celebrationMs = 0;
  private shoutMs = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly game: GameManager, private readonly navigation: SceneryNavigation,
    private readonly arena: () => KingArena | undefined, private readonly hitPlayer: KingHit,
    private readonly fireShards: FireShards, private readonly summon: SummonAdds) {
    this.graphics = scene.add.graphics().setDepth(5);
    this.hud = document.createElement('section'); this.hud.className = 'boss-hud'; this.hud.hidden = true;
    this.hud.setAttribute('aria-label', KING.name);
    this.hud.innerHTML = `<div><strong>${KING.name}</strong><span class="boss-caption" aria-live="polite"></span></div><div class="boss-track" role="progressbar" aria-label="Boss health" aria-valuemin="0" aria-valuemax="${KING.health}"><i></i></div>`;
    document.getElementById('ui-root')!.append(this.hud);
    this.fill = this.hud.querySelector('i')!; this.caption = this.hud.querySelector('.boss-caption')!;
  }

  update(deltaMs: number, player: Vector2Like, playerRadius: number, enemies: EnemyController[]): void {
    if (this.game.bossGate.required(this.game.level) === 'king' && this.encounter.shouldSpawn(this.game.level)) {
      // Beside the player rather than above, where the boss bar would hide him.
      let spawn = this.navigation.nearest({ x: player.x + KING.spawnDistance, y: player.y }, KING.radius);
      const e = Math.PI / 8;
      for (const angle of [0, Math.PI, e, -e, Math.PI - e, e - Math.PI, 2 * e, -2 * e, Math.PI - 2 * e, 2 * e - Math.PI, 4 * e, -4 * e]) {
        const candidate = { x: player.x + Math.cos(angle) * KING.spawnDistance, y: player.y + Math.sin(angle) * KING.spawnDistance };
        if (this.navigation.clear(player, candidate, KING.radius)) { spawn = candidate; break; }
      }
      const health = scaledBossHealth(KING.health, KING.healthPerMinute, this.game.getDifficultyMinutes());
      this.boss = new KingBoss(this.scene, spawn, this.navigation, this.encounter, health); enemies.push(this.boss);
      this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuemax', String(health));
      this.hud.hidden = false;
    }
    this.graphics.clear();
    if (this.encounter.defeated) {
      this.celebrationMs = Math.max(0, this.celebrationMs - deltaMs);
      if (!this.celebrationMs) this.hud.hidden = true;
      return;
    }
    if (!this.boss || this.boss.isDead) return;
    const arena = this.arena() ?? { center: { ...player }, radius: 520 };
    const fraction = this.boss.health / this.boss.maxHealth;
    this.encounter.update(deltaMs, this.boss.position, player, playerRadius, fraction, arena, this.hitPlayer);
    if (this.encounter.pendingAdds) {
      this.summon('armadillo', this.encounter.pendingAdds);
      this.encounter.pendingAdds = 0;
      this.shoutMs = 2600;
    }
    if (this.encounter.shards) this.fireShards(this.encounter.shards.origin, this.encounter.shards.directions);
    this.shoutMs = Math.max(0, this.shoutMs - deltaMs);
    const phase = this.encounter.phase;
    const message = this.shoutMs ? 'The royal guard rolls in!'
      : phase === 'arrival' ? 'All hail King Rumbles!' : phase === 'curling' ? 'He curls up. Get out of his line!'
      : phase === 'rolling' ? 'ROLLING! He bounces off the walls!' : phase === 'dizzy' ? 'Dizzy! Strike now, and mind the shards!'
      : this.encounter.enraged ? 'Furious! More bounces, more shards.' : 'Keep your distance from the King.';
    if (this.caption.textContent !== message) this.caption.textContent = message;
    this.fill.style.transform = `scaleX(${Math.max(0, fraction)})`;
    this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(this.boss.health))));
    if (phase === 'curling') this.drawLane(this.boss.position, this.encounter.direction, arena);
    if (phase === 'dizzy') {
      const head = { x: this.boss.position.x, y: this.boss.position.y - this.boss.sprite.displayHeight * .4 };
      for (let i = 0; i < 3; i++) {
        const a = performance.now() / 260 + i * Math.PI * 2 / 3;
        this.graphics.fillStyle(0xfff1a6, .95).fillCircle(head.x + Math.cos(a) * 30, head.y + Math.sin(a) * 10, 5);
      }
    }
    for (const p of this.encounter.bounces) {
      this.scene.events.emit('presentation:level', p);
      this.scene.cameras.main.shake(140, .004);
    }
  }

  /** The locked first leg, and a fainter guess at the first ricochet. */
  private drawLane(from: Vector2Like, direction: Vector2Like, arena: KingArena): void {
    const limit = arena.radius - KING.radius, half = KING.radius;
    const leg = (a: Vector2Like, d: Vector2Like, alpha: number) => {
      const length = distanceToEdge(a, d, arena.center, limit);
      const b = { x: a.x + d.x * length, y: a.y + d.y * length };
      const nx = -d.y, ny = d.x;
      this.graphics.fillStyle(KING_LOOK.laneColor, alpha).fillPoints([
        { x: a.x + nx * half, y: a.y + ny * half }, { x: b.x + nx * half, y: b.y + ny * half },
        { x: b.x - nx * half, y: b.y - ny * half }, { x: a.x - nx * half, y: a.y - ny * half }], true);
      this.graphics.lineStyle(3, KING_LOOK.laneEdge, alpha * 4).lineBetween(a.x + nx * half, a.y + ny * half, b.x + nx * half, b.y + ny * half)
        .lineBetween(a.x - nx * half, a.y - ny * half, b.x - nx * half, b.y - ny * half);
      return b;
    };
    const end = leg(from, direction, .2);
    const n = { x: (end.x - arena.center.x) / limit, y: (end.y - arena.center.y) / limit };
    const dot = direction.x * n.x + direction.y * n.y;
    const len = Math.hypot(direction.x - 2 * dot * n.x, direction.y - 2 * dot * n.y) || 1;
    leg(end, { x: (direction.x - 2 * dot * n.x) / len, y: (direction.y - 2 * dot * n.y) / len }, .07);
  }

  defeated(): void {
    this.encounter.defeat(); this.celebrationMs = 3500;
    this.graphics.clear();
    this.fill.style.transform = 'scaleX(0)'; this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', '0');
    this.caption.textContent = 'The King uncurls and bows. The woods are yours.';
  }

  destroy(): void { this.encounter.defeat(); this.graphics.destroy(); this.hud.remove(); }
}
