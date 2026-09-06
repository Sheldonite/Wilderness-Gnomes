import Phaser from 'phaser';
import { LOOK } from '../config/presentation';
import { BALANCE } from '../config/balance';
import type { Vector2Like } from '../core/types';
import { distanceSq, normalize } from '../utils/math';

export class XPOrb {
  readonly radius = BALANCE.xp.radius;
  readonly sprite: Phaser.GameObjects.Sprite;
  isCollected = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly value: number
  ) {
    this.sprite = scene.add.sprite(x, y, LOOK.texture.crystal).setDisplaySize(21, 21);
    this.sprite.setDepth(5);
  }

  update(deltaMs: number, playerPosition: Vector2Like): void {
    if (this.isCollected) {
      return;
    }

    const magnetRangeSq = BALANCE.xp.magnetRange * BALANCE.xp.magnetRange;
    if (distanceSq(this.position, playerPosition) > magnetRangeSq) {
      return;
    }

    const direction = normalize(playerPosition.x - this.sprite.x, playerPosition.y - this.sprite.y);
    const dt = deltaMs / 1000;
    this.sprite.setPosition(
      this.sprite.x + direction.x * BALANCE.xp.magnetSpeed * dt,
      this.sprite.y + direction.y * BALANCE.xp.magnetSpeed * dt
    );
  }

  collect(): void {
    this.sprite.scene.events.emit('presentation:collect', this.position);
    this.isCollected = true;
  }

  destroy(): void {
    this.sprite.destroy();
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }
}
