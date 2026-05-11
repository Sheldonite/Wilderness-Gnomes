import Phaser from 'phaser';
import type { PlayerStats, Vector2Like } from '../core/types';
import { EnemyController } from '../entities/EnemyController';
import { MysteryCompanion } from '../entities/MysteryCompanion';

export class CompanionSystem {
  private mystery?: MysteryCompanion;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly stats: PlayerStats
  ) {}

  update(
    deltaMs: number,
    playerPosition: Vector2Like,
    enemies: EnemyController[],
    onEnemyKilled: (enemy: EnemyController) => void
  ): void {
    if (this.stats.hasMysteryCompanion && !this.mystery) {
      this.mystery = new MysteryCompanion(this.scene, this.stats, playerPosition);
    }

    this.mystery?.update(deltaMs, playerPosition, enemies, onEnemyKilled);
  }

  destroy(): void {
    this.mystery?.destroy();
    this.mystery = undefined;
  }
}
