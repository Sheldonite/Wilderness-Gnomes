import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { LOOK, reducedMotion } from '../config/presentation';
import type { Vector2Like } from '../core/types';

const SIZE = GAME_CONFIG.arena.width;
export const riverX = (y: number): number => 2410 + Math.sin(y / 380) * 110 + Math.sin(y / 820) * 60;
export const pathY = (x: number): number => 1410 + Math.sin(x / 540) * 125;
const PONDS = [{ x: 720, y: 2460, rx: 160, ry: 108 }, { x: 980, y: 550, rx: 115, ry: 76 }];

export class ScenerySystem {
  private readonly random = new Phaser.Math.RandomDataGenerator(['storybook-golden-woodland-1']);
  private readonly trees: Phaser.GameObjects.Image[] = [];
  private readonly ripples: Phaser.GameObjects.Ellipse[] = [];
  private elapsed = 0;
  private fadeClock = 0;
  constructor(private readonly scene: Phaser.Scene) {}

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

  private openPoint(clearance: number): Vector2Like | undefined {
    for (let tries = 0; tries < 150; tries++) {
      const x = this.random.between(65, SIZE - 65), y = this.random.between(90, SIZE - 45);
      if (Math.hypot(x - 1600, y - 1600) < clearance || Math.abs(x - riverX(y)) < 145 || Math.abs(y - pathY(x)) < 95) continue;
      if (PONDS.some(p => Math.pow((x - p.x) / (p.rx + 100), 2) + Math.pow((y - p.y) / (p.ry + 100), 2) < 1)) continue;
      if (this.trees.some(t => Math.hypot(t.x - x, t.y - y) < 145)) continue;
      return { x, y };
    }
    return undefined;
  }

  private prop(frame: string, x: number, y: number, height: number, depth: number): Phaser.GameObjects.Image {
    const sprite = this.scene.add.image(x, y, LOOK.texture.props, frame).setOrigin(.5, 1).setDepth(depth);
    sprite.setScale(height / sprite.height).setFlipX(this.random.frac() > .5); return sprite;
  }

  private createPlanting(): void {
    for (let i = 0; i < LOOK.limit.canopies; i++) {
      const point = this.openPoint(370); if (!point) continue;
      const height = this.random.between(205, 330);
      this.scene.add.image(point.x + 15, point.y - 2, LOOK.texture.shadow).setDisplaySize(height * .75, height * .22).setDepth(LOOK.depth.shadow).setAlpha(.65);
      this.trees.push(this.prop(this.random.pick(['oak', 'birch', 'fir']), point.x, point.y, height, LOOK.depth.canopy));
      for (let j = 0; j < 3; j++) this.prop(j === 0 ? 'mushroom' : 'fern', point.x + this.random.between(-85, 85), point.y + this.random.between(-10, 40), this.random.between(27, 52), LOOK.depth.flowers);
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
