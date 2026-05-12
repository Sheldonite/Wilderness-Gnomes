import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import {
  TERRAIN_FEATURE_FRAME_SIZE,
  TERRAIN_GROUND_KEY,
  TERRAIN_PROP_FRAMES,
  TERRAIN_PROPS_KEY,
  TERRAIN_WATER_FRAMES,
  TERRAIN_WATER_KEY
} from '../config/terrainSprites';

const SCENERY_SEED = 'wilderness-gnomes-forest-v2-connected';
const SAFE_CENTER_RADIUS = 320;
const GRID_SIZE = TERRAIN_FEATURE_FRAME_SIZE;
const GRID_COLUMNS = Math.floor(GAME_CONFIG.arena.width / GRID_SIZE);
const GRID_ROWS = Math.floor(GAME_CONFIG.arena.height / GRID_SIZE);

type Direction = 'north' | 'east' | 'south' | 'west';
type ConnectionMask = Partial<Record<Direction, boolean>>;

interface GridPoint {
  col: number;
  row: number;
}

interface PlacedFeature {
  x: number;
  y: number;
  radius: number;
}

interface TerrainRouteTile {
  point: GridPoint;
  connections: ConnectionMask;
}

interface RenderedRouteTile extends TerrainRouteTile {
  x: number;
  y: number;
}

