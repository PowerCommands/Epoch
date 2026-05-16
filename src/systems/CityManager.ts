import { City } from '../entities/City';
import type { CityFocusType, CityProductionRhythm } from '../entities/City';
import { CityResources } from '../entities/CityResources';
import { CityBuildings } from '../entities/CityBuildings';
import { NationManager } from './NationManager';
import { MapData, TileType } from '../types/map';
import type { ScenarioCity } from '../types/scenario';

/**
 * Search outward in expanding axial-hex rings for nearest non-ocean tile.
 */
function findNearestLandTile(
  q: number,
  r: number,
  mapData: MapData,
  maxRadius: number,
): { x: number; y: number } | null {
  const center = mapData.tiles[r]?.[q];
  if (center && center.type !== TileType.Ocean) return { x: q, y: r };

  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dq = -radius; dq <= radius; dq++) {
      const minDr = Math.max(-radius, -dq - radius);
      const maxDr = Math.min(radius, -dq + radius);

      for (let dr = minDr; dr <= maxDr; dr++) {
        if ((Math.abs(dq) + Math.abs(dr) + Math.abs(-dq - dr)) / 2 !== radius) continue;
        const tx = q + dq;
        const ty = r + dr;
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

  getResidenceCapital(ownerId: string): City | undefined {
    return this.getAllCities().find((city) => city.ownerId === ownerId && city.isResidenceCapital);
  }

  setResidenceCapital(ownerId: string, cityId: string): City | undefined {
    const next = this.cities.get(cityId);
    if (!next || next.ownerId !== ownerId) return undefined;
    for (const city of this.cities.values()) {
      if (city.ownerId === ownerId) city.isResidenceCapital = city.id === cityId;
    }
    return next;
  }

  getResources(cityId: string): CityResources {
    return this.resources.get(cityId)!;
  }

  getBuildings(cityId: string): CityBuildings {
    return this.buildings.get(cityId)!;
  }

  renameCity(cityId: string, name: string): City | undefined {
    const city = this.cities.get(cityId);
    if (!city) return undefined;

    const normalizedName = name.trim().replace(/\s+/g, ' ');
    if (normalizedName.length === 0) return undefined;

    city.rename(normalizedName);
    return city;
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
   * Remove every city silently. Used by save-load restoration before
   * re-adding the saved cities.
   */
  clearAllSilently(): void {
    this.cities.clear();
    this.resources.clear();
    this.buildings.clear();
  }

  /**
   * Re-create a city with explicit runtime state. Used by save-load
   * restoration. Caller is responsible for refreshing renderers.
   */
  restoreCity(config: {
    id: string;
    name: string;
    ownerId: string;
    tileX: number;
    tileY: number;
    isCapital: boolean;
    originNationId?: string;
    isOriginalCapital?: boolean;
    isResidenceCapital?: boolean;
    occupiedOriginalNationId?: string;
    focus?: CityFocusType;
    productionRhythm?: CityProductionRhythm;
    health: number;
    population: number;
    foodStorage: number;
    culture: number;
    culturalSphereProgress?: number;
    lastTurnAttacked: number | null;
    lastTilePurchaseTurn?: number;
  }): City {
    const city = new City({
      id: config.id,
      name: config.name,
      ownerId: config.ownerId,
      tileX: config.tileX,
      tileY: config.tileY,
      isCapital: config.isCapital,
      originNationId: config.originNationId,
      isOriginalCapital: config.isOriginalCapital,
      isResidenceCapital: config.isResidenceCapital,
      occupiedOriginalNationId: config.occupiedOriginalNationId,
      focus: config.focus,
      productionRhythm: config.productionRhythm,
    });
    city.health = config.health;
    city.population = config.population;
    city.foodStorage = config.foodStorage;
    city.culture = config.culture;
    city.culturalSphereProgress = config.culturalSphereProgress ?? 0;
    city.lastTurnAttacked = config.lastTurnAttacked;
    city.lastTilePurchaseTurn = config.lastTilePurchaseTurn;

    this.cities.set(city.id, city);
    this.resources.set(city.id, new CityResources(city.id));
    this.buildings.set(city.id, new CityBuildings(city.id));
    return city;
  }

  /**
   * Create a CityManager with one capital per nation.
   * Uses axial-hex ring fallback if target tile is ocean.
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
          originNationId: cap.nationId,
          isOriginalCapital: true,
          isResidenceCapital: true,
        }),
      );
    }

    return manager;
  }

  /**
   * Create a CityManager from scenario data.
   * Uses axial-hex ring fallback if target tile is ocean.
   */
  static loadFromScenario(cities: ScenarioCity[], mapData: MapData): CityManager {
    const manager = new CityManager();

    for (const cfg of cities) {
      const land = findNearestLandTile(cfg.q, cfg.r, mapData, 5);
      const tileX = land?.x ?? cfg.q;
      const tileY = land?.y ?? cfg.r;

      manager.addCity(
        new City({
          id: cfg.id,
          name: cfg.name,
          ownerId: cfg.nationId,
          tileX,
          tileY,
          isCapital: cfg.isCapital,
          originNationId: cfg.originNationId ?? cfg.nationId,
          isOriginalCapital: cfg.isOriginalCapital ?? cfg.isCapital,
          isResidenceCapital: cfg.isResidenceCapital ?? cfg.isCapital,
        }),
      );
    }

    return manager;
  }
}
