import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { LOOK } from '../config/presentation';
import type { Vector2Like } from '../core/types';

/** An acorn thrown by a grey squirrel. Flies straight, spins, and hurts the player on contact. */
export class Acorn {
  readonly radius = BALANCE.rangedEnemy.acornRadius;
  readonly sprite: Phaser.GameObjects.Sprite;
  isDead = false;
  private ageMs = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly velocity: Vector2Like
  ) {
    this.sprite = scene.add.sprite(x, y, LOOK.texture.acorn).setDisplaySize(18, 18);
    this.sprite.setDepth(LOOK.depth.spell);
  }

  update(deltaMs: number): void {
    if (this.isDead) return;
    const dt = deltaMs / 1000;
    this.sprite.setPosition(this.sprite.x + this.velocity.x * dt, this.sprite.y + this.velocity.y * dt);
    this.sprite.rotation += dt * 9;
    this.ageMs += deltaMs;
    if (this.ageMs >= BALANCE.rangedEnemy.acornLifetimeMs) this.isDead = true;
  }

  destroy(): void {
    this.sprite.destroy();
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }
}
