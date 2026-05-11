import Phaser from 'phaser';
import playerSpriteSheetUrl from '../../assets/sprites/code-wizard-main-spritesheet.png';
import squirrelEnemySpriteSheetUrl from '../../assets/sprites/squirrel-enemy-spritesheet.png';
import familiarCatSpriteSheetUrl from '../../assets/sprites/familiar-cat-spritesheet.png';
import familiarCatPounceSpriteSheetUrl from '../../assets/sprites/familiar-cat-pounce-spritesheet.png';
import {
  MYSTERY_FRAME_SIZE,
  MYSTERY_FRAMES_PER_ROW,
  MYSTERY_MOVEMENT_ANIMATION_ROWS,
  MYSTERY_POUNCE_ANIMATION_ROWS,
  MYSTERY_POUNCE_SPRITE_KEY,
  MYSTERY_SPRITE_KEY,
  getMysteryDefaultFrameAdjustment
} from '../config/companionSprite';
import {
  ENEMY_ANIMATION_ROWS,
  ENEMY_FRAMES_PER_ROW,
  ENEMY_FRAME_SIZE,
  ENEMY_SPRITE_KEY
} from '../config/enemySprite';
import {
  applyPlayerSpriteFrameAdjustment,
  getDefaultPlayerSpriteAdjustment,
  getPlayerSpriteFrameDefinitions,
  PLAYER_FRAME_SIZE,
  PLAYER_SPRITE_KEY,
  PLAYER_SPRITE_SHEET_HEIGHT,
  PLAYER_SPRITE_SHEET_WIDTH,
  type PlayerSpriteFrameDefinition
} from '../config/playerSprite';

interface DebugFrameAdjustment {
  sourceX: number;
  sourceY: number;
  offsetX: number;
  offsetY: number;
}

interface DebugFrameDefinition {
  key: string;
  animationName: string;
  frameIndex: number;
  frameInAnimation: number;
  defaultSourceX: number;
  defaultSourceY: number;
}

interface DebugSpriteSheetDefinition {
  id: string;
  label: string;
  textureKey: string;
  storageKey: string;
  imageUrl: string;
  frameSize: number;
  sheetWidth: number;
  sheetHeight: number;
  frames: DebugFrameDefinition[];
  getDefaultAdjustment?: (frame: DebugFrameDefinition) => DebugFrameAdjustment;
  applyAdjustment?: (
    scene: Phaser.Scene,
    frame: DebugFrameDefinition,
    adjustment: DebugFrameAdjustment
  ) => void;
}

type Axis = keyof DebugFrameAdjustment;
type AdjustmentMap = Record<string, DebugFrameAdjustment>;

const AXES: Axis[] = ['sourceX', 'sourceY', 'offsetX', 'offsetY'];
const STORAGE_PREFIX = 'wilderness-gnomes-sprite-debug';

export class DebugSpriteSheetMenu {
  private readonly root: HTMLElement;
  private readonly toggleButton: HTMLButtonElement;
  private readonly overlay: HTMLElement;
  private readonly sheetSelect: HTMLSelectElement;
  private readonly frameGrid: HTMLElement;
  private readonly previewFrame: HTMLElement;
  private readonly previewMeta: HTMLElement;
  private readonly exportText: HTMLTextAreaElement;
  private readonly sheets = this.createSheetDefinitions();
  private readonly toggleWithKeyboard = () => this.toggle();
  private adjustments: AdjustmentMap = {};
  private selectedSheet: DebugSpriteSheetDefinition = this.sheets[0];
  private selectedFrame: DebugFrameDefinition = this.selectedSheet.frames[0];
  private open = false;

  constructor(private readonly scene: Phaser.Scene) {
    const root = document.getElementById('ui-root');
    if (!root) {
      throw new Error('Missing #ui-root element.');
    }

    this.root = root;
    this.toggleButton = this.createToggleButton();
    this.overlay = this.createOverlay();
    this.sheetSelect = this.mustQuery<HTMLSelectElement>('.debug-sheet-select');
    this.frameGrid = this.mustQuery('.debug-frame-grid');
    this.previewFrame = this.mustQuery('.debug-frame-preview');
    this.previewMeta = this.mustQuery('.debug-preview-meta');
    this.exportText = this.mustQuery<HTMLTextAreaElement>('.debug-export');

    this.root.append(this.toggleButton, this.overlay);
    this.renderSheetOptions();
    this.applyAllSavedAdjustments();
    this.selectSheet(this.selectedSheet.id);
    this.bindKeyboardToggle();
    this.close();
  }

