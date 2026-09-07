import { BALANCE } from '../config/balance';
import type { CombatTarget, DealDamage } from './CombatResolver';
import type { Vector2Like } from './types';
import { clampToArena, distanceSq, normalize } from '../utils/math';

export type CatFacing = 'down' | 'right' | 'up' | 'left';
export function catFacing(direction: Vector2Like): CatFacing {
  return Math.abs(direction.x) > Math.abs(direction.y) ? direction.x < 0 ? 'left' : 'right' : direction.y < 0 ? 'up' : 'down';
}

/** A grounded walk-and-swat companion; no lunge or teleport is used to reach a target. */
export class MidnightBehavior {
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

  constructor(playerPosition: Vector2Like) {
    this.position = this.followPoint(playerPosition);
  }

  update(deltaMs: number, player: Vector2Like, enemies: CombatTarget[], damage: DealDamage): void {
    const b = BALANCE.companion;
    this.moving = false;
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    if (this.state === 'swatting') {
      this.swatAgeMs += deltaMs;
      if (!this.hitApplied && this.swatAgeMs >= b.midnightSwatHitMs) {
        this.hitApplied = true;
        this.impactSerial++;
        for (const enemy of enemies) {
          if (enemy.isDead || distanceSq(this.position, enemy.position) > (b.midnightSwatRange + enemy.radius) ** 2) continue;
          const direction = normalize(enemy.position.x - this.position.x, enemy.position.y - this.position.y);
          if (direction.x * this.aim.x + direction.y * this.aim.y >= .5 || distanceSq(this.position, enemy.position) < 1) damage(enemy, b.midnightDamage);
        }
      }
      if (this.swatAgeMs >= b.midnightSwatDurationMs) this.state = 'returning';
      return;
    }
    const follow = this.followPoint(player);
    if (distanceSq(this.position, player) > b.midnightLeashRange ** 2) this.state = 'returning';
    if (this.state === 'returning') {
      this.move(follow, deltaMs);
      if (distanceSq(this.position, follow) <= 8 ** 2) this.state = 'following';
      return;
    }
    let target: CombatTarget | undefined;
    let nearest = Infinity;
    if (this.cooldownMs <= 0) for (const enemy of enemies) {
      if (enemy.isDead || distanceSq(enemy.position, player) > b.midnightSeekRange ** 2) continue;
      const d = distanceSq(enemy.position, this.position);
      if (d < nearest) { target = enemy; nearest = d; }
    }
    if (!target) { this.state = 'following'; this.move(follow, deltaMs); return; }
    this.state = 'approaching';
    const direction = normalize(target.position.x - this.position.x, target.position.y - this.position.y);
    this.facing = catFacing(direction);
    if (nearest <= b.midnightApproachRange ** 2) {
      this.state = 'swatting'; this.swatAgeMs = 0; this.hitApplied = false; this.swatSerial++;
      // Match the visible cardinal paw strike to its 120-degree hit cone.
      this.aim = this.facing === 'left' ? { x: -1, y: 0 } : this.facing === 'right' ? { x: 1, y: 0 } : this.facing === 'up' ? { x: 0, y: -1 } : { x: 0, y: 1 };
      this.cooldownMs = b.midnightCooldownMs;
      return;
    }
    this.move(target.position, deltaMs, b.midnightApproachRange - 2);
  }

  private followPoint(player: Vector2Like): Vector2Like {
    return clampToArena({ x: player.x + BALANCE.companion.midnightFollowDistance, y: player.y + BALANCE.companion.midnightFollowDistance * .55 }, 12);
  }

  private move(target: Vector2Like, deltaMs: number, stop = 5): void {
    const distance = Math.hypot(target.x - this.position.x, target.y - this.position.y);
    if (distance <= stop) return;
    const direction = normalize(target.x - this.position.x, target.y - this.position.y);
    const step = Math.min(distance - stop, BALANCE.companion.midnightWalkSpeed * deltaMs / 1000);
    this.position = clampToArena({ x: this.position.x + direction.x * step, y: this.position.y + direction.y * step }, 12);
    this.facing = catFacing(direction); this.moving = step > 0;
  }
}
