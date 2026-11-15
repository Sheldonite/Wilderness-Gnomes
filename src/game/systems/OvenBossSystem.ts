import Phaser from 'phaser';
import { OVEN, OVEN_LOOK } from '../config/ovenBoss';
import { OVEN_TEXTURE } from '../config/ovenSprite';
import { reducedMotion } from '../config/presentation';
import { scaledBossHealth } from '../core/BossGate';
import { OvenEncounter, type OvenPhase } from '../core/OvenEncounter';
import type { GameManager } from '../core/GameManager';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import type { EnemyController } from '../entities/EnemyController';
import { OvenBoss } from '../entities/OvenBoss';
import { clampToArena } from '../utils/math';
import type { SummonAdds } from './BossSummons';

export class OvenBossSystem {
  encounter = new OvenEncounter();
  boss?: OvenBoss;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly tacos: Phaser.GameObjects.Image[];
  private readonly hud: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly caption: HTMLElement;
  private celebrationMs = 0;
  /** Keeps a one-off announcement (line cooks or OVERCOOKED!) on screen for a moment. */
  private shoutMs = 0;
  private shout = '';
  private hotShown = false;
  private lastPhase?: OvenPhase;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly game: GameManager,
    private readonly navigation: SceneryNavigation,
    private readonly summon: SummonAdds = () => {}
  ) {
    this.graphics = scene.add.graphics().setDepth(5);
    this.tacos = Array.from({ length: OVEN.maxTacos }, () =>
      scene.add.image(0, 0, OVEN_TEXTURE, 7).setDisplaySize(44, 44).setDepth(24).setVisible(false)
    );
    this.hud = document.createElement('section');
    this.hud.className = 'boss-hud';
    this.hud.hidden = true;
    this.hud.setAttribute('aria-label', OVEN.name);
    this.hud.innerHTML = `<div><strong>${OVEN.name}</strong><span class="boss-caption" aria-live="polite"></span></div><div class="boss-track" role="progressbar" aria-label="Boss health" aria-valuemin="0" aria-valuemax="${OVEN.health}"><i></i></div>`;
    document.getElementById('ui-root')!.append(this.hud);
    this.fill = this.hud.querySelector('i')!;
    this.caption = this.hud.querySelector('.boss-caption')!;
  }

  spawnEncore(player: Vector2Like, enemies: EnemyController[], healthMultiplier: number): void {
    this.encounter = new OvenEncounter();
    this.encounter.spawned = true;
    this.celebrationMs = 0;
    this.shoutMs = 0;
    this.shout = '';
    this.hotShown = false;
    this.spawnBoss(player, enemies, healthMultiplier);
  }

  private spawnBoss(player: Vector2Like, enemies: EnemyController[], healthMultiplier = 1): void {
    // Prefer a clear point on the player's bank, away from contact range.
    let spawn = this.navigation.nearest({ x: player.x + OVEN.spawnDistance, y: player.y }, OVEN.radius);
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const candidate = { x: player.x + Math.cos(angle) * OVEN.spawnDistance, y: player.y + Math.sin(angle) * OVEN.spawnDistance };
      if (this.navigation.clear(player, candidate, OVEN.radius)) {
        spawn = candidate;
        break;
      }
    }
    const health = Math.round(scaledBossHealth(OVEN.health, OVEN.healthPerMinute, this.game.getDifficultyMinutes()) * healthMultiplier);
    this.boss = new OvenBoss(this.scene, spawn, this.navigation, this.encounter, health);
    enemies.push(this.boss);
    this.lastPhase = undefined;
    this.hotShown = false;
    this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuemax', String(health));
    this.hud.hidden = false;
    this.scene.events.emit('audio:play', 'boss-spawn');
  }

  update(deltaMs: number, player: Vector2Like, playerRadius: number, enemies: EnemyController[]): void {
    if (this.game.bossGate.required(this.game.level) === 'oven' && this.encounter.shouldSpawn(this.game.level)) {
      this.spawnBoss(player, enemies);
    }
    this.graphics.clear();
    this.tacos.forEach(t => t.setVisible(false));
    if (this.encounter.defeated) {
      this.celebrationMs = Math.max(0, this.celebrationMs - deltaMs);
      if (!this.celebrationMs) this.hud.hidden = true;
      return;
    }
    if (!this.boss || this.boss.isDead) return;

    const fraction = this.boss.health / this.boss.maxHealth;
    this.encounter.update(
      deltaMs,
      this.boss.position,
      player,
      playerRadius,
      fraction,
      damage => this.game.damagePlayer(damage),
      (point, radius) => this.navigation.nearest(clampToArena(point, radius), radius)
    );

    if (this.encounter.pendingAdds) {
      const total = this.encounter.pendingAdds;
      const does = Math.ceil(total * 4 / 7);
      const greys = total - does;
      if (does > 0) this.summon('doe', does, OVEN.addTint);
      if (greys > 0) this.summon('grey', greys, OVEN.addTint);
      this.encounter.pendingAdds = 0;
      this.shout = 'Order up! The Lv. 10 kitchen crew rushes in!';
      this.shoutMs = 2600;
    }

    if (this.encounter.hot && !this.hotShown) {
      this.hotShown = true;
      this.shout = 'OVERCOOKED! Faster, hotter, and chaining attacks!';
      this.shoutMs = 2600;
    }

    this.shoutMs = Math.max(0, this.shoutMs - deltaMs);
    const phase = this.encounter.phase;
    const attack = this.encounter.attack;
    const message = this.shoutMs ? this.shout
      : phase === 'arrival' ? 'Order up! Flaming tacos!'
      : phase === 'windup'
        ? attack === 'cone' ? 'Flame sweep! Check the arrows and get clear!'
          : attack === 'slam' ? 'Toaster Leap! Get out of the slam zone!'
          : attack === 'ring' ? 'Center trap + outer ring! Keep moving!'
          : 'Leading tacos! Cut direction to dodge!'
      : phase === 'slamming' ? 'INCOMING SLAM! Dash the shockwave!'
      : phase === 'blasting' ? 'FLAME SWEEP!'
      : phase === 'overheated' ? 'Overheated! Strike the open door!'
      : this.encounter.chainingCone ? 'OVERCOOKED! Chaining straight into Flame Sweep!'
      : this.encounter.salsa.length ? 'Burning salsa! Keep off the flames!'
      : this.encounter.hot ? 'OVERCOOKED! Too hot to handle!' : 'Watch the oven door and dodge the tacos!';

    if (this.caption.textContent !== message) this.caption.textContent = message;
    this.fill.style.transform = `scaleX(${Math.max(0, fraction)})`;
    this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(this.boss.health))));

    for (const p of this.encounter.salsa) {
      const alpha = 0.65 * Math.min(1, (p.life - p.age) / 500);
      this.graphics.fillStyle(this.encounter.hot ? 0xcf3618 : 0xb82f19, alpha).fillCircle(p.x, p.y, OVEN.salsaRadius);
      this.graphics.lineStyle(2, 0xff9b36, alpha).strokeCircle(p.x, p.y, OVEN.salsaRadius);
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI * 2 / 6;
        const x = p.x + Math.cos(angle) * (OVEN.salsaRadius * 0.54);
        const y = p.y + Math.sin(angle) * (OVEN.salsaRadius * 0.54);
        const flicker = reducedMotion() ? 0 : Math.sin(p.age / 110 + i) * 3;
        this.graphics.fillStyle(0xffac36, alpha).fillTriangle(x - 5, y + 5, x + 5, y + 5, x + flicker, y - 12);
        this.graphics.fillStyle(0xffe9a1, alpha).fillCircle(x, y + 1, 2);
      }
    }

    this.drawSlam(phase);
    this.drawShockwaves();
    this.drawCone(phase);
    this.drawOverheated(phase);

    for (const p of this.encounter.warnings) {
      this.graphics.fillStyle(0xe76825, 0.16).fillCircle(p.x, p.y, OVEN.blastRadius);
      this.graphics.lineStyle(3, 0xffcf73, 0.95).strokeCircle(p.x, p.y, OVEN.blastRadius);
      this.graphics.lineStyle(2, 0x772b24, 1).lineBetween(p.x - 7, p.y - 7, p.x + 7, p.y + 7).lineBetween(p.x + 7, p.y - 7, p.x - 7, p.y + 7);
    }

    this.encounter.tacos.forEach((taco, i) => {
      if (taco.age < 0 || !this.tacos[i]) return;   // the second ring is still in the Oven
      const progress = taco.age / OVEN.flightMs;
      const x = Phaser.Math.Linear(taco.start.x, taco.target.x, progress);
      const y = Phaser.Math.Linear(taco.start.y, taco.target.y, progress) - Math.sin(progress * Math.PI) * 115;
      this.tacos[i].setVisible(true).setPosition(x, y).setRotation(reducedMotion() ? -0.3 : progress * Math.PI * 2);
    });

    for (const p of this.encounter.impacts) this.scene.events.emit('presentation:defeat', p);
    if (this.encounter.slamLanded) {
      this.scene.events.emit('presentation:level', this.encounter.slamLanded);
      this.scene.cameras.main.shake(220, 0.0055);
    }
    if (this.encounter.impacts.length > 0 || this.encounter.coneFired || this.encounter.slamLanded) {
      this.scene.events.emit('audio:play', 'boss-impact');
    }
    if (this.encounter.coneFired) this.scene.cameras.main.shake(160, 0.003);
    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
      if (phase === 'windup') this.scene.events.emit('audio:play', 'boss-warn');
    }
  }

  /** Pulsing danger circle and crosshair for Toaster Leap Slam. */
  private drawSlam(phase: OvenPhase): void {
    const slam = this.encounter.slam;
    if (!slam || (phase !== 'windup' && phase !== 'slamming')) return;
    const { target, radius } = slam;
    const calm = reducedMotion();
    const pulse = calm ? 0.5 : (Math.sin(performance.now() / 75) + 1) / 2;
    if (phase === 'windup') {
      const total = this.encounter.hot ? OVEN.hotSlamWindupMs : OVEN.slamWindupMs;
      const charge = Math.max(0, Math.min(1, 1 - this.encounter.timerRemaining / total));
      this.graphics.fillStyle(0xe7421c, 0.14 + pulse * 0.12).fillCircle(target.x, target.y, radius);
      this.graphics.lineStyle(3, 0xffcf73, 0.8 + pulse * 0.2).strokeCircle(target.x, target.y, radius);
      if (charge > 0.05) {
        this.graphics.lineStyle(2.5, 0xff7b22, 0.85).strokeCircle(target.x, target.y, radius * charge);
      }
    } else {
      this.graphics.fillStyle(0xe7421c, 0.24).fillCircle(target.x, target.y, radius);
      this.graphics.lineStyle(3.5, 0xff7b22, 0.95).strokeCircle(target.x, target.y, radius);
    }
    this.graphics.lineStyle(2.5, 0xffe39a, 0.95)
      .lineBetween(target.x - 18, target.y, target.x + 18, target.y)
      .lineBetween(target.x, target.y - 18, target.x, target.y + 18)
      .strokeCircle(target.x, target.y, 10);
  }

  /** Prominent expanding magma shockwave rings radiating from slam craters. */
  private drawShockwaves(): void {
    for (const wave of this.encounter.shockwaves) {
      if (wave.radius < 4) continue;
      const fade = Math.max(0, 1 - wave.radius / wave.maxRadius);
      this.graphics.lineStyle(OVEN.shockwaveWidth, 0xff5a1f, 0.58 * fade + 0.14)
        .strokeCircle(wave.origin.x, wave.origin.y, wave.radius);
      this.graphics.lineStyle(9, 0xff9b36, 0.78 * fade + 0.12)
        .strokeCircle(wave.origin.x, wave.origin.y, wave.radius);
      this.graphics.lineStyle(5, 0xffe39a, 0.9 * fade + 0.1)
        .strokeCircle(wave.origin.x, wave.origin.y, wave.radius + OVEN.shockwaveWidth / 2 - 2);
      const inner = wave.radius - OVEN.shockwaveWidth / 2 + 2;
      if (inner > 4) {
        this.graphics.lineStyle(3, 0x6b1e0a, 0.65 * fade).strokeCircle(wave.origin.x, wave.origin.y, inner);
      }
    }
  }

  /** Sweeping door blast: starting wedge + directional sweep chevrons on windup, roaring beam while blasting. */
  private drawCone(phase: OvenPhase): void {
    const cone = this.encounter.cone;
    if (!cone || (phase !== 'windup' && phase !== 'blasting')) return;
    const base = Math.atan2(cone.direction.y, cone.direction.x);
    const wedge = (centerAngle: number, range: number, halfAngle: number): Vector2Like[] => {
      const pts: Vector2Like[] = [cone.origin];
      for (let i = 0; i <= 12; i++) {
        const a = centerAngle - halfAngle + i * halfAngle * 2 / 12;
        pts.push({ x: cone.origin.x + Math.cos(a) * range, y: cone.origin.y + Math.sin(a) * range });
      }
      return pts;
    };

    if (phase === 'windup') {
      const endAngle = cone.startAngle + cone.sweepAngle;
      const minA = Math.min(cone.startAngle, endAngle) - cone.halfAngle;
      const maxA = Math.max(cone.startAngle, endAngle) + cone.halfAngle;
      const fullPts: Vector2Like[] = [cone.origin];
      for (let i = 0; i <= 20; i++) {
        const a = minA + (maxA - minA) * (i / 20);
        fullPts.push({ x: cone.origin.x + Math.cos(a) * cone.range, y: cone.origin.y + Math.sin(a) * cone.range });
      }
      this.graphics.fillStyle(0xe76825, 0.08).fillPoints(fullPts, true);
      this.graphics.lineStyle(1.5, 0xff9b36, 0.35).strokePoints(fullPts, true);

      const startPts = wedge(cone.startAngle, cone.range, cone.halfAngle);
      this.graphics.fillStyle(0xe76825, 0.24).fillPoints(startPts, true);
      this.graphics.lineStyle(3, 0xffcf73, 0.92).strokePoints(startPts, true);

      // Curved sweep arc + chevrons pointing in the sweep direction.
      const arcR = cone.range * 0.72;
      this.graphics.lineStyle(3, 0xffd86b, 0.88).beginPath()
        .arc(cone.origin.x, cone.origin.y, arcR, cone.startAngle, endAngle, cone.sweepAngle < 0)
        .strokePath();
      const sign = cone.sweepAngle >= 0 ? 1 : -1;
      for (const t of [0.28, 0.56, 0.84]) {
        const a = cone.startAngle + cone.sweepAngle * t;
        const px = cone.origin.x + Math.cos(a) * arcR;
        const py = cone.origin.y + Math.sin(a) * arcR;
        const tan = a + sign * (Math.PI / 2);
        const tipX = px + Math.cos(tan) * 9;
        const tipY = py + Math.sin(tan) * 9;
        const backA = tan + 2.4;
        const backB = tan - 2.4;
        this.graphics.lineStyle(3, 0xffe9a1, 0.95)
          .lineBetween(tipX, tipY, tipX + Math.cos(backA) * 14, tipY + Math.sin(backA) * 14)
          .lineBetween(tipX, tipY, tipX + Math.cos(backB) * 14, tipY + Math.sin(backB) * 14);
      }
      return;
    }

    const outerPts = wedge(base, cone.range, cone.halfAngle);
    this.graphics.fillStyle(0xff7d24, 0.52).fillPoints(outerPts, true);
    this.graphics.lineStyle(3, 0xffe39a, 0.95).strokePoints(outerPts, true);
    const corePts = wedge(base, cone.range * 0.65, cone.halfAngle * 0.52);
    this.graphics.fillStyle(0xfff0b3, 0.45).fillPoints(corePts, true);
  }

  /** Warm venting glow ring and rising steam motes during the `'overheated'` punish window. */
  private drawOverheated(phase: OvenPhase): void {
    if (phase !== 'overheated' || !this.boss) return;
    const p = this.boss.position;
    const calm = reducedMotion();
    const pulse = calm ? 0.5 : (Math.sin(performance.now() / 80) + 1) / 2;
    const ringRadius = OVEN.radius + 34;
    this.graphics.fillStyle(0xffd86b, 0.1 + pulse * 0.08).fillCircle(p.x, p.y, ringRadius);
    this.graphics.lineStyle(3, 0xffe39a, 0.65 + pulse * 0.3).strokeCircle(p.x, p.y, ringRadius);

    for (let i = 0; i < 3; i++) {
      const cycle = calm ? i * 0.3 : ((performance.now() / 750 + i * 0.33) % 1);
      const x = p.x + (i - 1) * 20 + (calm ? 0 : Math.sin(cycle * Math.PI * 2) * 5);
      const y = p.y - OVEN_LOOK.height * 0.55 - cycle * 36;
      const alpha = (1 - cycle) * 0.65;
      this.graphics.fillStyle(0xfff1c4, alpha).fillCircle(x, y, 7 + cycle * 6);
    }
  }

  defeated(): void {
    this.encounter.defeat();
    this.celebrationMs = 3500;
    this.graphics.clear();
    this.tacos.forEach(t => t.setVisible(false));
    this.fill.style.transform = 'scaleX(0)';
    this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', '0');
    this.caption.textContent = 'Order served! The woods are safe from salsa.';
  }

  destroy(): void {
    this.encounter.defeat();
    this.graphics.destroy();
    this.tacos.forEach(t => t.destroy());
    this.hud.remove();
  }
}
