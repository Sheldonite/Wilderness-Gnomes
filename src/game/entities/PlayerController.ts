import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME_CONFIG } from '../config/gameConfig';
import { PLAYER_SPRITE_KEY } from '../config/playerSprite';
import type { PlayerStats, Vector2Like } from '../core/types';
import { clampToArena, normalize } from '../utils/math';

const PLAYER_IDLE_ANIMATION_KEY = 'player-idle-down';
const PLAYER_SPRITE_SCALE = 0.75;

const PLAYER_WALK_ANIMATION_BY_DIRECTION: Record<string, string> = {
  '0,1': 'player-walk-down',
  '1,1': 'player-walk-down-right',
  '1,0': 'player-walk-right',
  '1,-1': 'player-walk-up-right',
  '0,-1': 'player-walk-up',
  '-1,-1': 'player-walk-up-left',
  '-1,0': 'player-walk-left',
  '-1,1': 'player-walk-down-left'
};

export class PlayerController {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly radius = BALANCE.player.radius;
  private movementDirection: Vector2Like = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly stats: PlayerStats,
    x: number,
    y: number
  ) {
    this.sprite = scene.add.sprite(x, y, PLAYER_SPRITE_KEY, 0);
    this.sprite.setDepth(20);
    this.sprite.setScale(PLAYER_SPRITE_SCALE);
    this.sprite.play(PLAYER_IDLE_ANIMATION_KEY);
  }

  update(deltaMs: number, keys: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>): void {
    const horizontal = Number(keys.d.isDown) - Number(keys.a.isDown);
    const vertical = Number(keys.s.isDown) - Number(keys.w.isDown);
    const direction = normalize(horizontal, vertical);
    this.movementDirection = direction;
    const dt = deltaMs / 1000;

    const next = clampToArena(
      {
        x: this.sprite.x + direction.x * this.stats.speed * dt,
        y: this.sprite.y + direction.y * this.stats.speed * dt
      },
      this.radius
    );

    this.sprite.setPosition(next.x, next.y);
    this.updateAnimation(horizontal, vertical);
  }

  private updateAnimation(horizontal: number, vertical: number): void {
    if (horizontal === 0 && vertical === 0) {
      this.sprite.play(PLAYER_IDLE_ANIMATION_KEY, true);
      return;
    }

    const animationKey = PLAYER_WALK_ANIMATION_BY_DIRECTION[`${horizontal},${vertical}`];
    this.sprite.play(animationKey, true);
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  get currentMovementDirection(): Vector2Like {
    return this.movementDirection;
  }

  resetToCenter(): void {
    this.sprite.setPosition(GAME_CONFIG.arena.width / 2, GAME_CONFIG.arena.height / 2);
  }
}