  get isOpen(): boolean {
    return this.open;
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-F2', this.toggleWithKeyboard);
    this.toggleButton.remove();
    this.overlay.remove();
  }

  close(): void {
    this.open = false;
    this.overlay.classList.remove('open');
    this.toggleButton.classList.remove('active');
  }

  private createSheetDefinitions(): DebugSpriteSheetDefinition[] {
    return [
      {
        id: 'player',
        label: 'Player Wizard',
        textureKey: PLAYER_SPRITE_KEY,
        storageKey: 'wilderness-gnomes-player-sprite-adjustments',
        imageUrl: playerSpriteSheetUrl,
        frameSize: PLAYER_FRAME_SIZE,
        sheetWidth: PLAYER_SPRITE_SHEET_WIDTH,
        sheetHeight: PLAYER_SPRITE_SHEET_HEIGHT,
        frames: getPlayerSpriteFrameDefinitions().map((frame) => this.fromPlayerFrame(frame)),
        getDefaultAdjustment: (frame) =>
          getDefaultPlayerSpriteAdjustment(frame as PlayerSpriteFrameDefinition),
        applyAdjustment: (scene, frame, adjustment) =>
          applyPlayerSpriteFrameAdjustment(scene, frame as PlayerSpriteFrameDefinition, adjustment)
      },
      {
        id: 'enemy-squirrel',
        label: 'Squirrel Enemy',
        textureKey: ENEMY_SPRITE_KEY,
        storageKey: `${STORAGE_PREFIX}-squirrel-enemy`,
        imageUrl: squirrelEnemySpriteSheetUrl,
        frameSize: ENEMY_FRAME_SIZE,
        sheetWidth: 256,
        sheetHeight: 512,
        frames: this.createFrames(ENEMY_ANIMATION_ROWS, ENEMY_FRAMES_PER_ROW, ENEMY_FRAME_SIZE)
      },
      {
        id: 'mystery-walk',
        label: 'Mystery Walk/Idle',
        textureKey: MYSTERY_SPRITE_KEY,
        storageKey: `${STORAGE_PREFIX}-mystery-walk`,
        imageUrl: familiarCatSpriteSheetUrl,
        frameSize: MYSTERY_FRAME_SIZE,
        sheetWidth: 256,
        sheetHeight: 576,
        frames: this.createFrames(
          MYSTERY_MOVEMENT_ANIMATION_ROWS,
          MYSTERY_FRAMES_PER_ROW,
          MYSTERY_FRAME_SIZE
        ),
        getDefaultAdjustment: (frame) =>
          getMysteryDefaultFrameAdjustment(frame.key, frame.defaultSourceX, frame.defaultSourceY)
      },
      {
        id: 'mystery-pounce',
        label: 'Mystery Pounce',
        textureKey: MYSTERY_POUNCE_SPRITE_KEY,
        storageKey: `${STORAGE_PREFIX}-mystery-pounce`,
        imageUrl: familiarCatPounceSpriteSheetUrl,
        frameSize: MYSTERY_FRAME_SIZE,
        sheetWidth: 256,
        sheetHeight: 512,
        frames: this.createFrames(
          MYSTERY_POUNCE_ANIMATION_ROWS,
          MYSTERY_FRAMES_PER_ROW,
          MYSTERY_FRAME_SIZE
        )
      }
    ];
  }

  private fromPlayerFrame(frame: PlayerSpriteFrameDefinition): DebugFrameDefinition {
    return {
      key: frame.key,
      animationName: frame.animationName,
      frameIndex: frame.frameIndex,
      frameInAnimation: frame.frameInAnimation,
      defaultSourceX: frame.defaultSourceX,
      defaultSourceY: frame.defaultSourceY
    };
  }

