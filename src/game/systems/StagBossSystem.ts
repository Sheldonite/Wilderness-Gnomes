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
/** Launch velvet antler shards from `origin` along each direction. */
export type FlingShards = (origin: Vector2Like, directions: Vector2Like[]) => void;

export class StagBossSystem {
  readonly encounter = new StagEncounter();
  boss?: StagBoss;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hud: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly caption: HTMLElement;
  private celebrationMs = 0;
  private shoutMs = 0;
  private shout = '';
  /** Age of the expanding roar ring after a bellow, or -1 when there is none. */
  private roarMs = -1;
  private roarAt: Vector2Like = { x: 0, y: 0 };
  private rutShown = false;

  constructor(private readonly scene: Phaser.Scene, private readonly game: GameManager, private readonly navigation: SceneryNavigation,
    private readonly hitPlayer: StagHit, private readonly callHerd: CallHerd = () => {},
    private readonly flingShards: FlingShards = () => {}) {
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
      this.announce('Wonky bellows for the herd! Watch the lanes!');
    }
    if (this.encounter.volley) this.flingShards(this.encounter.volley.origin, this.encounter.volley.directions);
    if (this.encounter.bellowed) {
      this.roarMs = 0; this.roarAt = { ...this.boss.position };
      this.scene.cameras.main.shake(260, .006);
      if (this.encounter.bellowHit) {
        this.game.slowPlayer(STAG.bellowSlowMs, STAG.bellowSlow);
        this.announce('Shaken by the roar! You are slowed!');
      }
    }
    if (this.encounter.rut && !this.rutShown) {
      this.rutShown = true;
      this.boss.setBaseTint(STAG.rutTint);
      this.announce('RUT! Wonky is in a frenzy!');
    }
    this.shoutMs = Math.max(0, this.shoutMs - deltaMs);
    const phase = this.encounter.phase;
    const feint = phase === 'windup' && this.encounter.lane?.feinted;
    const message = this.shoutMs ? this.shout
      : phase === 'arrival' ? 'Wonky, the lopsided old stag!'
      : feint ? 'A feint! The lane swung. Move!'
      : phase === 'windup' ? 'He lowers his crooked crown. Step out of the lane!'
      : phase === 'charging' ? 'CHARGE!' : phase === 'stunned' ? 'Antlers stuck in a tree! Hit him hard!'
      : phase === 'sweepWindup' ? 'Too close! He swings his antlers!'
      : phase === 'volleyWindup' ? 'He shakes his velvet. Shards incoming!'
      : phase === 'bellowWindup' ? 'He rears to bellow. Get clear of the ring!'
      : this.encounter.rut ? 'Frenzied: three charges at a time!'
      : this.encounter.enraged ? 'Enraged! Double charges, and some are feints.' : 'Keep moving. Lure him into a tree!';
    if (this.caption.textContent !== message) this.caption.textContent = message;
    this.fill.style.transform = `scaleX(${Math.max(0, fraction)})`;
    this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(this.boss.health))));
    const lane = this.encounter.lane;
    if (lane && (phase === 'windup' || phase === 'charging')) {
      const { from, direction, length } = lane;
      const nx = -direction.y, ny = direction.x, half = STAG.radius + 6;
      const end = { x: from.x + direction.x * length, y: from.y + direction.y * length };
      const alpha = phase === 'windup' ? .18 : .1;
      const fill = lane.feinted ? STAG_LOOK.feintColor : STAG_LOOK.laneColor, edge = lane.feinted ? STAG_LOOK.feintEdge : STAG_LOOK.laneEdge;
      this.graphics.fillStyle(fill, alpha).fillPoints([
        { x: from.x + nx * half, y: from.y + ny * half }, { x: end.x + nx * half, y: end.y + ny * half },
        { x: end.x - nx * half, y: end.y - ny * half }, { x: from.x - nx * half, y: from.y - ny * half }
      ], true);
      this.graphics.lineStyle(3, edge, .8).lineBetween(from.x + nx * half, from.y + ny * half, end.x + nx * half, end.y + ny * half)
        .lineBetween(from.x - nx * half, from.y - ny * half, end.x - nx * half, end.y - ny * half);
      this.graphics.lineStyle(2, fill, .9).strokeCircle(end.x, end.y, STAG.stompRadius * .35);
    }
    const aim = this.encounter.volleyAim;
    if (aim && phase === 'volleyWindup') {
      // The fan of shards he is about to fling.
      const origin = this.boss.position, base = Math.atan2(aim.y, aim.x);
      const count = this.encounter.rut ? STAG.rutVolleyShards : STAG.volleyShards;
      for (let i = 0; i < count; i++) {
        const a = base - STAG.volleySpread / 2 + i * STAG.volleySpread / Math.max(1, count - 1);
        this.graphics.lineStyle(3, STAG_LOOK.velvet, .55).lineBetween(origin.x, origin.y - 40, origin.x + Math.cos(a) * 320, origin.y - 40 + Math.sin(a) * 320);
      }
    }
    if (phase === 'bellowWindup') {
      const p = this.boss.position, pulse = (Math.sin(performance.now() / 90) + 1) / 2;
      this.graphics.fillStyle(0xfff0c0, .06 + pulse * .05).fillCircle(p.x, p.y, STAG.bellowRadius);
      this.graphics.lineStyle(3, 0xffe2a2, .6 + pulse * .3).strokeCircle(p.x, p.y, STAG.bellowRadius);
    }
    if (this.roarMs >= 0) {
      this.roarMs += deltaMs;
      const t = this.roarMs / 450;
      if (t >= 1) this.roarMs = -1;
      else for (const k of [1, .7, .4]) this.graphics.lineStyle(5, 0xfff4d0, (1 - t) * .8).strokeCircle(this.roarAt.x, this.roarAt.y, STAG.bellowRadius * t * k);
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

  private announce(text: string): void { this.shout = text; this.shoutMs = 2600; }

  defeated(): void {
    this.encounter.defeat(); this.celebrationMs = 3500; this.roarMs = -1;
    this.graphics.clear();
    this.fill.style.transform = 'scaleX(0)'; this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', '0');
    this.caption.textContent = 'Wonky kneels, crooked crown and all. The deep woods fall quiet.';
  }

  destroy(): void { this.encounter.defeat(); this.graphics.destroy(); this.hud.remove(); }
}
