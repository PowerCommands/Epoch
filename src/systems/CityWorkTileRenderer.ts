import Phaser from 'phaser';
import type { City } from '../entities/City';
import type { CityManager } from './CityManager';
import type { MapData } from '../types/map';
import { TileMap } from './TileMap';
import { getWorkableTiles, getWorkedTiles } from './CityEconomy';
import type { IGridSystem } from './grid/IGridSystem';

/**
 * CityWorkTileRenderer — highlights workable and worked tiles when a city is selected.
 * Worked tiles get a stronger highlight, non-worked workable tiles a weaker one.
 * Renders at depth 4 (below territory fill at 5).
 */
export class CityWorkTileRenderer {
  private readonly scene: Phaser.Scene;
  private readonly tileMap: TileMap;
  private readonly cityManager: CityManager;
  private readonly mapData: MapData;
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    cityManager: CityManager,
    mapData: MapData,
    private readonly gridSystem: IGridSystem,
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.cityManager = cityManager;
    this.mapData = mapData;
    this.gfx = scene.add.graphics().setDepth(4);
  }

  show(city: City): void {
    this.gfx.clear();

    const workable = getWorkableTiles(city, this.mapData, this.gridSystem);
    const worked = getWorkedTiles(city, this.mapData, this.gridSystem);
    const workedSet = new Set(worked.map((w) => `${w.tile.x},${w.tile.y}`));

    // Draw non-worked workable tiles (weaker)
    for (const tile of workable) {
      const key = `${tile.x},${tile.y}`;
      if (workedSet.has(key)) continue;
      const outline = this.tileMap.getTileOutlinePoints(tile.x, tile.y);
      this.gfx.fillStyle(0xffffff, 0.08);
      this.fillPolygon(outline);
      this.gfx.lineStyle(1, 0xffffff, 0.15);
      this.strokePolygon(outline);
    }

    // Draw worked tiles (stronger)
    for (const w of worked) {
      const outline = this.tileMap.getTileOutlinePoints(w.tile.x, w.tile.y);
      this.gfx.fillStyle(0x44cc44, 0.18);
      this.fillPolygon(outline);
      this.gfx.lineStyle(1, 0x44cc44, 0.4);
      this.strokePolygon(outline);
    }
  }

  clear(): void {
    this.gfx.clear();
  }

  private fillPolygon(points: { x: number; y: number }[]): void {
    if (points.length === 0) return;
    this.gfx.beginPath();
    this.gfx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      this.gfx.lineTo(point.x, point.y);
    }
    this.gfx.closePath();
    this.gfx.fillPath();
  }

  private strokePolygon(points: { x: number; y: number }[]): void {
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
