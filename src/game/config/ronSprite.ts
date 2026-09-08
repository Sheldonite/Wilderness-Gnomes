import Phaser from 'phaser';
import { RON_DIRECTIONS, RON_FRAMES_PER_DIRECTION } from '../core/RonFrames';
export { RON_FRAME_WIDTH, RON_FRAME_HEIGHT } from '../core/RonFrames';
export const RON_SPRITE_KEY = 'player-ron';
export const RON_REFERENCE_TEXTURE = 'ron-reference';
export function createRonAnimations(scene: Phaser.Scene): void {
  for (const [row, direction] of RON_DIRECTIONS.entries()) {
    for (const kind of ['idle', 'walk'] as const) {
      const key = `ron-${kind}-${direction}`;
      if (scene.anims.exists(key)) continue;
      const start = row * RON_FRAMES_PER_DIRECTION;
      const frames = scene.anims.generateFrameNumbers(RON_SPRITE_KEY, {
        start: start + (kind === 'idle' ? 0 : 4), end: start + (kind === 'idle' ? 3 : 11)
      });
      if (kind === 'idle') frames.forEach((frame, i) => { frame.duration = [1000, 600, 100, 600][i]; });
      scene.anims.create({ key, frames, frameRate: 10, repeat: -1 });
    }
  }
}
