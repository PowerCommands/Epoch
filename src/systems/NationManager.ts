import { Nation } from '../entities/Nation';
import { NationResources } from '../entities/NationResources';
import { MapData, TileType } from '../types/map';

/** Tile-typer som kan ägas av en nation. */
const CLAIMABLE_TYPES = new Set<TileType>([
  TileType.Plains,
  TileType.Forest,
  TileType.Mountain,
]);

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
   * Skapa en NationManager med 4 defaultnationer och tilldela
   * startterritorier på den givna kartan.
   *
   * Varje nation får en 5×5-fyrkant centrerad i sin kvadrant.
   * Tiles som är hav eller kust hoppas över.
   */
  static createDefault(mapData: MapData): NationManager {
    const manager = new NationManager();

    const configs: { id: string; name: string; color: number; cx: number; cy: number }[] = [
      { id: 'nation_red',    name: 'Crimson Empire',   color: 0xd13b3b, cx: 8,  cy: 6  },
      { id: 'nation_blue',   name: 'Azure Kingdom',    color: 0x3b6dd1, cx: 31, cy: 6  },
      { id: 'nation_green',  name: 'Verdant Republic', color: 0x3bb04a, cx: 8,  cy: 18 },
      { id: 'nation_yellow', name: 'Golden Dominion',  color: 0xd1b03b, cx: 31, cy: 18 },
    ];

    for (const cfg of configs) {
      manager.addNation(new Nation(cfg));
      NationManager.claimArea(mapData, cfg.id, cfg.cx, cfg.cy, 5);
    }

    return manager;
  }

  /**
   * Tilldela en fyrkant av tiles till en nation.
   * Bara tiles med claimable terrängtyp (Plains/Forest/Mountain) påverkas.
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
        if (CLAIMABLE_TYPES.has(tile.type)) {
          tile.ownerId = nationId;
        }
      }
    }
  }
}
