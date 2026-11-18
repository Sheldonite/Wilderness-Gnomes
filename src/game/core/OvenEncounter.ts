import { OVEN } from '../config/ovenBoss';
import { BOSS_ENGAGE_DISTANCE } from './BossPursuit';
import type { Vector2Like } from './types';
import { distanceSq } from '../utils/math';

/** `wave` 1 is the delayed outer collapsing ring; it starts with negative age so it lands later. */
export interface FlyingTaco {
  start: Vector2Like;
  target: Vector2Like;
  age: number;
  wave: number;
}

export interface BurningSalsa extends Vector2Like {
  age: number;
  life: number;
}

export interface FlameCone {
  origin: Vector2Like;
  direction: Vector2Like;
  range: number;
  halfAngle: number;
  startAngle: number;
  sweepAngle: number;
  progress: number;
}

export interface SlamLeap {
  start: Vector2Like;
  target: Vector2Like;
  age: number;
  radius: number;
}

export interface MagmaShockwave {
  origin: Vector2Like;
  radius: number;
  maxRadius: number;
  hit: boolean;
}

export type OvenPhase = 'arrival' | 'walking' | 'windup' | 'throwing' | 'slamming' | 'blasting' | 'overheated';
export type OvenAttack = 'toss' | 'ring' | 'slam' | 'cone';
const ROTATION: OvenAttack[] = ['toss', 'ring', 'slam', 'cone'];

/**
 * One encounter per run. Advance exclusively on the gameplay clock.
 * The Oven cycles through a predictive leading taco toss, a center-trap double ring, a Toaster
 * Leap Slam with an expanding magma shockwave, and a sweeping flame cone out of its door, opening
 * an `'overheated'` vulnerability window after its heavy finishers. Below half health ("OVERCOOKED!")
 * it moves faster, cuts cooldowns, throws wider/denser patterns, burns hotter with salsa, and chains
 * Toaster Slam straight into Flame Sweep before overheating.
 */
export class OvenEncounter {
  defeated = false;
  phase: OvenPhase = 'arrival';
  tacos: FlyingTaco[] = [];
  impacts: Vector2Like[] = [];
  salsa: BurningSalsa[] = [];
  attack: OvenAttack = 'toss';
  /** The sweeping flame cone being aimed or breathed, if any. */
  cone?: FlameCone;
  /** True on the frame the flame cone erupts. */
  coneFired = false;
  /** Locked landing zone for Toaster Leap Slam (present during slam windup and flight). */
  slam?: SlamLeap;
  /** Impact coordinate on the frame the Toaster Leap Slam lands. */
  slamLanded?: Vector2Like;
  /** Expanding magma shockwaves radiating from slam landings. */
  shockwaves: MagmaShockwave[] = [];
  /** Line cooks owed to the fight; the system spawns them and resets this. */
  pendingAdds = 0;
  /** Smoothed and clamped player velocity in px/s, used for leading attacks. */
  playerVelocity: Vector2Like = { x: 0, y: 0 };
  /** True during the brief post-slam stutter before chaining into Flame Sweep in Phase 2. */
  chainingCone = false;

  private volleys = 0;
  private salsaExposureMs = 0;
  private timer: number = OVEN.introductionMs;
  private pending: { target: Vector2Like; wave: number }[] = [];
  private readonly hitWaves = new Set<number>();
  private addWaves = 0;
  private healthFraction = 1;
  private lastPlayer?: Vector2Like;
  private coneElapsedMs = 0;
  private coneHitCooldownMs = 0;
  private coneSweepSign = 1;

  get hot(): boolean {
    return this.healthFraction <= OVEN.hotFraction;
  }

  /** Exposed open-door overheat window: the Oven takes extra damage. */
  get vulnerable(): boolean {
    return this.phase === 'overheated';
  }

  get timerRemaining(): number {
    return Math.max(0, this.timer);
  }

  /** Current interpolated ground coordinates while leaping in `'slamming'`. */
  get slamPosition(): Vector2Like | undefined {
    if (this.phase !== 'slamming' || !this.slam) return undefined;
    const t = Math.min(1, Math.max(0, this.slam.age / OVEN.slamFlightMs));
    return {
      x: this.slam.start.x + (this.slam.target.x - this.slam.start.x) * t,
      y: this.slam.start.y + (this.slam.target.y - this.slam.start.y) * t
    };
  }

  /** Normalized vertical leap arc `[0..1..0]` during `'slamming'`. */
  get slamArc(): number {
    if (this.phase !== 'slamming' || !this.slam) return 0;
    const t = Math.min(1, Math.max(0, this.slam.age / OVEN.slamFlightMs));
    return Math.sin(t * Math.PI);
  }