  private createFrames(
    rows: readonly (readonly [string, number, number])[],
    framesPerRow: number,
    frameSize: number
  ): DebugFrameDefinition[] {
    return rows.flatMap(([animationName, row]) =>
      Array.from({ length: framesPerRow }, (_, frameInAnimation) => {
        const frameIndex = row * framesPerRow + frameInAnimation;

        return {
          key: `${animationName}-${frameInAnimation + 1}`,
          animationName,
          frameIndex,
          frameInAnimation,
          defaultSourceX: frameInAnimation * frameSize,
          defaultSourceY: row * frameSize
        };
      })
    );
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
            <p>Choose a sprite map, then adjust source crop and draw offsets per frame. Press F2 to toggle.</p>
          </div>
          <button type="button" class="debug-close">Close</button>
        </header>
        <div class="debug-sheet-row">
          <label>
            <span>Sprite Map</span>
            <select class="debug-sheet-select"></select>
          </label>
        </div>
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
              ${this.createSliderMarkup('sourceX', 'Source X')}
              ${this.createSliderMarkup('sourceY', 'Source Y')}
              ${this.createSliderMarkup('offsetX', 'Draw Offset X')}
              ${this.createSliderMarkup('offsetY', 'Draw Offset Y')}
            </div>
            <div class="debug-actions">
              <button type="button" class="debug-copy">Copy JSON</button>
              <button type="button" class="debug-reset-frame">Reset Frame</button>
              <button type="button" class="debug-reset-all">Reset Sheet</button>
            </div>
            <textarea class="debug-export" spellcheck="false" aria-label="Sprite frame adjustment JSON"></textarea>
          </div>
        </div>
      </section>
    `;

    overlay.querySelector('.debug-close')?.addEventListener('click', () => this.close());
    overlay.querySelector('.debug-copy')?.addEventListener('click', () => this.copyExport());
    overlay.querySelector('.debug-reset-frame')?.addEventListener('click', () => this.resetSelectedFrame());
    overlay.querySelector('.debug-reset-all')?.addEventListener('click', () => this.resetSelectedSheet());
    overlay.addEventListener('pointerdown', (event) => event.stopPropagation());
    overlay.addEventListener('keydown', (event) => event.stopPropagation());

    for (const axis of AXES) {
      const range = overlay.querySelector<HTMLInputElement>(`[data-range="${axis}"]`);
      const number = overlay.querySelector<HTMLInputElement>(`[data-number="${axis}"]`);

      if (!range || !number) {
        continue;
      }

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

  private createSliderMarkup(axis: Axis, label: string): string {
    return `
      <label class="debug-slider-row">
        <span>${label}</span>
        <input data-range="${axis}" type="range" step="1" />
        <input data-number="${axis}" type="number" step="1" />
      </label>
    `;
  }

  private renderSheetOptions(): void {
    this.sheetSelect.innerHTML = '';

    for (const sheet of this.sheets) {
      const option = document.createElement('option');
      option.value = sheet.id;
      option.textContent = sheet.label;
      this.sheetSelect.appendChild(option);
    }

    this.sheetSelect.addEventListener('change', () => this.selectSheet(this.sheetSelect.value));
  }

  private selectSheet(sheetId: string): void {
    const sheet = this.sheets.find((candidate) => candidate.id === sheetId) ?? this.sheets[0];
    this.selectedSheet = sheet;
    this.sheetSelect.value = sheet.id;
    this.adjustments = this.loadAdjustments(sheet);
    this.selectedFrame = sheet.frames[0];
    this.configureSliderLimits();
    this.renderFrameButtons();
    this.selectFrame(this.selectedFrame);
  }

  private configureSliderLimits(): void {
    const limits: Record<Axis, [number, number]> = {
      sourceX: [0, this.selectedSheet.sheetWidth - this.selectedSheet.frameSize],
      sourceY: [0, this.selectedSheet.sheetHeight - this.selectedSheet.frameSize],
      offsetX: [-this.selectedSheet.frameSize, this.selectedSheet.frameSize],
      offsetY: [-this.selectedSheet.frameSize, this.selectedSheet.frameSize]
    };

    for (const axis of AXES) {
      const range = this.overlay.querySelector<HTMLInputElement>(`[data-range="${axis}"]`);
      const number = this.overlay.querySelector<HTMLInputElement>(`[data-number="${axis}"]`);
      if (!range || !number) {
        continue;
      }

      const [min, max] = limits[axis];
      range.min = String(min);
      range.max = String(max);
      number.min = String(min);
      number.max = String(max);
    }
  }

  private renderFrameButtons(): void {
    this.frameGrid.innerHTML = '';

    let currentAnimation = '';
    for (const frame of this.selectedSheet.frames) {
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

  private selectFrame(frame: DebugFrameDefinition): void {
    this.selectedFrame = frame;
    const adjustment = this.getAdjustment(frame);

    for (const axis of AXES) {
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
    this.applyFrameAdjustment(this.selectedSheet, this.selectedFrame, next);
    this.saveAdjustments(this.selectedSheet, this.adjustments);
    this.updatePreview();
    this.updateExport();
  }

  private getAdjustment(frame: DebugFrameDefinition): DebugFrameAdjustment {
    return this.adjustments[frame.key] ?? this.getDefaultAdjustment(this.selectedSheet, frame);
  }

  private getDefaultAdjustment(
    sheet: DebugSpriteSheetDefinition,
    frame: DebugFrameDefinition
  ): DebugFrameAdjustment {
    return (
      sheet.getDefaultAdjustment?.(frame) ?? {
        sourceX: frame.defaultSourceX,
        sourceY: frame.defaultSourceY,
        offsetX: 0,
        offsetY: 0
      }
    );
  }

  private updatePreview(): void {
    const adjustment = this.getAdjustment(this.selectedFrame);
    const scale = Math.max(2, Math.floor(192 / this.selectedSheet.frameSize));

    this.previewFrame.style.width = `${this.selectedSheet.frameSize * scale}px`;
    this.previewFrame.style.height = `${this.selectedSheet.frameSize * scale}px`;
    this.previewFrame.style.backgroundImage = `url("${this.selectedSheet.imageUrl}")`;
    this.previewFrame.style.backgroundSize = `${this.selectedSheet.sheetWidth * scale}px ${
      this.selectedSheet.sheetHeight * scale
    }px`;
    this.previewFrame.style.backgroundPosition = `${-adjustment.sourceX * scale}px ${
      -adjustment.sourceY * scale
    }px`;
    this.previewFrame.style.transform = `translate(${adjustment.offsetX}px, ${adjustment.offsetY}px)`;
    this.previewMeta.textContent = `${this.selectedSheet.label} | ${this.selectedFrame.animationName} frame ${
      this.selectedFrame.frameInAnimation + 1
    } | source ${adjustment.sourceX}, ${adjustment.sourceY} | offset ${adjustment.offsetX}, ${
      adjustment.offsetY
    }`;
  }

  private updateExport(): void {
    this.exportText.value = JSON.stringify(
      {
        sheetId: this.selectedSheet.id,
        textureKey: this.selectedSheet.textureKey,
        storageKey: this.selectedSheet.storageKey,
        note: 'localStorage values override this sheet while the debug menu is active.',
        adjustments: this.adjustments
      },
      null,
      2
    );
  }

  private resetSelectedFrame(): void {
    delete this.adjustments[this.selectedFrame.key];
    this.applyFrameAdjustment(
      this.selectedSheet,
      this.selectedFrame,
      this.getDefaultAdjustment(this.selectedSheet, this.selectedFrame)
    );
    this.saveAdjustments(this.selectedSheet, this.adjustments);
    this.selectFrame(this.selectedFrame);
  }

  private resetSelectedSheet(): void {
    this.adjustments = {};
    localStorage.removeItem(this.selectedSheet.storageKey);

    for (const frame of this.selectedSheet.frames) {
      this.applyFrameAdjustment(
        this.selectedSheet,
        frame,
        this.getDefaultAdjustment(this.selectedSheet, frame)
      );
    }

    this.selectFrame(this.selectedFrame);
  }

  private applyAllSavedAdjustments(): void {
    for (const sheet of this.sheets) {
      const savedAdjustments = this.loadAdjustments(sheet);

      for (const frame of sheet.frames) {
        const adjustment = savedAdjustments[frame.key] ?? this.getDefaultAdjustment(sheet, frame);
        this.applyFrameAdjustment(sheet, frame, adjustment);
      }
    }
  }

  private applyFrameAdjustment(
    sheet: DebugSpriteSheetDefinition,
    frameDefinition: DebugFrameDefinition,
    adjustment: DebugFrameAdjustment
  ): void {
    if (sheet.applyAdjustment) {
      sheet.applyAdjustment(this.scene, frameDefinition, adjustment);
      return;
    }

    const frame = this.scene.textures.getFrame(sheet.textureKey, frameDefinition.frameIndex);
    if (!frame) {
      return;
    }

    frame.setCutPosition(adjustment.sourceX, adjustment.sourceY);
    frame.x = adjustment.offsetX;
    frame.y = adjustment.offsetY;
  }

  private loadAdjustments(sheet: DebugSpriteSheetDefinition): AdjustmentMap {
    const raw = localStorage.getItem(sheet.storageKey);
    if (!raw) {
      return {};
    }

    try {
      return JSON.parse(raw) as AdjustmentMap;
    } catch {
      return {};
    }
  }

  private saveAdjustments(sheet: DebugSpriteSheetDefinition, adjustments: AdjustmentMap): void {
    localStorage.setItem(sheet.storageKey, JSON.stringify(adjustments, null, 2));
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

  private mustQuery<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.overlay.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing debug UI element: ${selector}`);
    }

    return element;
  }
}
