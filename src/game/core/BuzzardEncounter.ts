import { BUZZARD } from '../config/buzzardBoss';
import { distanceToEdge, type KingArena } from './KingEncounter';
import type { Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

export type BuzzardPhase = 'arrival' | 'circling' | 'diveWindup' | 'diving' | 'rising' | 'perched' | 'volleyWindup' | 'gustWindup';
export type BuzzardAttack = 'dive' | 'volley' | 'gust';
export interface DiveLane { from: Vector2Like; direction: Vector2Like; length: number }
export interface GustCone { origin: Vector2Like; direction: Vector2Like; range: number; halfAngle: number }
export interface FeatherVolley { origin: Vector2Like; directions: Vector2Like[] }
/** A blow King Frankie lands: damage, the direction the player is thrown, and how far. */
export type BuzzardHit = (damage: number, push: Vector2Like, knockback: number) => void;

/**
 * One encounter per run, advanced only on the gameplay clock.
 * He circles the player overhead (half damage, no body blows), then runs the next attack in
 * `BUZZARD.attackOrder`:
 * - Dive: hovers while a shadow lane is locked through the player, then dives down it. Each dive can
 *   hit once. When the dives are done he lands to catch his breath and takes extra damage.
 * - Feather volley: flaps and flings a fan of feathers along a locked aim.
 * - Gust: a wing-beat cone, locked at windup, that hurls the player back.
 * Below the enrage fraction: two dives in a row, quicker windups, a wider volley, shorter rests.
 */
export class BuzzardEncounter {
  spawned = false;
  defeated = false;
  phase: BuzzardPhase = 'arrival';
  lane?: DiveLane;
  gust?: GustCone;
  volleyAim?: Vector2Like;
  /** Feathers released this frame; the system launches them. */
  volley?: FeatherVolley;
  /** The cone that blew this frame, if any, for effects. */
  blown?: GustCone;
  /** Where he wants to fly this frame (circling or hovering); the entity steers toward it. */
  flyTarget: Vector2Like = { x: 0, y: 0 };
  /** Offset the boss must move this frame while diving; the entity applies it. */
  diveStep: Vector2Like = { x: 0, y: 0 };
  private timer: number = BUZZARD.introductionMs;
  private attackIndex = 0;
  private divesLeft = 0;
  private travelled = 0;
  private hitThisDive = false;
  private angle?: number;
  private healthFraction = 1;

  shouldSpawn(level: number): boolean {
    if (this.spawned || level < BUZZARD.level) return false;
    this.spawned = true; return true;
  }

  get enraged(): boolean { return this.healthFraction <= BUZZARD.enrageFraction; }
  /** Up in the air: body contact cannot happen. */
  get airborne(): boolean { return this.phase !== 'perched'; }
  /** Damage taken multiplier: hard to hurt in the air, exposed when landed. */
  get vulnerability(): number {
    return this.phase === 'perched' ? BUZZARD.perchVulnerability : this.phase === 'diving' ? 1 : BUZZARD.airborneVulnerability;
  }
  get nextAttack(): BuzzardAttack { return BUZZARD.attackOrder[this.attackIndex % BUZZARD.attackOrder.length]; }

  update(deltaMs: number, boss: Vector2Like, player: Vector2Like, playerRadius: number, healthFraction: number, arena: KingArena, hit: BuzzardHit): void {
    this.volley = undefined;
    this.blown = undefined;
    this.diveStep = { x: 0, y: 0 };
    this.flyTarget = { ...boss };
    if (!this.spawned || this.defeated) return;
    this.healthFraction = healthFraction;
    if (this.phase === 'diving') { this.dive(deltaMs, boss, player, playerRadius, hit); return; }
    if (this.phase === 'circling' || this.phase === 'arrival') this.circle(deltaMs, boss, player);
    this.timer -= deltaMs;
    if (this.timer > 0) return;
    if (this.phase === 'arrival' || this.phase === 'perched') this.startCircling();
    else if (this.phase === 'circling') this.beginAttack(boss, player, arena);
    else if (this.phase === 'rising') this.beginDive(boss, player, arena);
    else if (this.phase === 'diveWindup') { this.phase = 'diving'; this.travelled = 0; this.hitThisDive = false; }
    else if (this.phase === 'volleyWindup') this.releaseVolley(boss);
    else if (this.phase === 'gustWindup') this.releaseGust(player, playerRadius, hit);
  }

  private startCircling(ms: number = this.enraged ? BUZZARD.enragedCircleMs : BUZZARD.circleMs): void {
    this.phase = 'circling'; this.timer = ms;
  }

  /** Orbit the player, flying over everything. */
  private circle(deltaMs: number, boss: Vector2Like, player: Vector2Like): void {
    if (this.angle === undefined) this.angle = Math.atan2(boss.y - player.y, boss.x - player.x);
    this.angle += BUZZARD.circleSpeed * deltaMs / 1000;
    this.flyTarget = { x: player.x + Math.cos(this.angle) * BUZZARD.circleRadius, y: player.y + Math.sin(this.angle) * BUZZARD.circleRadius * BUZZARD.circleSquash };
  }

  private beginAttack(boss: Vector2Like, player: Vector2Like, arena: KingArena): void {
    const attack = this.nextAttack;
    this.attackIndex++;
    const aim = normalize(player.x - boss.x, player.y - boss.y);
    const facing = aim.x === 0 && aim.y === 0 ? { x: 1, y: 0 } : aim;
    if (attack === 'dive') {
      this.divesLeft = this.enraged ? BUZZARD.enragedDives : 1;
      this.beginDive(boss, player, arena);
    } else if (attack === 'volley') {
      this.phase = 'volleyWindup'; this.timer = BUZZARD.volleyWindupMs; this.volleyAim = facing;
    } else {
      this.phase = 'gustWindup'; this.timer = BUZZARD.gustWindupMs;
      this.gust = { origin: { ...boss }, direction: facing, range: BUZZARD.gustRange, halfAngle: BUZZARD.gustHalfAngle };
    }
  }

  /** Lock a lane through the player, stopping short of the arena's edge. */
  private beginDive(boss: Vector2Like, player: Vector2Like, arena: KingArena): void {
    this.divesLeft--;
    this.phase = 'diveWindup';
    this.timer = this.enraged ? BUZZARD.enragedDiveWindupMs : BUZZARD.diveWindupMs;
    const aim = normalize(player.x - boss.x, player.y - boss.y);
    const direction = aim.x === 0 && aim.y === 0 ? { x: 1, y: 0 } : aim;
    const wanted = Math.sqrt(distanceSq(boss, player)) + BUZZARD.diveOvershoot;
    const room = distanceToEdge(boss, direction, arena.center, arena.radius - BUZZARD.radius);
    this.lane = { from: { ...boss }, direction, length: Math.max(60, Math.min(wanted, room)) };
  }

  private dive(deltaMs: number, boss: Vector2Like, player: Vector2Like, playerRadius: number, hit: BuzzardHit): void {
    const lane = this.lane!;
    const step = Math.min(BUZZARD.diveSpeed * deltaMs / 1000, lane.length - this.travelled);
    this.diveStep = { x: lane.direction.x * step, y: lane.direction.y * step };
    this.travelled += step;
    const after = { x: boss.x + this.diveStep.x, y: boss.y + this.diveStep.y };
    if (!this.hitThisDive && segmentHits(boss, after, player, BUZZARD.radius + playerRadius)) {
      this.hitThisDive = true;
      hit(BUZZARD.diveDamage, lane.direction, BUZZARD.diveKnockback);
    }
    if (this.travelled < lane.length - 1e-6) return;
    this.lane = undefined;
    if (this.divesLeft > 0) { this.phase = 'rising'; this.timer = BUZZARD.diveGapMs; this.angle = undefined; }
    else { this.phase = 'perched'; this.timer = this.enraged ? BUZZARD.enragedPerchMs : BUZZARD.perchMs; this.angle = undefined; }
  }

  private releaseVolley(boss: Vector2Like): void {
    const aim = this.volleyAim ?? { x: 1, y: 0 };
    const count = this.enraged ? BUZZARD.enragedVolleyFeathers : BUZZARD.volleyFeathers;
    const base = Math.atan2(aim.y, aim.x);
    this.volley = { origin: { ...boss }, directions: Array.from({ length: count }, (_, i) => {
      const a = base - BUZZARD.volleySpread / 2 + i * BUZZARD.volleySpread / Math.max(1, count - 1);
      return { x: Math.cos(a), y: Math.sin(a) };
    }) };
    this.volleyAim = undefined;
    this.startCircling();
  }

  private releaseGust(player: Vector2Like, playerRadius: number, hit: BuzzardHit): void {
    const cone = this.gust!;
    this.blown = cone;
    if (inCone(cone, player, playerRadius)) {
      const push = normalize(player.x - cone.origin.x, player.y - cone.origin.y);
      hit(BUZZARD.gustDamage, push.x === 0 && push.y === 0 ? cone.direction : push, BUZZARD.gustKnockback);
    }
    this.gust = undefined;
    this.startCircling();
  }

  defeat(): void {
    this.defeated = true; this.lane = undefined; this.gust = undefined; this.volleyAim = undefined; this.volley = undefined;
    this.diveStep = { x: 0, y: 0 };
  }
}

/** Whether a body of this reach sweeps over the player while moving from a to b. */
function segmentHits(a: Vector2Like, b: Vector2Like, player: Vector2Like, reach: number): boolean {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((player.x - a.x) * dx + (player.y - a.y) * dy) / len2)) : 0;
  return distanceSq({ x: a.x + dx * t, y: a.y + dy * t }, player) <= reach * reach;
}

/** Whether a body of this radius overlaps a cone. */
export function inCone(cone: GustCone, point: Vector2Like, radius: number): boolean {
  const dx = point.x - cone.origin.x, dy = point.y - cone.origin.y, d = Math.hypot(dx, dy);
  if (d > cone.range + radius) return false;
  if (d <= radius) return true;
  const cos = (dx * cone.direction.x + dy * cone.direction.y) / d;
  return Math.acos(Math.max(-1, Math.min(1, cos))) <= cone.halfAngle + Math.asin(Math.min(1, radius / d));
}
