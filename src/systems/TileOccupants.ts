import type { Unit } from '../entities/Unit';
import type { UnitManager } from './UnitManager';

/** All occupants, including transported units and aircraft outside the collision grid. */
export function getTileOccupants(unitManager: UnitManager, x: number, y: number): { unit: Unit; location?: string }[] {
  // Cargo is deliberately absent from the collision/grid lookup. Air bases
  // have their own authoritative occupancy, independent of that grid as well.
  const occupants = new Map<string, { unit: Unit; location?: string }>();
  const addUnit = (unit: Unit, location?: string): void => {
    if (occupants.has(unit.id)) {
      if (location) occupants.get(unit.id)!.location = location;
      return;
    }
    occupants.set(unit.id, { unit, location });
    for (const cargo of unitManager.getCargoUnitsForTransport(unit)) {
      addUnit(cargo, `Aboard ${unit.name}`);
    }
  };
  for (const unit of unitManager.getUnitsAt(x, y)) addUnit(unit);
  const airOperations = unitManager.airOperations;
  for (const site of airOperations?.allSites() ?? []) {
    if (site.x !== x || site.y !== y) continue;
    for (const aircraft of airOperations!.aircraftAt(site.base)) {
      addUnit(aircraft, site.base.kind === 'carrier' ? `Aboard ${site.name}` : site.name);
    }
  }
  return [...occupants.values()];
}
