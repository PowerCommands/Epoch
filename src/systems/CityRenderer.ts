import Phaser from 'phaser';
import { StructureDamageEffects } from '../renderers/StructureDamageEffects';
import { CITY_BASE_HEALTH } from '../data/cities';
import { TileMap } from './TileMap';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import type { City } from '../entities/City';
import { HexTileMaskHelper } from './HexTileMaskHelper';
import type { Era } from '../data/technologies';
import { getCitySpriteKey } from '../utils/assetPaths';
import { getCityFortificationLevel } from './CityDefenseSystem';

// Above units and their badges (18–19.5), below selection overlays (20–21).
const CITY_DEPTH = 19.6;
const CITY_TILE_FILL_SCALE = 0.9;
const CAPITAL_SCALE_MULTIPLIER = 1.2;
const FORTIFICATION_RING_COLOR = 0x454b52;
const FORTIFICATION_RING_ALPHA = 0.96;
const FORTIFICATION_RING_WIDTH_BY_LEVEL = [0, 3, 5, 8] as const;

const HIT_RADIUS = 20;

/**
 * CityRenderer draws a sprite for each city on the map.
 *
 * Uses an era-specific city texture based on the owning nation's current era.
 * Original and residence capitals use separate indicators so conquest
 * preserves historical identity without implying political control.
 */
export class CityRenderer {
  private readonly scene: Phaser.Scene;
  private readonly tileMap: TileMap;
  private readonly cityManager: CityManager;
  private readonly nationManager: NationManager;
  private readonly getNationEra: (nationId: string) => Era;
  private readonly damageEffects: StructureDamageEffects;
  private readonly containers = new Map<string, Phaser.GameObjects.Container>();
  private readonly hexTileMaskHelper: HexTileMaskHelper;
  private readonly threatGlows = new Map<string, Phaser.GameObjects.Graphics>();
  private threatPredicate: (city: City) => boolean = () => false;
  private visibilityPredicate: (tileX: number, tileY: number) => boolean = () => true;

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    cityManager: CityManager,
    nationManager: NationManager,
    getNationEra: (nationId: string) => Era,
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.cityManager = cityManager;
    this.nationManager = nationManager;
    this.getNationEra = getNationEra;
    this.hexTileMaskHelper = new HexTileMaskHelper(scene, tileMap);
    this.damageEffects = new StructureDamageEffects(scene, tileMap, CITY_DEPTH + 0.1, (x, y) => this.visibilityPredicate(x, y));

