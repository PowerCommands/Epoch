import { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import type { MapData } from '../types/map';
import { TileType } from '../types/map';
import { UnitManager } from './UnitManager';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import { TurnManager } from './TurnManager';
import { TerritoryRenderer } from './TerritoryRenderer';
import { CityRenderer } from './CityRenderer';
import { ResourceSystem } from './ResourceSystem';
import type { IGridSystem } from './grid/IGridSystem';
import { CityTerritorySystem } from './CityTerritorySystem';
import { CulturalSphereSystem } from './CulturalSphereSystem';
import cityNamePoolsJson from '../data/cityNames.json';

const FOUNDABLE_TYPES = new Set<TileType>([
  TileType.Plains,
  TileType.Forest,
  TileType.Mountain,
  TileType.Jungle,
  TileType.Desert,
]);

const CITY_NAME_POOLS: Record<string, string[]> = cityNamePoolsJson;
const FALLBACK_CITY_NAMES = [
  'Novum', 'Ardena', 'Calvis', 'Durnheim', 'Erwick',
  'Falmere', 'Galdor', 'Havenmoor', 'Iskara', 'Jorvik',
];

/**
 * FoundCitySystem hanterar grundande av nya städer via Settler-enheter.
 *
 * Validerar att en enhet kan grunda, skapar staden, claimar aktivt grid-territorium,
 * konsumerar Settler-enheten, och uppdaterar rendering.
 */
export class FoundCitySystem {
  private readonly unitManager: UnitManager;
  private readonly cityManager: CityManager;
  private readonly nationManager: NationManager;
  private readonly turnManager: TurnManager;
  private readonly territoryRenderer: TerritoryRenderer;
  private readonly cityRenderer: CityRenderer;
  private readonly resourceSystem: ResourceSystem;
  private readonly mapData: MapData;
  private readonly cityTerritorySystem = new CityTerritorySystem();
  private readonly culturalSphereSystem = new CulturalSphereSystem();
  private readonly foundedListeners: ((city: City) => void)[] = [];
  private nextCityNumber = 1;

  constructor(
    unitManager: UnitManager,
    cityManager: CityManager,
    nationManager: NationManager,
    turnManager: TurnManager,
    territoryRenderer: TerritoryRenderer,
    cityRenderer: CityRenderer,
    resourceSystem: ResourceSystem,
    mapData: MapData,
    private readonly gridSystem: IGridSystem,
  ) {
    this.unitManager = unitManager;
    this.cityManager = cityManager;
    this.nationManager = nationManager;
    this.turnManager = turnManager;
    this.territoryRenderer = territoryRenderer;
    this.cityRenderer = cityRenderer;
    this.resourceSystem = resourceSystem;
    this.mapData = mapData;
  }

  canFound(unit: Unit): boolean {
    if (!unit.unitType.canFound) return false;
    if (unit.ownerId !== this.turnManager.getCurrentNation().id) return false;

    const tile = this.mapData.tiles[unit.tileY]?.[unit.tileX];
    if (!tile) return false;
    if (!FOUNDABLE_TYPES.has(tile.type)) return false;

    if (this.cityManager.getCityAt(unit.tileX, unit.tileY) !== undefined) return false;

    return true;
  }

  foundCity(unit: Unit): City | null {
    if (!this.canFound(unit)) return null;

    const isCapital = this.cityManager.getCitiesByOwner(unit.ownerId).length === 0;
    const name = this.pickCityName(unit.ownerId);
    const cityId = `city_${unit.ownerId}_founded_${this.nextCityNumber}`;
    this.nextCityNumber++;

    const city = new City({
      id: cityId,
      name,
      ownerId: unit.ownerId,
      tileX: unit.tileX,
      tileY: unit.tileY,
      isCapital,
      originNationId: unit.ownerId,
      isOriginalCapital: isCapital,
      isResidenceCapital: isCapital,
    });

    this.cityTerritorySystem.initializeOwnedTiles(city, this.mapData, this.gridSystem);

    this.cityManager.addCity(city);

    // Claim the active grid's city territory.
    this.claimTerritory(unit.ownerId, unit.tileX, unit.tileY);

    // Establish the city's initial 7-tile cultural core (independent
    // from territory ownership).
    this.culturalSphereSystem.claimInitialCityCulture(city, this.mapData, this.gridSystem);

    // Consume settler
    this.unitManager.removeUnit(unit.id);

    // Refresh rendering
    this.territoryRenderer.render();
    this.cityRenderer.refreshCity(city);

    // Recalculate resources for nation (new city adds income)
    this.resourceSystem.recalculateForNation(unit.ownerId);

    for (const cb of this.foundedListeners) cb(city);

    return city;
  }

  onCityFounded(cb: (city: City) => void): void {
    this.foundedListeners.push(cb);
  }

  private claimTerritory(nationId: string, cx: number, cy: number): void {
    const tiles = this.gridSystem.getTilesInRange(
      { x: cx, y: cy },
      1,
      this.mapData,
      { includeCenter: true },
    );

    for (const tile of tiles) {
      tile.ownerId = nationId;
    }
  }

  private pickCityName(nationId: string): string {
    const usedNames = new Set(this.cityManager.getAllCities().map((c) => c.name));
    const preferredNames = CITY_NAME_POOLS[nationId] ?? FALLBACK_CITY_NAMES;

    for (const name of preferredNames) {
      if (!usedNames.has(name)) return name;
    }

    for (const name of FALLBACK_CITY_NAMES) {
      if (!usedNames.has(name)) return name;
    }

    // Fallback
    let n = this.cityManager.getAllCities().length + 1;
    while (usedNames.has(`City ${n}`)) n++;
    return `City ${n}`;
  }
}
