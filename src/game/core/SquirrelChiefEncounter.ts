import { SQUIRREL_CHIEF } from '../config/squirrelChief';
import type { Vector2Like } from './types';
import { normalize } from '../utils/math';

export type SquirrelChiefPhase =
  | 'arrival'
  | 'stalking'
  | 'barrageWindup'
  | 'chargeWindup'
  | 'charging'
  | 'catchBreath';

export type SquirrelChiefAttack = 'barrage' | 'charge';

export interface ChiefChargeLane {
  from: Vector2Like;
  direction: Vector2Like;
  length: number;
}

export interface AcornBarrage {
  origin: Vector2Like;
  directions: Vector2Like[];
  speed: number;
}

export type ChiefHit = (damage: number, push: Vector2Like) => void;

/**
 * Pure state machine for the Level 5 Squirrel Chief mini-boss.
 * Alternates between Acorn Barrage (5-acorn spread fan) and Chief Charge (650ms telegraphed
 * 380px dash at 560 speed), followed by a 900ms catch-breath vulnerable window (1.3x damage).
 */
export class SquirrelChiefEncounter {
  spawned = false;
  defeated = false;
  phase: SquirrelChiefPhase = 'arrival';
  lane?: ChiefChargeLane;
  barrageAim?: Vector2Like;
  barrage?: AcornBarrage;
  chargeStep: Vector2Like = { x: 0, y: 0 };

  private timer: number = SQUIRREL_CHIEF.introductionMs;
  private attackIndex = 0;
  private travelled = 0;
  private hitThisCharge = false;

  shouldSpawn(level: number): boolean {
    if (this.spawned || level < SQUIRREL_CHIEF.level) return false;
    this.spawned = true;
    return true;
  }

  get vulnerable(): boolean {
    return this.phase === 'catchBreath';
  }

  get nextAttack(): SquirrelChiefAttack {
    return this.attackIndex % 2 === 0 ? 'barrage' : 'charge';
  }

  defeat(): void {
    this.defeated = true;
    this.lane = undefined;
    this.barrageAim = undefined;
    this.barrage = undefined;
    this.chargeStep = { x: 0, y: 0 };
  }

  update(
    deltaMs: number,
    boss: Vector2Like,
    player: Vector2Like,
    playerRadius: number,
    hit: ChiefHit
  ): void {
    this.chargeStep = { x: 0, y: 0 };
    this.barrage = undefined;
    if (!this.spawned || this.defeated) return;

    if (this.phase === 'charging') {
      const step = Math.min(
        (SQUIRREL_CHIEF.chargeSpeed * deltaMs) / 1000,
        SQUIRREL_CHIEF.chargeDistance - this.travelled
      );
      this.chargeStep = {
        x: this.lane!.direction.x * step,
        y: this.lane!.direction.y * step
      };
      this.travelled += step;
      const after = { x: boss.x + this.chargeStep.x, y: boss.y + this.chargeStep.y };
      if (!this.hitThisCharge && this.segmentHits(boss, after, player, playerRadius)) {
        this.hitThisCharge = true;
        hit(SQUIRREL_CHIEF.chargeDamage, this.lane!.direction);
      }
      if (this.travelled >= SQUIRREL_CHIEF.chargeDistance - 1e-6) {
        this.enterCatchBreath();
      }
      return;
    }

    this.timer -= deltaMs;
    if (this.timer > 0) return;

    if (this.phase === 'arrival' || this.phase === 'catchBreath') {
      this.lane = undefined;
      this.phase = 'stalking';
      this.timer = SQUIRREL_CHIEF.stalkMs;
      return;
    }

    if (this.phase === 'stalking') {
      const attack = this.nextAttack;
      this.attackIndex++;
      if (attack === 'barrage') {
        this.phase = 'barrageWindup';
        this.barrageAim = this.aimToward(boss, player);
        this.timer = SQUIRREL_CHIEF.barrageWindupMs;
      } else {
        this.phase = 'chargeWindup';
        this.lane = {
          from: { x: boss.x, y: boss.y },
          direction: this.aimToward(boss, player),
          length: SQUIRREL_CHIEF.chargeDistance
        };
        this.timer = SQUIRREL_CHIEF.chargeWindupMs;
      }
      return;
    }

    if (this.phase === 'barrageWindup') {
      this.fireBarrage(boss);
      this.barrageAim = undefined;
      this.phase = 'stalking';
      this.timer = SQUIRREL_CHIEF.stalkMs + SQUIRREL_CHIEF.barrageRestMs;
      return;
    }

    if (this.phase === 'chargeWindup') {
      this.phase = 'charging';
      this.travelled = 0;
      this.hitThisCharge = false;
    }
  }

  /** Called when the chief's charge is stopped early by a tree or arena wall. */
  blocked(): void {
    if (this.phase !== 'charging') return;
    this.enterCatchBreath();
  }

  private enterCatchBreath(): void {
    this.phase = 'catchBreath';
    this.lane = undefined;
    this.chargeStep = { x: 0, y: 0 };
    this.timer = SQUIRREL_CHIEF.catchBreathMs;
  }

  private fireBarrage(origin: Vector2Like): void {
    const aim = this.barrageAim ?? { x: 1, y: 0 };
    const base = Math.atan2(aim.y, aim.x);
    const count = SQUIRREL_CHIEF.barrageCount;
    const directions: Vector2Like[] = [];
    for (let i = 0; i < count; i++) {
      const angle =
        base -
        SQUIRREL_CHIEF.barrageSpread / 2 +
        (i * SQUIRREL_CHIEF.barrageSpread) / Math.max(1, count - 1);
      directions.push({ x: Math.cos(angle), y: Math.sin(angle) });
    }
    this.barrage = {
      origin: { x: origin.x, y: origin.y },
      directions,
      speed: SQUIRREL_CHIEF.barrageSpeed
    };
  }

  private aimToward(from: Vector2Like, to: Vector2Like): Vector2Like {
    const dir = normalize(to.x - from.x, to.y - from.y);
    return dir.x === 0 && dir.y === 0 ? { x: 1, y: 0 } : dir;
  }

  private segmentHits(
    a: Vector2Like,
    b: Vector2Like,
    center: Vector2Like,
    playerRadius: number
  ): boolean {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    const t =
      lenSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((center.x - a.x) * abx + (center.y - a.y) * aby) / lenSq));
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    const hitRadius = SQUIRREL_CHIEF.radius + playerRadius;
    return (center.x - cx) ** 2 + (center.y - cy) ** 2 <= hitRadius * hitRadius;
  }
}
