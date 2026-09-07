import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import {
  ENEMY_SPRITE_KEY,
  ENEMY_WALK_ANIMATION_BY_DIRECTION,
  GREY_ENEMY_SPRITE_KEY,
  GREY_ENEMY_WALK_ANIMATION_BY_DIRECTION
} from '../config/enemySprite';
import type { Vector2Like } from '../core/types';
import { RangedSquirrelBehavior } from '../core/SquirrelBehavior';
import { clampToArena, normalize } from '../utils/math';

let nextEnemyId = 1;
const ENEMY_SPRITE_SCALE = 0.72;

/** Brown squirrels charge; grey squirrels hang back and throw acorns. */
export type EnemyVariant = 'brown' | 'grey';

export class EnemyController {
  readonly id = nextEnemyId++;
  readonly radius = BALANCE.enemy.radius;
  readonly sprite: Phaser.GameObjects.Sprite;
  health: number = BALANCE.enemy.health;
  isDead = false;
  slowMultiplier = 1;
  lastContactDamageAt = -Infinity;
  private readonly ranged?: RangedSquirrelBehavior;
  private readonly walkAnimations: Record<string, string>;

  constructor(scene: Phaser.Scene, x: number, y: number, difficultyMinutes: number, readonly variant: EnemyVariant = 'brown') {
    const ranged = variant === 'grey';
    this.sprite = scene.add.sprite(x, y, ranged ? GREY_ENEMY_SPRITE_KEY : ENEMY_SPRITE_KEY, 0);
    this.walkAnimations = ranged ? GREY_ENEMY_WALK_ANIMATION_BY_DIRECTION : ENEMY_WALK_ANIMATION_BY_DIRECTION;
    this.sprite.setDepth(10);
    this.sprite.setScale(ENEMY_SPRITE_SCALE);
    this.sprite.play(this.walkAnimations['0,1']);
    scene.events.emit('presentation:actor', this.sprite);
    const baseHealth = ranged ? BALANCE.rangedEnemy.health : BALANCE.enemy.health;
    this.health = Math.round(baseHealth + difficultyMinutes * 8);
    if (ranged) this.ranged = new RangedSquirrelBehavior();
  }

  get isRanged(): boolean {
    return this.variant === 'grey';
  }

  update(deltaMs: number, target: Vector2Like, difficultyMinutes: number): void {
    if (this.isDead) return;
    const baseSpeed = this.isRanged ? BALANCE.rangedEnemy.speed : BALANCE.enemy.speed;
    const speed = (baseSpeed + difficultyMinutes * 8) * this.slowMultiplier;
    const direction = this.ranged
      ? this.ranged.steer(this.position, target)
      : normalize(target.x - this.sprite.x, target.y - this.sprite.y);
    this.ranged?.tick(deltaMs);
    const dt = deltaMs / 1000;
    const next = clampToArena(
      {
        x: this.sprite.x + direction.x * speed * dt,
        y: this.sprite.y + direction.y * speed * dt
      },
      this.radius
    );

    this.sprite.setPosition(next.x, next.y);
    if (direction.x === 0 && direction.y === 0) {
      // face the player while holding position
      this.updateAnimation(normalize(target.x - this.sprite.x, target.y - this.sprite.y));
      this.sprite.anims.pause();
    } else {
      this.updateAnimation(direction);
    }
  }

  /** Returns a launch velocity when this squirrel is ready to throw at the target, else undefined. */
  tryThrow(target: Vector2Like): Vector2Like | undefined {
    if (!this.ranged || this.isDead) return undefined;
    return this.ranged.tryThrow(this.position, target);
  }

  private updateAnimation(direction: Vector2Like): void {
    const horizontal = Math.sign(Math.round(direction.x));
    const vertical = Math.sign(Math.round(direction.y));
    const animationKey = this.walkAnimations[`${horizontal},${vertical}`];

    if (animationKey) {
      if (this.sprite.anims.isPaused) this.sprite.anims.resume();
      this.sprite.play(animationKey, true);
    }
  }

  takeDamage(amount: number): boolean {
    if (this.isDead) {
      return false;
    }

    this.health -= amount;
    this.sprite.scene.events.emit('presentation:hit', this.sprite);
    this.isDead = this.health <= 0;
    return this.isDead;
  }

  destroy(): void {
    this.sprite.destroy();
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }
}
