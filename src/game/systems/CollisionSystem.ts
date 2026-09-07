import { EnemySeparation } from '../core/EnemySeparation';
import { BALANCE } from '../config/balance';
import { GameManager } from '../core/GameManager';
import { EnemyController } from '../entities/EnemyController';
import { PlayerController } from '../entities/PlayerController';
import { Projectile } from '../entities/Projectile';
import { XPOrb } from '../entities/XPOrb';
import { Acorn } from '../entities/Acorn';
import { distanceSq } from '../utils/math';
import type { DealDamage } from '../core/CombatResolver';

export class CollisionSystem {
  private readonly separation = new EnemySeparation();
  update(
    timeMs: number,
    player: PlayerController,
    gameManager: GameManager,
    enemies: EnemyController[],
    projectiles: Projectile[],
    xpOrbs: XPOrb[],
    damage: DealDamage,
    acorns: Acorn[] = []
  ): void {
    this.handleEnemySeparation(enemies);
    this.handlePlayerEnemyContact(timeMs, player, gameManager, enemies);
    if (gameManager.state !== 'Playing') return;
    this.handleAcornHits(player, gameManager, acorns);
    if (gameManager.state !== 'Playing') return;
    this.handleProjectileEnemyHits(enemies, projectiles, damage);
    this.handleXpCollection(player, gameManager, xpOrbs);
  }

  private handlePlayerEnemyContact(
    timeMs: number,
    player: PlayerController,
    gameManager: GameManager,
    enemies: EnemyController[]
  ): void {
    for (const enemy of enemies) {
      if (enemy.isDead) {
        continue;
      }

      if (distanceSq(player.position, enemy.position) > (player.radius + enemy.radius) ** 2) {
        continue;
      }

      if (timeMs - enemy.lastContactDamageAt >= BALANCE.enemy.contactDamageCooldownMs) {
        enemy.lastContactDamageAt = timeMs;
        gameManager.damagePlayer(enemy.contactDamage, 'contact');
        if (gameManager.state !== 'Playing') return;
      }
    }
  }

  private handleAcornHits(player: PlayerController, gameManager: GameManager, acorns: Acorn[]): void {
    for (const acorn of acorns) {
      if (acorn.isDead) continue;
      const minDistance = player.radius + acorn.radius;
      if (distanceSq(player.position, acorn.position) > minDistance * minDistance) continue;
      acorn.isDead = true;
      gameManager.damagePlayer(BALANCE.rangedEnemy.acornDamage);
      if (gameManager.state !== 'Playing') return;
    }
  }

  private handleProjectileEnemyHits(
    enemies: EnemyController[],
    projectiles: Projectile[],
    damage: DealDamage
  ): void {
    for (const projectile of projectiles) {
      if (projectile.isDead) {
        continue;
      }

      for (const enemy of enemies) {
        if (enemy.isDead) {
          continue;
        }

        if (projectile.hitEnemyIds.has(enemy.id)) {
          continue;
        }

        const minDistance = projectile.radius + enemy.radius;
        if (distanceSq(projectile.position, enemy.position) > minDistance * minDistance) {
          continue;
        }

        damage(enemy, projectile.damage);
        projectile.markHit(enemy.id, enemies);
        if (projectile.isDead) break;
      }
    }
  }

  private handleXpCollection(
    player: PlayerController,
    gameManager: GameManager,
    xpOrbs: XPOrb[]
  ): void {
    if (gameManager.state !== 'Playing') return;
    const collectRangeSq = BALANCE.xp.collectRange * BALANCE.xp.collectRange;

    for (const orb of xpOrbs) {
      if (orb.isCollected || distanceSq(player.position, orb.position) > collectRangeSq) {
        continue;
      }

      orb.collect();
      if (gameManager.addXp(orb.value)) {
        break;
      }
    }
  }

  private handleEnemySeparation(enemies: EnemyController[]): void {
    const alive = enemies.filter(enemy => !enemy.isDead);
    const offsets = this.separation.solve(alive.map(enemy => enemy.position), BALANCE.enemy.separationRadius);
    alive.forEach((enemy, i) => {
      const x = offsets[i * 2], y = offsets[i * 2 + 1];
      if (x || y) enemy.displace(x, y);
    });
  }
}
