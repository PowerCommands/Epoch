import type { City } from '../entities/City';
import type { MapData } from '../types/map';
import type { CityManager } from './CityManager';
import type { CityTerritorySystem } from './CityTerritorySystem';
import type { CulturalSphereSystem } from './CulturalSphereSystem';
import type { CityIntegrationSystem } from './CityIntegrationSystem';
import type { ProductionSystem } from './ProductionSystem';
import type { WonderSystem } from './WonderSystem';
import type { IGridSystem } from './grid/IGridSystem';

/**
 * The three outcomes a human player may choose for a city they just captured.
 * `keep` preserves the normal conquest result; `liberate` returns the city to
 * its original founder nation; `raze` destroys the city entirely.
 */
export type CityCaptureOutcome = 'keep' | 'liberate' | 'raze';

export interface CaptureEligibilityInput {
  /** The captured city's stable founder nation (`City.originNationId`). */
  originNationId: string;
  /** Owner immediately before this capture (the `CityCombatEvent.previousOwnerId`). */
  previousOwnerId: string;
  /** Nation that just captured the city (the human player). */
  captorNationId: string;
}

/**
 * Liberation is offered only when the city was occupied by a nation other than
 * its original founder, and the human captor is not itself that founder. Using
 * the pre-capture owner (`previousOwnerId`) is essential: after `captureCity()`
 * the city already belongs to the captor, so `city.ownerId` no longer reflects
 * who held it when the decision must be evaluated.
 */
export function canLiberateCapturedCity(input: CaptureEligibilityInput): boolean {
  return input.previousOwnerId !== input.originNationId
    && input.originNationId !== input.captorNationId;
}

/**
 * Outcomes available for a captured city, in display order. Keep and Raze are
 * always available; Liberate is conditional (see {@link canLiberateCapturedCity}).
 */
export function getAvailableCaptureOutcomes(input: CaptureEligibilityInput): CityCaptureOutcome[] {
  const outcomes: CityCaptureOutcome[] = ['keep'];
  if (canLiberateCapturedCity(input)) outcomes.push('liberate');
  outcomes.push('raze');
  return outcomes;
}

export interface LiberateCityDeps {
  cityManager: CityManager;
  cityTerritorySystem: CityTerritorySystem;
  culturalSphereSystem: CulturalSphereSystem;
  cityIntegrationSystem?: CityIntegrationSystem;
  productionSystem: ProductionSystem;
  mapData: MapData;
  gridSystem: IGridSystem;
}

/**
 * Return a freshly-captured city to its original founder nation, immediately
 * integrated. Reuses the same ownership/territory/culture/integration APIs the
 * normal conquest path uses so no state is mutated by hand. The city must have
 * already been captured (so `city.ownerId` is the human captor at call time).
 */
export function liberateCapturedCity(city: City, deps: LiberateCityDeps): void {
  const originNationId = city.originNationId;
  const captorOwnerId = city.ownerId;

  // The city is going home, so it is no longer "occupied" by anyone.
  city.occupiedOriginalNationId = undefined;

  deps.cityManager.transferOwnership(city.id, originNationId, deps.productionSystem);
  // handleConquest recognises the original nation and marks the city Integrated
  // immediately rather than starting a fresh occupation timer.
  deps.cityIntegrationSystem?.handleConquest(city, captorOwnerId, originNationId);
  deps.cityTerritorySystem.transferCityTerritory(city, originNationId, deps.mapData);
  deps.culturalSphereSystem.claimInitialCityCulture(city, deps.mapData, deps.gridSystem);
}

export interface RazeCityDeps {
  cityManager: CityManager;
  productionSystem: ProductionSystem;
  wonderSystem: WonderSystem;
  mapData: MapData;
}

export interface RazeCityResult {
  /** Tiles that were this city's territory and are now unclaimed terrain. */
  clearedTileCoords: Array<{ x: number; y: number }>;
  /** Ids of completed wonders removed with the city. */
  removedWonderIds: string[];
}

/**
 * Destroy a captured city permanently. Removes production, buildings (via the
 * city record), wonders, and every tile-level artefact on the city's own
 * territory, then unclaims those tiles and removes the city from the manager.
 *
 * Only the razed city's territory is touched — neighbouring cities keep their
 * tiles. The capturing unit is not referenced here; it survives on the (now
 * unclaimed) former city tile because this operation never moves or removes units.
 */
export function razeCapturedCity(city: City, deps: RazeCityDeps): RazeCityResult {
  const ownedKeys = new Set<string>();
  const clearedTileCoords: Array<{ x: number; y: number }> = [];
  for (const coord of [...city.ownedTileCoords, { x: city.tileX, y: city.tileY }]) {
    ownedKeys.add(`${coord.x},${coord.y}`);
  }

  // Cancel any queued/reserved production before the city record disappears.
  deps.productionSystem.clearProduction(city.id);

  // Remove completed wonders so no system retains a reference to a dead city.
  const removedWonderIds = deps.wonderSystem.removeWondersForCity(city.id);

  // Clear every tile-level artefact on the city's own territory and unclaim it.
  for (const key of ownedKeys) {
    const [x, y] = key.split(',').map(Number);
    const tile = deps.mapData.tiles[y]?.[x];
    if (!tile) continue;
    tile.ownerId = undefined;
    tile.resourceOwnerNationId = undefined;
    tile.improvementId = undefined;
    tile.improvementOwnerId = undefined;
    tile.improvementConstruction = undefined;
    tile.buildingId = undefined;
    tile.buildingBroken = undefined;
    tile.buildingConstruction = undefined;
    tile.wonderId = undefined;
    tile.wonderConstruction = undefined;
    clearedTileCoords.push({ x, y });
  }

  // Cultural ownership can extend beyond owned territory; clear every tile this
  // city ever culturally claimed so no stale cultural marker survives it.
  for (const row of deps.mapData.tiles) {
    for (const tile of row) {
      if (tile.cultureSourceCityId === city.id) {
        tile.cultureOwnerId = undefined;
        tile.cultureSourceCityId = undefined;
      }
    }
  }

  deps.cityManager.removeCity(city.id);

  return { clearedTileCoords, removedWonderIds };
}
