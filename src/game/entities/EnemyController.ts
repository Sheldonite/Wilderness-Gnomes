import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import {
  ENEMY_SPRITE_KEY,
  ENEMY_WALK_ANIMATION_BY_DIRECTION
} from '../config/enemySprite';
import type { Vector2Like } from '../core/types';
import { clampToArena, normalize } from '../utils/math';

let nextEnemyId = 1;
const ENEMY_SPRITE_SCALE = 0.72;

export class EnemyController {
  readonly id = nextEnemyId++;
  readonly radius = BALANCE.enemy.radius;
  readonly sprite: Phaser.GameObjects.Sprite;
  health: number = BALANCE.enemy.health;
  isDead = false;
  lastContactDamageAt = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number, difficultyMinutes: number) {
    this.sprite = scene.add.sprite(x, y, ENEMY_SPRITE_KEY, 0);
    this.sprite.setDepth(10);
    this.sprite.setScale(ENEMY_SPRITE_SCALE);
    this.sprite.play('enemy-walk-down');
    this.health = Math.round(BALANCE.enemy.health + difficultyMinutes * 8);
  }

  update(deltaMs: number, target: Vector2Like, difficultyMinutes: number): void {
    const speed = BALANCE.enemy.speed + difficultyMinutes * 8;
    const direction = normalize(target.x - this.sprite.x, target.y - this.sprite.y);
    const dt = deltaMs / 1000;
    const next = clampToArena(
      {
        x: this.sprite.x + direction.x * speed * dt,
        y: this.sprite.y + direction.y * speed * dt
      },
      this.radius
    );

    this.sprite.setPosition(next.x, next.y);
    this.updateAnimation(direction);
  }

  private updateAnimation(direction: Vector2Like): void {
    const horizontal = Math.sign(Math.round(direction.x));
    const vertical = Math.sign(Math.round(direction.y));
    const animationKey = ENEMY_WALK_ANIMATION_BY_DIRECTION[`${horizontal},${vertical}`];

    if (animationKey) {
      this.sprite.play(animationKey, true);
    }
  }

  takeDamage(amount: number): boolean {
    if (this.isDead) {
      return true;
    }

    this.health -= amount;
    this.sprite.setTint(0xffffff);
    this.sprite.scene.time.delayedCall(70, () => this.sprite.clearTint());
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
