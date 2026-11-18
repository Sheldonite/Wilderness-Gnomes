import type Phaser from 'phaser';
import { LOOK } from '../config/presentation';
import { SceneryNavigation } from '../core/SceneryNavigation';
import {
  WOODLAND_CHUNK_SIZE, WoodlandTerrain, woodlandChunkWindow, woodlandPathY, woodlandStreamX,
  type WoodlandBounds, type WoodlandChunk, type WoodlandPlant
} from '../core/WoodlandTerrain';
import type { Vector2Like } from '../core/types';

interface SceneryChunkView {
  objects: Phaser.GameObjects.Image[];
  trees: Phaser.GameObjects.Image[];
  textureKey?: string;
}

// Each painted feature canvas covers a full chunk at half resolution, with one quarter of the texture memory.
const TERRAIN_PAINT_SCALE = .5;
const ROUTE_SAMPLE = 24;

export class ScenerySystem {
  readonly navigation: SceneryNavigation;
  private readonly terrain: WoodlandTerrain;
  private readonly chunks = new Map<string, SceneryChunkView>();
  private loadedWindow?: WoodlandBounds;
  private fadeClock = 0;

  constructor(private readonly scene: Phaser.Scene, seed?: string) {
    this.terrain = new WoodlandTerrain(seed);
    this.navigation = new SceneryNavigation(false, false, true, (point, radius) => !this.terrain.isWater(point, radius));
  }

  create(): void {
    this.createLight();
    this.scene.events.once('shutdown', () => {
      for (const chunk of this.chunks.values()) this.unloadChunk(chunk);
      this.chunks.clear();
      this.loadedWindow = undefined;
    });
  }

  update(deltaMs: number, subjects: Vector2Like[]): void {
    const view = this.scene.cameras.main.worldView;
    if (view.right <= view.left || view.bottom <= view.top) return;
    this.syncChunks(woodlandChunkWindow(view));

    this.fadeClock += deltaMs;
    if (this.fadeClock < 100) return;
    this.fadeClock = 0;
    for (const chunk of this.chunks.values()) for (const tree of chunk.trees) {
      if (tree.x < view.left - 250 || tree.x > view.right + 250 || tree.y < view.top || tree.y > view.bottom + 360) continue;
      const obscures = subjects.some(p => Math.abs(p.x - tree.x) < tree.displayWidth * .4 &&
        p.y < tree.y - 12 && p.y > tree.y - tree.displayHeight);
      tree.setAlpha(obscures ? .25 : 1);
    }
  }

  private syncChunks(window: WoodlandBounds): void {
    const current = this.loadedWindow;
    if (current && current.left === window.left && current.right === window.right &&
      current.top === window.top && current.bottom === window.bottom) return;

    const retained = new Set<string>();
    for (let row = window.top; row <= window.bottom; row++) {
      for (let column = window.left; column <= window.right; column++) {
        const key = `${column}:${row}`;
        retained.add(key);
        if (!this.chunks.has(key)) this.chunks.set(key, this.loadChunk(column, row, key));
      }
    }
    for (const [key, chunk] of this.chunks) {
      if (retained.has(key)) continue;
      this.unloadChunk(chunk);
      this.chunks.delete(key);
    }
    this.loadedWindow = window;
  }

  private loadChunk(column: number, row: number, key: string): SceneryChunkView {
    const chunk = this.terrain.chunk(column, row);
    const { left, top } = chunk.bounds;
    const ground = this.scene.add.image(left, top, LOOK.texture.ground).setOrigin(0)
      .setDisplaySize(WOODLAND_CHUNK_SIZE, WOODLAND_CHUNK_SIZE).setTint(0xc5d09e).setDepth(LOOK.depth.ground);
    const view: SceneryChunkView = { objects: [ground], trees: [] };
    if (chunk.paths.length || chunk.streams.length || chunk.ponds.length) {
      const textureKey = `woodland-terrain:${key}`;
      if (this.paintTerrain(chunk, textureKey)) {
        view.textureKey = textureKey;
        view.objects.push(this.scene.add.image(left, top, textureKey).setOrigin(0).setDepth(LOOK.depth.terrain)
          .setDisplaySize(WOODLAND_CHUNK_SIZE, WOODLAND_CHUNK_SIZE));
      }
    }
    for (const plant of chunk.plants) this.placePlant(plant, view);
    return view;
  }

  private unloadChunk(chunk: SceneryChunkView): void {
    for (const object of chunk.objects) object.destroy();
    if (chunk.textureKey) this.scene.textures.remove(chunk.textureKey);
  }

  private placePlant(plant: WoodlandPlant, view: SceneryChunkView): void {
    const { kind, x, y, height, flipped } = plant;
    const isTree = kind === 'oak' || kind === 'fir' || kind === 'birch';
    const sprite = this.scene.add.image(x, y, LOOK.texture.props, kind).setOrigin(.5, 1).setFlipX(flipped);
    sprite.setDisplaySize(height * sprite.width / sprite.height, height);
    if (isTree) {
      sprite.setDepth(LOOK.depth.canopy);
      const shadow = this.scene.add.image(x + 15, y - 2, LOOK.texture.shadow)
        .setDisplaySize(height * .75, height * .22).setDepth(LOOK.depth.shadow).setAlpha(.65);
      view.objects.push(shadow);
      view.trees.push(sprite);
    } else {
      sprite.setDepth(kind === 'rock' ? -5 : LOOK.depth.flowers);
    }
    view.objects.push(sprite);
  }

