import { BALANCE } from '../config/balance';
import type { Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

export type ArmadilloPhase = 'approaching' | 'curling' | 'rolling' | 'recovering';

/** Walks in, curls, then rolls in a locked line at the player. */
export class ArmadilloBehavior {
  phase: ArmadilloPhase = 'approaching';
  facing: Vector2Like = { x: 1, y: 0 };
  private timer = 0;
  private cooldownMs = 0;
  private travelled = 0;
  private rollDir: Vector2Like = { x: 1, y: 0 };

  get rolling(): boolean { return this.phase === 'rolling'; }
  get curling(): boolean { return this.phase === 'curling'; }

  update(deltaMs: number, position: Vector2Like, player: Vector2Like): Vector2Like {
    const a = BALANCE.armadillo;
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    const toward = normalize(player.x - position.x, player.y - position.y);
    if (toward.x !== 0 || toward.y !== 0) this.facing = toward;

    if (this.phase === 'rolling') {
      const step = a.rollSpeed * deltaMs / 1000;
      this.travelled += step;
      if (this.travelled >= a.rollDistance) {
        this.phase = 'recovering';
        this.timer = a.recoverMs;
        this.cooldownMs = a.cooldownMs;
        return { x: 0, y: 0 };
      }
      return { x: this.rollDir.x * step, y: this.rollDir.y * step };
    }

    this.timer -= deltaMs;
    if (this.phase === 'curling') {
      if (this.timer <= 0) {
        this.phase = 'rolling';
        this.travelled = 0;
        this.rollDir = this.facing.x === 0 && this.facing.y === 0 ? { x: 1, y: 0 } : { ...this.facing };
      }
      return { x: 0, y: 0 };
    }
    if (this.phase === 'recovering') {
      if (this.timer <= 0) this.phase = 'approaching';
      return { x: 0, y: 0 };
    }

    const range = Math.sqrt(distanceSq(position, player));
    if (this.cooldownMs <= 0 && range <= a.windupRange && range >= 8) {
      this.phase = 'curling';
      this.timer = a.curlMs;
      return { x: 0, y: 0 };
    }
    const step = a.walkSpeed * deltaMs / 1000;
    return { x: this.facing.x * step, y: this.facing.y * step };
  }

  blocked(): void {
    if (this.phase !== 'rolling') return;
    this.phase = 'recovering';
    this.timer = BALANCE.armadillo.recoverMs;
    this.cooldownMs = BALANCE.armadillo.cooldownMs;
  }
}
