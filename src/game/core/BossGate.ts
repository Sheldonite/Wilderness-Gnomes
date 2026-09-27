import { OVEN } from '../config/ovenBoss';
import { STAG } from '../config/stagBoss';
import { KING } from '../config/kingBoss';
import type { Vector2Like } from './types';

export type BossId = 'oven' | 'stag' | 'king';
export const BOSS_ARENA_RADIUS = 520;
export const BOSS_ORDER: BossId[] = ['oven', 'stag', 'king'];

/** Boss health grows with the run clock, so a slow run and a fast run both get a real fight. */
export function scaledBossHealth(base: number, perMinute: number, minutes: number): number {
  return Math.round(base + perMinute * Math.max(0, minutes));
}

/** Progression and arena gates survive level skips, and reset only with the run. */
export class BossGate {
  private readonly victories = new Set<BossId>();
  required(level: number): BossId | undefined {
    if (level >= OVEN.level && !this.victories.has('oven')) return 'oven';
    if (level >= STAG.level && !this.victories.has('stag')) return 'stag';
    if (level >= KING.level && !this.victories.has('king')) return 'king';
  }
  /** Every boss has fallen: the run is won, and anything further is an encore. */
  get allDefeated(): boolean { return this.victories.size === BOSS_ORDER.length; }
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
