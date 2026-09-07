import Phaser from 'phaser';
import { LOOK, reducedMotion } from '../config/presentation';
import { ABILITIES } from '../config/abilities';
import { AbilitySimulation, type AbilityEvent } from '../core/AbilitySimulation';
import type { DealDamage } from '../core/CombatResolver';
import type { PlayerStats, Vector2Like } from '../core/types';
import type { GameManager } from '../core/GameManager';
import type { EnemyController } from '../entities/EnemyController';
import type { XPOrb } from '../entities/XPOrb';

interface Burst extends AbilityEvent { age: number; }

export class AbilitySystem {
  readonly simulation: AbilitySimulation;
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly foreground: Phaser.GameObjects.Graphics;
  private readonly fireflies: Phaser.GameObjects.Image[] = [];
  private readonly bursts: Burst[] = [];

  constructor(private readonly scene: Phaser.Scene, stats: PlayerStats) {
    this.simulation = new AbilitySimulation(stats);
    this.ground = scene.add.graphics().setDepth(2);
    this.foreground = scene.add.graphics().setDepth(22);
    for (let i = 0; i < ABILITIES.firefly.count[5]; i++) this.fireflies.push(scene.add.image(0, 0, LOOK.texture.spark)
      .setDepth(LOOK.depth.spell).setTint(LOOK.color.gold).setDisplaySize(24, 24).setVisible(false));
  }

  sync(position: Vector2Like, ward: GameManager['wardStatus'], leaves = 0): void {
    this.simulation.sync(position);
    this.draw(position, ward, leaves);
  }

