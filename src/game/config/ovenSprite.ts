import type Phaser from 'phaser';
export { default as ovenSourceUrl } from '../../assets/sprites/taco-toaster-source.png';
export const OVEN_TEXTURE = 'taco-toaster';

export function createOvenFrames(scene: Phaser.Scene): void {
  const texture = scene.textures.get(OVEN_TEXTURE);
  const source = texture.getSourceImage() as HTMLImageElement;
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height).data;
  const w = Math.floor(source.width / 4), h = Math.floor(source.height / 2);
  for (const i of [0, 1, 2, 3, 4, 5, 7]) {
    const x0 = (i % 4) * w, y0 = Math.floor(i / 4) * h;
    let left = x0 + w, right = x0, top = y0 + h, bottom = y0;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (pixels[(y * source.width + x) * 4 + 3] > 80) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const width = right - left + 1, height = bottom - top + 1;
    // Anchor oven poses on the boots, so wide mitts/flames cannot shift the body.
    let bootLeft = right, bootRight = left;
    for (let y = bottom - Math.floor(height * .18); y <= bottom; y++) for (let x = left; x <= right; x++) {
      if (pixels[(y * source.width + x) * 4 + 3] > 80) { bootLeft = Math.min(bootLeft, x); bootRight = Math.max(bootRight, x); }
    }
    const offsetX = i === 7 ? Math.round((w - width) / 2) : Math.round(w / 2 - ((bootLeft + bootRight) / 2 - left));
    const frame = texture.add(i, 0, left, top, width, height)!;
    frame.setTrim(w, h, offsetX, h - height, width, height);
  }
  scene.anims.create({ key: 'oven-walk', frames: [0, 1, 2, 3].map(frame => ({ key: OVEN_TEXTURE, frame })), frameRate: 7, repeat: -1 });
}
