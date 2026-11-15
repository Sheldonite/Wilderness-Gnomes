import Phaser from 'phaser';
import { reducedMotion } from '../config/presentation';

export type CompassTargetKind = 'chest' | 'relic' | 'rock' | 'elite' | 'shrine';

export interface CompassTarget {
  x: number;
  y: number;
  kind: CompassTargetKind;
}

export interface CompassViewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CompassScreenSize {
  width: number;
  height: number;
}

export interface CompassPadding {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

export interface CompassProjection {
  screenX: number;
  screenY: number;
  angle: number;
  distance: number;
}

interface CompassStyle {
  fill: number;
  core: number;
  stroke: number;
  scale: number;
  priority: number;
}

interface CompassMarker {
  graphics: Phaser.GameObjects.Graphics;
  kind?: CompassTargetKind;
}

const COMPASS_DEPTH = 34;
const MAX_MARKERS = 16;

export const COMPASS_STYLES: Record<CompassTargetKind, CompassStyle> = {
  relic: { fill: 0xc78cff, core: 0xf7e8ff, stroke: 0x241135, scale: 1.18, priority: 0 },
  chest: { fill: 0xf2c865, core: 0xfff5d4, stroke: 0x26180a, scale: 1.05, priority: 1 },
  shrine: { fill: 0x6ce5b1, core: 0xeafff5, stroke: 0x103527, scale: 1.04, priority: 2 },
  elite: { fill: 0xff9f38, core: 0xfff0cc, stroke: 0x2a1406, scale: 1.02, priority: 3 },
  rock: { fill: 0xa855f7, core: 0xefd8ff, stroke: 0x1e0e30, scale: 0.96, priority: 4 }
};

export function projectCompassTarget(
  target: Pick<CompassTarget, 'x' | 'y'>,
  view: CompassViewRect,
  padding: CompassPadding = {},
  screenSize?: CompassScreenSize
): CompassProjection | undefined {
  if (view.width <= 0 || view.height <= 0) return undefined;

  const rightBound = view.left + view.width;
  const bottomBound = view.top + view.height;
  if (
    target.x >= view.left &&
    target.x <= rightBound &&
    target.y >= view.top &&
    target.y <= bottomBound
  ) {
    return undefined;
  }

  const screenWidth = screenSize && screenSize.width > 0 ? screenSize.width : view.width;
  const screenHeight = screenSize && screenSize.height > 0 ? screenSize.height : view.height;
  const scx = screenWidth * 0.5;
  const scy = screenHeight * 0.5;

  const padLeft = Math.min(scx - 4, Math.max(8, padding.left ?? 30));
  const padRight = Math.min(scx - 4, Math.max(8, padding.right ?? 30));
  const padTop = Math.min(scy - 4, Math.max(8, padding.top ?? 76));
  const padBottom = Math.min(scy - 4, Math.max(8, padding.bottom ?? 42));

  const minX = padLeft;
  const maxX = Math.max(minX, screenWidth - padRight);
  const minY = padTop;
  const maxY = Math.max(minY, screenHeight - padBottom);

  const worldCenterX = view.left + view.width * 0.5;
  const worldCenterY = view.top + view.height * 0.5;
  const worldDx = target.x - worldCenterX;
  const worldDy = target.y - worldCenterY;
  const sx = worldDx * (screenWidth / view.width);
  const sy = worldDy * (screenHeight / view.height);

  if (sx === 0 && sy === 0) return undefined;

  const tx =
    sx > 0
      ? (maxX - scx) / sx
      : sx < 0
        ? (minX - scx) / sx
        : Number.POSITIVE_INFINITY;
  const ty =
    sy > 0
      ? (maxY - scy) / sy
      : sy < 0
        ? (minY - scy) / sy
        : Number.POSITIVE_INFINITY;
  const t = Math.min(tx, ty);

  const screenX = Math.max(minX, Math.min(maxX, scx + sx * t));
  const screenY = Math.max(minY, Math.min(maxY, scy + sy * t));

  return {
    screenX,
    screenY,
    angle: Math.atan2(sy, sx),
    distance: Math.hypot(worldDx, worldDy)
  };
}

export class CompassSystem {
  private readonly markers: CompassMarker[] = [];
  private elapsed = 0;

