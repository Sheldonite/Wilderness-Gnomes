import type { GameManager } from '../core/GameManager';
import type { HudSnapshot, UpgradeDefinition } from '../core/types';
import type { PlayerCharacterDefinition } from '../config/playerCharacters';
import { formatTime } from '../utils/math';
import { icon, UPGRADE_ICONS } from './icons';
import { ABILITY_IDS, ABILITY_NAMES, describeAbility } from '../config/abilities';
import { CROSSBOW_STAT_UPGRADES, WEAPONS } from '../config/weapons';

export class UIManager {
  private readonly root: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly healthValue: HTMLElement;
  private readonly xpValue: HTMLElement;
  private readonly level: HTMLElement;
  private readonly time: HTMLElement;
  private readonly kills: HTMLElement;
  private readonly pauseButton: HTMLButtonElement;
  private overlay?: HTMLElement;
  private previousFocus?: HTMLElement;
  private choices: (() => void)[] = [];
  private lastSnapshot = '';
  private readonly onKey = (event: KeyboardEvent) => {
    if (!this.overlay) return;
    const index = Number(event.key) - 1;
    if (index >= 0 && index < this.choices.length) { event.preventDefault(); this.choices[index](); return; }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(this.overlay.querySelectorAll<HTMLElement>('button,[tabindex="0"]'));
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  constructor(
    private readonly gameManager: GameManager,
    onTogglePause: () => void,
    character: PlayerCharacterDefinition,
    portrait: string,
    private readonly mysteryPortrait: string,
    private readonly midnightPortrait: string
  ) {
    this.root = document.getElementById('ui-root')!;
    this.root.innerHTML = `
      <div class="game-ui">
        <section class="health-hud" aria-label="${character.name} health">
          <div class="hud-portrait"><img src="${portrait}" alt=""></div>
          <div class="health-info"><div class="health-heading"><strong>${character.name}</strong><span class="health-value"></span></div>
            <div class="health-track" role="progressbar" aria-label="Health" aria-valuemin="0"><div class="health-fill"></div></div>
          </div>
        </section>
        <div class="run-stats"><span class="time-stat">${icon('clock')}<b>0:00</b></span><i></i><span class="kill-stat">${icon('leaf')}<b>0</b><small>FOES</small></span></div>
        <button class="pause-button" type="button" aria-label="Pause game">${icon('pause')}<span>Pause</span><kbd>ESC</kbd></button>
        <div class="xp-hud"><span class="level-seal">1</span><div class="xp-meta"><span>WOODLAND WISDOM</span><span class="xp-value"></span></div>
          <div class="xp-track" role="progressbar" aria-label="Experience" aria-valuemin="0"><div class="xp-fill"></div></div>
        </div>
        <div class="run-location">THE GOLDEN WOODS <span>•</span> WANDER & WONDER</div>
      </div>`;
    this.healthFill = this.query('.health-fill'); this.xpFill = this.query('.xp-fill');
    this.healthValue = this.query('.health-value'); this.xpValue = this.query('.xp-value');
    this.level = this.query('.level-seal'); this.time = this.query('.time-stat b'); this.kills = this.query('.kill-stat b');
    this.pauseButton = this.query<HTMLButtonElement>('.pause-button');
    this.pauseButton.addEventListener('click', onTogglePause);
    window.addEventListener('keydown', this.onKey);
  }

  update(snapshot: HudSnapshot): void {
    const fingerprint = JSON.stringify(snapshot);
    if (fingerprint === this.lastSnapshot) return;
    this.lastSnapshot = fingerprint;
    this.healthFill.style.transform = `scaleX(${Math.max(0, Math.min(1, snapshot.health / snapshot.maxHealth))})`;
    this.xpFill.style.transform = `scaleX(${Math.max(0, Math.min(1, snapshot.xp / snapshot.xpToNextLevel))})`;
    this.healthValue.textContent = `${Math.ceil(snapshot.health)} / ${snapshot.maxHealth}`;
    this.xpValue.textContent = `${snapshot.xp} / ${snapshot.xpToNextLevel} XP`;
    this.level.textContent = String(snapshot.level); this.level.setAttribute('aria-label', `Level ${snapshot.level}`);
    this.time.textContent = formatTime(snapshot.elapsedSeconds); this.kills.textContent = String(snapshot.kills);
    for (const [selector, value, max] of [['.health-track', snapshot.health, snapshot.maxHealth], ['.xp-track', snapshot.xp, snapshot.xpToNextLevel]] as const) {
      const element = this.query(selector); element.setAttribute('aria-valuenow', String(value)); element.setAttribute('aria-valuemax', String(max));
    }
    this.root.classList.toggle('low-health', snapshot.health / snapshot.maxHealth < .25);
  }

  setPauseButtonState(paused: boolean): void {
    this.pauseButton.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    this.pauseButton.querySelector('span')!.textContent = paused ? 'Resume' : 'Pause';
    this.root.classList.toggle('run-frozen', this.gameManager.state !== 'Playing');
  }

  showPaused(onResume: () => void): void {
    const list = this.createOverlay('A moment of quiet', 'The woodland will wait for you.', 'ADVENTURE PAUSED', 'leaf', 'pause-panel');
    list.innerHTML = '<p class="pause-instruction">Take a breath. Your journey continues when you’re ready.</p>';
    const arm = WEAPONS[this.gameManager.playerStats.weaponId];
    list.insertAdjacentHTML('beforeend', `<p class="companion-journal">${icon(arm.icon)} ${arm.name} · ${arm.shortTrait}</p>`);
    const friends = [this.gameManager.playerStats.hasMysteryCompanion ? 'Mystery · pounce' : '',
      this.gameManager.playerStats.hasMidnightCompanion ? 'Midnight · swat' : ''].filter(Boolean);
    if (friends.length) list.insertAdjacentHTML('beforeend', `<p class="companion-journal">${icon('paw')} ${friends.join(' &nbsp; / &nbsp; ')}</p>`);
    const ranks = this.gameManager.playerStats.abilityRanks;
    const owned = ABILITY_IDS.filter(id => ranks[id] > 0);
    if (owned.length) list.insertAdjacentHTML('beforeend', `<div class="ability-journal" role="region" tabindex="0" aria-label="Your abilities">${owned.map(id =>
      `<div class="journal-ability"><span class="journal-icon">${icon(UPGRADE_ICONS[id])}</span><span><strong>${ABILITY_NAMES[id]}</strong><small>Rank ${ranks[id]} of 3</small><span class="journal-description">${describeAbility(id, ranks[id], this.gameManager.playerStats.weaponId)}</span></span></div>`).join('')}</div>`);
    this.addButton(list, 'Back to the woods', onResume, true);
    list.insertAdjacentHTML('beforeend', '<p class="overlay-hint">PRESS <kbd>ESC</kbd> TO RESUME</p>');
    this.focusFirst();
  }

  hideOverlay(): void { this.clearOverlay(); }

  showLevelUp(choices: UpgradeDefinition[], onChoose: (choice: UpgradeDefinition) => void): void {
    const list = this.createOverlay('A little more magic', 'The woods have a gift for you. Choose your next blessing.', `LEVEL ${this.gameManager.level} · WOODLAND WISDOM`, 'star', 'upgrade-panel');
    list.classList.add('upgrade-grid');
    choices.forEach((choice, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'upgrade-card';
      const isMystery = choice.id === 'gain-companion-mystery';
      const isMidnight = choice.id === 'gain-companion-midnight';
      const isCompanion = isMystery || isMidnight;
      const portrait = isMidnight ? this.midnightPortrait : this.mysteryPortrait;
      const name = isMidnight ? 'Midnight' : 'Mystery';
      const artIcon = this.gameManager.playerStats.weaponId === 'crossbow'
        ? (CROSSBOW_STAT_UPGRADES[choice.id]?.icon ?? UPGRADE_ICONS[choice.id])
        : UPGRADE_ICONS[choice.id];
      button.innerHTML = `<span class="upgrade-number">0${index + 1}</span><span class="upgrade-art ${isCompanion ? 'companion-art' : ''}">${isCompanion ? `<img src="${portrait}" alt="${name}, your tortoiseshell companion">` : icon(artIcon)}</span><span class="upgrade-category">${choice.category ?? (isCompanion ? 'A FAMILIAR FRIEND' : 'WOODLAND BLESSING')}</span><strong>${choice.title}</strong><span class="upgrade-description">${choice.description}</span><span class="upgrade-select">Choose blessing ${icon('arrow')}</span>`;
      const select = () => { this.choices = []; onChoose(choice); this.clearOverlay(); };
      button.addEventListener('click', select); this.choices.push(select); list.append(button);
    });
    list.insertAdjacentHTML('afterend', '<p class="overlay-hint">CHOOSE WITH <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> OR CLICK A CARD</p>');
    this.focusFirst();
  }

  showGameOver(onRestart: () => void, onTitle: () => void): void {
    const snapshot = this.gameManager.getHudSnapshot();
    const list = this.createOverlay('Every wanderer finds a way', 'Your story in the woods isn’t over yet.', 'UNTIL THE NEXT ADVENTURE', 'leaf', 'gameover-panel');
    list.innerHTML = `<div class="result-stats"><span><b>${formatTime(snapshot.elapsedSeconds)}</b>TIME IN THE WOODS</span><span><b>${snapshot.kills}</b>FOES DEFEATED</span><span><b>${snapshot.level}</b>LEVEL REACHED</span></div>`;
    this.addButton(list, 'Wander again', onRestart, true); this.addButton(list, 'Choose a wanderer', onTitle, false); this.focusFirst();
  }

  destroy(): void { window.removeEventListener('keydown', this.onKey); this.root.innerHTML = ''; this.root.classList.remove('run-frozen', 'low-health'); }

  private createOverlay(title: string, body: string, eyebrow: string, emblem: string, className: string): HTMLElement {
    this.clearOverlay(); this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.overlay = document.createElement('div'); this.overlay.className = 'storybook-overlay';
    this.overlay.innerHTML = `<section class="storybook-panel ${className}" role="dialog" aria-modal="true" aria-labelledby="overlay-title" aria-describedby="overlay-body"><span class="panel-emblem">${icon(emblem)}</span><p class="eyebrow">${eyebrow}</p><h2 id="overlay-title">${title}</h2><p id="overlay-body" class="panel-intro">${body}</p><div class="panel-actions"></div></section>`;
    this.root.append(this.overlay); return this.overlay.querySelector('.panel-actions')!;
  }

  private addButton(parent: Element, label: string, action: () => void, primary: boolean): void {
    const button = document.createElement('button'); button.type = 'button'; button.className = primary ? 'primary-button' : 'text-button';
    button.innerHTML = `${label} ${primary ? icon('arrow') : ''}`; button.addEventListener('click', action); parent.append(button);
  }

  private focusFirst(): void { this.overlay?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }); }
  private clearOverlay(): void { this.overlay?.remove(); this.overlay = undefined; this.choices = []; this.previousFocus?.focus({ preventScroll: true }); this.previousFocus = undefined; }
  private query<T extends HTMLElement = HTMLElement>(selector: string): T { return this.root.querySelector<T>(selector)!; }
}
