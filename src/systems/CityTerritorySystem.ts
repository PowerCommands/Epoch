import type { City } from '../entities/City';
import { getGameSpeedById, scaleGameSpeedCost, type GameSpeedDefinition } from '../data/gameSpeeds';
import { TileType, type MapData, type Tile } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import { getTileYield } from './CityEconomy';

export interface CityTileCoord {
  x: number;
  y: number;
}

const CLAIM_RANGE = 5;
const CLAIM_BASE_COST = 5;
const CLAIM_COST_PER_OWNED_TILE = 2;

export class CityTerritorySystem {
  constructor(
    private readonly gameSpeed: GameSpeedDefinition = getGameSpeedById(undefined),
    private gridSystem?: IGridSystem,
  ) {}

  initializeOwnedTiles(city: City, mapData: MapData, gridSystem: IGridSystem): void {
    this.gridSystem = gridSystem;
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
        const tileYield = getTileYield(tile);
        return {
          x: tile.x,
          y: tile.y,
          food: tileYield.food,
          production: tileYield.production,
          gold: tileYield.gold,
          science: tileYield.science,
          culture: tileYield.culture,
        };
      })
      .sort((a, b) => {
        if (a.food !== b.food) return b.food - a.food;
        if (a.production !== b.production) return b.production - a.production;
        if (a.gold !== b.gold) return b.gold - a.gold;
        if (a.science !== b.science) return b.science - a.science;
        if (a.culture !== b.culture) return b.culture - a.culture;
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
        this.getExpansionRingDistance(city, tile) <= CLAIM_RANGE
      )).length;

    return scaleGameSpeedCost(CLAIM_BASE_COST + ownedNearbyCount * CLAIM_COST_PER_OWNED_TILE, this.gameSpeed);
  }

  getClaimableTiles(city: City, mapData: MapData): CityTileCoord[] {
    const ownedSet = new Set(city.ownedTileCoords.map((coord) => this.getCoordKey(coord.x, coord.y)));

    return mapData.tiles
      .flat()
      .filter((tile) => {
        const key = this.getCoordKey(tile.x, tile.y);
        if (ownedSet.has(key)) return false;
        if (tile.ownerId !== undefined) return false;
        const distance = this.getExpansionRingDistance(city, tile);
        if (distance < 2) return false;
        if (distance > CLAIM_RANGE) return false;
        return true;
      })
      .map((tile) => ({ x: tile.x, y: tile.y }))
      .sort((a, b) => this.compareCoords(a, b));
  }

  chooseNextExpansionTile(city: City, mapData: MapData): CityTileCoord | undefined {
    const candidatesByRing = this.getExpansionCandidatesByRing(city, mapData);
    const nearestRing = [...candidatesByRing.keys()].sort((a, b) => a - b)[0];
    if (nearestRing === undefined) return undefined;

    return candidatesByRing.get(nearestRing)
      ?.sort((a, b) => this.compareExpansionCandidatesWithinRing(a, b))[0];
  }

  getExpansionRingDistance(city: City, coord: CityTileCoord): number {
    const cityCenter = { x: city.tileX, y: city.tileY };
    return this.gridSystem?.getDistance(cityCenter, coord) ?? this.getHexDistance(cityCenter, coord);
  }

  getExpansionCandidatesByRing(city: City, mapData: MapData): Map<number, Tile[]> {
    const candidatesByRing = new Map<number, Tile[]>();
    const claimableSet = new Set(this.getClaimableTiles(city, mapData).map((coord) => this.getCoordKey(coord.x, coord.y)));

    for (const tile of mapData.tiles.flat()) {
      if (!claimableSet.has(this.getCoordKey(tile.x, tile.y))) continue;
      const distance = this.getExpansionRingDistance(city, tile);
      const ringCandidates = candidatesByRing.get(distance) ?? [];
      ringCandidates.push(tile);
      candidatesByRing.set(distance, ringCandidates);
    }

    for (const candidates of candidatesByRing.values()) {
      candidates.sort((a, b) => this.compareExpansionCandidatesWithinRing(a, b));
    }

    return candidatesByRing;
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

  transferCityTerritory(city: City, newOwnerId: string, mapData: MapData): void {
    city.ownedTileCoords = this.normalizeCoords([
      ...city.ownedTileCoords,
      { x: city.tileX, y: city.tileY },
    ]);

    for (const coord of city.ownedTileCoords) {
      const tile = this.getTile(mapData, coord.x, coord.y);
      if (!tile) continue;
      tile.ownerId = newOwnerId;
    }
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

  /**
   * Generic tile-claim helper used by non-culture sources (wonder bonuses,
   * events, leader abilities). Bypasses culture cost and city-distance
   * filtering so callers can decide their own placement rules, but reuses
   * the shared claim state-update path so ownership, ownedTileCoords and
   * worked-tile bookkeeping stay consistent with culture/purchase claims.
   *
   * Returns false when the tile is out of bounds, already owned by anyone,
   * or already in this city's owned set.
   */
  claimTileForCity(city: City, coord: CityTileCoord, mapData: MapData): boolean {
    const tile = this.getTile(mapData, coord.x, coord.y);
    if (!tile) return false;
    if (tile.ownerId !== undefined) return false;
    if (city.ownedTileCoords.some((existing) => existing.x === coord.x && existing.y === coord.y)) {
      return false;
    }
    return this.applyClaimedTile(city, tile, mapData);
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
    ).values()].sort((a, b) => this.compareCoords(a, b));
  }

  private getTile(mapData: MapData, x: number, y: number): Tile | undefined {
    return mapData.tiles[y]?.[x];
  }

  private compareExpansionCandidatesWithinRing(a: Tile, b: Tile): number {
    const aHasResource = a.resourceId !== undefined;
    const bHasResource = b.resourceId !== undefined;
    if (aHasResource || bHasResource) {
      if (aHasResource !== bHasResource) return aHasResource ? -1 : 1;
      return this.compareCoords(a, b);
    }

    const aIsLowPriorityTerrain = this.isLowPriorityExpansionTerrain(a);
    const bIsLowPriorityTerrain = this.isLowPriorityExpansionTerrain(b);
    if (aIsLowPriorityTerrain !== bIsLowPriorityTerrain) return aIsLowPriorityTerrain ? 1 : -1;

    const yieldA = getTileYield(a);
    const yieldB = getTileYield(b);
    const scoreA = yieldA.food + yieldA.production + yieldA.gold + yieldA.science + yieldA.culture;
    const scoreB = yieldB.food + yieldB.production + yieldB.gold + yieldB.science + yieldB.culture;

    if (scoreA !== scoreB) return scoreB - scoreA;
    if (yieldA.food !== yieldB.food) return yieldB.food - yieldA.food;
    if (yieldA.production !== yieldB.production) return yieldB.production - yieldA.production;
    if (yieldA.gold !== yieldB.gold) return yieldB.gold - yieldA.gold;
    if (yieldA.science !== yieldB.science) return yieldB.science - yieldA.science;
    if (yieldA.culture !== yieldB.culture) return yieldB.culture - yieldA.culture;
    return this.compareCoords(a, b);
  }

  private isLowPriorityExpansionTerrain(tile: Tile): boolean {
    return tile.type === TileType.Ice || tile.type === TileType.Desert;
  }

  private compareCoords(a: CityTileCoord, b: CityTileCoord): number {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
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
