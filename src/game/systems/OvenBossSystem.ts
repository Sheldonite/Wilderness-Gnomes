import Phaser from 'phaser';
import { OVEN } from '../config/ovenBoss';
import { OVEN_TEXTURE } from '../config/ovenSprite';
import { reducedMotion } from '../config/presentation';
import { OvenEncounter } from '../core/OvenEncounter';
import type { GameManager } from '../core/GameManager';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import type { EnemyController } from '../entities/EnemyController';
import { OvenBoss } from '../entities/OvenBoss';

export class OvenBossSystem {
  readonly encounter = new OvenEncounter();
  boss?: OvenBoss;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly tacos: Phaser.GameObjects.Image[];
  private readonly hud: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly caption: HTMLElement;
  private celebrationMs = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly game: GameManager, private readonly navigation: SceneryNavigation) {
    this.graphics = scene.add.graphics().setDepth(5);
    this.tacos = Array.from({ length: OVEN.maxTacos }, () => scene.add.image(0, 0, OVEN_TEXTURE, 7).setDisplaySize(44, 44).setDepth(24).setVisible(false));
    this.hud = document.createElement('section'); this.hud.className = 'boss-hud'; this.hud.hidden = true;
    this.hud.setAttribute('aria-label', OVEN.name);
    this.hud.innerHTML = `<div><strong>${OVEN.name}</strong><span class="boss-caption" aria-live="polite"></span></div><div class="boss-track" role="progressbar" aria-label="Boss health" aria-valuemin="0" aria-valuemax="${OVEN.health}"><i></i></div>`;
    document.getElementById('ui-root')!.append(this.hud);
    this.fill = this.hud.querySelector('i')!; this.caption = this.hud.querySelector('.boss-caption')!;
  }

  update(deltaMs: number, player: Vector2Like, playerRadius: number, enemies: EnemyController[]): void {
    if (this.game.bossGate.required(this.game.level) === 'oven' && this.encounter.shouldSpawn(this.game.level)) {
      // Prefer a clear point on the player's bank, away from contact range.
      let spawn = this.navigation.nearest({ x: player.x + OVEN.spawnDistance, y: player.y }, OVEN.radius);
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const candidate = { x: player.x + Math.cos(angle) * OVEN.spawnDistance, y: player.y + Math.sin(angle) * OVEN.spawnDistance };
        if (this.navigation.clear(player, candidate, OVEN.radius)) { spawn = candidate; break; }
      }
      this.boss = new OvenBoss(this.scene, spawn, this.navigation, this.encounter); enemies.push(this.boss);
      this.hud.hidden = false;
    }
    this.graphics.clear(); this.tacos.forEach(t => t.setVisible(false));
    if (this.encounter.defeated) {
      this.celebrationMs = Math.max(0, this.celebrationMs - deltaMs);
      if (!this.celebrationMs) this.hud.hidden = true;
      return;
    }
    if (!this.boss || this.boss.isDead) return;
    this.encounter.update(deltaMs, this.boss.position, player, playerRadius, this.boss.health / OVEN.health, damage => this.game.damagePlayer(damage));
    const phase = this.encounter.phase;
    const message = phase === 'arrival' ? 'Order up! Flaming tacos!' : phase === 'windup' ? this.encounter.attack === 'ring' ? 'Taco ring! Find a gap!' : 'Extra crispy! Dodge the circles!' : this.encounter.salsa.length ? 'Hot salsa! Keep off the flames!' : this.boss.health <= OVEN.health / 2 ? 'Too hot to handle!' : 'Dodge the flaming tacos!';
    if (this.caption.textContent !== message) this.caption.textContent = message;
    this.fill.style.transform = `scaleX(${Math.max(0, this.boss.health / OVEN.health)})`;
    this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(this.boss.health))));
    for (const p of this.encounter.salsa) {
      const alpha = .65 * Math.min(1, (OVEN.salsaLifeMs - p.age) / 500);
      this.graphics.fillStyle(0xb82f19, alpha).fillCircle(p.x, p.y, OVEN.salsaRadius);
      this.graphics.lineStyle(2, 0xff9b36, alpha).strokeCircle(p.x, p.y, OVEN.salsaRadius);
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        const x = p.x + Math.cos(angle) * 17, y = p.y + Math.sin(angle) * 17;
        const flicker = reducedMotion() ? 0 : Math.sin(p.age / 110 + i) * 3;
        this.graphics.fillStyle(0xffac36, alpha).fillTriangle(x - 5, y + 5, x + 5, y + 5, x + flicker, y - 11);
        this.graphics.fillStyle(0xffe9a1, alpha).fillCircle(x, y + 1, 2);
      }
    }
    for (const p of this.encounter.warnings) {
      this.graphics.fillStyle(0xe76825, .16).fillCircle(p.x, p.y, OVEN.blastRadius);
      this.graphics.lineStyle(3, 0xffcf73, .95).strokeCircle(p.x, p.y, OVEN.blastRadius);
      this.graphics.lineStyle(2, 0x772b24, 1).lineBetween(p.x - 7, p.y - 7, p.x + 7, p.y + 7).lineBetween(p.x + 7, p.y - 7, p.x - 7, p.y + 7);
    }
    this.encounter.tacos.forEach((taco, i) => {
      const progress = taco.age / OVEN.flightMs;
      const x = Phaser.Math.Linear(taco.start.x, taco.target.x, progress);
      const y = Phaser.Math.Linear(taco.start.y, taco.target.y, progress) - Math.sin(progress * Math.PI) * 115;
      this.tacos[i].setVisible(true).setPosition(x, y).setRotation(reducedMotion() ? -.3 : progress * Math.PI * 2);
    });
    for (const p of this.encounter.impacts) this.scene.events.emit('presentation:defeat', p);
  }

  defeated(): void {
    this.encounter.defeat(); this.celebrationMs = 3500;
    this.graphics.clear(); this.tacos.forEach(t => t.setVisible(false));
    this.fill.style.transform = 'scaleX(0)'; this.hud.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', '0');
    this.caption.textContent = 'Order served! The woods are safe from salsa.';
  }

  destroy(): void { this.encounter.defeat(); this.graphics.destroy(); this.tacos.forEach(t => t.destroy()); this.hud.remove(); }
}
