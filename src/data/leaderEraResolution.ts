import { ERA_TIMELINE } from './eraTimeline';
import type { Era } from './technologies';
import type { LeaderEraStrategyProfile } from '../types/aiLeaderEraStrategy';

/** Shared by gameplay and authoring: only transitions are stored. */
export function resolveEraAssignment(map: LeaderEraStrategyProfile['strategiesByEra'], era: Era) {
  const rank = ERA_TIMELINE.findIndex(e => e.era === era);
  for (let i = rank; i >= 0; i--) {
    const from = ERA_TIMELINE[i].era;
    if (map[from]) return { id: map[from]!, from, source: from === era ? 'Explicit' : `Inherited from ${from}` };
  }
  return { id: 'balancedGrowth' as const, from: undefined, source: 'Default · Balanced Growth' };
}
