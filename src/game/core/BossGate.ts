import { OVEN } from '../config/ovenBoss';
import { STAG } from '../config/stagBoss';
import type { Vector2Like } from './types';

export type BossId = 'oven' | 'stag';
export const BOSS_ARENA_RADIUS = 520;

/** Progression and arena gates survive level skips, and reset only with the run. */
export class BossGate {
  private readonly victories = new Set<BossId>();
  required(level: number): BossId | undefined {
    if (level >= OVEN.level && !this.victories.has('oven')) return 'oven';
    if (level >= STAG.level && !this.victories.has('stag')) return 'stag';
  }
  defeat(id: BossId): boolean {
    if (this.victories.has(id)) return false;
    this.victories.add(id); return true;
  }
}

export function insideBossArena(position: Vector2Like, center: Vector2Like, bodyRadius: number): Vector2Like {
  const dx = position.x - center.x, dy = position.y - center.y;
  const distance = Math.hypot(dx, dy), limit = BOSS_ARENA_RADIUS - bodyRadius;
  return distance <= limit ? position : { x: center.x + dx / distance * limit, y: center.y + dy / distance * limit };
}
