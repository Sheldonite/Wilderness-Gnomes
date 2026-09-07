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

/** The four ribbons on Ron's staff, reused for every flourish he makes. */
const RIBBON_COLORS = [0xe25c74, 0x487ebe, 0xeec25c, 0xe87e3c];

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
    for (let i = 0; i < Math.max(...ABILITIES.firefly.count); i++) this.fireflies.push(scene.add.image(0, 0, LOOK.texture.spark)
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
    this.drawPerformance(g, f, position, calm);
    for (const burst of this.bursts) {
      const t = burst.age / 600;
      const radius = calm ? burst.radius : burst.radius * (.15 + t * .85);
      g.lineStyle(2, burst.kind === 'magnet' ? LOOK.color.gold : LOOK.ability.acorn, (1 - t) * .55)
        .strokeCircle(burst.position.x, burst.position.y, radius);
    }
  }

  /** Ron's ribbons, shout rings and staff spin. Festival colours, drawn over the ground. */
  private drawPerformance(g: Phaser.GameObjects.Graphics, f: Phaser.GameObjects.Graphics, position: Vector2Like, calm: boolean): void {
    const sim = this.simulation;
    for (const arc of sim.ribbons) {
      const life = Phaser.Math.Clamp((sim.elapsedMs - arc.bornAt) / (arc.expiresAt - arc.bornAt), 0, 1);
      const fade = (1 - life) * (arc.echo ? .55 : .95);
      const swept = calm ? arc.arc : arc.arc * Phaser.Math.Easing.Cubic.Out(life);
      const from = arc.angle - arc.arc / 2;
      for (let band = 0; band < RIBBON_COLORS.length; band++) {
        const radius = arc.range * (.62 + band * .12);
        g.lineStyle(7 - band, RIBBON_COLORS[band], fade * (.85 - band * .12));
        g.beginPath();
        g.arc(arc.position.x, arc.position.y, radius, from, from + swept, false);
        g.strokePath();
      }
      const tip = from + swept;
      f.fillStyle(LOOK.color.cream, fade).fillCircle(arc.position.x + Math.cos(tip) * arc.range * .86,
        arc.position.y + Math.sin(tip) * arc.range * .86, 5);
    }
    for (const ring of sim.shoutRings) {
      const life = Phaser.Math.Clamp((sim.elapsedMs - ring.bornAt) / (ring.expiresAt - ring.bornAt), 0, 1);
      const radius = calm ? ring.radius : ring.radius * (.2 + life * .8);
      g.lineStyle(5, LOOK.color.gold, (1 - life) * .75).strokeCircle(ring.position.x, ring.position.y, radius);
      g.lineStyle(2, RIBBON_COLORS[1], (1 - life) * .5).strokeCircle(ring.position.x, ring.position.y, radius * .78);
    }
    if (sim.shoutEndsAt > sim.elapsedMs) {
      // A steady pair of notes circling the bard while the rally lasts.
      const beat = calm ? 0 : sim.elapsedMs / 260;
      for (let i = 0; i < 2; i++) {
        const a = beat + i * Math.PI;
        f.fillStyle(LOOK.color.gold, .85).fillCircle(position.x + Math.cos(a) * 44, position.y - 40 + Math.sin(a) * 12, 4);
      }
    }
    if (sim.spinEndsAt > sim.elapsedMs && sim.spinRadius > 0) {
      const spin = calm ? 0 : sim.elapsedMs / 55;
      g.fillStyle(RIBBON_COLORS[2], .1).fillCircle(position.x, position.y, sim.spinRadius);
      g.lineStyle(3, LOOK.color.gold, .7).strokeCircle(position.x, position.y, sim.spinRadius);
      for (let i = 0; i < RIBBON_COLORS.length; i++) {
        const a = spin + i * Math.PI * 2 / RIBBON_COLORS.length;
        f.lineStyle(4, RIBBON_COLORS[i], .85);
        f.lineBetween(position.x, position.y, position.x + Math.cos(a) * sim.spinRadius, position.y + Math.sin(a) * sim.spinRadius);
      }
    }
  }

  destroy(): void {
    this.ground.destroy(); this.foreground.destroy(); this.fireflies.forEach(f => f.destroy());
    this.bursts.length = 0;
  }
}
