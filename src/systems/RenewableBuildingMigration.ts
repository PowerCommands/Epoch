import { getBuildingById, isRenewableBuilding } from '../data/buildings';
import type { SavedGameState } from '../types/saveGame';

/** One-time conversion of saves from the renewable tile-improvement implementation. */
export function migrateRenewableBuildings(state: SavedGameState): SavedGameState {
  if (!state.tiles.some(tile => isRenewableBuilding(tile.improvementId ?? '')
    || isRenewableBuilding(tile.improvementConstruction?.improvementId ?? ''))) return state;
  const migrated = structuredClone(state);
  for (const tile of migrated.tiles) {
    const construction = tile.improvementConstruction;
    const completed = isRenewableBuilding(tile.improvementId ?? '');
    if (!completed && !isRenewableBuilding(construction?.improvementId ?? '')) continue;
    const id = completed ? tile.improvementId! : construction!.improvementId;
    const city = migrated.cities.find(city => city.ownerId === tile.ownerId
      && city.ownedTileCoords?.some(coord => coord.x === tile.q && coord.y === tile.r));
    if (completed) {
      tile.buildingId ??= id;
      if (city && !city.buildings.some(entry => (typeof entry === 'string' ? entry : entry.buildingId) === id)) city.buildings.push(id);
    } else if (city && !tile.buildingId && !tile.buildingConstruction) {
      const cost = getBuildingById(id)!.productionCost;
      tile.buildingConstruction = { buildingId: id, cityId: city.id };
      city.productionQueue.push({
        item: { kind: 'building', id },
        lockedProductionCost: cost,
        accumulated: cost * Math.max(0, 1 - construction!.remainingTurns / Math.max(1, construction!.totalTurns)),
        placement: { tileX: tile.q, tileY: tile.r },
      });
    }
    if (construction) {
      const worker = migrated.units.find(unit => unit.id === construction.unitId);
      if (worker) {
        worker.buildAction = undefined;
        worker.actionStatus = worker.isSleeping ? 'sleep' : 'active';
      }
    }
    tile.improvementId = undefined;
    tile.improvementConstruction = undefined;
    tile.improvementOwnerId = undefined;
    tile.resourceOwnerNationId = undefined;
  }
  return migrated;
}
