import type { Vector2Like } from './types';

export const riverX = (y: number): number => 2410 + Math.sin(y / 380) * 110 + Math.sin(y / 820) * 60;
export const pathY = (x: number): number => 1410 + Math.sin(x / 540) * 125;
export const PONDS = [{ x: 720, y: 2460, rx: 160, ry: 108 }, { x: 980, y: 550, rx: 115, ry: 76 }];
let bridgeX = 2410;
for (let i = 0; i < 8; i++) bridgeX = riverX(pathY(bridgeX));
const bridgeY = pathY(bridgeX), bridgeAngle = Math.atan(Math.cos(bridgeX / 540) * 125 / 540);
const CELL = 32, SIZE = 3200, COUNT = SIZE / CELL;
const bridgeCos = Math.cos(bridgeAngle), bridgeSin = Math.sin(bridgeAngle);
const pondCos = Math.cos(.2), pondSin = Math.sin(.2);
const cellPoint = (i: number) => ({ x: (i % COUNT + .5) * CELL, y: (Math.floor(i / COUNT) + .5) * CELL });
let routeSeed = 0;
export interface NavigationRoute {
  retryFrames: number; budget: number; generation: number; radius: number; direct: boolean;
  goal: Vector2Like; waypoint: Vector2Like; seed: number;
}
export const createNavigationRoute = (): NavigationRoute => ({ retryFrames: 0, budget: 0, generation: -1, radius: 0, direct: false,
  goal: { x: 0, y: 0 }, waypoint: { x: 0, y: 0 }, seed: routeSeed++ % 24 });
const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Static footprints and shared destination fields. Recreated with each arena. */
export class SceneryNavigation {
  private generation = 0;
  private solids = new Map<number, { x: number; y: number; radius: number }[]>();
  private grids = new Map<number, Uint8Array>();
  private edges = new Map<number, Uint8Array>();
  private fields = new Map<string, Int16Array>();
  constructor(private readonly water = true, private readonly sceneryCollision = true) {}

  private clamp(p: Vector2Like, radius: number): Vector2Like {
    return { x: Math.max(radius, Math.min(SIZE - radius, p.x)), y: Math.max(radius, Math.min(SIZE - radius, p.y)) };
  }

  addCircle(x: number, y: number, radius: number): void {
    if (!this.sceneryCollision) return;
    const solid = { x, y, radius };
    for (let bx = Math.floor((x - radius - 32) / 128); bx <= Math.floor((x + radius + 32) / 128); bx++)
      for (let by = Math.floor((y - radius - 32) / 128); by <= Math.floor((y + radius + 32) / 128); by++) {
        const key = bx + by * 32, bucket = this.solids.get(key) ?? [];
        bucket.push(solid); this.solids.set(key, bucket);
      }
    this.grids.clear(); this.edges.clear(); this.fields.clear(); this.generation++;
  }

  blocked(p: Vector2Like, radius: number): boolean {
    if (p.x < radius || p.y < radius || p.x > SIZE - radius || p.y > SIZE - radius) return true;
    if (!this.sceneryCollision) return false;
    if (this.water) {
      if (p.x > 2180 - radius && p.x < 2640 + radius) {
        const dx = p.x - bridgeX, dy = p.y - bridgeY;
        const along = dx * bridgeCos + dy * bridgeSin;
        const across = -dx * bridgeSin + dy * bridgeCos;
        const onBridge = Math.abs(along) <= 110 && Math.abs(across) <= 43 - radius;
        if (!onBridge && Math.abs(p.x - riverX(p.y)) < 58 + radius) return true;
      }
      for (const pond of PONDS) {
        if (Math.abs(p.x - pond.x) > pond.rx + radius + 24 || Math.abs(p.y - pond.y) > pond.ry + radius + 24) continue;
        const x = (p.x - pond.x) * pondCos - (p.y - pond.y) * pondSin;
        const y = (p.x - pond.x) * pondSin + (p.y - pond.y) * pondCos;
        if ((x / (pond.rx + radius)) ** 2 + (y / (pond.ry + radius)) ** 2 < 1) return true;
      }
    }
    return (this.solids.get(Math.floor(p.x / 128) + Math.floor(p.y / 128) * 32) ?? [])
      .some(s => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < (radius + s.radius) ** 2);
  }

