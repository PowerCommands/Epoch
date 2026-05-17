import Phaser from 'phaser';
import { CULTURE_TREE } from '../data/cultureTree';
import { MAP_MANIFEST_CACHE_KEY, MAP_MANIFEST_URL, parseMapManifest } from '../data/maps';
import { ALL_LEADERS } from '../data/leaders';
import { NATURAL_RESOURCES } from '../data/naturalResources';
import { ALL_POLICIES } from '../data/policies';
import { ALL_TECHNOLOGIES } from '../data/technologies';
import { ALL_UNIT_TYPES, SPECIAL_UNIT_TYPES } from '../data/units';
import { CORPORATIONS } from '../data/corporations';
import {
  getCorporationSpriteKey,
  getCorporationSpritePath,
  getCultureSpriteKey,
  getCultureSpritePath,
  getPolicySpriteKey,
  getPolicySpritePath,
  getTechnologySpriteKey,
  getTechnologySpritePath,
  getUnitActionSpriteKey,
  getUnitActionSpritePath,
  getUnitSpriteKey,
  getUnitSpritePath,
} from '../utils/assetPaths';

// Action ids that have base-image overrides today. Only these are pre-loaded
// so Phaser does not try to fetch missing optional files for every unit type.
const UNIT_ACTION_PRELOAD: ReadonlyArray<{ unitTypeId: string; actionId: string }> = [
  { unitTypeId: 'worker', actionId: 'improvement' },
  { unitTypeId: 'work_boat', actionId: 'improvement' },
];

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
    this.load.image('end_turn', 'assets/sprites/end_turn.png');
    this.load.image('action_move', 'assets/sprites/actions/move.png');
    this.load.image('action_attack', 'assets/sprites/actions/attack.png');
    this.load.image('action_ranged_attack', 'assets/sprites/actions/ranged-attack.png');
    this.load.image('action_sleep', 'assets/sprites/actions/sleep.png');
    this.load.image('action_improve', 'assets/sprites/actions/improve.png');
    this.load.image('action_found_city', 'assets/sprites/actions/found-city.png');
    this.load.svg('action_dismiss', 'assets/sprites/actions/dismiss.svg', { width: 64, height: 64 });

    // Base unit images, keyed by unitType.id (e.g. worker, work_boat, settler).
    // Special units are preloaded for systems that spawn them directly, but
    // remain outside normal production candidate lists.
    for (const unitType of [...ALL_UNIT_TYPES, ...SPECIAL_UNIT_TYPES]) {
      this.load.image(getUnitSpriteKey(unitType.id), getUnitSpritePath(unitType.id));
    }

    // Per-action overrides for unit images. Loaded only for known action ids
    // so Phaser does not 404 on optional files.
    for (const entry of UNIT_ACTION_PRELOAD) {
      this.load.image(
        getUnitActionSpriteKey(entry.unitTypeId, entry.actionId),
        getUnitActionSpritePath(entry.unitTypeId, entry.actionId),
      );
    }

    for (const resource of NATURAL_RESOURCES) {
      this.load.image(resource.iconKey, `assets/sprites/resources/${resource.id}.png`);
    }

    for (const technology of ALL_TECHNOLOGIES) {
      this.load.image(getTechnologySpriteKey(technology.id), getTechnologySpritePath(technology.id));
    }

    for (const cultureNode of CULTURE_TREE) {
      this.load.image(getCultureSpriteKey(cultureNode.id), getCultureSpritePath(cultureNode.id));
    }

    for (const corporation of CORPORATIONS) {
      this.load.image(getCorporationSpriteKey(corporation.id), getCorporationSpritePath(corporation.id));
    }

    for (const policy of ALL_POLICIES) {
      this.load.image(getPolicySpriteKey(policy.id), getPolicySpritePath(policy.id));
    }

    // Leader portraits (used by the Phaser-side leader strip in GameScene)
    for (const leader of ALL_LEADERS) {
      this.load.image(`leader_${leader.id}`, leader.image);
    }
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
