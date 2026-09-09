import type { Producible } from '../types/producible';
import type { PowerPlantSystem } from './PowerPlantSystem';
import type { WorldCouncilSystem } from './WorldCouncilSystem';

export function getCouncilProductionBlockReason(council: WorldCouncilSystem, nationId: string, item: Producible): string | undefined {
  return item.kind === 'unit' ? council.getUnitProductionRestrictionReason(nationId, item.unitType.id)
    : item.kind === 'building' ? council.getBuildingProductionRestrictionReason(nationId, item.buildingType.id) : undefined;
}

export function getCouncilEnergyPosition(plants: PowerPlantSystem, nationId: string): { activePlants: number; activeFossilPlants: number } {
  const active = plants.getNationActivePowerPlants(nationId);
  return { activePlants: active.length, activeFossilPlants: active.filter(p => ['coal_power_plant', 'oil_power_plant'].includes(p)).length };
}
