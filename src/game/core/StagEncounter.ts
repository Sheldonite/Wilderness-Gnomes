import { STAG } from '../config/stagBoss';
import type { Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

export type StagPhase = 'arrival' | 'stalking' | 'windup' | 'charging' | 'recovering' | 'stunned' | 'sweepWindup'
  | 'volleyWindup' | 'bellowWindup';
export type StagAttack = 'charge' | 'volley' | 'bellow';
/** `feinted` once the lane has swung to a new aim partway through the windup. */
export interface ChargeLane { from: Vector2Like; direction: Vector2Like; length: number; feinted?: boolean }
export interface AntlerSweep { origin: Vector2Like; direction: Vector2Like; range: number; }
export interface ShardVolley { origin: Vector2Like; directions: Vector2Like[] }
/** A blow the stag lands: damage, the direction the player is thrown, and how far (default: the charge's). */
export type StagHit = (damage: number, push: Vector2Like, knockback?: number) => void;

/**
 * One encounter per run, advanced only on the gameplay clock.
 * Each time he finishes stalking he runs the next attack in `STAG.attackOrder`:
 * - Charge: paws the ground while aiming a lane (locked at windup), then charges down it. Landing
 *   the charge throws the player back; where it ends, his stomp shakes anything close. Baited into
 *   a tree he is stunned and takes extra damage.
 * - Velvet volley: shakes his head and flings a fan of antler shards along a locked aim.
 * - Bellow: rears and roars. A player within reach is slowed, and he charges straight after.
 * Crowd him and he sweeps his antlers. Below half health he is enraged: shorter windups, two
 * charges in a row (the second leads the player), and every other charge is a feint whose lane
 * swings partway through. Below the rut fraction he is in a frenzy: triple charges, quicker
 * everything, shorter stuns and a wider volley. He calls the herd at each stampede threshold.
 */
export class StagEncounter {
  spawned = false;
  defeated = false;
  phase: StagPhase = 'arrival';
  lane?: ChargeLane;
  /** The antler sweep being wound up, if any. */
  sweep?: AntlerSweep;
  /** True on the frame the sweep lands, for effects. */
  swept = false;
  /** Where the volley is aimed while he shakes his head (locked when it starts). */
  volleyAim?: Vector2Like;
  /** Shards released this frame; the system launches them. */
  volley?: ShardVolley;
  /** True on the frame he roars, and whether the player was close enough to be shaken. */
  bellowed = false;
  bellowHit = false;
  /** Offset the boss must move this frame while charging; the entity applies it. */
  chargeStep: Vector2Like = { x: 0, y: 0 };
  /** Where a stomp landed this frame, if any. */
  impacts: Vector2Like[] = [];
  /** Herd stampedes owed to the fight; the system launches them and resets this. */
  pendingStampedes = 0;
  private timer: number = STAG.introductionMs;
  private travelled = 0;
  private hitThisCharge = false;
  private chargesLeft = 0;
  private closeMs = 0;
  private stampedeWaves = 0;
  private attackIndex = 0;
  /** Enraged charges alternate honest and feinted, starting honest. */
  private feintNext = false;
  /** While a feinted windup runs, the timer value at which the lane swings. */
  private feintAt?: number;
  private lastPlayer?: Vector2Like;
  /** Smoothed player velocity in pixels per second, for leading enraged charges. */
  playerVelocity: Vector2Like = { x: 0, y: 0 };

  shouldSpawn(level: number): boolean {
    if (this.spawned || level < STAG.level) return false;
    this.spawned = true; return true;
  }

  get enraged(): boolean { return this.healthFraction <= STAG.enrageFraction; }
  /** The final frenzy. */
  get rut(): boolean { return this.healthFraction <= STAG.rutFraction; }
  /** Stunned against a tree: the damage window. */
  get vulnerable(): boolean { return this.phase === 'stunned'; }
  /** The attack he will use next time he finishes stalking. */
  get nextAttack(): StagAttack { return STAG.attackOrder[this.attackIndex % STAG.attackOrder.length]; }
  private healthFraction = 1;

  update(deltaMs: number, boss: Vector2Like, player: Vector2Like, playerRadius: number, healthFraction: number, hit: StagHit): void {
    this.impacts = [];
    this.chargeStep = { x: 0, y: 0 };
    this.swept = false;
    this.volley = undefined;
    this.bellowed = false;
    this.bellowHit = false;
    if (!this.spawned || this.defeated) return;
    this.healthFraction = healthFraction;
    this.trackPlayer(deltaMs, player);
    while (this.stampedeWaves < STAG.stampedeThresholds.length && healthFraction <= STAG.stampedeThresholds[this.stampedeWaves]) {
      this.stampedeWaves++; this.pendingStampedes++;
    }
    if (this.phase === 'charging') {
      const speed = STAG.chargeSpeed * (this.rut ? STAG.rutChargeSpeed : 1);
      const step = Math.min(speed * deltaMs / 1000, STAG.chargeDistance - this.travelled);
      this.chargeStep = { x: this.lane!.direction.x * step, y: this.lane!.direction.y * step };
      this.travelled += step;
      const after = { x: boss.x + this.chargeStep.x, y: boss.y + this.chargeStep.y };
      if (!this.hitThisCharge && this.segmentHits(boss, after, player, playerRadius)) {
        this.hitThisCharge = true;
        hit(STAG.chargeDamage, this.lane!.direction);
      }
      if (this.travelled >= STAG.chargeDistance - 1e-6) this.endCharge(after, player, playerRadius, hit);
      return;
    }
    // Hugging him to dodge charges earns an antler sweep.
    if ((this.phase === 'stalking' || this.phase === 'recovering') &&
      distanceSq(boss, player) <= (STAG.sweepTriggerRange + playerRadius) ** 2) {
      this.closeMs += deltaMs;
      if (this.closeMs >= STAG.sweepHoldMs) { this.beginSweep(boss, player); return; }
    } else if (this.phase !== 'sweepWindup') this.closeMs = 0;
    this.timer -= deltaMs;
    if (this.phase === 'windup' && this.feintAt !== undefined && this.timer <= this.feintAt) {
      // The feint: the lane swings to where the player is now, with a full windup still to come.
      this.feintAt = undefined;
      this.lane = { ...this.aimLane(boss, player), feinted: true };
    }
    if (this.timer > 0) return;
    if (this.phase === 'arrival') { this.phase = 'stalking'; this.timer = 900; }
    else if (this.phase === 'stalking') this.beginAttack(boss, player);
    else if (this.phase === 'windup') {
      this.phase = 'charging'; this.travelled = 0; this.hitThisCharge = false;
    } else if (this.phase === 'recovering') {
      if (this.chargesLeft > 0) this.beginWindup(boss, player);
      else this.rest();
    } else if (this.phase === 'stunned') this.rest();
    else if (this.phase === 'sweepWindup') this.resolveSweep(player, playerRadius, hit);
    else if (this.phase === 'volleyWindup') this.releaseVolley(boss);
    else if (this.phase === 'bellowWindup') {
      this.bellowed = true;
      this.bellowHit = distanceSq(boss, player) <= (STAG.bellowRadius + playerRadius) ** 2;
      this.beginWindup(boss, player);   // roar, then charge while they are still shaken
    }
  }

  private rest(ms: number = this.enraged ? STAG.enragedCooldownMs : STAG.cooldownMs): void { this.phase = 'stalking'; this.timer = ms; }

  private trackPlayer(deltaMs: number, player: Vector2Like): void {
    if (this.lastPlayer && deltaMs > 0) {
      const vx = (player.x - this.lastPlayer.x) / (deltaMs / 1000), vy = (player.y - this.lastPlayer.y) / (deltaMs / 1000);
      const k = Math.min(1, deltaMs / 80);
      this.playerVelocity = { x: this.playerVelocity.x + (vx - this.playerVelocity.x) * k, y: this.playerVelocity.y + (vy - this.playerVelocity.y) * k };
    }
    this.lastPlayer = { ...player };
  }

  private beginAttack(boss: Vector2Like, player: Vector2Like): void {
    const attack = this.nextAttack;
    this.attackIndex++;
    if (attack === 'charge') { this.beginWindup(boss, player); return; }
    const aim = normalize(player.x - boss.x, player.y - boss.y);
    if (attack === 'volley') {
      this.phase = 'volleyWindup'; this.timer = STAG.volleyWindupMs;
      this.volleyAim = aim.x === 0 && aim.y === 0 ? { x: 1, y: 0 } : aim;
    } else {
      this.phase = 'bellowWindup'; this.timer = STAG.bellowWindupMs;
    }
  }

  private releaseVolley(boss: Vector2Like): void {
    const aim = this.volleyAim ?? { x: 1, y: 0 };
    const count = this.rut ? STAG.rutVolleyShards : STAG.volleyShards;
    const base = Math.atan2(aim.y, aim.x);
    this.volley = { origin: { ...boss }, directions: Array.from({ length: count }, (_, i) => {
      const a = base - STAG.volleySpread / 2 + i * STAG.volleySpread / Math.max(1, count - 1);
      return { x: Math.cos(a), y: Math.sin(a) };
    }) };
    this.volleyAim = undefined;
    this.rest(STAG.volleyRestMs);
  }

  private aimLane(boss: Vector2Like, target: Vector2Like): ChargeLane {
    const aim = normalize(target.x - boss.x, target.y - boss.y);
    return { from: { ...boss }, direction: aim.x === 0 && aim.y === 0 ? { x: 1, y: 0 } : aim, length: STAG.chargeDistance };
  }

  private beginWindup(boss: Vector2Like, player: Vector2Like): void {
    const followUp = this.chargesLeft > 0;
    this.phase = 'windup';
    this.timer = this.rut ? STAG.rutWindupMs : this.enraged ? STAG.enragedWindupMs : STAG.windupMs;
    this.feintAt = undefined;
    if (this.chargesLeft === 0) this.chargesLeft = this.rut ? STAG.rutCharges : this.enraged ? STAG.enragedCharges : 1;
    this.chargesLeft--;
    let target = player;
    if (followUp && this.enraged) {
      // Aim where the player will be when he arrives, not where they stand now.
      const arrivalMs = this.timer + Math.sqrt(distanceSq(boss, player)) / STAG.chargeSpeed * 1000;
      const lead = Math.min(STAG.leadMaxMs, arrivalMs) / 1000;
      target = { x: player.x + this.playerVelocity.x * lead, y: player.y + this.playerVelocity.y * lead };
    } else if (this.enraged) {
      if (this.feintNext) { this.feintAt = this.timer; this.timer += STAG.feintExtraMs; }
      this.feintNext = !this.feintNext;
    }
    this.lane = this.aimLane(boss, target);
  }

  private beginSweep(boss: Vector2Like, player: Vector2Like): void {
    this.phase = 'sweepWindup';
    this.timer = STAG.sweepWindupMs;
    this.closeMs = 0;
    const aim = normalize(player.x - boss.x, player.y - boss.y);
    this.sweep = { origin: { ...boss }, direction: aim.x === 0 && aim.y === 0 ? { x: 1, y: 0 } : aim, range: STAG.sweepRange };
  }

  private resolveSweep(player: Vector2Like, playerRadius: number, hit: StagHit): void {
    const sweep = this.sweep!;
    const dx = player.x - sweep.origin.x, dy = player.y - sweep.origin.y;
    const inFront = dx * sweep.direction.x + dy * sweep.direction.y >= -playerRadius;
    if (inFront && dx * dx + dy * dy <= (sweep.range + playerRadius) ** 2) {
      const push = normalize(dx, dy);
      hit(STAG.sweepDamage, push.x === 0 && push.y === 0 ? sweep.direction : push, STAG.sweepKnockback);
    }
    this.swept = true;
    this.sweep = undefined;
    this.rest(STAG.sweepRestMs);
  }

  private endCharge(at: Vector2Like, player: Vector2Like, playerRadius: number, hit: StagHit): void {
    this.phase = 'recovering';
    this.timer = this.rut ? STAG.rutRecoverMs : STAG.recoverMs;
    this.lane = undefined;
    this.impacts.push({ ...at });
    if (distanceSq(at, player) <= (STAG.stompRadius + playerRadius) ** 2) {
      hit(STAG.stompDamage, normalize(player.x - at.x, player.y - at.y));
    }
  }

  /** Whether the stag's body sweeps over the player while moving from a to b this frame. */
  private segmentHits(a: Vector2Like, b: Vector2Like, player: Vector2Like, playerRadius: number): boolean {
    const reach = STAG.radius + playerRadius;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((player.x - a.x) * dx + (player.y - a.y) * dy) / len2)) : 0;
    return distanceSq({ x: a.x + dx * t, y: a.y + dy * t }, player) <= reach * reach;
  }

  /**
   * Called when something stops the charge short. Scenery stuns him (`stun`); the arena's edge
   * only ends the charge.
   */
  blocked(at: Vector2Like, player: Vector2Like, playerRadius: number, hit: StagHit, stun = true): void {
    if (this.phase !== 'charging') return;
    this.endCharge(at, player, playerRadius, hit);
    if (stun) { this.phase = 'stunned'; this.timer = this.rut ? STAG.rutStunMs : STAG.stunMs; this.chargesLeft = 0; }
  }

  defeat(): void {
    this.defeated = true; this.lane = undefined; this.sweep = undefined; this.volleyAim = undefined; this.volley = undefined;
    this.impacts = []; this.chargeStep = { x: 0, y: 0 }; this.pendingStampedes = 0; this.feintAt = undefined;
  }
}