  update(
    deltaMs: number,
    boss: Vector2Like,
    player: Vector2Like,
    playerRadius: number,
    healthFraction: number,
    hit: (damage: number) => void
  ): void {
    this.impacts = [];
    this.coneFired = false;
    this.slamLanded = undefined;
    if (this.defeated) return;

    this.healthFraction = healthFraction;
    this.trackPlayer(deltaMs, player);

    while (this.addWaves < OVEN.addThresholds.length && healthFraction <= OVEN.addThresholds[this.addWaves]) {
      this.addWaves++;
      this.pendingAdds += OVEN.addsPerWave;
    }

    if (deltaMs <= 0) return;

    // One shared burn timer prevents overlapping salsa patches from multiplying damage.
    this.salsa.forEach(p => { p.age += deltaMs; });
    this.salsa = this.salsa.filter(p => p.age < p.life);
    if (this.salsa.some(p => distanceSq(player, p) <= (OVEN.salsaRadius + playerRadius) ** 2)) {
      this.salsaExposureMs += deltaMs;
      while (this.salsaExposureMs >= OVEN.salsaTickMs) {
        this.salsaExposureMs -= OVEN.salsaTickMs;
        hit(this.hot ? OVEN.hotSalsaDamage : OVEN.salsaDamage);
      }
    } else {
      this.salsaExposureMs = 0;
    }

    this.updateShockwaves(deltaMs, player, playerRadius, hit);

    for (const taco of this.tacos) {
      taco.age += deltaMs;
      if (taco.age < OVEN.flightMs) continue;
      this.impacts.push(taco.target);
      this.salsa.push({ ...taco.target, age: 0, life: this.hot ? OVEN.hotSalsaLifeMs : OVEN.salsaLifeMs });
      // Each wave can hurt once, however many of its tacos overlap the player.
      if (!this.hitWaves.has(taco.wave) && distanceSq(player, taco.target) <= (OVEN.blastRadius + playerRadius) ** 2) {
        this.hitWaves.add(taco.wave);
        hit(OVEN.damage);
      }
    }
    this.tacos = this.tacos.filter(t => t.age < OVEN.flightMs);
    this.capSalsa();

    if (this.phase === 'slamming' && this.slam) {
      this.slam.age = Math.min(OVEN.slamFlightMs, this.slam.age + deltaMs);
    }

    if (this.phase === 'blasting' && this.cone) {
      const activeMs = Math.min(deltaMs, Math.max(0, this.timer));
      const steps = Math.max(1, Math.ceil(activeMs / 40));
      const stepMs = activeMs / steps;
      for (let i = 0; i < steps; i++) {
        this.coneElapsedMs = Math.min(OVEN.coneMs, this.coneElapsedMs + stepMs);
        this.coneHitCooldownMs = Math.max(0, this.coneHitCooldownMs - stepMs);
        const progress = Math.min(1, this.coneElapsedMs / OVEN.coneMs);
        const angle = this.cone.startAngle + this.cone.sweepAngle * progress;
        this.cone.progress = progress;
        this.cone.direction = { x: Math.cos(angle), y: Math.sin(angle) };
        if (this.coneHitCooldownMs <= 0 && this.inCone(player, playerRadius)) {
          hit(OVEN.coneDamage);
          this.coneHitCooldownMs = OVEN.coneHitCooldownMs;
        }
      }
    }

    this.timer -= deltaMs;
    if (this.timer > 0) return;

    if (this.phase === 'arrival') {
      this.phase = 'walking';
      this.timer = OVEN.arrivalWalkMs;
    } else if (this.phase === 'walking') {
      if (distanceSq(boss, player) <= BOSS_ENGAGE_DISTANCE ** 2) this.beginWindup(boss, player);
    } else if (this.phase === 'windup') {
      if (this.attack === 'cone') {
        this.phase = 'blasting';
        this.timer = OVEN.coneMs;
        this.coneFired = true;
        this.coneElapsedMs = 0;
        this.coneHitCooldownMs = 0;
        if (this.inCone(player, playerRadius)) {
          hit(OVEN.coneDamage);
          this.coneHitCooldownMs = OVEN.coneHitCooldownMs;
        }
      } else if (this.attack === 'slam') {
        this.phase = 'slamming';
        this.timer = OVEN.slamFlightMs;
        const target = this.slam?.target ?? player;
        this.slam = { start: { ...boss }, target: { ...target }, age: 0, radius: OVEN.slamRadius };
      } else {
        this.phase = 'throwing';
        this.hitWaves.clear();
        this.tacos = this.pending.slice(0, OVEN.maxTacos).map(p => ({
          start: { ...boss },
          target: p.target,
          age: p.wave ? -OVEN.secondRingDelayMs : 0,
          wave: p.wave
        }));
        this.timer = OVEN.flightMs + (this.pending.some(p => p.wave) ? OVEN.secondRingDelayMs : 0);
        this.pending = [];
      }
    } else if (this.phase === 'slamming') {
      this.landSlam(player, playerRadius, hit);
    } else if (this.phase === 'blasting') {
      this.cone = undefined;
      this.phase = 'overheated';
      this.timer = this.hot ? OVEN.hotOverheatMs : OVEN.overheatMs;
    } else {
      // Both `'throwing'` and `'overheated'` transition to `'walking'`.
      this.phase = 'walking';
      this.cone = undefined;
      this.timer = this.hot ? OVEN.hotCooldownMs : OVEN.cooldownMs;
    }
  }

