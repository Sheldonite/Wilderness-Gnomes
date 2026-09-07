import { STAG } from '../config/stagBoss';
import type { Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

export type StagPhase = 'arrival' | 'stalking' | 'windup' | 'charging' | 'recovering';
export interface ChargeLane { from: Vector2Like; direction: Vector2Like; length: number; }
/** A blow the stag lands: damage plus the direction the player is thrown. */
export type StagHit = (damage: number, push: Vector2Like) => void;

/**
 * One encounter per run, advanced only on the gameplay clock.
 * The stag stalks to a standoff, paws the ground while aiming a lane at the player, then charges
 * down that lane; the lane is locked at windup so a watchful player can step out of it. Landing
 * the charge throws the player back; where the charge ends, the stag's stomp shakes anything close.
 * Below half health it is enraged: shorter windups, and two charges in a row.
 */
export class StagEncounter {
  spawned = false;
  defeated = false;
  phase: StagPhase = 'arrival';
  lane?: ChargeLane;
  /** Offset the boss must move this frame while charging; the entity applies it. */
  chargeStep: Vector2Like = { x: 0, y: 0 };
  /** Where a stomp landed this frame, if any. */
  impacts: Vector2Like[] = [];
  private timer: number = STAG.introductionMs;
  private travelled = 0;
  private hitThisCharge = false;
  private chargesLeft = 0;

  shouldSpawn(level: number): boolean {
    if (this.spawned || level < STAG.level) return false;
    this.spawned = true; return true;
  }

  get enraged(): boolean { return this.healthFraction <= STAG.enrageFraction; }
  private healthFraction = 1;

  update(deltaMs: number, boss: Vector2Like, player: Vector2Like, playerRadius: number, healthFraction: number, hit: StagHit): void {
    this.impacts = [];
    this.chargeStep = { x: 0, y: 0 };
    if (!this.spawned || this.defeated) return;
    this.healthFraction = healthFraction;
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
    this.timer -= deltaMs;
    if (this.timer > 0) return;
    if (this.phase === 'arrival') { this.phase = 'stalking'; this.timer = 900; }
    else if (this.phase === 'stalking') this.beginWindup(boss, player);
    else if (this.phase === 'windup') {
      this.phase = 'charging'; this.travelled = 0; this.hitThisCharge = false;
    } else if (this.phase === 'recovering') {
      if (this.chargesLeft > 0) this.beginWindup(boss, player);
      else { this.phase = 'stalking'; this.timer = this.enraged ? STAG.enragedCooldownMs : STAG.cooldownMs; }
    }
  }

  private beginWindup(boss: Vector2Like, player: Vector2Like): void {
    this.phase = 'windup';
    this.timer = this.enraged ? STAG.enragedWindupMs : STAG.windupMs;
    if (this.chargesLeft === 0) this.chargesLeft = this.enraged ? STAG.enragedCharges : 1;
    this.chargesLeft--;
    const aim = normalize(player.x - boss.x, player.y - boss.y);
    this.lane = { from: { ...boss }, direction: aim.x === 0 && aim.y === 0 ? { x: 1, y: 0 } : aim, length: STAG.chargeDistance };
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

  /** Called by the boss entity when scenery stops the charge short. */
  blocked(at: Vector2Like, player: Vector2Like, playerRadius: number, hit: StagHit): void {
    if (this.phase === 'charging') this.endCharge(at, player, playerRadius, hit);
  }

  defeat(): void { this.defeated = true; this.lane = undefined; this.impacts = []; this.chargeStep = { x: 0, y: 0 }; }
}
