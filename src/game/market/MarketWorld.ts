import Phaser from 'phaser';
import { makeMarketBoothArt } from './MarketBoothArt';
import { reducedMotion } from '../config/presentation';
import { MARKET_VENDORS, type MarketVendorId } from '../config/marketItems';

export type { MarketVendorId } from '../config/marketItems';
export interface MarketPoint { x: number; y: number }
export interface MarketVendor extends MarketPoint {
  id: MarketVendorId;
  name: string;
  keeper: string;
  title: string;
  interactionX: number;
  interactionY: number;
  color: number;
  portraitKey: string;
  portraitFrame: number;
}

type Rect = { x: number; y: number; width: number; height: number };
type PersonPalette = {
  coat: string; light: string; shade: string; skin: string; skinShade: string;
  hair: string; hat: 'cap' | 'bonnet' | 'pointed' | 'straw' | 'none';
  role?: MarketVendorId; beard?: boolean; basket?: boolean;
};
type Person = {
  sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse;
  path: MarketPoint[]; waypoint: number; pause: number; clock: number;
  speed: number; role?: MarketVendorId; facing: number; phase: number;
};

const WIDTH = 1536;
const HEIGHT = 1024;
const INK = '#34362c';
const CREAM = '#f2dfad';
const STALL_SCALE = 1.45;
const PERSON_FRAME_WIDTH = 96;
const PERSON_FRAME_HEIGHT = 128;
const SWATCHES: Record<MarketVendorId, [string, string, string]> = {
  forge: ['#c58a38', '#efd080', '#875727'],
  apothecary: ['#648768', '#b4d09a', '#405e4d'],
  outfitter: ['#597a9c', '#a6c5cc', '#3c506c'],
  curios: ['#8a608f', '#d2a6c3', '#594263']
};

/** Peaceful square scenery and inhabitants. All coordinates are world coordinates.
 * Sprite feet and counter fronts are depth sorted by y; the player should use the same convention.
 */
export class MarketWorld {
  readonly vendors: readonly MarketVendor[] = ([
    { id: 'forge', name: 'Hearth & Hammer', keeper: 'Bram', title: 'Blacksmith', x: 500, y: 655, interactionX: 500, interactionY: 730, color: 0xe3b967 },
    { id: 'apothecary', name: 'Wildflower Remedies', keeper: 'Clover', title: 'Upgrade Keeper', x: 1056, y: 655, interactionX: 1056, interactionY: 730, color: 0xa3cf98 },
    { id: 'outfitter', name: 'The Wandering Stitch', keeper: 'Mabel', title: 'Stylist', x: 472, y: 835, interactionX: 472, interactionY: 937, color: 0x9cbfdc },
    { id: 'curios', name: 'Moonlit Curios', keeper: 'Orin', title: 'Recruiter', x: 1066, y: 835, interactionX: 1066, interactionY: 937, color: 0xd6a6e5 }
  ] as Array<Omit<MarketVendor, 'portraitKey' | 'portraitFrame'>>).map(vendor => {
    const catalog = MARKET_VENDORS.find(item => item.id === vendor.id)!;
    return { ...vendor, name: catalog.name, keeper: catalog.keeper, portraitKey: `market-person-vendor-${vendor.id}`, portraitFrame: 12 };
  });
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly people: Person[] = [];
  private readonly obstacles: Rect[] = [
    { x: 455, y: 62, width: 655, height: 400 },
    { x: 645, y: 449, width: 265, height: 64 },
    ...this.vendors.map(v => ({ x: v.x - 108, y: v.y - 76, width: 216, height: 122 }))
  ];
  private atmosphere?: Phaser.GameObjects.Graphics;
  private flags?: Phaser.GameObjects.Graphics;
  private elapsed = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  create(): void {
    makeMarketBoothArt(this.scene);
    this.makePropTextures();
    const ground = this.scene.add.graphics().setDepth(1);
    this.objects.push(ground);
    for (const vendor of this.vendors) {
      // A quiet patch of worn flagstones, and a small woven welcome mat.
      ground.fillStyle(0x483b30, .19).fillEllipse(vendor.x + 3, vendor.y + 26, 253, 59);
      ground.fillStyle(0xa99470, .15).fillRoundedRect(vendor.x - 77, vendor.y + 51, 154, 50, 7);
      for (let r = 0; r < 3; r++) {
        ground.lineStyle(1, vendor.color, .18).strokeRect(vendor.x - 55 + r * 3, vendor.y + 60 + r * 3, 110 - r * 6, 31 - r * 6);
      }
      this.objects.push(this.scene.add.image(vendor.x, vendor.y + 38, `market-stall-${vendor.id}-back`)
        .setOrigin(.5, 1).setDisplaySize(160 * STALL_SCALE, 140 * STALL_SCALE).setDepth(vendor.y - 78));
      this.objects.push(this.scene.add.image(vendor.x, vendor.y + 38, `market-stall-${vendor.id}-front`)
        .setOrigin(.5, 1).setDisplaySize(160 * STALL_SCALE, 140 * STALL_SCALE).setDepth(vendor.y + 38));
      this.addVendor(vendor);
      this.addProp(vendor.x - 128, vendor.y + 20, vendor.id === 'forge' ? 'barrel' : 'flowers');
      this.addProp(vendor.x + 130, vendor.y + 27, vendor.id === 'curios' ? 'flowers' : 'crate');
    }
    this.addProp(286, 742, 'bench');
    this.addProp(1268, 742, 'bench');
    this.addVisitors();
    this.flags = this.scene.add.graphics().setDepth(1100);
    this.atmosphere = this.scene.add.graphics().setDepth(1300);
    this.objects.push(this.flags, this.atmosphere);
    this.drawAtmosphere(true);
  }