  private trackPlayer(deltaMs: number, player: Vector2Like): void {
    if (this.lastPlayer && deltaMs > 0) {
      const dt = deltaMs / 1000;
      const dx = player.x - this.lastPlayer.x;
      const dy = player.y - this.lastPlayer.y;
      const dist = Math.hypot(dx, dy);
      const rawSpeed = dist / dt;
      // Big teleports reset velocity instead of creating phantom leading spikes.
      if (dist > 120 && rawSpeed > 900) {
        this.playerVelocity = { x: 0, y: 0 };
      } else {
        const cap = OVEN.maxTrackSpeed;
        const scale = rawSpeed > cap && rawSpeed > 0 ? cap / rawSpeed : 1;
        const vx = (dx / dt) * scale;
        const vy = (dy / dt) * scale;
        const k = Math.min(1, deltaMs / 80);
        this.playerVelocity = {
          x: this.playerVelocity.x + (vx - this.playerVelocity.x) * k,
          y: this.playerVelocity.y + (vy - this.playerVelocity.y) * k
        };
      }
    }
    this.lastPlayer = { ...player };
  }

  private updateShockwaves(deltaMs: number, player: Vector2Like, playerRadius: number, hit: (damage: number) => void): void {
    for (const wave of this.shockwaves) {
      const before = wave.radius;
      wave.radius += OVEN.shockwaveSpeed * deltaMs / 1000;
      if (wave.hit) continue;
      const d = Math.hypot(player.x - wave.origin.x, player.y - wave.origin.y);
      const band = OVEN.shockwaveWidth / 2 + playerRadius;
      const upper = Math.min(wave.maxRadius, wave.radius) + band;
      const lower = before - band;
      if (d <= upper && d >= lower) {
        wave.hit = true;
        hit(OVEN.shockwaveDamage);
      }
    }
    this.shockwaves = this.shockwaves.filter(wave => wave.radius < wave.maxRadius);
  }

  private landSlam(player: Vector2Like, playerRadius: number, hit: (damage: number) => void): void {
    const slam = this.slam!;
    const target = slam.target;
    this.slamLanded = { ...target };

    if (distanceSq(player, target) <= (OVEN.slamRadius + playerRadius) ** 2) {
      hit(OVEN.slamDamage);
    }

    const baseAngle = Math.atan2(target.y - slam.start.y, target.x - slam.start.x) + Math.PI / 4;
    const life = this.hot ? OVEN.hotSalsaLifeMs : OVEN.salsaLifeMs;
    for (let i = 0; i < OVEN.slamEmberCount; i++) {
      const a = baseAngle + i * (Math.PI * 2 / OVEN.slamEmberCount);
      const ember = { x: target.x + Math.cos(a) * OVEN.slamEmberRadius, y: target.y + Math.sin(a) * OVEN.slamEmberRadius };
      this.salsa.push({ ...ember, age: 0, life });
    }
    this.capSalsa();

    this.shockwaves.push({
      origin: { ...target },
      radius: 0,
      maxRadius: OVEN.shockwaveMaxRadius,
      hit: false
    });
    this.slam = undefined;

    if (this.hot) {
      // Below 50% HP, Toaster Slam chains straight into Flame Sweep after a brief stutter.
      this.phase = 'walking';
      this.timer = OVEN.hotChainDelayMs;
      this.chainingCone = true;
    } else {
      this.phase = 'overheated';
      this.timer = OVEN.overheatMs;
    }
  }

  private capSalsa(): void {
    if (this.salsa.length > OVEN.maxSalsa) {
      this.salsa.splice(0, this.salsa.length - OVEN.maxSalsa);
    }
  }

