import { SceneryNavigation, riverX, pathY, PONDS } from '../core/SceneryNavigation';
export { riverX, pathY } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { LOOK, reducedMotion } from '../config/presentation';
import type { Vector2Like } from '../core/types';
import { clampToArena, normalize } from '../utils/math';

const SIZE = GAME_CONFIG.arena.width;

export interface TreeTrunk {
  x: number;
  y: number;
  radius: number;
}

export interface TreeHit {
  point: Vector2Like;
  normal: Vector2Like;
  trunk: TreeTrunk;
}

export interface TreeCollider {
  readonly treeTrunks: readonly TreeTrunk[];
  hitTree(from: Vector2Like, to: Vector2Like, radius: number): TreeHit | undefined;
  resolveTreeBlock(from: Vector2Like, to: Vector2Like, radius: number): Vector2Like;
}

/**
 * Swept circle-vs-circle test against tree trunks along `from -> to`.
 * Returns the earliest contact moving into a trunk, or `undefined` if clear or moving away.
 */
export function hitTreeTrunk(
  trunks: readonly TreeTrunk[],
  from: Vector2Like,
  to: Vector2Like,
  radius: number
): TreeHit | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-9) return undefined;

  let bestT = Infinity;
  let bestTrunk: TreeTrunk | undefined;

  for (const trunk of trunks) {
    const reach = radius + trunk.radius;
    const fx = from.x - trunk.x;
    const fy = from.y - trunk.y;
    const b = fx * dx + fy * dy;
    // Moving away from or tangent to the trunk center cannot penetrate further.
    if (b >= 0) continue;

    const c = fx * fx + fy * fy - reach * reach;
    if (c < 0) {
      bestT = 0;
      bestTrunk = trunk;
      break;
    }

    const disc = b * b - lenSq * c;
    if (disc <= 0) continue;

    const t = (-b - Math.sqrt(disc)) / lenSq;
    if (t >= 0 && t <= 1 && t < bestT) {
      bestT = t;
      bestTrunk = trunk;
    }
  }

  if (!bestTrunk) return undefined;

  const point = clampToArena({ x: from.x + dx * bestT, y: from.y + dy * bestT }, radius);
  const rawNormal = normalize(point.x - bestTrunk.x, point.y - bestTrunk.y);
  const fallback = normalize(-dx, -dy);
  const normal = rawNormal.x === 0 && rawNormal.y === 0 ? fallback : rawNormal;
  return { point, normal, trunk: bestTrunk };
}

/**
 * Resolve movement from `from` to `to` against `trunks`, sliding tangentially on contact
 * and clamping to arena bounds.
 */
export function resolveTreeTrunkBlock(
  trunks: readonly TreeTrunk[],
  from: Vector2Like,
  to: Vector2Like,
  radius: number
): Vector2Like {
  let pos = clampToArena(to, radius);
  const hit = hitTreeTrunk(trunks, from, pos, radius);
  if (hit) {
    const remX = pos.x - hit.point.x;
    const remY = pos.y - hit.point.y;
    const inward = remX * hit.normal.x + remY * hit.normal.y;
    pos = inward < 0
      ? { x: pos.x - hit.normal.x * inward, y: pos.y - hit.normal.y * inward }
      : { ...hit.point };
  }

  for (const trunk of trunks) {
    const reach = radius + trunk.radius;
    const dx = pos.x - trunk.x;
    const dy = pos.y - trunk.y;
    const distSq = dx * dx + dy * dy;
    if (distSq >= reach * reach) continue;
    const n = distSq > 1e-9
      ? { x: dx / Math.sqrt(distSq), y: dy / Math.sqrt(distSq) }
      : normalize(from.x - trunk.x, from.y - trunk.y);
    const push = n.x === 0 && n.y === 0 ? { x: 1, y: 0 } : n;
    pos = { x: trunk.x + push.x * reach, y: trunk.y + push.y * reach };
  }

  return clampToArena(pos, radius);
}

export class ScenerySystem implements TreeCollider {
  private readonly random = new Phaser.Math.RandomDataGenerator(['storybook-golden-woodland-1']);
  private readonly trees: Phaser.GameObjects.Image[] = [];
  readonly treeTrunks: TreeTrunk[] = [];
  private readonly ripples: Phaser.GameObjects.Ellipse[] = [];
  // Scenery is decorative for normal crowds; bosses and stampedes query `treeTrunks` directly.
  readonly navigation = new SceneryNavigation(false, false);
  private elapsed = 0;
  private fadeClock = 0;
  constructor(private readonly scene: Phaser.Scene) {
    (this.navigation as { treeCollider?: TreeCollider }).treeCollider = this;
  }

