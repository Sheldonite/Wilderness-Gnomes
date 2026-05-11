import Phaser from 'phaser';

export const PLAYER_SPRITE_KEY = 'player-code-wizard';
export const PLAYER_ANIMATION_PREFIX = 'player';
export const PLAYER_FRAME_SIZE = 96;
export const PLAYER_FRAMES_PER_ROW = 4;
export const PLAYER_SPRITE_SHEET_WIDTH = 384;
export const PLAYER_SPRITE_SHEET_HEIGHT = 864;
export const PLAYER_SPRITE_ADJUSTMENTS_STORAGE_KEY = 'wilderness-gnomes-player-sprite-adjustments';

export const PLAYER_ANIMATION_ROWS = [
  ['idle-down', 0, 6],
  ['walk-down', 1, 8],
  ['walk-down-right', 2, 8],
  ['walk-right', 3, 8],
  ['walk-up-right', 4, 8],
  ['walk-up', 5, 8],
  ['walk-up-left', 6, 8],
  ['walk-left', 7, 8],
  ['walk-down-left', 8, 8]
] as const;

export interface PlayerSpriteFrameDefinition {
  key: string;
  animationName: string;
  animationKey: string;
  frameIndex: number;
  frameInAnimation: number;
  defaultSourceX: number;
  defaultSourceY: number;
}

export interface PlayerSpriteFrameAdjustment {
  sourceX: number;
  sourceY: number;
  offsetX: number;
  offsetY: number;
}

export type PlayerSpriteAdjustmentMap = Record<string, PlayerSpriteFrameAdjustment>;

export const PLAYER_DEFAULT_SPRITE_ADJUSTMENTS: PlayerSpriteAdjustmentMap = {
  'idle-down-1': {
    sourceX: 0,
    sourceY: 0,
    offsetX: 0,
    offsetY: 0
  },
  'idle-down-2': {
    sourceX: 96,
    sourceY: 0,
    offsetX: 5,
    offsetY: 0
  },
  'idle-down-3': {
    sourceX: 192,
    sourceY: 0,
    offsetX: 8,
    offsetY: 0
  },
  'idle-down-4': {
    sourceX: 288,
    sourceY: 0,
    offsetX: 11,
    offsetY: 0
  },
  'walk-down-1': {
    sourceX: 0,
    sourceY: 106,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-2': {
    sourceX: 96,
    sourceY: 106,
    offsetX: 11,
    offsetY: 0
  },
  'walk-down-3': {
    sourceX: 192,
    sourceY: 106,
    offsetX: 15,
    offsetY: 0
  },
  'walk-down-4': {
    sourceX: 288,
    sourceY: 106,
    offsetX: 23,
    offsetY: 0
  },
  'walk-down-right-1': {
    sourceX: 0,
    sourceY: 206,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-right-2': {
    sourceX: 96,
    sourceY: 206,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-right-3': {
    sourceX: 192,
    sourceY: 206,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-right-4': {
    sourceX: 288,
    sourceY: 204,
    offsetX: 0,
    offsetY: 0
  },
  'walk-right-1': {
    sourceX: 0,
    sourceY: 311,
    offsetX: 0,
    offsetY: 0
  },
  'walk-right-2': {
    sourceX: 96,
    sourceY: 312,
    offsetX: 0,
    offsetY: 0
  },
  'walk-right-3': {
    sourceX: 192,
    sourceY: 309,
    offsetX: 0,
    offsetY: 0
  },
  'walk-right-4': {
    sourceX: 288,
    sourceY: 312,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-right-1': {
    sourceX: 0,
    sourceY: 312,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-right-2': {
    sourceX: 96,
    sourceY: 312,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-right-3': {
    sourceX: 192,
    sourceY: 313,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-right-4': {
    sourceX: 280,
    sourceY: 312,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-1': {
    sourceX: 0,
    sourceY: 515,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-2': {
    sourceX: 96,
    sourceY: 515,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-3': {
    sourceX: 187,
    sourceY: 514,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-4': {
    sourceX: 276,
    sourceY: 515,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-left-1': {
    sourceX: 0,
    sourceY: 414,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-left-2': {
    sourceX: 96,
    sourceY: 616,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-left-3': {
    sourceX: 192,
    sourceY: 617,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-left-4': {
    sourceX: 278,
    sourceY: 615,
    offsetX: 0,
    offsetY: 0
  },
  'walk-left-1': {
    sourceX: 0,
    sourceY: 616,
    offsetX: -9,
    offsetY: 0
  },
  'walk-left-2': {
    sourceX: 96,
    sourceY: 616,
    offsetX: -1,
    offsetY: 0
  },
  'walk-left-3': {
    sourceX: 192,
    sourceY: 619,
    offsetX: 0,
    offsetY: 0
  },
  'walk-left-4': {
    sourceX: 281,
    sourceY: 617,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-left-1': {
    sourceX: 0,
    sourceY: 727,
    offsetX: 0,
    offsetY: -1
  },
  'walk-down-left-2': {
    sourceX: 93,
    sourceY: 729,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-left-3': {
    sourceX: 188,
    sourceY: 727,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-left-4': {
    sourceX: 279,
    sourceY: 726,
    offsetX: 0,
    offsetY: 0
  }
};

