import type { SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME_CONFIG } from '../config/gameConfig';
import type { Vector2Like } from '../core/types';
import { EnemyController, type EnemyVariant } from '../entities/EnemyController';
import { rollSpawnVariant } from '../core/SquirrelBehavior';

export class EnemySpawner {
  private spawnTimerMs = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly navigation?: SceneryNavigation) {}

  update(
    deltaMs: number,
    playerPosition: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera,
    enemies: EnemyController[],
    difficultyMinutes: number,
    playerLevel: number
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
    enemies.push(this.spawnEnemy(playerPosition, camera, difficultyMinutes, rollSpawnVariant(playerLevel)));
  }

  private spawnEnemy(
    playerPosition: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera,
    difficultyMinutes: number,
    variant: EnemyVariant
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

    const margin = Math.max(BALANCE.enemy.radius, BALANCE.deer.buck.radius);
    x = Phaser.Math.Clamp(x, margin, GAME_CONFIG.arena.width - margin);
    y = Phaser.Math.Clamp(y, margin, GAME_CONFIG.arena.height - margin);

    return new EnemyController(this.scene, x, y, difficultyMinutes, this.navigation, undefined, variant);
  }
}
