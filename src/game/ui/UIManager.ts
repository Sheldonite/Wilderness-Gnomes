import { BALANCE } from '../config/balance';
import { isBossAbility } from '../config/bossAbilities';
import { ownedUpgrades, upgradeRank, upgradeName, upgradeBenefit, upgradePreview, upgradeSummary, upgradeChanges, isAbility, isRanked, upgradeMaxRank } from '../core/UpgradeProgress';
import type { GameManager } from '../core/GameManager';
import type { HudSnapshot, UpgradeDefinition, UpgradeId, UpgradeSource } from '../core/types';
import type { PlayerCharacterDefinition } from '../config/playerCharacters';
import { formatTime } from '../utils/math';
import { icon, UPGRADE_ICONS } from './icons';
import { ABILITY_IDS, ABILITY_NAMES, describeAbility, MAX_ABILITY_RANK } from '../config/abilities';
import { CROSSBOW_STAT_UPGRADES, WEAPONS } from '../config/weapons';
import { COMPANION_NAMES, MAX_COMPANION_RANK, describeCompanionRank, levelForCompanionRank } from '../config/companions';

export interface HudUiOptions {
  onToggleMute?: () => boolean;
  onToggleAimMode?: () => boolean;
  onDash?: () => void;
  initialMuted?: boolean;
  initialManualAim?: boolean;
}

export interface LevelUpActions {
  rerollsRemaining?: number;
  onReroll?: () => UpgradeDefinition[] | undefined;
  onSkip?: () => void;
}

export interface DamageBreakdownItem {
  id: string;
  label: string;
  damage: number;
}

interface ExtendedHudSnapshot extends HudSnapshot {
  rerollsRemaining?: number;
  dashCooldownRatio?: number;
  wardStatus?: 'locked' | 'ready' | 'protecting' | 'recharging';
  wardLeaves?: number;
  wardMaxLeaves?: number;
  shoutRemainingMs?: number;
  harvestBonus?: number;
  nextBossLevel?: number;
  nextBossName?: string;
}

const TOUCH_DEADZONE_PX = 4;

export class UIManager {
  private readonly root: HTMLElement;
  private readonly gameUi: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly healthValue: HTMLElement;
  private readonly xpValue: HTMLElement;
  private readonly level: HTMLElement;
  private readonly time: HTMLElement;
  private readonly kills: HTMLElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly muteButton: HTMLButtonElement;
  private readonly aimButton: HTMLButtonElement;
  private readonly statusStrip: HTMLElement;
  private readonly dashPill: HTMLButtonElement;
  private readonly wardPill: HTMLElement;
  private readonly shoutPill: HTMLElement;
  private readonly harvestPill: HTMLElement;
  private readonly bossMilestonePill: HTMLElement;
  private readonly touchControls: HTMLElement;
  private readonly joystickEl: HTMLElement;
  private readonly joystickBase: HTMLElement;
  private readonly joystickKnob: HTMLElement;
  private readonly touchDashButton: HTMLButtonElement;
  private readonly touchDashCooldown: HTMLElement;
  private overlay?: HTMLElement;
  private previousFocus?: HTMLElement;
  private choices: (() => void)[] = [];
  private onRerollAction?: () => void;
  private onSkipAction?: () => void;
  private buildFingerprint = '';
  private lastStatusFingerprint = '';
  private receiptUntil = 0;
  private lastSnapshot = '';
  private muted: boolean;
  private manualAim: boolean;
  private touchEnabled = false;
  private touchVector = { x: 0, y: 0 };
  private activePointerId: number | null = null;
  private activeTouchId: number | null = null;
  private suppressDashClick = false;

