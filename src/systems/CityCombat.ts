import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import type { CityManager } from './CityManager';
import type { ProductionSystem } from './ProductionSystem';
import type { MapData } from '../types/map';
import { CITY_BASE_HEALTH, CITY_CAPTURE_HEALTH_FRACTION } from '../data/cities';

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
): void {
  const newOwnerId = attacker.ownerId;

  // Byt stadsägare och rensa produktion
  cityManager.transferOwnership(city.id, newOwnerId, productionSystem);

  // Tile byter ägare
  const tile = mapData.tiles[city.tileY]?.[city.tileX];
  if (tile) tile.ownerId = newOwnerId;

  // HP återställs till 25% av max
  city.health = Math.round(CITY_BASE_HEALTH * CITY_CAPTURE_HEALTH_FRACTION);

  // Erövrande enheten flyttas in på stadens tile
  attacker.tileX = city.tileX;
  attacker.tileY = city.tileY;
}
