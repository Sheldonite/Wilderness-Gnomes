import type { GameManager } from '../core/GameManager';
import type { HudSnapshot, UpgradeDefinition } from '../core/types';
import { formatTime } from '../utils/math';

export class UIManager {
  private readonly root: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly healthValue: HTMLElement;
  private readonly xpValue: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly pauseButton: HTMLButtonElement;
  private overlay?: HTMLElement;

  constructor(
    private readonly gameManager: GameManager,
    private readonly onTogglePause: () => void
  ) {
    const root = document.getElementById('ui-root');
    if (!root) {
      throw new Error('Missing #ui-root element.');
    }

    this.root = root;
    this.root.innerHTML = '';

    this.hud = document.createElement('div');
    this.hud.className = 'hud';
    this.hud.innerHTML = `
      <div class="hud-row">
        <span class="hud-label">Health</span>
        <div class="bar"><div class="bar-fill health"></div></div>
        <span class="hud-value health-value"></span>
      </div>
      <div class="hud-row">
        <span class="hud-label">XP</span>
        <div class="bar"><div class="bar-fill xp"></div></div>
        <span class="hud-value xp-value"></span>
      </div>
      <div class="hud-bottom-row">
        <div class="hud-stats"></div>
        <button type="button" class="pause-button">Pause</button>
      </div>
    `;

    this.root.appendChild(this.hud);

    this.healthFill = this.mustQuery('.bar-fill.health');
    this.xpFill = this.mustQuery('.bar-fill.xp');
    this.healthValue = this.mustQuery('.health-value');
    this.xpValue = this.mustQuery('.xp-value');
    this.stats = this.mustQuery('.hud-stats');
    this.pauseButton = this.mustQuery<HTMLButtonElement>('.pause-button');
    this.pauseButton.addEventListener('click', () => this.onTogglePause());
  }

  update(snapshot: HudSnapshot): void {
    const healthRatio = snapshot.maxHealth > 0 ? snapshot.health / snapshot.maxHealth : 0;
    const xpRatio = snapshot.xpToNextLevel > 0 ? snapshot.xp / snapshot.xpToNextLevel : 0;

    this.healthFill.style.transform = `scaleX(${Math.max(0, Math.min(1, healthRatio))})`;
    this.xpFill.style.transform = `scaleX(${Math.max(0, Math.min(1, xpRatio))})`;
    this.healthValue.textContent = `${Math.ceil(snapshot.health)}/${snapshot.maxHealth}`;
    this.xpValue.textContent = `${snapshot.xp}/${snapshot.xpToNextLevel}`;
    this.stats.textContent = `Level ${snapshot.level}   Time ${formatTime(snapshot.elapsedSeconds)}   Kills ${snapshot.kills}`;
  }

  setPauseButtonState(isPaused: boolean): void {
    this.pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
    this.pauseButton.classList.toggle('active', isPaused);
  }

  showPaused(onResume: () => void): void {
    this.clearOverlay();
    this.overlay = this.createOverlay('Paused', 'The run is waiting. Press Escape or resume when ready.');
    const list = this.overlay.querySelector('.choice-list');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Resume';
    button.addEventListener('click', onResume);
    list?.appendChild(button);
  }

  hideOverlay(): void {
    this.clearOverlay();
  }

  showLevelUp(choices: UpgradeDefinition[], onChoose: (choice: UpgradeDefinition) => void): void {
    this.clearOverlay();
    this.overlay = this.createOverlay('Choose an Upgrade', 'The woods are holding their breath.');
    const list = this.overlay.querySelector('.choice-list');

    for (const choice of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `${choice.title}<br><small>${choice.description}</small>`;
      button.addEventListener('click', () => {
        onChoose(choice);
        this.clearOverlay();
      });
      list?.appendChild(button);
    }
  }

  showGameOver(onRestart: () => void): void {
    this.clearOverlay();
    const snapshot = this.gameManager.getHudSnapshot();
    this.overlay = this.createOverlay(
      'Game Over',
      `You survived ${formatTime(snapshot.elapsedSeconds)} and took ${snapshot.kills} foes with you.`
    );
    const list = this.overlay.querySelector('.choice-list');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Restart';
    button.addEventListener('click', onRestart);
    list?.appendChild(button);
  }

  destroy(): void {
    this.root.innerHTML = '';
  }

  private createOverlay(title: string, body: string): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <section class="panel">
        <h2>${title}</h2>
        <p>${body}</p>
        <div class="choice-list"></div>
      </section>
    `;
    this.root.appendChild(overlay);
    return overlay;
  }

  private clearOverlay(): void {
    this.overlay?.remove();
    this.overlay = undefined;
  }

  private mustQuery<T extends HTMLElement>(selector: string): T {
    const element = this.hud.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing UI element: ${selector}`);
    }

    return element;
  }
}
