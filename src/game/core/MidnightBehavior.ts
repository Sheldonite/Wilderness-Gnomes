import { midnightSwatPower } from '../config/midnightSwat';
import { createNavigationRoute, type SceneryNavigation } from './SceneryNavigation';
import { BALANCE } from '../config/balance';
import type { CombatTarget, DealDamage } from './CombatResolver';
import type { PlayerStats, Vector2Like } from './types';
import { clampToArena, distanceSq, normalize } from '../utils/math';

export type CatFacing = 'down' | 'right' | 'up' | 'left';
export function catFacing(direction: Vector2Like): CatFacing {
  return Math.abs(direction.x) > Math.abs(direction.y) ? direction.x < 0 ? 'left' : 'right' : direction.y < 0 ? 'up' : 'down';
}

/** A grounded walk-and-swat companion; no lunge or teleport is used to reach a target. */
export class MidnightBehavior {
  protected readonly route = createNavigationRoute();
  position: Vector2Like;
  facing: CatFacing = 'down';
  state: 'following' | 'approaching' | 'swatting' | 'returning' = 'following';
  moving = false;
  swatAgeMs = 0;
  swatSerial = 0;
  impactSerial = 0;
  private cooldownMs = 600;
  private hitApplied = false;
  private aim: Vector2Like = { x: 0, y: 1 };

  constructor(playerPosition: Vector2Like, private readonly navigation?: SceneryNavigation, private readonly stats?: PlayerStats) {
    this.position = navigation?.nearest(this.followPoint(playerPosition), 12) ?? this.followPoint(playerPosition);
  }

  update(deltaMs: number, player: Vector2Like, enemies: CombatTarget[], damage: DealDamage): void {
    const b = BALANCE.companion, power = this.swatPower;
    this.moving = false;
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    if (this.state === 'swatting') {
      this.swatAgeMs += deltaMs;
      if (!this.hitApplied && this.swatAgeMs >= b.midnightSwatHitMs) {
        this.hitApplied = true;
        this.impactSerial++;
        for (const enemy of enemies) {
          if (enemy.isDead || (this.navigation && !this.navigation.clear(this.position, enemy.position, 2)) || distanceSq(this.position, enemy.position) > (power.range + enemy.radius) ** 2) continue;
          const direction = normalize(enemy.position.x - this.position.x, enemy.position.y - this.position.y);
          if (direction.x * this.aim.x + direction.y * this.aim.y >= Math.cos(power.arcDegrees * Math.PI / 360) - 1e-9 || distanceSq(this.position, enemy.position) < 1) damage(enemy, power.damage);
        }
      }
      if (this.swatAgeMs >= b.midnightSwatDurationMs) this.state = 'returning';
      return;
    }
    const follow = this.navigation?.nearest(this.followPoint(player), 12) ?? this.followPoint(player);
    if (distanceSq(this.position, player) > b.midnightLeashRange ** 2) this.state = 'returning';
    if (this.state === 'returning') {
      this.move(follow, deltaMs);
      if (distanceSq(this.position, follow) <= 8 ** 2) this.state = 'following';
      return;
    }
    let target: CombatTarget | undefined;
    let nearest = Infinity;
    if (this.cooldownMs <= 0) for (const enemy of enemies) {
      if (enemy.isDead || (this.navigation && !this.navigation.clear(this.position, enemy.position, 2)) || distanceSq(enemy.position, player) > b.midnightSeekRange ** 2) continue;
      const d = distanceSq(enemy.position, this.position);
      if (d < nearest) { target = enemy; nearest = d; }
    }
    if (!target) { this.state = 'following'; this.move(follow, deltaMs); return; }
    this.state = 'approaching';
    const direction = normalize(target.position.x - this.position.x, target.position.y - this.position.y);
    this.facing = catFacing(direction);
    if (nearest <= b.midnightApproachRange ** 2 && (!this.navigation || this.navigation.clear(this.position, target.position, 2))) {
      this.state = 'swatting'; this.swatAgeMs = 0; this.hitApplied = false; this.swatSerial++;
      // Keep the strike aimed with the visible paw; higher ranks widen its arc.
      this.aim = this.facing === 'left' ? { x: -1, y: 0 } : this.facing === 'right' ? { x: 1, y: 0 } : this.facing === 'up' ? { x: 0, y: -1 } : { x: 0, y: 1 };
      this.cooldownMs = power.cooldownMs;
      return;
    }
    this.move(target.position, deltaMs, b.midnightApproachRange - 2);
  }

  get swatPower() { return midnightSwatPower(this.stats?.abilityRanks['midnight-mighty-swat'] ?? 0); }

  private followPoint(player: Vector2Like): Vector2Like {
    return clampToArena({ x: player.x + BALANCE.companion.midnightFollowDistance, y: player.y + BALANCE.companion.midnightFollowDistance * .55 }, 12);
  }

  private move(target: Vector2Like, deltaMs: number, stop = 5): void {
    const distance = Math.hypot(target.x - this.position.x, target.y - this.position.y);
    if (distance <= stop) return;
    const direction = normalize(target.x - this.position.x, target.y - this.position.y);
    const step = Math.min(distance - stop, BALANCE.companion.midnightWalkSpeed * deltaMs / 1000);
    const before = this.position;
    this.position = this.navigation?.toward(before, target, step, 12, this.route) ?? clampToArena({ x: before.x + direction.x * step, y: before.y + direction.y * step }, 12);
    this.moving = distanceSq(before, this.position) > .001;
    if (this.moving) this.facing = catFacing({ x: this.position.x - before.x, y: this.position.y - before.y });
  }
}