  clear(a: Vector2Like, b: Vector2Like, radius: number): boolean {
    if (!this.sceneryCollision) return !this.blocked(a, radius) && !this.blocked(b, radius);
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
    for (let i = 0; i <= n; i++) if (this.blocked({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }, radius)) return false;
    return true;
  }

  nearest(p: Vector2Like, radius: number): Vector2Like {
    if (!this.sceneryCollision) return this.clamp(p, radius);
    if (!this.blocked(p, radius)) return p;
    for (let ring = 8; ring <= SIZE; ring += 8) for (let i = 0; i < 32; i++) {
      const q = { x: p.x + Math.cos(i * Math.PI / 16) * ring, y: p.y + Math.sin(i * Math.PI / 16) * ring };
      if (!this.blocked(q, radius)) return q;
    }
    return { x: 1600, y: 1600 };
  }

  /** Swept small steps prevent tunnelling and slide keyboard movement along edges. */
  move(from: Vector2Like, to: Vector2Like, radius: number): Vector2Like {
    if (!this.sceneryCollision) return this.clamp(to, radius);
    let p = { ...this.nearest(from, radius) };
    const n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 5));
    const dx = (to.x - from.x) / n, dy = (to.y - from.y) / n;
    for (let i = 0; i < n; i++) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!this.blocked(q, radius)) p = q;
      else {
        if (!this.blocked({ x: p.x + dx, y: p.y }, radius)) p.x += dx;
        if (!this.blocked({ x: p.x, y: p.y + dy }, radius)) p.y += dy;
      }
    }
    return p;
  }

  /** Build immutable connectivity during arena setup, never on the first enemy detour. */
  prepare(radius: number): Uint8Array {
    const clearance = Math.ceil(radius / 4) * 4;
    let grid = this.grids.get(clearance);
    const point = cellPoint;
    if (!grid) {
      grid = new Uint8Array(COUNT * COUNT);
      for (let i = 0; i < grid.length; i++) grid[i] = Number(this.blocked(point(i), clearance));
      this.grids.set(clearance, grid);
      const edges = new Uint8Array(grid.length);
      for (let i = 0; i < grid.length; i++) if (!grid[i]) {
        for (let d = 0; d < steps.length; d++) {
          const [dx, dy] = steps[d], x = i % COUNT + dx, y = Math.floor(i / COUNT) + dy, next = y * COUNT + x;
          if (x >= 0 && y >= 0 && x < COUNT && y < COUNT && !grid[next] && (next < i ? Boolean(edges[next] & (1 << (d ^ 1))) : this.clear(point(i), point(next), clearance))) edges[i] |= 1 << d;
        }
      }
      this.edges.set(clearance, edges);
    }
    return grid;
  }

  toward(from: Vector2Like, target: Vector2Like, distance: number, radius: number, route?: NavigationRoute): Vector2Like {
    if (distance <= 0) return from;
    if (!this.sceneryCollision) {
      const dx = target.x - from.x, dy = target.y - from.y, length = Math.hypot(dx, dy);
      const step = length > 0 ? Math.min(1, distance / length) : 0;
      return this.clamp({ x: from.x + dx * step, y: from.y + dy * step }, radius);
    }
    if (route && route.retryFrames > 0 && route.generation === this.generation
      && Math.hypot(target.x - route.goal.x, target.y - route.goal.y) < 48) {
      route.retryFrames--; return from;
    }
    const waitForRoute = () => {
      if (route) { route.retryFrames = 8 + route.seed % 8; route.generation = this.generation; route.goal = { ...target }; route.budget = 0; }
      return from;
    };
    if (route && route.generation === this.generation && route.radius === radius && route.budget > 0
      && Math.hypot(target.x - route.goal.x, target.y - route.goal.y) < 48
      && (route.direct || Math.hypot(from.x - route.waypoint.x, from.y - route.waypoint.y) > 8)) {
      route.budget -= distance;
      return this.stepToward(from, route.direct ? target : route.waypoint, distance, radius, route);
    }
    const start = this.nearest(from, radius), goal = this.nearest(target, radius);
    let waypoint = goal;
    const direct = this.clear(start, goal, radius);
    if (!direct) {
      const clearance = Math.ceil(radius / 4) * 4;
      const grid = this.prepare(radius);
      const point = cellPoint;
      let end = -1, best = Infinity;
      const gx = Math.floor(goal.x / CELL), gy = Math.floor(goal.y / CELL);
      for (let y = Math.max(0, gy - 3); y <= Math.min(COUNT - 1, gy + 3); y++) for (let x = Math.max(0, gx - 3); x <= Math.min(COUNT - 1, gx + 3); x++) {
        const i = y * COUNT + x;
        if (grid[i]) continue;
        const p = point(i), d = (p.x - goal.x) ** 2 + (p.y - goal.y) ** 2;
        if (d < best && this.clear(p, goal, clearance)) { best = d; end = i; }
      }
      if (end < 0) return waitForRoute();
      const key = `${clearance}:${end}`;
      let field = this.fields.get(key);
      if (!field) {
        field = new Int16Array(grid.length).fill(-1);
        const queue = new Int32Array(grid.length); let head = 0, tail = 1; queue[0] = end; field[end] = 0;
        while (head < tail) {
          const current = queue[head++], x = current % COUNT, y = Math.floor(current / COUNT);
          for (let d = 0; d < steps.length; d++) {
            if (!(this.edges.get(clearance)![current] & (1 << d))) continue;
            const [dx, dy] = steps[d];
            const nx = x + dx, ny = y + dy, next = ny * COUNT + nx;
            if (nx < 0 || ny < 0 || nx >= COUNT || ny >= COUNT || grid[next] || field[next] >= 0) continue;
            field[next] = field[current] + 1; queue[tail++] = next;
          }
        }
        if (this.fields.size >= 16) this.fields.delete(this.fields.keys().next().value!);
        this.fields.set(key, field);
      }
      let score = Infinity, found = false;
      const cx = Math.floor(start.x / CELL), cy = Math.floor(start.y / CELL);
      for (let y = Math.max(0, cy - 2); y <= Math.min(COUNT - 1, cy + 2); y++) for (let x = Math.max(0, cx - 2); x <= Math.min(COUNT - 1, cx + 2); x++) {
        const i = y * COUNT + x, p = point(i), d = Math.hypot(p.x - start.x, p.y - start.y);
        const cost = field[i] * CELL + d * .9;
        if (field[i] >= 0 && cost < score && this.clear(start, p, radius)) { score = cost; waypoint = p; found = true; }
      }
      if (!found) return waitForRoute();
    }
    if (route) {
      route.retryFrames = 0; route.goal = { ...target }; route.waypoint = waypoint; route.direct = direct;
      route.radius = radius; route.generation = this.generation; route.budget = 32 + route.seed;
    }
    return this.stepToward(start, waypoint, distance, radius, route);
  }

  private stepToward(start: Vector2Like, waypoint: Vector2Like, distance: number, radius: number, route?: NavigationRoute): Vector2Like {
    const length = Math.hypot(waypoint.x - start.x, waypoint.y - start.y), scale = Math.min(1, distance / (length || 1));
    const intended = { x: start.x + (waypoint.x - start.x) * scale, y: start.y + (waypoint.y - start.y) * scale };
    const next = this.move(start, intended, radius);
    if (route && Math.hypot(next.x - intended.x, next.y - intended.y) > .01) route.budget = 0;
    return next;
  }
}
