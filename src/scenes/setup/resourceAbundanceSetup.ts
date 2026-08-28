import type { ResourceAbundance } from '../../types/gameConfig';

export interface ResourceAbundanceOption {
  value: ResourceAbundance;
  label: string;
}

/**
 * Resource Abundance choices shown in Game Setup, in display order.
 *
 * `scenario` keeps its internal value (no save/scenario migration) while showing
 * the player-facing label "Scenario" — the scenario's authored resource layout
 * is authoritative and no procedural resources are added.
 */
export const RESOURCE_ABUNDANCE_OPTIONS: readonly ResourceAbundanceOption[] = [
  { value: 'scarce', label: 'Scarce' },
  { value: 'normal', label: 'Normal' },
  { value: 'abundant', label: 'Abundant' },
  { value: 'scenario', label: 'Scenario' },
];

/**
 * Default Resource Abundance applied when a scenario is (re)selected in Game
 * Setup. Random maps have no authored resources, so they default to procedural
 * Normal generation; authored scenarios default to Scenario so their designed
 * resource geography is preserved unless the player opts into Low/Normal/High.
 */
export function defaultResourceAbundanceForScenario(isRandomScenario: boolean): ResourceAbundance {
  return isRandomScenario ? 'normal' : 'scenario';
}
