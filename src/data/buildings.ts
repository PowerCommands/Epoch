import type { BuildingType } from '../entities/Building';

export const GRANARY: BuildingType = {
  id: 'granary',
  name: 'Granary',
  description: '+2 Food per turn',
  productionCost: 8,
  modifiers: { foodPerTurn: 2 },
};

export const WORKSHOP: BuildingType = {
  id: 'workshop',
  name: 'Workshop',
  description: '+2 Production per turn',
  productionCost: 10,
  modifiers: { productionPerTurn: 2 },
};

export const MARKET: BuildingType = {
  id: 'market',
  name: 'Market',
  description: '+3 Gold per turn (to nation)',
  productionCost: 12,
  modifiers: { goldPerTurn: 3 },
};

export const ALL_BUILDINGS: BuildingType[] = [GRANARY, WORKSHOP, MARKET];

export function getBuildingById(id: string): BuildingType | undefined {
  return ALL_BUILDINGS.find((b) => b.id === id);
}
