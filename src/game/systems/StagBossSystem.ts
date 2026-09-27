import Phaser from 'phaser';
import { STAG, STAG_LOOK } from '../config/stagBoss';
import { scaledBossHealth } from '../core/BossGate';
import { StagEncounter, type StagHit } from '../core/StagEncounter';
import type { GameManager } from '../core/GameManager';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import type { EnemyController } from '../entities/EnemyController';
import { StagBoss } from '../entities/StagBoss';

/** Wonky calls the herd: the scene runs `lanes` stampedes of `count` deer across the fight. */
export type CallHerd = (lanes: number, count: number) => void;

export class StagBossSystem {
  readonly encounter = new StagEncounter();
  boss?: StagBoss;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hud: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly caption: HTMLElement;
  private celebrationMs = 0;
  private shoutMs = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly game: GameManager, private readonly navigation: SceneryNavigation,
    private readonly hitPlayer: StagHit, private readonly callHerd: CallHerd = () => {}) {
    this.graphics = scene.add.graphics().setDepth(5);
    this.hud = document.createElement('section'); this.hud.className = 'boss-hud'; this.hud.hidden = true;
    this.hud.setAttribute('aria-label', STAG.name);
    this.hud.innerHTML = `<div><strong>${STAG.name}</strong><span class="boss-caption" aria-live="polite"></span></div><div class="boss-track" role="progressbar" aria-label="Boss health" aria-valuemin="0" aria-valuemax="${STAG.health}"><i></i></div>`;
    document.getElementById('ui-root')!.append(this.hud);
    this.fill = this.hud.querySelector('i')!; this.caption = this.hud.querySelector('.boss-caption')!;
  }

  update(deltaMs: number, player: Vector2Like, playerRadius: number, enemies: EnemyController[]): void {
    if (this.game.bossGate.required(this.game.level) === 'stag' && this.encounter.shouldSpawn(this.game.level)) {
      let spawn = this.navigation.nearest({ x: player.x - STAG.spawnDistance, y: player.y }, STAG.radius);
      for (let i = 0; i < 16; i++) {
        const angle = Math.PI + i * Math.PI / 8;
        const candidate = { x: player.x + Math.cos(angle) * STAG.spawnDistance, y: player.y + Math.sin(angle) * STAG.spawnDistance };
        if (this.navigation.clear(player, candidate, STAG.radius)) { spawn = candidate; break; }
      }
      const health = scaledBossHealth(STAG.health, STAG.healthPerMinute, this.game.getDifficultyMinutes());
      this.boss = new StagBoss(this.scene, spawn, this.navigation, this.encounter, health); enemies.push(this.boss);
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
    this.boss.blockedPlayerRadius = playerRadius; this.boss.blockedHit = this.hitPlayer;
    const fraction = this.boss.health / this.boss.maxHealth;
    this.encounter.update(deltaMs, this.boss.position, player, playerRadius, fraction, this.hitPlayer);
    if (this.encounter.pendingStampedes) {
      this.callHerd(STAG.stampedeLanes * this.encounter.pendingStampedes, STAG.stampedeCount);
      this.encounter.pendingStampedes = 0;
      this.shoutMs = 2600;
    }
    this.shoutMs = Math.max(0, this.shoutMs - deltaMs);
    const phase = this.encounter.phase;
    const message = this.shoutMs ? 'Wonky bellows for the herd! Watch the lanes!'
      : phase === 'arrival' ? 'Wonky, the lopsided old stag!' : phase === 'windup' ? 'He lowers his crooked crown. Step out of the lane!'
      : phase === 'charging' ? 'CHARGE!' : phase === 'stunned' ? 'Antlers stuck in a tree! Hit him hard!'
      : phase === 'sweepWindup' ? 'Too close! He swings his antlers!'
      : this.encounter.enraged ? 'Enraged! He charges twice, and leads the second.' : 'Keep moving. Lure him into a tree!';
    if (this.caption.textContent !== message) this.caption.textContent = message;
    this.fill.style.transform = `scaleX(${Math.max(0, fraction)})`;
    this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(this.boss.health))));
    const lane = this.encounter.lane;
    if (lane && (phase === 'windup' || phase === 'charging')) {
      const { from, direction, length } = lane;
      const nx = -direction.y, ny = direction.x, half = STAG.radius + 6;
      const end = { x: from.x + direction.x * length, y: from.y + direction.y * length };
      const alpha = phase === 'windup' ? .18 : .1;
      this.graphics.fillStyle(STAG_LOOK.laneColor, alpha).fillPoints([
        { x: from.x + nx * half, y: from.y + ny * half }, { x: end.x + nx * half, y: end.y + ny * half },
        { x: end.x - nx * half, y: end.y - ny * half }, { x: from.x - nx * half, y: from.y - ny * half }
      ], true);
      this.graphics.lineStyle(3, STAG_LOOK.laneEdge, .8).lineBetween(from.x + nx * half, from.y + ny * half, end.x + nx * half, end.y + ny * half)
        .lineBetween(from.x - nx * half, from.y - ny * half, end.x - nx * half, end.y - ny * half);
      this.graphics.lineStyle(2, STAG_LOOK.laneColor, .9).strokeCircle(end.x, end.y, STAG.stompRadius * .35);
    }
    const sweep = this.encounter.sweep;
    if (sweep && phase === 'sweepWindup') {
      const base = Math.atan2(sweep.direction.y, sweep.direction.x);
      const points: Vector2Like[] = [sweep.origin];
      for (let i = 0; i <= 16; i++) {
        const a = base - Math.PI / 2 + i * Math.PI / 16;
        points.push({ x: sweep.origin.x + Math.cos(a) * sweep.range, y: sweep.origin.y + Math.sin(a) * sweep.range });
      }
      this.graphics.fillStyle(STAG_LOOK.laneColor, .2).fillPoints(points, true);
      this.graphics.lineStyle(3, STAG_LOOK.laneEdge, .85).strokePoints(points, true);
    }
    if (phase === 'stunned') {
      // Little stars circling his head.
      const head = { x: this.boss.position.x, y: this.boss.position.y - STAG_LOOK.height * .8 };
      for (let i = 0; i < 3; i++) {
        const a = performance.now() / 260 + i * Math.PI * 2 / 3;
        this.graphics.fillStyle(0xfff1a6, .95).fillCircle(head.x + Math.cos(a) * 28, head.y + Math.sin(a) * 9, 5);
      }
    }
    if (this.encounter.swept) { this.scene.events.emit('presentation:level', this.boss.position); this.scene.cameras.main.shake(120, .003); }
    for (const p of this.encounter.impacts) {
      this.scene.events.emit('presentation:level', p);
      this.scene.cameras.main.shake(180, .004);
    }
  }

  defeated(): void {
    this.encounter.defeat(); this.celebrationMs = 3500;
    this.graphics.clear();
    this.fill.style.transform = 'scaleX(0)'; this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', '0');
    this.caption.textContent = 'Wonky kneels, crooked crown and all. The deep woods fall quiet.';
  }

  destroy(): void { this.encounter.defeat(); this.graphics.destroy(); this.hud.remove(); }
}
