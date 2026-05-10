import Phaser from 'phaser';

export class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 94, 'Wilderness Gnomes', {
        color: '#f5e8c5',
        fontFamily: 'Georgia, serif',
        fontSize: '56px'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 20, 'WASD to move. Magic fires on its own.', {
        color: '#c9b992',
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 50, 'Press SPACE or ENTER to begin', {
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px'
      })
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('GameScene'));
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('GameScene'));
    this.input.once('pointerdown', () => this.scene.start('GameScene'));
  }
}