  update(deltaMs: number): void {
    const dt = Math.min(80, Math.max(0, deltaMs));
    this.elapsed += dt;
    const calm = reducedMotion();
    for (const person of this.people) {
      person.clock += dt;
      let walking = false;
      if (person.path.length && person.pause <= 0) {
        const target = person.path[person.waypoint];
        const dx = target.x - person.sprite.x;
        const dy = target.y - person.sprite.y;
        const distance = Math.hypot(dx, dy);
        const step = person.speed * dt / 1000;
        if (distance <= step + 1) {
          person.waypoint = (person.waypoint + 1) % person.path.length;
          person.pause = 1800 + (person.waypoint % 3) * 1350 + person.phase * 700;
          person.facing = 0;
        } else {
          const next = this.move(person.sprite, {
            x: person.sprite.x + dx / distance * step,
            y: person.sprite.y + dy / distance * step
          }, 13);
          person.sprite.setPosition(next.x, next.y);
          walking = Math.hypot(next.x - person.shadow.x, next.y - person.shadow.y) > .01;
          person.facing = Math.abs(dx) > Math.abs(dy) * 1.35 ? 2 : dy < 0 ? 1 : 0;
          person.sprite.setFlipX(person.facing === 2 && dx < 0);
        }
      } else {
        person.pause = Math.max(0, person.pause - dt);
      }
      if (walking) {
        const frame = Math.floor(person.clock / 145) % 4;
        person.sprite.setFrame(person.facing * 4 + frame);
      } else {
        // Each vendor has a different working cycle, separated by natural pauses.
        const cycleLength = person.role === 'forge' ? 2400 : person.role === 'apothecary' ? 4200 : person.role === 'outfitter' ? 3400 : 5200;
        const cycle = (person.clock + person.phase * 1700) % cycleLength;
        const frame = calm ? 0 : cycle < cycleLength * .52 ? 0 : Math.floor((cycle - cycleLength * .52) / (cycleLength * .12)) % 4;
        person.sprite.setFrame(12 + frame).setFlipX(false);
      }
      person.sprite.setDepth(person.role ? person.sprite.y - 9 : person.sprite.y);
      person.shadow.setPosition(person.sprite.x, person.sprite.y - 2);
    }
    this.drawAtmosphere(calm);
  }

  /** Circle against expanded solid rectangles, substepped with wall sliding. */
  move(from: MarketPoint, to: MarketPoint, radius = 18): MarketPoint {
    let current = this.nearestSafe(from, radius);
    const distance = Math.hypot(to.x - current.x, to.y - current.y);
    const count = Math.max(1, Math.ceil(distance / Math.max(6, radius * .5)));
    const dx = (to.x - current.x) / count;
    const dy = (to.y - current.y) / count;
    for (let i = 0; i < count; i++) {
      const nextX = Phaser.Math.Clamp(current.x + dx, 90 + radius, WIDTH - 90 - radius);
      if (!this.blocked({ x: nextX, y: current.y }, radius)) current.x = nextX;
      const nextY = Phaser.Math.Clamp(current.y + dy, 475 + radius, HEIGHT - 40 - radius);
      if (!this.blocked({ x: current.x, y: nextY }, radius)) current.y = nextY;
    }
    return current;
  }

