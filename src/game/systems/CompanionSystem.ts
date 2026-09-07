import type { SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import type { PlayerStats, Vector2Like } from '../core/types';
import { EnemyController } from '../entities/EnemyController';
import { MysteryCompanion } from '../entities/MysteryCompanion';
import { MidnightCompanion } from '../entities/MidnightCompanion';
import { FrankieCompanion } from '../entities/FrankieCompanion';
import { TobiasCompanion } from '../entities/TobiasCompanion';
import type { DealDamage } from '../core/CombatResolver';

export class CompanionSystem {
  private mystery?: MysteryCompanion;
  private midnight?: MidnightCompanion;
  private frankie?: FrankieCompanion;
  private tobias?: TobiasCompanion;

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
    if (this.stats.hasMidnightCompanion && !this.midnight) this.midnight = new MidnightCompanion(this.scene, playerPosition, this.navigation, this.stats);
    this.midnight?.update(deltaMs, playerPosition, enemies, damage);
    if (this.stats.hasFrankieCompanion && !this.frankie) this.frankie = new FrankieCompanion(this.scene, this.stats, playerPosition);
    this.frankie?.update(deltaMs, playerPosition, enemies, damage);
    if (this.stats.hasTobiasCompanion && !this.tobias) this.tobias = new TobiasCompanion(this.scene, this.stats, playerPosition);
    this.tobias?.update(deltaMs, playerPosition, enemies, damage);
  }

  destroy(): void {
    this.mystery?.destroy();
    this.mystery = undefined;
    this.midnight?.destroy(); this.midnight = undefined;
    this.frankie?.destroy(); this.frankie = undefined;
    this.tobias?.destroy(); this.tobias = undefined;
  }

  get positions(): Vector2Like[] {
    return [this.mystery?.position, this.midnight?.position, this.tobias?.position, ...(this.frankie?.positions ?? [])].filter((p): p is Vector2Like => Boolean(p));
  }
}