  hitTree(from: Vector2Like, to: Vector2Like, radius: number): TreeHit | undefined {
    return hitTreeTrunk(this.treeTrunks, from, to, radius);
  }

  resolveTreeBlock(from: Vector2Like, to: Vector2Like, radius: number): Vector2Like {
    return resolveTreeTrunkBlock(this.treeTrunks, from, to, radius);
  }

  create(): void {
    this.scene.add.tileSprite(SIZE / 2, SIZE / 2, SIZE + LOOK.worldPadding * 2, SIZE + LOOK.worldPadding * 2, LOOK.texture.ground).setDepth(LOOK.depth.ground).setTint(0xc5d09e);
    this.createTerrain(); this.createPlanting(); this.createLight();
  }

  update(deltaMs: number, subjects: Vector2Like[]): void {
    this.elapsed += deltaMs; this.fadeClock += deltaMs;
    if (!reducedMotion()) this.ripples.forEach((r, i) => r.setAlpha(.12 + Math.sin(this.elapsed / 1800 + i) * .07).setScale(1 + Math.sin(this.elapsed / 2400 + i) * .12, 1));
    if (this.fadeClock < 100) return;
    this.fadeClock = 0;
    const view = this.scene.cameras.main.worldView;
    for (const tree of this.trees) {
      if (tree.x < view.left - 250 || tree.x > view.right + 250 || tree.y < view.top || tree.y > view.bottom + 360) continue;
      const obscures = subjects.some(p => Math.abs(p.x - tree.x) < tree.displayWidth * .4 && p.y < tree.y - 12 && p.y > tree.y - tree.displayHeight);
      tree.setAlpha(obscures ? .25 : 1);
    }
  }

