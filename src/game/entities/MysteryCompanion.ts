import { createNavigationRoute, type SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import { LOOK } from '../config/presentation';
import { BALANCE } from '../config/balance';
import { ABILITIES } from '../config/abilities';
import type { DealDamage } from '../core/CombatResolver';
import { secondPounceTarget } from '../core/PounceChain';
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
  protected readonly route = createNavigationRoute();
  readonly sprite: Phaser.GameObjects.Sprite;
  private state: MysteryState = 'following';
  private cooldownRemainingMs = 600;
  private pounceAgeMs = 0;
  private target?: EnemyController;
  private hasHitThisPounce = false;
  private isSecondPounce = false;
  private trailMs = 0;
  private lastMoveDirection: Vector2Like = { x: 0, y: 1 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly stats: PlayerStats,
    playerPosition: Vector2Like,
    private readonly navigation?: SceneryNavigation
  ) {
    const spawn = navigation?.nearest({ x: playerPosition.x - 34, y: playerPosition.y + 28 }, 12) ?? { x: playerPosition.x - 34, y: playerPosition.y + 28 };
    this.sprite = scene.add.sprite(spawn.x, spawn.y, MYSTERY_SPRITE_KEY, 0);
    this.sprite.setDepth(19);
    this.sprite.setScale(MYSTERY_SPRITE_SCALE);
    this.sprite.play(MYSTERY_IDLE_ANIMATION_KEY);
    scene.events.emit('presentation:actor', this.sprite);
  }

  update(
    deltaMs: number,
    playerPosition: Vector2Like,
    _playerMovementDirection: Vector2Like,
    enemies: EnemyController[],
    damage: DealDamage
  ): void {
    if (this.state === 'pouncing') {
      this.updatePounce(deltaMs, playerPosition, enemies, damage);
      return;
    }

    const followTarget = this.navigation?.nearest(this.getFollowTarget(playerPosition), 12) ?? this.getFollowTarget(playerPosition);
    const before = this.position;
    this.moveToward(followTarget, this.stats.mysteryReturnSpeed, deltaMs);

    if (this.state === 'returning') {
      this.updateWalkAnimation({ x: this.sprite.x - before.x, y: this.sprite.y - before.y });
      if (distanceSq(this.position, followTarget) <= ARRIVAL_DISTANCE * ARRIVAL_DISTANCE) {
        this.state = 'following';
      }
      return;
    }

    this.cooldownRemainingMs -= deltaMs;
    this.updateWalkAnimation({ x: this.sprite.x - before.x, y: this.sprite.y - before.y });

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

  private updatePounce(deltaMs: number, playerPosition: Vector2Like, enemies: EnemyController[], damage: DealDamage): void {
    this.trailMs += deltaMs;
    if (this.trailMs >= 55) { this.trailMs = 0; this.scene.events.emit('presentation:trail', this.position, LOOK.color.gold); }
    this.pounceAgeMs += deltaMs;

    if (!this.target || this.target.isDead || this.pounceAgeMs >= BALANCE.companion.mysteryPounceTimeoutMs) {
      this.beginReturn();
      return;
    }

    this.moveToward(this.target.position, BALANCE.companion.mysteryPounceSpeed, deltaMs);

    const hitDistance = BALANCE.companion.mysteryHitRadius + this.target.radius;
    if (
      !this.hasHitThisPounce && (!this.navigation || this.navigation.clear(this.position, this.target.position, 2)) &&
      distanceSq(this.position, this.target.position) <= hitDistance * hitDistance
    ) {
      this.hasHitThisPounce = true;
      const firstId = this.target.id;
      const rank = this.stats.abilityRanks['mystery-double-pounce'];
      damage(this.target, this.stats.mysteryDamage * (this.isSecondPounce ? ABILITIES.pounce.damageScale[rank] : 1));
      if (!this.isSecondPounce) {
        const next = secondPounceTarget(rank, firstId, this.position, playerPosition, this.stats.mysteryPounceRange, enemies);
        if (next) { this.beginPounce(next, true); return; }
      }
      this.beginReturn();
    }
  }

  private beginPounce(target: EnemyController, second = false): void {
    this.state = 'pouncing';
    this.target = target;
    this.hasHitThisPounce = false;
    this.pounceAgeMs = 0;
    this.isSecondPounce = second;
    if (!second) this.cooldownRemainingMs = this.stats.mysteryCooldownMs;

    const direction = normalize(target.position.x - this.sprite.x, target.position.y - this.sprite.y);
    this.lastMoveDirection = direction;
    this.playDirectionalAnimation(MYSTERY_POUNCE_ANIMATION_BY_DIRECTION, direction);
  }

  private beginReturn(): void {
    this.state = 'returning';
    this.target = undefined;
    this.hasHitThisPounce = false;
    this.isSecondPounce = false;
  }

  private moveToward(target: Vector2Like, speed: number, deltaMs: number): void {
    const distanceToTarget = Math.hypot(target.x - this.sprite.x, target.y - this.sprite.y);
    if (distanceToTarget <= ARRIVAL_DISTANCE) {
      const safe = this.navigation?.move(this.position, target, 12) ?? target;
      this.sprite.setPosition(safe.x, safe.y);
      return;
    }

    const direction = normalize(target.x - this.sprite.x, target.y - this.sprite.y);
    if (direction.x !== 0 || direction.y !== 0) {
      this.lastMoveDirection = direction;
    }

    const dt = deltaMs / 1000;
    const travelDistance = Math.min(speed * dt, distanceToTarget);
    const next = this.navigation?.toward(this.position, target, travelDistance, 12, this.route) ?? {
      x: this.sprite.x + direction.x * travelDistance, y: this.sprite.y + direction.y * travelDistance
    };
    this.lastMoveDirection = normalize(next.x - this.sprite.x, next.y - this.sprite.y);
    this.sprite.setPosition(next.x, next.y);
    if (this.state === 'pouncing') this.playDirectionalAnimation(MYSTERY_POUNCE_ANIMATION_BY_DIRECTION, this.lastMoveDirection);
  }

  private updateWalkAnimation(preferredDirection: Vector2Like): void {
    const direction = normalize(preferredDirection.x, preferredDirection.y);

    if (Math.abs(direction.x) < 0.05 && Math.abs(direction.y) < 0.05) {
      this.sprite.anims.stop();
      this.sprite.setTexture(MYSTERY_SPRITE_KEY, 0);
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
