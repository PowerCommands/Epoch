import Phaser from 'phaser';
import type { City } from '../entities/City';
import type { MapData } from '../types/map';
import type { CityTerritorySystem } from './CityTerritorySystem';
import { TileMap } from './TileMap';
import { getWorkedTileYieldBreakdown } from './CityEconomy';
import type { CityViewInteractionState } from './CityViewInteractionController';
import type { IGridSystem } from './grid/IGridSystem';
import type { ProductionSystem } from './ProductionSystem';

const CITY_VIEW_DEPTH = 17;
const CITY_VIEW_TEXT_DEPTH = 17.5;

export interface CityViewPlacementRenderState {
  active: boolean;
  validCoords: Array<{ x: number; y: number }>;
}

export class CityViewRenderer {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly labelLayer: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly mapData: MapData,
    private readonly cityTerritorySystem: CityTerritorySystem,
    private readonly gridSystem: IGridSystem,
    private readonly productionSystem: ProductionSystem,
  ) {
    this.gfx = scene.add.graphics().setDepth(CITY_VIEW_DEPTH);
    this.labelLayer = scene.add.container(0, 0).setDepth(CITY_VIEW_TEXT_DEPTH);
  }

  show(city: City): void {
    this.showWithState(city, { dragActive: false, validDropCoords: [] }, { active: false, validCoords: [] });
  }

  showWithInteraction(city: City, interaction: CityViewInteractionState): void {
    this.showWithState(city, interaction, { active: false, validCoords: [] });
  }

  showWithState(
    city: City,
    interaction: CityViewInteractionState,
    placement: CityViewPlacementRenderState,
  ): void {
    this.gfx.clear();
    this.labelLayer.removeAll(true);

    const ownedSet = new Set(city.ownedTileCoords.map((coord) => `${coord.x},${coord.y}`));
    const workedSet = new Set(city.workedTileCoords.map((coord) => `${coord.x},${coord.y}`));
    const claimableCoords = this.cityTerritorySystem.getClaimableTiles(city, this.mapData);
    const claimableSet = new Set(claimableCoords.map((coord) => `${coord.x},${coord.y}`));
    const nextKey = city.nextExpansionTileCoord
      ? `${city.nextExpansionTileCoord.x},${city.nextExpansionTileCoord.y}`
      : null;
    const focusSet = this.buildFocusSet(city, claimableCoords);
    const workedBreakdown = getWorkedTileYieldBreakdown(city, this.mapData, this.gridSystem);
    const expansionProgress = this.cityTerritorySystem.getExpansionProgress(city, this.mapData);
    const validDropSet = new Set(interaction.validDropCoords.map((coord) => `${coord.x},${coord.y}`));
    const validPlacementSet = new Set(placement.validCoords.map((coord) => `${coord.x},${coord.y}`));
    const constructionTiles = city.ownedTileCoords
      .map((coord) => this.mapData.tiles[coord.y]?.[coord.x])
      .filter((tile): tile is NonNullable<typeof tile> => (
        tile !== undefined && tile.buildingConstruction?.cityId === city.id
      ));

    this.drawOuterDim(focusSet);

    for (const coord of city.ownedTileCoords) {
      if (workedSet.has(`${coord.x},${coord.y}`)) continue;
      this.drawTile(coord.x, coord.y, 0xf4efe3, 0.12, 0xf0d7a6, 0.32, 1);
    }

    for (const coord of city.workedTileCoords) {
      this.drawTile(coord.x, coord.y, 0x56d78a, 0.28, 0x79f0aa, 0.92, 2);
    }

    for (const key of claimableSet) {
      if (ownedSet.has(key) || key === nextKey) continue;
      const [x, y] = key.split(',').map(Number);
      if (interaction.dragActive && validDropSet.has(key)) {
        this.drawTile(x, y, 0xff6fb1, 0.16, 0xff9bca, 0.75, 2);
      } else {
        this.drawTile(x, y, 0x4cb8ff, 0.1, 0x9bddff, 0.5, 2);
      }
    }

    if (placement.active) {
      for (const key of validPlacementSet) {
        const [x, y] = key.split(',').map(Number);
        this.drawTile(x, y, 0x2ef0ff, 0.2, 0xa5fcff, 0.88, 2.5);
      }
    }

    if (nextKey) {
      const [x, y] = nextKey.split(',').map(Number);
      this.drawExpansionProgressTile(x, y, expansionProgress?.progressPercent ?? 0);
    }

    for (const tile of constructionTiles) {
      this.drawConstructionProgressTile(tile.x, tile.y, tile.buildingConstruction!.buildingId, city.id);
    }

    this.drawWorkedTileMarkers(workedBreakdown);
    this.drawTile(city.tileX, city.tileY, 0xfff3b0, 0.34, 0xffffff, 1, 3);
  }

  clear(): void {
    this.gfx.clear();
    this.labelLayer.removeAll(true);
  }

  private drawTile(
    tileX: number,
    tileY: number,
    fillColor: number,
    fillAlpha: number,
    strokeColor: number,
    strokeAlpha: number,
    strokeWidth: number,
  ): void {
    const outline = this.tileMap.getTileOutlinePoints(tileX, tileY);
    if (outline.length === 0) return;

    this.gfx.fillStyle(fillColor, fillAlpha);
    this.fillPolygon(outline);
    this.gfx.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    this.strokePolygon(outline);
  }

  private drawOuterDim(focusSet: Set<string>): void {
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (focusSet.has(`${tile.x},${tile.y}`)) continue;
        const outline = this.tileMap.getTileOutlinePoints(tile.x, tile.y);
        if (outline.length === 0) continue;
        this.gfx.fillStyle(0x081018, 0.48);
        this.fillPolygon(outline);
      }
    }
  }

  private drawWorkedTileMarkers(
    tiles: ReturnType<typeof getWorkedTileYieldBreakdown>,
  ): void {
    for (const tile of tiles) {
      const entries = this.formatYieldEntries(tile);
      if (entries.length === 0) continue;

      const { x, y } = this.tileMap.tileToWorld(tile.coord.x, tile.coord.y);
      const label = this.labelLayer.scene.add.text(
        x,
        y + 2,
        entries.join(' '),
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '7px',
          color: '#fffde8',
          align: 'center',
          stroke: '#132018',
          strokeThickness: 2,
        },
      );
      label.setOrigin(0.5, 0.5);
      label.setShadow(0, 1, '#000000', 2, false, true);
      this.labelLayer.add(label);
    }
  }

  private formatYieldEntries(tile: ReturnType<typeof getWorkedTileYieldBreakdown>[number]): string[] {
    const entries: string[] = [];
    if (tile.food > 0) entries.push('🌾');
    if (tile.production > 0) entries.push('⚙️');
    if (tile.gold > 0) entries.push('💰');
    if (tile.science > 0) entries.push('🔬');
    if (tile.culture > 0) entries.push('⭐');
    if (tile.happiness > 0) entries.push('😀');
    return entries;
  }

  private buildFocusSet(
    city: City,
    claimableCoords: Array<{ x: number; y: number }>,
  ): Set<string> {
    const focusSet = new Set<string>();

    const include = (x: number, y: number): void => {
      if (!this.mapData.tiles[y]?.[x]) return;
      focusSet.add(`${x},${y}`);
    };

    include(city.tileX, city.tileY);
    for (const coord of city.ownedTileCoords) include(coord.x, coord.y);
    for (const coord of claimableCoords) {
      include(coord.x, coord.y);
      for (const neighbor of this.gridSystem.getAdjacentCoords(coord)) {
        include(neighbor.x, neighbor.y);
      }
    }

    return focusSet;
  }

  private drawExpansionProgressTile(tileX: number, tileY: number, progressPercent: number): void {
    const outline = this.tileMap.getTileOutlinePoints(tileX, tileY);
    if (outline.length === 0) return;

    this.gfx.fillStyle(0xff78b7, 0.14);
    this.fillPolygon(outline);

    const center = this.tileMap.tileToWorld(tileX, tileY);
    const progressScale = 0.22 + (0.78 * progressPercent) / 100;
    const progressOutline = outline.map((point) => ({
      x: center.x + (point.x - center.x) * progressScale,
      y: center.y + (point.y - center.y) * progressScale,
    }));
    this.gfx.fillStyle(0xff4fa1, 0.3 + (0.35 * progressPercent) / 100);
    this.fillPolygon(progressOutline);
    this.gfx.lineStyle(3, 0xffc6df, 1);
    this.strokePolygon(outline);

    const label = this.labelLayer.scene.add.text(
      center.x,
      center.y,
      `${progressPercent}%`,
      {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#fff7fb',
        align: 'center',
        stroke: '#5d1237',
        strokeThickness: 4,
      },
    );
    label.setOrigin(0.5, 0.5);
    label.setShadow(0, 2, '#000000', 3, false, true);
    this.labelLayer.add(label);
  }

  private drawConstructionProgressTile(tileX: number, tileY: number, buildingId: string, cityId: string): void {
    const outline = this.tileMap.getTileOutlinePoints(tileX, tileY);
    if (outline.length === 0) return;

    this.gfx.fillStyle(0x6b86a1, 0.16);
    this.fillPolygon(outline);
    this.gfx.lineStyle(2.5, 0xd4ecff, 0.95);
    this.strokePolygon(outline);

    const entry = this.productionSystem.getQueue(cityId)
      .find((queueEntry) => (
        queueEntry.item.kind === 'building' && queueEntry.item.buildingType.id === buildingId
      ));
    const progressPercent = !entry || entry.cost <= 0
      ? 0
      : Math.max(0, Math.min(100, Math.floor((entry.progress / entry.cost) * 100)));
    const center = this.tileMap.tileToWorld(tileX, tileY);
    const label = this.labelLayer.scene.add.text(
      center.x,
      center.y,
      `${progressPercent}%`,
      {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f4fbff',
        align: 'center',
        stroke: '#173146',
        strokeThickness: 4,
      },
    );
    label.setOrigin(0.5, 0.5);
    label.setShadow(0, 2, '#000000', 3, false, true);
    this.labelLayer.add(label);
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
