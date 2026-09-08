import Phaser from 'phaser';
import { mountDesktopUpdates } from '../../../desktop/updates';
import { PLAYER_CHARACTERS, type PlayerCharacterId } from '../../config/playerCharacters';
import { COMPANION_NAMES } from '../../config/companions';
import { ART } from '../../config/presentation';
import type { WeaponId } from '../../core/types';
import { icon } from '../../ui/icons';
import { showSpriteReview } from '../../ui/SpriteReview';
import { showMidnightReview } from '../../ui/MidnightReview';
import { marketProgress } from '../../core/MarketProgress';
import { showSheldonReview } from '../../ui/SheldonReview';

export class StartScene extends Phaser.Scene {
  private selectedCharacterId: PlayerCharacterId = 'wizard';
  private selectedWeaponId: WeaponId = 'spell';
  private root?: HTMLElement;
  private starting = false;
  private reviewActive = false;
  private readonly keyboardHandler = (event: KeyboardEvent) => {
    if (event.code === 'Digit1') this.selectCharacter('wizard');
    if (event.code === 'Digit2') this.selectCharacter('hailey');
    if (event.code === 'Digit5') this.selectCharacter('sheldon');
    if (event.code === 'Digit6') this.selectCharacter('ron');
    // Native focused buttons retain their normal Enter/Space behavior.
    if ((event.code === 'Space' || event.code === 'Enter') && !(document.activeElement instanceof HTMLButtonElement)) {
      event.preventDefault(); this.startGame();
    }
  };

  constructor() { super('StartScene'); }

  create(data: { skipReview?: boolean } = {}): void {
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'sheldon') { showSheldonReview(this); return; }
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'market') {
      this.scene.start('MarketScene', { characterId: this.selectedCharacterId, weaponId: this.selectedWeaponId, review: true }); return;
    }
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'midnight-sprites') { showMidnightReview(this); return; }
    this.reviewActive = import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).has('review');
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'sprites') { showSpriteReview(this); return; }
    this.starting = false;
    marketProgress.refresh();
    if(!marketProgress.characterUnlocked(this.selectedCharacterId)) this.selectedCharacterId='wizard';
    this.selectedWeaponId=marketProgress.equippedWeapon;
    document.getElementById('game-root')?.classList.remove('in-run');
    this.root = document.getElementById('ui-root')!;
    this.root.innerHTML = `
      <main class="title-screen" style="--title-art: url('${ART.title}')">
        <header class="title-masthead">
          <span class="brand-mark">${icon('leaf')} <span>WILDERNESS GNOMES</span></span>
          <div class="title-wallet"><button class="title-market-link" type="button" aria-label="Visit Market Day. You have ${marketProgress.profile.gold.toLocaleString()} gold.">
            <span class="title-gold-balance">${icon('gold')}<span><small>YOUR GOLD</small><strong>${marketProgress.profile.gold.toLocaleString()}</strong></span></span>
            <span class="title-market-invite">${icon('market')}<span><strong>Market Day</strong><small>Gear, style & new wanderers</small></span></span>
            <span class="title-market-arrow">${icon('arrow')}</span>
          </button><span class="title-rock-balance">${icon('rock')} <strong>${marketProgress.profile.rocks.toLocaleString()} rare rocks</strong><small>Kept between runs</small></span></div>
        </header>
        <section class="title-content" aria-label="Start your adventure">
          <div class="eyebrow title-eyebrow"><span></span> A LITTLE MAGIC. A WILD ADVENTURE. <span></span></div>
          <h1>Wilderness<span>Gnomes</span></h1>
          <p class="title-intro">Wander into the golden woods.<br>Find your magic. See how long you can stay.</p>
          <fieldset class="wanderer-selection">
            <legend>CHOOSE YOUR WANDERER</legend>
            <div class="wanderer-cards">
              ${this.characterCard('wizard', '1')}
              ${this.characterCard('hailey', '2')}
              ${this.characterCard('sheldon', '5')}
              ${this.characterCard('ron', '6')}
            </div>
          </fieldset>
          <button class="title-weapons-link" type="button">Choose your weapon at Market Day ${icon('arrow')}</button>
          <button class="begin-button" type="button">Begin Adventure ${icon('arrow')}</button>
          <p class="begin-hint">PRESS <kbd>SPACE</kbd> OR <kbd>ENTER</kbd> TO BEGIN</p>
        </section>
        <footer class="title-footer">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to wander <i></i> Your arm fires on its own</span>
          <span class="mystery-hint">${icon('paw')} Your companion grows stronger every three levels.</span>
        </footer>
        <div class="title-pollen" aria-hidden="true">${'<i></i>'.repeat(12)}</div>
      </main>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => button.addEventListener('click', () => this.selectCharacter(button.dataset.character as PlayerCharacterId)));
    this.root.querySelector('.title-weapons-link')!.addEventListener('click', () => {
      if (this.starting) return; this.starting=true;
      this.scene.start('MarketScene', {characterId:this.selectedCharacterId, vendorId:'forge'});
    });
    this.root.querySelector('.begin-button')!.addEventListener('click', () => this.startGame());
    this.root.querySelector('.title-market-link')!.addEventListener('click', () => {
      if (this.starting) return; this.starting = true;
      this.scene.start('MarketScene', { characterId: this.selectedCharacterId, weaponId: this.selectedWeaponId });
    });
    window.addEventListener('keydown', this.keyboardHandler);
    const unmountUpdates = mountDesktopUpdates(this.root.querySelector('.title-screen')!);
    this.selectCharacter(this.selectedCharacterId);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.keyboardHandler);
      unmountUpdates();
      this.root!.innerHTML = '';
    });
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).has('review')) this.startGame();
  }

  private characterCard(id: PlayerCharacterId, key: string): string {
    const character = PLAYER_CHARACTERS[id];
    // Each card names the companion, because choosing a wanderer now chooses a companion too.
    const description = `${character.blurb} With ${COMPANION_NAMES[character.companionId]}.`;
    const portrait = this.textures.getBase64(character.textureKey, 0);
    return `<button class="wanderer-card" type="button" data-character="${id}" aria-pressed="false">
      <span class="choice-key">${key}</span><span class="selection-tick" aria-hidden="true">✓</span>
      <span class="wanderer-portrait"><img src="${portrait}" alt="" class="portrait-${id}"></span>
      <span class="wanderer-copy"><strong>${character.name}</strong><small>${description}</small></span>
    </button>`;
  }

  private selectCharacter(id: PlayerCharacterId): void {
    // Every wanderer is on the roster from the first run, so there is nothing to unlock here.
    this.selectedCharacterId = id;
    this.root?.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => {
      const selected = button.dataset.character === id;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
  }

  private startGame(): void {
    if (this.starting) return;
    marketProgress.refresh();
    if (!this.reviewActive) {
      if (!marketProgress.characterUnlocked(this.selectedCharacterId)) this.selectedCharacterId='wizard';
      this.selectedWeaponId=marketProgress.equippedWeapon;
    }
    this.starting = true;
    const review = this.reviewActive ? new URLSearchParams(location.search) : null;
    const reviewCharacter = review?.get('character');
    const reviewWeapon = review?.get('weapon');
    this.scene.start('GameScene', {
      characterId: review?.get('review') === 'ron' ? 'ron' : ['sheldon', 'hailey', 'ron'].includes(reviewCharacter ?? '') ? reviewCharacter! : this.selectedCharacterId,
      weaponId: reviewWeapon === 'crossbow' ? 'crossbow' : this.selectedWeaponId,
      skipReview: !this.reviewActive
    });
  }
}
