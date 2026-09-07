import { createNavigationRoute, type SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import type { ActorShadow } from '../systems/PresentationSystem';
import { BALANCE } from '../config/balance';
import {
  BUCK_SPRITE_KEY,
  BUCK_WALK_ANIMATION_BY_DIRECTION,
  DOE_SPRITE_KEY,
  DOE_WALK_ANIMATION_BY_DIRECTION,
  ENEMY_SPRITE_KEY,
  ENEMY_WALK_ANIMATION_BY_DIRECTION,
  FAWN_SPRITE_KEY,
  FAWN_WALK_ANIMATION_BY_DIRECTION,
  GREY_ENEMY_SPRITE_KEY,
  GREY_ENEMY_WALK_ANIMATION_BY_DIRECTION
} from '../config/enemySprite';
import type { Vector2Like } from '../core/types';
import { RangedSquirrelBehavior } from '../core/SquirrelBehavior';
import { clampToArena, normalize } from '../utils/math';

let nextEnemyId = 1;

/** Brown squirrels charge, grey squirrels throw acorns, and from level 10 the woods send does, fawns and bucks. */
export type EnemyVariant = 'brown' | 'grey' | 'doe' | 'fawn' | 'buck';

export interface EnemyAppearance {
  texture: string;
  radius: number;
  scale: number;
  animation: string;
  shadow?: ActorShadow;
}

interface VariantProfile {
  textureKey: string;
  walkAnimations: Record<string, string>;
  scale: number;
  health: number;
  speed: number;
  contactDamage: number;
  radius: number;
  ranged: boolean;
}

const VARIANTS: Record<EnemyVariant, VariantProfile> = {
  brown: { textureKey: ENEMY_SPRITE_KEY, walkAnimations: ENEMY_WALK_ANIMATION_BY_DIRECTION, scale: 0.72,
    health: BALANCE.enemy.health, speed: BALANCE.enemy.speed, contactDamage: BALANCE.enemy.contactDamage, radius: BALANCE.enemy.radius, ranged: false },
  grey: { textureKey: GREY_ENEMY_SPRITE_KEY, walkAnimations: GREY_ENEMY_WALK_ANIMATION_BY_DIRECTION, scale: 0.72,
    health: BALANCE.rangedEnemy.health, speed: BALANCE.rangedEnemy.speed, contactDamage: BALANCE.enemy.contactDamage, radius: BALANCE.enemy.radius, ranged: true },
  doe: { textureKey: DOE_SPRITE_KEY, walkAnimations: DOE_WALK_ANIMATION_BY_DIRECTION, scale: BALANCE.deer.doe.scale,
    health: BALANCE.deer.doe.health, speed: BALANCE.deer.doe.speed, contactDamage: BALANCE.deer.doe.contactDamage, radius: BALANCE.deer.doe.radius, ranged: false },
  fawn: { textureKey: FAWN_SPRITE_KEY, walkAnimations: FAWN_WALK_ANIMATION_BY_DIRECTION, scale: BALANCE.deer.fawn.scale,
    health: BALANCE.deer.fawn.health, speed: BALANCE.deer.fawn.speed, contactDamage: BALANCE.deer.fawn.contactDamage, radius: BALANCE.deer.fawn.radius, ranged: false },
  buck: { textureKey: BUCK_SPRITE_KEY, walkAnimations: BUCK_WALK_ANIMATION_BY_DIRECTION, scale: BALANCE.deer.buck.scale,
    health: BALANCE.deer.buck.health, speed: BALANCE.deer.buck.speed, contactDamage: BALANCE.deer.buck.contactDamage, radius: BALANCE.deer.buck.radius, ranged: false }
};

export class EnemyController {
  protected readonly route = createNavigationRoute();
  readonly id = nextEnemyId++;
  readonly radius: number;
  readonly contactDamage: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  health: number;
  isDead = false;
  slowMultiplier = 1;
  lastContactDamageAt = -Infinity;
  private readonly ranged?: RangedSquirrelBehavior;
  private readonly profile: VariantProfile;
  private readonly walkAnimations: Record<string, string>;

  /**
   * `appearance` lets a subclass (the boss) bring its own texture and collision size;
   * ordinary spawns pick everything from their `variant`.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, difficultyMinutes: number, protected readonly navigation?: SceneryNavigation,
    appearance?: EnemyAppearance, readonly variant: EnemyVariant = 'brown') {
    const profile = VARIANTS[variant];
    this.profile = profile;
    this.radius = appearance?.radius ?? profile.radius;
    this.contactDamage = profile.contactDamage;
    const spawn = navigation?.nearest({ x, y }, this.radius) ?? { x, y };
    this.sprite = scene.add.sprite(spawn.x, spawn.y, appearance?.texture ?? profile.textureKey, 0);
    this.walkAnimations = profile.walkAnimations;
    this.sprite.setDepth(10);
    this.sprite.setScale(appearance?.scale ?? profile.scale);
    this.sprite.play(appearance?.animation ?? this.walkAnimations['0,1']);
    scene.events.emit('presentation:actor', this.sprite, appearance?.shadow);
    this.health = Math.round(profile.health + difficultyMinutes * 8);
    if (profile.ranged) this.ranged = new RangedSquirrelBehavior();
  }

  get isRanged(): boolean {
    return this.profile.ranged;
  }

  update(deltaMs: number, target: Vector2Like, difficultyMinutes: number): void {
    if (this.isDead) return;
    const speed = (this.profile.speed + difficultyMinutes * 8) * this.slowMultiplier;
    const direction = this.ranged
      ? this.ranged.steer(this.position, target)
      : normalize(target.x - this.sprite.x, target.y - this.sprite.y);
    this.ranged?.tick(deltaMs);
    const dt = deltaMs / 1000;

    if (direction.x === 0 && direction.y === 0) {
      // holding position: face the player and freeze the walk
      this.updateAnimation(normalize(target.x - this.sprite.x, target.y - this.sprite.y));
      this.sprite.anims.pause();
      return;
    }

    const next = clampToArena(
      {
        x: this.sprite.x + direction.x * speed * dt,
        y: this.sprite.y + direction.y * speed * dt
      },
      this.radius
    );
    // Ranged squirrels steer away from the player at times, so route toward their chosen point rather than the player.
    const goal = this.ranged ? next : target;
    const safe = this.navigation?.toward(this.position, goal, speed * dt, this.radius, this.route) ?? next;
    const actual = normalize(safe.x - this.sprite.x, safe.y - this.sprite.y);
    this.sprite.setPosition(safe.x, safe.y);
    this.updateAnimation(actual.x === 0 && actual.y === 0 ? direction : actual);
  }

  /** Returns a launch velocity when this squirrel is ready to throw at the target, else undefined. */
  tryThrow(target: Vector2Like): Vector2Like | undefined {
    if (!this.ranged || this.isDead) return undefined;
    return this.ranged.tryThrow(this.position, target);
  }

  private updateAnimation(direction: Vector2Like): void {
    const horizontal = Math.sign(Math.round(direction.x));
    const vertical = Math.sign(Math.round(direction.y));
    const animationKey = this.walkAnimations[`${horizontal},${vertical}`];

    if (animationKey) {
      if (this.sprite.anims.isPaused) this.sprite.anims.resume();
      this.sprite.play(animationKey, true);
    }
  }

  takeDamage(amount: number): boolean {
    if (this.isDead) {
      return false;
    }

    this.health -= amount;
    this.sprite.scene.events.emit('presentation:hit', this.sprite);
    this.isDead = this.health <= 0;
    return this.isDead;
  }

  displace(x: number, y: number): void {
    const target = { x: this.sprite.x + x, y: this.sprite.y + y };
    const safe = this.navigation?.move(this.position, target, this.radius) ?? clampToArena(target, this.radius);
    this.sprite.setPosition(safe.x, safe.y);
  }

  destroy(): void {
    this.sprite.destroy();
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }
}
