import Phaser from 'phaser';
import type { Vector2Like } from '../core/types';

export class PlayerAura {
  private readonly container: Phaser.GameObjects.Container;
  private readonly outerRing: Phaser.GameObjects.Arc;
  private readonly innerRing: Phaser.GameObjects.Arc;
  private readonly motes: Phaser.GameObjects.Arc[] = [];
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene, position: Vector2Like) {
    this.container = scene.add.container(position.x, position.y);
    this.container.setDepth(18);

    this.outerRing = scene.add.circle(0, 8, 36);
    this.outerRing.setStrokeStyle(2, 0x5dc8ff, 0.42);
    this.outerRing.setFillStyle(0x000000, 0);

    this.innerRing = scene.add.circle(0, 8, 24);
    this.innerRing.setStrokeStyle(2, 0xf4c96b, 0.34);
    this.innerRing.setFillStyle(0x000000, 0);

    this.container.add([this.outerRing, this.innerRing]);

    for (let i = 0; i < 8; i += 1) {
      const mote = scene.add.circle(0, 0, i % 2 === 0 ? 3 : 2, i % 2 === 0 ? 0x6bd8ff : 0xf7cf75, 0.72);
      this.motes.push(mote);
      this.container.add(mote);
    }
  }

  update(deltaMs: number, position: Vector2Like): void {
    this.elapsedMs += deltaMs;
    this.container.setPosition(position.x, position.y + 8);

    const t = this.elapsedMs / 1000;
    this.outerRing.setScale(1 + Math.sin(t * 2.2) * 0.05, 0.52 + Math.cos(t * 1.7) * 0.03);
    this.innerRing.setScale(1 + Math.cos(t * 2.7) * 0.05, 0.5 + Math.sin(t * 1.9) * 0.03);
    this.outerRing.setRotation(t * 0.75);
    this.innerRing.setRotation(-t * 1.05);

    for (let i = 0; i < this.motes.length; i += 1) {
      const angle = t * (1.1 + i * 0.05) + i * ((Math.PI * 2) / this.motes.length);
      const radius = 24 + (i % 3) * 6;
      const mote = this.motes[i];
      mote.setPosition(Math.cos(angle) * radius, 8 + Math.sin(angle) * radius * 0.42);
      mote.setAlpha(0.45 + Math.sin(t * 3 + i) * 0.22);
    }
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
