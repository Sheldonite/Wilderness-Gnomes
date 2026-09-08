import type { Vector2Like } from './types';
import { SHELDON_DIRECTIONS, SHELDON_FRAMES, sheldonDirection } from './SheldonFrames';
/** Ron uses the same frame layout as Sheldon. */
export const RON_DIRECTIONS = SHELDON_DIRECTIONS;
export const RON_FRAMES = SHELDON_FRAMES;
export const RON_FRAME_WIDTH = 192;
export const RON_FRAME_HEIGHT = 256;
export const RON_FRAMES_PER_DIRECTION = 12;
export function ronAnimation(direction: Vector2Like, idle = false): { key: string } {
  return { key: `ron-${idle ? 'idle' : 'walk'}-${sheldonDirection(direction)}` };
}
