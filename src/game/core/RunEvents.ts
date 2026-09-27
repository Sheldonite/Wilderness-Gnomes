import { BALANCE } from '../config/balance';
import type { Vector2Like } from './types';

export type RunEvent = { kind: 'elite' } | { kind: 'ring'; count: number } | { kind: 'stampede'; lanes: number };
export interface StampedeLane { from: Vector2Like; direction: Vector2Like; length: number }

/** Creatures in an encircling ring after this many minutes. */
export function ringCount(minutes: number): number {
  const e = BALANCE.events;
  return Math.min(e.ringMax, Math.floor(e.ringBase + e.ringPerMinute * Math.max(0, minutes)));
}

/** Evenly spaced points on a circle, starting from `offset` radians. */
export function ringPositions(center: Vector2Like, count: number, radius: number, offset = 0): Vector2Like[] {
  return Array.from({ length: count }, (_, i) => {
    const a = offset + i * Math.PI * 2 / count;
    return { x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius };
  });
}

/** A straight lane of the given length whose midpoint is `through`. */
export function stampedeLane(through: Vector2Like, angle: number, length: number): StampedeLane {
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  return { from: { x: through.x - direction.x * length / 2, y: through.y - direction.y * length / 2 }, direction, length };
}

/** Where each runner starts: the lead at the lane's start, the rest queued up behind it. */
export function stampedeStarts(lane: StampedeLane, count: number, spacing: number): Vector2Like[] {
  return Array.from({ length: count }, (_, i) => ({ x: lane.from.x - lane.direction.x * i * spacing, y: lane.from.y - lane.direction.y * i * spacing }));
}

/**
 * Schedules elites, encircling rings and stampedes. Its clock only advances while the caller
 * says the woods are open, so boss fights neither trigger events nor stack a backlog of them.
 */
export class RunEvents {
  private clockMs = 0;
  private nextElite: number = BALANCE.elite.firstMs;
  private nextRing: number = BALANCE.events.ringFirstMs;
  private nextStampede: number = BALANCE.events.stampedeFirstMs;

  get elapsedMs(): number { return this.clockMs; }

  update(deltaMs: number, minutes: number): RunEvent[] {
    this.clockMs += Math.max(0, deltaMs);
    const events: RunEvent[] = [];
    if (this.clockMs >= this.nextElite) {
      events.push({ kind: 'elite' });
      this.nextElite = Math.max(this.nextElite + BALANCE.elite.everyMs, this.clockMs);
    }
    if (this.clockMs >= this.nextRing) {
      events.push({ kind: 'ring', count: ringCount(minutes) });
      this.nextRing = Math.max(this.nextRing + BALANCE.events.ringEveryMs, this.clockMs);
    }
    if (this.clockMs >= this.nextStampede) {
      events.push({ kind: 'stampede', lanes: minutes >= BALANCE.events.doubleStampedeMinute ? 2 : 1 });
      this.nextStampede = Math.max(this.nextStampede + BALANCE.events.stampedeEveryMs, this.clockMs);
    }
    return events;
  }
}
