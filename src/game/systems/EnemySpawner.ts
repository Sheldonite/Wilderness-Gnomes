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
    const enemy = this.spawnEnemy(playerPosition, camera, difficultyMinutes, rollSpawnVariant(playerLevel));
    if (enemy) enemies.push(enemy);
  }

  private spawnEnemy(
    playerPosition: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera,
    difficultyMinutes: number,
    variant: EnemyVariant
  ): EnemyController | undefined {
    const view = camera.worldView;
    const padding = BALANCE.spawner.spawnOutsideViewPadding;
    const firstSide = Phaser.Math.Between(0, 3);
    const margin = Math.max(BALANCE.enemy.radius, BALANCE.deer.buck.radius, BALANCE.armadillo.radius);
    // Try every side before retrying samples. Arena edges and navigation corrections
    // can move an otherwise off-screen candidate back into the camera.
    for (let attempt = 0; attempt < 16; attempt++) {
      const side = (firstSide + attempt) % 4;
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

      x = Phaser.Math.Clamp(x, margin, GAME_CONFIG.arena.width - margin);
      y = Phaser.Math.Clamp(y, margin, GAME_CONFIG.arena.height - margin);
      const spawn = this.navigation?.nearest({ x, y }, margin) ?? { x, y };
      const outside = spawn.x <= view.left - padding || spawn.x >= view.right + padding ||
        spawn.y <= view.top - padding || spawn.y >= view.bottom + padding;
      if (!outside || this.navigation?.blocked(spawn, margin)) continue;

      return new EnemyController(this.scene, spawn.x, spawn.y, difficultyMinutes, this.navigation, undefined, variant);
    }
    return undefined;
  }
}
