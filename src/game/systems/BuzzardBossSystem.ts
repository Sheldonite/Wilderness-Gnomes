import Phaser from 'phaser';
import { BUZZARD, BUZZARD_LOOK } from '../config/buzzardBoss';
import { scaledBossHealth } from '../core/BossGate';
import { BuzzardEncounter, type BuzzardHit } from '../core/BuzzardEncounter';
import type { KingArena } from '../core/KingEncounter';
import type { GameManager } from '../core/GameManager';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import type { EnemyController } from '../entities/EnemyController';
import { BuzzardBoss } from '../entities/BuzzardBoss';

/** Launch feathers from `origin` along each direction. */
export type FlingFeathers = (origin: Vector2Like, directions: Vector2Like[]) => void;

export class BuzzardBossSystem {
  readonly encounter = new BuzzardEncounter();
  boss?: BuzzardBoss;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hud: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly caption: HTMLElement;
  private celebrationMs = 0;
  private gustMs = -1;
  private gustCone?: { origin: Vector2Like; direction: Vector2Like };

  constructor(private readonly scene: Phaser.Scene, private readonly game: GameManager, private readonly navigation: SceneryNavigation,
    private readonly arena: () => KingArena | undefined, private readonly hitPlayer: BuzzardHit, private readonly flingFeathers: FlingFeathers) {
    this.graphics = scene.add.graphics().setDepth(5);
    this.hud = document.createElement('section'); this.hud.className = 'boss-hud'; this.hud.hidden = true;
    this.hud.setAttribute('aria-label', BUZZARD.name);
    this.hud.innerHTML = `<div><strong>${BUZZARD.name}</strong><span class="boss-caption" aria-live="polite"></span></div><div class="boss-track" role="progressbar" aria-label="Boss health" aria-valuemin="0" aria-valuemax="${BUZZARD.health}"><i></i></div>`;
    document.getElementById('ui-root')!.append(this.hud);
    this.fill = this.hud.querySelector('i')!; this.caption = this.hud.querySelector('.boss-caption')!;
  }

