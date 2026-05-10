import { GAME_CONFIG } from '../config/gameConfig';
import type { Vector2Like } from '../core/types';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distanceSq(a: Vector2Like, b: Vector2Like): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function normalize(x: number, y: number): Vector2Like {
  const length = Math.hypot(x, y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / length, y: y / length };
}

export function clampToArena(position: Vector2Like, radius: number): Vector2Like {
  return {
    x: clamp(position.x, radius, GAME_CONFIG.arena.width - radius),
    y: clamp(position.y, radius, GAME_CONFIG.arena.height - radius)
  };
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString();
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
