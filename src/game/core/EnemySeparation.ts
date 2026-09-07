import type { Vector2Like } from './types';

/** Compute crowd pressure from a stable snapshot, then collide once per actor. */
export class EnemySeparation {
  private readonly buckets = new Map<number, number[]>();
  private readonly pool: number[][] = [];
  private offsets = new Float64Array(0);
  solve(points: Vector2Like[], radius: number): Float64Array {
    for (const bucket of this.buckets.values()) { bucket.length = 0; this.pool.push(bucket); }
    this.buckets.clear();
    if (this.offsets.length < points.length * 2) this.offsets = new Float64Array(points.length * 2);
    this.offsets.fill(0);
    const cell = radius, stride = 256;
    points.forEach((p, i) => {
      const key = Math.floor(p.x / cell) + Math.floor(p.y / cell) * stride;
      let bucket = this.buckets.get(key);
      if (!bucket) { bucket = this.pool.pop() ?? []; this.buckets.set(key, bucket); }
      bucket.push(i);
    });
    for (let i = 0; i < points.length; i++) {
      const p = points[i], bx = Math.floor(p.x / cell), by = Math.floor(p.y / cell);
      for (let y = by - 1; y <= by + 1; y++) for (let x = bx - 1; x <= bx + 1; x++) {
        const bucket = this.buckets.get(x + y * stride); if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          const dx = p.x - points[j].x, dy = p.y - points[j].y, squared = dx * dx + dy * dy;
          if (squared <= 0 || squared > radius * radius) continue;
          const strength = .45 / Math.sqrt(squared), sx = dx * strength, sy = dy * strength;
          this.offsets[i * 2] += sx; this.offsets[i * 2 + 1] += sy;
          this.offsets[j * 2] -= sx; this.offsets[j * 2 + 1] -= sy;
        }
      }
    }
    return this.offsets;
  }
}
