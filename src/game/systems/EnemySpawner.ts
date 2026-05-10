import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME_CONFIG } from '../config/gameConfig';
import type { Vector2Like } from '../core/types';
import { EnemyController } from '../entities/EnemyController';

export class EnemySpawner {
  private spawnTimerMs = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  update(
    deltaMs: number,
    playerPosition: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera,
    enemies: EnemyController[],
    difficultyMinutes: number
  ): void {
    this.spawnTimerMs += deltaMs;
    const spawnIntervalMs = Math.max(
      BALANCE.spawner.minSpawnIntervalMs,
      BALANCE.spawner.initialSpawnIntervalMs -
        BALANCE.spawner.spawnIntervalReductionPerMinute * difficultyMinutes
    );
    const maxEnemies = Math.min(
      BALANCE.spawner.maxEnemiesCap,
      Math.floor(
        BALANCE.spawner.initialMaxEnemies +
          BALANCE.spawner.maxEnemiesAddedPerMinute * difficultyMinutes
      )
    );

    if (this.spawnTimerMs < spawnIntervalMs || enemies.length >= maxEnemies) {
      return;
    }

    this.spawnTimerMs = 0;
    enemies.push(this.spawnEnemy(playerPosition, camera, difficultyMinutes));
  }

  private spawnEnemy(
    playerPosition: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera,
    difficultyMinutes: number
  ): EnemyController {
    const view = camera.worldView;
    const padding = BALANCE.spawner.spawnOutsideViewPadding;
    const side = Phaser.Math.Between(0, 3);
    let x = playerPosition.x;
    let y = playerPosition.y;

    if (side === 0) {
      x = Phaser.Math.Between(Math.floor(view.left - padding), Math.floor(view.right + padding));
      y = view.top - padding;
    } else if (side === 1) {
      x = view.right + padding;
      y = Phaser.Math.Between(Math.floor(view.top - padding), Math.floor(view.bottom + padding));
    } else if (side === 2) {
      x = Phaser.Math.Between(Math.floor(view.left - padding), Math.floor(view.right + padding));
      y = view.bottom + padding;
    } else {
      x = view.left - padding;
      y = Phaser.Math.Between(Math.floor(view.top - padding), Math.floor(view.bottom + padding));
    }

    x = Phaser.Math.Clamp(x, BALANCE.enemy.radius, GAME_CONFIG.arena.width - BALANCE.enemy.radius);
    y = Phaser.Math.Clamp(y, BALANCE.enemy.radius, GAME_CONFIG.arena.height - BALANCE.enemy.radius);

    return new EnemyController(this.scene, x, y, difficultyMinutes);
  }
}
