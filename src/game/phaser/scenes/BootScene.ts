import Phaser from 'phaser';
import playerSpriteSheetUrl from '../../../assets/sprites/code-wizard-main-spritesheet.png';

const PLAYER_SPRITE_KEY = 'player-code-wizard';
const PLAYER_ANIMATION_PREFIX = 'player';
const PLAYER_FRAME_SIZE = 96;
const PLAYER_FRAMES_PER_ROW = 4;

const PLAYER_ANIMATION_ROWS = [
  ['idle-down', 0, 6],
  ['walk-down', 1, 8],
  ['walk-down-right', 2, 8],
  ['walk-right', 3, 8],
  ['walk-up-right', 4, 8],
  ['walk-up', 5, 8],
  ['walk-up-left', 6, 8],
  ['walk-left', 7, 8],
  ['walk-down-left', 8, 8]
] as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.spritesheet(PLAYER_SPRITE_KEY, playerSpriteSheetUrl, {
      frameWidth: PLAYER_FRAME_SIZE,
      frameHeight: PLAYER_FRAME_SIZE
    });
  }

  create(): void {
    this.createPlaceholderTextures();
    this.createPlayerAnimations();
    this.scene.start('StartScene');
  }

  private createPlayerAnimations(): void {
    for (const [name, row, frameRate] of PLAYER_ANIMATION_ROWS) {
      const key = `${PLAYER_ANIMATION_PREFIX}-${name}`;
      if (this.anims.exists(key)) {
        continue;
      }

      const start = row * PLAYER_FRAMES_PER_ROW;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(PLAYER_SPRITE_KEY, {
          start,
          end: start + PLAYER_FRAMES_PER_ROW - 1
        }),
        frameRate,
        repeat: -1
      });
    }
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
