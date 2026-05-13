import Phaser from 'phaser';
import { PLAYER_CHARACTERS, type PlayerCharacterId } from '../../config/playerCharacters';

export class StartScene extends Phaser.Scene {
  private selectedCharacterId: PlayerCharacterId = 'wizard';
  private characterTexts: Partial<Record<PlayerCharacterId, Phaser.GameObjects.Text>> = {};

  constructor() {
    super('StartScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 94, 'Wilderness Gnomes', {
        color: '#f5e8c5',
        fontFamily: 'Georgia, serif',
        fontSize: '56px'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 20, 'WASD to move. Magic fires on its own.', {
        color: '#c9b992',
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 28, 'Choose your wanderer', {
        color: '#e6d5ae',
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px'
      })
      .setOrigin(0.5);

    this.createCharacterChoice(width / 2 - 120, height / 2 + 76, 'wizard');
    this.createCharacterChoice(width / 2 + 120, height / 2 + 76, 'hailey');
    this.updateCharacterChoiceText();

    this.add
      .text(width / 2, height / 2 + 140, 'Press 1/2 to choose. SPACE or ENTER to begin.', {
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px'
      })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown-ONE', () => this.selectCharacter('wizard'));
    this.input.keyboard?.on('keydown-TWO', () => this.selectCharacter('hailey'));
    this.input.keyboard?.once('keydown-SPACE', () => this.startGame());
    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
  }

  private createCharacterChoice(x: number, y: number, characterId: PlayerCharacterId): void {
    const text = this.add
      .text(x, y, PLAYER_CHARACTERS[characterId].name, {
        color: '#f7f0dc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        padding: { x: 12, y: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    text.on('pointerdown', () => this.selectCharacter(characterId));
    this.characterTexts[characterId] = text;
  }

  private selectCharacter(characterId: PlayerCharacterId): void {
    this.selectedCharacterId = characterId;
    this.updateCharacterChoiceText();
  }

  private updateCharacterChoiceText(): void {
    for (const [characterId, text] of Object.entries(this.characterTexts) as [
      PlayerCharacterId,
      Phaser.GameObjects.Text
    ][]) {
      const selected = characterId === this.selectedCharacterId;
      text.setColor(selected ? '#ffe3a1' : '#b9aa8a');
      text.setBackgroundColor(selected ? '#3a2e1d' : '#171a13');
      text.setText(`${selected ? '> ' : ''}${PLAYER_CHARACTERS[characterId].name}${selected ? ' <' : ''}`);
    }
  }

  private startGame(): void {
    this.scene.start('GameScene', { characterId: this.selectedCharacterId });
  }
}
