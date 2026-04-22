import type { City } from '../entities/City';
import { getTerrainYield } from '../data/terrainYields';
import type { MapData, Tile } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import { getTileImprovementYield } from './CityEconomy';

export interface CityTileCoord {
  x: number;
  y: number;
}

const CLAIM_RANGE = 5;
const CLAIM_BASE_COST = 10;
const CLAIM_COST_PER_OWNED_TILE = 5;

export class CityTerritorySystem {
  initializeOwnedTiles(city: City, mapData: MapData, gridSystem: IGridSystem): void {
    const ownedTiles = [
      this.getTile(mapData, city.tileX, city.tileY),
      ...gridSystem.getWorkableCityTiles(city, mapData),
    ].filter((tile): tile is Tile => tile !== undefined);

    city.ownedTileCoords = this.normalizeCoords(ownedTiles.map((tile) => ({ x: tile.x, y: tile.y })));
    this.updateWorkedTiles(city, mapData);
    this.refreshNextExpansionTile(city, mapData);
  }

  updateWorkedTiles(city: City, mapData: MapData): void {
    const ownedTiles = this.getOwnedTiles(city, mapData);

    city.workedTileCoords = ownedTiles
      .map((tile) => {
        const terrainYield = getTerrainYield(tile.type);
        const improvementYield = getTileImprovementYield(tile);
        return {
          x: tile.x,
          y: tile.y,
          food: terrainYield.food + improvementYield.food,
          production: terrainYield.production + improvementYield.production,
          gold: terrainYield.gold + improvementYield.gold,
        };
      })
      .sort((a, b) => {
        if (a.food !== b.food) return b.food - a.food;
        if (a.production !== b.production) return b.production - a.production;
        if (a.gold !== b.gold) return b.gold - a.gold;
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      })
      .slice(0, city.population)
      .map(({ x, y }) => ({ x, y }));
  }

  getClaimCost(city: City, mapData: MapData): number {
    const ownedNearbyCount = mapData.tiles
      .flat()
      .filter((tile) => (
        tile.ownerId === city.ownerId &&
        this.getHexDistance({ x: city.tileX, y: city.tileY }, tile) <= CLAIM_RANGE
      )).length;

    return CLAIM_BASE_COST + ownedNearbyCount * CLAIM_COST_PER_OWNED_TILE;
  }

