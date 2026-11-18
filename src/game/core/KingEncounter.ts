import { KING } from '../config/kingBoss';
import { BOSS_ENGAGE_DISTANCE } from './BossPursuit';
import type { Vector2Like } from './types';
import { clamp, distanceSq, normalize } from '../utils/math';

export type KingPhase = 'arrival' | 'stalking' | 'curling' | 'rolling' | 'turning' | 'dizzy';
export interface KingRollLane { from: Vector2Like; direction: Vector2Like; length: number }
/** A blow the King lands: damage, the direction the player is thrown, and how far (default: a roll's). */
export type KingHit = (damage: number, push: Vector2Like, knockback?: number) => void;
export interface ShardBurst { origin: Vector2Like; directions: Vector2Like[] }
/**
 * A ground ripple spreading from where he dug in. `from` is where the leg he rolled in on
 * began: the lane between `from` and `origin` is the safe corridor.
 */
export interface GroundRipple { origin: Vector2Like; from: Vector2Like; radius: number; landed: boolean }

/** Whether a point (with this body radius) stands in the lane a ripple's leg rolled along. */
export function inSafeLane(ripple: GroundRipple, point: Vector2Like, bodyRadius = 0): boolean {
  const ax = ripple.from.x, ay = ripple.from.y, bx = ripple.origin.x, by = ripple.origin.y;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  if (!len2) return false;
  const t = ((point.x - ax) * dx + (point.y - ay) * dy) / len2;
  if (t < 0 || t > 1) return false;
  return distanceSq({ x: ax + dx * t, y: ay + dy * t }, point) <= Math.max(0, KING.rippleSafeHalfWidth - bodyRadius) ** 2;
}

/**
 * One encounter per run, advanced only on the gameplay clock.
 * The King locks a lane and rolls along it, then digs in to send out a ripple and wind up a new
 * roll. Each leg can hit once, and its lane is safe from its ripple. He ends the sequence dizzy
 * and sprays a ring of shards. Enraged, he turns faster, rolls an extra leg and throws more shards.
 */
export class KingEncounter {
  defeated = false;
  phase: KingPhase = 'arrival';
  /** Locked during each windup and roll. */
  lane?: KingRollLane;
  /** Offset the boss must move this frame while rolling; the entity applies it. */
  rollStep: Vector2Like = { x: 0, y: 0 };
  /** Where the current leg ended this frame. */
  impact?: Vector2Like;
  /** Shards released this frame, if the roll just ended. */
  shards?: ShardBurst;
  /** Armadillos owed to the fight; the system spawns them and resets this. */
  pendingAdds = 0;
  /** Ground ripples still spreading. */
  ripples: GroundRipple[] = [];
  private timer: number = KING.introductionMs;
  private legsLeft = 0;
  private travelled = 0;
  private hitThisLeg = false;
  private addWaves = 0;
  private healthFraction = 1;

  get enraged(): boolean { return this.healthFraction <= KING.enrageFraction; }
  /** Dizzy after a roll: the damage window. */
  get vulnerable(): boolean { return this.phase === 'dizzy'; }

  update(deltaMs: number, boss: Vector2Like, player: Vector2Like, playerRadius: number, healthFraction: number, hit: KingHit): void {
    this.rollStep = { x: 0, y: 0 };
    this.impact = undefined;
    this.shards = undefined;
    if (this.defeated) return;
    this.healthFraction = healthFraction;
    while (this.addWaves < KING.addThresholds.length && healthFraction <= KING.addThresholds[this.addWaves]) {
      this.addWaves++; this.pendingAdds += KING.addsPerWave;
    }
    this.spreadRipples(deltaMs, player, playerRadius, hit);
    if (this.phase === 'rolling') { this.roll(deltaMs, boss, player, playerRadius, hit); return; }
    this.timer -= deltaMs;
    if (this.timer > 0) return;
    if (this.phase === 'arrival') { this.phase = 'stalking'; this.timer = 1000; }
    else if (this.phase === 'stalking') {
      if (distanceSq(boss, player) > BOSS_ENGAGE_DISTANCE ** 2) return;
      this.phase = 'curling';
      this.timer = this.enraged ? KING.enragedCurlMs : KING.curlMs;
      this.lane = this.aimLane(boss, player);
    } else if (this.phase === 'curling' || this.phase === 'turning') {
      if (this.phase === 'curling') this.legsLeft = this.enraged ? KING.enragedRollLegs : KING.rollLegs;
      this.phase = 'rolling'; this.travelled = 0; this.hitThisLeg = false;
    } else if (this.phase === 'dizzy') {
      this.phase = 'stalking'; this.timer = this.enraged ? KING.enragedCooldownMs : KING.cooldownMs;
    }
  }

