import type { SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import type { PlayerCharacterDefinition } from '../config/playerCharacters';
import { LOOK, reducedMotion } from '../config/presentation';
import { WEAPONS } from '../config/weapons';
import type { PlayerStats, Vector2Like } from '../core/types';
import { lerpAngle, normalize } from '../utils/math';
import { PlayerAura } from './PlayerAura';

export const WOODLAND_DASH = {
  durationMs: 175,
  speedMultiplier: 2.9,
  cooldownMs: 2400,
  trailIntervalMs: 36
} as const;

export interface MovementKeys {
  w: { isDown: boolean };
  a: { isDown: boolean };
  s: { isDown: boolean };
  d: { isDown: boolean };
  up?: { isDown: boolean };
  down?: { isDown: boolean };
  left?: { isDown: boolean };
  right?: { isDown: boolean };
}

export interface PlayerMoveInput {
  x: number;
  y: number;
  dash?: boolean;
}

export class PlayerController {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly radius = BALANCE.player.radius;
  private movementDirection: Vector2Like = { x: 0, y: 0 };
  private facingDirection: Vector2Like = { x: 0, y: 1 };
  private aura?: PlayerAura;
  private idleTime = 0;
  private readonly arm?: Phaser.GameObjects.Image;
  private readonly armWidth: number = 0;
  private readonly armHeight: number = 0;
  private readonly orbitRadius: number = 0;
  private aimAngle = 0;
  private displayedAim = 0;
  private recoil = 0;
  private dashRemainingMs = 0;
  private dashCooldownMs = 0;
  private dashDirection: Vector2Like = { x: 0, y: 1 };
  private dashTrailMs = 0;
  private hitBlinkRemainingMs = 0;
  private hitBlinkElapsedMs = 0;

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

  get isDashing(): boolean {
    return this.dashRemainingMs > 0;
  }

  get isHitInvulnerable(): boolean {
    return this.hitBlinkRemainingMs > 0;
  }

  /** Remaining dash cooldown as a ratio in `[0, 1]`, where `0` means ready to dash. */
  get dashCooldownRatio(): number {
    return this.dashCooldownMs <= 0 ? 0 : Math.min(1, this.dashCooldownMs / WOODLAND_DASH.cooldownMs);
  }

  tryDash(direction?: Vector2Like): boolean {
    if (this.dashCooldownMs > 0 || this.dashRemainingMs > 0) return false;
    const candidate = direction && (direction.x !== 0 || direction.y !== 0)
      ? direction
      : (this.movementDirection.x !== 0 || this.movementDirection.y !== 0)
        ? this.movementDirection
        : this.facingDirection;
    const dir = normalize(candidate.x, candidate.y);
    this.dashDirection = dir.x === 0 && dir.y === 0 ? { x: 0, y: 1 } : dir;
    this.dashRemainingMs = WOODLAND_DASH.durationMs;
    this.dashCooldownMs = WOODLAND_DASH.cooldownMs;
    this.dashTrailMs = 0;
    this.scene.events.emit('presentation:dash', this.position);
    this.scene.events.emit('audio:play', 'dash');
    return true;
  }

  triggerHitBlink(durationMs: number = BALANCE.player.contactInvulnerabilityMs): void {
    this.hitBlinkRemainingMs = Math.max(this.hitBlinkRemainingMs, durationMs);
    this.hitBlinkElapsedMs = 0;
  }

  setAim(angle: number): void {
    this.aimAngle = angle;
  }

  kickArm(): void {
    this.recoil = 1;
  }

  update(deltaMs: number, input: MovementKeys | PlayerMoveInput): void {
    if (this.dashCooldownMs > 0) {
      this.dashCooldownMs = Math.max(0, this.dashCooldownMs - deltaMs);
    }

    this.updateHitBlink(deltaMs);

    let rawDirection: Vector2Like;
    if ('w' in input) {
      const horizontal = Number(input.d.isDown || Boolean(input.right?.isDown))
        - Number(input.a.isDown || Boolean(input.left?.isDown));
      const vertical = Number(input.s.isDown || Boolean(input.down?.isDown))
        - Number(input.w.isDown || Boolean(input.up?.isDown));
      rawDirection = normalize(horizontal, vertical);
    } else {
      const mag = Math.hypot(input.x, input.y);
      rawDirection = mag > 1
        ? { x: input.x / mag, y: input.y / mag }
        : mag > 0
          ? { x: input.x, y: input.y }
          : { x: 0, y: 0 };
      if (input.dash) {
        this.tryDash(rawDirection);
      }
    }

    let moveVector = rawDirection;
    const speedBonus = 1 + this.stats.shoutMoveSpeedBonus + (this.stats.shrineMoveSpeedBonus ?? 0);
    let moveSpeed = this.stats.speed * speedBonus * (this.stats.moveSlow ?? 1);

    if (this.dashRemainingMs > 0) {
      this.dashRemainingMs = Math.max(0, this.dashRemainingMs - deltaMs);
      this.dashTrailMs -= deltaMs;
      while (this.dashTrailMs <= 0 && this.dashRemainingMs > 0) {
        this.dashTrailMs += WOODLAND_DASH.trailIntervalMs;
        this.scene.events.emit('presentation:trail', this.position, LOOK.color.cream);
        this.scene.events.emit('presentation:trail', this.position, LOOK.ability.ward);
      }
      moveVector = this.dashDirection;
      moveSpeed = this.stats.speed * speedBonus * WOODLAND_DASH.speedMultiplier;
    }

    const dt = deltaMs / 1000;
    const next = {
      x: this.sprite.x + moveVector.x * moveSpeed * dt,
      y: this.sprite.y + moveVector.y * moveSpeed * dt
    };

    const safe = this.navigation?.move(this.position, next, this.radius) ?? next;
    this.movementDirection = normalize(safe.x - this.sprite.x, safe.y - this.sprite.y);
    this.sprite.setPosition(safe.x, safe.y);
    this.updateAnimation(this.movementDirection);
    this.updateSecondaryMotion(deltaMs, this.movementDirection);
    this.aura?.update(deltaMs, this.position);
  }

  private updateHitBlink(deltaMs: number): void {
    if (this.hitBlinkRemainingMs <= 0) return;
    this.hitBlinkRemainingMs = Math.max(0, this.hitBlinkRemainingMs - deltaMs);
    this.hitBlinkElapsedMs += deltaMs;
    if (this.hitBlinkRemainingMs <= 0) {
      this.sprite.setAlpha(1);
      this.arm?.setAlpha(1);
      return;
    }
    const alpha = reducedMotion()
      ? 0.72
      : Math.floor(this.hitBlinkElapsedMs / 65) % 2 === 0
        ? 0.35
        : 1;
    this.sprite.setAlpha(alpha);
    this.arm?.setAlpha(alpha);
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

    if (reducedMotion() || this.character.bakedAnimation || (!moving && this.character.id === 'hailey')) {
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
      if (this.isDashing) {
        this.sprite.setRotation(direction.x * 0.12).setScale(baseScale * 1.07, baseScale * 0.94);
      } else {
        this.sprite.setRotation(direction.x * 0.04).setScale(baseScale);
      }
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
      this.playAnimation(this.character.idleForDirection?.(this.facingDirection) ?? this.character.idleAnimation);
      return;
    }

    this.facingDirection = { ...direction };
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

}
