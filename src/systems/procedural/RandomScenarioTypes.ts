import type { ResourceAbundance } from '../../types/gameConfig';
import type { ScenarioData, ScenarioNation, ScenarioNationDetails } from '../../types/scenario';

export type RandomMapType = 'continents' | 'archipelago' | 'heartland';
export type RandomMapSize = 'small' | 'medium' | 'large';

export interface RandomMapDimensions {
  readonly width: number;
  readonly height: number;
}

export const RANDOM_MAP_SIZES: Readonly<Record<RandomMapSize, RandomMapDimensions>> = {
  small: { width: 80, height: 50 },
  medium: { width: 100, height: 60 },
  large: { width: 120, height: 80 },
};

export interface RandomScenarioConfig {
  mapType: RandomMapType;
  mapSize: RandomMapSize;
  seed: number;
  nations: readonly ScenarioNation[];
  humanNationId: string;
  resourceAbundance: ResourceAbundance;
  nationDetails?: Readonly<Record<string, ScenarioNationDetails>>;
}

export interface GeneratedScenarioMetadata {
  generatorVersion: 1;
  mapType: RandomMapType;
  mapSize: RandomMapSize;
  seed: number;
  width: number;
  height: number;
  minimumStartDistance: number;
}

export interface GeneratedScenarioSnapshot {
  metadata: GeneratedScenarioMetadata;
  scenario: ScenarioData;
}

export interface GeneratedRandomScenario extends GeneratedScenarioSnapshot {
  mapKey: string;
}

export interface MapGenerationValidationResult {
  valid: boolean;
  errors: string[];
}