  getClaimableTiles(city: City, mapData: MapData): CityTileCoord[] {
    const ownedSet = new Set(city.ownedTileCoords.map((coord) => this.getCoordKey(coord.x, coord.y)));
    const frontierSet = new Set(
      this.getOwnedTiles(city, mapData).flatMap((tile) => (
        this.getNeighborCoords(tile.x, tile.y).map((coord) => this.getCoordKey(coord.x, coord.y))
      )),
    );

    return mapData.tiles
      .flat()
      .filter((tile) => {
        const key = this.getCoordKey(tile.x, tile.y);
        if (ownedSet.has(key)) return false;
        if (tile.ownerId !== undefined) return false;
        if (this.getHexDistance({ x: city.tileX, y: city.tileY }, tile) > CLAIM_RANGE) return false;
        if (!frontierSet.has(key)) return false;
        return true;
      })
      .map((tile) => ({ x: tile.x, y: tile.y }))
      .sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });
  }

  chooseNextExpansionTile(city: City, mapData: MapData): CityTileCoord | undefined {
    const claimable = this.getClaimableTiles(city, mapData);
    if (claimable.length === 0) return undefined;

    return [...claimable].sort((a, b) => {
      const tileA = this.getTile(mapData, a.x, a.y);
      const tileB = this.getTile(mapData, b.x, b.y);
      if (!tileA || !tileB) return 0;

      const yieldA = getTerrainYield(tileA.type);
      const yieldB = getTerrainYield(tileB.type);
      const scoreA = yieldA.food + yieldA.production + yieldA.gold;
      const scoreB = yieldB.food + yieldB.production + yieldB.gold;

      if (scoreA !== scoreB) return scoreB - scoreA;
      if (yieldA.food !== yieldB.food) return yieldB.food - yieldA.food;
      if (yieldA.production !== yieldB.production) return yieldB.production - yieldA.production;
      if (yieldA.gold !== yieldB.gold) return yieldB.gold - yieldA.gold;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    })[0];
  }

  refreshNextExpansionTile(city: City, mapData: MapData): void {
    const claimable = this.getClaimableTiles(city, mapData);
    if (claimable.length === 0) {
      city.nextExpansionTileCoord = undefined;
      return;
    }

    const claimableSet = new Set(claimable.map((coord) => this.getCoordKey(coord.x, coord.y)));
    const current = city.nextExpansionTileCoord;
    if (current && claimableSet.has(this.getCoordKey(current.x, current.y))) return;

    city.nextExpansionTileCoord = this.chooseNextExpansionTile(city, mapData);
  }

  setNextExpansionTile(city: City, coord: CityTileCoord, mapData: MapData): boolean {
    const claimableSet = new Set(
      this.getClaimableTiles(city, mapData).map((candidate) => this.getCoordKey(candidate.x, candidate.y)),
    );
    if (!claimableSet.has(this.getCoordKey(coord.x, coord.y))) return false;

    city.nextExpansionTileCoord = { x: coord.x, y: coord.y };
    return true;
  }

  getExpansionProgress(city: City, mapData: MapData): {
    currentCulture: number;
    requiredCulture: number;
    progressPercent: number;
  } | null {
    this.refreshNextExpansionTile(city, mapData);
    if (!city.nextExpansionTileCoord) return null;

    const requiredCulture = this.getClaimCost(city, mapData);
    if (requiredCulture <= 0) return null;

    const currentCulture = city.culture;
    const progressPercent = Math.max(0, Math.min(100, Math.round((currentCulture / requiredCulture) * 100)));

    return {
      currentCulture,
      requiredCulture,
      progressPercent,
    };
  }

  claimTile(city: City, coord: CityTileCoord, mapData: MapData): boolean {
    const tile = this.getTile(mapData, coord.x, coord.y);
    if (!tile) return false;

    const claimableSet = new Set(
      this.getClaimableTiles(city, mapData).map((candidate) => this.getCoordKey(candidate.x, candidate.y)),
    );
    if (!claimableSet.has(this.getCoordKey(coord.x, coord.y))) return false;

    const cost = this.getClaimCost(city, mapData);
    if (city.culture < cost) return false;

    city.culture -= cost;
    return this.applyClaimedTile(city, tile, mapData);
  }

  tryClaimNextExpansionTile(city: City, mapData: MapData): boolean {
    this.refreshNextExpansionTile(city, mapData);
    const target = city.nextExpansionTileCoord;
    if (!target) return false;
    return this.claimTile(city, target, mapData);
  }

  claimNextExpansionTileImmediately(city: City, mapData: MapData): boolean {
    this.refreshNextExpansionTile(city, mapData);
    const target = city.nextExpansionTileCoord;
    if (!target) return false;

    const tile = this.getTile(mapData, target.x, target.y);
    if (!tile) return false;

    const claimableSet = new Set(
      this.getClaimableTiles(city, mapData).map((candidate) => this.getCoordKey(candidate.x, candidate.y)),
    );
    if (!claimableSet.has(this.getCoordKey(target.x, target.y))) return false;

    return this.applyClaimedTile(city, tile, mapData);
  }

  private getOwnedTiles(city: City, mapData: MapData): Tile[] {
    return city.ownedTileCoords
      .map(({ x, y }) => this.getTile(mapData, x, y))
      .filter((tile): tile is Tile => tile !== undefined);
  }

  private applyClaimedTile(city: City, tile: Tile, mapData: MapData): boolean {
    tile.ownerId = city.ownerId;
    city.ownedTileCoords = this.normalizeCoords([
      ...city.ownedTileCoords,
      { x: tile.x, y: tile.y },
    ]);
    this.updateWorkedTiles(city, mapData);
    this.refreshNextExpansionTile(city, mapData);
    return true;
  }

  private normalizeCoords(coords: CityTileCoord[]): CityTileCoord[] {
    return [...new Map(
      coords.map((coord) => [this.getCoordKey(coord.x, coord.y), { x: coord.x, y: coord.y }]),
    ).values()].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
  }

  private getNeighborCoords(x: number, y: number): CityTileCoord[] {
    return [
      { x: x + 1, y },
      { x: x + 1, y: y - 1 },
      { x, y: y - 1 },
      { x: x - 1, y },
      { x: x - 1, y: y + 1 },
      { x, y: y + 1 },
    ];
  }

  private getTile(mapData: MapData, x: number, y: number): Tile | undefined {
    return mapData.tiles[y]?.[x];
  }

  private getHexDistance(a: CityTileCoord, b: CityTileCoord): number {
    const dq = a.x - b.x;
    const dr = a.y - b.y;
    const ds = -dq - dr;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
  }

  private getCoordKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
