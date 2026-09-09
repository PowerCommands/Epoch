import { MAINTAIN_NUCLEAR_PLANT, NUCLEAR_PLANT_MAINTENANCE_TURNS } from './nuclearPlants';
import { NUCLEAR_CLEANUP_TURNS } from './strategicWeapons';
import { TileType } from '../types/map';
import type { TileYield } from './terrainYields';

export interface TileImprovementDefinition {
  id: string;
  name: string;
  populationCapacity?: number;
  maintenance?: number;
  requiredTechnologyId?: string;
  description?: string;
  allowedTileTypes: TileType[];
  yieldBonus: TileYield;
  /** Fixed build duration; omitted improvements retain the normal era scale. */
  buildTurns?: number;
  /** Capability required instead of the ordinary Worker build capability. */
  requiredBuilderCapability?: string;
  /**
   * When set, the capable builder must be cargo aboard this unit type. The
   * carrier is the unit that supplies movement and remains on the target tile.
   */
  requiredCargoTransportUnitTypeId?: string;
  /** Optional map sprite loaded from assets/sprites/improvements/{id}.png. */
  spriteKey?: string;
}

export const FARM: TileImprovementDefinition = {
  id: 'farm',
  spriteKey: 'improvement_farm',
  name: 'Farm',
  allowedTileTypes: [TileType.Plains, TileType.Beach, TileType.Meadow],
  yieldBonus: { food: 2, production: 0, gold: 0 },
};

export const LUMBER_MILL: TileImprovementDefinition = {
  id: 'lumber_mill',
  spriteKey: 'improvement_lumber_mill',
  name: 'LumberMill',
  allowedTileTypes: [TileType.Forest],
  yieldBonus: { food: 0, production: 2, gold: 0 },
};

export const PLANTATION: TileImprovementDefinition = {
  id: 'plantation',
  spriteKey: 'improvement_plantation',
  name: 'Plantation',
  allowedTileTypes: [TileType.Plains, TileType.Beach, TileType.Meadow, TileType.Forest, TileType.Jungle],
  yieldBonus: { food: 2, production: 0, gold: 0 },
};

export const MINE: TileImprovementDefinition = {
  id: 'mine',
  spriteKey: 'improvement_mine',
  name: 'Mine',
  allowedTileTypes: [TileType.Plains, TileType.Beach, TileType.Meadow, TileType.Forest, TileType.Mountain, TileType.Ice, TileType.Desert],
  yieldBonus: { food: 0, production: 2, gold: 0 },
};

export const PASTURE: TileImprovementDefinition = {
  id: 'pasture',
  spriteKey: 'improvement_pasture',
  name: 'Pasture',
  allowedTileTypes: [TileType.Plains, TileType.Beach, TileType.Meadow, TileType.Forest, TileType.Desert],
  yieldBonus: { food: 1, production: 1, gold: 0 },
};

export const OIL_WELL: TileImprovementDefinition = {
  id: 'oil_well',
  spriteKey: 'improvement_oil_well',
  name: 'Oil Well',
  allowedTileTypes: [TileType.Plains, TileType.Beach, TileType.Meadow, TileType.Desert, TileType.Ice],
  yieldBonus: { food: 0, production: 3, gold: 0 },
};

export const FISHING_BOATS: TileImprovementDefinition = {
  id: 'fishing_boats',
  spriteKey: 'improvement_fishing_boats',
  name: 'Fishing Boats',
  allowedTileTypes: [TileType.Coast, TileType.Ocean],
  yieldBonus: { food: 2, production: 0, gold: 1 },
};

export const OFFSHORE_PLATFORM: TileImprovementDefinition = {
  id: 'offshore_platform',
  spriteKey: 'improvement_offshore_platform',
  name: 'Offshore Platform',
  allowedTileTypes: [TileType.Coast, TileType.Ocean],
  yieldBonus: { food: 0, production: 4, gold: 0 },
};

export const ARCHAEOLOGICAL_DIG: TileImprovementDefinition = {
  id: 'archaeological_dig',
  name: 'Archaeological Dig',
  allowedTileTypes: [
    TileType.Plains,
    TileType.Meadow,
    TileType.Desert,
    TileType.Forest,
    TileType.Beach,
    TileType.Mountain,
  ],
  yieldBonus: { food: 0, production: 0, gold: 0 },
  buildTurns: 3,
  requiredBuilderCapability: 'dig',
  spriteKey: 'improvement_archaeological_dig',
};

