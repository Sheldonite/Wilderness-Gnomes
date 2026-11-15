import type { SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME_CONFIG } from '../config/gameConfig';
import type { Vector2Like } from '../core/types';
import { EnemyController, type EnemyVariant } from '../entities/EnemyController';
import { rollSpawnVariant } from '../core/SquirrelBehavior';

/** Creatures per spawn tick: one at first, then a growing group once the late game begins. */
export function spawnBatch(difficultyMinutes: number): number {
  const s = BALANCE.spawner;
  if (difficultyMinutes < s.batchFromMinute) return 1;
  return Math.min(s.maxBatch, 2 + Math.floor((difficultyMinutes - s.batchFromMinute) / s.batchEveryMinutes));
}

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
    const batch = Math.min(spawnBatch(difficultyMinutes), maxEnemies - enemies.length);
    for (let i = 0; i < batch; i++) {
      const enemy = this.spawnEnemy(playerPosition, camera, difficultyMinutes, rollSpawnVariant(playerLevel) as EnemyVariant, playerLevel);
      if (enemy) enemies.push(enemy);
    }
  }

  /**
   * Spawns an opening ambush pack of 6–8 brown squirrels off-screen from two opposite flanks
   * closing in immediately when a run begins.
   */
  spawnOpeningPack(
    playerPosition: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera,
    difficultyMinutes: number,
    enemies: EnemyController[],
    count = 7
  ): EnemyController[] {
    const view = camera.worldView;
    const padding = BALANCE.spawner.spawnOutsideViewPadding;
    const margin = Math.max(BALANCE.enemy.radius, BALANCE.deer.buck.radius, BALANCE.armadillo.radius);
    const targetCount = Math.max(1, count);
    const spawned: EnemyController[] = [];
    const spanY = Math.max(120, (view.bottom - view.top) * 0.65);

    for (let i = 0; i < targetCount; i++) {
      const flank = i % 2 === 0 ? -1 : 1; // -1 = left flank, +1 = right flank
      const slot = Math.floor(i / 2);
      const slotsOnFlank = Math.max(1, Math.ceil(targetCount / 2));
      const offsetRatio = slotsOnFlank === 1 ? 0 : slot / (slotsOnFlank - 1) - 0.5;
      const candidateX = flank < 0 ? view.left - padding - (slot % 2) * 24 : view.right + padding + (slot % 2) * 24;
      const candidateY = playerPosition.y + offsetRatio * spanY;

      const x = Phaser.Math.Clamp(candidateX, margin, GAME_CONFIG.arena.width - margin);
      const y = Phaser.Math.Clamp(candidateY, margin, GAME_CONFIG.arena.height - margin);
      const spot = this.navigation?.nearest({ x, y }, margin) ?? { x, y };
      const outside =
        spot.x <= view.left - padding ||
        spot.x >= view.right + padding ||
        spot.y <= view.top - padding ||
        spot.y >= view.bottom + padding;

      if (outside && !this.navigation?.blocked(spot, margin)) {
        const squirrel = new EnemyController(this.scene, spot.x, spot.y, difficultyMinutes, this.navigation, undefined, 'brown', 1);
        enemies.push(squirrel);
        spawned.push(squirrel);
        continue;
      }

      const fallback = this.spawnEnemy(playerPosition, camera, difficultyMinutes, 'brown', 1);
      if (fallback) {
        enemies.push(fallback);
        spawned.push(fallback);
      }
    }

    return spawned;
  }

  /** One creature of the given kind just outside the camera, for set pieces such as elites. */
  spawnEnemy(
    playerPosition: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera,
    difficultyMinutes: number,
    variant: EnemyVariant,
    _playerLevel = 1
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
