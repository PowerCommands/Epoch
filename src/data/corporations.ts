import { getBuildingById } from './buildings';
import {
  MANUFACTURED_RESOURCES,
  getManufacturedResourceById as getManufacturedResourceDefinitionById,
  validateManufacturedResourceDefinitions,
} from './manufacturedResources';
import { NATURAL_RESOURCES } from './naturalResources';
import { getResourceDefinitionById } from './resources';
import { getTechnologyById } from './technologies';
import type { ManufacturedResourceDefinition } from '../entities/ManufacturedResource';

export interface CorporationDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiredTechIds: string[];
  readonly requiredResourceIds?: string[];
  readonly requiredBuildingIds?: string[];
  readonly happinessBonus: number;
  readonly cultureBurst: number;
  readonly productionCost: number;
  readonly manufacturedResourceId: string;
  readonly productionBuildingId: string;
  readonly resourcePerBuilding: number;
}

export const CORPORATIONS: CorporationDefinition[] = [
  {
    id: 'silk_road_consortium',
    name: 'Silk Road Consortium',
    description: 'Links luxury silk routes into durable trade goods.',
    requiredTechIds: ['foreign_trade'],
    requiredResourceIds: ['silk'],
    requiredBuildingIds: ['market'],
    happinessBonus: 2,
    cultureBurst: 20,
    productionCost: 160,
    manufacturedResourceId: 'trade_goods',
    productionBuildingId: 'market',
    resourcePerBuilding: 1,
  },
  {
    id: 'phoenician_trade_league',
    name: 'Phoenician Trade League',
    description: 'Turns coastal networks into maritime goods.',
    requiredTechIds: ['sailing'],
    requiredResourceIds: ['fish'],
    requiredBuildingIds: ['lighthouse'],
    happinessBonus: 2,
    cultureBurst: 20,
    productionCost: 160,
    manufacturedResourceId: 'maritime_goods',
    productionBuildingId: 'lighthouse',
    resourcePerBuilding: 1,
  },
  {
    id: 'roman_engineering_guild',
    name: 'Roman Engineering Guild',
    description: 'Organizes metal and workshops into engineered goods.',
    requiredTechIds: ['engineering'],
    requiredResourceIds: ['iron'],
    requiredBuildingIds: ['workshop'],
    happinessBonus: 2,
    cultureBurst: 25,
    productionCost: 190,
    manufacturedResourceId: 'engineered_goods',
    productionBuildingId: 'workshop',
    resourcePerBuilding: 1,
  },
  {
    id: 'hanseatic_league',
    name: 'Hanseatic League',
    description: 'Coordinates market towns and harbors into trade goods.',
    requiredTechIds: ['guilds'],
    requiredBuildingIds: ['market', 'harbor'],
    happinessBonus: 3,
    cultureBurst: 30,
    productionCost: 260,
    manufacturedResourceId: 'trade_goods',
    productionBuildingId: 'harbor',
    resourcePerBuilding: 1,
  },
  {
    id: 'dutch_east_india_company',
    name: 'Dutch East India Company',
    description: 'Converts overseas spice access into colonial goods.',
    requiredTechIds: ['navigation'],
    requiredResourceIds: ['spices'],
    requiredBuildingIds: ['seaport'],
    happinessBonus: 3,
    cultureBurst: 35,
    productionCost: 360,
    manufacturedResourceId: 'colonial_goods',
    productionBuildingId: 'seaport',
    resourcePerBuilding: 1,
  },
  {
    id: 'medici_banking_house',
    name: 'Medici Banking House',
    description: 'Builds financial networks around banking services.',
    requiredTechIds: ['banking'],
    requiredBuildingIds: ['bank'],
    happinessBonus: 3,
    cultureBurst: 35,
    productionCost: 340,
    manufacturedResourceId: 'banking_services',
    productionBuildingId: 'bank',
    resourcePerBuilding: 1,
  },
  {
    id: 'standard_oil',
    name: 'Standard Oil',
    description: 'Refines oil and factories into fuel supply chains.',
    requiredTechIds: ['biology'],
    requiredResourceIds: ['oil'],
    requiredBuildingIds: ['factory'],
    happinessBonus: 4,
    cultureBurst: 45,
    productionCost: 520,
    manufacturedResourceId: 'refined_fuel',
    productionBuildingId: 'factory',
    resourcePerBuilding: 1,
  },
  {
    id: 'krupp_industries',
    name: 'Krupp Industries',
    description: 'Turns coal, iron, and factories into steel goods.',
    requiredTechIds: ['industrialization'],
    requiredResourceIds: ['coal', 'iron'],
    requiredBuildingIds: ['factory'],
    happinessBonus: 4,
    cultureBurst: 45,
    productionCost: 540,
    manufacturedResourceId: 'steel_goods',
    productionBuildingId: 'factory',
    resourcePerBuilding: 1,
  },
  {
    id: 'ford_motor_company',
    name: 'Ford Motor Company',
    description: 'Uses oil and factories for mass vehicle production.',
    requiredTechIds: ['combustion'],
    requiredResourceIds: ['oil'],
    requiredBuildingIds: ['factory'],
    happinessBonus: 4,
    cultureBurst: 50,
    productionCost: 620,
    manufacturedResourceId: 'vehicles',
    productionBuildingId: 'factory',
    resourcePerBuilding: 1,
  },
  {
    id: 'chip_maker',
    name: 'Chip Maker',
    description: 'Transforms advanced industry into chip production.',
    requiredTechIds: ['electronics'],
    // TODO: Switch this to Silicon once a silicon natural resource exists.
    requiredResourceIds: ['aluminum'],
    requiredBuildingIds: ['factory'],
    happinessBonus: 5,
    cultureBurst: 60,
    productionCost: 820,
    manufacturedResourceId: 'chips',
    productionBuildingId: 'factory',
    resourcePerBuilding: 1,
  },
  {
    id: 'aerospace_industries',
    name: 'AeroSpace Industries',
    description: 'Builds aluminum-backed air industry into aerospace parts.',
    requiredTechIds: ['flight'],
    requiredResourceIds: ['aluminum'],
    requiredBuildingIds: ['factory'],
    happinessBonus: 5,
    cultureBurst: 60,
    productionCost: 860,
    manufacturedResourceId: 'aerospace_parts',
    productionBuildingId: 'factory',
    resourcePerBuilding: 1,
  },
  {
    id: 'global_media_network',
    name: 'Global Media Network',
    description: 'Converts broadcast infrastructure into media output.',
    requiredTechIds: ['radio'],
    requiredBuildingIds: ['broadcast_tower'],
    happinessBonus: 5,
    cultureBurst: 60,
    productionCost: 760,
    manufacturedResourceId: 'media',
    productionBuildingId: 'broadcast_tower',
    resourcePerBuilding: 1,
  },
];

