import type { SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME_CONFIG } from '../config/gameConfig';
import type { PlayerCharacterDefinition } from '../config/playerCharacters';
import { reducedMotion } from '../config/presentation';
import { WEAPONS } from '../config/weapons';
import type { PlayerStats, Vector2Like } from '../core/types';
import { clampToArena, lerpAngle, normalize } from '../utils/math';
import { PlayerAura } from './PlayerAura';

export class PlayerController {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly radius = BALANCE.player.radius;
  private movementDirection: Vector2Like = { x: 0, y: 0 };
  private aura?: PlayerAura;
  private idleTime = 0;
  private readonly arm?: Phaser.GameObjects.Image;
  private readonly armWidth: number = 0;
  private readonly armHeight: number = 0;
  private readonly orbitRadius: number = 0;
  private aimAngle = 0;
  private displayedAim = 0;
  private recoil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly stats: PlayerStats,
    private readonly character: PlayerCharacterDefinition,
    x: number,
    y: number,
    private readonly navigation?: SceneryNavigation
  ) {
    this.sprite = scene.add.sprite(x, y, character.textureKey, 0);
    this.sprite.setDepth(20);
    this.sprite.setScale(character.scale);
    this.playAnimation(character.idleAnimation);
    scene.events.emit('presentation:actor', this.sprite);

    if (character.aura) {
      this.aura = new PlayerAura(scene, this.position);
    }

    const arm = WEAPONS[stats.weaponId];
    if (arm.overlayTexture) {
      const width = character.id === 'hailey' ? Math.round((arm.overlayWidth ?? 46) * 0.88) : (arm.overlayWidth ?? 46);
      this.arm = scene.add.image(x, y, arm.overlayTexture);
      this.arm.setOrigin(arm.overlayOrigin?.x ?? 0.39, arm.overlayOrigin?.y ?? 0.5);
      const source = this.arm.width / Math.max(1, this.arm.height);
      this.armWidth = width;
      this.armHeight = width / source;
      this.orbitRadius = arm.orbitRadius ?? 36;
      this.arm.setDisplaySize(this.armWidth, this.armHeight).setDepth(21);
    }
  }

  setAim(angle: number): void {
    this.aimAngle = angle;
  }

  kickArm(): void {
    this.recoil = 1;
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

    const safe = this.navigation?.move(this.position, next, this.radius) ?? next;
    this.movementDirection = normalize(safe.x - this.sprite.x, safe.y - this.sprite.y);
    this.sprite.setPosition(safe.x, safe.y);
    this.updateAnimation(this.movementDirection);
    this.updateSecondaryMotion(deltaMs, this.movementDirection);
    this.aura?.update(deltaMs, this.position);
  }

  presentArm(deltaMs: number): void {
    this.updateArm(deltaMs);
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

    if (reducedMotion() || (!moving && this.character.id === 'hailey')) {
      this.sprite.setRotation(0).setScale(baseScale);
      if (this.character.id === 'hailey' && !moving) {
        // Her standing frames already breathe, anchored at the soles.
        if (reducedMotion()) this.sprite.anims.pause(this.sprite.anims.currentAnim?.frames[0]);
        else this.sprite.anims.resume();
      }
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

  private updateArm(deltaMs: number): void {
    if (!this.arm) return;
    const calm = reducedMotion();
    const turn = calm ? 1 : 1 - Math.exp(-10 * (deltaMs / 1000));
    this.displayedAim = lerpAngle(this.displayedAim, this.aimAngle, turn);
    this.recoil = calm ? 0 : Math.max(0, this.recoil - deltaMs / 160);

    const kick = this.recoil * this.recoil;
    const radius = this.orbitRadius - kick * 8;
    this.arm.setPosition(
      this.sprite.x + Math.cos(this.displayedAim) * radius,
      this.sprite.y + Math.sin(this.displayedAim) * radius
    );
    this.arm.setRotation(this.displayedAim);
    this.arm.setDisplaySize(this.armWidth, this.armHeight);
    this.arm.setDepth(Math.sin(this.displayedAim) >= 0.12 ? 21 : 19);
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
