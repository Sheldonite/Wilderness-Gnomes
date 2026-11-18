import Phaser from 'phaser';
import { GREY_ENEMY_SPRITE_KEY, GREY_ENEMY_WALK_ANIMATION_BY_DIRECTION } from '../config/enemySprite';
import { SQUIRREL_CHIEF, SQUIRREL_CHIEF_LOOK } from '../config/squirrelChief';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { SquirrelChiefEncounter } from '../core/SquirrelChiefEncounter';
import { bossPursuitStep } from '../core/BossPursuit';
import type { Vector2Like } from '../core/types';
import { normalize } from '../utils/math';
import { EnemyController } from './EnemyController';

/**
 * Squirrel Chief: 1.7x scaled warband squirrel with crimson/gold tint,
 * grounded shadow, telegraphed charge, acorn barrage, and catch-breath vulnerability window.
 */
export class SquirrelChiefBoss extends EnemyController {
  constructor(
    scene: Phaser.Scene,
    point: Vector2Like,
    navigation: SceneryNavigation | undefined,
    private readonly encounter: SquirrelChiefEncounter,
    health: number = SQUIRREL_CHIEF.health
  ) {
    super(
      scene,
      point.x,
      point.y,
      0,
      navigation,
      {
        texture: GREY_ENEMY_SPRITE_KEY,
        radius: SQUIRREL_CHIEF.radius,
        scale: SQUIRREL_CHIEF.scale,
        animation: GREY_ENEMY_WALK_ANIMATION_BY_DIRECTION['0,1'],
        shadow: {
          foot: 0,
          width: SQUIRREL_CHIEF_LOOK.shadowWidth,
          height: SQUIRREL_CHIEF_LOOK.shadowHeight,
          alpha: 0.9,
          contactAlpha: 0.35
        },
        boss: { contactDamage: SQUIRREL_CHIEF.contactDamage }
      },
      'grey'
    );
    this.health = this.maxHealth = health;
    this.sprite.setDepth(16);
    this.setBaseTint(SQUIRREL_CHIEF.tint);
  }

  override update(deltaMs: number, target: Vector2Like): void {
    if (this.isDead) return;
    const phase = this.encounter.phase;
    this.vulnerability = this.encounter.vulnerable ? SQUIRREL_CHIEF.vulnerableMultiplier : 1;
    const step = this.encounter.chargeStep;
    this.sprite.setPosition(this.sprite.x + step.x, this.sprite.y + step.y);

    if (phase === 'charging') {
      this.setBaseTint(SQUIRREL_CHIEF.tint);
      this.updateAnimation(normalize(step.x, step.y));
      return;
    }

    if (phase === 'chargeWindup') {
      this.setBaseTint(SQUIRREL_CHIEF.tint);
      const dir = this.encounter.lane?.direction ?? normalize(target.x - this.position.x, target.y - this.position.y);
      this.updateAnimation(dir);
      this.sprite.anims.pause();
      return;
    }

    if (phase === 'barrageWindup') {
      this.setBaseTint(SQUIRREL_CHIEF.tint);
      const dir = this.encounter.barrageAim ?? normalize(target.x - this.position.x, target.y - this.position.y);
      this.updateAnimation(dir);
      this.sprite.anims.pause();
      return;
    }

    if (phase === 'catchBreath') {
      this.setBaseTint(SQUIRREL_CHIEF.vulnerableTint);
      this.sprite.anims.pause();
      return;
    }

    // arrival / stalking
    this.setBaseTint(SQUIRREL_CHIEF.tint);
    const before = this.position;
    const walk = bossPursuitStep(before, target, 0, SQUIRREL_CHIEF.speed, this.effectiveSlow, deltaMs);
    this.sprite.setPosition(before.x + walk.x, before.y + walk.y);
    this.updateAnimation(normalize(target.x - before.x, target.y - before.y));
  }
}
