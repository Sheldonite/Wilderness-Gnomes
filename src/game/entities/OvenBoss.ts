import Phaser from 'phaser';
import { OVEN, OVEN_LOOK } from '../config/ovenBoss';
import { OvenWalk } from '../core/OvenWalk';
import { OVEN_TEXTURE } from '../config/ovenSprite';
import type { OvenEncounter } from '../core/OvenEncounter';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import { EnemyController } from './EnemyController';

export class OvenBoss extends EnemyController {
  private readonly walk = new OvenWalk();
  constructor(scene: Phaser.Scene, point: Vector2Like, navigation: SceneryNavigation, private readonly encounter: OvenEncounter) {
    super(scene, point.x, point.y, 0, navigation, { texture: OVEN_TEXTURE, radius: OVEN.radius,
      scale: OVEN_LOOK.height / scene.textures.getFrame(OVEN_TEXTURE, 0).realHeight, animation: 'oven-walk',
      shadow: { foot: 0, width: OVEN_LOOK.shadowWidth, height: OVEN_LOOK.shadowHeight, alpha: 1, contactAlpha: .3 } });
    this.health = OVEN.health;
    this.sprite.anims.stop();
    this.sprite.setFrame(2).setOrigin(.5, 1).setDepth(18);
  }

  override update(deltaMs: number, target: Vector2Like): void {
    if (this.isDead) return;
    if (this.encounter.phase !== 'walking') {
      this.sprite.anims.stop();
      this.sprite.setFrame(this.encounter.phase === 'windup' ? 4 : this.encounter.phase === 'throwing' ? 5 : 2);
      return;
    }
    const before = this.position;
    const remaining = Math.max(0, Math.hypot(target.x - before.x, target.y - before.y) - OVEN.standOff);
    const next = this.navigation!.toward(before, target, Math.min(remaining, OVEN.speed * this.slowMultiplier * deltaMs / 1000), this.radius, this.route);
    this.sprite.setPosition(next.x, next.y);
    this.sprite.anims.stop();
    this.sprite.setFrame(this.walk.update(next.x - before.x, next.y - before.y)).setFlipX(this.walk.flipX);
  }
}