  private readonly onKey = (event: KeyboardEvent) => {
    if (this.isTextInput(event.target)) return;
    const noMods = !event.ctrlKey && !event.metaKey && !event.altKey;
    if (noMods && !event.repeat && (event.key === 'm' || event.key === 'M')) {
      event.preventDefault();
      this.toggleMute();
      return;
    }
    if (!this.overlay) {
      if (noMods && !event.repeat && (event.key === 'f' || event.key === 'F') && this.gameManager.state === 'Playing') {
        event.preventDefault();
        this.toggleAimMode();
      }
      return;
    }
    if (noMods && !event.repeat) {
      const index = Number(event.key) - 1;
      if (event.key >= '1' && event.key <= '9' && index >= 0 && index < this.choices.length) {
        event.preventDefault();
        this.choices[index]();
        return;
      }
      if ((event.key === 'r' || event.key === 'R') && this.onRerollAction) {
        event.preventDefault();
        this.onRerollAction();
        return;
      }
      if ((event.key === 's' || event.key === 'S' || event.key === '0') && this.onSkipAction) {
        event.preventDefault();
        this.onSkipAction();
        return;
      }
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(this.overlay.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]'));
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  private readonly onFirstTouch = () => {
    this.enableTouchControls();
  };

  private readonly onFirstTouchPointer = (event: PointerEvent) => {
    if (event.pointerType === 'touch') this.enableTouchControls();
  };

  private readonly onJoystickPointerDown = (event: PointerEvent) => {
    if (this.activeTouchId !== null || this.activePointerId !== null) return;
    if (event.button && event.button !== 0) return;
    if (event.pointerType === 'touch') this.enableTouchControls();
    this.activePointerId = event.pointerId;
    if (event.cancelable) event.preventDefault();
    this.updateJoystickFromPoint(event.clientX, event.clientY);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (this.activePointerId === null || event.pointerId !== this.activePointerId) return;
    if (event.cancelable) event.preventDefault();
    this.updateJoystickFromPoint(event.clientX, event.clientY);
  };

  private readonly onPointerEnd = (event: PointerEvent) => {
    if (this.activePointerId === null || event.pointerId !== this.activePointerId) return;
    this.resetJoystick();
  };

  private readonly onJoystickTouchStart = (event: TouchEvent) => {
    this.enableTouchControls();
    if (this.activePointerId !== null || this.activeTouchId !== null) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    this.activeTouchId = touch.identifier;
    if (event.cancelable) event.preventDefault();
    this.updateJoystickFromPoint(touch.clientX, touch.clientY);
  };

  private readonly onTouchMove = (event: TouchEvent) => {
    if (this.activeTouchId === null) return;
    const touch = this.findTouch(event.changedTouches, this.activeTouchId) ?? this.findTouch(event.touches, this.activeTouchId);
    if (!touch) return;
    if (event.cancelable) event.preventDefault();
    this.updateJoystickFromPoint(touch.clientX, touch.clientY);
  };

  private readonly onTouchEnd = (event: TouchEvent) => {
    if (this.activeTouchId === null) return;
    const touch = this.findTouch(event.changedTouches, this.activeTouchId);
    if (!touch) return;
    this.resetJoystick();
  };

  private readonly onWindowBlur = () => {
    this.resetJoystick();
  };

  constructor(
    private readonly gameManager: GameManager,
    onTogglePause: () => void,
    character: PlayerCharacterDefinition,
    portrait: string,
    private readonly companionPortrait: string,
    private readonly options?: HudUiOptions
  ) {
    this.muted = Boolean(options?.initialMuted);
    this.manualAim = Boolean(options?.initialManualAim);
    this.root = document.getElementById('ui-root')!;
    // Three quiet corners: the wanderer (with companion) top left, the clock top centre, quick controls
    // top right, unobtrusive status pills under the hero card, and a slim experience bar along the bottom.
    this.root.innerHTML = `
      <div class="game-ui">
        <section class="hero-card" aria-label="${character.name} health">
          <div class="hud-portrait"><img src="${portrait}" alt=""><span class="level-seal">1</span></div>
          <div class="hero-info">
            <div class="health-heading"><strong>${character.name}</strong><span class="health-value"></span></div>
            <div class="health-track" role="progressbar" aria-label="Health" aria-valuemin="0"><div class="health-fill"></div></div>
            <div class="companion-badge"><img src="${this.companionPortrait}" alt=""><span class="companion-name"></span><span class="companion-pips" aria-hidden="true"></span>
              <span class="visually-hidden"><span class="companion-rank"></span> <span class="companion-detail"></span></span></div>
          </div>
        </section>
        <div class="status-strip" aria-label="Active effects and cooldowns" hidden>
          <button class="status-pill dash-pill" type="button" hidden></button>
          <div class="status-pill ward-pill" hidden></div>
          <div class="status-pill buff-pill shout-pill" hidden></div>
          <div class="status-pill buff-pill harvest-pill" hidden></div>
          <div class="status-pill boss-milestone-pill" hidden></div>
        </div>
        <div class="run-stats"><span class="time-stat" aria-label="Time in the woods">${icon('clock')}<b>0:00</b></span><span class="kill-stat" aria-label="Foes defeated">${icon('leaf')}<b>0</b></span></div>
        <div class="hud-controls">
          <button class="hud-icon-button aim-button" type="button" aria-pressed="${this.manualAim}"></button>
          <button class="hud-icon-button mute-button" type="button" aria-pressed="${this.muted}"></button>
          <button class="pause-button" type="button" aria-label="Pause game" title="Pause (Esc)">${icon('pause')}<span class="visually-hidden">Pause</span></button>
        </div>
        <div class="xp-hud"><div class="xp-track" role="progressbar" aria-label="Experience" aria-valuemin="0"><div class="xp-fill"></div></div><span class="xp-value"></span></div>
        <div class="upgrade-receipt" role="status" hidden></div>
        <div class="touch-controls" hidden>
          <div class="touch-joystick" aria-label="Movement joystick">
            <div class="joystick-base"><div class="joystick-knob"></div></div>
          </div>
          <button class="touch-dash-button" type="button" aria-label="Dash">${icon('dash')}<span>Dash</span><i class="touch-dash-cooldown"></i></button>
        </div>
      </div>`;
    this.gameUi = this.query('.game-ui');
    this.healthFill = this.query('.health-fill'); this.xpFill = this.query('.xp-fill');
    this.healthValue = this.query('.health-value'); this.xpValue = this.query('.xp-value');
    this.level = this.query('.level-seal'); this.time = this.query('.time-stat b'); this.kills = this.query('.kill-stat b');
    this.pauseButton = this.query<HTMLButtonElement>('.pause-button');
    this.muteButton = this.query<HTMLButtonElement>('.mute-button');
    this.aimButton = this.query<HTMLButtonElement>('.aim-button');
    this.statusStrip = this.query('.status-strip');
    this.dashPill = this.query<HTMLButtonElement>('.dash-pill');
    this.wardPill = this.query('.ward-pill');
    this.shoutPill = this.query('.shout-pill');
    this.harvestPill = this.query('.harvest-pill');
    this.bossMilestonePill = this.query('.boss-milestone-pill');
    this.touchControls = this.query('.touch-controls');
    this.joystickEl = this.query('.touch-joystick');
    this.joystickBase = this.query('.joystick-base');
    this.joystickKnob = this.query('.joystick-knob');
    this.touchDashButton = this.query<HTMLButtonElement>('.touch-dash-button');
    this.touchDashCooldown = this.query('.touch-dash-cooldown');

    this.syncMuteButton();
    this.syncAimButton();

    this.pauseButton.addEventListener('click', (event) => {
      if (event.detail > 0) this.pauseButton.blur();
      onTogglePause();
    });
    this.muteButton.addEventListener('click', (event) => {
      if (event.detail > 0) this.muteButton.blur();
      this.toggleMute();
    });
    this.aimButton.addEventListener('click', (event) => {
      if (event.detail > 0) this.aimButton.blur();
      this.toggleAimMode();
    });
    this.dashPill.addEventListener('click', (event) => {
      if (event.detail > 0) this.dashPill.blur();
      this.triggerDash();
    });
    this.touchDashButton.addEventListener('pointerdown', (event) => {
      if (event.button && event.button !== 0) return;
      if (event.pointerType === 'touch') this.enableTouchControls();
      if (event.cancelable) event.preventDefault();
      this.suppressDashClick = true;
      this.triggerDash();
    });
    this.touchDashButton.addEventListener('touchstart', (event) => {
      this.enableTouchControls();
      if (this.suppressDashClick) return;
      if (event.cancelable) event.preventDefault();
      this.suppressDashClick = true;
      this.triggerDash();
    }, { passive: false });
    this.touchDashButton.addEventListener('click', (event) => {
      if (event.detail > 0) this.touchDashButton.blur();
      if (this.suppressDashClick) { this.suppressDashClick = false; return; }
      this.triggerDash();
    });

    this.joystickBase.addEventListener('pointerdown', this.onJoystickPointerDown);
    this.joystickBase.addEventListener('touchstart', this.onJoystickTouchStart, { passive: false });

    const coarsePointer = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
    if (coarsePointer) {
      this.enableTouchControls();
    } else {
      this.gameUi.addEventListener('touchstart', this.onFirstTouch, { passive: true });
      window.addEventListener('touchstart', this.onFirstTouch, { passive: true });
      window.addEventListener('pointerdown', this.onFirstTouchPointer, { passive: true });
    }

    window.addEventListener('keydown', this.onKey);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerEnd);
    window.addEventListener('pointercancel', this.onPointerEnd);
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd);
    window.addEventListener('touchcancel', this.onTouchEnd);
    window.addEventListener('blur', this.onWindowBlur);
  }

