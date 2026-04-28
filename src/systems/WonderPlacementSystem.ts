import { getWonderById } from '../data/wonders';
import type { City } from '../entities/City';
import type { WonderType } from '../entities/Wonder';
import { TileType, type MapData, type Tile } from '../types/map';

export interface WonderPlacementState {
  cityId: string;
  wonderId: string;
  validCoords: Array<{ x: number; y: number }>;
}

export type WonderPlacementSelectionResult =
  | { status: 'inactive' | 'invalid' }
  | { status: 'reserved'; coord: { x: number; y: number }; wonderId: string };

const ADJACENT_COORDS = [
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
];

export class WonderPlacementSystem {
  private state: WonderPlacementState | null = null;

  startPlacement(city: City, wonderId: string, mapData: MapData): boolean {
    const wonder = getWonderById(wonderId);
    if (!wonder) return false;

    const validCoords = this.getValidPlacementCoords(city, wonder, mapData);
    if (validCoords.length === 0) return false;

    this.state = {
      cityId: city.id,
      wonderId,
      validCoords,
    };
    return true;
  }

  cancelPlacement(): void {
    this.state = null;
  }

  isActive(): boolean {
    return this.state !== null;
  }

  isActiveForCity(cityId: string): boolean {
    return this.state?.cityId === cityId;
  }

  getState(): WonderPlacementState | null {
    return this.state
      ? {
        cityId: this.state.cityId,
        wonderId: this.state.wonderId,
        validCoords: this.state.validCoords.map((coord) => ({ ...coord })),
      }
      : null;
  }

  getValidPlacementCoords(
    city: City,
    wonder: string | WonderType,
    mapData: MapData,
  ): Array<{ x: number; y: number }> {
    const def = typeof wonder === 'string' ? getWonderById(wonder) : wonder;
    if (!def) return [];

    const ownedSet = new Set(city.ownedTileCoords.map((coord) => this.getCoordKey(coord.x, coord.y)));
    return city.ownedTileCoords
      .map((coord) => mapData.tiles[coord.y]?.[coord.x])
      .filter((tile): tile is Tile => tile !== undefined)
      .filter((tile) => this.isTileValidForPlacement(tile, city, ownedSet, def, mapData))
      .map((tile) => ({ x: tile.x, y: tile.y }))
      .sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });
  }

  selectTile(
    city: City,
    coord: { x: number; y: number } | null,
    mapData: MapData,
  ): WonderPlacementSelectionResult {
    if (!this.state || this.state.cityId !== city.id || !coord) return { status: 'inactive' };

    const key = this.getCoordKey(coord.x, coord.y);
    const validSet = new Set(this.state.validCoords.map((entry) => this.getCoordKey(entry.x, entry.y)));
    if (!validSet.has(key)) return { status: 'invalid' };

    const tile = mapData.tiles[coord.y]?.[coord.x];
    if (!tile) return { status: 'invalid' };

    const wonderId = this.reservePlacement(tile);
    return { status: 'reserved', coord: { x: coord.x, y: coord.y }, wonderId };
  }

  findReservedTile(cityId: string, wonderId: string, mapData: MapData): Tile | null {
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (tile.wonderConstruction?.cityId !== cityId) continue;
        if (tile.wonderConstruction.wonderId !== wonderId) continue;
        return tile;
      }
    }
    return null;
  }

  finalizeReservedWonder(cityId: string, wonderId: string, mapData: MapData): Tile | null {
    const tile = this.findReservedTile(cityId, wonderId, mapData);
    if (!tile) return null;

    tile.wonderConstruction = undefined;
    tile.wonderId = wonderId;
    return tile;
  }

  releaseWonderReservations(wonderId: string, mapData: MapData): void {
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (tile.wonderConstruction?.wonderId === wonderId) {
          tile.wonderConstruction = undefined;
        }
      }
    }
  }

  releaseCityWonderReservation(cityId: string, wonderId: string, mapData: MapData): void {
    const tile = this.findReservedTile(cityId, wonderId, mapData);
    if (tile) tile.wonderConstruction = undefined;
  }

  private reservePlacement(tile: Tile): string {
    if (!this.state) return '';
    const wonderId = this.state.wonderId;
    tile.wonderConstruction = {
      wonderId,
      cityId: this.state.cityId,
    };
    this.cancelPlacement();
    return wonderId;
  }

  private isTileValidForPlacement(
    tile: Tile,
    city: City,
    ownedSet: Set<string>,
    wonder: WonderType,
    mapData: MapData,
  ): boolean {
    if (tile.ownerId !== city.ownerId) return false;
    if (!ownedSet.has(this.getCoordKey(tile.x, tile.y))) return false;
    if (tile.buildingId !== undefined || tile.buildingConstruction !== undefined) return false;
    if (tile.improvementConstruction !== undefined) return false;
    if (tile.wonderId !== undefined || tile.wonderConstruction !== undefined) return false;

    const placement = wonder.placement;
    const isWater = tile.type === TileType.Ocean || tile.type === TileType.Coast;
    const isLand = !isWater && tile.type !== TileType.Mountain;

    if (placement?.landOnly && !isLand) return false;
    if (placement?.waterOnly && !isWater) return false;
    if (!placement?.waterOnly && !isLand && tile.type !== TileType.Coast) return false;
    if (placement?.requiresCoast && !this.isCoastal(tile, mapData)) return false;
    if (placement?.requiresMountainAdjacent && !this.hasAdjacentType(tile, mapData, TileType.Mountain)) return false;
    if (placement?.requiresRiver) {
      // TODO: wire this when river data exists on map tiles.
      return false;
    }

    return true;
  }

  private isCoastal(tile: Tile, mapData: MapData): boolean {
    return tile.type === TileType.Coast
      || this.getNeighbors(tile, mapData).some((neighbor) => (
        neighbor.type === TileType.Coast || neighbor.type === TileType.Ocean
      ));
  }

  private hasAdjacentType(tile: Tile, mapData: MapData, type: TileType): boolean {
    return this.getNeighbors(tile, mapData).some((neighbor) => neighbor.type === type);
  }

  private getNeighbors(tile: Tile, mapData: MapData): Tile[] {
    return ADJACENT_COORDS
      .map((offset) => mapData.tiles[tile.y + offset.y]?.[tile.x + offset.x])
      .filter((neighbor): neighbor is Tile => neighbor !== undefined);
  }

  private getCoordKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
