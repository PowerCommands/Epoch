import Phaser from 'phaser';
import { AVAILABLE_MAPS } from '../data/maps';

/**
 * BootScene — runs first at startup.
 * Loads all assets before the game begins.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Load all available map scenarios
    for (const map of AVAILABLE_MAPS) {
      this.load.json(map.key, map.file);
    }

    // Sprite assets
    this.load.image('city_default', 'assets/sprites/city_default.png');
    this.load.image('unit_warrior', 'assets/sprites/unit_warrior.png');
    this.load.image('unit_archer', 'assets/sprites/unit_archer.png');
    this.load.image('unit_cavalry', 'assets/sprites/unit_cavalry.png');
    this.load.image('unit_settler', 'assets/sprites/unit_settler.png');
    this.load.image('unit_fishing_boat', 'assets/sprites/unit_fishing_boat.png');
    this.load.image('unit_transport_ship', 'assets/sprites/unit_transport_ship.png');

    // Terrain sprites
    const terrainTypes = ['ocean', 'coast', 'plains', 'forest', 'mountain', 'ice', 'jungle', 'desert'];
    for (const t of terrainTypes) {
      this.load.image(`terrain_${t}`, `assets/sprites/terrain/${t}.png`);
    }
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
