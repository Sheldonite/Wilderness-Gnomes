import type { Vector2Like } from './types';

export const SHELDON_DIRECTIONS = ['south', 'southeast', 'east', 'northeast', 'north', 'northwest', 'west', 'southwest'] as const;
export type SheldonDirection = typeof SHELDON_DIRECTIONS[number];
export const SHELDON_FRAME_WIDTH = 192;
export const SHELDON_FRAME_HEIGHT = 256;
export const SHELDON_FRAMES_PER_DIRECTION = 12;

export function sheldonDirection(vector: Vector2Like): SheldonDirection {
  if (!vector.x && !vector.y) return 'south';
  const sector = Math.round(Math.atan2(vector.x, vector.y) / (Math.PI / 4));
  return SHELDON_DIRECTIONS[(sector + 8) % 8];
}

export const SHELDON_FRAMES = SHELDON_DIRECTIONS.flatMap((direction, row) =>
  Array.from({ length: SHELDON_FRAMES_PER_DIRECTION }, (_, column) => ({
    id: `${direction}-${column < 4 ? 'idle' : 'walk'}-${column < 4 ? column + 1 : column - 3}`,
    direction, row, column, index: row * SHELDON_FRAMES_PER_DIRECTION + column,
    kind: column < 4 ? 'idle' as const : 'walk' as const,
    animationFrame: column < 4 ? column : column - 4
  })));

export function sheldonAnimation(direction: Vector2Like, idle = false): { key: string } {
  return { key: `sheldon-${idle ? 'idle' : 'walk'}-${sheldonDirection(direction)}` };
}