  update(snapshot: HudSnapshot): void {
    if (this.receiptUntil && this.gameManager.elapsedMs >= this.receiptUntil) {
      const receipt = this.root.querySelector<HTMLElement>('.upgrade-receipt');
      if (receipt) receipt.hidden = true;
      this.receiptUntil = 0;
    }
    this.refreshBuild();
    this.updateStatusStrip(snapshot);
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

  getTouchMoveVector(): { x: number; y: number } {
    if (this.overlay || this.gameManager.state !== 'Playing') return { x: 0, y: 0 };
    return { x: this.touchVector.x, y: this.touchVector.y };
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = Boolean(muted);
    this.syncMuteButton();
  }

  isManualAim(): boolean {
    return this.manualAim;
  }

  setAimMode(manual: boolean): void {
    this.manualAim = Boolean(manual);
    this.syncAimButton();
  }

  setPauseButtonState(paused: boolean): void {
    this.pauseButton.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    this.pauseButton.querySelector('span')!.textContent = paused ? 'Resume' : 'Pause';
    this.root.classList.toggle('run-frozen', this.gameManager.state !== 'Playing');
    if (this.gameManager.state !== 'Playing') this.resetJoystick();
  }

  showPaused(onResume: () => void, onMainMenu: () => void): void {
    const list = this.createOverlay('A moment of quiet', 'The woodland will wait for you.', 'ADVENTURE PAUSED', 'leaf', 'pause-panel');
    list.innerHTML = '<p class="pause-instruction">Take a breath. Your journey continues when you’re ready.</p>';
    const arm = (WEAPONS as Record<string, (typeof WEAPONS)['spell'] | undefined>)[this.gameManager.playerStats.weaponId] ?? WEAPONS.spell;
    list.insertAdjacentHTML('beforeend', `<p class="companion-journal">${icon(arm.icon)} ${arm.name} · ${arm.shortTrait}</p>`);
    const stats = this.gameManager.playerStats;
    list.insertAdjacentHTML('beforeend', `<p class="companion-journal">${icon('paw')} ${COMPANION_NAMES[stats.companionId]} · rank ${stats.companionRank} of ${MAX_COMPANION_RANK} · ${describeCompanionRank(stats.companionId, stats.companionRank, stats)}</p>`);
    const owned = ownedUpgrades(stats);
    if (owned.length) list.insertAdjacentHTML('beforeend', `<div class="ability-journal" role="region" tabindex="0" aria-label="Your upgrades">${owned.map(id =>
      `<div class="journal-ability"><span class="journal-icon">${icon(UPGRADE_ICONS[id])}</span><span><strong>${upgradeName(id, stats)}</strong><small>${isRanked(id) ? `Rank ${upgradeRank(id, stats)} of ${upgradeMaxRank(id)}${isBossAbility(id) ? ' · BOSS RELIC' : upgradeRank(id, stats) === MAX_ABILITY_RANK ? ' · ASCENDED' : upgradeRank(id, stats) >= 5 ? ' · AWAKENED' : ''}` : `Upgraded ${upgradeRank(id, stats)} times`}</small><span class="journal-description">${upgradeBenefit(id, stats)}</span></span></div>`).join('')}</div>`);
    this.addButton(list, 'Back to the woods', onResume, true);
    this.addButton(list, 'Main Menu', onMainMenu, false);
    list.insertAdjacentHTML('beforeend', '<p class="overlay-hint">Returning to the menu ends this run. Earned gold and rocks are kept.</p>');
    list.insertAdjacentHTML('beforeend', '<p class="overlay-hint">PRESS <kbd>ESC</kbd> TO RESUME</p>');
    this.focusFirst();
  }

  hideOverlay(): void { this.clearOverlay(); }

  showLevelUp(
    choices: UpgradeDefinition[],
    onChoose: (choice: UpgradeDefinition) => void,
    source: UpgradeSource = 'level',
    companionNote?: string,
    actions?: LevelUpActions
  ): void {
    const chest = source !== 'level', boss = source === 'boss';
    const list = this.createOverlay(boss ? 'Boss relic' : chest ? 'Treasure!' : 'Level up!',
      boss ? 'Choose one relic.' : chest ? 'Choose a free upgrade.' : 'Choose an upgrade.',
      boss ? 'BOSS DEFEATED' : chest ? 'FREE UPGRADE' : `LEVEL ${this.gameManager.level}`, chest ? 'chest' : 'star', 'upgrade-panel');
    list.classList.add('upgrade-grid');
    if (companionNote) list.insertAdjacentHTML('beforebegin', `<p class="companion-growth">${icon('paw')} ${companionNote}</p>`);
    let selected = false;

    const renderChoices = (currentChoices: UpgradeDefinition[], rerolled: boolean) => {
      this.choices = [];
      list.innerHTML = '';
      currentChoices.forEach((choice, index) => {
        const progress = upgradePreview(choice, this.gameManager.playerStats);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `upgrade-card ${progress.current ? 'owned-upgrade' : 'new-upgrade'}`;
        if (isBossAbility(choice.id)) button.classList.add('boss-relic');
        if (rerolled) button.classList.add('is-rerolled');
        const artIcon = this.gameManager.playerStats.weaponId === 'crossbow'
          ? (CROSSBOW_STAT_UPGRADES[choice.id]?.icon ?? UPGRADE_ICONS[choice.id])
          : UPGRADE_ICONS[choice.id];
        const summary = upgradeSummary(choice, this.gameManager.playerStats);
        const changes = progress.current ? upgradeChanges(choice, this.gameManager.playerStats) : '';
        button.title = choice.description;
        button.innerHTML = `<span class="upgrade-number">0${index + 1}</span><span class="upgrade-art">${icon(artIcon)}</span><span class="upgrade-category">${boss ? 'BOSS RELIC' : progress.current ? 'UPGRADE' : 'NEW'}</span><strong>${upgradeName(choice.id, this.gameManager.playerStats)}</strong>${progress.capped ? `<span class="upgrade-rank">Rank ${progress.current} &rarr; ${progress.next} / ${progress.maxRank}${isAbility(choice.id) && progress.next === MAX_ABILITY_RANK ? ' · ASCENSION' : isAbility(choice.id) && progress.next === 5 ? ' · AWAKENING' : ''}</span>` : `<span class="upgrade-rank">Picks ${progress.current} &rarr; ${progress.next}</span>`}<span class="upgrade-description">${summary}</span>${changes ? `<span class="upgrade-changes">${changes}</span>` : ''}<span class="upgrade-select">Choose ${icon('arrow')}</span>`;
        const select = () => {
          if (selected) return; selected = true;
          this.clearOverlay(); onChoose(choice); this.refreshBuild();
          this.showReceipt(
            `${choice.title} · Rank ${progress.next}${progress.capped ? `/${progress.maxRank}` : ''}`,
            `${progress.before} &rarr; ${progress.after}`
          );
        };
        button.addEventListener('click', select);
        this.choices.push(select);
        list.append(button);
      });
    };

    renderChoices(choices, false);

    const panel = list.parentElement;
    if (panel && actions && (actions.onReroll || actions.onSkip)) {
      const actionBar = document.createElement('div');
      actionBar.className = 'levelup-actions';
      let rerollsLeft = Math.max(0, actions.rerollsRemaining ?? 0);

      if (actions.onReroll) {
        const rerollButton = document.createElement('button');
        rerollButton.type = 'button';
        rerollButton.className = 'levelup-action-button reroll-button';
        const syncReroll = () => {
          rerollButton.disabled = rerollsLeft <= 0;
          rerollButton.innerHTML = `${icon('reroll')}<span>Reroll</span><b class="reroll-count">${rerollsLeft}</b><kbd>R</kbd>`;
          rerollButton.setAttribute('aria-label', `Reroll choices (${rerollsLeft} remaining)`);
        };
        const triggerReroll = () => {
          if (selected || rerollsLeft <= 0) return;
          const nextChoices = actions.onReroll?.();
          if (!nextChoices || nextChoices.length === 0) {
            syncReroll();
            return;
          }
          rerollsLeft = Math.max(0, rerollsLeft - 1);
          renderChoices(nextChoices, true);
          syncReroll();
          if (rerollsLeft <= 0) this.focusFirst();
        };
        syncReroll();
        rerollButton.addEventListener('click', triggerReroll);
        this.onRerollAction = triggerReroll;
        actionBar.append(rerollButton);
      }

      if (actions.onSkip) {
        const skipButton = document.createElement('button');
        skipButton.type = 'button';
        skipButton.className = 'levelup-action-button skip-button';
        skipButton.innerHTML = `${icon('leaf')}<span>Skip <small>(+15 HP, +1 Gold)</small></span><kbd>S</kbd>`;
        skipButton.setAttribute('aria-label', 'Skip upgrade for +15 HP and +1 Gold');
        const triggerSkip = () => {
          if (selected) return;
          selected = true;
          this.clearOverlay();
          actions.onSkip?.();
          this.refreshBuild();
          this.showReceipt('Upgrade skipped', '+15 HP · +1 Gold');
        };
        skipButton.addEventListener('click', triggerSkip);
        this.onSkipAction = triggerSkip;
        actionBar.append(skipButton);
      }

      panel.append(actionBar);
    }

    const owned = ownedUpgrades(this.gameManager.playerStats);
    const hintParts = ['<kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>'];
    if (actions?.onReroll) hintParts.push('<kbd>R</kbd> reroll');
    if (actions?.onSkip) hintParts.push('<kbd>S</kbd> / <kbd>0</kbd> skip');
    hintParts.push('or click');

    if (panel) {
      panel.insertAdjacentHTML('beforeend', `<p class="overlay-hint">${hintParts.join(' · ')}</p>`);
      if (owned.length) {
        panel.insertAdjacentHTML('beforeend', `<div class="upgrade-owned-list" aria-label="Already in your build"><strong>YOUR BUILD</strong>${owned.map(id => `<span>${upgradeName(id, this.gameManager.playerStats)} <b>${upgradeRank(id, this.gameManager.playerStats)}${isRanked(id) ? `/${upgradeMaxRank(id)}` : '×'}</b></span>`).join('')}</div>`);
      }
    } else {
      if (owned.length) list.insertAdjacentHTML('afterend', `<div class="upgrade-owned-list" aria-label="Already in your build"><strong>YOUR BUILD</strong>${owned.map(id => `<span>${upgradeName(id, this.gameManager.playerStats)} <b>${upgradeRank(id, this.gameManager.playerStats)}${isRanked(id) ? `/${upgradeMaxRank(id)}` : '×'}</b></span>`).join('')}</div>`);
      list.insertAdjacentHTML('afterend', `<p class="overlay-hint">${hintParts.join(' · ')}</p>`);
    }
    this.focusFirst();
  }

  showGameOver(
    onRestart: () => void,
    onTitle: () => void,
    market?: { earned: number; balance: number; saved: boolean; onVisit: () => void },
    breakdown?: DamageBreakdownItem[]
  ): void {
    const snapshot = this.gameManager.getHudSnapshot();
    const won = this.gameManager.victorious;
    const list = won
      ? this.createOverlay('The woods are yours', 'Every boss has bowed. A legend walks home.', 'VICTORY', 'star', 'gameover-panel')
      : this.createOverlay('Every wanderer finds a way', 'Your story in the woods isn’t over yet.', 'UNTIL THE NEXT ADVENTURE', 'leaf', 'gameover-panel');
    list.innerHTML = `<div class="result-stats"><span><b>${formatTime(snapshot.elapsedSeconds)}</b>TIME IN THE WOODS</span><span><b>${snapshot.kills}</b>FOES DEFEATED</span><span><b>${snapshot.level}</b>LEVEL REACHED</span></div>`;
    const entries = (breakdown ?? [])
      .filter((entry) => Number.isFinite(entry.damage) && entry.damage > 0)
      .sort((a, b) => b.damage - a.damage);
    if (entries.length) {
      const total = entries.reduce((sum, entry) => sum + entry.damage, 0);
      const peak = entries[0].damage;
      const rowsHtml = entries.map((entry) => {
        const share = total > 0 ? (entry.damage / total) * 100 : 0;
        const barWidth = peak > 0 ? Math.max(4, (entry.damage / peak) * 100) : 0;
        const pctLabel = share < 1 ? '<1%' : `${Math.round(share)}%`;
        const damageLabel = Math.round(entry.damage).toLocaleString();
        const tone = entry.id === 'weapon' ? 'tone-weapon'
          : entry.id === 'companion' ? 'tone-companion'
          : isBossAbility(entry.id as UpgradeId) ? 'tone-relic' : 'tone-ability';
        return `<li class="breakdown-row ${tone}"><span class="breakdown-icon">${icon(this.breakdownIcon(entry.id))}</span><div class="breakdown-body"><div class="breakdown-meta"><span class="breakdown-label">${this.escapeHtml(entry.label)}</span><span class="breakdown-values"><b>${damageLabel}</b> <small>${pctLabel}</small></span></div><div class="breakdown-track"><i style="width:${barWidth.toFixed(1)}%"></i></div></div></li>`;
      }).join('');
      list.insertAdjacentHTML('beforeend', `<section class="damage-breakdown" aria-label="How you fought"><div class="breakdown-header"><strong class="breakdown-title">HOW YOU FOUGHT</strong><span class="breakdown-total">${Math.round(total).toLocaleString()} total</span></div><ul class="breakdown-list">${rowsHtml}</ul></section>`);
    }
    if (market) {
      list.insertAdjacentHTML('beforeend', `<div class="run-gold-reward">${icon('gold')}<span><strong>+${market.earned} gold earned</strong><small>${market.balance} gold in your purse${market.saved ? '' : ' · Saved for this session'}</small></span></div><p class="gold-milestones">Level 10: 5 gold · Level 20: 10 gold<br>+1 gold for each level beyond 20</p>`);
      this.addButton(list, 'Visit Market Day', market.onVisit, true);
    }
    this.addButton(list, 'Wander again', onRestart, true); this.addButton(list, 'Choose a wanderer', onTitle, false); this.focusFirst();
  }

  /** Every boss is down: keep wandering for more gold, or take the win home. */
  showVictory(onContinue: () => void, onFinish: () => void): void {
    const list = this.createOverlay('Victory!', 'Oven, Wonky, King Frankie and King Rumbles have all fallen.', 'THE WOODS ARE SAFE', 'star', 'pause-panel');
    list.innerHTML = '<p class="pause-instruction">Head home a hero, or keep wandering. The woods only grow wilder, and every level past 20 is worth more gold.</p>';
    this.addButton(list, 'Keep wandering', onContinue, true);
    this.addButton(list, 'Head home victorious', onFinish, false);
    this.focusFirst();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.gameUi.removeEventListener('touchstart', this.onFirstTouch);
    window.removeEventListener('touchstart', this.onFirstTouch);
    window.removeEventListener('pointerdown', this.onFirstTouchPointer);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerEnd);
    window.removeEventListener('pointercancel', this.onPointerEnd);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);
    window.removeEventListener('blur', this.onWindowBlur);
    this.resetJoystick();
    this.overlay = undefined;
    this.onRerollAction = undefined;
    this.onSkipAction = undefined;
    this.root.innerHTML = '';
    this.root.classList.remove('run-frozen', 'low-health');
  }

  private toggleMute(): void {
    this.muted = this.options?.onToggleMute ? Boolean(this.options.onToggleMute()) : !this.muted;
    this.syncMuteButton();
  }

  private toggleAimMode(): void {
    this.manualAim = this.options?.onToggleAimMode ? Boolean(this.options.onToggleAimMode()) : !this.manualAim;
    this.syncAimButton();
  }

  private triggerDash(): void {
    this.options?.onDash?.();
  }

  private syncMuteButton(): void {
    this.muteButton.classList.toggle('is-muted', this.muted);
    this.muteButton.setAttribute('aria-pressed', String(this.muted));
    this.muteButton.setAttribute('aria-label', this.muted ? 'Unmute sound' : 'Mute sound');
    this.muteButton.title = this.muted ? 'Sound Off (M)' : 'Sound On (M)';
    this.muteButton.innerHTML = `${icon(this.muted ? 'sound-off' : 'sound-on')}<span class="visually-hidden">${this.muted ? 'Sound Off' : 'Sound On'}</span>`;
  }

  private syncAimButton(): void {
    const modeLabel = this.manualAim ? 'Cursor' : 'Auto';
    this.aimButton.classList.toggle('is-manual', this.manualAim);
    this.aimButton.setAttribute('aria-pressed', String(this.manualAim));
    this.aimButton.setAttribute('aria-label', `Aim Mode: ${modeLabel}`);
    this.aimButton.title = `Aim Mode: ${modeLabel} (F)`;
    this.aimButton.innerHTML = `${icon('aim')}<span class="hud-btn-label">${modeLabel}</span>`;
  }

  private enableTouchControls(): void {
    if (this.touchEnabled) return;
    this.touchEnabled = true;
    this.touchControls.hidden = false;
    this.gameUi.classList.add('touch-active');
    this.gameUi.removeEventListener('touchstart', this.onFirstTouch);
    window.removeEventListener('touchstart', this.onFirstTouch);
    window.removeEventListener('pointerdown', this.onFirstTouchPointer);
  }

  private updateJoystickFromPoint(clientX: number, clientY: number): void {
    const rect = this.joystickBase.getBoundingClientRect();
    const width = rect.width || 116;
    const height = rect.height || width;
    const centerX = rect.left + width / 2;
    const centerY = rect.top + height / 2;
    const maxRadius = Math.max(24, width * 0.42);
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    this.joystickEl.classList.add('is-active');
    if (dist <= TOUCH_DEADZONE_PX) {
      this.touchVector = { x: 0, y: 0 };
      this.joystickKnob.style.transform = '';
      return;
    }
    const clampedDist = Math.min(dist, maxRadius);
    const nx = dx / dist;
    const ny = dy / dist;
    const magnitude = clampedDist / maxRadius;
    this.touchVector = {
      x: Math.max(-1, Math.min(1, nx * magnitude)),
      y: Math.max(-1, Math.min(1, ny * magnitude))
    };
    this.joystickKnob.style.transform = `translate3d(${(nx * clampedDist).toFixed(1)}px, ${(ny * clampedDist).toFixed(1)}px, 0)`;
  }

  private resetJoystick(): void {
    this.activePointerId = null;
    this.activeTouchId = null;
    this.touchVector = { x: 0, y: 0 };
    if (this.joystickEl) this.joystickEl.classList.remove('is-active');
    if (this.joystickKnob) this.joystickKnob.style.transform = '';
  }

  private findTouch(list: TouchList | ArrayLike<Touch> | undefined, id: number): Touch | undefined {
    if (!list) return undefined;
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === id) return list[i];
    }
    return undefined;
  }

  private updateStatusStrip(snapshot: HudSnapshot): void {
    if (!this.statusStrip) return;
    const ext = snapshot as ExtendedHudSnapshot;
    const dashRatio = typeof ext.dashCooldownRatio === 'number' && Number.isFinite(ext.dashCooldownRatio)
      ? Math.max(0, Math.min(1, ext.dashCooldownRatio))
      : undefined;
    const dashVisible = dashRatio !== undefined || Boolean(this.options?.onDash);
    const wardStatus = ext.wardStatus ?? this.gameManager.wardStatus;
    const wardVisible = Boolean(wardStatus && wardStatus !== 'locked');
    const wardMaxLeaves = ext.wardMaxLeaves ?? this.gameManager.bark?.leaves ?? 0;
    const wardLeaves = ext.wardLeaves ?? this.gameManager.wardLeaves ?? 0;
    const shoutRemainingMs = typeof ext.shoutRemainingMs === 'number' && Number.isFinite(ext.shoutRemainingMs)
      ? Math.max(0, ext.shoutRemainingMs)
      : 0;
    const shoutAttackSpeedBonus = this.gameManager.playerStats.shoutAttackSpeedBonus ?? 0;
    const shoutVisible = shoutRemainingMs > 0 || (ext.shoutRemainingMs === undefined && shoutAttackSpeedBonus > 0);
    const harvestBonus = typeof ext.harvestBonus === 'number' && Number.isFinite(ext.harvestBonus)
      ? Math.max(0, ext.harvestBonus)
      : Math.max(0, this.gameManager.playerStats.harvestBonus ?? 0);
    const harvestVisible = harvestBonus > 0.001;
    const nextBossLevel = typeof ext.nextBossLevel === 'number' && ext.nextBossLevel > 0 ? ext.nextBossLevel : undefined;
    const nextBossName = typeof ext.nextBossName === 'string' && ext.nextBossName ? ext.nextBossName : undefined;

    const statusKey = JSON.stringify([
      dashVisible, dashRatio !== undefined ? Math.round(dashRatio * 100) : null,
      wardVisible, wardStatus, wardLeaves, wardMaxLeaves,
      shoutVisible, Math.ceil(shoutRemainingMs / 100), Math.round(shoutAttackSpeedBonus * 100),
      harvestVisible, Math.round(harvestBonus * 100),
      nextBossLevel ?? null, nextBossName ?? null
    ]);
    if (statusKey === this.lastStatusFingerprint) return;
    this.lastStatusFingerprint = statusKey;

    const effectiveRatio = dashRatio ?? 0;
    const dashReady = effectiveRatio <= 0.001;
    if (this.dashPill) {
      this.dashPill.hidden = !dashVisible;
      if (dashVisible) {
        const pct = Math.round((1 - effectiveRatio) * 100);
        this.dashPill.classList.toggle('is-ready', dashReady);
        this.dashPill.classList.toggle('is-cooling', !dashReady);
        this.dashPill.innerHTML = `${icon('dash')}<span>Dash</span><small>${dashReady ? 'Ready' : `${pct}%`}</small><i class="pill-progress" style="transform:scaleX(${dashReady ? 1 : (1 - effectiveRatio).toFixed(3)})"></i>`;
        this.dashPill.setAttribute('aria-label', dashReady ? 'Dash ready' : `Dash recharging ${pct}%`);
        this.dashPill.title = dashReady ? 'Dash ready (Space / Shift)' : 'Dash recharging';
      }
    }
    if (this.touchDashButton) {
      this.touchDashButton.classList.toggle('is-ready', dashReady);
      this.touchDashButton.classList.toggle('is-cooling', !dashReady);
      this.touchDashButton.setAttribute('aria-disabled', dashReady ? 'false' : 'true');
      if (this.touchDashCooldown) {
        this.touchDashCooldown.style.height = dashReady ? '0%' : `${Math.round(effectiveRatio * 100)}%`;
      }
    }

    if (this.wardPill) {
      this.wardPill.hidden = !wardVisible;
      if (wardVisible) {
        this.wardPill.classList.toggle('ward-ready', wardStatus === 'ready');
        this.wardPill.classList.toggle('ward-protecting', wardStatus === 'protecting');
        this.wardPill.classList.toggle('ward-recharging', wardStatus === 'recharging');
        if (wardMaxLeaves > 0) {
          const activeLeaves = Math.max(0, Math.min(wardMaxLeaves, wardLeaves));
          const pips = Array.from({ length: wardMaxLeaves }, (_, i) => `<i${i < activeLeaves ? ' class="on"' : ''}></i>`).join('');
          const stateText = wardStatus === 'protecting' ? 'Shielding' : wardStatus === 'ready' ? `${activeLeaves}/${wardMaxLeaves}` : 'Regrowing';
          this.wardPill.innerHTML = `${icon('shield')}<span>Ward</span><span class="ward-pips" aria-hidden="true">${pips}</span><small>${stateText}</small>`;
          this.wardPill.setAttribute('aria-label', `Barkskin Ward: ${stateText}, ${activeLeaves} of ${wardMaxLeaves} leaves`);
        } else {
          const on = wardStatus !== 'recharging';
          const stateText = wardStatus === 'protecting' ? 'Shielding' : wardStatus === 'ready' ? 'Ready' : 'Recharging';
          this.wardPill.innerHTML = `${icon('shield')}<span>Ward</span><span class="ward-pips" aria-hidden="true"><i${on ? ' class="on"' : ''}></i></span><small>${stateText}</small>`;
          this.wardPill.setAttribute('aria-label', `Barkskin Ward: ${stateText}`);
        }
      }
    }

    if (this.shoutPill) {
      this.shoutPill.hidden = !shoutVisible;
      if (shoutVisible) {
        const detail = shoutRemainingMs > 0 ? `${(shoutRemainingMs / 1000).toFixed(1)}s` : `+${Math.round(shoutAttackSpeedBonus * 100)}%`;
        this.shoutPill.innerHTML = `${icon('shout')}<span>Shout</span><small>${detail}</small>`;
        this.shoutPill.setAttribute('aria-label', `Inspiring Shout active: ${detail}`);
      }
    }

    if (this.harvestPill) {
      this.harvestPill.hidden = !harvestVisible;
      if (harvestVisible) {
        const pct = Math.round(harvestBonus * 100);
        this.harvestPill.innerHTML = `${icon('leaf')}<span>Harvest</span><small>+${pct}%</small>`;
        this.harvestPill.setAttribute('aria-label', `Harvest Wind: +${pct}% projectile damage`);
      }
    }

    if (this.bossMilestonePill) {
      this.bossMilestonePill.hidden = nextBossLevel === undefined;
      if (nextBossLevel !== undefined) {
        const label = `Next Boss: Lv. ${nextBossLevel}`;
        this.bossMilestonePill.innerHTML = `${icon('crownfire')}<span>${label}</span>${nextBossName ? `<small>${this.escapeHtml(nextBossName)}</small>` : ''}`;
        this.bossMilestonePill.setAttribute('aria-label', nextBossName ? `${label} (${nextBossName})` : label);
      }
    }

    this.statusStrip.hidden = !(dashVisible || wardVisible || shoutVisible || harvestVisible || nextBossLevel !== undefined);
  }

  private showReceipt(heading: string, detail: string): void {
    const receipt = this.root.querySelector<HTMLElement>('.upgrade-receipt');
    if (!receipt) return;
    receipt.innerHTML = `<strong>${heading}</strong><span>${detail}</span>`;
    receipt.hidden = false;
    this.receiptUntil = this.gameManager.elapsedMs + 4000;
  }

  private breakdownIcon(id: string): string {
    if (id === 'weapon') {
      const weaponId = this.gameManager.playerStats.weaponId;
      const weapon = (WEAPONS as Record<string, (typeof WEAPONS)['spell'] | undefined>)[weaponId];
      if (weapon?.icon) return weapon.icon;
      if ((weaponId as string) === 'boomerang') return 'boomerang';
      if ((weaponId as string) === 'lantern') return 'lantern';
      return 'spell';
    }
    if (id === 'companion') {
      const cid = this.gameManager.playerStats.companionId;
      return cid === 'frankie' ? 'buzzard' : cid === 'tobias' ? 'fish' : 'paw';
    }
    return UPGRADE_ICONS[id as UpgradeId] ?? 'star';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private isTextInput(target: EventTarget | null): boolean {
    if (!target || typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  private refreshBuild(): void {
    const stats = this.gameManager.playerStats;
    const key = JSON.stringify([stats.abilityRanks, stats.bossAbilityRanks, stats.upgradeCounts, stats.companionId, stats.companionRank, stats.frankieCount, stats.frankieFeatherBonus]);
    if (key === this.buildFingerprint) return;
    this.buildFingerprint = key;
    const name = COMPANION_NAMES[stats.companionId];
    this.query('.companion-name').textContent = name;
    const nextAt = levelForCompanionRank(stats.companionRank + 1);
    const rank = stats.companionRank >= MAX_COMPANION_RANK
      ? `Rank ${MAX_COMPANION_RANK} · fully grown` : `Rank ${stats.companionRank} · grows at level ${nextAt}`;
    this.query('.companion-rank').textContent = rank;
    const feather = stats.hasFrankieCompanion ? ` · +${Math.min(BALANCE.companion.frankieFeatherCap, stats.frankieFeatherBonus)} feather damage` : '';
    const detail = `${describeCompanionRank(stats.companionId, stats.companionRank, stats)}${feather}`;
    this.query('.companion-detail').textContent = detail;
    // One dot per rank; the full story is a hover away, and always in the pause menu.
    this.query('.companion-pips').innerHTML = Array.from({ length: MAX_COMPANION_RANK }, (_, i) => `<i${i < stats.companionRank ? ' class="on"' : ''}></i>`).join('');
    this.query('.companion-badge').title = `${name} · ${rank}\n${detail}`;
  }

  private createOverlay(title: string, body: string, eyebrow: string, emblem: string, className: string): HTMLElement {
    this.clearOverlay();
    this.resetJoystick();
    this.previousFocus = typeof HTMLElement !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
    this.overlay = document.createElement('div'); this.overlay.className = 'storybook-overlay';
    this.overlay.innerHTML = `<section class="storybook-panel ${className}" role="dialog" aria-modal="true" aria-labelledby="overlay-title" aria-describedby="overlay-body"><span class="panel-emblem">${icon(emblem)}</span><p class="eyebrow">${eyebrow}</p><h2 id="overlay-title">${title}</h2><p id="overlay-body" class="panel-intro">${body}</p><div class="panel-actions"></div></section>`;
    this.root.append(this.overlay); return this.overlay.querySelector('.panel-actions')!;
  }

  private addButton(parent: Element, label: string, action: () => void, primary: boolean): void {
    const button = document.createElement('button'); button.type = 'button'; button.className = primary ? 'primary-button' : 'text-button';
    button.innerHTML = `${label} ${primary ? icon('arrow') : ''}`; button.addEventListener('click', action); parent.append(button);
  }

  private focusFirst(): void { this.overlay?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true }); }
  private clearOverlay(): void {
    this.overlay?.remove();
    this.overlay = undefined;
    this.choices = [];
    this.onRerollAction = undefined;
    this.onSkipAction = undefined;
    this.previousFocus?.focus({ preventScroll: true });
    this.previousFocus = undefined;
  }
  private query<T extends HTMLElement = HTMLElement>(selector: string): T { return this.root.querySelector<T>(selector)!; }
}
