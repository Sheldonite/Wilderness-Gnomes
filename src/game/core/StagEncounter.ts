import { STAG } from '../config/stagBoss';
import type { Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

export type StagPhase = 'arrival' | 'stalking' | 'windup' | 'charging' | 'recovering' | 'stunned' | 'sweepWindup';
export interface ChargeLane { from: Vector2Like; direction: Vector2Like; length: number; }
export interface AntlerSweep { origin: Vector2Like; direction: Vector2Like; range: number; }
/** A blow the stag lands: damage, the direction the player is thrown, and how far (default: the charge's). */
export type StagHit = (damage: number, push: Vector2Like, knockback?: number) => void;

/**
 * One encounter per run, advanced only on the gameplay clock.
 * The stag stalks to a standoff, paws the ground while aiming a lane at the player, then charges
 * down that lane; the lane is locked at windup so a watchful player can step out of it. Landing
 * the charge throws the player back; where the charge ends, the stag's stomp shakes anything close.
 * Baited into a tree, he is stunned and takes extra damage. Crowd him and he sweeps his antlers.
 * Below half health he is enraged: shorter windups, two charges in a row, and the second one leads
 * the player. He calls the herd as he passes each stampede threshold.
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
  private lastPlayer?: Vector2Like;
  /** Smoothed player velocity in pixels per second, for leading enraged charges. */
  playerVelocity: Vector2Like = { x: 0, y: 0 };

  shouldSpawn(level: number): boolean {
    if (this.spawned || level < STAG.level) return false;
    this.spawned = true; return true;
  }

  get enraged(): boolean { return this.healthFraction <= STAG.enrageFraction; }
  /** Stunned against a tree: the damage window. */
  get vulnerable(): boolean { return this.phase === 'stunned'; }
  private healthFraction = 1;

  update(deltaMs: number, boss: Vector2Like, player: Vector2Like, playerRadius: number, healthFraction: number, hit: StagHit): void {
    this.impacts = [];
    this.chargeStep = { x: 0, y: 0 };
    this.swept = false;
    if (!this.spawned || this.defeated) return;
    this.healthFraction = healthFraction;
    this.trackPlayer(deltaMs, player);
    while (this.stampedeWaves < STAG.stampedeThresholds.length && healthFraction <= STAG.stampedeThresholds[this.stampedeWaves]) {
      this.stampedeWaves++; this.pendingStampedes++;
    }
    if (this.phase === 'charging') {
      const step = Math.min(STAG.chargeSpeed * deltaMs / 1000, STAG.chargeDistance - this.travelled);
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
    if (this.timer > 0) return;
    if (this.phase === 'arrival') { this.phase = 'stalking'; this.timer = 900; }
    else if (this.phase === 'stalking') this.beginWindup(boss, player);
    else if (this.phase === 'windup') {
      this.phase = 'charging'; this.travelled = 0; this.hitThisCharge = false;
    } else if (this.phase === 'recovering') {
      if (this.chargesLeft > 0) this.beginWindup(boss, player);
      else this.rest();
    } else if (this.phase === 'stunned') this.rest();
    else if (this.phase === 'sweepWindup') this.resolveSweep(player, playerRadius, hit);
  }

  private rest(): void { this.phase = 'stalking'; this.timer = this.enraged ? STAG.enragedCooldownMs : STAG.cooldownMs; }

  private trackPlayer(deltaMs: number, player: Vector2Like): void {
    if (this.lastPlayer && deltaMs > 0) {
      const vx = (player.x - this.lastPlayer.x) / (deltaMs / 1000), vy = (player.y - this.lastPlayer.y) / (deltaMs / 1000);
      const k = Math.min(1, deltaMs / 80);
      this.playerVelocity = { x: this.playerVelocity.x + (vx - this.playerVelocity.x) * k, y: this.playerVelocity.y + (vy - this.playerVelocity.y) * k };
    }
    this.lastPlayer = { ...player };
  }

  private beginWindup(boss: Vector2Like, player: Vector2Like): void {
    const followUp = this.chargesLeft > 0;
    this.phase = 'windup';
    this.timer = this.enraged ? STAG.enragedWindupMs : STAG.windupMs;
    if (this.chargesLeft === 0) this.chargesLeft = this.enraged ? STAG.enragedCharges : 1;
    this.chargesLeft--;
    let target = player;
    if (followUp && this.enraged) {
      // Aim where the player will be when he arrives, not where they stand now.
      const arrivalMs = this.timer + Math.sqrt(distanceSq(boss, player)) / STAG.chargeSpeed * 1000;
      const lead = Math.min(STAG.leadMaxMs, arrivalMs) / 1000;
      target = { x: player.x + this.playerVelocity.x * lead, y: player.y + this.playerVelocity.y * lead };
    }
    const aim = normalize(target.x - boss.x, target.y - boss.y);
    this.lane = { from: { ...boss }, direction: aim.x === 0 && aim.y === 0 ? { x: 1, y: 0 } : aim, length: STAG.chargeDistance };
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
    this.phase = 'stalking';
    this.timer = STAG.sweepRestMs;
  }

  private endCharge(at: Vector2Like, player: Vector2Like, playerRadius: number, hit: StagHit): void {
    this.phase = 'recovering';
    this.timer = STAG.recoverMs;
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
    if (stun) { this.phase = 'stunned'; this.timer = STAG.stunMs; this.chargesLeft = 0; }
  }

  defeat(): void {
    this.defeated = true; this.lane = undefined; this.sweep = undefined; this.impacts = [];
    this.chargeStep = { x: 0, y: 0 }; this.pendingStampedes = 0;
  }
}
