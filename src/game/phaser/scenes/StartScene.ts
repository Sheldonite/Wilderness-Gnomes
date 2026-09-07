import Phaser from 'phaser';
import { PLAYER_CHARACTERS, type PlayerCharacterId } from '../../config/playerCharacters';
import { ART } from '../../config/presentation';
import { WEAPONS, type WeaponDefinition } from '../../config/weapons';
import type { WeaponId } from '../../core/types';
import { icon } from '../../ui/icons';
import { showSpriteReview } from '../../ui/SpriteReview';
import { showMidnightReview } from '../../ui/MidnightReview';
import { marketProgress } from '../../core/MarketProgress';

export class StartScene extends Phaser.Scene {
  private selectedCharacterId: PlayerCharacterId = 'wizard';
  private selectedWeaponId: WeaponId = 'spell';
  private root?: HTMLElement;
  private starting = false;
  private reviewActive = false;
  private readonly keyboardHandler = (event: KeyboardEvent) => {
    if (event.code === 'Digit1') this.selectCharacter('wizard');
    if (event.code === 'Digit2') this.selectCharacter('hailey');
    if (event.code === 'Digit3') this.selectWeapon('spell');
    if (event.code === 'Digit4') this.selectWeapon('crossbow');
    // Native focused buttons retain their normal Enter/Space behavior.
    if ((event.code === 'Space' || event.code === 'Enter') && !(document.activeElement instanceof HTMLButtonElement)) {
      event.preventDefault(); this.startGame();
    }
  };

  constructor() { super('StartScene'); }

  create(data: { skipReview?: boolean } = {}): void {
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'market') {
      this.scene.start('MarketScene', { characterId: this.selectedCharacterId, weaponId: this.selectedWeaponId, review: true }); return;
    }
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'midnight-sprites') { showMidnightReview(this); return; }
    this.reviewActive = import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).has('review');
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'sprites') { showSpriteReview(this); return; }
    this.starting = false;
    marketProgress.refresh();
    document.getElementById('game-root')?.classList.remove('in-run');
    this.root = document.getElementById('ui-root')!;
    this.root.innerHTML = `
      <main class="title-screen" style="--title-art: url('${ART.title}')">
        <header class="title-masthead">
          <span class="brand-mark">${icon('leaf')} <span>WILDERNESS GNOMES</span></span>
          <button class="title-market-link" type="button">${icon('gold')} <span>${marketProgress.profile.gold} gold</span> <i></i> ${icon('market')} Market Day</button>
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
          <fieldset class="weapon-selection">
            <legend>CHOOSE YOUR ARM</legend>
            <div class="weapon-cards">
              ${this.weaponCard(WEAPONS.spell)}
              ${this.weaponCard(WEAPONS.crossbow)}
            </div>
          </fieldset>
          <button class="begin-button" type="button">Begin Adventure ${icon('arrow')}</button>
          <p class="begin-hint">PRESS <kbd>SPACE</kbd> OR <kbd>ENTER</kbd> TO BEGIN</p>
        </section>
        <footer class="title-footer">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to wander <i></i> Your arm fires on its own</span>
          <span class="mystery-hint">${icon('paw')} A familiar friend awaits an upgrade.</span>
        </footer>
        <div class="title-pollen" aria-hidden="true">${'<i></i>'.repeat(12)}</div>
      </main>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => button.addEventListener('click', () => this.selectCharacter(button.dataset.character as PlayerCharacterId)));
    this.root.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(button => button.addEventListener('click', () => this.selectWeapon(button.dataset.weapon as WeaponId)));
    this.root.querySelector('.begin-button')!.addEventListener('click', () => this.startGame());
    this.root.querySelector('.title-market-link')!.addEventListener('click', () => {
      if (this.starting) return; this.starting = true;
      this.scene.start('MarketScene', { characterId: this.selectedCharacterId, weaponId: this.selectedWeaponId });
    });
    window.addEventListener('keydown', this.keyboardHandler);
    this.selectCharacter(this.selectedCharacterId);
    this.selectWeapon(this.selectedWeaponId);
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

  private weaponCard(weapon: WeaponDefinition): string {
    const portrait = this.textures.exists(weapon.armTexture ?? weapon.texture)
      ? this.textures.getBase64(weapon.armTexture ?? weapon.texture)
      : this.textures.getBase64(weapon.texture);
    return `<button class="weapon-card" type="button" data-weapon="${weapon.id}" aria-pressed="false">
      <span class="choice-key">${weapon.key}</span><span class="selection-tick" aria-hidden="true">✓</span>
      <span class="weapon-portrait"><img src="${portrait}" alt="" class="portrait-${weapon.id}"></span>
      <span class="wanderer-copy"><strong>${weapon.name}</strong><small>${weapon.description}</small></span>
    </button>`;
  }

  private selectCharacter(id: PlayerCharacterId): void {
    this.selectedCharacterId = id;
    this.root?.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => {
      const selected = button.dataset.character === id;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
  }

  private selectWeapon(id: WeaponId): void {
    this.selectedWeaponId = id;
    this.root?.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(button => {
      const selected = button.dataset.weapon === id;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
  }

  private startGame(): void {
    if (this.starting) return;
    this.starting = true;
    const review = this.reviewActive ? new URLSearchParams(location.search) : null;
    const reviewCharacter = review?.get('character');
    const reviewWeapon = review?.get('weapon');
    this.scene.start('GameScene', {
      characterId: reviewCharacter === 'hailey' ? 'hailey' : this.selectedCharacterId,
      weaponId: reviewWeapon === 'crossbow' ? 'crossbow' : this.selectedWeaponId,
      skipReview: !this.reviewActive
    });
  }
}
