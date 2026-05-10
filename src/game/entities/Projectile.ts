import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import type { Vector2Like } from '../core/types';

let nextProjectileId = 1;

export class Projectile {
  readonly id = nextProjectileId++;
  readonly radius = BALANCE.weapon.projectileRadius;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly hitEnemyIds = new Set<number>();
  ageMs = 0;
  isDead = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly velocity: Vector2Like,
    private readonly lifetimeMs: number,
    readonly damage: number
  ) {
    this.sprite = scene.add.sprite(x, y, 'projectile-placeholder');
    this.sprite.setDepth(15);
    this.sprite.setRotation(Math.atan2(velocity.y, velocity.x));
  }

  update(deltaMs: number): void {
    if (this.isDead) {
      return;
    }

    const dt = deltaMs / 1000;
    this.sprite.setPosition(this.sprite.x + this.velocity.x * dt, this.sprite.y + this.velocity.y * dt);
    this.ageMs += deltaMs;

    if (this.ageMs >= this.lifetimeMs) {
      this.isDead = true;
    }
  }

  markHit(enemyId: number): void {
    this.hitEnemyIds.add(enemyId);
    this.isDead = true;
  }

  destroy(): void {
    this.sprite.destroy();
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }
}
