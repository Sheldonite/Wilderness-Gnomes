import Phaser from 'phaser';
import { LOOK } from '../config/presentation';

/** Decode the generated atlas's magenta matte once, during asset loading. */
export function createStorybookTextures(scene: Phaser.Scene): void {
  const source = scene.textures.get('storybook-props-source').getSourceImage() as HTMLImageElement;
  const atlas = scene.textures.createCanvas(LOOK.texture.props, source.width, source.height)!;
  const ctx = atlas.context;
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, source.width, source.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
    const matte = Math.min(r, b) - g;
    if (matte > 10 && r > g + 10 && b > g + 10) {
      pixels.data[i + 3] = Math.round(255 * Math.max(0, 1 - (matte - 10) / 55));
      pixels.data[i] = Math.min(r, g + 15);
      pixels.data[i + 2] = Math.min(b, g + 5);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const names = ['oak', 'birch', 'fir', 'rock', 'fern', 'mushroom'];
  const cellW = source.width / 3, cellH = source.height / 2;
  names.forEach((name, index) => {
    const x0 = (index % 3) * cellW, y0 = Math.floor(index / 3) * cellH;
    let left = x0 + cellW, top = y0 + cellH, right = x0, bottom = y0;
    for (let y = y0; y < y0 + cellH; y++) for (let x = x0; x < x0 + cellW; x++) {
      if (pixels.data[(y * source.width + x) * 4 + 3] > 100) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    atlas.add(name, 0, left, top, right - left + 1, bottom - top + 1);
  });
  atlas.refresh();
  atlas.setFilter(Phaser.Textures.FilterMode.LINEAR);

  // Mirrored quadrants meet on identical edge pixels, removing tile seams.
  const ground = scene.textures.createCanvas(LOOK.texture.ground, 1024, 1024)!;
  const groundSource = scene.textures.get('storybook-ground-source').getSourceImage() as HTMLImageElement;
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    const c = ground.context;
    c.save(); c.translate(col ? 1024 : 0, row ? 1024 : 0); c.scale(col ? -1 : 1, row ? -1 : 1);
    c.drawImage(groundSource, 0, 0, 512, 512); c.restore();
  }
  ground.refresh();
  ground.setFilter(Phaser.Textures.FilterMode.LINEAR);

  const water = scene.textures.createCanvas('storybook-water', 512, 512)!;
  const waterSource = scene.textures.get('storybook-water-source').getSourceImage() as HTMLImageElement;
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    water.context.save(); water.context.translate(col ? 512 : 0, row ? 512 : 0); water.context.scale(col ? -1 : 1, row ? -1 : 1);
    water.context.drawImage(waterSource, 0, 0, 256, 256); water.context.restore();
  }
  water.refresh();
  const bridgeSource = scene.textures.get('storybook-bridge-source').getSourceImage() as HTMLImageElement;
  const bridge = scene.textures.createCanvas('storybook-bridge', bridgeSource.width, bridgeSource.height)!;
  bridge.context.drawImage(bridgeSource, 0, 0);
  const bridgePixels = bridge.context.getImageData(0, 0, bridgeSource.width, bridgeSource.height);
  let minX = bridgeSource.width, minY = bridgeSource.height, maxX = 0, maxY = 0;
  for (let y = 0; y < bridgeSource.height; y++) for (let x = 0; x < bridgeSource.width; x++) {
    const i = (y * bridgeSource.width + x) * 4, d = bridgePixels.data;
    // Remove residual chroma-key fringe while retaining the generated alpha.
    if ((d[i] > 190 && d[i + 1] < 55 && d[i + 2] < 70) || (Math.min(d[i], d[i + 2]) - d[i + 1] > 70)) d[i + 3] = 0;
    if (d[i + 3] > 100) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  bridge.context.putImageData(bridgePixels, 0, 0);
  bridge.add('timber', 0, minX, minY, maxX - minX + 1, maxY - minY + 1); bridge.refresh();

  const texture = (key: string, size: number, draw: (context: CanvasRenderingContext2D) => void) => {
    const canvas = scene.textures.createCanvas(key, size, size)!;
    draw(canvas.context); canvas.refresh();
  };
  texture(LOOK.texture.shadow, 96, (c) => {
    const glow = c.createRadialGradient(48, 48, 2, 48, 48, 46);
    glow.addColorStop(0, 'rgba(26,43,24,.5)'); glow.addColorStop(1, 'rgba(26,43,24,0)');
    c.fillStyle = glow; c.fillRect(0, 0, 96, 96);
  });
  texture(LOOK.texture.spark, 32, (c) => {
    const glow = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    glow.addColorStop(0, '#fffce1'); glow.addColorStop(.18, '#fff6bf'); glow.addColorStop(.5, 'rgba(255,222,140,.45)'); glow.addColorStop(1, 'rgba(255,222,140,0)');
    c.fillStyle = glow; c.fillRect(0, 0, 32, 32);
  });
  texture(LOOK.texture.bolt, 48, (c) => {
    c.shadowColor = '#7ee8ff'; c.shadowBlur = 8; c.fillStyle = '#8be9fa';
    c.beginPath(); c.moveTo(43, 24); c.quadraticCurveTo(28, 10, 4, 24); c.quadraticCurveTo(28, 38, 43, 24); c.fill();
    c.fillStyle = '#f1ffff'; c.beginPath(); c.ellipse(29, 24, 10, 3, 0, 0, Math.PI * 2); c.fill();
  });
  texture(LOOK.texture.crystal, 32, (c) => {
    c.shadowColor = '#94ffd1'; c.shadowBlur = 5; c.fillStyle = '#5aaf82'; c.strokeStyle = '#caffde'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(16, 4); c.lineTo(24, 16); c.lineTo(16, 28); c.lineTo(8, 16); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#caffdf'; c.beginPath(); c.moveTo(16, 5); c.lineTo(16, 25); c.lineTo(9, 16); c.closePath(); c.fill();
  });
}
