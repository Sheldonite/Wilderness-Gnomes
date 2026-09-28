import { BALANCE } from '../config/balance';
import type { Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

export type BuzzardFlightPhase = 'approaching' | 'windup' | 'swooping' | 'recovering';

/**
 * Pure flight rules for buzzard enemies, kept free of rendering for tests. They fly straight at the
 * player over scenery; when close and ready they hover with wings raised (the tell), then swoop along
 * the line they locked, climb away for a moment, and come round again.
 */
export class BuzzardFlight {
  phase: BuzzardFlightPhase = 'approaching';
  facing: Vector2Like = { x: 1, y: 0 };
  private timer = 0;
  private cooldownMs: number;
  private travelled = 0;
  private swoopDir: Vector2Like = { x: 1, y: 0 };

  constructor(random: () => number = Math.random) {
    // stagger first swoops so a fresh flock does not dive all at once
    this.cooldownMs = BALANCE.buzzard.swoopCooldownMs * (0.3 + random() * 0.7);
  }

  get swooping(): boolean { return this.phase === 'swooping'; }
  get winding(): boolean { return this.phase === 'windup'; }

  /** The offset to fly this frame. `speed` is the approach speed after time bonuses and slows. */
  update(deltaMs: number, position: Vector2Like, player: Vector2Like, speed: number): Vector2Like {
    const b = BALANCE.buzzard;
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    if (this.phase === 'swooping') {
      const step = Math.min(b.swoopSpeed * deltaMs / 1000, b.swoopDistance - this.travelled);
      this.travelled += step;
      if (this.travelled >= b.swoopDistance - 1e-6) {
        this.phase = 'recovering'; this.timer = b.recoverMs; this.cooldownMs = b.swoopCooldownMs;
      }
      return { x: this.swoopDir.x * step, y: this.swoopDir.y * step };
    }
    if (this.phase === 'windup' || this.phase === 'recovering') {
      this.timer -= deltaMs;
      if (this.timer <= 0) {
        if (this.phase === 'windup') { this.phase = 'swooping'; this.travelled = 0; }
        else this.phase = 'approaching';
      }
      return { x: 0, y: 0 };
    }
    const toward = normalize(player.x - position.x, player.y - position.y);
    if (toward.x !== 0 || toward.y !== 0) this.facing = toward;
    const distance = Math.sqrt(distanceSq(position, player));
    if (this.cooldownMs <= 0 && distance <= b.swoopRange && distance > 30) {
      this.phase = 'windup'; this.timer = b.swoopWindupMs; this.swoopDir = { ...this.facing };
      return { x: 0, y: 0 };
    }
    const step = Math.min(distance, speed * deltaMs / 1000);
    return { x: toward.x * step, y: toward.y * step };
  }

  /** A swoop that runs into the arena edge simply ends early. */
  blocked(): void {
    if (this.phase !== 'swooping') return;
    this.phase = 'recovering'; this.timer = BALANCE.buzzard.recoverMs; this.cooldownMs = BALANCE.buzzard.swoopCooldownMs;
  }
}
