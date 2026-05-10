export const ENEMY_SPRITE_KEY = 'enemy-squirrel';
export const ENEMY_ANIMATION_PREFIX = 'enemy';
export const ENEMY_FRAME_SIZE = 64;
export const ENEMY_FRAMES_PER_ROW = 4;

export const ENEMY_ANIMATION_ROWS = [
  ['walk-down', 0, 8],
  ['walk-down-right', 1, 8],
  ['walk-right', 2, 8],
  ['walk-up-right', 3, 8],
  ['walk-up', 4, 8],
  ['walk-up-left', 5, 8],
  ['walk-left', 6, 8],
  ['walk-down-left', 7, 8]
] as const;

export const ENEMY_WALK_ANIMATION_BY_DIRECTION: Record<string, string> = {
  '0,1': 'enemy-walk-down',
  '1,1': 'enemy-walk-down-right',
  '1,0': 'enemy-walk-right',
  '1,-1': 'enemy-walk-up-right',
  '0,-1': 'enemy-walk-up',
  '-1,-1': 'enemy-walk-up-left',
  '-1,0': 'enemy-walk-left',
  '-1,1': 'enemy-walk-down-left'
};
