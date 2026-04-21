import type { City } from '../entities/City';
import type { MapData, Tile } from '../types/map';
import { CityTerritorySystem } from './CityTerritorySystem';

const cityTerritorySystem = new CityTerritorySystem();
const knownTileSets = new WeakMap<Tile, Tile[]>();

function toMapData(tiles: Tile[]): MapData {
  const maxX = tiles.reduce((max, tile) => Math.max(max, tile.x), 0);
  const maxY = tiles.reduce((max, tile) => Math.max(max, tile.y), 0);
  const rows: Tile[][] = Array.from({ length: maxY + 1 }, () => []);
  for (const tile of tiles) {
    rows[tile.y][tile.x] = tile;
  }
  return {
    width: maxX + 1,
    height: maxY + 1,
    tileSize: 0,
    tiles: rows,
  };
}

export function getClaimCost(city: City, tiles: Tile[]): number {
  registerTileSet(tiles);
  return cityTerritorySystem.getClaimCost(city, toMapData(tiles));
}

export function getClaimableTiles(city: City, tiles: Tile[]): Tile[] {
  registerTileSet(tiles);
  const mapData = toMapData(tiles);
  return cityTerritorySystem.getClaimableTiles(city, mapData)
    .map((coord) => mapData.tiles[coord.y]?.[coord.x])
    .filter((tile): tile is Tile => tile !== undefined);
}

export function claimTile(city: City, tile: Tile): boolean {
  const tiles = knownTileSets.get(tile);
  if (!tiles) return false;
  return cityTerritorySystem.claimTile(city, { x: tile.x, y: tile.y }, toMapData(tiles));
}

function registerTileSet(tiles: Tile[]): void {
  for (const tile of tiles) {
    knownTileSets.set(tile, tiles);
  }
}
