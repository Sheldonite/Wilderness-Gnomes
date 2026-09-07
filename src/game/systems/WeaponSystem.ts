import Phaser from 'phaser';
import { WEAPONS } from '../config/weapons';
import type { PlayerStats, Vector2Like } from '../core/types';
import { EnemyController } from '../entities/EnemyController';
import { Projectile } from '../entities/Projectile';
import { distanceSq, normalize } from '../utils/math';

export class WeaponSystem {
  private cooldownRemainingMs = 350;
  private shotThisFrame = false;
  aimAngle = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  consumeShot(): boolean {
    const fired = this.shotThisFrame;
    this.shotThisFrame = false;
    return fired;
  }

  update(
    deltaMs: number,
    playerPosition: Vector2Like,
    stats: PlayerStats,
    enemies: EnemyController[],
    projectiles: Projectile[]
  ): void {
    this.shotThisFrame = false;
    this.cooldownRemainingMs -= deltaMs;
    const target = this.findClosestEnemy(playerPosition, enemies);
    if (target) {
      this.aimAngle = Math.atan2(target.position.y - playerPosition.y, target.position.x - playerPosition.x);
    }
    if (this.cooldownRemainingMs > 0 || !target) {
      return;
    }

    this.cooldownRemainingMs = stats.weaponCooldownMs;
    this.shotThisFrame = true;
    this.fireProjectiles(playerPosition, target.position, stats, projectiles);
  }

  private findClosestEnemy(
    playerPosition: Vector2Like,
    enemies: EnemyController[]
  ): EnemyController | undefined {
    let closest: EnemyController | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const d = distanceSq(playerPosition, enemy.position);
      if (d < closestDistance) {
        closestDistance = d;
        closest = enemy;
      }
    }

    return closest;
  }

  private fireProjectiles(
    playerPosition: Vector2Like,
    targetPosition: Vector2Like,
    stats: PlayerStats,
    projectiles: Projectile[]
  ): void {
    const arm = WEAPONS[stats.weaponId];
    const baseAngle = Math.atan2(targetPosition.y - playerPosition.y, targetPosition.x - playerPosition.x);
    const count = stats.projectileCount;
    const spread = arm.spreadRadians;
    const startOffset = count > 1 ? -((count - 1) * spread) / 2 : 0;
    const extraTargets = arm.baseExtraTargets + stats.abilityRanks['ricochet-charm'];
    const muzzle = arm.muzzleOffset ?? 0;

    for (let i = 0; i < count; i += 1) {
      const angle = baseAngle + startOffset + i * spread;
      const direction = normalize(Math.cos(angle), Math.sin(angle));
      projectiles.push(
        new Projectile(
          this.scene,
          playerPosition.x + direction.x * muzzle,
          playerPosition.y + direction.y * muzzle,
          {
            x: direction.x * arm.projectileSpeed,
            y: direction.y * arm.projectileSpeed
          },
          arm.projectileLifetimeMs,
          stats.projectileDamage,
          extraTargets,
          {
            mode: arm.extraTargetMode,
            retention: arm.extraTargetRetention,
            radius: arm.projectileRadius,
            texture: arm.texture,
            displaySize: arm.displaySize,
            trailColor: arm.trailColor
          }
        )
      );
    }
  }
}
