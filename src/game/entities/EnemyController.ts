import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import type { Vector2Like } from '../core/types';
import { clampToArena, normalize } from '../utils/math';

let nextEnemyId = 1;

export class EnemyController {
  readonly id = nextEnemyId++;
  readonly radius = BALANCE.enemy.radius;
  readonly sprite: Phaser.GameObjects.Sprite;
  health: number = BALANCE.enemy.health;
  isDead = false;
  lastContactDamageAt = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number, difficultyMinutes: number) {
    this.sprite = scene.add.sprite(x, y, 'enemy-placeholder');
    this.sprite.setDepth(10);
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
    this.sprite.setFlipX(direction.x < 0);
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
