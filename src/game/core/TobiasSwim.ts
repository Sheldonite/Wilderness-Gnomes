import { BALANCE } from '../config/balance';
import { companionPower } from '../config/companions';
import type { CombatTarget, DealDamage } from './CombatResolver';
import type { PlayerStats, Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

export type TobiasState = 'cruising' | 'darting' | 'returning';

/** A puff of stirred air left behind the tuna, since he swims through no water at all. */
export interface AirWake {
  position: Vector2Like;
  bornAt: number;
  expiresAt: number;
}

/** Rank 5 Tidal Wake splash ring spawned on torpedo impact. */
export interface TidalSplash {
  position: Vector2Like;
  radius: number;
  bornAt: number;
  expiresAt: number;
}

/**
 * Tobias, Ron's bluefin tuna. He cruises through the air beside the bard on a slow figure of
 * eight, then torpedoes the nearest foe and drifts back. Pure simulation: no Phaser here, so
 * the behaviour can be tested and cannot change with renderer capacity.
 */
export class TobiasSwim {
  position: Vector2Like = { x: 0, y: 0 };
  facing: Vector2Like = { x: 1, y: 0 };
  state: TobiasState = 'cruising';
  wakes: AirWake[] = [];
  splashRings: TidalSplash[] = [];
  elapsedMs = 0;
  /** Rises and falls as he swims, so the renderer can lift him off the ground plane. */
  bob = 0;
  private cooldownMs = 0;
  private dartAgeMs = 0;
  private targetId?: number;
  private wakeDueMs = 0;
  private primed = false;
  private chainsRemaining = 0;
  private readonly chainedIds = new Set<number>();

  constructor(private readonly stats: PlayerStats) {}

  get damage(): number {
    return Math.round(BALANCE.companion.tobiasDamage * companionPower(this.stats.companionRank));
  }

  get darting(): boolean {
    return this.state === 'darting';
  }

  update(deltaMs: number, player: Vector2Like, enemies: CombatTarget[], damage: DealDamage): void {
    const b = BALANCE.companion;
    if (!this.primed) {
      this.primed = true;
      this.position = this.lane(player);
    }
    this.elapsedMs += deltaMs;
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    // A tuna moving at speed rolls the air behind him; the trail thins out when he is idling.
    this.bob = Math.sin(this.elapsedMs / 620) * b.tobiasBobPixels;

    if (this.state === 'darting') {
      this.dartAgeMs += deltaMs;
      const target = enemies.find(enemy => enemy.id === this.targetId && !enemy.isDead);
      if (!target || this.dartAgeMs > b.tobiasDartTimeoutMs) {
        this.state = 'returning';
        this.targetId = undefined;
        this.chainsRemaining = 0;
      } else {
        this.swim(target.position, b.tobiasDartSpeed, deltaMs);
        if (distanceSq(this.position, target.position) <= (b.tobiasHitRadius + target.radius) ** 2) {
          this.applyHit(target, enemies, damage);
          this.chainedIds.add(target.id);
          const nextChain = this.chainsRemaining > 0
            ? this.closest(this.position, enemies, b.tobiasSurgeChainRadius, this.chainedIds)
            : undefined;
          if (nextChain) {
            this.chainsRemaining -= 1;
            this.targetId = nextChain.id;
            this.dartAgeMs = 0;
          } else {
            this.state = 'returning';
            this.cooldownMs = Math.round(b.tobiasCooldownMs / (1 + .04 * this.stats.companionRank));
            this.targetId = undefined;
            this.chainsRemaining = 0;
          }
        }
      }
    } else if (this.state === 'returning') {
      const lane = this.lane(player);
      this.swim(lane, b.tobiasReturnSpeed, deltaMs);
      if (distanceSq(this.position, lane) <= 20 ** 2) this.state = 'cruising';
    } else {
      const lane = this.lane(player);
      const before = { ...this.position };
      this.position = lane;
      const moved = normalize(lane.x - before.x, lane.y - before.y);
      if (moved.x !== 0 || moved.y !== 0) this.facing = moved;
      if (this.cooldownMs <= 0) {
        const prey = this.closest(player, enemies, b.tobiasHuntRange);
        if (prey) {
          this.state = 'darting';
          this.targetId = prey.id;
          this.dartAgeMs = 0;
          this.chainedIds.clear();
          this.chainsRemaining = this.stats.companionRank >= 10 ? b.tobiasSurgeMaxChains : 0;
        }
      }
    }

    if (this.elapsedMs >= this.wakeDueMs) {
      this.wakeDueMs = this.elapsedMs + (this.darting ? 70 : 220);
      this.wakes.push({ position: { ...this.position }, bornAt: this.elapsedMs, expiresAt: this.elapsedMs + b.tobiasWakeMs });
    }
    this.wakes = this.wakes.filter(wake => this.elapsedMs < wake.expiresAt);
    this.splashRings = this.splashRings.filter(ring => this.elapsedMs < ring.expiresAt);
  }

  private applyHit(target: CombatTarget, enemies: CombatTarget[], damage: DealDamage): void {
    const b = BALANCE.companion;
    const strikeDamage = this.damage;
    damage(target, strikeDamage, 'companion');
    // Rank 5 Tidal Wake: torpedo hits splash 60% AoE damage within 75px.
    if (this.stats.companionRank >= 5) {
      const splashDamage = Math.round(strikeDamage * b.tobiasWakeSplashRatio);
      for (const other of enemies) {
        if (other.isDead || other.id === target.id) continue;
        if (distanceSq(target.position, other.position) <= (b.tobiasWakeSplashRadius + other.radius) ** 2) {
          damage(other, splashDamage, 'companion');
        }
      }
      this.splashRings.push({
        position: { ...target.position },
        radius: b.tobiasWakeSplashRadius,
        bornAt: this.elapsedMs,
        expiresAt: this.elapsedMs + 320
      });
    }
  }

  /** The lazy figure of eight he holds beside the bard when nothing needs torpedoing. */
  private lane(player: Vector2Like): Vector2Like {
    const b = BALANCE.companion;
    const t = this.elapsedMs / b.tobiasSwimMs * Math.PI * 2;
    return { x: player.x + Math.sin(t) * b.tobiasSwimRadius * 1.35, y: player.y + Math.sin(t * 2) * b.tobiasSwimRadius * .55 };
  }

  private swim(goal: Vector2Like, speed: number, deltaMs: number): void {
    const step = speed * deltaMs / 1000;
    const heading = normalize(goal.x - this.position.x, goal.y - this.position.y);
    if (heading.x !== 0 || heading.y !== 0) this.facing = heading;
    const remaining = Math.hypot(goal.x - this.position.x, goal.y - this.position.y);
    const travel = Math.min(step, remaining);
    this.position = { x: this.position.x + heading.x * travel, y: this.position.y + heading.y * travel };
  }

  private closest(from: Vector2Like, enemies: CombatTarget[], range: number, excluded?: Set<number>): CombatTarget | undefined {
    let best: CombatTarget | undefined;
    let bestDistance = range * range;
    for (const enemy of enemies) {
      if (enemy.isDead || excluded?.has(enemy.id)) continue;
      const distance = distanceSq(from, enemy.position);
      if (distance > bestDistance) continue;
      best = enemy;
      bestDistance = distance;
    }
    return best;
  }
}
