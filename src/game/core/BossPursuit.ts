import type { Vector2Like } from './types';

export const BOSS_ENGAGE_DISTANCE = 500;
const BOSS_CATCHUP_SPEED = 420;

/** Close a large gap before starting another windup, then return to the boss's usual pace. */
export function bossPursuitStep(from: Vector2Like, target: Vector2Like, standOff: number,
  speed: number, slowMultiplier: number, deltaMs: number): Vector2Like {
  const dx = target.x - from.x, dy = target.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= standOff) return { x: 0, y: 0 };
  const moveSpeed = distance > BOSS_ENGAGE_DISTANCE ? Math.max(speed, BOSS_CATCHUP_SPEED) : speed;
  const step = Math.min(distance - standOff, moveSpeed * slowMultiplier * deltaMs / 1000);
  return { x: dx / distance * step, y: dy / distance * step };
}