  update(deltaMs: number, player: Vector2Like, playerRadius: number, enemies: EnemyController[]): void {
    if (this.game.bossGate.required(this.game.level) === 'buzzard' && this.encounter.shouldSpawn(this.game.level)) {
      // He swoops in from off to one side; flying, he needs no clear path.
      const spawn = { x: player.x - BUZZARD.spawnDistance, y: player.y - 60 };
      const health = scaledBossHealth(BUZZARD.health, BUZZARD.healthPerMinute, this.game.getDifficultyMinutes());
      this.boss = new BuzzardBoss(this.scene, spawn, this.navigation, this.encounter, health); enemies.push(this.boss);
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
    if (this.encounter.volley) this.flingFeathers(this.encounter.volley.origin, this.encounter.volley.directions);
    const phase = this.encounter.phase;
    const message = phase === 'arrival' ? 'King Frankie circles overhead...'
      : phase === 'diveWindup' ? 'His shadow marks the dive. Get clear!'
      : phase === 'diving' ? 'DIVE!' : phase === 'perched' ? 'He has landed! Strike while he rests!'
      : phase === 'volleyWindup' ? 'He rattles his feathers. Volley incoming!'
      : phase === 'gustWindup' ? 'He beats his wings. Get out of the gust!'
      : this.encounter.enraged ? 'Furious! Double dives, and he rests less.' : 'High in the air, hard to hurt. Wait for his dive.';
    if (this.caption.textContent !== message) this.caption.textContent = message;
    this.fill.style.transform = `scaleX(${Math.max(0, fraction)})`;
    this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(this.boss.health))));
    this.draw(phase, deltaMs);
  }

  private draw(phase: BuzzardEncounter['phase'], deltaMs: number): void {
    const g = this.graphics, lane = this.encounter.lane;
    if (lane && (phase === 'diveWindup' || phase === 'diving')) {
      // The dive's shadow lane, darkening as it comes.
      const { from, direction, length } = lane, half = BUZZARD.radius + 6;
      const nx = -direction.y, ny = direction.x;
      const end = { x: from.x + direction.x * length, y: from.y + direction.y * length };
      g.fillStyle(BUZZARD_LOOK.laneColor, phase === 'diveWindup' ? .26 : .14).fillPoints([
        { x: from.x + nx * half, y: from.y + ny * half }, { x: end.x + nx * half, y: end.y + ny * half },
        { x: end.x - nx * half, y: end.y - ny * half }, { x: from.x - nx * half, y: from.y - ny * half }], true);
      g.lineStyle(3, BUZZARD_LOOK.laneEdge, .75).lineBetween(from.x + nx * half, from.y + ny * half, end.x + nx * half, end.y + ny * half)
        .lineBetween(from.x - nx * half, from.y - ny * half, end.x - nx * half, end.y - ny * half);
    }
    const aim = this.encounter.volleyAim;
    if (aim && phase === 'volleyWindup') {
      const o = this.boss!.position, base = Math.atan2(aim.y, aim.x);
      const count = this.encounter.enraged ? BUZZARD.enragedVolleyFeathers : BUZZARD.volleyFeathers;
      for (let i = 0; i < count; i++) {
        const a = base - BUZZARD.volleySpread / 2 + i * BUZZARD.volleySpread / Math.max(1, count - 1);
        g.lineStyle(2, BUZZARD_LOOK.feather, .6).lineBetween(o.x, o.y, o.x + Math.cos(a) * 340, o.y + Math.sin(a) * 340);
      }
    }
    const gust = this.encounter.gust;
    if (gust && phase === 'gustWindup') this.drawCone(gust.origin, gust.direction, .16, .7);
    if (this.encounter.blown) {
      this.gustMs = 0; this.gustCone = this.encounter.blown;
      this.scene.cameras.main.shake(160, .004);
    }
    if (this.gustMs >= 0 && this.gustCone) {
      this.gustMs += deltaMs;
      const t = this.gustMs / 380;
      if (t >= 1) this.gustMs = -1;
      else this.drawCone(this.gustCone.origin, this.gustCone.direction, .35 * (1 - t), .9 * (1 - t));
    }
    if (phase === 'perched' && this.boss) {
      const p = this.boss.position;
      for (let i = 0; i < 3; i++) {
        const a = performance.now() / 260 + i * Math.PI * 2 / 3;
        g.fillStyle(0xfff1a6, .9).fillCircle(p.x + Math.cos(a) * 30, p.y - 40 + Math.sin(a) * 9, 4);
      }
    }
  }

  private drawCone(origin: Vector2Like, direction: Vector2Like, fill: number, edge: number): void {
    const base = Math.atan2(direction.y, direction.x), points: Vector2Like[] = [origin];
    for (let i = 0; i <= 12; i++) {
      const a = base - BUZZARD.gustHalfAngle + i * BUZZARD.gustHalfAngle * 2 / 12;
      points.push({ x: origin.x + Math.cos(a) * BUZZARD.gustRange, y: origin.y + Math.sin(a) * BUZZARD.gustRange });
    }
    this.graphics.fillStyle(BUZZARD_LOOK.gustColor, fill).fillPoints(points, true);
    this.graphics.lineStyle(3, BUZZARD_LOOK.gustColor, edge).strokePoints(points, true);
  }

  defeated(): void {
    this.encounter.defeat(); this.celebrationMs = 3500; this.gustMs = -1;
    this.graphics.clear();
    this.fill.style.transform = 'scaleX(0)'; this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', '0');
    this.caption.textContent = 'King Frankie settles on a branch and folds his wings.';
  }

  destroy(): void { this.encounter.defeat(); this.graphics.destroy(); this.hud.remove(); }
}
