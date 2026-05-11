import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import {
  TERRAIN_GROUND_KEY,
  TERRAIN_PROP_FRAMES,
  TERRAIN_PROPS_KEY,
  TERRAIN_WATER_FRAMES,
  TERRAIN_WATER_KEY
} from '../config/terrainSprites';

const SCENERY_SEED = 'wilderness-gnomes-forest-v1';
const SAFE_CENTER_RADIUS = 320;

interface PlacedFeature {
  x: number;
  y: number;
  radius: number;
}

export class ScenerySystem {
  private readonly random = new Phaser.Math.RandomDataGenerator([SCENERY_SEED]);
  private readonly waterFeatures: PlacedFeature[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  create(): void {
    this.createGround();
    this.createWaterFeatures();
    this.createPathPatches();
    this.createRockClusters();
    this.createTrees();
    this.createArenaBorder();
  }

  private createGround(): void {
    this.scene.add
      .tileSprite(
        GAME_CONFIG.arena.width / 2,
        GAME_CONFIG.arena.height / 2,
        GAME_CONFIG.arena.width,
        GAME_CONFIG.arena.height,
        TERRAIN_GROUND_KEY
      )
      .setDepth(-50)
      .setAlpha(0.96);

    const graphics = this.scene.add.graphics();
    graphics.setDepth(-45);

    for (let i = 0; i < 180; i += 1) {
      const x = this.random.between(60, GAME_CONFIG.arena.width - 60);
      const y = this.random.between(60, GAME_CONFIG.arena.height - 60);
      const radius = this.random.between(18, 54);
      const color = this.random.pick([0x2d371c, 0x3d4220, 0x51472a, 0x24301c]);
      graphics.fillStyle(color, this.random.realInRange(0.12, 0.28));
      graphics.fillEllipse(x, y, radius * this.random.realInRange(1.3, 2.6), radius);
    }
  }

  private createWaterFeatures(): void {
    for (let i = 0; i < 7; i += 1) {
      this.placeWaterFeature(TERRAIN_WATER_FRAMES.ponds, 1.25, 110);
    }

    for (let i = 0; i < 6; i += 1) {
      const feature = this.placeWaterFeature(TERRAIN_WATER_FRAMES.rivers, 1.35, 125);
      if (feature) {
        this.placeBridgeNear(feature);
      }
    }
  }

  private createPathPatches(): void {
    for (let i = 0; i < 18; i += 1) {
      const point = this.randomOpenPoint(90);
      const sprite = this.scene.add.sprite(
        point.x,
        point.y,
        TERRAIN_WATER_KEY,
        this.pickFrame(TERRAIN_WATER_FRAMES.paths)
      );
      sprite.setDepth(-35);
      sprite.setScale(this.random.realInRange(0.75, 1.2));
      sprite.setRotation(this.random.realInRange(-0.28, 0.28));
      sprite.setAlpha(0.88);
    }
  }

  private createRockClusters(): void {
    for (let i = 0; i < 80; i += 1) {
      const point = this.randomOpenPoint(72);
      const sprite = this.scene.add.sprite(
        point.x,
        point.y,
        TERRAIN_PROPS_KEY,
        this.pickFrame(TERRAIN_PROP_FRAMES.rocks)
      );
      sprite.setDepth(3);
      sprite.setScale(this.random.realInRange(0.35, 0.68));
      sprite.setFlipX(this.random.frac() > 0.5);
    }
  }

  private createTrees(): void {
    for (let i = 0; i < 125; i += 1) {
      const point = this.randomOpenPoint(92);
      const sprite = this.scene.add.sprite(
        point.x,
        point.y,
        TERRAIN_PROPS_KEY,
        this.pickFrame(TERRAIN_PROP_FRAMES.trees)
      );
      sprite.setDepth(4);
      sprite.setScale(this.random.realInRange(0.42, 0.82));
      sprite.setFlipX(this.random.frac() > 0.5);
    }
  }

  private createArenaBorder(): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(30);
    graphics.lineStyle(8, 0x554936, 1);
    graphics.strokeRect(0, 0, GAME_CONFIG.arena.width, GAME_CONFIG.arena.height);
  }

  private placeWaterFeature(
    frames: readonly number[],
    scale: number,
    radius: number
  ): PlacedFeature | null {
    const point = this.randomOpenPoint(radius);
    const sprite = this.scene.add.sprite(point.x, point.y, TERRAIN_WATER_KEY, this.pickFrame(frames));
    sprite.setDepth(-38);
    sprite.setScale(scale * this.random.realInRange(0.82, 1.25));
    sprite.setRotation(this.random.realInRange(-0.12, 0.12));

    const feature = { x: point.x, y: point.y, radius: radius * scale };
    this.waterFeatures.push(feature);
    return feature;
  }

  private placeBridgeNear(feature: PlacedFeature): void {
    const sprite = this.scene.add.sprite(
      feature.x + this.random.between(-18, 18),
      feature.y + this.random.between(-18, 18),
      TERRAIN_WATER_KEY,
      this.pickFrame(TERRAIN_WATER_FRAMES.bridges)
    );
    sprite.setDepth(-24);
    sprite.setScale(this.random.realInRange(0.82, 1.12));
    sprite.setRotation(this.random.realInRange(-0.18, 0.18));
  }

  private randomOpenPoint(radius: number): { x: number; y: number } {
    const center = {
      x: GAME_CONFIG.arena.width / 2,
      y: GAME_CONFIG.arena.height / 2
    };

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const point = {
        x: this.random.between(radius, GAME_CONFIG.arena.width - radius),
        y: this.random.between(radius, GAME_CONFIG.arena.height - radius)
      };

      if (Phaser.Math.Distance.Between(point.x, point.y, center.x, center.y) < SAFE_CENTER_RADIUS) {
        continue;
      }

      if (this.waterFeatures.some((feature) => {
        return Phaser.Math.Distance.Between(point.x, point.y, feature.x, feature.y) < radius + feature.radius;
      })) {
        continue;
      }

      return point;
    }

    return {
      x: this.random.between(radius, GAME_CONFIG.arena.width - radius),
      y: this.random.between(radius, GAME_CONFIG.arena.height - radius)
    };
  }

  private pickFrame(frames: readonly number[]): number {
    return frames[this.random.between(0, frames.length - 1)];
  }
}
