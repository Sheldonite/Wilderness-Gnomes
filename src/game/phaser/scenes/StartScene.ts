import Phaser from 'phaser';
import { mountDesktopUpdates } from '../../../desktop/updates';
import { PLAYER_CHARACTERS, type PlayerCharacterId } from '../../config/playerCharacters';
import { COMPANION_NAMES } from '../../config/companions';
import { COSMETIC_SLOTS, getMarketItem } from '../../config/marketItems';
import { ART } from '../../config/presentation';
import { WEAPONS, type WeaponDefinition } from '../../config/weapons';
import { icon } from '../../ui/icons';
import { showSpriteReview } from '../../ui/SpriteReview';
import { showMidnightReview } from '../../ui/MidnightReview';
import { marketProgress, type AnyWeaponId } from '../../core/MarketProgress';
import { audioSystem } from '../../systems/AudioSystem';
import { showRonReview } from '../../ui/RonReview';
import { showSheldonReview } from '../../ui/SheldonReview';

const CHARACTER_ORDER: readonly PlayerCharacterId[] = ['wizard', 'hailey', 'sheldon', 'ron'];

const FALLBACK_WEAPONS: Record<AnyWeaponId, { name: string; icon: string }> = {
  spell: { name: 'Spell Charm', icon: 'spell' },
  crossbow: { name: 'Heartwood Crossbow', icon: 'crossbow' },
  boomerang: { name: 'Timber Boomerang', icon: 'spin' },
  lantern: { name: "Will-o'-Wisp Lantern", icon: 'firefly' }
};

function weaponDisplay(id: AnyWeaponId): { name: string; icon: string } {
  const def = (WEAPONS as Record<string, WeaponDefinition | undefined>)[id];
  return def ? { name: def.name, icon: def.icon } : (FALLBACK_WEAPONS[id] ?? { name: id, icon: 'spell' });
}

function soundSvg(muted: boolean): string {
  return muted
    ? '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h6l7-6v20l-7-6H5Z"/><path d="m22 12 6 8m0-8-6 8"/></svg>'
    : '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h6l7-6v20l-7-6H5Z"/><path d="M22 11c2.8 2.8 2.8 7.2 0 10m3.8-13.5c4.6 4.7 4.6 12.3 0 17"/></svg>';
}

export class StartScene extends Phaser.Scene {
  private selectedCharacterId: PlayerCharacterId = 'wizard';
  private selectedWeaponId: AnyWeaponId = 'spell';
  private soundMuted = false;
  private root?: HTMLElement;
  private starting = false;
  private reviewActive = false;
  private readonly keyboardHandler = (event: KeyboardEvent) => {
    if (event.code === 'Digit1') this.selectCharacter('wizard', true);
    if (event.code === 'Digit2') this.selectCharacter('hailey', true);
    if (event.code === 'Digit3') this.selectCharacter('sheldon', true);
    if (event.code === 'Digit4') this.selectCharacter('ron', true);
    if (event.code === 'ArrowLeft') { event.preventDefault(); this.cycleCharacter(-1); }
    if (event.code === 'ArrowRight') { event.preventDefault(); this.cycleCharacter(1); }
    // Native focused buttons retain their normal Enter/Space behavior.
    if ((event.code === 'Space' || event.code === 'Enter') && !(document.activeElement instanceof HTMLButtonElement)) {
      event.preventDefault(); this.startGame();
    }
  };

  constructor() { super('StartScene'); }

