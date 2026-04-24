import Phaser from 'phaser';
import type { City } from '../entities/City';
import type { MapData } from '../types/map';
import type { CityTerritorySystem } from './CityTerritorySystem';
import { NationManager } from './NationManager';
import { TileMap } from './TileMap';

const CLAIM_DEPTH = 19;
const CLAIM_OUTLINE_COLOR = 0xffdd44;

interface Point {
  x: number;
  y: number;
}

/**
 * Highlights culture-claim targets for the selected human city.
 * Draws outlines above map overlays and units, below hover/selection highlights.
 */
export class CultureClaimTileRenderer {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private selectedCity: City | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly nationManager: NationManager,
    private readonly mapData: MapData,
    private readonly cityTerritorySystem: CityTerritorySystem,
    private readonly humanNationId: string | undefined,
  ) {
    this.gfx = scene.add.graphics().setDepth(CLAIM_DEPTH);
  }

  show(city: City): void {
    this.selectedCity = city;
    this.render();
  }

  clear(): void {
    this.selectedCity = null;
    this.gfx.clear();
  }

  refresh(): void {
    this.render();
  }

  private render(): void {
    this.gfx.clear();
    const city = this.selectedCity;
    if (!city || city.ownerId !== this.humanNationId) return;

    const cost = this.cityTerritorySystem.getClaimCost(city, this.mapData);
    if (city.culture < cost) return;

    const claimableTiles = this.cityTerritorySystem.getClaimableTiles(city, this.mapData)
      .map((coord) => this.mapData.tiles[coord.y]?.[coord.x])
      .filter((tile): tile is NonNullable<typeof tile> => tile !== undefined);
    if (claimableTiles.length === 0) return;

    const nationColor = this.nationManager.getNation(city.ownerId)?.color ?? CLAIM_OUTLINE_COLOR;
    for (const tile of claimableTiles) {
      const outline = this.tileMap.getTileOutlinePoints(tile.x, tile.y);
      this.gfx.lineStyle(2, nationColor, 0.9);
      this.strokePolygon(outline);
      this.gfx.lineStyle(1, CLAIM_OUTLINE_COLOR, 0.85);
      this.strokePolygon(outline);
    }
  }

  private strokePolygon(points: Point[]): void {
    if (points.length === 0) return;
    this.gfx.beginPath();
    this.gfx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      this.gfx.lineTo(point.x, point.y);
    }
    this.gfx.closePath();
    this.gfx.strokePath();
  }
}
