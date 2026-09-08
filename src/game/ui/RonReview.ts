import Phaser from 'phaser';
import { RON_DIRECTIONS, RON_FRAMES } from '../core/RonFrames';
import { RON_SPRITE_KEY, RON_REFERENCE_TEXTURE } from '../config/ronSprite';

/** Every still here comes from the same keyed, aligned atlas used in live gameplay. */
export function showRonReview(scene: Phaser.Scene): void {
  const params = new URLSearchParams(location.search);
  const direction = RON_DIRECTIONS.find(id => id === params.get('direction')) ?? 'south';
  const frames = RON_FRAMES.filter(frame => frame.direction === direction);
  const root = document.getElementById('ui-root')!;
  const original = scene.textures.getBase64(RON_REFERENCE_TEXTURE);
  root.innerHTML = `<main class="sheldon-review"><header><div><small>DEVELOPMENT · EXACT GAME FRAMES</small><h1>Ron · ${direction}</h1></div><a href="/">Return to game</a></header><nav>${RON_DIRECTIONS.map(id => `<a href="?review=ron-sprites&direction=${id}" ${id === direction ? 'aria-current="page"' : ''}>${id}</a>`).join('')}</nav><p>Character reference at left. Generated game frame at right. Four idle frames, followed by eight walking frames.</p><section class="sheldon-contact">${frames.map(frame => `<article class="sheldon-frame-card" data-frame="${frame.id}"><h2>${frame.id}</h2><div class="sheldon-comparison"><figure><img src="${original}" alt="Approved Ron reference"><figcaption>CHARACTER REFERENCE</figcaption></figure><figure><img class="sheldon-rendered" src="${scene.textures.getBase64(RON_SPRITE_KEY, frame.index)}" alt="${frame.id}"><figcaption>GAME FRAME ${frame.index}</figcaption></figure></div></article>`).join('')}</section><section class="sheldon-live"><h2>Live animation</h2><div id="sheldon-live-image"></div><button data-mode="idle">Idle</button><button data-mode="walk">Walk</button><button data-pause>Pause / resume</button><p class="sheldon-live-label"></p></section></main>`;
  const sprite = scene.add.sprite(-1000, -1000, RON_SPRITE_KEY);
  if(params.has('motion')) {
    root.querySelector<HTMLElement>('.sheldon-contact')!.hidden=true;
    const live=root.querySelector<HTMLElement>('.sheldon-live')!;
    live.insertAdjacentHTML('afterbegin',`<img src="${original}" alt="Character reference" style="float:left;width:240px;height:320px;object-fit:contain">`);
  }
  sprite.play(`ron-walk-${direction}`);
  const preview = document.createElement('img'); preview.alt = `Animated Ron facing ${direction}`;
  root.querySelector('#sheldon-live-image')!.append(preview);
  const update = () => {
    preview.src = scene.textures.getBase64(RON_SPRITE_KEY, sprite.frame.name);
    root.querySelector('.sheldon-live-label')!.textContent = `${sprite.anims.currentAnim?.key} · frame ${sprite.frame.name}`;
  };
  sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, update); update();
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.onclick = () => { sprite.play(`ron-${button.dataset.mode}-${direction}`); update(); });
  root.querySelector<HTMLButtonElement>('[data-pause]')!.onclick = () => sprite.anims.isPaused ? sprite.anims.resume() : sprite.anims.pause();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { sprite.destroy(); root.innerHTML = ''; });
}
