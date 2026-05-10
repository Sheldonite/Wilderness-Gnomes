import Phaser from 'phaser';
import { GAME_CONFIG } from './game/config/gameConfig';
import { BootScene } from './game/phaser/scenes/BootScene';
import { GameScene } from './game/phaser/scenes/GameScene';
import { StartScene } from './game/phaser/scenes/StartScene';
import './styles.css';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: GAME_CONFIG.backgroundColor,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_CONFIG.viewport.width,
    height: GAME_CONFIG.viewport.height
  },
  scene: [BootScene, StartScene, GameScene]
});
