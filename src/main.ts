import Phaser from 'phaser';
import { GAME_CONFIG } from './game/config/gameConfig';
import { BootScene } from './game/phaser/scenes/BootScene';
import { GameScene } from './game/phaser/scenes/GameScene';
import { StartScene } from './game/phaser/scenes/StartScene';
import './styles.css';
import { installPerformanceReadout } from './game/ui/PerformanceReadout';

installPerformanceReadout();

// Development aid: `?renderer=canvas` forces the Canvas renderer for environments without WebGL.
const forceCanvas = import.meta.env.DEV && new URLSearchParams(location.search).get('renderer') === 'canvas';

new Phaser.Game({
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: GAME_CONFIG.backgroundColor,
  pixelArt: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_CONFIG.viewport.width,
    height: GAME_CONFIG.viewport.height
  },
  scene: [BootScene, StartScene, GameScene]
});
