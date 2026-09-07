import Phaser from 'phaser';
import { LOOK, reducedMotion } from '../config/presentation';
import { TOBIAS_DART_KEY, TOBIAS_SPRITE_KEY, TOBIAS_SWIM_KEY } from '../config/tobiasSprite';
import { TobiasSwim, type AirWake } from '../core/TobiasSwim';
import type { DealDamage } from '../core/CombatResolver';
import type { PlayerStats, Vector2Like } from '../core/types';
import type { EnemyController } from './EnemyController';

/** Draws Tobias and the curls of air he stirs up, since there is no water to leave a wake in. */
export class TobiasCompanion {
  readonly swim: TobiasSwim;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly wakeGraphics: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene, stats: PlayerStats, playerPosition: Vector2Like) {
    this.swim = new TobiasSwim(stats);
    this.swim.update(0, playerPosition, [], () => undefined);
    this.wakeGraphics = scene.add.graphics().setDepth(LOOK.depth.companion - 1);
    this.shadow = scene.add.ellipse(playerPosition.x, playerPosition.y, 54, 18, 0x1d2a22, .22).setDepth(LOOK.depth.shadow);
    this.sprite = scene.add.sprite(playerPosition.x, playerPosition.y, TOBIAS_SPRITE_KEY, 0);
    this.sprite.setDisplaySize(76, 76).setDepth(LOOK.depth.companion + 3);
    this.sprite.play(TOBIAS_SWIM_KEY);
  }

  update(deltaMs: number, playerPosition: Vector2Like, enemies: EnemyController[], damage: DealDamage): void {
    this.swim.update(deltaMs, playerPosition, enemies, damage);
    const { position, facing, bob } = this.swim;
    const darting = this.swim.darting;
    // He swims above the ground, so the body lifts while the shadow stays put beneath him.
    const lift = 34 + (reducedMotion() ? 0 : bob);
    this.sprite.setPosition(position.x, position.y - lift);
    this.sprite.setFlipX(facing.x < 0);
    this.sprite.setRotation(Math.atan2(facing.y, Math.abs(facing.x) || 1) * (darting ? .55 : .3));
    this.sprite.setDisplaySize(darting ? 84 : 76, darting ? 84 : 76);
    this.sprite.setDepth(facing.y >= 0 ? LOOK.depth.companion + 3 : LOOK.depth.companion - 2);
    this.shadow.setPosition(position.x, position.y + 6);
    this.shadow.setScale(darting ? 1.1 : 1, 1);
    const anim = darting ? TOBIAS_DART_KEY : TOBIAS_SWIM_KEY;
    if (this.sprite.anims.currentAnim?.key !== anim) this.sprite.play(anim, true);
    this.drawWakes();
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.wakeGraphics.destroy();
  }

  get position(): Vector2Like {
    return this.swim.position;
  }

  private drawWakes(): void {
    const g = this.wakeGraphics.clear();
    if (reducedMotion()) return;
    for (const wake of this.swim.wakes) {
      const life = (this.swim.elapsedMs - wake.bornAt) / (wake.expiresAt - wake.bornAt);
      if (life < 0 || life > 1) continue;
      this.drawWake(g, wake, life);
    }
  }

  private drawWake(g: Phaser.GameObjects.Graphics, wake: AirWake, life: number): void {
    const fade = (1 - life) * .34;
    const radius = 9 + life * 26;
    g.lineStyle(2, 0xdff1ff, fade).strokeCircle(wake.position.x, wake.position.y - 34, radius);
    g.lineStyle(1, 0xffffff, fade * .7).strokeCircle(wake.position.x + radius * .3, wake.position.y - 34 - radius * .25, radius * .45);
  }
}
