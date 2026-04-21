import Phaser from 'phaser';
import { MAP_MANIFEST_CACHE_KEY, MAP_MANIFEST_URL, parseMapManifest } from '../data/maps';
import { ALL_LEADERS } from '../data/leaders';

/**
 * BootScene — runs first at startup.
 * Loads all assets before the game begins.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Load generated map manifest first, then enqueue every listed scenario.
    this.load.json(MAP_MANIFEST_CACHE_KEY, MAP_MANIFEST_URL);
    this.load.once(`filecomplete-json-${MAP_MANIFEST_CACHE_KEY}`, () => {
      const manifest = parseMapManifest(this.cache.json.get(MAP_MANIFEST_CACHE_KEY));
      for (const map of manifest.maps) {
        this.load.json(map.key, map.file);
      }
    });

    // Sprite assets
    this.load.image('city_default', 'assets/sprites/city_default.png');
    this.load.image('unit_warrior', 'assets/sprites/unit_warrior.png');
    this.load.image('unit_archer', 'assets/sprites/unit_archer.png');
    this.load.image('unit_cavalry', 'assets/sprites/unit_cavalry.png');
    this.load.image('unit_settler', 'assets/sprites/unit_settler.png');
    this.load.image('unit_fishing_boat', 'assets/sprites/unit_fishing_boat.png');
    this.load.image('unit_transport_ship', 'assets/sprites/unit_transport_ship.png');

    // Leader portraits (used by the Phaser-side leader strip in GameScene)
    for (const leader of ALL_LEADERS) {
      this.load.image(`leader_${leader.id}`, leader.image);
    }
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