export function getCorporationById(id: string): CorporationDefinition | undefined {
  return CORPORATIONS.find((corporation) => corporation.id === id);
}

export function getManufacturedResourceById(id: string): ManufacturedResourceDefinition | undefined {
  return getManufacturedResourceDefinitionById(id);
}

export function validateCorporationDefinitions(
  definitions: readonly CorporationDefinition[] = CORPORATIONS,
): string[] {
  const errors: string[] = [];
  const manufacturedResourceIds = new Set(MANUFACTURED_RESOURCES.map((resource) => resource.id));
  errors.push(...validateManufacturedResourceDefinitions());
  for (const resource of NATURAL_RESOURCES) {
    if (manufacturedResourceIds.has(resource.id)) {
      errors.push(`Manufactured resource id duplicates natural resource id: ${resource.id}`);
    }
  }
  const corporationIds = new Set<string>();

  for (const corporation of definitions) {
    if (corporationIds.has(corporation.id)) {
      errors.push(`Duplicate corporation id: ${corporation.id}`);
    }
    corporationIds.add(corporation.id);

    for (const techId of corporation.requiredTechIds) {
      if (!getTechnologyById(techId)) errors.push(`${corporation.id} references unknown tech: ${techId}`);
    }
    for (const resourceId of corporation.requiredResourceIds ?? []) {
      if (!getResourceDefinitionById(resourceId)) {
        errors.push(`${corporation.id} references unknown resource: ${resourceId}`);
      }
    }
    for (const buildingId of [
      ...(corporation.requiredBuildingIds ?? []),
      corporation.productionBuildingId,
    ]) {
      if (!getBuildingById(buildingId)) errors.push(`${corporation.id} references unknown building: ${buildingId}`);
    }
    if (!manufacturedResourceIds.has(corporation.manufacturedResourceId)) {
      errors.push(`${corporation.id} references unknown manufactured resource: ${corporation.manufacturedResourceId}`);
    }
  }

  return errors;
}
