import Phaser from 'phaser';

/**
 * BootScene — körs först vid start.
 * Ansvarar för att ladda in assets innan spelet börjar.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.json('scenario', '/europeScenario.json');
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
