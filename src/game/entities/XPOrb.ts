import Phaser from 'phaser';
import { LOOK } from '../config/presentation';
import { BALANCE } from '../config/balance';
import { ABILITIES } from '../config/abilities';
import type { Vector2Like } from '../core/types';

export class XPOrb {
  readonly radius = BALANCE.xp.radius;
  readonly sprite: Phaser.GameObjects.Sprite;
  isCollected = false;
  private magnetized = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly value: number
  ) {
    // Richer creatures drop visibly bigger crystals.
    const size = 21 + Math.min(17, Math.max(0, value - BALANCE.enemy.xpValue) / 4);
    this.sprite = scene.add.sprite(x, y, LOOK.texture.crystal).setDisplaySize(size, size);
    this.sprite.setDepth(5);
  }

  update(deltaMs: number, playerPosition: Vector2Like, magnetMultiplier = 1): void {
    if (this.isCollected) {
      return;
    }

    const effectiveRange = BALANCE.xp.magnetRange * Math.max(0.1, magnetMultiplier);
    const dx = playerPosition.x - this.sprite.x;
    const dy = playerPosition.y - this.sprite.y;
    const distSq = dx * dx + dy * dy;
    if (distSq === 0 || (!this.magnetized && distSq > effectiveRange ** 2)) return;

    const speed = this.magnetized ? ABILITIES.magnet.speed : BALANCE.xp.magnetSpeed;
    const step = Math.min(1, speed * deltaMs / (1000 * Math.sqrt(distSq)));
    this.sprite.setPosition(this.sprite.x + dx * step, this.sprite.y + dy * step);
  }

  collect(): void {
    this.sprite.scene.events.emit('presentation:collect', this.position);
    this.isCollected = true;
  }

  attract(): void { this.magnetized = true; }

  destroy(): void {
    this.sprite.destroy();
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }
}
