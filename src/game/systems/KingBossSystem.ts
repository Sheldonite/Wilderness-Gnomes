import Phaser from 'phaser';
import { KING, KING_LOOK } from '../config/kingBoss';
import { scaledBossHealth } from '../core/BossSchedule';
import { KingEncounter, type GroundRipple, type KingHit, type KingRollLane } from '../core/KingEncounter';
import type { GameManager } from '../core/GameManager';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import type { EnemyController } from '../entities/EnemyController';
import { KingBoss } from '../entities/KingBoss';
import type { SummonAdds } from './BossSummons';

/** Launch shell shards from `origin` along each direction. */
export type FireShards = (origin: Vector2Like, directions: Vector2Like[]) => void;

export class KingBossSystem {
  encounter = new KingEncounter();
  boss?: KingBoss;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hud: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly caption: HTMLElement;
  private celebrationMs = 0;
  private shoutMs = 0;
  private lastPhase?: KingEncounter['phase'];

  constructor(private readonly scene: Phaser.Scene, private readonly game: GameManager, private readonly navigation: SceneryNavigation,
    private readonly hitPlayer: KingHit,
    private readonly fireShards: FireShards, private readonly summon: SummonAdds) {
    this.graphics = scene.add.graphics().setDepth(5);
    this.hud = document.createElement('section'); this.hud.className = 'boss-hud'; this.hud.hidden = true;
    this.hud.setAttribute('aria-label', KING.name);
    this.hud.innerHTML = `<div><strong>${KING.name}</strong><span class="boss-caption" aria-live="polite"></span></div><div class="boss-track" role="progressbar" aria-label="Boss health" aria-valuemin="0" aria-valuemax="${KING.health}"><i></i></div>`;
    document.getElementById('ui-root')!.append(this.hud);
    this.fill = this.hud.querySelector('i')!; this.caption = this.hud.querySelector('.boss-caption')!;
  }

  spawnEncounter(player: Vector2Like, enemies: EnemyController[], healthMultiplier = 1): void {
    if (this.boss && !this.boss.isDead && !this.encounter.defeated) return;
    this.encounter = new KingEncounter();
    this.celebrationMs = 0;
    this.shoutMs = 0;
    // Beside the player rather than above, where the boss bar would hide him.
    const spawn = { x: player.x + KING.spawnDistance, y: player.y };
    const health = Math.round(scaledBossHealth(KING.health, KING.healthPerMinute, this.game.getDifficultyMinutes()) * healthMultiplier);
    this.boss = new KingBoss(this.scene, spawn, this.navigation, this.encounter, health); enemies.push(this.boss);
    this.lastPhase = undefined;
    this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuemax', String(health));
    this.hud.hidden = false;
    this.scene.events.emit('audio:play', 'boss-spawn');
  }

