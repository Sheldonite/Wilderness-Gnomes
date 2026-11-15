import { OVEN } from '../config/ovenBoss';
import { STAG } from '../config/stagBoss';
import { BUZZARD } from '../config/buzzardBoss';
import { KING } from '../config/kingBoss';
import type { Vector2Like } from './types';

export type BossId = 'oven' | 'stag' | 'buzzard' | 'king';
export const BOSS_ARENA_RADIUS = 520;
export const BOSS_ORDER: BossId[] = ['oven', 'stag', 'buzzard', 'king'];

const BOSS_DEFINITIONS: Record<BossId, { name: string; level: number }> = {
  oven: OVEN,
  stag: STAG,
  buzzard: BUZZARD,
  king: KING
};

export interface BossMilestone {
  id: BossId;
  name: string;
  level: number;
  encore: boolean;
  cycle: number;
}

/** Boss health grows with the run clock, so a slow run and a fast run both get a real fight. */
export function scaledBossHealth(base: number, perMinute: number, minutes: number): number {
  return Math.round(base + perMinute * Math.max(0, minutes));
}

/** Progression and arena gates survive level skips, and reset only with the run. */
export class BossGate {
  private readonly victories = new Set<BossId>();
  private _encoreCount = 0;

  required(level: number): BossId | undefined {
    if (level >= OVEN.level && !this.victories.has('oven')) return 'oven';
    if (level >= STAG.level && !this.victories.has('stag')) return 'stag';
    if (level >= BUZZARD.level && !this.victories.has('buzzard')) return 'buzzard';
    if (level >= KING.level && !this.victories.has('king')) return 'king';
  }

  /** Every boss has fallen: the run is won, and anything further is an encore. */
  get allDefeated(): boolean { return this.victories.size === BOSS_ORDER.length; }

  get encoreCount(): number { return this._encoreCount; }

  defeat(id: BossId): boolean {
    if (this.victories.has(id)) return false;
    this.victories.add(id); return true;
  }

  /** Player level at which the given Encore cycle (0-indexed) becomes due: 40, 50, 60... */
  encoreLevelFor(cycle = this._encoreCount): number {
    return KING.level + 10 * (Math.max(0, cycle) + 1);
  }

  /** Boss who answers the call for the given Encore cycle (0-indexed). */
  encoreBossFor(cycle = this._encoreCount): BossId {
    return BOSS_ORDER[Math.max(0, cycle) % BOSS_ORDER.length];
  }

  /** Encore boss due at `level` once all story bosses have fallen, else undefined. */
  encoreAvailable(level: number): BossId | undefined {
    if (!this.allDefeated) return undefined;
    if (level < this.encoreLevelFor(this._encoreCount)) return undefined;
    return this.encoreBossFor(this._encoreCount);
  }

  /** Mark the current Encore boss defeated and advance the Encore counter. */
  defeatEncore(_id?: BossId): number {
    if (!this.allDefeated) return this._encoreCount;
    this._encoreCount += 1;
    return this._encoreCount;
  }

  /** Health multiplier for Encore bosses so each repeat encounter bites harder. */
  encoreHealthMultiplier(): number {
    return 1 + 0.45 * this._encoreCount;
  }

  /** Next upcoming boss encounter (story boss or Encore boss), for HUD indicators. */
  nextBossMilestone(_level: number): BossMilestone {
    for (const id of BOSS_ORDER) {
      if (!this.victories.has(id)) {
        const def = BOSS_DEFINITIONS[id];
        return { id, name: def.name, level: def.level, encore: false, cycle: 0 };
      }
    }
    const id = this.encoreBossFor(this._encoreCount);
    const def = BOSS_DEFINITIONS[id];
    const cycle = this._encoreCount + 1;
    return {
      id,
      name: `${def.name} (Encore ${cycle})`,
      level: this.encoreLevelFor(this._encoreCount),
      encore: true,
      cycle
    };
  }
}

export function insideBossArena(position: Vector2Like, center: Vector2Like, bodyRadius: number): Vector2Like {
  const dx = position.x - center.x, dy = position.y - center.y;
  const distance = Math.hypot(dx, dy), limit = BOSS_ARENA_RADIUS - bodyRadius;
  return distance <= limit ? position : { x: center.x + dx / distance * limit, y: center.y + dy / distance * limit };
}