  update(deltaMs: number, position: Vector2Like, enemies: EnemyController[], orbs: XPOrb[], damage: DealDamage): void {
    this.simulation.update(deltaMs, position, enemies, orbs, damage);
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      this.bursts[i].age += deltaMs;
      if (this.bursts[i].age >= 600) this.bursts.splice(i, 1);
    }
    for (const event of this.simulation.events) {
      if (this.bursts.length >= LOOK.limit.abilityBursts) this.bursts.shift();
      this.bursts.push({ ...event, age: 0 });
      if (event.kind === 'impact') this.scene.events.emit('presentation:trail', event.position, LOOK.ability.acorn);
    }
  }

  private draw(position: Vector2Like, ward: GameManager['wardStatus'], leaves: number): void {
    const g = this.ground.clear(), f = this.foreground.clear();
    const calm = reducedMotion();
    for (const patch of this.simulation.brambles) {
      const fade = Math.min(1, (patch.expiresAt - this.simulation.elapsedMs) / 350);
      if (this.simulation.insideThornwall(patch)) {
        // Thornwall: a heavy ring of thorns rather than a soft root patch
        g.lineStyle(6, LOOK.ability.roots, .85 * fade).strokeCircle(patch.x, patch.y, patch.radius);
        for (let i = 0; i < 16; i++) {
          const a = i * Math.PI / 8, r = patch.radius;
          g.lineStyle(2, LOOK.ability.roots, .9 * fade).lineBetween(patch.x + Math.cos(a) * (r - 6), patch.y + Math.sin(a) * (r - 6),
            patch.x + Math.cos(a + .18) * (r + 10), patch.y + Math.sin(a + .18) * (r + 10));
        }
      }
      g.fillStyle(LOOK.ability.roots, .12 * fade).fillCircle(patch.x, patch.y, patch.radius);
      g.lineStyle(2, LOOK.ability.roots, .65 * fade).strokeCircle(patch.x, patch.y, patch.radius);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const x = patch.x + Math.cos(a) * 65, y = patch.y + Math.sin(a) * 65;
        g.lineStyle(2, LOOK.ability.roots, .75 * fade).lineBetween(x, y, patch.x + Math.cos(a + .12) * 85, patch.y + Math.sin(a + .12) * 85);
        g.fillStyle(LOOK.ability.roots, .8 * fade).fillEllipse(x, y, 12, 5);
      }
    }
    for (const patch of this.simulation.spores) {
      const fade = Math.min(1, (patch.expiresAt - this.simulation.elapsedMs) / 400);
      g.fillStyle(LOOK.ability.spores, .13 * fade).fillCircle(patch.x, patch.y, patch.radius);
      g.lineStyle(1, LOOK.ability.spores, .5 * fade).strokeCircle(patch.x, patch.y, patch.radius);
      for (let i = 0; i < 3; i++) {
        const offset = (i - 1) * 26;
        const x = patch.x + Math.cos(patch.trailAngle) * offset;
        const y = patch.y + Math.sin(patch.trailAngle) * offset;
        const age = this.simulation.elapsedMs - patch.bornAt;
        const growth = calm ? 1 : Phaser.Math.Easing.Cubic.Out(Phaser.Math.Clamp((age - i * 55) / 180, 0, 1));
        if (growth <= 0) continue;
        g.fillStyle(LOOK.color.cream, .9 * fade).fillRoundedRect(x - 2 * growth, y - growth, 4 * growth, 10 * growth, 2 * growth);
        g.fillStyle(LOOK.ability.spores, .95 * fade).fillEllipse(x, y - 3 * growth, 17 * growth, 10 * growth);
        g.fillStyle(LOOK.color.cream, .8 * fade).fillCircle(x - 3 * growth, y - 5 * growth, 1.5 * growth).fillCircle(x + 4 * growth, y - 3 * growth, 1.5 * growth);
      }
    }
    for (const roller of this.simulation.rollers) {
      // Oak Fall: the great acorn rolling along the ground
      const spin = this.simulation.elapsedMs / 90;
      g.fillStyle(LOOK.ability.acorn, .12).fillCircle(roller.x, roller.y, roller.radius);
      f.fillStyle(LOOK.ability.acorn, 1).fillCircle(roller.x, roller.y, roller.radius * .8);
      f.fillStyle(0x795a3e, 1).fillEllipse(roller.x + Math.cos(spin) * roller.radius * .35, roller.y + Math.sin(spin) * roller.radius * .35, roller.radius * .9, roller.radius * .45);
    }
    for (const acorn of this.simulation.acorns) {
      const t = 1 - (acorn.landsAt - this.simulation.elapsedMs) / ABILITIES.acorn.warningMs;
      g.fillStyle(LOOK.ability.acorn, .1).fillCircle(acorn.x, acorn.y, acorn.radius);
      g.lineStyle(2, LOOK.ability.acorn, .8).strokeCircle(acorn.x, acorn.y, acorn.radius);
      const y = acorn.y - (calm ? 14 : (1 - t) * 90 + 10);
      f.fillStyle(LOOK.ability.acorn, 1).fillEllipse(acorn.x, y, 15, 20);
      f.fillStyle(0x795a3e, 1).fillEllipse(acorn.x, y - 7, 19, 9);
      f.lineStyle(3, 0x795a3e).lineBetween(acorn.x, y - 9, acorn.x + 3, y - 15);
    }
    this.fireflies.forEach((image, i) => {
      const point = this.simulation.fireflies[i]; image.setVisible(Boolean(point));
      if (!point) return;
      image.setPosition(point.x, point.y).setAlpha(calm ? .75 : .85 + Math.sin(this.simulation.elapsedMs / 150 + i) * .15);
      f.fillStyle(LOOK.color.cream, .65).fillEllipse(point.x - 4, point.y - 2, 8, 4).fillEllipse(point.x + 4, point.y - 2, 8, 4);
      f.fillStyle(LOOK.color.gold, 1).fillEllipse(point.x, point.y, 5, 8);
    });
    if (ward === 'ready' || ward === 'protecting') {
      f.lineStyle(ward === 'protecting' ? 4 : 2, LOOK.ability.ward, ward === 'protecting' ? .9 : .5)
        .strokeEllipse(position.x, position.y, 60, 76);
      const count = leaves > 0 ? leaves : 4;
      for (let i = 0; i < count; i++) {
        const a = Math.PI / 4 + i * Math.PI * 2 / count;
        f.fillStyle(LOOK.ability.ward, .85).fillEllipse(position.x + Math.cos(a) * 30, position.y + Math.sin(a) * 38, leaves > 0 ? 14 : 10, leaves > 0 ? 7 : 5);
      }
    }
    for (const burst of this.bursts) {
      const t = burst.age / 600;
      const radius = calm ? burst.radius : burst.radius * (.15 + t * .85);
      g.lineStyle(2, burst.kind === 'magnet' ? LOOK.color.gold : LOOK.ability.acorn, (1 - t) * .55)
        .strokeCircle(burst.position.x, burst.position.y, radius);
    }
  }

  destroy(): void {
    this.ground.destroy(); this.foreground.destroy(); this.fireflies.forEach(f => f.destroy());
    this.bursts.length = 0;
  }
}
