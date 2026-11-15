import Phaser from 'phaser';
import { LOOK } from '../config/presentation';
import { BALANCE } from '../config/balance';
import { ABILITIES } from '../config/abilities';
import type { Vector2Like } from '../core/types';
import { distanceSq, normalize } from '../utils/math';

export class XPOrb {
  readonly radius = BALANCE.xp.radius;
  readonly sprite: Phaser.GameObjects.Sprite;
  isCollected = false;
  private magnetized = false;
  private ageMs = 0;

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

    this.ageMs += deltaMs;
    const effectiveRange = BALANCE.xp.magnetRange * Math.max(0.1, magnetMultiplier);
    const magnetRangeSq = effectiveRange * effectiveRange;
    const distSq = distanceSq(this.position, playerPosition);
    const direction = normalize(playerPosition.x - this.sprite.x, playerPosition.y - this.sprite.y);
    const dt = deltaMs / 1000;
    const dist = Math.sqrt(distSq);

    if (!this.magnetized && distSq > magnetRangeSq) {
      const driftMs = Math.max(0, Math.min(deltaMs, this.ageMs - 100));
      if (driftMs <= 0) return;
      const drift = Math.min(dist, BALANCE.xp.idleSpeed * (driftMs / 1000));
      this.sprite.setPosition(
        this.sprite.x + direction.x * drift,
        this.sprite.y + direction.y * drift
      );
      return;
    }

    const travel = Math.min(dist,
      (this.magnetized ? ABILITIES.magnet.speed : BALANCE.xp.magnetSpeed) * dt);
    this.sprite.setPosition(
      this.sprite.x + direction.x * travel,
      this.sprite.y + direction.y * travel
    );
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
