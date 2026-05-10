import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config/gameConfig';
import type { Vector2Like } from '../../core/types';

export class CameraController {
  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera) {
    this.camera.setBounds(0, 0, GAME_CONFIG.arena.width, GAME_CONFIG.arena.height);
    this.camera.setZoom(1);
  }

  update(target: Vector2Like): void {
    this.camera.scrollX = Phaser.Math.Linear(this.camera.scrollX, target.x - this.camera.width / 2, 0.08);
    this.camera.scrollY = Phaser.Math.Linear(this.camera.scrollY, target.y - this.camera.height / 2, 0.08);
  }
}
