import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.createPlaceholderTextures();
    this.scene.start('StartScene');
  }

  private createPlaceholderTextures(): void {
    const graphics = this.add.graphics();

    graphics.clear();
    graphics.fillStyle(0x26321f, 1);
    graphics.lineStyle(3, 0xd9c08f, 1);
    graphics.fillEllipse(24, 26, 30, 40);
    graphics.strokeEllipse(24, 26, 30, 40);
    graphics.fillStyle(0xf3e2b3, 1);
    graphics.fillCircle(30, 17, 4);
    graphics.generateTexture('player-placeholder', 48, 52);

    graphics.clear();
    graphics.fillStyle(0x3a201f, 1);
    graphics.lineStyle(3, 0x8d5b45, 1);
    graphics.fillEllipse(18, 18, 30, 28);
    graphics.strokeEllipse(18, 18, 30, 28);
    graphics.lineStyle(2, 0x17100e, 1);
    graphics.lineBetween(9, 13, 2, 8);
    graphics.lineBetween(27, 13, 34, 8);
    graphics.generateTexture('enemy-placeholder', 36, 36);

    graphics.clear();
    graphics.fillStyle(0x86d8e6, 1);
    graphics.lineStyle(2, 0xe8fbff, 1);
    graphics.fillCircle(8, 8, 7);
    graphics.strokeCircle(8, 8, 7);
    graphics.generateTexture('projectile-placeholder', 16, 16);

    graphics.clear();
    graphics.fillStyle(0x79c6cf, 1);
    graphics.lineStyle(2, 0xd6fbff, 1);
    graphics.fillCircle(8, 8, 6);
    graphics.strokeCircle(8, 8, 6);
    graphics.generateTexture('xp-placeholder', 16, 16);

    graphics.destroy();
  }
}
