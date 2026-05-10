import Phaser from 'phaser';
import playerSpriteSheetUrl from '../../assets/sprites/code-wizard-main-spritesheet.png';
import {
  applyPlayerSpriteFrameAdjustment,
  clearPlayerSpriteAdjustments,
  getDefaultPlayerSpriteAdjustment,
  getPlayerSpriteFrameDefinitions,
  loadPlayerSpriteAdjustments,
  PLAYER_FRAME_SIZE,
  PLAYER_SPRITE_ADJUSTMENTS_STORAGE_KEY,
  PLAYER_SPRITE_SHEET_HEIGHT,
  PLAYER_SPRITE_SHEET_WIDTH,
  savePlayerSpriteAdjustments,
  type PlayerSpriteAdjustmentMap,
  type PlayerSpriteFrameAdjustment,
  type PlayerSpriteFrameDefinition
} from '../config/playerSprite';

type Axis = keyof PlayerSpriteFrameAdjustment;

export class DebugSpriteSheetMenu {
  private readonly root: HTMLElement;
  private readonly toggleButton: HTMLButtonElement;
  private readonly overlay: HTMLElement;
  private readonly frameGrid: HTMLElement;
  private readonly previewFrame: HTMLElement;
  private readonly previewMeta: HTMLElement;
  private readonly exportText: HTMLTextAreaElement;
  private readonly inputs = new Map<Axis, HTMLInputElement>();
  private readonly frameDefinitions = getPlayerSpriteFrameDefinitions();
  private readonly toggleWithKeyboard = () => this.toggle();
  private readonly closeWithKeyboard = () => {
    if (this.open) {
      this.close();
    }
  };
  private adjustments: PlayerSpriteAdjustmentMap = loadPlayerSpriteAdjustments();
  private selectedFrame: PlayerSpriteFrameDefinition = this.frameDefinitions[0];
  private open = false;

  constructor(private readonly scene: Phaser.Scene) {
    const root = document.getElementById('ui-root');
    if (!root) {
      throw new Error('Missing #ui-root element.');
    }

    this.root = root;
    this.toggleButton = this.createToggleButton();
    this.overlay = this.createOverlay();
    this.frameGrid = this.mustQuery('.debug-frame-grid');
    this.previewFrame = this.mustQuery('.debug-frame-preview');
    this.previewMeta = this.mustQuery('.debug-preview-meta');
    this.exportText = this.mustQuery<HTMLTextAreaElement>('.debug-export');

    this.root.append(this.toggleButton, this.overlay);
    this.renderFrameButtons();
    this.bindKeyboardToggle();
    this.selectFrame(this.selectedFrame);
    this.close();
  }

  get isOpen(): boolean {
    return this.open;
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-F2', this.toggleWithKeyboard);
    this.scene.input.keyboard?.off('keydown-ESC', this.closeWithKeyboard);
    this.toggleButton.remove();
    this.overlay.remove();
  }

