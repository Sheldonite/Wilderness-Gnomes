import { BALANCE } from '../config/balance';
import { GameManager } from '../core/GameManager';
import { Quadtree } from '../core/Quadtree';
import { EnemyController } from '../entities/EnemyController';
import { PlayerController } from '../entities/PlayerController';
import { Projectile } from '../entities/Projectile';
import { XPOrb } from '../entities/XPOrb';
import { distanceSq, normalize } from '../utils/math';

export class CollisionSystem {
  private enemyQuadtree: Quadtree<EnemyController> | null = null;
  private readonly worldBounds = { x: -1000, y: -1000, width: 2000, height: 2000 };

  update(
    timeMs: number,
    player: PlayerController,
    gameManager: GameManager,
    enemies: EnemyController[],
    projectiles: Projectile[],
    xpOrbs: XPOrb[],
    onEnemyKilled: (enemy: EnemyController) => void
  ): void {
    this.buildEnemyQuadtree(enemies);
    this.handleEnemySeparation(enemies);
    this.handlePlayerEnemyContact(timeMs, player, gameManager, enemies);
    this.handleProjectileEnemyHits(enemies, projectiles, onEnemyKilled);
    this.handleXpCollection(player, gameManager, xpOrbs);
    this.enemyQuadtree?.clear();
    this.enemyQuadtree = null;
  }

  private buildEnemyQuadtree(enemies: EnemyController[]): void {
    this.enemyQuadtree = new Quadtree<EnemyController>(0, this.worldBounds);
    for (const enemy of enemies) {
      if (!enemy.isDead) {
        this.enemyQuadtree.insert(enemy);
      }
    }
  }

  private handlePlayerEnemyContact(
    timeMs: number,
    player: PlayerController,
    gameManager: GameManager,
    enemies: EnemyController[]
  ): void {
    const minDistance = player.radius + BALANCE.enemy.radius;
    const minDistanceSq = minDistance * minDistance;

    for (const enemy of enemies) {
      if (enemy.isDead) {
        continue;
      }

      if (distanceSq(player.position, enemy.position) > minDistanceSq) {
        continue;
      }

      if (timeMs - enemy.lastContactDamageAt >= BALANCE.enemy.contactDamageCooldownMs) {
        enemy.lastContactDamageAt = timeMs;
        gameManager.damagePlayer(BALANCE.enemy.contactDamage);
      }
    }
  }

  private handleProjectileEnemyHits(
    enemies: EnemyController[],
    projectiles: Projectile[],
    onEnemyKilled: (enemy: EnemyController) => void
  ): void {
    if (!this.enemyQuadtree) {
      return;
    }

    for (const projectile of projectiles) {
      if (projectile.isDead) {
        continue;
      }

      const nearbyEnemies = this.enemyQuadtree.retrieveInRadius(projectile.position, projectile.radius + BALANCE.enemy.separationRadius);
      
      for (const enemy of nearbyEnemies) {
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

        projectile.markHit(enemy.id);
        if (enemy.takeDamage(projectile.damage)) {
          onEnemyKilled(enemy);
        }
        break;
      }
    }
  }

  private handleXpCollection(
    player: PlayerController,
    gameManager: GameManager,
    xpOrbs: XPOrb[]
  ): void {
    const collectRangeSq = BALANCE.xp.collectRange * BALANCE.xp.collectRange;

    for (const orb of xpOrbs) {
      if (orb.isCollected || distanceSq(player.position, orb.position) > collectRangeSq) {
        continue;
      }

      orb.collect();
      gameManager.addXp(orb.value);
      if (gameManager.state === 'LevelUpPaused') {
        break;
      }
    }
  }

  private handleEnemySeparation(enemies: EnemyController[]): void {
    if (!this.enemyQuadtree) {
      return;
    }

    const separationRadius = BALANCE.enemy.separationRadius;
    const separationRadiusSq = separationRadius * separationRadius;
    const processedPairs = new Set<string>();

    for (let i = 0; i < enemies.length; i += 1) {
      const a = enemies[i];
      if (a.isDead) {
        continue;
      }

      const nearbyEnemies = this.enemyQuadtree.retrieveInRadius(a.position, separationRadius);
      
      for (const b of nearbyEnemies) {
        if (b.isDead || a === b) {
          continue;
        }

        const pairKey = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
        if (processedPairs.has(pairKey)) {
          continue;
        }
        processedPairs.add(pairKey);

        const distance = distanceSq(a.position, b.position);

        if (distance <= 0 || distance > separationRadiusSq) {
          continue;
        }

        const push = normalize(a.position.x - b.position.x, a.position.y - b.position.y);
        const amount = 0.45;
        a.sprite.x += push.x * amount;
        a.sprite.y += push.y * amount;
        b.sprite.x -= push.x * amount;
        b.sprite.y -= push.y * amount;
      }
    }
  }
}
