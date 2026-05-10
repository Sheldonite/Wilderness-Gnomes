import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import type { PlayerStats, Vector2Like } from '../core/types';
import { EnemyController } from '../entities/EnemyController';
import { Projectile } from '../entities/Projectile';
import { distanceSq, normalize } from '../utils/math';

export class WeaponSystem {
  private cooldownRemainingMs = 350;

  constructor(private readonly scene: Phaser.Scene) {}

  update(
    deltaMs: number,
    playerPosition: Vector2Like,
    stats: PlayerStats,
    enemies: EnemyController[],
    projectiles: Projectile[]
  ): void {
    this.cooldownRemainingMs -= deltaMs;
    if (this.cooldownRemainingMs > 0 || enemies.length === 0) {
      return;
    }

    const target = this.findClosestEnemy(playerPosition, enemies);
    if (!target) {
      return;
    }

    this.cooldownRemainingMs = stats.weaponCooldownMs;
    this.fireProjectiles(playerPosition, target.position, stats, projectiles);
  }

  private findClosestEnemy(
    playerPosition: Vector2Like,
    enemies: EnemyController[]
  ): EnemyController | undefined {
    let closest: EnemyController | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of enemies) {
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
    const baseAngle = Math.atan2(targetPosition.y - playerPosition.y, targetPosition.x - playerPosition.x);
    const count = stats.projectileCount;
    const spread = BALANCE.weapon.spreadRadians;
    const startOffset = count > 1 ? -((count - 1) * spread) / 2 : 0;

    for (let i = 0; i < count; i += 1) {
      const angle = baseAngle + startOffset + i * spread;
      const direction = normalize(Math.cos(angle), Math.sin(angle));
      projectiles.push(
        new Projectile(
          this.scene,
          playerPosition.x,
          playerPosition.y,
          {
            x: direction.x * BALANCE.weapon.projectileSpeed,
            y: direction.y * BALANCE.weapon.projectileSpeed
          },
          BALANCE.weapon.projectileLifetimeMs,
          stats.projectileDamage
        )
      );
    }
  }
}