  private beginWindup(boss: Vector2Like, player: Vector2Like): void {
    this.phase = 'windup';
    if (this.chainingCone) {
      this.chainingCone = false;
      this.attack = 'cone';
      if (ROTATION[this.volleys % ROTATION.length] === 'cone') this.volleys++;
    } else {
      this.attack = ROTATION[this.volleys++ % ROTATION.length];
    }

    if (this.attack === 'cone') {
      const dx = player.x - boss.x;
      const dy = player.y - boss.y;
      const playerAngle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx);
      const cross = dx * this.playerVelocity.y - dy * this.playerVelocity.x;
      const sweepSign = Math.abs(cross) > 600 ? (cross >= 0 ? 1 : -1) : this.coneSweepSign;
      this.coneSweepSign = -sweepSign;
      const startAngle = playerAngle - sweepSign * (OVEN.coneSweepAngle / 2);
      this.cone = {
        origin: { ...boss },
        direction: { x: Math.cos(startAngle), y: Math.sin(startAngle) },
        range: OVEN.coneRange,
        halfAngle: OVEN.coneHalfAngle,
        startAngle,
        sweepAngle: sweepSign * OVEN.coneSweepAngle,
        progress: 0
      };
      this.timer = OVEN.coneWindupMs;
      this.pending = [];
      return;
    }

    if (this.attack === 'slam') {
      const speed = Math.hypot(this.playerVelocity.x, this.playerVelocity.y);
      const leadSec = speed > 10 ? OVEN.slamLeadMs / 1000 : 0;
      const target = {
        x: player.x + this.playerVelocity.x * leadSec,
        y: player.y + this.playerVelocity.y * leadSec
      };
      this.slam = {
        start: { ...boss },
        target,
        age: 0,
        radius: OVEN.slamRadius
      };
      this.timer = this.hot ? OVEN.hotSlamWindupMs : OVEN.slamWindupMs;
      this.pending = [];
      return;
    }

    this.timer = OVEN.windupMs;
    if (this.attack === 'ring') {
      const angle = Math.atan2(player.y - boss.y, player.x - boss.x) + Math.PI / 2;
      const innerCount = this.hot ? OVEN.hotInnerRingTacos : OVEN.innerRingTacos;
      const outerCount = this.hot ? OVEN.hotOuterRingTacos : OVEN.outerRingTacos;
      const innerStep = Math.PI * 2 / innerCount;
      const outerStep = Math.PI * 2 / outerCount;
      const atRing = (a: number, r: number) => ({ x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r });

      this.pending = [
        { target: { ...player }, wave: 0 },
        ...Array.from({ length: innerCount }, (_, i) => ({ target: atRing(angle + i * innerStep, OVEN.innerRingRadius), wave: 0 })),
        ...Array.from({ length: outerCount }, (_, i) => ({ target: atRing(angle + (i + 0.5) * outerStep, OVEN.outerRingRadius), wave: 1 }))
      ];
      return;
    }

    // Predictive leading taco toss: leads straight-line kiting, aims directly at stationary players.
    const speed = Math.hypot(this.playerVelocity.x, this.playerVelocity.y);
    const leadSec = speed > 10 ? Math.min(OVEN.tossLeadMaxMs, OVEN.windupMs + OVEN.flightMs) / 1000 : 0;
    const predicted = {
      x: player.x + this.playerVelocity.x * leadSec,
      y: player.y + this.playerVelocity.y * leadSec
    };
    const fanAngle = Math.atan2(predicted.y - boss.y, predicted.x - boss.x) + Math.PI / 2;
    const count = this.hot ? OVEN.hotTossTacos : OVEN.tossTacos;
    const half = (count - 1) / 2;
    this.pending = Array.from({ length: count }, (_, i) => {
      const offset = i - half;
      return {
        target: {
          x: predicted.x + Math.cos(fanAngle) * offset * OVEN.spread,
          y: predicted.y + Math.sin(fanAngle) * offset * OVEN.spread
        },
        wave: 0
      };
    });
  }

  /** Whether a body of this radius overlaps the current flame cone wedge. */
  inCone(point: Vector2Like, radius: number): boolean {
    const cone = this.cone;
    if (!cone) return false;
    const dx = point.x - cone.origin.x;
    const dy = point.y - cone.origin.y;
    const d = Math.hypot(dx, dy);
    if (d > cone.range + radius) return false;
    if (d <= radius) return true;
    const cos = (dx * cone.direction.x + dy * cone.direction.y) / d;
    return Math.acos(Math.max(-1, Math.min(1, cos))) <= cone.halfAngle + Math.asin(Math.min(1, radius / d));
  }

  get warnings(): Vector2Like[] {
    return this.phase === 'windup' ? this.pending.map(p => p.target) : this.tacos.map(t => t.target);
  }

  defeat(): void {
    this.defeated = true;
    this.tacos = [];
    this.pending = [];
    this.impacts = [];
    this.salsa = [];
    this.salsaExposureMs = 0;
    this.cone = undefined;
    this.coneFired = false;
    this.slam = undefined;
    this.slamLanded = undefined;
    this.shockwaves = [];
    this.pendingAdds = 0;
    this.chainingCone = false;
    this.lastPlayer = undefined;
    this.playerVelocity = { x: 0, y: 0 };
  }
}
