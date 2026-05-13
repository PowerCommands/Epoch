import { getManufacturedResourceById } from './manufacturedResources';
import { getNaturalResourceById } from './naturalResources';
import type { ManufacturedResourceDefinition } from '../entities/ManufacturedResource';
import type { NaturalResourceDefinition } from '../types/naturalResources';

export type ResourceDefinition = NaturalResourceDefinition | ManufacturedResourceDefinition;

export function getResourceDefinitionById(id: string): ResourceDefinition | undefined {
  return getNaturalResourceById(id) ?? getManufacturedResourceById(id);
}

export function getResourceDisplayName(id: string): string {
  return getResourceDefinitionById(id)?.name ?? id;
}

