import type { Vector2Like } from './types';

export const WOODLAND_CHUNK_SIZE = 1024;
export const WOODLAND_CHUNK_MARGIN = 370;
export const WOODLAND_START = { x: 1600, y: 1600 } as const;

const PATH_SPACING = 1860;
const STREAM_SPACING = 2540;
const PATH_ORIGIN = 1410;
const STREAM_ORIGIN = 2410;
const STREAM_RADIUS = 55;
const POND_CELL_SIZE = 1280;
const TREE_CELL_SIZE = 190;

export interface WoodlandBounds { left: number; top: number; right: number; bottom: number }
export interface WoodlandRoute { index: number; phase: number }
export interface WoodlandPond extends Vector2Like { rx: number; ry: number; angle: number }
export interface WoodlandBridge extends Vector2Like { angle: number }
export type WoodlandPlantKind = 'oak' | 'birch' | 'fir' | 'rock' | 'fern' | 'mushroom';
export interface WoodlandPlant extends Vector2Like { kind: WoodlandPlantKind; height: number; flipped: boolean }

export interface WoodlandChunk {
  bounds: WoodlandBounds;
  paths: WoodlandRoute[];
  streams: WoodlandRoute[];
  ponds: WoodlandPond[];
  bridges: WoodlandBridge[];
  plants: WoodlandPlant[];
}

const START_PONDS: readonly WoodlandPond[] = [
  { x: 720, y: 2460, rx: 160, ry: 108, angle: -.2 },
  { x: 980, y: 550, rx: 115, ry: 76, angle: -.2 }
];
const TREE_KINDS = ['oak', 'birch', 'fir'] as const;

export function woodlandChunkWindow(view: WoodlandBounds, margin = WOODLAND_CHUNK_MARGIN): WoodlandBounds {
  return {
    left: Math.floor((view.left - margin) / WOODLAND_CHUNK_SIZE),
    top: Math.floor((view.top - margin) / WOODLAND_CHUNK_SIZE),
    right: Math.ceil((view.right + margin) / WOODLAND_CHUNK_SIZE) - 1,
    bottom: Math.ceil((view.bottom + margin) / WOODLAND_CHUNK_SIZE) - 1
  };
}

export function woodlandPathY(path: WoodlandRoute, x: number): number {
  return PATH_ORIGIN + path.index * PATH_SPACING + Math.sin(x / 540 + path.phase) * 125;
}

export function woodlandStreamX(stream: WoodlandRoute, y: number): number {
  return STREAM_ORIGIN + stream.index * STREAM_SPACING +
    Math.sin(y / 380 + stream.phase) * 110 + Math.sin(y / 820 - stream.phase) * 60;
}

function seedNumber(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return hash;
}

function nearBounds(point: Vector2Like, bounds: WoodlandBounds, margin: number): boolean {
  return point.x + margin >= bounds.left && point.x - margin <= bounds.right &&
    point.y + margin >= bounds.top && point.y - margin <= bounds.bottom;
}

function insidePond(pond: WoodlandPond, point: Vector2Like, clearance: number): boolean {
  const dx = point.x - pond.x, dy = point.y - pond.y;
  if (Math.abs(dx) > pond.rx + clearance + 12 || Math.abs(dy) > pond.rx + clearance + 12) return false;
  const cos = Math.cos(pond.angle), sin = Math.sin(pond.angle);
  return ((dx * cos + dy * sin) / (pond.rx + clearance)) ** 2 +
    ((dy * cos - dx * sin) / (pond.ry + clearance)) ** 2 < 1;
}

/** Coordinate-based generation. Visiting chunks in a different order produces the same woods. */
export class WoodlandTerrain {
  private readonly seed: number;

  constructor(seed = 'storybook-golden-woodland-1') {
    this.seed = seedNumber(seed);
  }

