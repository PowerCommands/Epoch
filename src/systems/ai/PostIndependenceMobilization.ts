import type { BuildingType } from '../../entities/Building';
import type { AIProductionCandidate } from './AIProductionScoring';

/** Use building effects so authored upgrades automatically participate. */
export function isMobilizationInfrastructure(building: BuildingType): boolean {
  return (building.modifiers.cityDefensePercent ?? 0) > 0
    || (building.modifiers.militaryProductionPercent ?? 0) > 0;
}

export interface MobilizationProductionContext {
  readonly active: boolean;
  readonly economyStable: boolean;
  readonly importantCity: boolean;
  readonly armyDeficient: boolean;
}

/** Applied before the existing leader, era, focus and doctrine scoring. */
export function applyMobilizationProductionWeights(
  candidates: readonly AIProductionCandidate[], context: MobilizationProductionContext,
): AIProductionCandidate[] {
  if (!context.active) return [...candidates];
  const defenseDeficient = candidates.some(c => c.item.kind === 'building' && isMobilizationInfrastructure(c.item.buildingType));
  return candidates.map(candidate => {
    const infrastructure = candidate.item.kind === 'building' && isMobilizationInfrastructure(candidate.item.buildingType);
    let multiplier = 1;
    if (context.economyStable) {
      if (infrastructure) multiplier = context.importantCity ? 2.4 : 1.6;
      else if (candidate.category === 'military' && context.armyDeficient) multiplier = 1.8;
    }
    if (candidate.category === 'wonder') multiplier = context.armyDeficient || defenseDeficient ? 0.15 : 0.4;
    if (candidate.category === 'settler') multiplier = 0.4;
    return { ...candidate, baseScore: candidate.baseScore * multiplier };
  });
}
