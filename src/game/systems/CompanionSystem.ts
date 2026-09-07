import type { SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import type { PlayerStats, Vector2Like } from '../core/types';
import { EnemyController } from '../entities/EnemyController';
import { MysteryCompanion } from '../entities/MysteryCompanion';
import { MidnightCompanion } from '../entities/MidnightCompanion';
import type { DealDamage } from '../core/CombatResolver';

export class CompanionSystem {
  private mystery?: MysteryCompanion;
  private midnight?: MidnightCompanion;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly stats: PlayerStats,
    private readonly navigation?: SceneryNavigation
  ) {}

  update(
    deltaMs: number,
    playerPosition: Vector2Like,
    playerMovementDirection: Vector2Like,
    enemies: EnemyController[],
    damage: DealDamage
  ): void {
    if (this.stats.hasMysteryCompanion && !this.mystery) {
      this.mystery = new MysteryCompanion(this.scene, this.stats, playerPosition, this.navigation);
    }

    this.mystery?.update(deltaMs, playerPosition, playerMovementDirection, enemies, damage);
    if (this.stats.hasMidnightCompanion && !this.midnight) this.midnight = new MidnightCompanion(this.scene, playerPosition, this.navigation);
    this.midnight?.update(deltaMs, playerPosition, enemies, damage);
  }

  destroy(): void {
    this.mystery?.destroy();
    this.mystery = undefined;
    this.midnight?.destroy(); this.midnight = undefined;
  }

  get positions(): Vector2Like[] { return [this.mystery?.position, this.midnight?.position].filter((p): p is Vector2Like => Boolean(p)); }
}
