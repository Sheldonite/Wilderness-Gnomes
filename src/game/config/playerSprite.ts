import Phaser from 'phaser';

/**
 * The Code Wizard sheet is generated from `code-wizard-main-alpha-large.png`.
 * The source art repeats one stride pose per direction, so the generator keeps
 * the painted body and staff, isolates the legs, and builds a real four-pose
 * walk cycle (stride, legs together, mirrored stride, legs together) with each
 * frame anchored on its feet inside a square cell. Frames need no per-frame
 * corrections at runtime; the adjustment API below is kept only for the
 * development sprite-sheet tuning menu.
 */
export const PLAYER_SPRITE_KEY = 'player-code-wizard';
export const PLAYER_ANIMATION_PREFIX = 'player';
export const PLAYER_FRAME_SIZE = 192;
export const PLAYER_FRAMES_PER_ROW = 4;
export const PLAYER_SPRITE_SHEET_WIDTH = 768;
export const PLAYER_SPRITE_SHEET_HEIGHT = 1536;
export const PLAYER_SPRITE_ADJUSTMENTS_STORAGE_KEY = 'wilderness-gnomes-player-sprite-adjustments-v2';

/** [animation name, sheet row, frame rate]. Walk rows are contact, pass, contact, pass poses. */
export const PLAYER_ANIMATION_ROWS = [
  ['idle-down', 0, 3],
  ['walk-down', 1, 8],
  ['walk-down-right', 2, 8],
  ['walk-right', 3, 8],
  ['walk-up-left', 4, 8],
  ['walk-up', 5, 8],
  ['walk-left', 6, 8],
  ['walk-down-left', 7, 8]
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
  return {
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

/** Only frames the developer has tuned in the debug menu are touched; the sheet is pre-aligned. */
export function applyPlayerSpriteAdjustments(scene: Phaser.Scene): void {
  const adjustments = loadPlayerSpriteAdjustments();

  for (const frame of getPlayerSpriteFrameDefinitions()) {
    const adjustment = adjustments[frame.key];
    if (adjustment) {
      applyPlayerSpriteFrameAdjustment(scene, frame, adjustment);
    }
  }
}
