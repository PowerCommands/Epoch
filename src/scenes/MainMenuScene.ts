import Phaser from 'phaser';

/**
 * MainMenuScene — spelets startskärm.
 * Visar spelets titel och en knapp för att starta spelet.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Titel
    this.add
      .text(width / 2, height / 2 - 60, 'Strategy Game', {
        fontSize: '64px',
        color: '#e8e8e8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Klickbar "Start Game"-knapp
    const startButton = this.add
      .text(width / 2, height / 2 + 60, 'Start Game', {
        fontSize: '32px',
        color: '#a0c4ff',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // Hover-effekter för att ge visuell återkoppling
    startButton.on('pointerover', () => {
      startButton.setStyle({ color: '#ffffff' });
    });

    startButton.on('pointerout', () => {
      startButton.setStyle({ color: '#a0c4ff' });
    });

    startButton.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }
}