  constructor(private readonly scene: Phaser.Scene) {
    for (let i = 0; i < MAX_MARKERS; i++) {
      const graphics = scene.add
        .graphics()
        .setDepth(COMPASS_DEPTH)
        .setScrollFactor(0)
        .setVisible(false);
      this.markers.push({ graphics });
    }
  }

  update(
    deltaMs: number,
    camera: Phaser.Cameras.Scene2D.Camera,
    targets: readonly CompassTarget[]
  ): void {
    this.elapsed += Math.max(0, deltaMs);
    const calm = reducedMotion();

    const worldView = camera.worldView;
    const view: CompassViewRect =
      worldView && worldView.width > 0 && worldView.height > 0
        ? {
            left: worldView.x,
            top: worldView.y,
            width: worldView.width,
            height: worldView.height
          }
        : {
            left: camera.scrollX,
            top: camera.scrollY,
            width: camera.width > 0 ? camera.width : this.scene.scale.width,
            height: camera.height > 0 ? camera.height : this.scene.scale.height
          };
    const screenSize: CompassScreenSize = {
      width: camera.width > 0 ? camera.width : this.scene.scale.width,
      height: camera.height > 0 ? camera.height : this.scene.scale.height
    };

    const offscreen: { target: CompassTarget; projection: CompassProjection }[] = [];
    for (const target of targets) {
      const projection = projectCompassTarget(target, view, undefined, screenSize);
      if (projection) offscreen.push({ target, projection });
    }

    offscreen.sort((a, b) => {
      const priorityDiff =
        COMPASS_STYLES[a.target.kind].priority - COMPASS_STYLES[b.target.kind].priority;
      return priorityDiff !== 0
        ? priorityDiff
        : a.projection.distance - b.projection.distance;
    });

    const visibleCount = Math.min(this.markers.length, offscreen.length);
    for (let i = 0; i < this.markers.length; i++) {
      const marker = this.markers[i];
      if (i >= visibleCount) {
        marker.graphics.setVisible(false);
        continue;
      }

      const { target, projection } = offscreen[i];
      const style = COMPASS_STYLES[target.kind];
      if (marker.kind !== target.kind) {
        this.drawBadge(marker.graphics, target.kind, style);
        marker.kind = target.kind;
      }

      const pulse = calm ? 1 : 1 + Math.sin(this.elapsed * 0.006 + i * 0.9) * 0.07;
      marker.graphics
        .setPosition(projection.screenX, projection.screenY)
        .setRotation(projection.angle)
        .setScale(style.scale * pulse)
        .setAlpha(0.95)
        .setVisible(true);
    }
  }

  destroy(): void {
    for (const marker of this.markers) {
      marker.graphics.destroy();
    }
    this.markers.length = 0;
  }

  private drawBadge(
    graphics: Phaser.GameObjects.Graphics,
    kind: CompassTargetKind,
    style: CompassStyle
  ): void {
    graphics.clear();

    // Directional chevron pointing toward +X (0 rad)
    graphics.fillStyle(style.fill, 1);
    graphics.lineStyle(2, style.stroke, 0.95);
    graphics.beginPath();
    graphics.moveTo(11, 0);
    graphics.lineTo(-4, -8);
    graphics.lineTo(-1, 0);
    graphics.lineTo(-4, 8);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();

    // Kind dot / faceted gem behind the chevron
    if (kind === 'rock') {
      graphics.fillStyle(style.fill, 1);
      graphics.lineStyle(1.75, style.stroke, 0.95);
      graphics.beginPath();
      graphics.moveTo(-7, 0);
      graphics.lineTo(-11.5, -4.5);
      graphics.lineTo(-16, 0);
      graphics.lineTo(-11.5, 4.5);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    } else {
      graphics.fillStyle(style.fill, 1);
      graphics.lineStyle(1.75, style.stroke, 0.95);
      graphics.fillCircle(-10, 0, kind === 'relic' ? 4.8 : 4);
      graphics.strokeCircle(-10, 0, kind === 'relic' ? 4.8 : 4);
    }

    graphics.fillStyle(style.core, 0.95);
    graphics.fillCircle(kind === 'rock' ? -11.5 : -10, 0, kind === 'relic' ? 2.1 : 1.7);
  }
}