  random(x: number, y: number, salt: number): number {
    let hash = this.seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77) ^ Math.imul(salt, 0xc2b2ae3d);
    hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
    hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
  }

  chunk(column: number, row: number): WoodlandChunk {
    const left = column * WOODLAND_CHUNK_SIZE, top = row * WOODLAND_CHUNK_SIZE;
    const right = left + WOODLAND_CHUNK_SIZE, bottom = top + WOODLAND_CHUNK_SIZE;
    const bounds = { left, top, right, bottom };
    // Include the bridge's ends even where they extend farther than the bank or trail.
    const paths = this.routes(top, bottom, PATH_ORIGIN, PATH_SPACING, 205, 1);
    const streams = this.routes(left, right, STREAM_ORIGIN, STREAM_SPACING, 285, 2);
    const ponds = this.ponds(bounds);
    const bridges: WoodlandBridge[] = [];
    for (const path of paths) for (const stream of streams) {
      const bridge = this.bridge(path, stream);
      if (nearBounds(bridge, bounds, 114)) bridges.push(bridge);
    }

    const plants: WoodlandPlant[] = [];
    for (let y = Math.floor(top / TREE_CELL_SIZE); y < Math.ceil(bottom / TREE_CELL_SIZE); y++) {
      for (let x = Math.floor(left / TREE_CELL_SIZE); x < Math.ceil(right / TREE_CELL_SIZE); x++) {
        if (this.random(x, y, 3) > .51) continue;
        const tree = {
          x: (x + .22 + this.random(x, y, 4) * .56) * TREE_CELL_SIZE,
          y: (y + .22 + this.random(x, y, 5) * .56) * TREE_CELL_SIZE
        };
        if (tree.x < left || tree.x >= right || tree.y < top || tree.y >= bottom || this.nearStart(tree, 195)) continue;
        if (Math.abs(tree.y - woodlandPathY(this.nearestPath(tree.y), tree.x)) < 88 || this.isWater(tree, 39, ponds)) continue;
        const kind = TREE_KINDS[Math.floor(this.random(x, y, 6) * TREE_KINDS.length)];
        plants.push({ ...tree, kind, height: 208 + this.random(x, y, 7) * 102, flipped: this.random(x, y, 8) < .5 });
      }
    }
    for (let i = 0; i < 32; i++) {
      const salt = 20 + i * 5;
      const point = { x: left + this.random(column, row, salt) * WOODLAND_CHUNK_SIZE,
        y: top + this.random(column, row, salt + 1) * WOODLAND_CHUNK_SIZE };
      if (this.nearStart(point, 70) || this.isWater(point, 7, ponds)) continue;
      const roll = this.random(column, row, salt + 2);
      const kind = roll < .23 ? 'mushroom' : roll < .81 ? 'fern' : 'rock';
      plants.push({ ...point, kind, height: 22 + this.random(column, row, salt + 3) * (kind === 'rock' ? 45 : 31),
        flipped: this.random(column, row, salt + 4) < .5 });
    }

    return { bounds, paths, streams, ponds, bridges, plants };
  }

  /** Loot can avoid ponds and streams while the player crosses all scenery freely. */
  isWater(point: Vector2Like, radius = 0, nearbyPonds?: readonly WoodlandPond[]): boolean {
    const streamIndex = Math.round((point.x - STREAM_ORIGIN) / STREAM_SPACING);
    const stream = this.route(streamIndex, 2);
    if (Math.abs(point.x - woodlandStreamX(stream, point.y)) < STREAM_RADIUS + radius) {
      const bridge = this.bridge(this.nearestPath(point.y), stream);
      const dx = point.x - bridge.x, dy = point.y - bridge.y;
      const cos = Math.cos(bridge.angle), sin = Math.sin(bridge.angle);
      if (Math.abs(dx * cos + dy * sin) > 108 - radius || Math.abs(dy * cos - dx * sin) > 44 - radius) return true;
    }
    const ponds = nearbyPonds ?? this.ponds({ left: point.x - radius, right: point.x + radius,
      top: point.y - radius, bottom: point.y + radius });
    return ponds.some(pond => insidePond(pond, point, radius));
  }

  private nearStart(point: Vector2Like, distance: number): boolean {
    return (point.x - WOODLAND_START.x) ** 2 + (point.y - WOODLAND_START.y) ** 2 < distance ** 2;
  }

  private nearestPath(y: number): WoodlandRoute {
    return this.route(Math.round((y - PATH_ORIGIN) / PATH_SPACING), 1);
  }

  private route(index: number, salt: number): WoodlandRoute {
    return { index, phase: index === 0 ? 0 : this.random(index, 0, salt) * Math.PI * 2 };
  }

  private routes(min: number, max: number, origin: number, spacing: number, padding: number, salt: number): WoodlandRoute[] {
    const routes: WoodlandRoute[] = [];
    for (let index = Math.ceil((min - origin - padding) / spacing); index <= Math.floor((max - origin + padding) / spacing); index++) {
      routes.push(this.route(index, salt));
    }
    return routes;
  }

  private bridge(path: WoodlandRoute, stream: WoodlandRoute): WoodlandBridge {
    let x = STREAM_ORIGIN + stream.index * STREAM_SPACING;
    for (let i = 0; i < 7; i++) x = woodlandStreamX(stream, woodlandPathY(path, x));
    const y = woodlandPathY(path, x);
    const angle = Math.atan(Math.cos(x / 540 + path.phase) * 125 / 540);
    return { x, y, angle };
  }

  private ponds(bounds: WoodlandBounds): WoodlandPond[] {
    const ponds = START_PONDS.filter(pond => nearBounds(pond, bounds, pond.rx + 58));
    const margin = 220;
    for (let y = Math.floor((bounds.top - margin) / POND_CELL_SIZE); y <= Math.floor((bounds.bottom + margin) / POND_CELL_SIZE); y++) {
      for (let x = Math.floor((bounds.left - margin) / POND_CELL_SIZE); x <= Math.floor((bounds.right + margin) / POND_CELL_SIZE); x++) {
        if (this.random(x, y, 190) > .61) continue;
        const point = {
          x: (x + .21 + this.random(x, y, 191) * .58) * POND_CELL_SIZE,
          y: (y + .21 + this.random(x, y, 192) * .58) * POND_CELL_SIZE
        };
        const rx = 88 + this.random(x, y, 193) * 70;
        if (!nearBounds(point, bounds, rx + 58) || this.nearStart(point, rx + 140)) continue;
        if (Math.abs(point.y - woodlandPathY(this.nearestPath(point.y), point.x)) < rx + 60) continue;
        const stream = this.route(Math.round((point.x - STREAM_ORIGIN) / STREAM_SPACING), 2);
        if (Math.abs(point.x - woodlandStreamX(stream, point.y)) < rx + 86) continue;
        if (START_PONDS.some(pond => (pond.x - point.x) ** 2 + (pond.y - point.y) ** 2 < (pond.rx + rx + 64) ** 2)) continue;
        ponds.push({ ...point, rx, ry: rx * (.58 + this.random(x, y, 194) * .2), angle: this.random(x, y, 195) * .9 - .45 });
      }
    }
    return ponds;
  }
}
