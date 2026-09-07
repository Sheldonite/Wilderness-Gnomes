import Phaser from 'phaser';
import { PLAYER_CHARACTERS } from '../config/playerCharacters';
import { MYSTERY_SPRITE_KEY, MYSTERY_POUNCE_SPRITE_KEY } from '../config/companionSprite';

/** Development-only contact sheet uses the exact in-game animation definitions. */
export function showSpriteReview(scene: Phaser.Scene): void {
  const root = document.getElementById('ui-root')!; root.innerHTML = '';
  const names = ['idle', 'down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left', 'down-left'];
  const vectors = [[0, 0], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
  const columns = scene.scale.width / 9;
  scene.add.text(20, 12, 'DEVELOPMENT · Original likeness & animation review', { fontSize: '16px', color: '#efdab1' });
  ['Code Wizard', 'Hailey', 'Mystery · walking', 'Mystery · pouncing'].forEach((label, row) => {
    const y = 65 + row * 160;
    scene.add.text(16, y, label, { fontSize: '13px', color: '#efdab1' });
    names.forEach((name, col) => {
      const x = columns * (col + .5);
      scene.add.line(x, y + 115, -43, 0, 43, 0, 0x718062);
      let sprite: Phaser.GameObjects.Sprite;
      if (row < 2) {
        const character = PLAYER_CHARACTERS[row === 0 ? 'wizard' : 'hailey'];
        const choice = col ? character.animationForDirection({ x: vectors[col][0], y: vectors[col][1] }) : character.idleAnimation;
        sprite = scene.add.sprite(x, y + 66, character.textureKey).setScale(row ? .4 : .45).setFlipX(Boolean(choice.flipX));
        sprite.play(choice.key);
      } else {
        const pounce = row === 3;
        sprite = scene.add.sprite(x, y + 66, pounce ? MYSTERY_POUNCE_SPRITE_KEY : MYSTERY_SPRITE_KEY).setScale(1.2);
        sprite.play(pounce ? `mystery-pounce-${col ? name : 'down'}` : col ? `mystery-walk-${name}` : 'mystery-idle');
      }
      scene.add.text(x, y + 124, name, { fontSize: '10px', color: '#c8d1ba' }).setOrigin(.5, 0);
    });
  });
}