  private aimLane(from: Vector2Like, target: Vector2Like): KingRollLane {
    const dx = target.x - from.x, dy = target.y - from.y;
    const distance = Math.hypot(dx, dy);
    return {
      from: { ...from },
      direction: distance ? { x: dx / distance, y: dy / distance } : { x: 1, y: 0 },
      length: clamp(distance + KING.rollOvershoot, KING.rollMinDistance, KING.rollMaxDistance)
    };
  }

  private roll(deltaMs: number, boss: Vector2Like, player: Vector2Like, playerRadius: number, hit: KingHit): void {
    const lane = this.lane!;
    const travel = Math.min(KING.rollSpeed * deltaMs / 1000, lane.length - this.travelled);
    this.travelled += travel;
    this.rollStep = { x: lane.direction.x * travel, y: lane.direction.y * travel };
    const next = { x: boss.x + this.rollStep.x, y: boss.y + this.rollStep.y };
    this.strike(boss, next, player, playerRadius, lane.direction, hit);
    if (this.travelled < lane.length - 1e-6) return;

    this.impact = next;
    this.ripples.push({ origin: next, from: lane.from, radius: 0, landed: false });
    if (--this.legsLeft === 0) {
      this.endRoll(next, lane.direction);
    } else {
      this.phase = 'turning';
      this.timer = this.enraged ? KING.enragedTurnWindupMs : KING.turnWindupMs;
      this.lane = this.aimLane(next, player);
    }
  }

  private strike(a: Vector2Like, b: Vector2Like, player: Vector2Like, playerRadius: number, direction: Vector2Like, hit: KingHit): void {
    if (this.hitThisLeg) return;
    const reach = KING.radius + playerRadius;
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((player.x - a.x) * dx + (player.y - a.y) * dy) / len2)) : 0;
    if (distanceSq({ x: a.x + dx * t, y: a.y + dy * t }, player) > reach * reach) return;
    this.hitThisLeg = true;
    hit(KING.rollDamage, direction);
  }

  /** Grow every ripple; each can hurt the player once as its ring passes, unless they stand in its safe lane. */
  private spreadRipples(deltaMs: number, player: Vector2Like, playerRadius: number, hit: KingHit): void {
    for (const r of this.ripples) {
      const before = r.radius;
      r.radius += KING.rippleSpeed * deltaMs / 1000;
      if (r.landed) continue;
      // the ring's leading edge swept over the player this frame (or the player stands in its band)
      const d = Math.sqrt(distanceSq(r.origin, player));
      const band = KING.rippleWidth / 2 + playerRadius;
      if (d > r.radius + band || d < before - band) continue;
      if (inSafeLane(r, player, playerRadius)) continue;
      r.landed = true;
      const push = normalize(player.x - r.origin.x, player.y - r.origin.y);
      hit(KING.rippleDamage, push.x === 0 && push.y === 0 ? { x: 1, y: 0 } : push, KING.rippleKnockback);
    }
    this.ripples = this.ripples.filter(r => r.radius < KING.rippleReach);
  }

  private endRoll(at: Vector2Like, direction: Vector2Like): void {
    this.phase = 'dizzy';
    this.timer = KING.dizzyMs;
    this.lane = undefined;
    const count = this.enraged ? KING.enragedShardCount : KING.shardCount;
    const offset = Math.atan2(direction.y, direction.x);
    this.shards = { origin: { ...at }, directions: Array.from({ length: count }, (_, i) => {
      const a = offset + i * Math.PI * 2 / count;
      return { x: Math.cos(a), y: Math.sin(a) };
    }) };
  }

  defeat(): void {
    this.defeated = true; this.rollStep = { x: 0, y: 0 }; this.lane = undefined; this.impact = undefined;
    this.shards = undefined; this.pendingAdds = 0; this.ripples = [];
  }
}
