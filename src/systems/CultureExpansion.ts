import type { City } from '../entities/City';
import type { Tile } from '../types/map';

const CLAIM_RANGE = 5;
const CLAIM_BASE_COST = 10;
const CLAIM_COST_PER_OWNED_TILE = 5;

const AXIAL_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
] as const;

const knownTileSets = new WeakMap<Tile, Tile[]>();

export function getClaimCost(city: City, tiles: Tile[]): number {
  registerTileSet(tiles);

  const ownedNearbyCount = tiles.filter((tile) => (
    tile.ownerId === city.ownerId &&
    getHexDistance({ x: city.tileX, y: city.tileY }, tile) <= CLAIM_RANGE
  )).length;

  return CLAIM_BASE_COST + ownedNearbyCount * CLAIM_COST_PER_OWNED_TILE;
}

export function getClaimableTiles(city: City, tiles: Tile[]): Tile[] {
  registerTileSet(tiles);

  const tileByCoord = createTileLookup(tiles);

  return tiles.filter((tile) => (
    tile.ownerId == null &&
    getHexDistance({ x: city.tileX, y: city.tileY }, tile) <= CLAIM_RANGE &&
    getNeighborTiles(tile, tileByCoord).some((neighbor) => neighbor.ownerId === city.ownerId)
  ));
}

export function claimTile(city: City, tile: Tile): boolean {
  const tiles = knownTileSets.get(tile);
  if (!tiles) return false;

  if (!getClaimableTiles(city, tiles).includes(tile)) return false;

  const cost = getClaimCost(city, tiles);
  if (city.culture < cost) return false;

  city.culture -= cost;
  tile.ownerId = city.ownerId;

  return true;
}

function registerTileSet(tiles: Tile[]): void {
  for (const tile of tiles) {
    knownTileSets.set(tile, tiles);
  }
}

function createTileLookup(tiles: Tile[]): Map<string, Tile> {
  const tileByCoord = new Map<string, Tile>();
  for (const tile of tiles) {
    tileByCoord.set(getCoordKey(tile.x, tile.y), tile);
  }
  return tileByCoord;
}

function getNeighborTiles(tile: Tile, tileByCoord: Map<string, Tile>): Tile[] {
  const neighbors: Tile[] = [];
  for (const direction of AXIAL_DIRECTIONS) {
    const neighbor = tileByCoord.get(getCoordKey(tile.x + direction.x, tile.y + direction.y));
    if (neighbor) neighbors.push(neighbor);
  }
  return neighbors;
}

function getHexDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dq = a.x - b.x;
  const dr = a.y - b.y;
  const ds = -dq - dr;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

function getCoordKey(x: number, y: number): string {
  return `${x},${y}`;
}
