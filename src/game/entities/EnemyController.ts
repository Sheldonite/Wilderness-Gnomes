import { createNavigationRoute, type SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import type { ActorShadow } from '../systems/PresentationSystem';
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
  protected readonly route = createNavigationRoute();
  readonly id = nextEnemyId++;
  readonly radius: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  health: number = BALANCE.enemy.health;
  isDead = false;
  slowMultiplier = 1;
  lastContactDamageAt = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number, difficultyMinutes: number, protected readonly navigation?: SceneryNavigation,
    appearance?: { texture: string; radius: number; scale: number; animation: string; shadow?: ActorShadow }) {
    this.radius = appearance?.radius ?? BALANCE.enemy.radius;
    const spawn = navigation?.nearest({ x, y }, this.radius) ?? { x, y };
    this.sprite = scene.add.sprite(spawn.x, spawn.y, appearance?.texture ?? ENEMY_SPRITE_KEY, 0);
    this.sprite.setDepth(10);
    this.sprite.setScale(appearance?.scale ?? ENEMY_SPRITE_SCALE);
    this.sprite.play(appearance?.animation ?? 'enemy-walk-down');
    scene.events.emit('presentation:actor', this.sprite, appearance?.shadow);
    this.health = Math.round(BALANCE.enemy.health + difficultyMinutes * 8);
  }

  update(deltaMs: number, target: Vector2Like, difficultyMinutes: number): void {
    if (this.isDead) return;
    const speed = (BALANCE.enemy.speed + difficultyMinutes * 8) * this.slowMultiplier;
    const direction = normalize(target.x - this.sprite.x, target.y - this.sprite.y);
    const dt = deltaMs / 1000;
    const next = clampToArena(
      {
        x: this.sprite.x + direction.x * speed * dt,
        y: this.sprite.y + direction.y * speed * dt
      },
      this.radius
    );

    const safe = this.navigation?.toward(this.position, target, speed * dt, this.radius, this.route) ?? next;
    const actual = normalize(safe.x - this.sprite.x, safe.y - this.sprite.y);
    this.sprite.setPosition(safe.x, safe.y);
    this.updateAnimation(actual);
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
      return false;
    }

    this.health -= amount;
    this.sprite.scene.events.emit('presentation:hit', this.sprite);
    this.isDead = this.health <= 0;
    return this.isDead;
  }

  displace(x: number, y: number): void {
    const target = { x: this.sprite.x + x, y: this.sprite.y + y };
    const safe = this.navigation?.move(this.position, target, this.radius) ?? clampToArena(target, this.radius);
    this.sprite.setPosition(safe.x, safe.y);
  }

  destroy(): void {
    this.sprite.destroy();
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }
}
