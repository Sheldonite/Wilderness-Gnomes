import { SQUIRREL_CHIEF } from '../config/squirrelChief';
import { OVEN } from '../config/ovenBoss';
import { STAG } from '../config/stagBoss';
import { BUZZARD } from '../config/buzzardBoss';
import { KING } from '../config/kingBoss';

export const BOSS_WAIT_MS = 60_000;
const ENCORE_ORDER = ['oven', 'stag', 'buzzard', 'king'] as const;
const BOSS_ORDER = ['chief', ...ENCORE_ORDER] as const;
export type BossId = typeof BOSS_ORDER[number];

const BOSS_NAMES: Record<BossId, string> = {
  chief: SQUIRREL_CHIEF.name,
  oven: OVEN.name,
  stag: STAG.name,
  buzzard: BUZZARD.name,
  king: KING.name
};

export interface UpcomingBoss {
  id: BossId;
  name: string;
  remainingMs: number;
  healthMultiplier: number;
}

/** Boss health grows with the active run clock. */
export function scaledBossHealth(base: number, perMinute: number, minutes: number): number {
  return Math.round(base + perMinute * Math.max(0, minutes));
}

/** One active fight at a time. The next countdown starts on the current boss's defeat. */
export class BossSchedule {
  private nextIndex: number;
  private dueAtMs = BOSS_WAIT_MS;
  private active?: BossId;

  constructor(firstBoss: BossId = 'chief') {
    this.nextIndex = BOSS_ORDER.indexOf(firstBoss);
  }

  get activeBoss(): BossId | undefined { return this.active; }
  get storyFinished(): boolean { return this.nextIndex >= BOSS_ORDER.length; }

  upcoming(elapsedMs: number): UpcomingBoss | undefined {
    if (this.active) return;
    const remainingMs = Math.max(0, this.dueAtMs - elapsedMs);
    if (!this.storyFinished) {
      const id = BOSS_ORDER[this.nextIndex];
      return { id, name: BOSS_NAMES[id], remainingMs, healthMultiplier: 1 };
    }
    const encoreIndex = this.nextIndex - BOSS_ORDER.length;
    const id = ENCORE_ORDER[encoreIndex % ENCORE_ORDER.length];
    return { id, name: `${BOSS_NAMES[id]} (Encore ${encoreIndex + 1})`, remainingMs, healthMultiplier: 1 + 0.45 * encoreIndex };
  }

  startDue(elapsedMs: number): UpcomingBoss | undefined {
    const next = this.upcoming(elapsedMs);
    if (!next || next.remainingMs > 0) return;
    this.active = next.id;
    return next;
  }

  defeat(id: BossId, elapsedMs: number): boolean {
    if (this.active !== id) return false;
    this.active = undefined;
    this.nextIndex++;
    this.dueAtMs = elapsedMs + BOSS_WAIT_MS;
    return true;
  }
}
