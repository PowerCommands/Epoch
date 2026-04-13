import Phaser from 'phaser';

/**
 * BootScene — körs först vid start.
 * Ansvarar för att ladda in minimala assets innan spelet börjar.
 * I detta tidiga skede finns inga riktiga assets att ladda,
 * så vi går direkt vidare till MainMenuScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