export function getPlayerSpriteFrameDefinitions(): PlayerSpriteFrameDefinition[] {
  return PLAYER_ANIMATION_ROWS.flatMap(([animationName, row]) => {
    return Array.from({ length: PLAYER_FRAMES_PER_ROW }, (_, frameInAnimation) => {
      const frameIndex = row * PLAYER_FRAMES_PER_ROW + frameInAnimation;

      return {
        key: `${animationName}-${frameInAnimation + 1}`,
        animationName,
        animationKey: `${PLAYER_ANIMATION_PREFIX}-${animationName}`,
        frameIndex,
        frameInAnimation,
        defaultSourceX: frameInAnimation * PLAYER_FRAME_SIZE,
        defaultSourceY: row * PLAYER_FRAME_SIZE
      };
    });
  });
}

export function getDefaultPlayerSpriteAdjustment(
  frame: PlayerSpriteFrameDefinition
): PlayerSpriteFrameAdjustment {
  return PLAYER_DEFAULT_SPRITE_ADJUSTMENTS[frame.key] ?? {
    sourceX: frame.defaultSourceX,
    sourceY: frame.defaultSourceY,
    offsetX: 0,
    offsetY: 0
  };
}

export function loadPlayerSpriteAdjustments(): PlayerSpriteAdjustmentMap {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  const raw = localStorage.getItem(PLAYER_SPRITE_ADJUSTMENTS_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as PlayerSpriteAdjustmentMap;
  } catch {
    return {};
  }
}

export function savePlayerSpriteAdjustments(adjustments: PlayerSpriteAdjustmentMap): void {
  localStorage.setItem(PLAYER_SPRITE_ADJUSTMENTS_STORAGE_KEY, JSON.stringify(adjustments, null, 2));
}

export function clearPlayerSpriteAdjustments(): void {
  localStorage.removeItem(PLAYER_SPRITE_ADJUSTMENTS_STORAGE_KEY);
}

export function applyPlayerSpriteFrameAdjustment(
  scene: Phaser.Scene,
  frameDefinition: PlayerSpriteFrameDefinition,
  adjustment: PlayerSpriteFrameAdjustment
): void {
  const frame = scene.textures.getFrame(PLAYER_SPRITE_KEY, frameDefinition.frameIndex);
  if (!frame) {
    return;
  }

  frame.setCutPosition(adjustment.sourceX, adjustment.sourceY);
  frame.x = adjustment.offsetX;
  frame.y = adjustment.offsetY;
}

export function applyPlayerSpriteAdjustments(scene: Phaser.Scene): void {
  const adjustments = loadPlayerSpriteAdjustments();

  for (const frame of getPlayerSpriteFrameDefinitions()) {
    const adjustment = adjustments[frame.key] ?? getDefaultPlayerSpriteAdjustment(frame);
    applyPlayerSpriteFrameAdjustment(scene, frame, adjustment);
  }
}