export const UNDERWATER_ARCHAEOLOGICAL_SITE: TileImprovementDefinition = {
  id: 'underwater_archaeological_site',
  name: 'Underwater Archaeological Site',
  allowedTileTypes: [TileType.Coast, TileType.Ocean],
  yieldBonus: { food: 0, production: 0, gold: 0 },
  buildTurns: 4,
  requiredBuilderCapability: 'dig',
  requiredCargoTransportUnitTypeId: 'transport_ship',
  spriteKey: 'improvement_underwater_archaeological_site',
};

export const NUCLEAR_PLANT_MAINTENANCE: TileImprovementDefinition = {
  id: MAINTAIN_NUCLEAR_PLANT, name: 'Maintain Nuclear Power Plant',
  allowedTileTypes: [], yieldBonus: { food: 0, production: 0, gold: 0 },
  buildTurns: NUCLEAR_PLANT_MAINTENANCE_TURNS,
};

export const CLEAN_NUCLEAR_WASTE: TileImprovementDefinition = { id: 'clean_nuclear_waste', name: '🖌 Clean Nuclear Waste', allowedTileTypes: [TileType.NuclearWaste], yieldBonus: { food: 0, production: 0, gold: 0 }, buildTurns: NUCLEAR_CLEANUP_TURNS };

/** Recurring costs and capacity are centralized here for balancing. */
export const WIND_TURBINE: TileImprovementDefinition = {
  id: 'wind_turbine', name: 'Wind Turbine', spriteKey: 'improvement_wind_turbine',
  allowedTileTypes: [TileType.Plains, TileType.Meadow, TileType.Beach],
  yieldBonus: { food: 0, production: 0, gold: 0 },
  requiredTechnologyId: 'electricity', populationCapacity: 1, maintenance: 1,
};
export const SOLAR_PANELS: TileImprovementDefinition = {
  id: 'solar_panels', name: 'Solar Panels', spriteKey: 'improvement_solar_panels',
  allowedTileTypes: [TileType.Plains, TileType.Meadow, TileType.Beach],
  yieldBonus: { food: 0, production: 0, gold: 0 },
  requiredTechnologyId: 'electronics', populationCapacity: 1, maintenance: 1,
};
export const OFFSHORE_WIND_FARM: TileImprovementDefinition = {
  id: 'offshore_wind_farm', name: 'Offshore Wind Farm', spriteKey: 'improvement_offshore_wind_farm',
  allowedTileTypes: [TileType.Coast, TileType.Ocean],
  yieldBonus: { food: 0, production: 0, gold: 0 },
  requiredTechnologyId: 'ecology', populationCapacity: 3, maintenance: WIND_TURBINE.maintenance! * 2,
  requiredCargoTransportUnitTypeId: 'transport_ship',
  description: 'Large-scale offshore wind generation. Requires a Worker aboard a Transport Ship.',
};
export const CSP: TileImprovementDefinition = {
  id: 'csp', name: 'CSP – Concentrated Solar Power', spriteKey: 'improvement_csp',
  allowedTileTypes: [TileType.Desert],
  yieldBonus: { food: 0, production: 0, gold: 0 },
  requiredTechnologyId: 'lasers', populationCapacity: 3, maintenance: 2,
  description: 'CSP – Concentrated Solar Power. Large-scale solar thermal generation using concentrated sunlight and thermal energy storage.',
};
export const RENEWABLE_IMPROVEMENTS = [WIND_TURBINE, SOLAR_PANELS, OFFSHORE_WIND_FARM, CSP];

export const ALL_IMPROVEMENTS: TileImprovementDefinition[] = [
  NUCLEAR_PLANT_MAINTENANCE,
  CLEAN_NUCLEAR_WASTE,
  FARM,
  LUMBER_MILL,
  PLANTATION,
  MINE,
  PASTURE,
  OIL_WELL,
  FISHING_BOATS,
  OFFSHORE_PLATFORM,
  ARCHAEOLOGICAL_DIG,
  UNDERWATER_ARCHAEOLOGICAL_SITE,
  ...RENEWABLE_IMPROVEMENTS,
];

export function getImprovementById(id: string): TileImprovementDefinition | undefined {
  return ALL_IMPROVEMENTS.find((improvement) => improvement.id === id);
}

export function getImprovementForTileType(tileType: TileType): TileImprovementDefinition | undefined {
  return ALL_IMPROVEMENTS.find((improvement) => improvement.allowedTileTypes.includes(tileType));
}
