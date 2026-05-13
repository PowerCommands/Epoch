import type { ManufacturedResourceDefinition } from '../entities/ManufacturedResource';

export const MANUFACTURED_RESOURCES: ManufacturedResourceDefinition[] = [
  { id: 'trade_goods', name: 'Trade Goods', category: 'manufactured', tradeGoldPerTurn: 4 },
  { id: 'maritime_goods', name: 'Maritime Goods', category: 'manufactured', tradeGoldPerTurn: 4 },
  { id: 'engineered_goods', name: 'Engineered Goods', category: 'manufactured', tradeGoldPerTurn: 5 },
  { id: 'banking_services', name: 'Banking Services', category: 'manufactured', tradeGoldPerTurn: 5 },
  { id: 'colonial_goods', name: 'Colonial Goods', category: 'manufactured', tradeGoldPerTurn: 6 },
  { id: 'finance', name: 'Finance', category: 'manufactured', tradeGoldPerTurn: 5 },
  { id: 'refined_fuel', name: 'Refined Fuel', category: 'manufactured', tradeGoldPerTurn: 7 },
  { id: 'steel_goods', name: 'Steel Goods', category: 'manufactured', tradeGoldPerTurn: 7 },
  { id: 'vehicles', name: 'Vehicles', category: 'manufactured', tradeGoldPerTurn: 8 },
  { id: 'chips', name: 'Chips', category: 'manufactured', tradeGoldPerTurn: 10 },
  { id: 'aerospace_parts', name: 'Aerospace Parts', category: 'manufactured', tradeGoldPerTurn: 10 },
  { id: 'media', name: 'Media', category: 'manufactured', tradeGoldPerTurn: 7 },
];

export function getManufacturedResourceById(id: string): ManufacturedResourceDefinition | undefined {
  return MANUFACTURED_RESOURCES.find((resource) => resource.id === id);
}

export function validateManufacturedResourceDefinitions(
  definitions: readonly ManufacturedResourceDefinition[] = MANUFACTURED_RESOURCES,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const resource of definitions) {
    if (ids.has(resource.id)) errors.push(`Duplicate manufactured resource id: ${resource.id}`);
    ids.add(resource.id);
  }

  return errors;
}
