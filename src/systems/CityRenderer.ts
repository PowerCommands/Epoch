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

const HIT_RADIUS = 20;

/**
 * CityRenderer draws a sprite for each city on the map.
 *
 * Uses an era-specific city texture based on the owning nation's current era.
 * The crown identifies the current residence capital.
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
      children.push(this.createFortificationWall(outline, fortificationLevel));
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

  private createFortificationWall(
    outline: Phaser.Math.Vector2[],
    level: 1 | 2 | 3,
  ): Phaser.GameObjects.Graphics {
    const wall = this.scene.add.graphics();
    // Keep the masonry inside the tile and leave the city centre open.
    const outer = outline.map(p => ({ x: p.x * 0.91, y: p.y * 0.91 }));
    const innerScale = [0, 0.84, 0.80, 0.76][level];
    const inner = outline.map(p => ({ x: p.x * innerScale, y: p.y * innerScale }));
    const height = [0, 2.5, 4, 5.5][level];
    const stone = [0, 0xa99d80, 0xb1afa0, 0x9ea9ad][level];
    const shade = [0, 0x655f4f, 0x656963, 0x505e65][level];
    const light = [0, 0xd4c6a4, 0xdbd6c3, 0xd3dfe0][level];
    type Point = { x: number; y: number };
    const raised = (p: Point): Point => ({ x: p.x, y: p.y - height });
    const mix = (a: Point, b: Point, t: number): Point => ({
      x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
    });
    const face = (points: Point[], color: number): void => {
      wall.fillStyle(color, 1);
      wall.fillPoints(points.map(p => new Phaser.Math.Vector2(p.x, p.y)), true);
    };

    // Side faces first, then the continuous parapet top: shared vertices
    // keep all six corners sealed without thick strokes over the buildings.
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length;
      face([outer[i], outer[j], raised(outer[j]), raised(outer[i])], shade);
      face([inner[i], inner[j], raised(inner[j]), raised(inner[i])], shade);
    }
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length;
      face([raised(outer[i]), raised(outer[j]), raised(inner[j]), raised(inner[i])], stone);
      wall.lineStyle(0.6, light, 1);
      wall.lineBetween(outer[i].x, outer[i].y - height, outer[j].x, outer[j].y - height);
      const blocks = 5 + level;
      for (let k = 0; k < blocks; k++) {
        const start = (k + 0.16) / blocks;
        const end = (k + 0.65) / blocks;
        const a = raised(mix(outer[i], outer[j], start));
        const b = raised(mix(outer[i], outer[j], end));
        const c = raised(mix(inner[i], inner[j], end));
        const d = raised(mix(inner[i], inner[j], start));
        const lift = (p: Point): Point => ({ x: p.x, y: p.y - 1.4 });
        face([a, b, lift(b), lift(a)], shade);
        face([lift(a), lift(b), lift(c), lift(d)], light);
      }
    }
    // Upgrades add square stone towers, then broader reinforced bastions.
    if (level >= 2) {
      const size = level === 2 ? 3.8 : 5.6;
      for (let i = 0; i < outer.length; i++) {
        const p = mix(outer[i], inner[i], 0.5);
        const y = p.y - height - 2;
        wall.fillStyle(shade, 1);
        wall.fillRect(p.x - size / 2, y, size, height + 2);
        wall.fillStyle(light, 1);
        wall.fillRect(p.x - size / 2, y - size / 2, size, size / 2 + 1);
        wall.fillStyle(stone, 1);
        wall.fillRect(p.x - size / 2 + 0.8, y - size / 2 + 0.7, size - 1.6, size / 2 - 0.5);
      }
    }
    return wall;
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
