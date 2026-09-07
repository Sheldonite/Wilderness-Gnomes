import Phaser from 'phaser';
import { SHELDON_DIRECTIONS, SHELDON_FRAME_WIDTH, SHELDON_FRAME_HEIGHT, SHELDON_FRAMES_PER_DIRECTION } from '../core/SheldonFrames';

export const SHELDON_TEXTURE = 'player-sheldon';
export const SHELDON_REFERENCE_TEXTURE = 'sheldon-approved';
export const SHELDON_REFERENCE_URL = new URL('../../assets/sprites/sheldon/approved.png', import.meta.url).href;
const atlasUrl = new URL('../../assets/sprites/sheldon/sheldon-atlas.png', import.meta.url).href;

export function preloadSheldon(scene: Phaser.Scene): void {
  scene.load.spritesheet(SHELDON_TEXTURE, atlasUrl, { frameWidth: SHELDON_FRAME_WIDTH, frameHeight: SHELDON_FRAME_HEIGHT });
  if (import.meta.env.DEV) scene.load.image(SHELDON_REFERENCE_TEXTURE, SHELDON_REFERENCE_URL);
}

export function createSheldonAnimations(scene: Phaser.Scene): void {
  scene.textures.get(SHELDON_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
  for (const [row, direction] of SHELDON_DIRECTIONS.entries()) {
    const start = row * SHELDON_FRAMES_PER_DIRECTION;
    for (const kind of ['idle', 'walk'] as const) {
      const key = `sheldon-${kind}-${direction}`;
      if (scene.anims.exists(key)) continue;
      const frames = scene.anims.generateFrameNumbers(SHELDON_TEXTURE, {
        start: start + (kind === 'idle' ? 0 : 4), end: start + (kind === 'idle' ? 3 : 11)
      });
      // A short blink between longer breathing poses avoids a rapid blink loop.
      if (kind === 'idle') frames.forEach((frame, index) => { frame.duration = [1000, 600, 100, 600][index]; });
      scene.anims.create({ key, frames, frameRate: 10, repeat: -1 });
    }
  }
}
