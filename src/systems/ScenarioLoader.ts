import { MapData, Tile, TileType } from '../types/map';
import type {
  ScenarioData,
  ScenarioNation,
  ScenarioCity,
  ScenarioUnit,
} from '../types/scenario';
import type { WorldMarker } from '../types/WorldMarker';

const TYPE_MAP: Record<string, TileType> = {
  ocean: TileType.Ocean,
  coast: TileType.Coast,
  plains: TileType.Plains,
  forest: TileType.Forest,
  mountain: TileType.Mountain,
  ice: TileType.Ice,
  jungle: TileType.Jungle,
  desert: TileType.Desert,
};

export interface ParsedScenario {
  mapData: MapData;
  nations: ScenarioNation[];
  cities: ScenarioCity[];
  units: ScenarioUnit[];
  worldMarkers: WorldMarker[];
}

/**
 * ScenarioLoader — Phaser-free utility that converts raw scenario JSON
 * into structured data ready for the game managers.
 */
export class ScenarioLoader {
  static parse(json: ScenarioData): ParsedScenario {
    const { width, height, tileSize } = json.map;

    // Build empty 2D tile grid
    const tiles: Tile[][] = [];
    for (let y = 0; y < height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < width; x++) {
        row.push({ x, y, type: TileType.Ocean });
      }
      tiles.push(row);
    }

    // Fill from q/r-authored flat array (case-insensitive lookup)
    for (const entry of json.map.tiles) {
      const tile = tiles[entry.r]?.[entry.q];
      if (tile) {
        tile.type = TYPE_MAP[entry.type.toLowerCase()] ?? TileType.Ocean;
        tile.resourceId = entry.resourceId;
        tile.improvementId = entry.improvementId;
        tile.buildingId = entry.buildingId;
      }
    }

    return {
      mapData: { width, height, tileSize, tiles },
      nations: json.nations,
      cities: json.cities,
      units: json.units,
      worldMarkers: json.worldMarkers ?? [],
    };
  }
}
