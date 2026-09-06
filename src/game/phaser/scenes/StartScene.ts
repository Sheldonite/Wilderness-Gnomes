import Phaser from 'phaser';
import { PLAYER_CHARACTERS, type PlayerCharacterId } from '../../config/playerCharacters';
import { ART } from '../../config/presentation';
import { icon } from '../../ui/icons';
import { showSpriteReview } from '../../ui/SpriteReview';

export class StartScene extends Phaser.Scene {
  private selectedCharacterId: PlayerCharacterId = 'wizard';
  private root?: HTMLElement;
  private starting = false;
  private reviewActive = false;
  private readonly keyboardHandler = (event: KeyboardEvent) => {
    if (event.code === 'Digit1') this.selectCharacter('wizard');
    if (event.code === 'Digit2') this.selectCharacter('hailey');
    // Native focused buttons retain their normal Enter/Space behavior.
    if ((event.code === 'Space' || event.code === 'Enter') && !(document.activeElement instanceof HTMLButtonElement)) {
      event.preventDefault(); this.startGame();
    }
  };

  constructor() { super('StartScene'); }

  create(data: { skipReview?: boolean } = {}): void {
    this.reviewActive = import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).has('review');
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'sprites') { showSpriteReview(this); return; }
    this.starting = false;
    document.getElementById('game-root')?.classList.remove('in-run');
    this.root = document.getElementById('ui-root')!;
    this.root.innerHTML = `
      <main class="title-screen" style="--title-art: url('${ART.title}')">
        <header class="title-masthead">
          <span class="brand-mark">${icon('leaf')} <span>WILDERNESS GNOMES</span></span>
          <span class="chapter-label">A WOODLAND ADVENTURE</span>
        </header>
        <section class="title-content" aria-label="Start your adventure">
          <div class="eyebrow title-eyebrow"><span></span> A LITTLE MAGIC. A WILD ADVENTURE. <span></span></div>
          <h1>Wilderness<span>Gnomes</span></h1>
          <p class="title-intro">Wander into the golden woods.<br>Find your magic. See how long you can stay.</p>
          <fieldset class="wanderer-selection">
            <legend>CHOOSE YOUR WANDERER</legend>
            <div class="wanderer-cards">
              ${this.characterCard('wizard', 'A spark of woodland magic.', '1')}
              ${this.characterCard('hailey', 'An adventurous heart.', '2')}
            </div>
          </fieldset>
          <button class="begin-button" type="button">Begin Adventure ${icon('arrow')}</button>
          <p class="begin-hint">PRESS <kbd>SPACE</kbd> OR <kbd>ENTER</kbd> TO BEGIN</p>
        </section>
        <footer class="title-footer">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to wander <i></i> Magic fires on its own</span>
          <span class="mystery-hint">${icon('paw')} A familiar friend awaits an upgrade.</span>
        </footer>
        <div class="title-pollen" aria-hidden="true">${'<i></i>'.repeat(12)}</div>
      </main>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => button.addEventListener('click', () => this.selectCharacter(button.dataset.character as PlayerCharacterId)));
    this.root.querySelector('.begin-button')!.addEventListener('click', () => this.startGame());
    window.addEventListener('keydown', this.keyboardHandler);
    this.selectCharacter(this.selectedCharacterId);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.keyboardHandler);
      this.root!.innerHTML = '';
    });
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).has('review')) this.startGame();
  }

  private characterCard(id: PlayerCharacterId, description: string, key: string): string {
    const character = PLAYER_CHARACTERS[id];
    const portrait = this.textures.getBase64(character.textureKey, 0);
    return `<button class="wanderer-card" type="button" data-character="${id}" aria-pressed="false">
      <span class="choice-key">${key}</span><span class="selection-tick" aria-hidden="true">✓</span>
      <span class="wanderer-portrait"><img src="${portrait}" alt="" class="portrait-${id}"></span>
      <span class="wanderer-copy"><strong>${character.name}</strong><small>${description}</small></span>
    </button>`;
  }

  private selectCharacter(id: PlayerCharacterId): void {
    this.selectedCharacterId = id;
    this.root?.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => {
      const selected = button.dataset.character === id;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
  }

  private startGame(): void {
    if (this.starting) return;
    this.starting = true;
    const reviewCharacter = this.reviewActive ? new URLSearchParams(location.search).get('character') : null;
    this.scene.start('GameScene', { characterId: reviewCharacter === 'hailey' ? 'hailey' : this.selectedCharacterId, skipReview: !this.reviewActive });
  }
}
