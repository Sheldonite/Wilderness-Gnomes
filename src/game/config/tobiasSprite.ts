import Phaser from 'phaser';

/**
 * Tobias is drawn by `scripts/build_tobias_tuna.py`: 6 columns by 2 rows of 192px cells.
 * Row 0 (frames 0-5) is the cruising swim loop, row 1 (frames 6-11) the torpedo dart.
 * He always faces right in the sheet; the renderer flips him.
 */
export const TOBIAS_SPRITE_KEY = 'companion-tobias';
export const TOBIAS_FRAME_SIZE = 192;
export const TOBIAS_SWIM_KEY = 'tobias-swim';
export const TOBIAS_DART_KEY = 'tobias-dart';

export function createTobiasAnimations(scene: Phaser.Scene): void {
  if (!scene.anims.exists(TOBIAS_SWIM_KEY)) {
    scene.anims.create({
      key: TOBIAS_SWIM_KEY,
      frames: scene.anims.generateFrameNumbers(TOBIAS_SPRITE_KEY, { start: 0, end: 5 }),
      frameRate: 9,
      repeat: -1
    });
  }
  if (!scene.anims.exists(TOBIAS_DART_KEY)) {
    scene.anims.create({
      key: TOBIAS_DART_KEY,
      frames: scene.anims.generateFrameNumbers(TOBIAS_SPRITE_KEY, { start: 6, end: 9 }),
      frameRate: 16,
      repeat: -1
    });
  }
}