  private paintTerrain(chunk: WoodlandChunk, key: string): boolean {
    const size = WOODLAND_CHUNK_SIZE * TERRAIN_PAINT_SCALE;
    const texture = this.scene.textures.createCanvas(key, size, size);
    if (!texture) return false;
    const { left, top, right, bottom } = chunk.bounds;
    const c = texture.context;
    c.save();
    c.scale(TERRAIN_PAINT_SCALE, TERRAIN_PAINT_SCALE);
    c.translate(-left, -top);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const water = c.createPattern(this.scene.textures.get('storybook-water').getSourceImage() as HTMLCanvasElement, 'repeat') ?? '#78a496';
    const line = (points: Vector2Like[], strokes: readonly (readonly [number, string | CanvasPattern])[]) => {
      c.beginPath();
      points.forEach((point, index) => index ? c.lineTo(point.x, point.y) : c.moveTo(point.x, point.y));
      for (const [width, color] of strokes) { c.lineWidth = width; c.strokeStyle = color; c.stroke(); }
    };
    const route = (start: number, end: number, point: (n: number) => Vector2Like): Vector2Like[] => {
      const points: Vector2Like[] = [];
      for (let n = Math.floor((start - 100) / ROUTE_SAMPLE) * ROUTE_SAMPLE; n <= end + 124; n += ROUTE_SAMPLE) points.push(point(n));
      return points;
    };

    for (const path of chunk.paths) {
      line(route(left, right, x => ({ x, y: woodlandPathY(path, x) })), [
        [93, 'rgba(88,100,52,.13)'], [80, 'rgba(141,141,82,.26)'], [69, '#b5ab77'], [60, '#c4b888'], [49, 'rgba(221,205,154,.32)']
      ]);
      for (let i = Math.floor((left - 8) / 9); i <= Math.ceil((right + 8) / 9); i++) {
        const x = i * 9, y = woodlandPathY(path, x) + (this.terrain.random(i, path.index, 200) - .5) * 76;
        c.fillStyle = i % 2 === 0 ? 'rgba(151,143,99,.36)' : 'rgba(227,214,167,.42)';
        c.beginPath(); c.ellipse(x, y, 1 + 4 * this.terrain.random(i, path.index, 201), 1.3, -.25, 0, Math.PI * 2); c.fill();
      }
    }
    for (const stream of chunk.streams) {
      line(route(top, bottom, y => ({ x: woodlandStreamX(stream, y), y })), [
        [146, 'rgba(55,81,51,.14)'], [133, '#84916a'], [122, '#b9b890'], [110, water]
      ]);
      c.strokeStyle = 'rgba(243,232,187,.35)';
      c.lineWidth = 1.4;
      for (let i = Math.floor((top - 4) / 78); i <= Math.ceil((bottom + 4) / 78); i++) {
        const y = i * 78, x = woodlandStreamX(stream, y) + (this.terrain.random(stream.index, i, 202) - .5) * 48;
        c.beginPath(); c.ellipse(x, y, 12 + 10 * this.terrain.random(stream.index, i, 203), 1.7, 0, 0, Math.PI * 2); c.stroke();
      }
    }
    for (const pond of chunk.ponds) {
      for (const [pad, color] of [[17, '#829263'], [9, '#b5b58c'], [0, water]] as const) {
        c.fillStyle = color; c.beginPath(); c.ellipse(pond.x, pond.y, pond.rx + pad, pond.ry + pad, pond.angle, 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = 'rgba(224,239,207,.34)'; c.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        c.beginPath(); c.ellipse(pond.x - 37 + i * 22, pond.y - 25 + i * 13, 14 + i * 3, 2 + i * .7, pond.angle, 0, Math.PI * 2); c.stroke();
      }
    }
    if (chunk.bridges.length) {
      const frame = this.scene.textures.getFrame('storybook-bridge', 'timber');
      const source = this.scene.textures.get('storybook-bridge').getSourceImage() as HTMLCanvasElement;
      for (const bridge of chunk.bridges) {
        c.save(); c.translate(bridge.x, bridge.y); c.rotate(bridge.angle);
        c.fillStyle = 'rgba(37,54,36,.2)'; c.fillRect(-94, -35, 190, 82);
        c.drawImage(source, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, -105, -49, 210, 98);
        c.restore();
      }
    }
    c.restore();
    texture.refresh();
    return true;
  }

  private createLight(): void {
    const rays = this.scene.add.graphics().setDepth(LOOK.depth.atmosphere).setScrollFactor(0);
    const draw = () => {
      rays.clear(); const { width, height } = this.scene.scale;
      for (let i = 0; i < 4; i++) {
        const x = width * (.46 + i * .19);
        rays.fillStyle(0xffefb7, .035).fillTriangle(x, -30, x - height * .65, height, x - height * .35 + 60, height);
      }
    };
    draw(); this.scene.scale.on('resize', draw);
    this.scene.events.once('shutdown', () => this.scene.scale.off('resize', draw));
  }
}
