import { OVEN } from '../config/ovenBoss';
import type { Vector2Like } from './types';
import { clampToArena, distanceSq, normalize } from '../utils/math';

/** `wave` 1 is the delayed second ring; it starts with negative age so it lands later. */
export interface FlyingTaco { start: Vector2Like; target: Vector2Like; age: number; wave: number }
export interface BurningSalsa extends Vector2Like { age: number; life: number }
export interface FlameCone { origin: Vector2Like; direction: Vector2Like; range: number; halfAngle: number }
export type OvenAttack = 'toss' | 'ring' | 'cone';
const ROTATION: OvenAttack[] = ['toss', 'ring', 'cone'];

/**
 * One encounter per run. Advance exclusively on the gameplay clock.
 * The Oven rotates a three-taco toss, a ring of tacos around the player, and a flame cone out of
 * its door. Below half health it runs hot: two staggered rings, longer and fiercer salsa, and
 * shorter breaks. Line cooks are summoned as it passes each health threshold.
 */
export class OvenEncounter {
  spawned = false;
  defeated = false;
  phase: 'arrival' | 'walking' | 'windup' | 'throwing' | 'blasting' = 'arrival';
  tacos: FlyingTaco[] = [];
  impacts: Vector2Like[] = [];
  salsa: BurningSalsa[] = [];
  attack: OvenAttack = 'toss';
  /** The flame cone being aimed or breathed, if any. Locked when the windup starts. */
  cone?: FlameCone;
  /** True on the frame the cone erupts. */
  coneFired = false;
  /** Line cooks owed to the fight; the system spawns them and resets this. */
  pendingAdds = 0;
  private volleys = 0;
  private salsaExposureMs = 0;
  private timer: number = OVEN.introductionMs;
  private pending: { target: Vector2Like; wave: number }[] = [];
  private readonly hitWaves = new Set<number>();
  private addWaves = 0;
  private healthFraction = 1;

  shouldSpawn(level: number): boolean {
    if (this.spawned || level < OVEN.level) return false;
    this.spawned = true; return true;
  }

  get hot(): boolean { return this.healthFraction <= OVEN.hotFraction; }

  update(deltaMs: number, boss: Vector2Like, player: Vector2Like, playerRadius: number, healthFraction: number, hit: (damage: number) => void): void {
    this.impacts = [];
    this.coneFired = false;
    if (!this.spawned || this.defeated) return;
    this.healthFraction = healthFraction;
    while (this.addWaves < OVEN.addThresholds.length && healthFraction <= OVEN.addThresholds[this.addWaves]) {
      this.addWaves++; this.pendingAdds += OVEN.addsPerWave;
    }
    // One shared burn timer prevents overlapping patches from multiplying damage.
    this.salsa.forEach(p => { p.age += deltaMs; });
    this.salsa = this.salsa.filter(p => p.age < p.life);
    if (this.salsa.some(p => distanceSq(player, p) <= (OVEN.salsaRadius + playerRadius) ** 2)) {
      this.salsaExposureMs += deltaMs;
      if (this.salsaExposureMs >= OVEN.salsaTickMs) {
        this.salsaExposureMs %= OVEN.salsaTickMs;
        hit(this.hot ? OVEN.hotSalsaDamage : OVEN.salsaDamage);
      }
    } else this.salsaExposureMs = 0;
    for (const taco of this.tacos) {
      taco.age += deltaMs;
      if (taco.age < OVEN.flightMs) continue;
      this.impacts.push(taco.target);
      this.salsa.push({ ...taco.target, age: 0, life: this.hot ? OVEN.hotSalsaLifeMs : OVEN.salsaLifeMs });
      // Each ring can hurt once, however many of its tacos overlap the player.
      if (!this.hitWaves.has(taco.wave) && distanceSq(player, taco.target) <= (OVEN.blastRadius + playerRadius) ** 2) {
        this.hitWaves.add(taco.wave); hit(OVEN.damage);
      }
    }
    this.tacos = this.tacos.filter(t => t.age < OVEN.flightMs);
    if (this.salsa.length > OVEN.maxSalsa) this.salsa.splice(0, this.salsa.length - OVEN.maxSalsa);
    this.timer -= deltaMs;
    if (this.timer > 0) return;
    if (this.phase === 'arrival') { this.phase = 'walking'; this.timer = 1000; }
    else if (this.phase === 'walking') this.beginWindup(boss, player);
    else if (this.phase === 'windup') {
      if (this.attack === 'cone') {
        this.phase = 'blasting'; this.timer = OVEN.coneMs; this.coneFired = true;
        if (this.inCone(player, playerRadius)) hit(OVEN.coneDamage);
      } else {
        this.phase = 'throwing'; this.hitWaves.clear();
        this.tacos = this.pending.map(p => ({ start: { ...boss }, target: p.target, age: p.wave ? -OVEN.secondRingDelayMs : 0, wave: p.wave }));
        this.timer = OVEN.flightMs + (this.pending.some(p => p.wave) ? OVEN.secondRingDelayMs : 0);
        this.pending = [];
      }
    } else {
      this.phase = 'walking'; this.cone = undefined;
      this.timer = this.hot ? OVEN.hotCooldownMs : OVEN.cooldownMs;
    }
  }

