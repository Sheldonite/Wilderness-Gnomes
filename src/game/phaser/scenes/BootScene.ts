import Phaser from 'phaser';
import playerSpriteSheetUrl from '../../../assets/sprites/code-wizard-main-spritesheet.png';
import squirrelEnemySpriteSheetUrl from '../../../assets/sprites/squirrel-enemy-spritesheet.png';
import groundForestTileUrl from '../../../assets/terrain/ground-forest-tile.png';
import forestPropsSheetUrl from '../../../assets/terrain/forest-props-sheet.png';
import waterBridgeSheetUrl from '../../../assets/terrain/water-bridge-sheet.png';
import {
  ENEMY_ANIMATION_PREFIX,
  ENEMY_ANIMATION_ROWS,
  ENEMY_FRAMES_PER_ROW,
  ENEMY_FRAME_SIZE,
  ENEMY_SPRITE_KEY
} from '../../config/enemySprite';
import {
  applyPlayerSpriteAdjustments,
  PLAYER_ANIMATION_PREFIX,
  PLAYER_ANIMATION_ROWS,
  PLAYER_FRAMES_PER_ROW,
  PLAYER_FRAME_SIZE,
  PLAYER_SPRITE_KEY
} from '../../config/playerSprite';
import {
  TERRAIN_FEATURE_FRAME_SIZE,
  TERRAIN_GROUND_KEY,
  TERRAIN_PROPS_KEY,
  TERRAIN_WATER_KEY
} from '../../config/terrainSprites';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.spritesheet(PLAYER_SPRITE_KEY, playerSpriteSheetUrl, {
      frameWidth: PLAYER_FRAME_SIZE,
      frameHeight: PLAYER_FRAME_SIZE
    });
    this.load.spritesheet(ENEMY_SPRITE_KEY, squirrelEnemySpriteSheetUrl, {
      frameWidth: ENEMY_FRAME_SIZE,
      frameHeight: ENEMY_FRAME_SIZE
    });
    this.load.image(TERRAIN_GROUND_KEY, groundForestTileUrl);
    this.load.spritesheet(TERRAIN_PROPS_KEY, forestPropsSheetUrl, {
      frameWidth: TERRAIN_FEATURE_FRAME_SIZE,
      frameHeight: TERRAIN_FEATURE_FRAME_SIZE
    });
    this.load.spritesheet(TERRAIN_WATER_KEY, waterBridgeSheetUrl, {
      frameWidth: TERRAIN_FEATURE_FRAME_SIZE,
      frameHeight: TERRAIN_FEATURE_FRAME_SIZE
    });
  }

  create(): void {
    this.createPlaceholderTextures();
    applyPlayerSpriteAdjustments(this);
    this.createPlayerAnimations();
    this.createEnemyAnimations();
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

  private createEnemyAnimations(): void {
    for (const [name, row, frameRate] of ENEMY_ANIMATION_ROWS) {
      const key = `${ENEMY_ANIMATION_PREFIX}-${name}`;
      if (this.anims.exists(key)) {
        continue;
      }

      const start = row * ENEMY_FRAMES_PER_ROW;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(ENEMY_SPRITE_KEY, {
          start,
          end: start + ENEMY_FRAMES_PER_ROW - 1
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