  create(data: { skipReview?: boolean; characterId?: PlayerCharacterId; weaponId?: AnyWeaponId } = {}): void {
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'ron-sprites') { showRonReview(this); return; }
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'sheldon') { showSheldonReview(this); return; }
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'market') {
      this.scene.start('MarketScene', { characterId: this.selectedCharacterId, weaponId: this.selectedWeaponId, review: true }); return;
    }
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'midnight-sprites') { showMidnightReview(this); return; }
    this.reviewActive = import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).has('review');
    if (import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).get('review') === 'sprites') { showSpriteReview(this); return; }
    this.starting = false;
    marketProgress.refresh();
    if (data.characterId && marketProgress.characterUnlocked(data.characterId)) this.selectedCharacterId = data.characterId;
    if (!marketProgress.characterUnlocked(this.selectedCharacterId)) this.selectedCharacterId = 'wizard';
    this.selectedWeaponId = (data.weaponId && marketProgress.weaponUnlocked(data.weaponId))
      ? data.weaponId
      : marketProgress.equippedWeapon;
    audioSystem.attachScene(this);
    audioSystem.setMusicMode('title');
    this.soundMuted = audioSystem.isMuted();
    if (this.sound) this.sound.mute = this.soundMuted;

    const equippedWeapon = weaponDisplay(this.selectedWeaponId);
    const equippedCosmetics = marketProgress.equippedCosmetics;
    const activeCosmeticNames = COSMETIC_SLOTS
      .map(slot => equippedCosmetics[slot])
      .filter((id): id is NonNullable<typeof id> => Boolean(id))
      .map(id => getMarketItem(id)?.name ?? id);
    const cosmeticSummary = activeCosmeticNames.length ? activeCosmeticNames.join(' · ') : 'None equipped';

    document.getElementById('game-root')?.classList.remove('in-run');
    this.root = document.getElementById('ui-root')!;
    this.root.innerHTML = `
      <main class="title-screen" style="--title-art: url('${ART.title}')">
        <header class="title-masthead">
          <div class="title-brand-group">
            <span class="brand-mark">${icon('leaf')} <span>WILDERNESS GNOMES</span></span>
            <button class="title-sound-toggle" type="button" aria-pressed="${this.soundMuted}" aria-label="${this.soundMuted ? 'Unmute sound' : 'Mute sound'}"></button>
          </div>
          <div class="title-wallet"><button class="title-market-link" type="button" aria-label="Visit Market Day. You have ${marketProgress.profile.gold.toLocaleString()} gold.">
            <span class="title-gold-balance">${icon('gold')}<span><small>YOUR GOLD</small><strong>${marketProgress.profile.gold.toLocaleString()}</strong></span></span>
            <span class="title-market-invite">${icon('market')}<span><strong>Market Day</strong><small>Gear, style & charms</small></span></span>
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
              ${this.characterCard('sheldon', '3')}
              ${this.characterCard('ron', '4')}
            </div>
          </fieldset>
          <div class="title-loadout" aria-label="Equipped gear and cosmetics">
            <button class="title-weapons-link" type="button">
              ${icon(equippedWeapon.icon)}
              <span><small>EQUIPPED ARM</small><strong>${equippedWeapon.name}</strong></span>
              <span class="title-loadout-action">Change ${icon('arrow')}</span>
            </button>
            <button class="title-cosmetics-badge ${activeCosmeticNames.length ? 'has-cosmetics' : ''}" type="button" aria-label="Style and cosmetics: ${cosmeticSummary}. Open Outfitter at Market Day.">
              ${icon('star')}
              <span><small>STYLE</small><strong>${cosmeticSummary}</strong></span>
            </button>
          </div>
          <button class="begin-button" type="button">Begin Adventure ${icon('arrow')}</button>
          <p class="begin-hint">PRESS <kbd>SPACE</kbd> OR <kbd>ENTER</kbd> TO BEGIN</p>
        </section>
        <footer class="title-footer">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to wander <i></i> Your arm fires on its own</span>
          <span class="mystery-hint">${icon('paw')} Your companion grows stronger every three levels.</span>
        </footer>
        <div class="title-pollen" aria-hidden="true">${'<i></i>'.repeat(12)}</div>
      </main>`;
    this.refreshSoundToggle();
    this.root.querySelector('.title-sound-toggle')!.addEventListener('click', () => this.toggleSoundMute());
    this.root.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => button.addEventListener('click', () => this.selectCharacter(button.dataset.character as PlayerCharacterId, true)));
    this.root.querySelector('.title-weapons-link')!.addEventListener('click', () => {
      if (this.starting) return; this.starting = true;
      audioSystem.play('ui-click');
      this.scene.start('MarketScene', { characterId: this.selectedCharacterId, weaponId: this.selectedWeaponId, vendorId: 'forge' });
    });
    this.root.querySelector('.title-cosmetics-badge')!.addEventListener('click', () => {
      if (this.starting) return; this.starting = true;
      audioSystem.play('ui-click');
      this.scene.start('MarketScene', { characterId: this.selectedCharacterId, weaponId: this.selectedWeaponId, vendorId: 'outfitter' });
    });
    this.root.querySelector('.begin-button')!.addEventListener('click', () => this.startGame());
    this.root.querySelector('.title-market-link')!.addEventListener('click', () => {
      if (this.starting) return; this.starting = true;
      audioSystem.play('ui-click');
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

  private toggleSoundMute(): void {
    this.soundMuted = audioSystem.toggleMute();
    if (this.sound) this.sound.mute = this.soundMuted;
    if (!this.soundMuted) audioSystem.play('ui-click');
    this.refreshSoundToggle();
    try {
      window.dispatchEvent(new CustomEvent('wilderness-gnomes:sound-changed', { detail: { muted: this.soundMuted } }));
    } catch { /* Safe fallback if CustomEvent is unavailable. */ }
  }

  private refreshSoundToggle(): void {
    const button = this.root?.querySelector<HTMLButtonElement>('.title-sound-toggle');
    if (!button) return;
    button.setAttribute('aria-pressed', String(this.soundMuted));
    button.setAttribute('aria-label', this.soundMuted ? 'Unmute sound' : 'Mute sound');
    button.classList.toggle('is-muted', this.soundMuted);
    button.innerHTML = `${soundSvg(this.soundMuted)}<span>${this.soundMuted ? 'Muted' : 'Sound'}</span>`;
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

  private cycleCharacter(step: -1 | 1): void {
    const index = CHARACTER_ORDER.indexOf(this.selectedCharacterId);
    const next = CHARACTER_ORDER[(Math.max(0, index) + step + CHARACTER_ORDER.length) % CHARACTER_ORDER.length];
    const keepCardFocus = Boolean(document.activeElement?.closest('.wanderer-cards'));
    this.selectCharacter(next, true);
    if (keepCardFocus) {
      this.root?.querySelector<HTMLButtonElement>(`[data-character="${next}"]`)?.focus({ preventScroll: true });
    }
  }

  private selectCharacter(id: PlayerCharacterId, playSfx = false): void {
    // Every wanderer is on the roster from the first run, so there is nothing to unlock here.
    this.selectedCharacterId = id;
    if (playSfx) audioSystem.play('ui-click');
    this.root?.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => {
      const selected = button.dataset.character === id;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
  }

  private startGame(): void {
    if (this.starting) return;
    audioSystem.play('ui-click');
    marketProgress.refresh();
    if (!this.reviewActive) {
      if (!marketProgress.characterUnlocked(this.selectedCharacterId)) this.selectedCharacterId = 'wizard';
      this.selectedWeaponId = marketProgress.equippedWeapon;
    }
    this.starting = true;
    const review = this.reviewActive ? new URLSearchParams(location.search) : null;
    const reviewCharacter = review?.get('character');
    const reviewWeapon = review?.get('weapon');
    const validWeapons: readonly AnyWeaponId[] = ['spell', 'crossbow', 'boomerang', 'lantern'];
    this.scene.start('GameScene', {
      characterId: review?.get('review') === 'ron' ? 'ron' : ['sheldon', 'hailey', 'ron'].includes(reviewCharacter ?? '') ? reviewCharacter! : this.selectedCharacterId,
      weaponId: validWeapons.includes(reviewWeapon as AnyWeaponId) ? (reviewWeapon as AnyWeaponId) : this.selectedWeaponId,
      skipReview: !this.reviewActive
    });
  }
}