  private createToggleButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'debug-toggle';
    button.textContent = 'Sprite Debug';
    button.addEventListener('click', () => this.toggle());
    return button;
  }

  private createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'debug-overlay';
    overlay.innerHTML = `
      <section class="debug-panel" aria-label="Sprite sheet debug menu">
        <header class="debug-header">
          <div>
            <h2>Sprite Sheet Debug</h2>
            <p>Adjust source crop and draw offsets per animation frame. Press F2 to toggle.</p>
          </div>
          <button type="button" class="debug-close">Close</button>
        </header>
        <div class="debug-layout">
          <div class="debug-frame-column">
            <h3>Frames</h3>
            <div class="debug-frame-grid"></div>
          </div>
          <div class="debug-control-column">
            <div class="debug-preview-wrap">
              <div class="debug-frame-preview"></div>
              <div class="debug-preview-meta"></div>
            </div>
            <div class="debug-sliders">
              ${this.createSliderMarkup('sourceX', 'Source X', 0, PLAYER_SPRITE_SHEET_WIDTH - PLAYER_FRAME_SIZE)}
              ${this.createSliderMarkup('sourceY', 'Source Y', 0, PLAYER_SPRITE_SHEET_HEIGHT - PLAYER_FRAME_SIZE)}
              ${this.createSliderMarkup('offsetX', 'Draw Offset X', -48, 48)}
              ${this.createSliderMarkup('offsetY', 'Draw Offset Y', -48, 48)}
            </div>
            <div class="debug-actions">
              <button type="button" class="debug-copy">Copy JSON</button>
              <button type="button" class="debug-reset-frame">Reset Frame</button>
              <button type="button" class="debug-reset-all">Reset All</button>
            </div>
            <textarea class="debug-export" spellcheck="false" aria-label="Sprite frame adjustment JSON"></textarea>
          </div>
        </div>
      </section>
    `;

    overlay.querySelector('.debug-close')?.addEventListener('click', () => this.close());
    overlay.querySelector('.debug-copy')?.addEventListener('click', () => this.copyExport());
    overlay.querySelector('.debug-reset-frame')?.addEventListener('click', () => this.resetSelectedFrame());
    overlay.querySelector('.debug-reset-all')?.addEventListener('click', () => this.resetAllFrames());
    overlay.addEventListener('pointerdown', (event) => event.stopPropagation());
    overlay.addEventListener('keydown', (event) => event.stopPropagation());

    for (const axis of ['sourceX', 'sourceY', 'offsetX', 'offsetY'] as Axis[]) {
      const range = overlay.querySelector<HTMLInputElement>(`[data-range="${axis}"]`);
      const number = overlay.querySelector<HTMLInputElement>(`[data-number="${axis}"]`);

      if (!range || !number) {
        continue;
      }

      this.inputs.set(axis, range);
      range.addEventListener('input', () => {
        number.value = range.value;
        this.updateSelectedAdjustment(axis, Number(range.value));
      });
      number.addEventListener('input', () => {
        range.value = number.value;
        this.updateSelectedAdjustment(axis, Number(number.value));
      });
    }

    return overlay;
  }

  private createSliderMarkup(axis: Axis, label: string, min: number, max: number): string {
    return `
      <label class="debug-slider-row">
        <span>${label}</span>
        <input data-range="${axis}" type="range" min="${min}" max="${max}" step="1" />
        <input data-number="${axis}" type="number" min="${min}" max="${max}" step="1" />
      </label>
    `;
  }

  private renderFrameButtons(): void {
    this.frameGrid.innerHTML = '';

    let currentAnimation = '';
    for (const frame of this.frameDefinitions) {
      if (frame.animationName !== currentAnimation) {
        currentAnimation = frame.animationName;
        const label = document.createElement('div');
        label.className = 'debug-animation-label';
        label.textContent = currentAnimation;
        this.frameGrid.appendChild(label);
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'debug-frame-button';
      button.dataset.frameKey = frame.key;
      button.textContent = `${frame.frameInAnimation + 1}`;
      button.title = `${frame.animationName} frame ${frame.frameInAnimation + 1}`;
      button.addEventListener('click', () => this.selectFrame(frame));
      this.frameGrid.appendChild(button);
    }
  }

  private selectFrame(frame: PlayerSpriteFrameDefinition): void {
    this.selectedFrame = frame;
    const adjustment = this.getAdjustment(frame);

    for (const axis of ['sourceX', 'sourceY', 'offsetX', 'offsetY'] as Axis[]) {
      const range = this.overlay.querySelector<HTMLInputElement>(`[data-range="${axis}"]`);
      const number = this.overlay.querySelector<HTMLInputElement>(`[data-number="${axis}"]`);
      if (!range || !number) {
        continue;
      }

      range.value = String(adjustment[axis]);
      number.value = String(adjustment[axis]);
    }

    for (const button of this.frameGrid.querySelectorAll<HTMLButtonElement>('.debug-frame-button')) {
      button.classList.toggle('active', button.dataset.frameKey === frame.key);
    }

    this.updatePreview();
    this.updateExport();
  }

  private updateSelectedAdjustment(axis: Axis, value: number): void {
    const current = this.getAdjustment(this.selectedFrame);
    const next = {
      ...current,
      [axis]: value
    };

    this.adjustments[this.selectedFrame.key] = next;
    applyPlayerSpriteFrameAdjustment(this.scene, this.selectedFrame, next);
    savePlayerSpriteAdjustments(this.adjustments);
    this.updatePreview();
    this.updateExport();
  }

  private getAdjustment(frame: PlayerSpriteFrameDefinition): PlayerSpriteFrameAdjustment {
    return this.adjustments[frame.key] ?? getDefaultPlayerSpriteAdjustment(frame);
  }

  private updatePreview(): void {
    const adjustment = this.getAdjustment(this.selectedFrame);
    const scale = 2;

    this.previewFrame.style.width = `${PLAYER_FRAME_SIZE * scale}px`;
    this.previewFrame.style.height = `${PLAYER_FRAME_SIZE * scale}px`;
    this.previewFrame.style.backgroundImage = `url("${playerSpriteSheetUrl}")`;
    this.previewFrame.style.backgroundSize = `${PLAYER_SPRITE_SHEET_WIDTH * scale}px ${PLAYER_SPRITE_SHEET_HEIGHT * scale}px`;
    this.previewFrame.style.backgroundPosition = `${-adjustment.sourceX * scale}px ${-adjustment.sourceY * scale}px`;
    this.previewFrame.style.transform = `translate(${adjustment.offsetX}px, ${adjustment.offsetY}px)`;
    this.previewMeta.textContent = `${this.selectedFrame.animationName} frame ${
      this.selectedFrame.frameInAnimation + 1
    } | source ${adjustment.sourceX}, ${adjustment.sourceY} | offset ${adjustment.offsetX}, ${
      adjustment.offsetY
    }`;
  }

  private updateExport(): void {
    this.exportText.value = JSON.stringify(
      {
        storageKey: PLAYER_SPRITE_ADJUSTMENTS_STORAGE_KEY,
        note: 'localStorage values override the code defaults in PLAYER_DEFAULT_SPRITE_ADJUSTMENTS.',
        adjustments: this.adjustments
      },
      null,
      2
    );
  }

  private resetSelectedFrame(): void {
    delete this.adjustments[this.selectedFrame.key];
    applyPlayerSpriteFrameAdjustment(
      this.scene,
      this.selectedFrame,
      getDefaultPlayerSpriteAdjustment(this.selectedFrame)
    );
    savePlayerSpriteAdjustments(this.adjustments);
    this.selectFrame(this.selectedFrame);
  }

  private resetAllFrames(): void {
    this.adjustments = {};
    clearPlayerSpriteAdjustments();

    for (const frame of this.frameDefinitions) {
      applyPlayerSpriteFrameAdjustment(this.scene, frame, getDefaultPlayerSpriteAdjustment(frame));
    }

    this.selectFrame(this.selectedFrame);
  }

  private async copyExport(): Promise<void> {
    this.updateExport();
    this.exportText.select();

    try {
      await navigator.clipboard.writeText(this.exportText.value);
    } catch {
      document.execCommand('copy');
    }
  }

  private bindKeyboardToggle(): void {
    const keyboard = this.scene.input.keyboard;
    keyboard?.on('keydown-F2', this.toggleWithKeyboard);
    keyboard?.on('keydown-ESC', this.closeWithKeyboard);
  }

  private toggle(): void {
    if (this.open) {
      this.close();
      return;
    }

    this.show();
  }

  private show(): void {
    this.open = true;
    this.overlay.classList.add('open');
    this.toggleButton.classList.add('active');
    this.selectFrame(this.selectedFrame);
  }

  private close(): void {
    this.open = false;
    this.overlay.classList.remove('open');
    this.toggleButton.classList.remove('active');
  }

  private mustQuery<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.overlay.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing debug UI element: ${selector}`);
    }

    return element;
  }
}
