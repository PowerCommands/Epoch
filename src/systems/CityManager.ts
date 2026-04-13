import { City } from '../entities/City';
import { CityResources } from '../entities/CityResources';
import { NationManager } from './NationManager';
import { MapData } from '../types/map';

/**
 * CityManager är "single source of truth" för alla städer.
 * Ingen Phaser-koppling.
 */
export class CityManager {
  private readonly cities = new Map<string, City>();
  private readonly resources = new Map<string, CityResources>();

  addCity(city: City): void {
    this.cities.set(city.id, city);
    this.resources.set(city.id, new CityResources(city.id));
  }

  getCity(id: string): City | undefined {
    return this.cities.get(id);
  }

  getAllCities(): City[] {
    return Array.from(this.cities.values());
  }

  getCityAt(tileX: number, tileY: number): City | undefined {
    for (const city of this.cities.values()) {
      if (city.tileX === tileX && city.tileY === tileY) return city;
    }
    return undefined;
  }

  getCitiesByOwner(ownerId: string): City[] {
    return this.getAllCities().filter((c) => c.ownerId === ownerId);
  }

  getResources(cityId: string): CityResources {
    return this.resources.get(cityId)!;
  }

  /**
   * Skapa en CityManager med en huvudstad per nation.
   *
   * Placerar varje huvudstad vid nationens center-tile om den ägs av
   * nationen; annars på den första ägda tilen.
   */
  static createDefault(nationManager: NationManager, mapData: MapData): CityManager {
    const manager = new CityManager();

    const capitals: { nationId: string; name: string; cx: number; cy: number }[] = [
      { nationId: 'nation_red',    name: 'Aurelia',    cx: 8,  cy: 6  },
      { nationId: 'nation_blue',   name: 'Tidehaven',  cx: 31, cy: 6  },
      { nationId: 'nation_green',  name: 'Greenmere',  cx: 8,  cy: 18 },
      { nationId: 'nation_yellow', name: 'Sunspire',   cx: 31, cy: 18 },
    ];

    for (const cap of capitals) {
      const nation = nationManager.getNation(cap.nationId);
      if (nation === undefined) continue;

      // Använd center-tilen om den tillhör nationen, annars fallback
      let tileX = cap.cx;
      let tileY = cap.cy;

      const centerTile = mapData.tiles[cap.cy]?.[cap.cx];
      if (!centerTile || centerTile.ownerId !== cap.nationId) {
        const fallback = CityManager.findFirstOwnedTile(mapData, cap.nationId);
        if (fallback) {
          tileX = fallback.x;
          tileY = fallback.y;
        }
      }

      manager.addCity(
        new City({
          id: `city_${cap.nationId}_capital`,
          name: cap.name,
          ownerId: cap.nationId,
          tileX,
          tileY,
        }),
      );
    }

    return manager;
  }

  private static findFirstOwnedTile(
    mapData: MapData,
    nationId: string,
  ): { x: number; y: number } | null {
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId === nationId) return { x: tile.x, y: tile.y };
      }
    }
    return null;
  }
}
