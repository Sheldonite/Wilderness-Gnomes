import { KING } from '../config/kingBoss';
import type { Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

export type KingPhase = 'arrival' | 'stalking' | 'curling' | 'rolling' | 'dizzy';
export interface KingArena { center: Vector2Like; radius: number }
/** A blow the King lands: damage, the direction the player is thrown, and how far (default: a roll's). */
export type KingHit = (damage: number, push: Vector2Like, knockback?: number) => void;
export interface ShardBurst { origin: Vector2Like; directions: Vector2Like[] }
/**
 * A ground ripple spreading from where he struck a wall. `from` is where the leg he rolled in on
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

/** Distance along unit `direction` from `from` to where it leaves the circle (0 if already leaving it). */
export function distanceToEdge(from: Vector2Like, direction: Vector2Like, center: Vector2Like, limit: number): number {
  const fx = from.x - center.x, fy = from.y - center.y;
  const b = fx * direction.x + fy * direction.y;
  const c = fx * fx + fy * fy - limit * limit;
  const disc = b * b - c;
  return disc < 0 ? 0 : Math.max(0, -b + Math.sqrt(disc));   // 0 when already heading out past the edge
}

/**
 * One encounter per run, advanced only on the gameplay clock.
 * The King stalks to a standoff, curls up while aiming (the first leg is locked and shown), then
 * rolls, ricocheting off the arena's edge a few times. Each leg can hit the player once. When the
 * roll ends he is dizzy, taking extra damage, and his shell sprays a ring of shards. Every wall
 * he strikes sends a ground ripple out that hurts everywhere except the lane he rolled in on. Below the
 * enrage fraction he curls faster, bounces more and throws more shards. Loyal armadillos join
 * as he passes each summon threshold.
 */
export class KingEncounter {
  spawned = false;
  defeated = false;
  phase: KingPhase = 'arrival';
  /** Roll direction: locked while curling, updated at every bounce. */
  direction: Vector2Like = { x: 1, y: 0 };
  /** Offset the boss must move this frame while rolling; the entity applies it. */
  rollStep: Vector2Like = { x: 0, y: 0 };
  /** Where he struck the arena's edge (or a tree) this frame. */
  bounces: Vector2Like[] = [];
  /** Shards released this frame, if the roll just ended. */
  shards?: ShardBurst;
  /** Armadillos owed to the fight; the system spawns them and resets this. */
  pendingAdds = 0;
  /** Ground ripples still spreading. */
  ripples: GroundRipple[] = [];
  /** Where the current leg of the roll began. */
  private legStart: Vector2Like = { x: 0, y: 0 };
  private timer: number = KING.introductionMs;
  private bouncesLeft = 0;
  private rollMs = 0;
  private hitThisLeg = false;
  private addWaves = 0;
  private healthFraction = 1;

  shouldSpawn(level: number): boolean {
    if (this.spawned || level < KING.level) return false;
    this.spawned = true; return true;
  }

  get enraged(): boolean { return this.healthFraction <= KING.enrageFraction; }
  /** Dizzy after a roll: the damage window. */
  get vulnerable(): boolean { return this.phase === 'dizzy'; }

  update(deltaMs: number, boss: Vector2Like, player: Vector2Like, playerRadius: number, healthFraction: number, arena: KingArena, hit: KingHit): void {
    this.rollStep = { x: 0, y: 0 };
    this.bounces = [];
    this.shards = undefined;
    if (!this.spawned || this.defeated) return;
    this.healthFraction = healthFraction;
    while (this.addWaves < KING.addThresholds.length && healthFraction <= KING.addThresholds[this.addWaves]) {
      this.addWaves++; this.pendingAdds += KING.addsPerWave;
    }
    this.spreadRipples(deltaMs, player, playerRadius, hit);
    if (this.phase === 'rolling') { this.roll(deltaMs, boss, player, playerRadius, arena, hit); return; }
    this.timer -= deltaMs;
    if (this.timer > 0) return;
    if (this.phase === 'arrival') { this.phase = 'stalking'; this.timer = 1000; }
    else if (this.phase === 'stalking') {
      this.phase = 'curling';
      this.timer = this.enraged ? KING.enragedCurlMs : KING.curlMs;
      const aim = normalize(player.x - boss.x, player.y - boss.y);
      this.direction = aim.x === 0 && aim.y === 0 ? { x: 1, y: 0 } : aim;
    } else if (this.phase === 'curling') {
      this.phase = 'rolling'; this.rollMs = 0; this.hitThisLeg = false; this.legStart = { ...boss };
      this.bouncesLeft = this.enraged ? KING.enragedBounces : KING.bounces;
    } else if (this.phase === 'dizzy') {
      this.phase = 'stalking'; this.timer = this.enraged ? KING.enragedCooldownMs : KING.cooldownMs;
    }
  }

  private roll(deltaMs: number, boss: Vector2Like, player: Vector2Like, playerRadius: number, arena: KingArena, hit: KingHit): void {
    this.rollMs += deltaMs;
    const limit = arena.radius - KING.radius;
    let pos = { ...boss }, remaining = KING.rollSpeed * deltaMs / 1000;
    for (let i = 0; i < 6 && remaining > 1e-6 && this.phase === 'rolling'; i++) {
      const toEdge = distanceToEdge(pos, this.direction, arena.center, limit);
      const reachesEdge = toEdge <= remaining;
      const travel = reachesEdge ? toEdge : remaining;
      const next = { x: pos.x + this.direction.x * travel, y: pos.y + this.direction.y * travel };
      this.strike(pos, next, player, playerRadius, hit);
      pos = next; remaining -= travel;
      if (reachesEdge) {
        // Reached the edge this frame: ricochet off the wall's normal.
        const n = normalize(pos.x - arena.center.x, pos.y - arena.center.y);
        const dot = this.direction.x * n.x + this.direction.y * n.y;
        if (dot > 0) this.direction = normalize(this.direction.x - 2 * dot * n.x, this.direction.y - 2 * dot * n.y);
        this.bounce(pos);
      }
    }
    this.rollStep = { x: pos.x - boss.x, y: pos.y - boss.y };
    if (this.phase === 'rolling' && this.rollMs >= KING.rollMaxMs) this.endRoll(pos);
  }

  private strike(a: Vector2Like, b: Vector2Like, player: Vector2Like, playerRadius: number, hit: KingHit): void {
    if (this.hitThisLeg) return;
    const reach = KING.radius + playerRadius;
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((player.x - a.x) * dx + (player.y - a.y) * dy) / len2)) : 0;
    if (distanceSq({ x: a.x + dx * t, y: a.y + dy * t }, player) > reach * reach) return;
    this.hitThisLeg = true;
    hit(KING.rollDamage, this.direction);
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

  private bounce(at: Vector2Like): void {
    this.bounces.push({ ...at });
    this.ripples.push({ origin: { ...at }, from: { ...this.legStart }, radius: 0, landed: false });
    this.legStart = { ...at };
    this.hitThisLeg = false;
    this.bouncesLeft--;
    if (this.bouncesLeft < 0) this.endRoll(at);
  }

  private endRoll(at: Vector2Like): void {
    this.phase = 'dizzy';
    this.timer = KING.dizzyMs;
    const count = this.enraged ? KING.enragedShardCount : KING.shardCount;
    const offset = Math.atan2(this.direction.y, this.direction.x);
    this.shards = { origin: { ...at }, directions: Array.from({ length: count }, (_, i) => {
      const a = offset + i * Math.PI * 2 / count;
      return { x: Math.cos(a), y: Math.sin(a) };
    }) };
  }

  /** Called when scenery stops the roll: he rebounds straight back, and it counts as a bounce. */
  blocked(at: Vector2Like): void {
    if (this.phase !== 'rolling') return;
    this.direction = { x: -this.direction.x, y: -this.direction.y };
    this.bounce(at);
  }

  defeat(): void {
    this.defeated = true; this.rollStep = { x: 0, y: 0 }; this.bounces = []; this.shards = undefined; this.pendingAdds = 0; this.ripples = [];
  }
}
