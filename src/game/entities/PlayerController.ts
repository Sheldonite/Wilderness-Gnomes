import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME_CONFIG } from '../config/gameConfig';
import type { PlayerStats, Vector2Like } from '../core/types';
import { clampToArena, normalize } from '../utils/math';

export class PlayerController {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly radius = BALANCE.player.radius;
  private lastFacingX = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly stats: PlayerStats,
    x: number,
    y: number
  ) {
    this.sprite = scene.add.sprite(x, y, 'player-placeholder');
    this.sprite.setDepth(20);
  }

  update(deltaMs: number, keys: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>): void {
    const horizontal = Number(keys.d.isDown) - Number(keys.a.isDown);
    const vertical = Number(keys.s.isDown) - Number(keys.w.isDown);
    const direction = normalize(horizontal, vertical);
    const dt = deltaMs / 1000;

    const next = clampToArena(
      {
        x: this.sprite.x + direction.x * this.stats.speed * dt,
        y: this.sprite.y + direction.y * this.stats.speed * dt
      },
      this.radius
    );

    this.sprite.setPosition(next.x, next.y);

    if (Math.abs(direction.x) > 0.05) {
      this.lastFacingX = direction.x;
    }

    this.sprite.setFlipX(this.lastFacingX < 0);
    this.sprite.setRotation(direction.x * 0.08);
    this.sprite.setScale(1, direction.y !== 0 || direction.x !== 0 ? 1.04 : 1);
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  resetToCenter(): void {
    this.sprite.setPosition(GAME_CONFIG.arena.width / 2, GAME_CONFIG.arena.height / 2);
  }
}
