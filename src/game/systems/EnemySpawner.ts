import type { SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME_CONFIG } from '../config/gameConfig';
import type { Vector2Like } from '../core/types';
import { EnemyController, type EnemyVariant } from '../entities/EnemyController';
import { rollSpawnVariant } from '../core/SquirrelBehavior';
import { distanceSq } from '../utils/math';

const openingFlankOffsets = [0, 1, -1, 2, -2, 3, -3, 4].map(step => step * Math.PI / 4);

/** Creatures per spawn tick: one at first, then a growing group once the late game begins. */
export function spawnBatch(difficultyMinutes: number): number {
  const s = BALANCE.spawner;
  if (difficultyMinutes < s.batchFromMinute) return 1;
  return Math.min(s.maxBatch, 2 + Math.floor((difficultyMinutes - s.batchFromMinute) / s.batchEveryMinutes));
}

function cameraViewBounds(
  playerPosition: Vector2Like,
  camera: Phaser.Cameras.Scene2D.Camera
): { left: number; right: number; top: number; bottom: number } {
  const raw = camera?.worldView;
  if (raw && raw.right > raw.left && raw.bottom > raw.top) {
    return raw;
  }
  const halfW = ((camera as { width?: number } | undefined)?.width || 1280) / 2;
  const halfH = ((camera as { height?: number } | undefined)?.height || 720) / 2;
  return {
    left: playerPosition.x - halfW,
    right: playerPosition.x + halfW,
    top: playerPosition.y - halfH,
    bottom: playerPosition.y + halfH
  };
}

export class EnemySpawner {
  private spawnTimerMs = 0;
  private openingReinforcements?: { count: number; angle: number; delayMs: number };

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

    const reinforcements = this.openingReinforcements;
    if (reinforcements) {
      reinforcements.delayMs -= deltaMs;
      if (reinforcements.delayMs <= 0 && enemies.length + reinforcements.count <= maxEnemies) {
        const spawned = this.spawnOpeningFlank(playerPosition, difficultyMinutes, enemies, reinforcements.count,
          BALANCE.spawner.openingReinforcementDistance, reinforcements.angle, playerLevel);
        if (spawned.length) this.openingReinforcements = undefined;
        else reinforcements.delayMs = spawnIntervalMs;
      }
    }

    if (this.spawnTimerMs < spawnIntervalMs || enemies.length >= maxEnemies) {
      return;
    }

    this.spawnTimerMs = 0;
    const batch = Math.min(spawnBatch(difficultyMinutes), maxEnemies - enemies.length);
    for (let i = 0; i < batch; i++) {
      const enemy = this.spawnEnemy(playerPosition, camera, difficultyMinutes, rollSpawnVariant(playerLevel), playerLevel, enemies);
      if (enemy) enemies.push(enemy);
    }
  }

  /** Start with a close lead flank. The active gameplay update releases the other flank. */
  spawnOpeningPack(
    playerPosition: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera,
    difficultyMinutes: number,
    enemies: EnemyController[],
    count: number = BALANCE.spawner.openingPackCount
  ): EnemyController[] {
    const view = this.navigation?.unbounded ? undefined : cameraViewBounds(playerPosition, camera);
    const targetCount = Math.max(1, count);
    const leadCount = Math.min(targetCount, BALANCE.spawner.openingLeadCount);
    const angle = view && view.right - view.left < view.bottom - view.top ? -Math.PI / 2 : Math.PI;
    const lead = this.spawnOpeningFlank(playerPosition, difficultyMinutes, enemies, leadCount,
      BALANCE.spawner.openingLeadDistance, angle, 1);
    const remaining = targetCount - lead.length;
    const leadCenter = lead[Math.floor(lead.length / 2)]?.position;
    const leadAngle = leadCenter ? Math.atan2(leadCenter.y - playerPosition.y, leadCenter.x - playerPosition.x) : angle;
    this.openingReinforcements = remaining > 0
      ? { count: remaining, angle: leadAngle + Math.PI, delayMs: BALANCE.spawner.openingReinforcementDelayMs }
      : undefined;
    return lead;
  }

  private spawnOpeningFlank(player: Vector2Like, minutes: number, enemies: EnemyController[], count: number,
    distance: number, angle: number, level: number): EnemyController[] {
    const { radius } = BALANCE.enemy;
    const { width, height } = GAME_CONFIG.arena;
    for (const offset of openingFlankOffsets) {
      const positions = Array.from({ length: count }, (_, index) => {
        const direction = angle + offset + (index - (count - 1) / 2) * 0.19;
        return { x: player.x + Math.cos(direction) * distance, y: player.y + Math.sin(direction) * distance };
      });
      // Try a nearby angle if the entire flank cannot fit without putting a squirrel on an obstacle or another enemy.
      const clear = positions.every(point => (this.navigation?.unbounded || (point.x >= radius && point.x <= width - radius &&
        point.y >= radius && point.y <= height - radius)) && !this.navigation?.blocked(point, radius) &&
        !enemies.some(enemy => !enemy.isDead && distanceSq(enemy.position, point) < (enemy.radius + radius) ** 2));
      if (!clear) continue;
      const spawned = positions.map(point => new EnemyController(this.scene, point.x, point.y, minutes,
        this.navigation, undefined, 'brown', level));
      enemies.push(...spawned);
      return spawned;
    }
    return [];
  }

  /** One creature of the given kind, using a world-space distance in the wilds. */
  spawnEnemy(
    playerPosition: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera,
    difficultyMinutes: number,
    variant: EnemyVariant,
    playerLevel = 1,
    enemies: readonly EnemyController[] = []
  ): EnemyController | undefined {
    const margin = Math.max(BALANCE.enemy.radius, BALANCE.deer.buck.radius, BALANCE.armadillo.radius);
    if (this.navigation?.unbounded) {
      const { spawnMinDistance, spawnMaxDistance } = BALANCE.spawner;
      const angle = Math.random() * Math.PI * 2;
      const range = spawnMinDistance + Math.random() * (spawnMaxDistance - spawnMinDistance);
      for (const offset of openingFlankOffsets) {
        const direction = angle + offset;
        const spot = { x: playerPosition.x + Math.cos(direction) * range, y: playerPosition.y + Math.sin(direction) * range };
        if (enemies.some(enemy => !enemy.isDead && distanceSq(enemy.position, spot) < (enemy.radius + margin) ** 2)) continue;
        return new EnemyController(this.scene, spot.x, spot.y, difficultyMinutes, this.navigation, undefined, variant, playerLevel);
      }
      return undefined;
    }
    const view = cameraViewBounds(playerPosition, camera);
    const padding = BALANCE.spawner.spawnOutsideViewPadding;
    const firstSide = Phaser.Math.Between(0, 3);
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

      return new EnemyController(this.scene, spawn.x, spawn.y, difficultyMinutes, this.navigation, undefined, variant, playerLevel);
    }
    return undefined;
  }
}
