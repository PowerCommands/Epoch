import { getBuildingById } from '../data/buildings';
import { isPowerPlantBuilding } from '../data/powerPlants';
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
    // An upgrade's predecessor already determines its physical destination.
    // It must never expose the ordinary placement cursor.
    if (!building || building.placement === 'city' || this.isAutomaticUpgrade(city, building, mapData)) return false;

    const validCoords = this.getValidPlacementCoords(city, building, mapData);
    if (validCoords.length === 0) return false;

    this.state = {
      cityId: city.id,
      buildingId,
      validCoords,
    };
    return true;
  }

  isAutomaticUpgrade(city: City, building: BuildingType, map: MapData): boolean {
    return !!building.upgradesFrom && (!building.canBuildWithoutPredecessor || !!this.findUpgradePredecessorTile(city, building, map));
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
    if (!def || def.placement === 'city') return [];

    if (def.upgradesFrom) {
      const predecessorTile = this.findUpgradePredecessorTile(city, def, mapData);
      if (predecessorTile) return [{ x: predecessorTile.x, y: predecessorTile.y }];
      if (!def.canBuildWithoutPredecessor) return [];
    }

    return city.ownedTileCoords
      .map((coord) => mapData.tiles[coord.y]?.[coord.x])
      .filter((tile): tile is Tile => tile !== undefined)
      .filter((tile) => !def.requiresEmptyTile || (tile.ownerId === city.ownerId && (tile.x !== city.tileX || tile.y !== city.tileY)))
      .filter((tile) => this.isTileValidForPlacement(tile, def))
      .map((tile) => ({ x: tile.x, y: tile.y }))
      .sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });
  }

  /** Return the city-local predecessor tile that fixes a physical upgrade's destination. */
  findUpgradePredecessorTile(
    city: City,
    building: BuildingType,
    mapData: MapData,
  ): Tile | null {
    if (building.placement === 'city' || !building.upgradesFrom) return null;
    for (const coord of city.ownedTileCoords) {
      const tile = mapData.tiles[coord.y]?.[coord.x];
      if (tile?.buildingId === building.upgradesFrom) return tile;
    }
    return null;
  }

  /**
   * Complete a physical building without exposing upgrade replacement details
   * to human or AI callers. Ordinary buildings still require a reservation;
   * upgrades atomically replace their predecessor on its existing tile.
   */
  completePhysicalBuilding(
    city: City,
    building: BuildingType,
    mapData: MapData,
  ): Tile | null {
    if (building.placement === 'city') return null;
    if (!this.isAutomaticUpgrade(city, building, mapData)) {
      if (building.requiresEmptyTile) {
        const tile = this.findReservedTile(city.id, building.id, mapData);
        if (!tile || tile.ownerId !== city.ownerId
          || !city.ownedTileCoords.some(coord => coord.x === tile.x && coord.y === tile.y)) return null;
      }
      return this.finalizeReservedBuilding(city.id, building.id, mapData);
    }

    const tile = this.findUpgradePredecessorTile(city, building, mapData);
    if (!tile) return null;
    if (!this.isTerrainCompatible(tile, building)) {
      console.warn(
        `[BuildingPlacement] Upgrade configuration mismatch: ${building.id} inherits `
        + `${building.upgradesFrom}'s incompatible tile at ${tile.x},${tile.y}.`,
      );
    }

    // Keep ownership and coordinates untouched and never expose an unoccupied
    // intermediate state to renderers or other gameplay systems.
    tile.buildingId = building.id;
    tile.buildingBroken = undefined;
    return tile;
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

    const def = getBuildingById(buildingId);
    if (def?.requiresEmptyTile && (!this.isTerrainCompatible(tile, def) || tile.resourceId || tile.improvementId || tile.improvementConstruction || tile.buildingId)) return null;
    tile.buildingConstruction = undefined;
    tile.buildingId = buildingId;
    tile.buildingBroken = undefined;
    return tile;
  }

  reserveFirstValidPlacement(
    city: City,
    building: BuildingType,
    mapData: MapData,
  ): { tileX: number; tileY: number } | undefined {
    if (building.placement === 'city' || this.isAutomaticUpgrade(city, building, mapData)) return undefined;
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
    if (building.placement === 'city') return false;
    if (building.requiresEmptyTile && (tile.resourceId || tile.improvementId || tile.improvementConstruction)) return false;
    const replacingPowerPlant = tile.buildingId !== undefined
      && isPowerPlantBuilding(building.id)
      && isPowerPlantBuilding(tile.buildingId);
    if (tile.buildingId !== undefined && !replacingPowerPlant) return false;
    if (tile.buildingConstruction !== undefined) return false;
    if (tile.wonderId !== undefined) return false;
    if (tile.wonderConstruction !== undefined) return false;

    return this.isTerrainCompatible(tile, building);
  }

  private isTerrainCompatible(tile: Tile, building: BuildingType): boolean {
    if (building.allowedTerrains && !building.allowedTerrains.includes(tile.type)) return false;

    if (building.placement === 'water') {
      return tile.type === TileType.Ocean || tile.type === TileType.Coast;
    }

    if (tile.type === TileType.Ocean || tile.type === TileType.Coast) return false;
    // Mountains remain unavailable to unrestricted land buildings. An explicit
    // terrain whitelist opts a building into occupying them.
    return tile.type !== TileType.Mountain
      || building.allowedTerrains?.includes(TileType.Mountain) === true;
  }

  private getCoordKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
