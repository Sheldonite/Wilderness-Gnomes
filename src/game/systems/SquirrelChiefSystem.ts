import Phaser from 'phaser';
import { SQUIRREL_CHIEF, SQUIRREL_CHIEF_LOOK } from '../config/squirrelChief';
import { scaledBossHealth } from '../core/BossGate';
import type { GameManager } from '../core/GameManager';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import {
  SquirrelChiefEncounter,
  type ChiefHit,
  type SquirrelChiefPhase
} from '../core/SquirrelChiefEncounter';
import type { Vector2Like } from '../core/types';
import type { EnemyController } from '../entities/EnemyController';
import { SquirrelChiefBoss } from '../entities/SquirrelChiefBoss';

/** Launch acorn projectiles from `origin` along each normalized direction at `speed`. */
export type FlingChiefAcorns = (origin: Vector2Like, directions: Vector2Like[], speed: number) => void;

export class SquirrelChiefSystem {
  encounter = new SquirrelChiefEncounter();
  boss?: SquirrelChiefBoss;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hud: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly caption: HTMLElement;
  private celebrationMs = 0;
  private lastPhase?: SquirrelChiefPhase;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly game: GameManager,
    private readonly navigation: SceneryNavigation | undefined,
    private readonly hitPlayer: ChiefHit,
    private readonly flingAcorns: FlingChiefAcorns = () => {}
  ) {
    this.graphics = scene.add.graphics().setDepth(5);
    this.hud = document.createElement('section');
    this.hud.className = 'boss-hud';
    this.hud.hidden = true;
    this.hud.setAttribute('aria-label', SQUIRREL_CHIEF.name);
    this.hud.innerHTML =
      `<div><strong>${SQUIRREL_CHIEF.name}</strong><span class="boss-caption" aria-live="polite"></span></div>` +
      `<div class="boss-track" role="progressbar" aria-label="Boss health" aria-valuemin="0" aria-valuemax="${SQUIRREL_CHIEF.health}"><i></i></div>`;
    document.getElementById('ui-root')?.append(this.hud);
    this.fill = this.hud.querySelector('i')!;
    this.caption = this.hud.querySelector('.boss-caption')!;
  }

  private spawnBoss(player: Vector2Like, enemies: EnemyController[]): void {
    let spawn = this.navigation?.nearest({ x: player.x - SQUIRREL_CHIEF.spawnDistance, y: player.y }, SQUIRREL_CHIEF.radius) ?? {
      x: player.x - SQUIRREL_CHIEF.spawnDistance,
      y: player.y
    };
    if (this.navigation) {
      for (let i = 0; i < 16; i++) {
        const angle = Math.PI + (i * Math.PI) / 8;
        const candidate = {
          x: player.x + Math.cos(angle) * SQUIRREL_CHIEF.spawnDistance,
          y: player.y + Math.sin(angle) * SQUIRREL_CHIEF.spawnDistance
        };
        if (this.navigation.clear(player, candidate, SQUIRREL_CHIEF.radius)) {
          spawn = candidate;
          break;
        }
      }
    }
    const health = Math.round(
      scaledBossHealth(SQUIRREL_CHIEF.health, SQUIRREL_CHIEF.healthPerMinute, this.game.getDifficultyMinutes())
    );
    this.boss = new SquirrelChiefBoss(this.scene, spawn, this.navigation, this.encounter, health);
    enemies.push(this.boss);
    this.lastPhase = undefined;
    this.hud.querySelector('[role="progressbar"]')?.setAttribute('aria-valuemax', String(health));
    this.hud.hidden = false;
    this.scene.events.emit('audio:play', 'boss-spawn');
  }

  update(deltaMs: number, player: Vector2Like, playerRadius: number, enemies: EnemyController[]): void {
    if (this.encounter.shouldSpawn(this.game.level)) {
      this.spawnBoss(player, enemies);
    }
    this.graphics.clear();
    if (this.encounter.defeated) {
      this.celebrationMs = Math.max(0, this.celebrationMs - deltaMs);
      if (!this.celebrationMs) this.hud.hidden = true;
      return;
    }
    if (!this.boss || this.boss.isDead) return;

    const fraction = this.boss.health / this.boss.maxHealth;
    this.encounter.update(deltaMs, this.boss.position, player, playerRadius, this.hitPlayer);

    if (this.encounter.barrage) {
      this.flingAcorns(
        this.encounter.barrage.origin,
        this.encounter.barrage.directions,
        this.encounter.barrage.speed
      );
    }

    const phase = this.encounter.phase;
    if (phase !== this.lastPhase) {
      const prev = this.lastPhase;
      this.lastPhase = phase;
      if (phase === 'chargeWindup' || phase === 'barrageWindup') {
        this.scene.events.emit('audio:play', 'boss-warn');
      } else if (prev === 'charging' && phase !== 'charging') {
        this.scene.events.emit('audio:play', 'boss-impact');
      }
    }

    const message =
      phase === 'arrival'
        ? 'The Squirrel Chief rallies his warband!'
        : phase === 'chargeWindup'
          ? 'He crouches to lunge. Step out of the lane!'
          : phase === 'charging'
            ? 'CHIEF CHARGE!'
            : phase === 'barrageWindup'
              ? 'He hoists a fistful of acorns. Spread out!'
              : phase === 'catchBreath'
                ? 'Catching his breath! Strike now (1.3x damage)!'
                : 'Watch his windups and punish after his lunge.';
    if (this.caption.textContent !== message) this.caption.textContent = message;
    this.fill.style.transform = `scaleX(${Math.max(0, fraction)})`;
    this.hud
      .querySelector('[role="progressbar"]')
      ?.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(this.boss.health))));

    this.draw(phase);
  }

  private draw(phase: SquirrelChiefPhase): void {
    const lane = this.encounter.lane;
    if (lane && (phase === 'chargeWindup' || phase === 'charging')) {
      const { from, direction, length } = lane;
      const nx = -direction.y;
      const ny = direction.x;
      const half = SQUIRREL_CHIEF.radius + 6;
      const end = { x: from.x + direction.x * length, y: from.y + direction.y * length };
      const alpha = phase === 'chargeWindup' ? 0.22 : 0.12;
      this.graphics
        .fillStyle(SQUIRREL_CHIEF_LOOK.laneColor, alpha)
        .fillPoints(
          [
            { x: from.x + nx * half, y: from.y + ny * half },
            { x: end.x + nx * half, y: end.y + ny * half },
            { x: end.x - nx * half, y: end.y - ny * half },
            { x: from.x - nx * half, y: from.y - ny * half }
          ],
          true
        );
      this.graphics
        .lineStyle(3, SQUIRREL_CHIEF_LOOK.laneEdge, 0.8)
        .lineBetween(from.x + nx * half, from.y + ny * half, end.x + nx * half, end.y + ny * half)
        .lineBetween(from.x - nx * half, from.y - ny * half, end.x - nx * half, end.y - ny * half);
    }

    const aim = this.encounter.barrageAim;
    if (aim && phase === 'barrageWindup' && this.boss) {
      const origin = this.boss.position;
      const base = Math.atan2(aim.y, aim.x);
      const count = SQUIRREL_CHIEF.barrageCount;
      for (let i = 0; i < count; i++) {
        const a =
          base -
          SQUIRREL_CHIEF.barrageSpread / 2 +
          (i * SQUIRREL_CHIEF.barrageSpread) / Math.max(1, count - 1);
        this.graphics
          .lineStyle(2.5, SQUIRREL_CHIEF_LOOK.acornWarnColor, 0.65)
          .lineBetween(origin.x, origin.y, origin.x + Math.cos(a) * 280, origin.y + Math.sin(a) * 280);
      }
    }
  }

  defeated(): void {
    this.encounter.defeat();
    this.celebrationMs = 2400;
    this.graphics.clear();
    this.caption.textContent = 'Squirrel Chief defeated!';
    this.fill.style.transform = 'scaleX(0)';
  }

  destroy(): void {
    this.graphics.destroy();
    this.hud.remove();
  }
}
