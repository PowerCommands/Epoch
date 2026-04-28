import { getTechnologyById, type Era } from '../data/technologies';
import type { NationManager } from './NationManager';

const ERA_ORDER: readonly Era[] = [
  'ancient',
  'classical',
  'medieval',
  'renaissance',
  'industrial',
  'modern',
  'atomic',
  'information',
  'future',
];

export class EraSystem {
  constructor(
    private readonly nationManager: NationManager,
  ) {}

  getNationEra(nationId: string): Era {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return 'ancient';

    const researchedEras = nation.researchedTechIds
      .map((technologyId) => getTechnologyById(technologyId)?.era)
      .filter((era): era is Era => era !== undefined);

    return getHighestEra(researchedEras);
  }
}

export function getEraRank(era: Era): number {
  return ERA_ORDER.indexOf(era);
}

export function compareEras(a: Era, b: Era): number {
  return getEraRank(a) - getEraRank(b);
}

export function getHighestEra(eras: readonly Era[]): Era {
  let highest: Era = 'ancient';
  for (const era of eras) {
    if (compareEras(era, highest) > 0) {
      highest = era;
    }
  }
  return highest;
}