  /** A short, collision-safe route for pointer movement and directory shortcuts. */
  findPath(from: MarketPoint, to: MarketPoint, radius = 18): MarketPoint[] {
    const start = this.nearestSafe(from, radius), goal = this.nearestSafe(to, radius);
    if (this.clearSegment(start, goal, radius)) return [goal];
    const spacing = 30, minX = 90 + radius, minY = 475 + radius;
    const columns = Math.floor((WIDTH - 180 - radius * 2) / spacing) + 1;
    const rows = Math.floor((HEIGHT - 515 - radius * 2) / spacing) + 1;
    const points = new Map<number, MarketPoint>();
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const p = { x: minX + col * spacing, y: minY + row * spacing };
      if (!this.blocked(p, radius)) points.set(row * columns + col, p);
    }
    const costs = new Map<number, number>(), previous = new Map<number, number>(), open = new Set<number>();
    const closest = [...points].sort((a, b) => Phaser.Math.Distance.BetweenPoints(a[1], start) - Phaser.Math.Distance.BetweenPoints(b[1], start));
    for (const [id, p] of closest.slice(0, 18)) {
      if (!this.clearSegment(start, p, radius)) continue;
      costs.set(id, Phaser.Math.Distance.BetweenPoints(start, p)); open.add(id);
    }
    let finish: number | undefined;
    const closed = new Set<number>();
    while (open.size) {
      let selected = -1, best = Infinity;
      for (const id of open) {
        const score = costs.get(id)! + Phaser.Math.Distance.BetweenPoints(points.get(id)!, goal);
        if (score < best) { selected = id; best = score; }
      }
      const p = points.get(selected)!;
      if (Phaser.Math.Distance.BetweenPoints(p, goal) < spacing * 2.5 && this.clearSegment(p, goal, radius)) { finish = selected; break; }
      open.delete(selected); closed.add(selected);
      const col = selected % columns, row = Math.floor(selected / columns);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || col + dx < 0 || col + dx >= columns || row + dy < 0 || row + dy >= rows) continue;
        const id = (row + dy) * columns + col + dx, candidate = points.get(id);
        if (!candidate || closed.has(id) || !this.clearSegment(p, candidate, radius)) continue;
        const cost = costs.get(selected)! + Math.hypot(dx, dy) * spacing;
        if (cost < (costs.get(id) ?? Infinity)) { costs.set(id, cost); previous.set(id, selected); open.add(id); }
      }
    }
    if (finish === undefined) return [];
    const route = [goal];
    for (let id: number | undefined = finish; id !== undefined; id = previous.get(id)) route.unshift(points.get(id)!);
    const smooth: MarketPoint[] = [];
    let anchor = start, index = 0;
    while (index < route.length) {
      let next = route.length - 1;
      while (next > index && !this.clearSegment(anchor, route[next], radius)) next--;
      smooth.push(route[next]); anchor = route[next]; index = next + 1;
    }
    return smooth;
  }

  private clearSegment(from: MarketPoint, to: MarketPoint, radius: number): boolean {
    const count = Math.max(1, Math.ceil(Phaser.Math.Distance.BetweenPoints(from, to) / 5));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      if (this.blocked({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, radius)) return false;
    }
    return true;
  }

  nearestSafe(point: MarketPoint, radius = 18): MarketPoint {
    const p = {
      x: Phaser.Math.Clamp(point.x, 90 + radius, WIDTH - 90 - radius),
      y: Phaser.Math.Clamp(point.y, 475 + radius, HEIGHT - 40 - radius)
    };
    for (let pass = 0; pass < 4; pass++) {
      for (const rect of this.obstacles) {
        if (!this.inside(p, rect, radius)) continue;
        const candidates = [
          { x: rect.x - radius - .1, y: p.y },
          { x: rect.x + rect.width + radius + .1, y: p.y },
          { x: p.x, y: rect.y - radius - .1 },
          { x: p.x, y: rect.y + rect.height + radius + .1 }
        ].filter(c => c.x >= 90 + radius && c.x <= WIDTH - 90 - radius && c.y >= 475 + radius && c.y <= HEIGHT - 40 - radius);
        candidates.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
        if (candidates.length) Object.assign(p, candidates[0]);
      }
    }
    return p;
  }

  destroy(): void {
    for (const object of this.objects) object.destroy();
    this.objects.length = 0;
    this.people.length = 0;
  }

  private inside(p: MarketPoint, r: Rect, radius: number): boolean {
    return p.x > r.x - radius && p.x < r.x + r.width + radius && p.y > r.y - radius && p.y < r.y + r.height + radius;
  }
  private blocked(p: MarketPoint, radius: number): boolean { return this.obstacles.some(r => this.inside(p, r, radius)); }

  private addProp(x: number, y: number, type: string): void {
    this.objects.push(this.scene.add.image(x, y, `market-prop-${type}`).setOrigin(.5, 1).setScale(1.5).setDepth(y));
    if (type === 'bench') this.obstacles.push({ x: x - 47, y: y - 14, width: 94, height: 26 });
    else if (type !== 'lantern') this.obstacles.push({ x: x - 18, y: y - 13, width: 36, height: 26 });
  }

  private addVendor(vendor: MarketVendor): void {
    const palettes: Record<MarketVendorId, PersonPalette> = {
      forge: { coat: '#8f6039', light: '#c5955b', shade: '#604332', skin: '#bc8259', skinShade: '#855b44', hair: '#5b4031', hat: 'none', beard: true, role: 'forge' },
      apothecary: { coat: '#62846d', light: '#abc094', shade: '#3d5c4d', skin: '#e2af88', skinShade: '#ab765e', hair: '#793e37', hat: 'bonnet', role: 'apothecary' },
      outfitter: { coat: '#637c9c', light: '#a7c0d0', shade: '#3c4a6b', skin: '#986747', skinShade: '#644636', hair: '#dcceb1', hat: 'cap', role: 'outfitter' },
      curios: { coat: '#835d91', light: '#c59fb1', shade: '#553d6a', skin: '#ddba96', skinShade: '#a67f66', hair: '#ddd8c5', hat: 'pointed', beard: true, role: 'curios' }
    };
    this.addPerson(`vendor-${vendor.id}`, vendor.x, vendor.y + 30, palettes[vendor.id], [], 0, this.vendors.indexOf(vendor) * .77);
  }

  private addVisitors(): void {
    const definitions: Array<[string, PersonPalette, MarketPoint[], number, number]> = [
      ['flower-woman', { coat: '#c18c65', light: '#edc493', shade: '#8e5e48', skin: '#cb936d', skinShade: '#956447', hair: '#47372c', hat: 'straw', basket: true }, [{ x: 500, y: 730 }, { x: 650, y: 733 }, { x: 700, y: 688 }, { x: 890, y: 733 }, { x: 1056, y: 730 }, { x: 890, y: 733 }, { x: 700, y: 733 }, { x: 650, y: 733 }], 31, .3],
      ['blue-traveler', { coat: '#56868e', light: '#96bdba', shade: '#375a68', skin: '#e5b58a', skinShade: '#b28062', hair: '#714b30', hat: 'cap' }, [{ x: 839, y: 901 }, { x: 839, y: 771 }, { x: 905, y: 733 }, { x: 1056, y: 730 }, { x: 901, y: 733 }, { x: 837, y: 906 }], 37, 1.4],
      ['small-scout', { coat: '#9b7b49', light: '#d6bd77', shade: '#655534', skin: '#946747', skinShade: '#604535', hair: '#312c28', hat: 'none' }, [{ x: 712, y: 940 }, { x: 700, y: 804 }, { x: 650, y: 730 }, { x: 500, y: 730 }, { x: 650, y: 730 }, { x: 702, y: 807 }, { x: 712, y: 940 }], 40, 2.8],
      ['plum-elder', { coat: '#9b6b80', light: '#d7a6ad', shade: '#70485f', skin: '#e2b692', skinShade: '#ab7e65', hair: '#d8d4bf', hat: 'bonnet', basket: true }, [{ x: 1066, y: 937 }, { x: 890, y: 937 }, { x: 890, y: 733 }, { x: 1056, y: 730 }, { x: 890, y: 733 }, { x: 890, y: 937 }], 26, 3.8],
      ['green-gnome', { coat: '#6b8150', light: '#b4c587', shade: '#485938', skin: '#c19377', skinShade: '#8d6954', hair: '#d8c294', hat: 'pointed', beard: true }, [{ x: 472, y: 937 }, { x: 650, y: 937 }, { x: 660, y: 812 }, { x: 670, y: 733 }, { x: 660, y: 814 }, { x: 650, y: 937 }], 28, 4.5],
      ['red-shopper', { coat: '#b16b5a', light: '#e9aa88', shade: '#7e4a46', skin: '#8e654a', skinShade: '#614733', hair: '#342b28', hat: 'straw', basket: true }, [{ x: 722, y: 599 }, { x: 801, y: 665 }, { x: 778, y: 754 }, { x: 699, y: 684 }, { x: 722, y: 599 }], 29, 5.5]
    ];
    for (const [key, palette, path, speed, phase] of definitions) {
      this.addPerson(key, path[0].x, path[0].y, palette, path, speed, phase);
    }
  }

  private addPerson(key: string, x: number, y: number, palette: PersonPalette, path: MarketPoint[], speed: number, phase: number): void {
    const textureKey = `market-person-${key}`;
    if (!this.scene.textures.exists(textureKey)) this.makePersonTexture(textureKey, palette);
    const shadow = this.scene.add.ellipse(x, y - 2, 34, 11, 0x2b3930, .26).setDepth(2);
    const sprite = this.scene.add.sprite(x, y, textureKey, 12).setOrigin(.5, 1).setScale(key === 'small-scout' ? .525 : .675).setDepth(y);
    this.objects.push(shadow, sprite);
    this.people.push({ sprite, shadow, path, waypoint: path.length > 1 ? 1 : 0, pause: phase * 470, clock: phase * 1180, speed, role: palette.role, facing: 0, phase });
  }

  private drawAtmosphere(calm: boolean): void {
    if (!this.flags || !this.atmosphere) return;
    const time = calm ? 0 : this.elapsed / 1000;
    const g = this.flags.clear();
    // Short canopy pennants leave the courthouse and central promenade unobscured.
    for (const vendor of this.vendors) {
      const colors = SWATCHES[vendor.id];
      const y = vendor.y - 166;
      g.lineStyle(2, 0x624c38, .8).beginPath().moveTo(vendor.x - 105, y - 1);
      for (let i = 1; i <= 14; i++) g.lineTo(vendor.x - 105 + i * 15, y + Math.sin(i / 14 * Math.PI) * 14);
      g.strokePath();
      for (let i = 0; i < 9; i++) {
        const px = vendor.x - 84 + i * 21;
        const py = y + Math.sin((i + 1) / 10 * Math.PI) * 14;
        const flutter = Math.sin(time * 2.3 + i * .9 + vendor.x) * 2;
        g.fillStyle(Phaser.Display.Color.HexStringToColor(colors[i % 2]).color, 1);
        g.fillTriangle(px - 6, py, px + 6, py, px + flutter, py + 13 + flutter * .3);
      }
    }
    const a = this.atmosphere.clear();
    // Localized working effects: embers, herb scent and an occasional orbiting charm.
    for (let i = 0; i < 5; i++) {
      const p = ((time * .31 + i * .193) % 1);
      const forge = this.vendors[0];
      a.fillStyle(0xffd986, calm ? .28 : (1 - p) * .7).fillRect(forge.x + 47 + Math.sin(i * 9 + time) * 9, forge.y - 29 - p * 26, 2, 2);
    }
    if (!calm) {
      for (let i = 0; i < 15; i++) {
        const px = 186 + ((i * 193 + time * (3 + i % 3)) % 1160);
        const py = 490 + (i * 73 % 451) + Math.sin(time * .6 + i) * 9;
        a.fillStyle(i % 3 === 0 ? 0xf9e4a2 : 0xfff6d4, .17 + Math.sin(time + i) * .07).fillRect(px, py, 2, 2);
      }
      for (let i = 0; i < 3; i++) {
        const angle = time * .7 + i * Math.PI * 2 / 3;
        const curios = this.vendors[3];
        a.fillStyle(0xe6bbf0, .7).fillRect(curios.x + 43 + Math.cos(angle) * 12, curios.y - 26 + Math.sin(angle) * 5, 2, 2);
      }
    }
  }

  private canvas(key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
    if (this.scene.textures.exists(key)) return;
    const texture = this.scene.textures.createCanvas(key, width, height)!;
    const ctx = texture.context;
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    this.finishPixels(ctx, width, height, key.includes('person-'));
    texture.refresh().setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  /** Fine pigment variation and warm upper-left light tie the hand-made props to the square. */
  private finishPixels(ctx: CanvasRenderingContext2D, width: number, height: number, person: boolean): void {
    const pixels = ctx.getImageData(0, 0, width, height), data = pixels.data;
    const source = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (!source[index + 3]) continue;
      const seed = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const grain = ((seed % 101) / 100 - .5) * (person ? .11 : .13);
      const frameX = person ? x % PERSON_FRAME_WIDTH : x;
      const sideLight = person ? (48 - frameX) / 650 : (80 - x) / 1600;
      const exposedLeft = x > 0 && source[index - 1] === 0;
      const exposedRight = x < width - 1 && source[index + 7] === 0;
      const exposedTop = y > 0 && source[index - width * 4 + 3] === 0;
      const bevel = exposedLeft || exposedTop ? .09 : exposedRight ? -.1 : 0;
      const light = 1 + grain + sideLight + bevel;
      data[index] = Math.min(255, source[index] * light + 2);
      data[index + 1] = Math.min(255, source[index + 1] * light + 1);
      data[index + 2] = Math.min(255, source[index + 2] * (light - .025));
    }
    ctx.putImageData(pixels, 0, 0);
  }

  private drawBottle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, h: number): void {
    ctx.fillStyle = '#474b3b'; ctx.fillRect(x + 2, y, 4, 4); ctx.fillRect(x, y + 4, 8, h - 4);
    ctx.fillStyle = color; ctx.fillRect(x + 1, y + 5, 6, h - 6);
    ctx.fillStyle = '#e5e7bc'; ctx.fillRect(x + 2, y + 5, 1, h - 7); ctx.fillRect(x + 3, y + 2, 2, 3);
    ctx.fillStyle = '#b49764'; ctx.fillRect(x + 2, y, 4, 2);
    ctx.fillStyle = '#ebd5a3'; ctx.fillRect(x + 3, y + h - 5, 3, 2);
  }
  private drawSword(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, h: number): void {
    ctx.fillStyle = '#3e4439'; ctx.fillRect(x, y + 1, 3, h - 3);
    ctx.fillStyle = color; ctx.fillRect(x, y + 2, 1, h - 6); ctx.fillRect(x + 1, y, 1, h - 5);
    ctx.fillStyle = '#d4b277'; ctx.fillRect(x - 3, y + h - 5, 9, 2); ctx.fillRect(x, y + h - 3, 3, 3);
  }
  private drawShield(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = '#333e35'; ctx.fillRect(x - 9, y - 10, 18, 17); ctx.fillRect(x - 6, y + 7, 12, 3); ctx.fillRect(x - 3, y + 10, 6, 3);
    ctx.fillStyle = '#c7bd8e'; ctx.fillRect(x - 8, y - 9, 16, 15); ctx.fillRect(x - 5, y + 6, 10, 3);
    ctx.fillStyle = color; ctx.fillRect(x - 6, y - 7, 12, 13); ctx.fillRect(x - 3, y + 6, 6, 3);
    ctx.fillStyle = '#e1d2a0'; ctx.fillRect(x - 1, y - 6, 2, 13); ctx.fillRect(x - 5, y - 1, 10, 2);
  }
  private drawBoot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = '#3b3b31'; ctx.fillRect(x, y, 7, 12); ctx.fillRect(x, y + 8, 11, 6);
    ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, 5, 10); ctx.fillRect(x + 1, y + 9, 8, 3);
    ctx.fillStyle = '#d3b183'; ctx.fillRect(x, y + 1, 7, 2); ctx.fillRect(x + 2, y + 5, 3, 1); ctx.fillRect(x + 2, y + 7, 3, 1);
  }
  private drawGem(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = '#65506a'; ctx.fillRect(x, y + 2, 7, 4); ctx.fillRect(x + 2, y, 3, 8);
    ctx.fillStyle = color; ctx.fillRect(x + 1, y + 2, 5, 3); ctx.fillRect(x + 2, y + 1, 3, 5);
    ctx.fillStyle = '#fff0d5'; ctx.fillRect(x + 2, y + 1, 2, 2);
  }

  private makePropTextures(): void {
    for (const type of ['barrel', 'crate', 'flowers', 'bench', 'lantern']) {
      this.canvas(`market-prop-${type}`, 80, 80, ctx => {
        const r = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
        if (type === 'barrel') {
          r(29, 48, 24, 28, '#473d2e'); r(26, 54, 30, 18, '#644932'); r(29, 49, 24, 25, '#a17646');
          for (let i = 0; i < 5; i++) r(31 + i * 4, 52, 1, 22, '#6d5137');
          r(28, 52, 26, 3, '#666b56'); r(28, 68, 26, 3, '#666b56'); r(31, 49, 20, 2, '#d0ae71');
          this.drawSword(ctx, 34, 29, '#bec7ae', 23); this.drawSword(ctx, 45, 33, '#b4c1b7', 20);
        } else if (type === 'crate') {
          r(26, 53, 29, 22, '#483e2b'); r(28, 54, 25, 19, '#ae8451');
          for (let i = 0; i < 3; i++) { r(29, 56 + i * 6, 23, 1, '#ddb77c'); r(30, 60 + i * 6, 21, 1, '#795b3b'); }
          r(30, 53, 3, 21, '#c39a62'); r(49, 53, 3, 21, '#c39a62');
          r(35, 43, 15, 11, '#99804d'); r(36, 45, 12, 7, '#d3b778'); r(36, 44, 12, 1, '#f0d38c');
          for (let i = 0; i < 4; i++) { r(29 + i * 5, 49 - i % 2 * 2, 4, 4, i % 2 ? '#bc694a' : '#d3ad60'); r(30 + i * 5, 48 - i % 2 * 2, 2, 2, '#54704c'); }
        } else if (type === 'flowers') {
          r(28, 61, 25, 5, '#a6754c'); r(31, 65, 19, 12, '#a46b43'); r(34, 66, 3, 9, '#d9a26d'); r(33, 76, 15, 2, '#634d35');
          for (let i = 0; i < 10; i++) {
            const x = 28 + i * 2.6; const y = 39 + (i * 7 % 17);
            r(Math.round(x), y + 3, 2, 24 - (y - 39), '#546f3b'); r(Math.round(x) - 3, y + 10, 6, 2, '#6e8e4e');
            r(Math.round(x) - 2, y, 6, 4, i % 3 ? '#d9c88c' : '#d2a2b4'); r(Math.round(x), y - 2, 2, 8, i % 3 ? '#f0dba1' : '#e8bfc7'); r(Math.round(x), y + 1, 2, 2, '#ba9150');
          }
        } else if (type === 'bench') {
          r(7, 52, 67, 4, '#3f4733'); r(10, 53, 4, 22, '#424a36'); r(65, 53, 4, 22, '#424a36');
          r(10, 43, 59, 5, '#9e764a'); r(10, 49, 59, 5, '#a98451'); r(10, 44, 59, 1, '#d9b779');
          r(8, 59, 64, 7, '#634f32'); r(9, 59, 62, 3, '#be9558'); r(12, 63, 54, 1, '#8b6b40');
          r(5, 54, 4, 10, '#424a36'); r(71, 54, 4, 10, '#424a36');
        } else {
          r(38, 18, 4, 58, '#3f4b3c'); r(35, 76, 10, 3, '#374235'); r(31, 16, 18, 3, '#354332');
          r(30, 5, 20, 3, '#3d4937'); r(33, 8, 14, 15, '#5e6245'); r(35, 9, 10, 11, '#d1bb76'); r(37, 10, 5, 9, '#f3de9c');
          r(31, 22, 18, 3, '#3d4937'); r(35, 2, 10, 3, '#46503a'); r(38, 0, 4, 2, '#46503a');
        }
      });
    }
  }

  /** Hand-pixelled four-frame strides in front/back/profile plus four work poses.
   * Legs, hands and carried objects are drawn per pose, rather than moving a static cutout.
   */
  private makePersonTexture(key: string, palette: PersonPalette): void {
    this.canvas(key, PERSON_FRAME_WIDTH * 4, PERSON_FRAME_HEIGHT * 4, ctx => {
      for (let row = 0; row < 4; row++) {
        for (let frame = 0; frame < 4; frame++) {
          ctx.save(); ctx.translate(frame * PERSON_FRAME_WIDTH, row * PERSON_FRAME_HEIGHT); ctx.scale(2, 2);
          this.drawPerson(ctx, palette, row, frame);
          ctx.restore();
        }
      }
    });
    const texture = this.scene.textures.get(key);
    for (let row = 0; row < 4; row++) for (let frame = 0; frame < 4; frame++) texture.add(row * 4 + frame, 0, frame * PERSON_FRAME_WIDTH, row * PERSON_FRAME_HEIGHT, PERSON_FRAME_WIDTH, PERSON_FRAME_HEIGHT);
  }

  private drawPerson(ctx: CanvasRenderingContext2D, p: PersonPalette, row: number, frame: number): void {
    const r = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, w, h); };
    const side = row === 2;
    const back = row === 1;
    const idle = row === 3;
    const stride = idle ? 0 : [0, 2, 0, -2][frame];
    const arm = idle ? frame === 1 ? -2 : frame === 2 ? -5 : frame === 3 ? -1 : 0 : stride;
    const rise = idle || frame % 2 === 0 ? 0 : -1;
    ctx.translate(0, rise);
    // Feet remain anchored inside the frame at 61 so world-space y is consistent.
    const lx = side ? 21 + stride : 17;
    const rx = side ? 23 - stride : 25;
    r(lx, 47, 6, 11 + Math.max(0, stride), '#343d36');
    r(rx, 47, 6, 11 + Math.max(0, -stride), '#414b3e');
    r(lx - 1, 56 + Math.max(0, stride), 8, 4, '#46382e');
    r(rx - 1, 56 + Math.max(0, -stride), 8, 4, '#514030');
    r(lx, 56 + Math.max(0, stride), 5, 1, '#a88a61');
    r(rx, 56 + Math.max(0, -stride), 5, 1, '#a88a61');
    r(lx + .5, 49, 1, 5, '#73745a'); r(rx + 1, 50, 1, 4, '#636c50');
    r(lx + 1, 57 + Math.max(0, stride), 3, .5, '#bda078');
    r(rx + 1, 57 + Math.max(0, -stride), 3, .5, '#c3a37a');
    // Outline, shaped shoulders, tunic folds, shirt cuff and waist belt.
    r(side ? 19 : 14, 29, side ? 13 : 21, 20, INK);
    r(side ? 18 : 16, 27, side ? 15 : 17, 23, INK);
    r(side ? 20 : 16, 29, side ? 11 : 17, 18, p.coat);
    r(side ? 19 : 15, 45, side ? 14 : 20, 5, p.shade);
    r(18, 30, side ? 3 : 5, 15, p.light);
    r(27, 34, side ? 3 : 5, 10, p.shade);
    // Small broken folds and stitched seams replace large uninterrupted rectangles.
    r(16, 31, 1.5, 4, p.light); r(17.5, 32, 1, 10, p.coat);
    r(19, 33, .5, 6, CREAM); r(19.5, 40, 1, 3, p.shade);
    r(21, 37, 1, 6, p.shade); r(25, 38, 1, 5, p.light);
    r(28.5, 32, 1.5, 2, p.coat); r(29, 37, .5, 6, p.light);
    r(17, 46, 1, 2.5, p.light); r(21, 46, .5, 2, p.coat);
    r(26, 47, 1, 2, p.coat); r(30, 45, 1, 3, p.coat);
    for (let i = 0; i < 7; i++) r(17 + i * 2, 48, .5, .5, p.light);
    r(16, 44, side ? 16 : 18, 3, '#675038'); r(24, 44, 3, 3, '#d7bc78');
    if (!back) { r(22, 29, 5, 4, CREAM); r(24, 33, 1, 10, '#d7c69b'); }
    if (p.role === 'forge' && !back) { r(19, 34, 12, 13, '#6c4e37'); r(20, 33, 1.5, 14, '#ac8250'); r(28, 38, 3, 2, '#3e3930'); r(22, 37, 3, .5, '#ba8d5c'); r(23, 42, 4, .5, '#966c46'); r(25, 45, 5, .5, '#523f31'); }
    if (p.role === 'outfitter' && !back) { r(18, 38, 15, 10, '#ddcdb1'); r(21, 43, 8, 4, '#bca784'); r(19, 39, 1, 7, '#f0dfbf'); r(30, 40, 2, 7, '#ada082'); r(22, 43, 6, .5, '#f0dfbf'); }
    // The far arm first; the near hand moves independently during walking / work.
    r(side ? 18 : 12, 32 - stride, 5, 11, p.shade);
    r(side ? 18 : 12, 41 - stride, 5, 4, p.skinShade);
    r(side ? 28 : 32, 32 + arm, 5, 11, INK);
    r(side ? 28 : 32, 32 + arm, 4, 8, p.coat);
    r(side ? 28.5 : 32.5, 33 + arm, 1, 5, p.light);
    r(side ? 29 : 33, 37 + arm, 2.5, .5, p.shade);
    r(side ? 28 : 32, 39 + arm, 4, 3, p.light);
    r(side ? 28 : 32, 42 + arm, 4, 4, p.skin);
    r(side ? 28 : 32, 45 + arm, 3, 1, p.skinShade);
    // Rounded pixel head with ears, hairline, shaded cheek and separate eyes.
    const hx = side ? 20 : 16;
    r(hx + 2, 13, side ? 11 : 13, 3, INK); r(hx, 16, side ? 15 : 17, 11, INK); r(hx + 3, 26, 11, 3, INK);
    r(hx + 2, 16, side ? 12 : 13, 10, back ? p.hair : p.skin);
    r(hx + 3, 14, side ? 10 : 11, 4, p.hair);
    r(hx + 1, 17, 3, 7, p.hair); r(hx + 13, 16, 3, 6, p.hair);
    if (!back) {
      r(hx + 3, 19, 9, 5, p.skin); r(hx + 5, 17, 6, 2, '#efd0a3');
      r(hx + 11, 22, side ? 6 : 3, 3, p.skinShade);
      if (side) { r(hx + 12, 20, 2, 2, '#39372d'); r(hx + 14, 22, 3, 2, p.skin); }
      else { r(hx + 4, 20, 2, 2, '#39372d'); r(hx + 10, 20, 2, 2, '#39372d'); r(hx + 7, 22, 2, 2, p.skinShade); }
      r(hx + 6, 26, 6, 2, p.skinShade);
      // Half-pixel portrait details: soft brow, nose bridge, cheek and a little smile.
      r(hx + 4, 18.5, 2.5, .5, p.skinShade); r(hx + 9.5, 18.5, 2.5, .5, p.skinShade);
      r(hx + 5, 21.5, 1, .5, '#e9c499'); r(hx + 10, 21.5, 1, .5, '#e9c499');
      r(hx + 6.5, 20, .5, 2.5, '#f1c9a0'); r(hx + 7.5, 23, 1, .5, '#b78368');
      r(hx + 3, 23, 1.5, 1, '#c78b72'); r(hx + 11, 23.5, 1.5, .5, '#bf886f');
      r(hx + 6, 25, 3.5, .5, '#765447'); r(hx + 7, 25.5, 2, .5, '#efbc98');
      if (p.beard) { r(hx + 2, 24, 12, 4, p.hair); r(hx + 4, 28, 9, 4, p.hair); r(hx + 7, 31, 4, 3, p.hair); r(hx + 4, 25, 2, 4, '#b8ab86'); r(hx + 7, 24, 4, 1, p.skinShade); }
    } else { r(hx + 4, 16, 2, 8, p.hair); r(hx + 10, 18, 2, 9, '#6c5c48'); }
    r(hx + 3.5, 15.5, .5, 4, '#a89068'); r(hx + 5, 15, 1, 2, '#b09c76');
    r(hx + 12, 16.5, .5, 3, '#8a795f'); r(hx + 1.5, 20, .5, 3, '#b09c76');
    if (p.hat === 'pointed') {
      r(14, 15, 21, 4, INK); r(17, 10, 16, 6, p.shade); r(20, 5, 12, 6, p.coat); r(24, 1, 7, 5, p.coat); r(28, 0, 5, 3, p.coat);
      r(20, 10, 3, 5, p.light); r(15, 15, 19, 2, p.light); r(27, 13, 3, 3, '#dec888');
      r(23, 7, .5, 5, p.light); r(25, 4, 1, 3, p.light); r(20, 13, 7, .5, p.coat); r(28, 13.5, 1, 1, '#fff0b7');
    } else if (p.hat === 'straw') {
      r(11, 15, 27, 4, '#7d6c46'); r(12, 14, 25, 3, '#dbc386'); r(17, 8, 16, 7, '#c5a46b'); r(19, 8, 12, 2, '#e8d09a'); r(17, 13, 16, 2, p.shade); r(31, 12, 3, 3, '#cd9a89');
      for (let i = 0; i < 7; i++) r(19 + i * 1.5, 10 + i % 2, .5, 2, '#eed8a1');
      for (let i = 0; i < 9; i++) r(13 + i * 2.5, 15, 1, .5, '#f0dba8');
    } else if (p.hat === 'bonnet') {
      r(14, 11, 19, 7, p.light); r(13, 16, 4, 10, p.light); r(30, 16, 4, 9, p.light); r(17, 10, 13, 2, CREAM); r(16, 27, 3, 5, p.light); r(31, 27, 3, 4, p.light);
      for (let i = 0; i < 7; i++) r(16 + i * 2.2, 13 + i % 2, 1, 3, CREAM);
      r(14, 19, 1, 4, CREAM); r(31, 18, 1, 5, p.coat);
    } else if (p.hat === 'cap') {
      r(15, 11, 19, 5, p.shade); r(18, 9, 13, 4, p.coat); r(16, 15, side ? 23 : 18, 2, p.light); r(18, 10, 6, 1, p.light);
      r(19, 10.5, 9, .5, p.light); r(26, 12, 4, .5, p.light); r(17, 15.5, 12, .5, CREAM);
    }
    if (p.basket) {
      r(32, 45 + arm, 12, 10, '#71573b'); r(33, 46 + arm, 10, 7, '#bd945a'); r(34, 47 + arm, 8, 1, '#e0bb76'); r(34, 51 + arm, 8, 1, '#83633e'); r(32, 42 + arm, 2, 5, '#ad8c55'); r(42, 42 + arm, 2, 5, '#ad8c55');
      r(35, 43 + arm, 3, 3, '#bb7352'); r(39, 43 + arm, 3, 3, '#c4b46d'); r(37, 39 + arm, 2, 5, '#769258');
    }
    if (idle && p.role === 'forge') {
      r(34, 32 + arm, 2, 13, '#ba9161'); r(30, 30 + arm, 11, 5, '#444c46'); r(31, 30 + arm, 9, 2, '#b4b9a3');
    } else if (idle && p.role === 'apothecary') {
      this.drawBottle(ctx, 33, 36 + arm, '#a6cc98', 10); r(13, 41, 5, 2, '#cbbf96');
    } else if (idle && p.role === 'outfitter') {
      r(13, 43, 22, 4, '#c7abc2'); r(17, 41, 12, 4, '#e0c4d6'); r(34, 37 + arm, 1, 9, '#e3d9b2');
    } else if (idle && p.role === 'curios') {
      this.drawGem(ctx, 32, 37 + arm, '#d8bae8'); r(13, 42, 5, 5, '#c9b08a');
    }
  }
}
