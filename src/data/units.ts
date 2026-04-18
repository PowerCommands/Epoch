import type { UnitType } from '../entities/UnitType';

export const WARRIOR: UnitType = {
  id: 'warrior',
  name: 'Warrior',
  productionCost: 6,
  movementPoints: 2,
  baseHealth: 100,
  baseStrength: 20,
};

export const ARCHER: UnitType = {
  id: 'archer',
  name: 'Archer',
  productionCost: 12,
  movementPoints: 2,
  baseHealth: 75,
  baseStrength: 18,
  range: 2,
};

export const CAVALRY: UnitType = {
  id: 'cavalry',
  name: 'Cavalry',
  productionCost: 18,
  movementPoints: 4,
  baseHealth: 80,
  baseStrength: 28,
};

export const SETTLER: UnitType = {
  id: 'settler',
  name: 'Settler',
  productionCost: 20,
  movementPoints: 2,
  baseHealth: 50,
  baseStrength: 0,
  canFound: true,
};

export const BUILDER: UnitType = {
  id: 'builder',
  name: 'Builder',
  productionCost: 10,
  movementPoints: 2,
  baseHealth: 50,
  baseStrength: 0,
  canBuildImprovements: true,
};

export const FISHING_BOAT: UnitType = {
  id: 'fishing_boat',
  name: 'Fishing Boat',
  productionCost: 8,
  movementPoints: 2,
  baseHealth: 40,
  baseStrength: 0,
  isNaval: true,
};

export const TRANSPORT_SHIP: UnitType = {
  id: 'transport_ship',
  name: 'Transport Ship',
  productionCost: 14,
  movementPoints: 3,
  baseHealth: 80,
  baseStrength: 0,
  isNaval: true,
};

export const ALL_UNIT_TYPES: UnitType[] = [
  WARRIOR,
  ARCHER,
  CAVALRY,
  SETTLER,
  BUILDER,
  FISHING_BOAT,
  TRANSPORT_SHIP,
];

export function getUnitTypeById(id: string): UnitType | undefined {
  return ALL_UNIT_TYPES.find((unitType) => unitType.id === id);
}
