import Phaser from 'phaser';
import { LOOK, reducedMotion } from '../config/presentation';
import type { Vector2Like } from '../core/types';

interface Mote { image: Phaser.GameObjects.Image; age: number; life: number; vx: number; vy: number; size: number; }
interface Actor { shadow: Phaser.GameObjects.Image; contact?: Phaser.GameObjects.Ellipse; foot: number; flash: number; }
export interface ActorShadow { foot: number; width: number; height: number; alpha?: number; contactAlpha?: number }

/** All transient world effects use the gameplay clock, so pause freezes them exactly. */
export class PresentationSystem {
  private readonly particles: Mote[] = [];
  private readonly actors = new Map<Phaser.GameObjects.Sprite, Actor>();
  private readonly pollen: Phaser.GameObjects.Image[] = [];
  private readonly hurtVignette: Phaser.GameObjects.Graphics;
  private elapsed = 0;
  private hurtPulse = 0;
  private readonly register = (sprite: Phaser.GameObjects.Sprite, options?: ActorShadow) => {
    const shadow = this.scene.add.image(sprite.x, sprite.y, LOOK.texture.shadow).setDepth(LOOK.depth.shadow);
    shadow.setDisplaySize(options?.width ?? sprite.displayWidth * .65, options?.height ?? sprite.displayHeight * .19).setAlpha(options?.alpha ?? .85);
    const contact = options?.contactAlpha ? this.scene.add.ellipse(sprite.x, sprite.y + options.foot, options.width * .72, options.height * .5, 0x172015, options.contactAlpha).setDepth(LOOK.depth.shadow + .1) : undefined;
    this.actors.set(sprite, { shadow, contact, foot: options?.foot ?? sprite.displayHeight * .4, flash: 0 });
    sprite.once('destroy', () => { shadow.destroy(); contact?.destroy(); this.actors.delete(sprite); });
  };
  private readonly hit = (sprite: Phaser.GameObjects.Sprite) => {
    const actor = this.actors.get(sprite); if (actor) { actor.flash = 90; sprite.setTintFill(0xffefd0); }
    this.burst(sprite, LOOK.color.cream, 4);
  };
  private readonly playerHit = () => this.pulseHurtVignette();
  private readonly dash = (point: Vector2Like) => {
    this.burst(point, LOOK.ability.ward, 5);
    this.burst(point, LOOK.color.cream, 4);
  };
  private readonly defeat = (point: Vector2Like) => this.burst(point, LOOK.color.gold, 9);
  private readonly collect = (point: Vector2Like) => this.burst(point, LOOK.color.xp, 4);
  private readonly trail = (point: Vector2Like, color: number = LOOK.color.spell) => this.burst(point, color, 1, true);
  private readonly level = (point: Vector2Like) => this.burst(point, LOOK.color.gold, 24);
  private readonly redrawHurtVignette = () => {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    this.hurtVignette.clear();
    if (width <= 0 || height <= 0) return;
    const edge = Math.max(18, Math.round(Math.min(width, height) * .085));
    const alphas = [.38, .26, .16, .09, .04];
    const step = edge / alphas.length;
    for (let i = 0; i < alphas.length; i++) {
      const offset = i * step;
      const spanW = Math.max(0, width - offset * 2);
      const innerH = Math.max(0, height - (offset + step) * 2);
      this.hurtVignette.fillStyle(0xa8241c, alphas[i]);
      this.hurtVignette.fillRect(offset, offset, spanW, step);
      this.hurtVignette.fillRect(offset, height - offset - step, spanW, step);
      this.hurtVignette.fillRect(offset, offset + step, step, innerH);
      this.hurtVignette.fillRect(width - offset - step, offset + step, step, innerH);
    }
  };

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.on('presentation:actor', this.register);
    scene.events.on('presentation:hit', this.hit);
    scene.events.on('presentation:player-hit', this.playerHit);
    scene.events.on('presentation:dash', this.dash);
    scene.events.on('presentation:defeat', this.defeat);
    scene.events.on('presentation:collect', this.collect);
    scene.events.on('presentation:trail', this.trail);
    scene.events.on('presentation:level', this.level);
    for (let i = 0; i < LOOK.limit.particles; i++) {
      const image = scene.add.image(0, 0, LOOK.texture.spark).setDepth(28).setVisible(false);
      this.particles.push({ image, age: 0, life: 0, vx: 0, vy: 0, size: 0 });
    }
    for (let i = 0; i < LOOK.limit.pollen; i++) {
      const mote = scene.add.image(0, 0, LOOK.texture.spark).setScrollFactor(0).setDepth(LOOK.depth.atmosphere).setAlpha(.3).setDisplaySize(7, 7);
      this.pollen.push(mote);
    }
    this.hurtVignette = scene.add.graphics().setScrollFactor(0).setDepth(LOOK.depth.atmosphere).setAlpha(0).setVisible(false);
    this.redrawHurtVignette();
    scene.scale.on?.('resize', this.redrawHurtVignette);
  }

  pulseHurtVignette(intensity = 1): void {
    this.hurtPulse = Math.max(this.hurtPulse, Math.min(1, Math.max(0, intensity)));
    if (this.hurtPulse > 0) {
      this.hurtVignette.setVisible(true).setAlpha((reducedMotion() ? .55 : .85) * this.hurtPulse);
    }
  }

  fadeHurtVignette(deltaMs: number): void {
    if (this.hurtPulse <= 0) return;
    this.hurtPulse = Math.max(0, this.hurtPulse - Math.max(0, deltaMs) / 380);
    if (this.hurtPulse <= 0) {
      this.clearHurtVignette();
      return;
    }
    this.hurtVignette.setVisible(true).setAlpha((reducedMotion() ? .55 : .85) * this.hurtPulse);
  }

  clearHurtVignette(): void {
    this.hurtPulse = 0;
    this.hurtVignette.setAlpha(0).setVisible(false);
  }

  update(deltaMs: number): void {
    const calm = reducedMotion();
    this.elapsed += deltaMs;
    this.fadeHurtVignette(deltaMs);
    const dt = deltaMs / 1000;
    for (const [sprite, actor] of this.actors) {
      actor.shadow.setPosition(sprite.x + 3, sprite.y + actor.foot);
      actor.contact?.setPosition(sprite.x, sprite.y + actor.foot);
      if (actor.flash > 0) { actor.flash -= deltaMs; if (actor.flash <= 0) { const tint = sprite.getData('tint'); if (tint !== undefined) sprite.setTint(tint); else sprite.clearTint(); } }
    }
    for (const p of this.particles) {
      if (!p.image.visible) continue;
      p.age += deltaMs;
      if (p.age >= p.life || calm) { p.image.setVisible(false); continue; }
      const ratio = 1 - p.age / p.life;
      p.image.x += p.vx * dt; p.image.y += p.vy * dt;
      p.image.setAlpha(ratio * .85).setDisplaySize(p.size * (.4 + ratio * .6), p.size * (.4 + ratio * .6));
    }
    this.pollen.forEach((p, i) => {
      p.setVisible(!calm);
      p.x = ((i * 137.51 + this.elapsed * .005) % (this.scene.scale.width + 70)) - 35;
      p.y = ((i * 91.73 - this.elapsed * .011) % (this.scene.scale.height + 70) + this.scene.scale.height + 70) % (this.scene.scale.height + 70) - 35;
      p.setAlpha(.15 + (1 + Math.sin(this.elapsed / 1500 + i)) * .12);
    });
  }

  destroy(): void {
    for (const [event, handler] of [['actor', this.register], ['hit', this.hit], ['player-hit', this.playerHit], ['dash', this.dash], ['defeat', this.defeat], ['collect', this.collect], ['trail', this.trail], ['level', this.level]] as const) this.scene.events.off(`presentation:${event}`, handler);
    this.scene.scale.off?.('resize', this.redrawHurtVignette);
    this.particles.forEach(p => p.image.destroy()); this.pollen.forEach(p => p.destroy());
    this.hurtVignette.destroy();
    this.actors.forEach(actor => { actor.shadow.destroy(); actor.contact?.destroy(); }); this.actors.clear();
  }

  private burst(point: Vector2Like, color: number, count: number, trail = false): void {
    if (reducedMotion()) return;
    let remaining = count;
    for (const p of this.particles) {
      if (p.image.visible) continue;
      const angle = Math.random() * Math.PI * 2, speed = trail ? 8 : 25 + Math.random() * 75;
      p.age = 0; p.life = trail ? 220 : 350 + Math.random() * 230;
      p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed - 15;
      p.size = trail ? 12 : 10 + Math.random() * 10;
      p.image.setPosition(point.x, point.y).setTint(color).setDisplaySize(p.size, p.size).setAlpha(.8).setVisible(true);
      remaining--; if (!remaining) break;
    }
  }
}
