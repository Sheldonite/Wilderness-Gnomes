import { OVEN } from '../config/ovenBoss';
import type { Vector2Like } from './types';
import { clampToArena, distanceSq } from '../utils/math';

export interface FlyingTaco { start: Vector2Like; target: Vector2Like; age: number }
export interface BurningSalsa extends Vector2Like { age: number }

/** One encounter per run. Advance exclusively on the gameplay clock. */
export class OvenEncounter {
  spawned = false;
  defeated = false;
  phase: 'arrival' | 'walking' | 'windup' | 'throwing' = 'arrival';
  tacos: FlyingTaco[] = [];
  impacts: Vector2Like[] = [];
  salsa: BurningSalsa[] = [];
  attack: 'toss' | 'ring' = 'toss';
  private volleys = 0;
  private salsaExposureMs = 0;
  private timer: number = OVEN.introductionMs;
  private pending: Vector2Like[] = [];
  private volleyHit = false;

  shouldSpawn(level: number): boolean {
    if (this.spawned || level < OVEN.level) return false;
    this.spawned = true; return true;
  }

  update(deltaMs: number, boss: Vector2Like, player: Vector2Like, playerRadius: number, healthFraction: number, hit: (damage: number) => void): void {
    this.impacts = [];
    if (!this.spawned || this.defeated) return;
    // One shared burn timer prevents overlapping patches from multiplying damage.
    this.salsa.forEach(p => { p.age += deltaMs; });
    this.salsa = this.salsa.filter(p => p.age < OVEN.salsaLifeMs);
    if (this.salsa.some(p => distanceSq(player, p) <= (OVEN.salsaRadius + playerRadius) ** 2)) {
      this.salsaExposureMs += deltaMs;
      if (this.salsaExposureMs >= OVEN.salsaTickMs) {
        this.salsaExposureMs %= OVEN.salsaTickMs;
        hit(OVEN.salsaDamage);
      }
    } else this.salsaExposureMs = 0;
    for (const taco of this.tacos) {
      taco.age += deltaMs;
      if (taco.age < OVEN.flightMs) continue;
      this.impacts.push(taco.target);
      this.salsa.push({ ...taco.target, age: 0 });
      if (!this.volleyHit && distanceSq(player, taco.target) <= (OVEN.blastRadius + playerRadius) ** 2) {
        this.volleyHit = true; hit(OVEN.damage);
      }
    }
    this.tacos = this.tacos.filter(t => t.age < OVEN.flightMs);
    this.timer -= deltaMs;
    if (this.timer > 0) return;
    if (this.phase === 'arrival') { this.phase = 'walking'; this.timer = 1000; }
    else if (this.phase === 'walking') {
      this.phase = 'windup'; this.timer = OVEN.windupMs;
      this.attack = this.volleys++ % 2 === 0 ? 'toss' : 'ring';
      const angle = Math.atan2(player.y - boss.y, player.x - boss.x) + Math.PI / 2;
      this.pending = this.attack === 'ring'
        ? Array.from({ length: OVEN.maxTacos }, (_, i) => {
          const a = angle + i * Math.PI * 2 / OVEN.maxTacos;
          return clampToArena({ x: player.x + Math.cos(a) * OVEN.ringRadius, y: player.y + Math.sin(a) * OVEN.ringRadius }, OVEN.blastRadius);
        })
        : [-1, 0, 1].map(offset => clampToArena({ x: player.x + Math.cos(angle) * offset * OVEN.spread, y: player.y + Math.sin(angle) * offset * OVEN.spread }, OVEN.blastRadius));
    } else if (this.phase === 'windup') {
      this.phase = 'throwing'; this.timer = OVEN.flightMs; this.volleyHit = false;
      this.tacos = this.pending.map(target => ({ start: { ...boss }, target, age: 0 })); this.pending = [];
    } else { this.phase = 'walking'; this.timer = healthFraction <= .5 ? OVEN.hotCooldownMs : OVEN.cooldownMs; }
  }

  get warnings(): Vector2Like[] { return this.phase === 'windup' ? this.pending : this.tacos.map(t => t.target); }
  defeat(): void { this.defeated = true; this.tacos = []; this.pending = []; this.impacts = []; this.salsa = []; this.salsaExposureMs = 0; }
}
