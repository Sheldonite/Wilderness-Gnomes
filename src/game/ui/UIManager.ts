import { isBossAbility } from '../config/bossAbilities';
import { ownedUpgrades, upgradeRank, upgradeName, upgradeBenefit, upgradePreview, upgradeSummary, upgradeChanges, isAbility, isRanked, upgradeMaxRank } from '../core/UpgradeProgress';
import type { GameManager } from '../core/GameManager';
import type { HudSnapshot, UpgradeDefinition, UpgradeSource } from '../core/types';
import type { PlayerCharacterDefinition } from '../config/playerCharacters';
import { formatTime } from '../utils/math';
import { icon, UPGRADE_ICONS } from './icons';
import { ABILITY_IDS, ABILITY_NAMES, describeAbility, MAX_ABILITY_RANK } from '../config/abilities';
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
  private buildFingerprint = "";
  private receiptUntil = 0;
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
    private readonly midnightPortrait: string,
    private readonly frankiePortrait: string
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
        <div class="build-strip" role="list" aria-label="Your current upgrades" hidden></div><div class="upgrade-receipt" role="status" hidden></div><div class="run-location">THE GOLDEN WOODS <span>•</span> WANDER & WONDER</div>
      </div>`;
    this.healthFill = this.query('.health-fill'); this.xpFill = this.query('.xp-fill');
    this.healthValue = this.query('.health-value'); this.xpValue = this.query('.xp-value');
    this.level = this.query('.level-seal'); this.time = this.query('.time-stat b'); this.kills = this.query('.kill-stat b');
    this.pauseButton = this.query<HTMLButtonElement>('.pause-button');
    this.pauseButton.addEventListener('click', onTogglePause);
    window.addEventListener('keydown', this.onKey);
  }

  update(snapshot: HudSnapshot): void {
    if (this.receiptUntil && this.gameManager.elapsedMs >= this.receiptUntil) { this.query('.upgrade-receipt').hidden = true; this.receiptUntil = 0; }
    this.refreshBuild();
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

  showPaused(onResume: () => void, onMainMenu: () => void): void {
    const list = this.createOverlay('A moment of quiet', 'The woodland will wait for you.', 'ADVENTURE PAUSED', 'leaf', 'pause-panel');
    list.innerHTML = '<p class="pause-instruction">Take a breath. Your journey continues when you’re ready.</p>';
    const arm = WEAPONS[this.gameManager.playerStats.weaponId];
    list.insertAdjacentHTML('beforeend', `<p class="companion-journal">${icon(arm.icon)} ${arm.name} · ${arm.shortTrait}</p>`);
    const friends = [this.gameManager.playerStats.hasMysteryCompanion ? 'Mystery · pounce' : '',
      this.gameManager.playerStats.hasMidnightCompanion ? 'Midnight · swat' : '',
      this.gameManager.playerStats.hasFrankieCompanion ? `Frankie · ${upgradeBenefit('gain-companion-frankie', this.gameManager.playerStats)}` : ''].filter(Boolean);
    if (friends.length) list.insertAdjacentHTML('beforeend', `<p class="companion-journal">${icon('paw')} ${friends.join(' &nbsp; / &nbsp; ')}</p>`);
    const stats = this.gameManager.playerStats;
    const owned = ownedUpgrades(stats).filter(id => !id.startsWith('gain-companion'));
    if (owned.length) list.insertAdjacentHTML('beforeend', `<div class="ability-journal" role="region" tabindex="0" aria-label="Your upgrades">${owned.map(id =>
      `<div class="journal-ability"><span class="journal-icon">${icon(UPGRADE_ICONS[id])}</span><span><strong>${upgradeName(id, stats)}</strong><small>${isRanked(id) ? `Rank ${upgradeRank(id, stats)} of ${upgradeMaxRank(id)}${isBossAbility(id) ? ' · BOSS RELIC' : upgradeRank(id, stats) === MAX_ABILITY_RANK ? ' · ASCENDED' : upgradeRank(id, stats) >= 5 ? ' · AWAKENED' : ''}` : `Upgraded ${upgradeRank(id, stats)} times`}</small><span class="journal-description">${upgradeBenefit(id, stats)}</span></span></div>`).join('')}</div>`);
    this.addButton(list, 'Back to the woods', onResume, true);
    this.addButton(list, 'Main Menu', onMainMenu, false);
    list.insertAdjacentHTML('beforeend', '<p class="overlay-hint">Returning to the menu ends this run. Earned gold and rocks are kept.</p>');
    list.insertAdjacentHTML('beforeend', '<p class="overlay-hint">PRESS <kbd>ESC</kbd> TO RESUME</p>');
    this.focusFirst();
  }

  hideOverlay(): void { this.clearOverlay(); }

  showLevelUp(choices: UpgradeDefinition[], onChoose: (choice: UpgradeDefinition) => void, source: UpgradeSource = 'level'): void {
    const chest = source !== 'level', boss = source === 'boss';
    const list = this.createOverlay(boss ? 'Boss relic' : chest ? 'Treasure!' : 'Level up!',
      boss ? 'Choose one relic.' : chest ? 'Choose a free upgrade.' : 'Choose an upgrade.',
      boss ? 'BOSS DEFEATED' : chest ? 'FREE UPGRADE' : `LEVEL ${this.gameManager.level}`, chest ? 'chest' : 'star', 'upgrade-panel');
    list.classList.add('upgrade-grid');
    let selected = false;
    choices.forEach((choice, index) => {
      const progress = upgradePreview(choice, this.gameManager.playerStats);
      const button = document.createElement('button'); button.type = 'button'; button.className = `upgrade-card ${progress.current ? 'owned-upgrade' : 'new-upgrade'}`;
      const isMystery = choice.id === 'gain-companion-mystery';
      const isMidnight = choice.id === 'gain-companion-midnight';
      const isFrankie = choice.id === 'gain-companion-frankie' || choice.id === 'frankie-flock';
      const isCompanion = isMystery || isMidnight || isFrankie;
      if (isCompanion) button.classList.add('epic-companion');
      if (isBossAbility(choice.id)) button.classList.add('boss-relic');
      const portrait = isMidnight ? this.midnightPortrait : isFrankie ? this.frankiePortrait : this.mysteryPortrait;
      const name = isMidnight ? 'Midnight' : isFrankie ? 'Frankie' : 'Mystery';
      const artIcon = this.gameManager.playerStats.weaponId === 'crossbow'
        ? (CROSSBOW_STAT_UPGRADES[choice.id]?.icon ?? UPGRADE_ICONS[choice.id])
        : UPGRADE_ICONS[choice.id];
      const summary = upgradeSummary(choice, this.gameManager.playerStats);
      const changes = progress.current || choice.id === 'midnight-mighty-swat' || isFrankie ? upgradeChanges(choice, this.gameManager.playerStats) : '';
      button.title = choice.description;
      button.innerHTML = `<span class="upgrade-number">0${index + 1}</span><span class="upgrade-art ${isCompanion ? 'companion-art' : ''}">${isCompanion ? `<img src="${portrait}" alt="${name}">` : icon(artIcon)}</span><span class="upgrade-category">${boss ? 'BOSS RELIC' : isCompanion ? 'COMPANION' : progress.current ? 'UPGRADE' : 'NEW'}</span><strong>${upgradeName(choice.id, this.gameManager.playerStats)}</strong>${progress.capped ? `<span class="upgrade-rank">Rank ${progress.current} &rarr; ${progress.next} / ${progress.maxRank}${isAbility(choice.id) && progress.next === MAX_ABILITY_RANK ? ' · ASCENSION' : isAbility(choice.id) && progress.next === 5 ? ' · AWAKENING' : ''}</span>` : isCompanion && choice.id !== 'frankie-flock' ? '<span class="upgrade-rank">One-time unlock</span>' : `<span class="upgrade-rank">Picks ${progress.current} &rarr; ${progress.next}</span>`}<span class="upgrade-description">${summary}</span>${changes ? `<span class="upgrade-changes">${changes}</span>` : ''}<span class="upgrade-select">Choose ${icon('arrow')}</span>`;
      const select = () => {
        if (selected) return; selected = true;
        this.clearOverlay(); onChoose(choice); this.refreshBuild();
        const receipt = this.query('.upgrade-receipt');
        receipt.innerHTML = `<strong>${choice.title} · Rank ${progress.next}${progress.capped ? `/${progress.maxRank}` : ''}</strong><span>${progress.before} &rarr; ${progress.after}</span>`;
        receipt.hidden = false; this.receiptUntil = this.gameManager.elapsedMs + 4000;
      };
      button.addEventListener('click', select); this.choices.push(select); list.append(button);
    });
    const owned = ownedUpgrades(this.gameManager.playerStats);
    if (owned.length) list.insertAdjacentHTML('afterend', `<div class="upgrade-owned-list" aria-label="Already in your build"><strong>YOUR BUILD</strong>${owned.map(id => `<span>${upgradeName(id, this.gameManager.playerStats)} <b>${upgradeRank(id, this.gameManager.playerStats)}${isRanked(id) ? `/${upgradeMaxRank(id)}` : '×'}</b></span>`).join('')}</div>`);
    list.insertAdjacentHTML('afterend', '<p class="overlay-hint"><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> · or click</p>');
    this.focusFirst();
  }

  showGameOver(onRestart: () => void, onTitle: () => void, market?: { earned: number; balance: number; saved: boolean; onVisit: () => void }): void {
    const snapshot = this.gameManager.getHudSnapshot();
    const list = this.createOverlay('Every wanderer finds a way', 'Your story in the woods isn’t over yet.', 'UNTIL THE NEXT ADVENTURE', 'leaf', 'gameover-panel');
    list.innerHTML = `<div class="result-stats"><span><b>${formatTime(snapshot.elapsedSeconds)}</b>TIME IN THE WOODS</span><span><b>${snapshot.kills}</b>FOES DEFEATED</span><span><b>${snapshot.level}</b>LEVEL REACHED</span></div>`;
    if (market) {
      list.insertAdjacentHTML('beforeend', `<div class="run-gold-reward">${icon('gold')}<span><strong>+${market.earned} gold earned</strong><small>${market.balance} gold in your purse${market.saved ? '' : ' · Saved for this session'}</small></span></div><p class="gold-milestones">Level 10: 5 gold · Level 20: 10 gold<br>+1 gold for each level beyond 20</p>`);
      this.addButton(list, 'Visit Market Day', market.onVisit, true);
    }
    this.addButton(list, 'Wander again', onRestart, true); this.addButton(list, 'Choose a wanderer', onTitle, false); this.focusFirst();
  }

  destroy(): void { window.removeEventListener('keydown', this.onKey); this.root.innerHTML = ''; this.root.classList.remove('run-frozen', 'low-health'); }

  private refreshBuild(): void {
    const stats = this.gameManager.playerStats;
    const key = JSON.stringify([stats.abilityRanks, stats.bossAbilityRanks, stats.upgradeCounts, stats.hasMysteryCompanion, stats.hasMidnightCompanion, stats.hasFrankieCompanion, stats.frankieCount, stats.frankieFeatherBonus]);
    if (key === this.buildFingerprint) return;
    this.buildFingerprint = key;
    const owned = ownedUpgrades(stats), strip = this.query('.build-strip');
    strip.hidden = !owned.length;
    strip.innerHTML = owned.map(id => `<span class="build-item" role="listitem" title="${upgradeName(id, stats)} · ${upgradeBenefit(id, stats)}" aria-label="${upgradeName(id, stats)}, rank ${upgradeRank(id, stats)}${isRanked(id) ? ` of ${upgradeMaxRank(id)}` : ''}">${icon(UPGRADE_ICONS[id])}<b>${upgradeRank(id, stats)}${isRanked(id) ? `/${upgradeMaxRank(id)}` : '×'}</b>${id === 'gain-companion-frankie' ? `<span class="feather-bonus">+${stats.frankieFeatherBonus} feather damage</span>` : ''}</span>`).join('');
  }

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
