import Phaser from 'phaser';
import { MIDNIGHT_DIRECTIONS, MIDNIGHT_SPRITE_KEY, midnightScale } from '../config/midnightSprite';
import { MYSTERY_SPRITE_KEY } from '../config/companionSprite';

export function showMidnightReview(scene: Phaser.Scene): void {
  document.getElementById('ui-root')!.innerHTML = '';
  scene.add.text(24, 20, 'MIDNIGHT · Walk & grounded paw swat', { fontSize: '20px', color: '#ffefcb' });
  const column = scene.scale.width / 4;
  for (let row = 0; row < 2; row++) MIDNIGHT_DIRECTIONS.forEach((direction, i) => {
    const x = column * (i + .5), y = 145 + row * 230;
    scene.add.line(x, y + 48, -60, 0, 60, 0, 0x718062);
    const sprite = scene.add.sprite(x, y, MIDNIGHT_SPRITE_KEY).setScale(midnightScale(scene) * 2);
    const action = row ? 'swat' : 'walk';
    sprite.play({ key: `midnight-${action}-${direction}`, repeat: -1 });
    scene.add.text(x, y + 90, `${action} · ${direction}`, { fontSize: '16px', color: '#efdab1' }).setOrigin(.5, 0);
  });
  scene.add.text(24, 540, 'In-game size: Mystery / Midnight', { fontSize: '14px', color: '#efdab1' });
  scene.add.sprite(340, 560, MYSTERY_SPRITE_KEY).setScale(.72).play('mystery-walk-down');
  scene.add.sprite(410, 560, MIDNIGHT_SPRITE_KEY).setScale(midnightScale(scene)).play('midnight-walk-down');
}
