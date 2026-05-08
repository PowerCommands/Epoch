import { getBuildingById } from '../data/buildings';
import type { BuildingType } from '../entities/Building';
import type { City } from '../entities/City';
import { TileType, type MapData, type Tile } from '../types/map';

export interface BuildingPlacementState {
  cityId: string;
  buildingId: string;
  validCoords: Array<{ x: number; y: number }>;
}

export type BuildingPlacementSelectionResult =
  | { status: 'inactive' | 'invalid' }
  | { status: 'reserved'; coord: { x: number; y: number }; buildingId: string };

export class BuildingPlacementSystem {
  private state: BuildingPlacementState | null = null;

  startPlacement(city: City, buildingId: string, mapData: MapData): boolean {
    const building = getBuildingById(buildingId);
    if (!building) return false;

    const validCoords = this.getValidPlacementCoords(city, building, mapData);
    if (validCoords.length === 0) return false;

    this.state = {
      cityId: city.id,
      buildingId,
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

  getState(): BuildingPlacementState | null {
    return this.state
      ? {
        cityId: this.state.cityId,
        buildingId: this.state.buildingId,
        validCoords: this.state.validCoords.map((coord) => ({ ...coord })),
      }
      : null;
  }

  getPlacementBuilding(): BuildingType | undefined {
    return this.state ? getBuildingById(this.state.buildingId) : undefined;
  }

  getValidPlacementCoords(
    city: City,
    building: string | BuildingType,
    mapData: MapData,
  ): Array<{ x: number; y: number }> {
    const def = typeof building === 'string' ? getBuildingById(building) : building;
    if (!def) return [];

    return city.ownedTileCoords
      .map((coord) => mapData.tiles[coord.y]?.[coord.x])
      .filter((tile): tile is Tile => tile !== undefined)
      .filter((tile) => this.isTileValidForPlacement(tile, def))
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
  ): BuildingPlacementSelectionResult {
    if (!this.state || this.state.cityId !== city.id || !coord) return { status: 'inactive' };

    const key = this.getCoordKey(coord.x, coord.y);
    const validSet = new Set(this.state.validCoords.map((entry) => this.getCoordKey(entry.x, entry.y)));
    if (!validSet.has(key)) return { status: 'invalid' };

    const tile = mapData.tiles[coord.y]?.[coord.x];
    if (!tile) return { status: 'invalid' };

    const buildingId = this.reservePlacement(tile);
    return { status: 'reserved', coord: { x: coord.x, y: coord.y }, buildingId };
  }

  findReservedTile(
    cityId: string,
    buildingId: string,
    mapData: MapData,
  ): Tile | null {
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (tile.buildingConstruction?.cityId !== cityId) continue;
        if (tile.buildingConstruction.buildingId !== buildingId) continue;
        return tile;
      }
    }
    return null;
  }

  finalizeReservedBuilding(
    cityId: string,
    buildingId: string,
    mapData: MapData,
  ): Tile | null {
    const tile = this.findReservedTile(cityId, buildingId, mapData);
    if (!tile) return null;

    tile.buildingConstruction = undefined;
    tile.buildingId = buildingId;
    return tile;
  }

  reserveFirstValidPlacement(
    city: City,
    building: BuildingType,
    mapData: MapData,
  ): { tileX: number; tileY: number } | undefined {
    const [coord] = this.getValidPlacementCoords(city, building, mapData);
    if (!coord) return undefined;

    const tile = mapData.tiles[coord.y]?.[coord.x];
    if (!tile) return undefined;
    tile.buildingConstruction = {
      buildingId: building.id,
      cityId: city.id,
    };
    return { tileX: coord.x, tileY: coord.y };
  }

  releaseCityBuildingReservation(cityId: string, buildingId: string, mapData: MapData): void {
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (tile.buildingConstruction?.cityId !== cityId) continue;
        if (tile.buildingConstruction.buildingId !== buildingId) continue;
        tile.buildingConstruction = undefined;
      }
    }
  }

  private reservePlacement(tile: Tile): string {
    if (!this.state) return '';
    const buildingId = this.state.buildingId;
    tile.buildingConstruction = {
      buildingId,
      cityId: this.state.cityId,
    };
    this.cancelPlacement();
    return buildingId;
  }

  private isTileValidForPlacement(tile: Tile, building: BuildingType): boolean {
    if (tile.buildingId !== undefined) return false;
    if (tile.buildingConstruction !== undefined) return false;
    if (tile.wonderId !== undefined) return false;
    if (tile.wonderConstruction !== undefined) return false;

    if (building.placement === 'water') {
      return tile.type === TileType.Ocean || tile.type === TileType.Coast;
    }

    return tile.type !== TileType.Ocean
      && tile.type !== TileType.Coast
      && tile.type !== TileType.Mountain;
  }

  private getCoordKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