  private beginWindup(boss: Vector2Like, player: Vector2Like): void {
    this.phase = 'windup';
    this.attack = ROTATION[this.volleys++ % ROTATION.length];
    if (this.attack === 'cone') {
      const aim = normalize(player.x - boss.x, player.y - boss.y);
      this.cone = { origin: { ...boss }, direction: aim.x === 0 && aim.y === 0 ? { x: 1, y: 0 } : aim, range: OVEN.coneRange, halfAngle: OVEN.coneHalfAngle };
      this.timer = OVEN.coneWindupMs; this.pending = [];
      return;
    }
    this.timer = OVEN.windupMs;
    const angle = Math.atan2(player.y - boss.y, player.x - boss.x) + Math.PI / 2;
    const around = (a: number) => clampToArena({ x: player.x + Math.cos(a) * OVEN.ringRadius, y: player.y + Math.sin(a) * OVEN.ringRadius }, OVEN.blastRadius);
    if (this.attack === 'ring') {
      const count = this.hot ? OVEN.hotRingTacos : OVEN.ringTacos, step = Math.PI * 2 / count;
      this.pending = Array.from({ length: count }, (_, i) => ({ target: around(angle + i * step), wave: 0 }));
      // Running hot, a second ring fills the gaps a moment later: step into a gap, then step again.
      if (this.hot) this.pending.push(...Array.from({ length: count }, (_, i) => ({ target: around(angle + (i + .5) * step), wave: 1 })));
    } else {
      this.pending = [-1, 0, 1].map(offset => ({ target: clampToArena({ x: player.x + Math.cos(angle) * offset * OVEN.spread, y: player.y + Math.sin(angle) * offset * OVEN.spread }, OVEN.blastRadius), wave: 0 }));
    }
  }

  /** Whether a body of this radius overlaps the locked cone. */
  inCone(point: Vector2Like, radius: number): boolean {
    const cone = this.cone;
    if (!cone) return false;
    const dx = point.x - cone.origin.x, dy = point.y - cone.origin.y, d = Math.hypot(dx, dy);
    if (d > cone.range + radius) return false;
    if (d <= radius) return true;
    const cos = (dx * cone.direction.x + dy * cone.direction.y) / d;
    return Math.acos(Math.max(-1, Math.min(1, cos))) <= cone.halfAngle + Math.asin(Math.min(1, radius / d));
  }

  get warnings(): Vector2Like[] { return this.phase === 'windup' ? this.pending.map(p => p.target) : this.tacos.map(t => t.target); }
  defeat(): void {
    this.defeated = true; this.tacos = []; this.pending = []; this.impacts = []; this.salsa = [];
    this.salsaExposureMs = 0; this.cone = undefined; this.pendingAdds = 0;
  }
}
