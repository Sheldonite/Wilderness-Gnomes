import Phaser from 'phaser';
import { STAG, STAG_LOOK } from '../config/stagBoss';
import { StagEncounter, type StagHit } from '../core/StagEncounter';
import type { GameManager } from '../core/GameManager';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import type { EnemyController } from '../entities/EnemyController';
import { StagBoss } from '../entities/StagBoss';

export class StagBossSystem {
  readonly encounter = new StagEncounter();
  boss?: StagBoss;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hud: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly caption: HTMLElement;
  private celebrationMs = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly game: GameManager, private readonly navigation: SceneryNavigation,
    private readonly hitPlayer: StagHit) {
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
      this.boss = new StagBoss(this.scene, spawn, this.navigation, this.encounter); enemies.push(this.boss);
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
    this.encounter.update(deltaMs, this.boss.position, player, playerRadius, this.boss.health / STAG.health, this.hitPlayer);
    const phase = this.encounter.phase;
    const message = phase === 'arrival' ? 'The old stag of the deep woods!' : phase === 'windup' ? 'He lowers his crown. Step out of the lane!'
      : phase === 'charging' ? 'CHARGE!' : this.encounter.enraged ? 'Enraged! He charges twice now.' : 'Keep moving. Never stand in his line.';
    if (this.caption.textContent !== message) this.caption.textContent = message;
    this.fill.style.transform = `scaleX(${Math.max(0, this.boss.health / STAG.health)})`;
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
    for (const p of this.encounter.impacts) {
      this.scene.events.emit('presentation:level', p);
      this.scene.cameras.main.shake(180, .004);
    }
  }

  defeated(): void {
    this.encounter.defeat(); this.celebrationMs = 3500;
    this.graphics.clear();
    this.fill.style.transform = 'scaleX(0)'; this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', '0');
    this.caption.textContent = 'The old stag kneels. The deep woods fall quiet.';
  }

  destroy(): void { this.encounter.defeat(); this.graphics.destroy(); this.hud.remove(); }
}
