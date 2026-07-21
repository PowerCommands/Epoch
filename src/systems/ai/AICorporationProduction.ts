import { CORPORATIONS, type CorporationDefinition } from '../../data/corporations';
import type { City } from '../../entities/City';
import type { Producible } from '../../types/producible';
import type { CorporationSystem } from '../CorporationSystem';
import type { ProductionSystem } from '../ProductionSystem';
import type { AIProductionCandidate } from './AIProductionScoring';
import { AEROSPACE_INDUSTRIES_ID } from '../../data/scienceVictory';

export { AEROSPACE_INDUSTRIES_ID } from '../../data/scienceVictory';
export const AI_CORPORATION_BASE_SCORE = 58;
export const AI_AEROSPACE_SCIENCE_VICTORY_SCORE = 125;

export interface AICorporationCandidateContext {
  readonly city: City;
  readonly nationCities: readonly City[];
  readonly corporationSystem: Pick<CorporationSystem, 'isFounded' | 'canCityProduceCorporation'>;
  readonly productionSystem: Pick<ProductionSystem, 'getProduction' | 'getQueue' | 'getTurnsEstimate'>;
  readonly scienceVictoryEnabled: boolean;
  readonly definitions?: readonly CorporationDefinition[];
}

/**
 * Legally available corporations for one city. Each corporation is offered to
 * only the fastest currently-idle eligible city, avoiding duplicate AI queues.
 */
export function getAICorporationProductionCandidates(
  context: AICorporationCandidateContext,
): AIProductionCandidate[] {
  const definitions = context.definitions ?? CORPORATIONS;
  const candidates: AIProductionCandidate[] = [];

  for (const corporation of definitions) {
    if (context.corporationSystem.isFounded(corporation.id)) continue;
    if (isCorporationQueuedByNation(context.nationCities, corporation.id, context.productionSystem)) continue;
    if (!context.corporationSystem.canCityProduceCorporation(context.city, corporation.id)) continue;

    const preferredCity = getPreferredCorporationCity(
      context.nationCities,
      corporation,
      context.corporationSystem,
      context.productionSystem,
    );
    if (preferredCity?.id !== context.city.id) continue;

    candidates.push({
      item: { kind: 'corporation', corporationType: corporation },
      baseScore: getAICorporationProductionScore(corporation, context.scienceVictoryEnabled),
      category: 'corporation',
    });
  }

  return candidates;
}

/** Moderate general value; Aerospace gets a focused victory gateway override. */
export function getAICorporationProductionScore(
  corporation: CorporationDefinition,
  scienceVictoryEnabled: boolean,
): number {
  const baseline = Math.round(
    AI_CORPORATION_BASE_SCORE
      + corporation.happinessBonus * 2
      + corporation.cultureBurst / 20
      + corporation.resourcePerBuilding * 3
      - corporation.productionCost / 100,
  );
  if (corporation.id === AEROSPACE_INDUSTRIES_ID && scienceVictoryEnabled) {
    return Math.max(baseline, AI_AEROSPACE_SCIENCE_VICTORY_SCORE);
  }
  return baseline;
}

export function isCorporationQueuedByNation(
  nationCities: readonly City[],
  corporationId: string,
  productionSystem: Pick<ProductionSystem, 'getQueue'>,
): boolean {
  return nationCities.some((city) => productionSystem.getQueue(city.id).some((entry) => (
    entry.item.kind === 'corporation'
      && entry.item.corporationType.id === corporationId
  )));
}

function getPreferredCorporationCity(
  nationCities: readonly City[],
  corporation: CorporationDefinition,
  corporationSystem: Pick<CorporationSystem, 'canCityProduceCorporation'>,
  productionSystem: Pick<ProductionSystem, 'getProduction' | 'getTurnsEstimate'>,
): City | undefined {
  const item: Producible = { kind: 'corporation', corporationType: corporation };
  return nationCities
    .filter((city) => productionSystem.getProduction(city.id) === undefined)
    .filter((city) => corporationSystem.canCityProduceCorporation(city, corporation.id))
    .map((city) => ({
      city,
      turns: productionSystem.getTurnsEstimate(city.id, item),
    }))
    .sort((a, b) => a.turns - b.turns || a.city.id.localeCompare(b.city.id))[0]
    ?.city;
}
