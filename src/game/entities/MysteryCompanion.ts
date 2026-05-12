import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import {
  MYSTERY_POUNCE_ANIMATION_BY_DIRECTION,
  MYSTERY_SPRITE_KEY,
  MYSTERY_WALK_ANIMATION_BY_DIRECTION
} from '../config/companionSprite';
import type { PlayerStats, Vector2Like } from '../core/types';
import { EnemyController } from './EnemyController';
import { distanceSq, normalize } from '../utils/math';

type MysteryState = 'following' | 'pouncing' | 'returning';

const MYSTERY_IDLE_ANIMATION_KEY = 'mystery-idle';
const MYSTERY_SPRITE_SCALE = 0.72;
const ARRIVAL_DISTANCE = 8;

export class MysteryCompanion {
  readonly sprite: Phaser.GameObjects.Sprite;
  private state: MysteryState = 'following';
  private cooldownRemainingMs = 600;
  private pounceAgeMs = 0;
  private target?: EnemyController;
  private hasHitThisPounce = false;
  private lastMoveDirection: Vector2Like = { x: 0, y: 1 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly stats: PlayerStats,
    playerPosition: Vector2Like
  ) {
    this.sprite = scene.add.sprite(playerPosition.x - 34, playerPosition.y + 28, MYSTERY_SPRITE_KEY, 0);
    this.sprite.setDepth(19);
    this.sprite.setScale(MYSTERY_SPRITE_SCALE);
    this.sprite.play(MYSTERY_IDLE_ANIMATION_KEY);
  }

  update(
    deltaMs: number,
    playerPosition: Vector2Like,
    playerMovementDirection: Vector2Like,
    enemies: EnemyController[],
    onEnemyKilled: (enemy: EnemyController) => void
  ): void {
    if (this.state === 'pouncing') {
      this.updatePounce(deltaMs, onEnemyKilled);
      return;
    }

    const followTarget = this.getFollowTarget(playerPosition);
    this.moveToward(followTarget, this.stats.mysteryReturnSpeed, deltaMs);

    if (this.state === 'returning') {
      this.updateWalkAnimation(this.lastMoveDirection);
      if (distanceSq(this.position, followTarget) <= ARRIVAL_DISTANCE * ARRIVAL_DISTANCE) {
        this.state = 'following';
      }
      return;
    }

    this.cooldownRemainingMs -= deltaMs;
    this.updateWalkAnimation(playerMovementDirection);

    if (this.cooldownRemainingMs > 0) {
      return;
    }

    const target = this.findClosestEnemyToPlayer(playerPosition, enemies);
    if (!target) {
      return;
    }

    this.beginPounce(target);
  }

  destroy(): void {
    this.sprite.destroy();
  }

  private updatePounce(deltaMs: number, onEnemyKilled: (enemy: EnemyController) => void): void {
    this.pounceAgeMs += deltaMs;

    if (!this.target || this.target.isDead || this.pounceAgeMs >= BALANCE.companion.mysteryPounceTimeoutMs) {
      this.beginReturn();
      return;
    }

    this.moveToward(this.target.position, BALANCE.companion.mysteryPounceSpeed, deltaMs);

    const hitDistance = BALANCE.companion.mysteryHitRadius + this.target.radius;
    if (
      !this.hasHitThisPounce &&
      distanceSq(this.position, this.target.position) <= hitDistance * hitDistance
    ) {
      this.hasHitThisPounce = true;
      const killed = this.target.takeDamage(this.stats.mysteryDamage);
      if (killed) {
        onEnemyKilled(this.target);
      }
      this.beginReturn();
    }
  }

  private beginPounce(target: EnemyController): void {
    this.state = 'pouncing';
    this.target = target;
    this.hasHitThisPounce = false;
    this.pounceAgeMs = 0;
    this.cooldownRemainingMs = this.stats.mysteryCooldownMs;

    const direction = normalize(target.position.x - this.sprite.x, target.position.y - this.sprite.y);
    this.lastMoveDirection = direction;
    this.playDirectionalAnimation(MYSTERY_POUNCE_ANIMATION_BY_DIRECTION, direction);
  }

  private beginReturn(): void {
    this.state = 'returning';
    this.target = undefined;
    this.hasHitThisPounce = false;
  }

  private moveToward(target: Vector2Like, speed: number, deltaMs: number): void {
    const distanceToTarget = Math.hypot(target.x - this.sprite.x, target.y - this.sprite.y);
    if (distanceToTarget <= ARRIVAL_DISTANCE) {
      this.sprite.setPosition(target.x, target.y);
      return;
    }

    const direction = normalize(target.x - this.sprite.x, target.y - this.sprite.y);
    if (direction.x !== 0 || direction.y !== 0) {
      this.lastMoveDirection = direction;
    }

    const dt = deltaMs / 1000;
    const travelDistance = Math.min(speed * dt, distanceToTarget);
    this.sprite.setPosition(
      this.sprite.x + direction.x * travelDistance,
      this.sprite.y + direction.y * travelDistance
    );
  }

  private updateWalkAnimation(preferredDirection: Vector2Like): void {
    const direction =
      Math.abs(preferredDirection.x) > 0.05 || Math.abs(preferredDirection.y) > 0.05
        ? preferredDirection
        : this.lastMoveDirection;

    if (Math.abs(direction.x) < 0.05 && Math.abs(direction.y) < 0.05) {
      this.sprite.play(MYSTERY_IDLE_ANIMATION_KEY, true);
      return;
    }

    this.playDirectionalAnimation(MYSTERY_WALK_ANIMATION_BY_DIRECTION, direction);
  }

  private playDirectionalAnimation(animationMap: Record<string, string>, direction: Vector2Like): void {
    const key = this.getDirectionKey(direction);
    const animationKey = animationMap[key];

    if (animationKey) {
      this.sprite.play(animationKey, true);
    }
  }

  private findClosestEnemyToPlayer(
    playerPosition: Vector2Like,
    enemies: EnemyController[]
  ): EnemyController | undefined {
    const rangeSq = this.stats.mysteryPounceRange * this.stats.mysteryPounceRange;
    let closest: EnemyController | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of enemies) {
      if (enemy.isDead) {
        continue;
      }

      const d = distanceSq(playerPosition, enemy.position);
      if (d <= rangeSq && d < closestDistance) {
        closest = enemy;
        closestDistance = d;
      }
    }

    return closest;
  }

  private getFollowTarget(playerPosition: Vector2Like): Vector2Like {
    return {
      x: playerPosition.x - BALANCE.companion.mysteryFollowDistance,
      y: playerPosition.y + BALANCE.companion.mysteryFollowDistance * 0.55
    };
  }

  private getDirectionKey(direction: Vector2Like): string {
    const horizontal = Math.abs(direction.x) < 0.33 ? 0 : Math.sign(direction.x);
    const vertical = Math.abs(direction.y) < 0.33 ? 0 : Math.sign(direction.y);

    if (horizontal === 0 && vertical === 0) {
      return '0,1';
    }

    return `${horizontal},${vertical}`;
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }
}