export class ScenerySystem {
  private readonly random = new Phaser.Math.RandomDataGenerator([SCENERY_SEED]);
  private readonly waterFeatures: PlacedFeature[] = [];
  private readonly blockedFeatureKeys = new Set<string>();
  private riverTiles: RenderedRouteTile[] = [];
  private bridgeKeys = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  create(): void {
    this.createGround();
    const riverPlan = this.generateRiverPlan();
    this.renderRiverPlan(riverPlan);
    this.placeLakes();
    this.placeBridgesOnRiver();
    const pathPlan = this.generatePathPlan();
    this.renderPathPlan(pathPlan);
    this.createRocksAndTreesAvoidingWater();
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

  private generateRiverPlan(): TerrainRouteTile[] {
    const vertical = this.random.frac() > 0.35;
    const route = vertical ? this.generateVerticalRiverRoute() : this.generateHorizontalRiverRoute();
    return this.buildRouteTiles(route, true);
  }

  private generateVerticalRiverRoute(): GridPoint[] {
    const leftSide = this.random.frac() > 0.5;
    const minCol = leftSide ? 2 : Math.floor(GRID_COLUMNS * 0.62);
    const maxCol = leftSide ? Math.floor(GRID_COLUMNS * 0.38) : GRID_COLUMNS - 3;
    let col = this.random.between(minCol, maxCol);
    const route: GridPoint[] = [{ col, row: 0 }];

    for (let row = 1; row < GRID_ROWS; row += 1) {
      if (this.random.frac() < 0.34) {
        const drift = this.random.pick([-1, 1]);
        const nextCol = Phaser.Math.Clamp(col + drift, minCol, maxCol);
        if (nextCol !== col) {
          col = nextCol;
          this.pushUniquePoint(route, { col, row: row - 1 });
        }
      }

      this.pushUniquePoint(route, { col, row });
    }

    return route;
  }

  private generateHorizontalRiverRoute(): GridPoint[] {
    const topSide = this.random.frac() > 0.5;
    const minRow = topSide ? 2 : Math.floor(GRID_ROWS * 0.62);
    const maxRow = topSide ? Math.floor(GRID_ROWS * 0.38) : GRID_ROWS - 3;
    let row = this.random.between(minRow, maxRow);
    const route: GridPoint[] = [{ col: 0, row }];

    for (let col = 1; col < GRID_COLUMNS; col += 1) {
      if (this.random.frac() < 0.34) {
        const drift = this.random.pick([-1, 1]);
        const nextRow = Phaser.Math.Clamp(row + drift, minRow, maxRow);
        if (nextRow !== row) {
          row = nextRow;
          this.pushUniquePoint(route, { col: col - 1, row });
        }
      }

      this.pushUniquePoint(route, { col, row });
    }

    return route;
  }

  private renderRiverPlan(riverPlan: TerrainRouteTile[]): void {
    this.riverTiles = [];

    for (const tile of riverPlan) {
      const { x, y } = this.gridToWorld(tile.point);
      const sprite = this.scene.add.sprite(x, y, TERRAIN_WATER_KEY);
      sprite.setDepth(-38);
      sprite.setScale(1.04);
      this.applyWaterSprite(sprite, tile.connections);

      this.riverTiles.push({ ...tile, x, y });
      this.blockArea(x, y, 92);
    }
  }

  private placeLakes(): void {
    for (let i = 0; i < 5; i += 1) {
      const point = this.randomOpenPoint(130);
      const sprite = this.scene.add.sprite(
        point.x,
        point.y,
        TERRAIN_WATER_KEY,
        this.pickFrame(TERRAIN_WATER_FRAMES.ponds)
      );
      sprite.setDepth(-39);
      sprite.setScale(this.random.realInRange(0.9, 1.25));
      sprite.setRotation(this.random.realInRange(-0.08, 0.08));
      this.blockArea(point.x, point.y, 130);
    }
  }

  private placeBridgesOnRiver(): void {
    const candidates = this.riverTiles.filter((tile) => this.isStraight(tile.connections));
    const bridgeCount = Math.min(3, Math.max(1, Math.floor(candidates.length / 9)));
    const shuffled = Phaser.Utils.Array.Shuffle([...candidates]);
    let placed = 0;

    for (const tile of shuffled) {
      if (placed >= bridgeCount) {
        return;
      }

      if (this.isNearCenter(tile.x, tile.y, SAFE_CENTER_RADIUS + 80)) {
        continue;
      }

      const sprite = this.scene.add.sprite(tile.x, tile.y, TERRAIN_WATER_KEY, this.pickBridgeFrame(tile.connections));
      sprite.setDepth(-24);
      sprite.setScale(0.96);
      sprite.setRotation(0);
      this.bridgeKeys.add(this.keyOf(tile.point));
      placed += 1;
    }
  }

  private generatePathPlan(): TerrainRouteTile[] {
    const route = this.generatePathRouteAvoidingRiver();
    return this.buildRouteTiles(route, true);
  }

  private generatePathRouteAvoidingRiver(): GridPoint[] {
    const route: GridPoint[] = [];
    let col = 1;
    let row = GRID_ROWS - 4;
    const targetCol = GRID_COLUMNS - 2;
    const targetRow = 3;
    route.push({ col, row });

    while (col !== targetCol || row !== targetRow) {
      const preferHorizontal = Math.abs(targetCol - col) >= Math.abs(targetRow - row);

      if (preferHorizontal && col !== targetCol) {
        col += Math.sign(targetCol - col);
      } else if (row !== targetRow) {
        row += Math.sign(targetRow - row);
      } else {
        col += Math.sign(targetCol - col);
      }

      const next = { col, row };
      if (this.isRiverPoint(next) && !this.bridgeKeys.has(this.keyOf(next))) {
        const detourRow = Phaser.Math.Clamp(row + (row < GRID_ROWS / 2 ? 1 : -1), 1, GRID_ROWS - 2);
        this.pushUniquePoint(route, { col: col - Math.sign(targetCol - col || 1), row: detourRow });
        row = detourRow;
      }

      this.pushUniquePoint(route, next);
    }

    return route;
  }

  private renderPathPlan(pathPlan: TerrainRouteTile[]): void {
    for (const tile of pathPlan) {
      if (this.isRiverPoint(tile.point) && !this.bridgeKeys.has(this.keyOf(tile.point))) {
        continue;
      }

      const { x, y } = this.gridToWorld(tile.point);
      const sprite = this.scene.add.sprite(x, y, TERRAIN_WATER_KEY);
      sprite.setDepth(-35);
      sprite.setScale(0.9);
      this.applyPathSprite(sprite, tile.connections);
      this.blockArea(x, y, 46);
    }
  }

  private createRocksAndTreesAvoidingWater(): void {
    this.createRockClusters();
    this.createTrees();
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

  private buildRouteTiles(route: GridPoint[], connectRouteEdges: boolean): TerrainRouteTile[] {
    return route.map((point, index) => {
      const previous = route[index - 1];
      const next = route[index + 1];
      const connections: ConnectionMask = {};

      if (previous) {
        connections[this.directionBetween(point, previous)] = true;
      } else if (connectRouteEdges) {
        this.addEdgeConnection(point, connections);
      }

      if (next) {
        connections[this.directionBetween(point, next)] = true;
      } else if (connectRouteEdges) {
        this.addEdgeConnection(point, connections);
      }

      return { point, connections };
    });
  }

  private applyWaterSprite(sprite: Phaser.GameObjects.Sprite, connections: ConnectionMask): void {
    if (this.hasConnections(connections, ['east', 'west'])) {
      sprite.setFrame(4);
      sprite.setRotation(0);
      return;
    }

    if (this.hasConnections(connections, ['north', 'south'])) {
      sprite.setFrame(5);
      sprite.setRotation(0);
      return;
    }

    sprite.setFrame(6);
    sprite.setRotation(this.bendRotation(connections));
  }

  private applyPathSprite(sprite: Phaser.GameObjects.Sprite, connections: ConnectionMask): void {
    if (this.hasConnections(connections, ['east', 'west'])) {
      sprite.setFrame(13);
      sprite.setRotation(Math.PI / 2);
      return;
    }

    if (this.hasConnections(connections, ['north', 'south'])) {
      sprite.setFrame(13);
      sprite.setRotation(0);
      return;
    }

    sprite.setFrame(12);
    sprite.setRotation(this.bendRotation(connections));
  }

  private pickBridgeFrame(connections: ConnectionMask): number {
    if (this.hasConnections(connections, ['east', 'west'])) {
      return 9;
    }

    return 8;
  }

  private bendRotation(connections: ConnectionMask): number {
    if (this.hasConnections(connections, ['east', 'south'])) {
      return 0;
    }
    if (this.hasConnections(connections, ['south', 'west'])) {
      return Math.PI / 2;
    }
    if (this.hasConnections(connections, ['west', 'north'])) {
      return Math.PI;
    }
    if (this.hasConnections(connections, ['north', 'east'])) {
      return -Math.PI / 2;
    }

    return 0;
  }

  private addEdgeConnection(point: GridPoint, connections: ConnectionMask): void {
    if (point.row === 0) {
      connections.north = true;
    }
    if (point.row === GRID_ROWS - 1) {
      connections.south = true;
    }
    if (point.col === 0) {
      connections.west = true;
    }
    if (point.col === GRID_COLUMNS - 1) {
      connections.east = true;
    }
  }

  private directionBetween(from: GridPoint, to: GridPoint): Direction {
    if (to.col > from.col) {
      return 'east';
    }
    if (to.col < from.col) {
      return 'west';
    }
    if (to.row > from.row) {
      return 'south';
    }

    return 'north';
  }

  private hasConnections(connections: ConnectionMask, directions: Direction[]): boolean {
    return directions.every((direction) => connections[direction]);
  }

  private isStraight(connections: ConnectionMask): boolean {
    return (
      this.hasConnections(connections, ['east', 'west']) ||
      this.hasConnections(connections, ['north', 'south'])
    );
  }

  private pushUniquePoint(route: GridPoint[], point: GridPoint): void {
    const last = route[route.length - 1];
    if (last && last.col === point.col && last.row === point.row) {
      return;
    }

    route.push(point);
  }

  private gridToWorld(point: GridPoint): { x: number; y: number } {
    return {
      x: point.col * GRID_SIZE + GRID_SIZE / 2,
      y: point.row * GRID_SIZE + GRID_SIZE / 2
    };
  }

  private keyOf(point: GridPoint): string {
    return `${point.col},${point.row}`;
  }

  private isRiverPoint(point: GridPoint): boolean {
    return this.riverTiles.some((tile) => tile.point.col === point.col && tile.point.row === point.row);
  }

  private blockArea(x: number, y: number, radius: number): void {
    this.waterFeatures.push({ x, y, radius });
    this.blockedFeatureKeys.add(this.keyOf({
      col: Math.floor(x / GRID_SIZE),
      row: Math.floor(y / GRID_SIZE)
    }));
  }

  private randomOpenPoint(radius: number): { x: number; y: number } {
    const center = {
      x: GAME_CONFIG.arena.width / 2,
      y: GAME_CONFIG.arena.height / 2
    };

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const point = {
        x: this.random.between(radius, GAME_CONFIG.arena.width - radius),
        y: this.random.between(radius, GAME_CONFIG.arena.height - radius)
      };

      const gridPoint = {
        col: Math.floor(point.x / GRID_SIZE),
        row: Math.floor(point.y / GRID_SIZE)
      };

      if (this.isNearCenter(point.x, point.y, SAFE_CENTER_RADIUS)) {
        continue;
      }

      if (this.blockedFeatureKeys.has(this.keyOf(gridPoint))) {
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

  private isNearCenter(x: number, y: number, radius: number): boolean {
    return Phaser.Math.Distance.Between(
      x,
      y,
      GAME_CONFIG.arena.width / 2,
      GAME_CONFIG.arena.height / 2
    ) < radius;
  }

  private pickFrame(frames: readonly number[]): number {
    return frames[this.random.between(0, frames.length - 1)];
  }
}
