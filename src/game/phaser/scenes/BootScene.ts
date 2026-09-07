import Phaser from 'phaser';
import { ART } from '../../config/presentation';
import { createStorybookTextures } from '../storybookTextures';
import playerSpriteSheetUrl from '../../../assets/sprites/code-wizard-main-spritesheet.png';
import haileySpriteSheetUrl from '../../../assets/sprites/Hailey-Walk.png';
import squirrelEnemySpriteSheetUrl from '../../../assets/sprites/squirrel-enemy-spritesheet.png';
import familiarCatSpriteSheetUrl from '../../../assets/sprites/familiar-cat-spritesheet.png';
import familiarCatPounceSpriteSheetUrl from '../../../assets/sprites/familiar-cat-pounce-spritesheet.png';
import {
  MYSTERY_ANIMATION_PREFIX,
  alignMysteryFrames,
  MYSTERY_FRAMES_PER_ROW,
  MYSTERY_FRAME_SIZE,
  MYSTERY_MOVEMENT_ANIMATION_ROWS,
  MYSTERY_POUNCE_ANIMATION_ROWS,
  MYSTERY_POUNCE_SPRITE_KEY,
  MYSTERY_SPRITE_KEY
} from '../../config/companionSprite';
import {
  HAILEY_ANIMATION_PREFIX,
  HAILEY_FRAME_HEIGHT,
  HAILEY_FRAME_WIDTH,
  HAILEY_SPRITE_KEY
} from '../../config/playerCharacters';
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

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    const root = document.getElementById('ui-root')!;
    root.innerHTML = '<div class="loading-screen"><span class="loading-leaf">❧</span><h1>Wilderness Gnomes</h1><p>Waking the woodland…</p><div class="loading-track"><span></span></div></div>';
    const fill = root.querySelector<HTMLElement>('.loading-track span')!;
    this.load.on('progress', (value: number) => { fill.style.transform = `scaleX(${value})`; });
    this.load.on('loaderror', () => { root.querySelector('p')!.textContent = 'A woodland asset could not load. Please refresh to try again.'; });
    this.load.image('storybook-title', ART.title);
    this.load.image('storybook-ground-source', ART.ground);
    this.load.image('storybook-props-source', ART.props);
    this.load.image('storybook-water-source', ART.water);
    this.load.image('storybook-bridge-source', ART.bridge);
    this.load.spritesheet(PLAYER_SPRITE_KEY, playerSpriteSheetUrl, {
      frameWidth: PLAYER_FRAME_SIZE,
      frameHeight: PLAYER_FRAME_SIZE
    });
    this.load.spritesheet(HAILEY_SPRITE_KEY, haileySpriteSheetUrl, {
      frameWidth: HAILEY_FRAME_WIDTH,
      frameHeight: HAILEY_FRAME_HEIGHT,
      spacing: 0,
      margin: 0
    });
    this.load.spritesheet(ENEMY_SPRITE_KEY, squirrelEnemySpriteSheetUrl, {
      frameWidth: ENEMY_FRAME_SIZE,
      frameHeight: ENEMY_FRAME_SIZE
    });
    this.load.spritesheet(MYSTERY_SPRITE_KEY, familiarCatSpriteSheetUrl, {
      frameWidth: MYSTERY_FRAME_SIZE,
      frameHeight: MYSTERY_FRAME_SIZE
    });
    this.load.spritesheet(MYSTERY_POUNCE_SPRITE_KEY, familiarCatPounceSpriteSheetUrl, {
      frameWidth: MYSTERY_FRAME_SIZE,
      frameHeight: MYSTERY_FRAME_SIZE
    });
  }

  create(): void {
    createStorybookTextures(this);
    [HAILEY_SPRITE_KEY, ENEMY_SPRITE_KEY, MYSTERY_SPRITE_KEY, MYSTERY_POUNCE_SPRITE_KEY].forEach(key => this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST));
    // The wizard sheet is authored at 192px and drawn at ~40%; linear filtering keeps the downscale smooth.
    this.textures.get(PLAYER_SPRITE_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
    applyPlayerSpriteAdjustments(this);
    alignMysteryFrames(this);
    this.createPlayerAnimations();
    this.createHaileyAnimations();
    this.createEnemyAnimations();
    this.createMysteryAnimations();
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

  private createHaileyAnimations(): void {
    const animations = [
      ['idle-down', 0, 0, 4],
      ['walk-down', 0, 3, 8],
      ['idle-right', 4, 4, 4],
      ['walk-right', 4, 7, 8],
      ['idle-up', 8, 8, 4],
      ['walk-up', 8, 11, 8]
    ] as const;

    for (const [name, start, end, frameRate] of animations) {
      const key = `${HAILEY_ANIMATION_PREFIX}-${name}`;
      if (this.anims.exists(key)) {
        continue;
      }

      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(HAILEY_SPRITE_KEY, { start, end }),
        frameRate,
        repeat: -1
      });
    }
  }

  private createMysteryAnimations(): void {
    for (const [name, row, frameRate] of MYSTERY_MOVEMENT_ANIMATION_ROWS) {
      const key = `${MYSTERY_ANIMATION_PREFIX}-${name}`;
      if (this.anims.exists(key)) {
        continue;
      }

      const start = row * MYSTERY_FRAMES_PER_ROW;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(MYSTERY_SPRITE_KEY, {
          start,
          end: start + MYSTERY_FRAMES_PER_ROW - 1
        }),
        frameRate,
        repeat: -1
      });
    }

    for (const [name, row, frameRate] of MYSTERY_POUNCE_ANIMATION_ROWS) {
      const key = `${MYSTERY_ANIMATION_PREFIX}-${name}`;
      if (this.anims.exists(key)) {
        continue;
      }

      const start = row * MYSTERY_FRAMES_PER_ROW;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(MYSTERY_POUNCE_SPRITE_KEY, {
          start,
          end: start + MYSTERY_FRAMES_PER_ROW - 1
        }),
        frameRate,
        repeat: -1
      });
    }
  }

}