  private createTerrain(): void {
    const key = 'storybook-routes';
    if (!this.scene.textures.exists(key)) {
      const tex = this.scene.textures.createCanvas(key, SIZE, SIZE)!;
      const c = tex.context;
      c.lineCap = 'round'; c.lineJoin = 'round';
      const line = (width: number, color: string | CanvasPattern, points: Vector2Like[]) => {
        c.strokeStyle = color; c.lineWidth = width; c.beginPath();
        points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
      };
      const trail = Array.from({ length: 161 }, (_, i) => ({ x: i * 20, y: pathY(i * 20) }));
      line(93, 'rgba(88,100,52,.13)', trail); line(80, 'rgba(141,141,82,.26)', trail);
      line(69, '#b5ab77', trail); line(60, '#c4b888', trail); line(49, 'rgba(221,205,154,.32)', trail);
      const paintRandom = new Phaser.Math.RandomDataGenerator(['storybook-ground-paint']);
      for (let i = 0; i < 1400; i++) {
        const x = paintRandom.between(0, SIZE), y = pathY(x) + paintRandom.realInRange(-37, 37);
        c.fillStyle = paintRandom.pick(['#a39c71', '#ded0a0', '#b5ad7f']); c.globalAlpha = .27;
        c.beginPath(); c.ellipse(x, y, paintRandom.realInRange(1, 5), 1.2, -.25, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
      const river = Array.from({ length: 161 }, (_, i) => ({ x: riverX(i * 20) + Math.sin(i * .83) * 3, y: i * 20 }));
      line(146, 'rgba(55,81,51,.14)', river); line(133, '#84916a', river); line(122, '#b9b890', river);
      const waterPattern = c.createPattern(this.scene.textures.get('storybook-water').getSourceImage() as HTMLCanvasElement, 'repeat')!;
      line(110, waterPattern, river);
      for (const pond of PONDS) for (const [pad, color] of [[17, '#829263'], [9, '#b5b58c'], [0, '#669487'], [-13, '#80ad98']] as const) {
        c.fillStyle = pad <= 0 ? waterPattern : color; c.beginPath(); c.ellipse(pond.x, pond.y, pond.rx + pad, pond.ry + pad, -.2, 0, Math.PI * 2); c.fill();
      }
      let bridgeX = 2410;
      for (let i = 0; i < 8; i++) bridgeX = riverX(pathY(bridgeX));
      c.save(); c.translate(bridgeX, pathY(bridgeX)); c.rotate(Math.atan(Math.cos(bridgeX / 540) * 125 / 540));
      c.fillStyle = 'rgba(37,54,36,.2)'; c.fillRect(-94, -35, 190, 82);
      const bridgeFrame = this.scene.textures.getFrame('storybook-bridge', 'timber');
      c.drawImage(this.scene.textures.get('storybook-bridge').getSourceImage() as HTMLCanvasElement, bridgeFrame.cutX, bridgeFrame.cutY, bridgeFrame.cutWidth, bridgeFrame.cutHeight, -105, -49, 210, 98);
      c.restore(); c.strokeStyle = 'rgba(47,71,39,.38)'; c.lineWidth = 20; c.strokeRect(0, 0, SIZE, SIZE);
      tex.refresh();
    }
    this.scene.add.image(0, 0, key).setOrigin(0).setDepth(LOOK.depth.terrain);
    for (let i = 0; i < 28; i++) {
      const y = 100 + i * 108;
      const r = this.scene.add.ellipse(riverX(y) + Math.sin(i * 7) * 25, y, 20 + i % 4 * 7, 3);
      r.setStrokeStyle(1, 0xf3e8bb, .5).setDepth(-30).setAlpha(.17); this.ripples.push(r);
    }
    PONDS.forEach(p => { for (let i = 0; i < 3; i++) {
      const r = this.scene.add.ellipse(p.x - 25 + i * 18, p.y + i * 18, 40 + i * 25, 10 + i * 4);
      r.setStrokeStyle(1, 0xe0efcf, .55).setDepth(-30); this.ripples.push(r);
    } });
  }

  private isDryClearPoint(x: number, y: number, treeSpacing = 145): boolean {
    if (x < 65 || x > SIZE - 65 || y < 90 || y > SIZE - 45) return false;
    if (Math.abs(x - riverX(y)) < 145 || Math.abs(y - pathY(x)) < 95) return false;
    if (PONDS.some(p => Math.pow((x - p.x) / (p.rx + 100), 2) + Math.pow((y - p.y) / (p.ry + 100), 2) < 1)) return false;
    if (this.trees.some(t => Math.hypot(t.x - x, t.y - y) < treeSpacing)) return false;
    return true;
  }

  private openPoint(clearance: number): Vector2Like | undefined {
    for (let tries = 0; tries < 150; tries++) {
      const x = this.random.between(65, SIZE - 65), y = this.random.between(90, SIZE - 45);
      if (Math.hypot(x - 1600, y - 1600) < clearance) continue;
      if (!this.isDryClearPoint(x, y, 145)) continue;
      return { x, y };
    }
    return undefined;
  }

  private prop(frame: string, x: number, y: number, height: number, depth: number): Phaser.GameObjects.Image {
    const sprite = this.scene.add.image(x, y, LOOK.texture.props, frame).setOrigin(.5, 1).setDepth(depth);
    sprite.setScale(height / sprite.height).setFlipX(this.random.frac() > .5);
    if (['oak', 'birch', 'fir'].includes(frame)) {
      const trunkRadius = height * .095;
      this.treeTrunks.push({ x, y: y - 9, radius: trunkRadius });
      this.navigation.addCircle(x, y - 9, trunkRadius);
    }
    if (frame === 'rock') this.navigation.addCircle(x, y - height * .28, Math.min(sprite.displayWidth * .4, height * .5));
    return sprite;
  }

  private plantTree(frame: string, x: number, y: number, height: number): void {
    this.scene.add.image(x + 15, y - 2, LOOK.texture.shadow).setDisplaySize(height * .75, height * .22).setDepth(LOOK.depth.shadow).setAlpha(.65);
    this.trees.push(this.prop(frame, x, y, height, LOOK.depth.canopy));
    for (let j = 0; j < 3; j++) {
      this.prop(j === 0 ? 'mushroom' : 'fern', x + this.random.between(-85, 85), y + this.random.between(-10, 40), this.random.between(27, 52), LOOK.depth.flowers);
    }
  }

  /**
   * Ensure at least `targetCount` sturdy tree trunks sit inside a boss arena ring
   * so bosses like Wonky and King Rumbles always have solid trees to crash into.
   */
  ensureArenaTrees(center: Vector2Like, arenaRadius = 520, targetCount = 3, avoid: Vector2Like[] = []): number {
    const minDist = 135;
    const maxDist = Math.max(minDist + 40, arenaRadius - 95);
    let existing = 0;
    for (const trunk of this.treeTrunks) {
      const d = Math.hypot(trunk.x - center.x, trunk.y - center.y);
      if (d >= minDist && d <= maxDist) existing++;
    }
    let added = 0;
    const needed = Math.max(0, targetCount - existing);
    for (let i = 0; i < needed; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 36; attempt++) {
        const angle = ((i + attempt * 0.37) / Math.max(1, needed)) * Math.PI * 2 + this.random.realInRange(-0.4, 0.4);
        const dist = this.random.realInRange(180, Math.max(200, maxDist - 15));
        const x = center.x + Math.cos(angle) * dist;
        const y = center.y + Math.sin(angle) * dist;
        if (!this.isDryClearPoint(x, y, 150)) continue;
        if (avoid.some(p => Math.hypot(p.x - x, p.y - y) < 115)) continue;
        this.plantTree(this.random.pick(['oak', 'birch']), x, y, this.random.between(235, 305));
        added++;
        placed = true;
        break;
      }
      if (!placed) {
        // Fallback: relax river/path checks slightly while keeping ponds, bounds, and actors clear.
        for (let attempt = 0; attempt < 24; attempt++) {
          const angle = (i + attempt * 0.45) * Math.PI * 2 / Math.max(1, needed);
          const dist = this.random.realInRange(180, Math.max(200, maxDist - 15));
          const x = center.x + Math.cos(angle) * dist;
          const y = center.y + Math.sin(angle) * dist;
          if (x < 65 || x > SIZE - 65 || y < 90 || y > SIZE - 45) continue;
          if (PONDS.some(p => Math.pow((x - p.x) / (p.rx + 85), 2) + Math.pow((y - p.y) / (p.ry + 85), 2) < 1)) continue;
          if (this.trees.some(t => Math.hypot(t.x - x, t.y - y) < 140)) continue;
          if (avoid.some(p => Math.hypot(p.x - x, p.y - y) < 110)) continue;
          this.plantTree(this.random.pick(['oak', 'birch']), x, y, this.random.between(235, 305));
          added++;
          break;
        }
      }
    }
    return added;
  }

  private createPlanting(): void {
    // Plant 5 sturdy oak/birch trees in the 200-420px ring around center so Wonky & stampedes meet real cover.
    const innerTargets = 5;
    for (let i = 0; i < innerTargets; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const angle = (i / innerTargets) * Math.PI * 2 + this.random.realInRange(-0.35, 0.35);
        const dist = this.random.realInRange(205, 415);
        const x = 1600 + Math.cos(angle) * dist;
        const y = 1600 + Math.sin(angle) * dist;
        if (!this.isDryClearPoint(x, y, 165)) continue;
        this.plantTree(i % 2 === 0 ? 'oak' : 'birch', x, y, this.random.between(240, 320));
        break;
      }
    }
    const remainingCanopies = Math.max(0, LOOK.limit.canopies - this.trees.length);
    for (let i = 0; i < remainingCanopies; i++) {
      const point = this.openPoint(370); if (!point) continue;
      this.plantTree(this.random.pick(['oak', 'birch', 'fir']), point.x, point.y, this.random.between(205, 330));
    }
    for (let i = 0; i < 55; i++) {
      const point = this.openPoint(300); if (point) this.prop('rock', point.x, point.y, this.random.between(38, 75), -5);
    }
    for (let i = 0; i < 85; i++) {
      const x = this.random.between(50, SIZE - 50), y = pathY(x) + this.random.pick([-1, 1]) * this.random.between(65, 110);
      if (Math.abs(x - riverX(y)) > 150) this.prop(i % 4 ? 'fern' : 'mushroom', x, y, this.random.between(19, 38), LOOK.depth.flowers);
    }
    for (let i = 0; i < 65; i++) {
      const y = 35 + i * 49, side = i % 2 ? 1 : -1;
      if (Math.abs(y - pathY(riverX(y))) < 88) continue;
      this.prop(i % 5 === 0 ? 'rock' : 'fern', riverX(y) + side * this.random.between(61, 94), y, this.random.between(20, 43), LOOK.depth.flowers);
    }
    for (const pond of PONDS) for (let i = 0; i < 14; i++) {
      const angle = i / 14 * Math.PI * 2;
      this.prop(i % 4 === 0 ? 'rock' : 'fern', pond.x + Math.cos(angle) * (pond.rx + 8), pond.y + Math.sin(angle) * (pond.ry + 8), this.random.between(23, 44), LOOK.depth.flowers);
    }
    for (let x = 70; x < SIZE; x += 170) {
      this.prop('fern', x, 55, 55, LOOK.depth.flowers); this.prop('fern', x, SIZE, 60, LOOK.depth.flowers);
      this.prop('fern', 25, x, 55, LOOK.depth.flowers); this.prop('fern', SIZE - 25, x, 55, LOOK.depth.flowers);
    }
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
