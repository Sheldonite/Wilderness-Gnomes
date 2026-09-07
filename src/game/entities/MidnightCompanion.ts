import type { SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import { MIDNIGHT_SPRITE_KEY, midnightScale } from '../config/midnightSprite';
import { LOOK, reducedMotion } from '../config/presentation';
import { MidnightBehavior } from '../core/MidnightBehavior';
import type { CombatTarget, DealDamage } from '../core/CombatResolver';
import type { Vector2Like } from '../core/types';

export class MidnightCompanion {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly behavior: MidnightBehavior;
  private readonly swatArc: Phaser.GameObjects.Graphics;
  private seenSwat = 0;
  private seenImpact = 0;
  private flashMs = 0;

  constructor(private readonly scene: Phaser.Scene, player: Vector2Like, navigation?: SceneryNavigation) {
    this.behavior = new MidnightBehavior(player, navigation);
    this.sprite = scene.add.sprite(this.position.x, this.position.y, MIDNIGHT_SPRITE_KEY, 'walk-down-0')
      .setScale(midnightScale(scene)).setDepth(LOOK.depth.companion);
    this.swatArc = scene.add.graphics().setDepth(LOOK.depth.companion + 1);
    scene.events.emit('presentation:actor', this.sprite);
  }

  update(deltaMs: number, player: Vector2Like, enemies: CombatTarget[], damage: DealDamage): void {
    this.behavior.update(deltaMs, player, enemies, damage);
    this.sprite.setPosition(this.position.x, this.position.y);
    if (this.behavior.state === 'swatting') {
      if (this.seenSwat !== this.behavior.swatSerial) {
        this.seenSwat = this.behavior.swatSerial;
        this.sprite.play(`midnight-swat-${this.behavior.facing}`);
      }
    } else if (this.behavior.moving) this.sprite.play(`midnight-walk-${this.behavior.facing}`, true);
    else { this.sprite.anims.stop(); this.sprite.setFrame('swat-down-0'); }
    this.flashMs = Math.max(0, this.flashMs - deltaMs);
    if (this.seenImpact !== this.behavior.impactSerial) { this.seenImpact = this.behavior.impactSerial; this.flashMs = 140; }
    this.swatArc.clear();
    if (this.flashMs > 0) {
      const angle = this.behavior.facing === 'right' ? 0 : this.behavior.facing === 'left' ? Math.PI : this.behavior.facing === 'up' ? -Math.PI / 2 : Math.PI / 2;
      const alpha = reducedMotion() ? .3 : this.flashMs / 140 * .65;
      this.swatArc.lineStyle(2, LOOK.color.cream, alpha);
      for (let i = 0; i < 3; i++) this.swatArc.beginPath().arc(this.position.x, this.position.y, 24 + i * 5, angle - .65, angle + .65).strokePath();
    }
  }

  destroy(): void { this.sprite.destroy(); this.swatArc.destroy(); }
  get position(): Vector2Like { return this.behavior.position; }
}
