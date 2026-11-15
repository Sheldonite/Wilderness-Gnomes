import Phaser from 'phaser';
import { WEAPONS } from '../config/weapons';
import { weaponUpgrades } from '../core/WeaponUpgrades';
import type { PlayerStats, Vector2Like } from '../core/types';
import { EnemyController } from '../entities/EnemyController';
import { Projectile } from '../entities/Projectile';
import { distanceSq, normalize } from '../utils/math';

export class WeaponSystem {
  private cooldownRemainingMs = 350;
  private shotThisFrame = false;
  private readonly playerAnchor: Vector2Like = { x: 0, y: 0 };
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
    projectiles: Projectile[],
    manualAim?: Vector2Like
  ): void {
    this.shotThisFrame = false;
    this.cooldownRemainingMs -= deltaMs;
    this.playerAnchor.x = playerPosition.x;
    this.playerAnchor.y = playerPosition.y;

    const aimTarget = manualAim ?? this.findClosestEnemy(playerPosition, enemies)?.position;
    if (aimTarget) {
      this.aimAngle = Math.atan2(aimTarget.y - playerPosition.y, aimTarget.x - playerPosition.x);
    }
    if (this.cooldownRemainingMs > 0 || !aimTarget) {
      return;
    }

    this.cooldownRemainingMs = stats.weaponCooldownMs / (1 + stats.shoutAttackSpeedBonus + (stats.shrineAttackSpeedBonus ?? 0));
    this.shotThisFrame = true;
    this.fireProjectiles(playerPosition, aimTarget, stats, projectiles);
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
    const upgrades = weaponUpgrades(stats);
    const damage = stats.projectileDamage * (1 + (stats.harvestBonus ?? 0)) * (stats.spellPowerMultiplier ?? 1);
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
          damage,
          upgrades.extraTargets,
          {
            ...upgrades,
            radius: arm.projectileRadius,
            texture: arm.texture,
            displaySize: arm.displaySize,
            trailColor: arm.trailColor,
            behavior: arm.behavior,
            boomerangRange: arm.boomerangRange,
            playerAnchor: arm.behavior === 'boomerang' ? this.playerAnchor : undefined,
            splashRadius: arm.splashRadius,
            splashDamageRatio: arm.splashDamageRatio,
            source: 'weapon'
          }
        )
      );
    }
  }
}
