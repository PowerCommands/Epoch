import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import type { CityManager } from './CityManager';
import type { ProductionSystem } from './ProductionSystem';
import type { MapData } from '../types/map';
import { CITY_BASE_HEALTH, CITY_CAPTURE_HEALTH_FRACTION } from '../data/cities';
import type { UnitManager } from './UnitManager';
import { CityTerritorySystem } from './CityTerritorySystem';
import { CulturalSphereSystem } from './CulturalSphereSystem';
import type { IGridSystem } from './grid/IGridSystem';

/**
 * Intern hjälpmodul för stadserövring.
 * Anropas av CombatSystem när en stad faller.
 */
export function captureCity(
  city: City,
  attacker: Unit,
  cityManager: CityManager,
  mapData: MapData,
  productionSystem: ProductionSystem,
  unitManager: UnitManager,
  gridSystem: IGridSystem,
): void {
  const newOwnerId = attacker.ownerId;

  // Byt stadsägare och rensa produktion
  cityManager.transferOwnership(city.id, newOwnerId, productionSystem);

  // Stadens hela territorium byter ägare så renderers och save/load ser samma state.
  new CityTerritorySystem().transferCityTerritory(city, newOwnerId, mapData);

  // The city's initial 7-tile cultural core flips with the city itself.
  // Wider cultural pressure / flipping is intentionally not implemented here.
  new CulturalSphereSystem().claimInitialCityCulture(city, mapData, gridSystem);

  // HP återställs till 25% av max
  city.health = Math.round(CITY_BASE_HEALTH * CITY_CAPTURE_HEALTH_FRACTION);

  // Erövrande enheten flyttas in på stadens tile
  unitManager.moveUnit(attacker.id, city.tileX, city.tileY);
}