  update(deltaMs: number, player: Vector2Like, playerRadius: number): void {
    this.graphics.clear();
    if (this.encounter.defeated) {
      this.celebrationMs = Math.max(0, this.celebrationMs - deltaMs);
      if (!this.celebrationMs) this.hud.hidden = true;
      return;
    }
    if (!this.boss || this.boss.isDead) return;
    const fraction = this.boss.health / this.boss.maxHealth;
    this.encounter.update(deltaMs, this.boss.position, player, playerRadius, fraction, this.hitPlayer);
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
      : phase === 'rolling' ? 'ROLLING! His trail shelters you from the shockwave.'
      : phase === 'turning' ? 'He digs in and turns. Watch the new lane!'
      : phase === 'dizzy' ? 'Dizzy! Strike now, and mind the shards!'
      : this.encounter.enraged ? 'Furious! More rolls, more shards.' : 'Keep your distance from the King.';
    if (this.caption.textContent !== message) this.caption.textContent = message;
    this.fill.style.transform = `scaleX(${Math.max(0, fraction)})`;
    this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(this.boss.health))));
    const lane = this.encounter.lane;
    for (const ripple of this.encounter.ripples) this.drawRipple(ripple);
    if (lane) this.drawLane(lane, phase === 'rolling' ? .1 : .2);
    if (phase === 'dizzy') {
      const head = { x: this.boss.position.x, y: this.boss.position.y - this.boss.sprite.displayHeight * .4 };
      for (let i = 0; i < 3; i++) {
        const a = performance.now() / 260 + i * Math.PI * 2 / 3;
        this.graphics.fillStyle(0xfff1a6, .95).fillCircle(head.x + Math.cos(a) * 30, head.y + Math.sin(a) * 10, 5);
      }
    }
    if (this.encounter.impact) {
      this.scene.events.emit('presentation:level', this.encounter.impact);
      this.scene.cameras.main.shake(140, .004);
      this.scene.events.emit('audio:play', 'boss-impact');
    }
    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
      if (phase === 'curling' || phase === 'turning') this.scene.events.emit('audio:play', 'boss-warn');
    }
  }

  /**
   * A ground ripple: a rolling ring of churned earth with a gap where it crosses the safe lane, and the
   * lane itself glowing green so the player knows where to stand.
   */
  private drawRipple(ripple: GroundRipple): void {
    const g = this.graphics, { origin, from, radius } = ripple;
    const fade = Math.max(0, 1 - radius / KING.rippleReach);
    const lane = Math.hypot(origin.x - from.x, origin.y - from.y);
    const back = Math.atan2(from.y - origin.y, from.x - origin.x);
    if (lane > 0) {
      const dir = { x: (from.x - origin.x) / lane, y: (from.y - origin.y) / lane }, nx = -dir.y, ny = dir.x, h = KING.rippleSafeHalfWidth;
      g.fillStyle(0x9be27a, .12 * fade + .04).fillPoints([
        { x: origin.x + nx * h, y: origin.y + ny * h }, { x: from.x + nx * h, y: from.y + ny * h },
        { x: from.x - nx * h, y: from.y - ny * h }, { x: origin.x - nx * h, y: origin.y - ny * h }], true);
      g.lineStyle(2, 0xc8f5a8, .5 * fade + .2).lineBetween(origin.x + nx * h, origin.y + ny * h, from.x + nx * h, from.y + ny * h)
        .lineBetween(origin.x - nx * h, origin.y - ny * h, from.x - nx * h, from.y - ny * h);
    }
    if (radius < 4) return;
    // leave a gap where the ring crosses the lane (only while the ring is within the lane's length)
    const gap = radius <= lane + KING.rippleSafeHalfWidth ? Math.asin(Math.min(1, KING.rippleSafeHalfWidth / radius)) : 0;
    const start = back + gap, end = back + Math.PI * 2 - gap;
    const ring = (r: number, width: number, colour: number, alpha: number) => {
      if (r > 2) g.lineStyle(width, colour, alpha).beginPath().arc(origin.x, origin.y, r, start, end).strokePath();
    };
    ring(radius, KING.rippleWidth, 0x6e4218, .7 * fade + .1);                 // the churned band of earth
    ring(radius + KING.rippleWidth / 2 - 3, 6, 0xffd57a, .95 * fade + .05);    // its bright leading edge
    ring(radius - KING.rippleWidth / 2 + 2, 3, 0x2e1a08, .6 * fade);           // dark trailing lip
    ring(radius - KING.rippleWidth * 1.6, 3, 0xffd57a, .35 * fade);             // a faint echo behind
  }

  /** The locked lane and the marked endpoint where the King will send out a ripple. */
  private drawLane({ from, direction, length }: KingRollLane, alpha: number): void {
    const half = KING.radius + 6, nx = -direction.y, ny = direction.x;
    const end = { x: from.x + direction.x * length, y: from.y + direction.y * length };
    this.graphics.fillStyle(KING_LOOK.laneColor, alpha).fillPoints([
      { x: from.x + nx * half, y: from.y + ny * half }, { x: end.x + nx * half, y: end.y + ny * half },
      { x: end.x - nx * half, y: end.y - ny * half }, { x: from.x - nx * half, y: from.y - ny * half }], true);
    this.graphics.lineStyle(3, KING_LOOK.laneEdge, alpha * 4)
      .lineBetween(from.x + nx * half, from.y + ny * half, end.x + nx * half, end.y + ny * half)
      .lineBetween(from.x - nx * half, from.y - ny * half, end.x - nx * half, end.y - ny * half);
    this.graphics.lineStyle(2, KING_LOOK.laneColor, alpha * 4).strokeCircle(end.x, end.y, half);
  }

  defeated(): void {
    this.encounter.defeat(); this.celebrationMs = 3500;
    this.graphics.clear();
    this.fill.style.transform = 'scaleX(0)'; this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', '0');
    this.caption.textContent = 'The King uncurls and bows. The woods are yours.';
  }

  destroy(): void { this.encounter.defeat(); this.graphics.destroy(); this.hud.remove(); }
}