    for (const city of cityManager.getAllCities()) {
      this.renderCity(city);
    }
  }

  getCityContainer(cityId: string): Phaser.GameObjects.Container | undefined {
    return this.containers.get(cityId);
  }

  setVisibilityPredicate(predicate: (tileX: number, tileY: number) => boolean): void {
    this.visibilityPredicate = predicate;
    this.refreshAllVisibility();
  }

  setThreatPredicate(predicate: (city: City) => boolean): void {
    this.threatPredicate = predicate;
    this.refreshThreats();
  }

  refreshThreats(): void {
    for (const city of this.cityManager.getAllCities()) {
      this.threatGlows.get(city.id)?.setVisible(this.threatPredicate(city));
    }
  }

  /** Update visibility of all city containers without rebuilding them. */
  refreshAllVisibility(): void {
    this.refreshThreats();
    for (const city of this.cityManager.getAllCities()) {
      this.containers.get(city.id)?.setVisible(this.visibilityPredicate(city.tileX, city.tileY));
      this.damageEffects.set(city.id, city.tileX, city.tileY, city.health <= CITY_BASE_HEALTH / 2);
    }
  }

  /**
   * Destroy every rendered container and re-render from the
   * live CityManager. Used after a save is loaded, when the city set
   * has been replaced wholesale.
   */
  rebuildAll(): void {
    this.damageEffects.clear();
    for (const container of this.containers.values()) container.destroy();
    this.containers.clear();
    this.threatGlows.clear();

    for (const city of this.cityManager.getAllCities()) {
      this.renderCity(city);
    }
  }

  shutdown(): void {
    this.damageEffects.shutdown();
    for (const container of this.containers.values()) {
      container.destroy();
    }
    this.containers.clear();
    this.threatGlows.clear();
    this.hexTileMaskHelper.destroy();
  }

  /**
   * Destroy the rendered symbol for a city that no longer exists (e.g. razed).
   */
  removeCity(cityId: string): void {
    this.damageEffects.remove(cityId);
    this.threatGlows.delete(cityId);
    const container = this.containers.get(cityId);
    if (!container) return;
    container.destroy();
    this.containers.delete(cityId);
  }

  /**
   * Re-render city symbol (e.g. after ownership change).
   */
  refreshCity(city: City): void {
    this.damageEffects.remove(city.id);
    this.threatGlows.delete(city.id);
    const oldContainer = this.containers.get(city.id);
    if (oldContainer) {
      oldContainer.destroy();
      this.containers.delete(city.id);
    }

    this.renderCity(city);
  }

  private renderCity(city: City): void {
    const nation = this.nationManager.getNation(city.ownerId);
    if (!nation) return;

    const { x: worldX, y: worldY } = this.tileMap.tileToWorld(city.tileX, city.tileY);
    const rect = this.tileMap.getTileRect(city.tileX, city.tileY);

    const sprite = this.scene.add.image(0, 0, getCitySpriteKey(this.getNationEra(city.ownerId), city.health <= CITY_BASE_HEALTH / 2));
    const scaleMultiplier = city.isResidenceCapital ? CAPITAL_SCALE_MULTIPLIER : 1;
    sprite.setDisplaySize(
      rect.width * CITY_TILE_FILL_SCALE * scaleMultiplier,
      rect.height * CITY_TILE_FILL_SCALE * scaleMultiplier,
    );
    this.hexTileMaskHelper.applyHexMask(sprite, city.tileX, city.tileY);

    const glow = this.scene.add.graphics();
    const outline = this.tileMap.getTileOutlinePoints(city.tileX, city.tileY)
      .map((point) => new Phaser.Math.Vector2(point.x - worldX, point.y - worldY));
    glow.fillStyle(0xff3028, 0.22);
    glow.fillPoints(outline, true);
    // Layer translucent strokes to form a soft halo around the city's hex.
    for (const [width, alpha] of [[18, 0.06], [12, 0.1], [7, 0.22], [3, 0.9]]) {
      glow.lineStyle(width, 0xff3028, alpha);
      glow.strokePoints(outline, true);
    }
    glow.setVisible(this.threatPredicate(city));
    this.threatGlows.set(city.id, glow);
    const children: Phaser.GameObjects.GameObject[] = [glow, sprite];
    const fortificationLevel = getCityFortificationLevel(this.cityManager.getBuildings(city.id));
    if (fortificationLevel !== 0) {
      children.push(this.createFortificationRing(rect.width, rect.height, fortificationLevel));
    }
    if (city.isOriginalCapital) {
      children.push(this.createOriginalCapitalRing(rect.width, rect.height));
    }
    if (city.isResidenceCapital) {
      children.push(this.createResidenceCrown(rect.width, rect.height));
    }

    const container = this.scene.add.container(worldX, worldY, children);
    container.setDepth(CITY_DEPTH);

    // Interactive hit area — circle matching old behavior
    container.setSize(HIT_RADIUS * 2, HIT_RADIUS * 2);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, HIT_RADIUS),
      Phaser.Geom.Circle.Contains,
    );

    container.setVisible(this.visibilityPredicate(city.tileX, city.tileY));
    this.containers.set(city.id, container);
    this.damageEffects.set(city.id, city.tileX, city.tileY, city.health <= CITY_BASE_HEALTH / 2);
  }

  private createFortificationRing(
    tileWidth: number,
    tileHeight: number,
    level: 1 | 2 | 3,
  ): Phaser.GameObjects.Graphics {
    const ring = this.scene.add.graphics();
    ring.lineStyle(FORTIFICATION_RING_WIDTH_BY_LEVEL[level], FORTIFICATION_RING_COLOR, FORTIFICATION_RING_ALPHA);
    ring.strokeEllipse(0, 0, tileWidth * 0.98, tileHeight * 0.78);
    return ring;
  }

  private createOriginalCapitalRing(tileWidth: number, tileHeight: number): Phaser.GameObjects.Graphics {
    const ring = this.scene.add.graphics();
    ring.lineStyle(2, 0xf6e58d, 0.92);
    ring.strokeEllipse(0, 0, tileWidth * 0.82, tileHeight * 0.64);
    ring.lineStyle(1, 0x332b11, 0.65);
    ring.strokeEllipse(0, 0, tileWidth * 0.9, tileHeight * 0.7);
    return ring;
  }

  private createResidenceCrown(tileWidth: number, tileHeight: number): Phaser.GameObjects.Graphics {
    const crown = this.scene.add.graphics();
    const y = -tileHeight * 0.34;
    const w = tileWidth * 0.34;
    crown.fillStyle(0xf8d36b, 0.96);
    crown.lineStyle(1, 0x43330d, 0.85);
    crown.beginPath();
    crown.moveTo(-w / 2, y + 8);
    crown.lineTo(-w * 0.32, y - 2);
    crown.lineTo(-w * 0.1, y + 5);
    crown.lineTo(0, y - 6);
    crown.lineTo(w * 0.1, y + 5);
    crown.lineTo(w * 0.32, y - 2);
    crown.lineTo(w / 2, y + 8);
    crown.closePath();
    crown.fillPath();
    crown.strokePath();
    return crown;
  }
}
