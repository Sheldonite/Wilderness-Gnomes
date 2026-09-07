import Phaser from 'phaser';
import url from '../../assets/sprites/frankie-buzzard-sheet.png';
import portrait from '../../assets/sprites/frankie-buzzard.png';

export const FRANKIE_SPRITE_KEY = 'companion-frankie';
export const FRANKIE_SPRITE_URL = url;
export const FRANKIE_PORTRAIT_URL = portrait;
export const FRANKIE_PORTRAIT_KEY = 'companion-frankie-portrait';
export const FRANKIE_FRAME_SIZE = 192;
export const FRANKIE_FRAMES_PER_ROW = 6;
export const FRANKIE_FLAP_KEY = 'frankie-flap';
export const FRANKIE_DIVE_KEY = 'frankie-dive';

export function createFrankieAnimations(scene: Phaser.Scene): void {
  if (!scene.anims.exists(FRANKIE_FLAP_KEY)) {
    scene.anims.create({
      key: FRANKIE_FLAP_KEY,
      frames: scene.anims.generateFrameNumbers(FRANKIE_SPRITE_KEY, { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1
    });
  }
  if (!scene.anims.exists(FRANKIE_DIVE_KEY)) {
    scene.anims.create({
      key: FRANKIE_DIVE_KEY,
      frames: scene.anims.generateFrameNumbers(FRANKIE_SPRITE_KEY, { start: 6, end: 9 }),
      frameRate: 12,
      repeat: -1
    });
  }
}
