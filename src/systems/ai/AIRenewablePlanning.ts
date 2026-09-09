import type { TileImprovementDefinition } from '../../data/improvements';

export function scoreRenewableImprovement(improvement: TileImprovementDefinition, input: {
  population: number; capacity: number; pendingCapacity: number;
  gold: number; goldPerTurn: number; pendingMaintenance: number;
  economicPriority: boolean; distance: number;
}): number {
  const maintenance = improvement.maintenance ?? 0;
  const bonus = improvement.populationCapacity ?? 0;
  const margin = input.economicPriority ? 3 : 2;
  if (!bonus || input.population < input.capacity + input.pendingCapacity - margin) return 0;
  if (input.gold < (maintenance + input.pendingMaintenance) * 10
    || input.goldPerTurn < maintenance + input.pendingMaintenance + 1) return 0;
  return Math.max(0, 80 + bonus * 12 + Math.max(0, input.population - input.capacity) * 20
    + (input.economicPriority ? 15 : 0) - maintenance * 4 - input.distance * 5);
}
