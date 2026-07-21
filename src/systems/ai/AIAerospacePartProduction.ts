import { AEROSPACE_PART_PRODUCTION, AEROSPACE_PARTS_ID } from '../../data/scienceVictory';
import type { City } from '../../entities/City';
import type { AerospacePartSystem } from '../AerospacePartSystem';
import type { ProductionSystem } from '../ProductionSystem';
import type { AIProductionCandidate } from './AIProductionScoring';

export const AI_AEROSPACE_PART_BASE_SCORE = 120;
export const AI_AEROSPACE_PART_NEAR_VICTORY_BONUS = 30;

export interface AIAerospacePartCandidateContext {
  readonly city: City;
  readonly nationCities: readonly City[];
  readonly aerospacePartSystem: Pick<AerospacePartSystem, 'canCityProduce' | 'getQuantity'>;
  readonly productionSystem: Pick<ProductionSystem, 'getQueue'>;
  readonly scienceVictoryEnabled: boolean;
  readonly requiredAerospaceParts: number;
}

export function getAIAerospacePartProductionCandidate(
  context: AIAerospacePartCandidateContext,
): AIProductionCandidate | undefined {
  if (!context.scienceVictoryEnabled || !context.aerospacePartSystem.canCityProduce(context.city)) {
    return undefined;
  }

  const accumulated = context.aerospacePartSystem.getQuantity(context.city.ownerId);
  const queued = countQueuedAerospaceParts(context.nationCities, context.productionSystem);
  if (accumulated + queued >= context.requiredAerospaceParts) return undefined;

  const progress = Math.min(1, accumulated / Math.max(1, context.requiredAerospaceParts));
  return {
    item: { kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION },
    baseScore: AI_AEROSPACE_PART_BASE_SCORE + AI_AEROSPACE_PART_NEAR_VICTORY_BONUS * progress,
    category: 'aerospacePart',
  };
}

export function countQueuedAerospaceParts(
  nationCities: readonly City[],
  productionSystem: Pick<ProductionSystem, 'getQueue'>,
): number {
  return nationCities.reduce((count, city) => count + productionSystem.getQueue(city.id).filter((entry) => (
    entry.item.kind === 'manufacturedResource'
      && entry.item.productionType.id === AEROSPACE_PARTS_ID
  )).length, 0);
}

