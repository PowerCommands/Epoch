import { City } from '../entities/City';
import { CityResources } from '../entities/CityResources';
import { CityBuildings } from '../entities/CityBuildings';
import { NationManager } from './NationManager';
import { MapData, TileType } from '../types/map';
import type { ScenarioCity } from '../types/scenario';

/**
 * Search outward in expanding rings for nearest non-ocean tile.
 */
function findNearestLandTile(
  col: number,
  row: number,
  mapData: MapData,
  maxRadius: number,
): { x: number; y: number } | null {
  const center = mapData.tiles[row]?.[col];
  if (center && center.type !== TileType.Ocean) return { x: col, y: row };

  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
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
 * CityManager är "single source of truth" för alla städer.
 * Ingen Phaser-koppling.
 */
export class CityManager {
  private readonly cities = new Map<string, City>();
  private readonly resources = new Map<string, CityResources>();
  private readonly buildings = new Map<string, CityBuildings>();

  addCity(city: City): void {
    this.cities.set(city.id, city);
    this.resources.set(city.id, new CityResources(city.id));
    this.buildings.set(city.id, new CityBuildings(city.id));
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

  getBuildings(cityId: string): CityBuildings {
    return this.buildings.get(cityId)!;
  }

  /**
   * Överför stad till ny ägare. Rensa produktion, behåll byggnader.
   */
  transferOwnership(
    cityId: string,
    newOwnerId: string,
    productionSystem?: { clearProduction(cityId: string): void },
  ): void {
    const city = this.cities.get(cityId);
    if (!city) return;

    city.ownerId = newOwnerId;

    if (productionSystem) {
      productionSystem.clearProduction(cityId);
    }
  }

  /**
   * Create a CityManager with one capital per nation.
   * Uses spiral fallback if target tile is ocean.
   */
  static createDefault(nationManager: NationManager, mapData: MapData): CityManager {
    const manager = new CityManager();

    const capitals: { nationId: string; name: string; cx: number; cy: number }[] = [
      { nationId: 'nation_england', name: 'London',         cx: 22,  cy: 59 },
      { nationId: 'nation_france',  name: 'Paris',          cx: 26,  cy: 66 },
      { nationId: 'nation_hre',     name: 'Vienna',         cx: 83,  cy: 68 },
      { nationId: 'nation_sweden',  name: 'Stockholm',      cx: 86,  cy: 37 },
      { nationId: 'nation_ottoman', name: 'Constantinople', cx: 112, cy: 88 },
      { nationId: 'nation_spain',   name: 'Toledo',         cx: 15,  cy: 91 },
    ];

    for (const cap of capitals) {
      const nation = nationManager.getNation(cap.nationId);
      if (nation === undefined) continue;

      const land = findNearestLandTile(cap.cx, cap.cy, mapData, 5);
      const tileX = land?.x ?? cap.cx;
      const tileY = land?.y ?? cap.cy;

      console.log(
        `[CityManager] ${cap.name}: target (${cap.cx},${cap.cy}) → actual (${tileX},${tileY})`,
      );

      manager.addCity(
        new City({
          id: `city_${cap.nationId}_capital`,
          name: cap.name,
          ownerId: cap.nationId,
          tileX,
          tileY,
          isCapital: true,
        }),
      );
    }

    return manager;
  }

  /**
   * Create a CityManager from scenario data.
   * Uses spiral fallback if target tile is ocean.
   */
  static loadFromScenario(cities: ScenarioCity[], mapData: MapData): CityManager {
    const manager = new CityManager();

    for (const cfg of cities) {
      const land = findNearestLandTile(cfg.tileX, cfg.tileY, mapData, 5);
      const tileX = land?.x ?? cfg.tileX;
      const tileY = land?.y ?? cfg.tileY;

      manager.addCity(
        new City({
          id: cfg.id,
          name: cfg.name,
          ownerId: cfg.nationId,
          tileX,
          tileY,
          isCapital: cfg.isCapital,
        }),
      );
    }

    return manager;
  }
}
