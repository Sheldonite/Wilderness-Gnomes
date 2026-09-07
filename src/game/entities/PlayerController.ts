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
  private idleTime = 0;
  private readonly arm?: Phaser.GameObjects.Image;
  private aimAngle = 0;

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

    if (stats.weaponId === 'crossbow') {
      this.arm = scene.add.image(x, y, 'heartwood-crossbow');
      this.arm.setDepth(21).setOrigin(0.28, 0.55).setScale(0.084);
    }
  }

  setAim(angle: number): void {
    this.aimAngle = angle;
    this.updateArm();
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
    this.updateArm();
    this.aura?.update(deltaMs, this.position);
  }

  /**
   * A small lean into horizontal movement while walking and a gentle breath
   * while idle. Purely visual: it uses rotation and scale, never the sprite's
   * world position that gameplay reads. The walk bounce itself is baked into
   * the sprite frames.
   */
  private updateSecondaryMotion(deltaMs: number, direction: Vector2Like): void {
    const moving = direction.x !== 0 || direction.y !== 0;
    const baseScale = this.character.scale;

    if (reducedMotion()) {
      this.sprite.setRotation(0).setScale(baseScale);
      return;
    }

    if (moving) {
      this.idleTime = 0;
      this.sprite.setRotation(direction.x * 0.04).setScale(baseScale);
      return;
    }

    this.idleTime += deltaMs;
    const breath = Math.sin((this.idleTime / 1000) * Math.PI * 2 * 0.6);
    this.sprite
      .setRotation(0)
      .setScale(baseScale * (1 - 0.006 * breath), baseScale * (1 + 0.012 * breath));
  }

  destroy(): void {
    this.aura?.destroy();
    this.arm?.destroy();
    this.sprite.destroy();
  }

  private updateArm(): void {
    if (!this.arm) return;
    const hold = 14;
    this.arm.setPosition(
      this.sprite.x + Math.cos(this.aimAngle) * hold,
      this.sprite.y + Math.sin(this.aimAngle) * hold + 8
    );
    this.arm.setRotation(this.aimAngle + 0.22);
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
