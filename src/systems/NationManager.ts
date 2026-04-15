import { Nation } from '../entities/Nation';
import { NationResources } from '../entities/NationResources';
import { MapData, TileType } from '../types/map';
import type { ScenarioNation } from '../types/scenario';

/** Tile-typer som kan ägas av en nation. */
const CLAIMABLE_TYPES = new Set<TileType>([
  TileType.Plains,
  TileType.Forest,
  TileType.Mountain,
  TileType.Jungle,
  TileType.Desert,
]);

/**
 * Search outward in expanding rings for nearest non-ocean tile.
 * Returns null if none found within maxRadius.
 */
function findNearestLandTile(
  col: number,
  row: number,
  mapData: MapData,
  maxRadius: number,
): { x: number; y: number } | null {
  // Check center first
  const center = mapData.tiles[row]?.[col];
  if (center && center.type !== TileType.Ocean) return { x: col, y: row };

  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Only check tiles on the ring perimeter
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const tx = col + dx;
        const ty = row + dy;
        const tile = mapData.tiles[ty]?.[tx];
        if (tile && tile.type !== TileType.Ocean) return { x: tx, y: ty };
      }
    }
  }

  return null;
}

/**
 * NationManager är "single source of truth" för all nationsdata.
 *
 * Ingen Phaser-koppling — kan användas i tester och på en framtida
 * server-sida utan ändringar.
 */
export class NationManager {
  private readonly nations = new Map<string, Nation>();
  private readonly resources = new Map<string, NationResources>();

  addNation(nation: Nation): void {
    this.nations.set(nation.id, nation);
    this.resources.set(nation.id, new NationResources(nation.id));
  }

  getNation(id: string): Nation | undefined {
    return this.nations.get(id);
  }

  getAllNations(): Nation[] {
    return Array.from(this.nations.values());
  }

  getResources(nationId: string): NationResources {
    return this.resources.get(nationId)!;
  }

  /** Return the id of the first human-controlled nation, or undefined. */
  getHumanNationId(): string | undefined {
    for (const nation of this.nations.values()) {
      if (nation.isHuman) return nation.id;
    }
    return undefined;
  }

  /** Räkna antalet tiles som ägs av en viss nation. */
  getTileCount(nationId: string, mapData: MapData): number {
    let count = 0;
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId === nationId) count++;
      }
    }
    return count;
  }

  /**
   * Skapa en NationManager med 6 historical nations on the Europe map.
   * Each nation gets a 5×5 claimed territory centered on their capital.
   */
  static createDefault(mapData: MapData): NationManager {
    const manager = new NationManager();

    const configs: { id: string; name: string; color: number; cx: number; cy: number }[] = [
      { id: 'nation_england', name: 'England',            color: 0xC8102E, cx: 22,  cy: 59 },
      { id: 'nation_france',  name: 'France',             color: 0x002395, cx: 26,  cy: 66 },
      { id: 'nation_hre',     name: 'Holy Roman Empire',  color: 0xFFD700, cx: 83,  cy: 68 },
      { id: 'nation_sweden',  name: 'Sweden',             color: 0x006AA7, cx: 86,  cy: 37 },
      { id: 'nation_ottoman', name: 'Ottoman Empire',     color: 0xE30A17, cx: 112, cy: 88 },
      { id: 'nation_spain',   name: 'Spain',              color: 0xAA151B, cx: 15,  cy: 91 },
    ];

    for (const cfg of configs) {
      const land = findNearestLandTile(cfg.cx, cfg.cy, mapData, 5);
      const actualX = land?.x ?? cfg.cx;
      const actualY = land?.y ?? cfg.cy;

      console.log(
        `[NationManager] ${cfg.name}: target (${cfg.cx},${cfg.cy}) → actual (${actualX},${actualY})`,
      );

      manager.addNation(new Nation({ id: cfg.id, name: cfg.name, color: cfg.color }));
      NationManager.claimArea(mapData, cfg.id, actualX, actualY, 5);
    }

    return manager;
  }

  /**
   * Create a NationManager from scenario data.
   * Each nation gets a 5×5 claimed territory centered on startTerritoryCenter.
   */
  static loadFromScenario(nations: ScenarioNation[], mapData: MapData): NationManager {
    const manager = new NationManager();

    for (const cfg of nations) {
      const color = parseInt(cfg.color.replace('#', ''), 16);
      const land = findNearestLandTile(cfg.startTerritoryCenter.x, cfg.startTerritoryCenter.y, mapData, 5);
      const actualX = land?.x ?? cfg.startTerritoryCenter.x;
      const actualY = land?.y ?? cfg.startTerritoryCenter.y;

      manager.addNation(new Nation({ id: cfg.id, name: cfg.name, color, isHuman: cfg.isHuman }));
      NationManager.claimArea(mapData, cfg.id, actualX, actualY, 5);
    }

    return manager;
  }

  /**
   * Tilldela en fyrkant av tiles till en nation.
   * Bara tiles med claimable terrängtyp (Plains/Forest/Mountain) påverkas.
   * Tiles already claimed by another nation are skipped.
   */
  private static claimArea(
    mapData: MapData,
    nationId: string,
    centerX: number,
    centerY: number,
    size: number,
  ): void {
    const half = Math.floor(size / 2);

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const tx = centerX + dx;
        const ty = centerY + dy;

        if (tx < 0 || ty < 0 || tx >= mapData.width || ty >= mapData.height) continue;

        const tile = mapData.tiles[ty][tx];
        if (CLAIMABLE_TYPES.has(tile.type) && !tile.ownerId) {
          tile.ownerId = nationId;
        }
      }
    }
  }
}
