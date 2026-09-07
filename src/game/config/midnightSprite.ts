import Phaser from 'phaser';
import sourceUrl from '../../assets/sprites/midnight-spritesheet-source.png';

export const MIDNIGHT_SPRITE_KEY = 'companion-midnight';
export const MIDNIGHT_SOURCE_KEY = 'midnight-atlas-source';
export const MIDNIGHT_SOURCE_URL = sourceUrl;
export const MIDNIGHT_DIRECTIONS = ['down', 'right', 'up', 'left'] as const;

/** Register the generated atlas with stable foot anchors and unchanged source pixels. */
export function createMidnightAnimations(scene: Phaser.Scene): void {
  const source = scene.textures.get(MIDNIGHT_SOURCE_KEY).getSourceImage() as HTMLImageElement;
  const texture = scene.textures.createCanvas(MIDNIGHT_SPRITE_KEY, source.width, source.height)!;
  const cellW = Math.floor(source.width / 4), cellH = Math.floor(source.height / 8);
  const ctx = texture.context;
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, source.width, source.height);
  const pixels = data.data;
  // The generated source uses a magenta matte, decoded once just like the woodland prop atlas.
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const matte = Math.min(r, b) - g;
    if (matte > 10 && r > g + 10 && b > g + 10) {
      pixels[i + 3] = Math.min(pixels[i + 3], Math.round(255 * Math.max(0, 1 - (matte - 10) / 55)));
      pixels[i] = Math.min(r, g + 15); pixels[i + 2] = Math.min(b, g + 5);
    }
  }
  ctx.putImageData(data, 0, 0);
  // Generated rows have generous but slightly unequal gutters; locate their actual occupied bands.
  const bands: [number, number][] = [];
  let bandStart = -1;
  for (let y = 0; y <= source.height; y++) {
    let occupied = 0;
    if (y < source.height) for (let x = 0; x < source.width; x++) if (pixels[(y * source.width + x) * 4 + 3] > 64) occupied++;
    if (occupied >= 4 && bandStart < 0) bandStart = y;
    if (occupied < 4 && bandStart >= 0) {
      if (y - bandStart > 10) bands.push([Math.max(0, bandStart - 2), Math.min(source.height - 1, y + 1)]);
      bandStart = -1;
    }
  }
  if (bands.length !== 8) throw new Error(`Midnight atlas needs 8 isolated animation rows; found ${bands.length}`);
  for (let row = 0; row < 8; row++) {
    const action = row < 4 ? 'walk' : 'swat';
    const direction = MIDNIGHT_DIRECTIONS[row % 4];
    const frames: { key: string; frame: string }[] = [];
    const [rowTop, rowBottom] = bands[row];
    const columns: [number, number][] = [];
    let startX = -1, lastX = -1;
    for (let x = 0; x <= source.width + 4; x++) {
      let count = 0;
      if (x < source.width) for (let y = rowTop; y <= rowBottom; y++) if (pixels[(y * source.width + x) * 4 + 3] > 64) count++;
      if (count >= 2) { if (startX < 0) startX = x; lastX = x; }
      if (startX >= 0 && x - lastX > 4) {
        if (lastX - startX > 12) columns.push([Math.max(0, startX - 2), Math.min(source.width - 1, lastX + 2)]);
        startX = -1;
      }
    }
    if (columns.length !== 4) throw new Error(`Midnight ${action}-${direction} needs 4 isolated frames; found ${columns.length}`);
    for (let col = 0; col < 4; col++) {
      const [x0, x1] = columns[col], [y0, y1] = bands[row];
      let left = x1, top = y1, right = x0, bottom = y0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (pixels[(y * source.width + x) * 4 + 3] > 32) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      if (left > right || top > bottom) throw new Error(`Midnight sprite cell ${row},${col} is empty`);
      let footLeft = right, footRight = left;
      for (let y = Math.max(top, bottom - Math.round((bottom - top) * .12)); y <= bottom; y++) for (let x = left; x <= right; x++) {
        if (pixels[(y * source.width + x) * 4 + 3] > 64) { footLeft = Math.min(footLeft, x); footRight = Math.max(footRight, x); }
      }
      const width = right - left + 1, height = bottom - top + 1;
      const name = `${action}-${direction}-${col}`;
      const frame = texture.has(name) ? texture.get(name) : texture.add(name, 0, left, top, width, height)!;
      frame.setTrim(cellW, cellH, Math.round(cellW / 2 - ((footLeft + footRight) / 2 - left)), Math.round(cellH * .9) - height, width, height);
      frames.push({ key: MIDNIGHT_SPRITE_KEY, frame: name });
    }
    const key = `midnight-${action}-${direction}`;
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames, frameRate: action === 'walk' ? 8 : 1000 / 120, repeat: action === 'walk' ? -1 : 0 });
  }
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  texture.refresh();
}

export function midnightScale(scene: Phaser.Scene): number {
  const texture = scene.textures.get(MIDNIGHT_SPRITE_KEY);
  const heights = MIDNIGHT_DIRECTIONS.flatMap(direction => [0, 1, 2, 3].map(i => texture.get(`walk-${direction}-${i}`).cutHeight)).sort((a, b) => a - b);
  return 38 / heights[Math.floor(heights.length / 2)];
}
