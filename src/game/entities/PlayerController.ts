import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME_CONFIG } from '../config/gameConfig';
import type { PlayerCharacterDefinition } from '../config/playerCharacters';
import { reducedMotion } from '../config/presentation';
import type { PlayerStats, Vector2Like } from '../core/types';
import { clampToArena, normalize } from '../utils/math';
import { PlayerAura } from './PlayerAura';

export class PlayerController {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly radius = BALANCE.player.radius;
  private movementDirection: Vector2Like = { x: 0, y: 0 };
  private aura?: PlayerAura;
  /** Phase of the procedural stride bob, in radians. */
  private stridePhase = 0;
  private idleTime = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly stats: PlayerStats,
    private readonly character: PlayerCharacterDefinition,
    x: number,
    y: number
  ) {
    this.sprite = scene.add.sprite(x, y, character.textureKey, 0);
    this.sprite.setDepth(20);
    this.sprite.setScale(character.scale);
    this.playAnimation(character.idleAnimation);
    scene.events.emit('presentation:actor', this.sprite);

    if (character.aura) {
      this.aura = new PlayerAura(scene, this.position);
    }
  }

  update(deltaMs: number, keys: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>): void {
    const horizontal = Number(keys.d.isDown) - Number(keys.a.isDown);
    const vertical = Number(keys.s.isDown) - Number(keys.w.isDown);
    const direction = normalize(horizontal, vertical);
    this.movementDirection = direction;
    const dt = deltaMs / 1000;

    const next = clampToArena(
      {
        x: this.sprite.x + direction.x * this.stats.speed * dt,
        y: this.sprite.y + direction.y * this.stats.speed * dt
      },
      this.radius
    );

    this.sprite.setPosition(next.x, next.y);
    this.updateAnimation(direction);
    this.updateSecondaryMotion(deltaMs, direction);
    this.aura?.update(deltaMs, this.position);
  }

  /**
   * The wizard sheet only has four subtle frames per direction, so a small bob,
   * lean and squash are layered on top to sell weight and momentum. This is
   * purely visual: it moves the drawing via origin, rotation and scale, never
   * the sprite's world position that gameplay reads.
   */
  private updateSecondaryMotion(deltaMs: number, direction: Vector2Like): void {
    const moving = direction.x !== 0 || direction.y !== 0;
    const baseScale = this.character.scale;
    const frameHeight = this.sprite.height;

    if (reducedMotion()) {
      this.sprite.setOrigin(0.5, 0.5).setRotation(0).setScale(baseScale);
      return;
    }

    if (moving) {
      this.idleTime = 0;
      // Three bounces per second, roughly matching the walk animation's stride.
      this.stridePhase += (deltaMs / 1000) * Math.PI * 2 * 3;
      const bounce = Math.abs(Math.sin(this.stridePhase));
      const bobPixels = 3 * bounce;
      const squash = 1 + 0.035 * bounce;
      const lean = direction.x * 0.05;
      this.sprite
        .setOrigin(0.5, 0.5 + bobPixels / frameHeight)
        .setRotation(lean)
        .setScale(baseScale * (2 - squash), baseScale * squash);
      return;
    }

    // Idle: settle the stride and breathe gently.
    this.stridePhase = 0;
    this.idleTime += deltaMs;
    const breath = Math.sin((this.idleTime / 1000) * Math.PI * 2 * 0.6);
    this.sprite
      .setOrigin(0.5, 0.5)
      .setRotation(0)
      .setScale(baseScale * (1 - 0.006 * breath), baseScale * (1 + 0.012 * breath));
  }

  destroy(): void {
    this.aura?.destroy();
    this.sprite.destroy();
  }

  private updateAnimation(direction: Vector2Like): void {
    if (direction.x === 0 && direction.y === 0) {
      this.playAnimation(this.character.idleAnimation);
      return;
    }

    this.playAnimation(this.character.animationForDirection(direction));
  }

  private playAnimation(animation: { key: string; flipX?: boolean }): void {
    this.sprite.setFlipX(Boolean(animation.flipX));
    this.sprite.play(animation.key, true);
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  get currentMovementDirection(): Vector2Like {
    return this.movementDirection;
  }

  resetToCenter(): void {
    this.sprite.setPosition(GAME_CONFIG.arena.width / 2, GAME_CONFIG.arena.height / 2);
  }
}
