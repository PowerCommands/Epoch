import type { ScenarioData, ScenarioNation, ScenarioNationDetails } from '../../types/scenario';

export type RandomMapType = 'continents' | 'archipelago' | 'heartland';
export type RandomMapSize = 'small' | 'medium' | 'large' | 'custom';
export type RandomLandTerrainType = 'beach' | 'plains' | 'meadow' | 'forest' | 'mountain' | 'desert' | 'jungle' | 'ice';

export interface RandomMapDimensions {
  readonly width: number;
  readonly height: number;
}

export const RANDOM_MAP_SIZES = {
  small: { width: 80, height: 50 },
  medium: { width: 100, height: 60 },
  large: { width: 120, height: 80 },
} as const;

export const RANDOM_MAP_DIMENSION_LIMITS = {
  minWidth: 40,
  maxWidth: 160,
  minHeight: 30,
  maxHeight: 100,
  maxTiles: 16_000,
} as const;

export const RANDOM_LAND_TERRAIN_TYPES: readonly RandomLandTerrainType[] = [
  'beach', 'plains', 'meadow', 'forest', 'mountain', 'desert', 'jungle', 'ice',
];

/** Relative defaults; callers may supply any non-negative scale, not just percentages. */
export const DEFAULT_RANDOM_TERRAIN_WEIGHTS: Readonly<Record<RandomLandTerrainType, number>> = {
  beach: 5,
  plains: 30,
  meadow: 30,
  forest: 20,
  mountain: 8,
  desert: 3,
  jungle: 3,
  ice: 1,
};

export const DEFAULT_RANDOM_BARBARIAN_CAMP_COUNT = 6;
export const DEFAULT_RANDOM_STARTING_SCOUT = true;
export const DEFAULT_RANDOM_STARTING_WARRIOR = true;
export const RANDOM_CAMP_MIN_START_DISTANCE = 5;
export const RANDOM_CAMP_MIN_CAMP_DISTANCE = 4;
export const RANDOM_CAMP_PREFERRED_MIN_DISTANCE = 7;
export const RANDOM_CAMP_PREFERRED_MAX_DISTANCE = 14;
export const RANDOM_STARTING_UNIT_MAX_DISTANCE = 1;

export interface RandomMapProfileDefinition {
  readonly name: string;
  readonly featureLabel: string;
  readonly defaultFeatureCount: number;
}

export const RANDOM_MAP_PROFILE_DEFINITIONS: Readonly<Record<RandomMapType, RandomMapProfileDefinition>> = {
  continents: { name: 'Continents', featureLabel: 'Number of Continents', defaultFeatureCount: 3 },
  archipelago: { name: 'Archipelago', featureLabel: 'Number of Islands / Island Groups', defaultFeatureCount: 12 },
  heartland: { name: 'Heartland', featureLabel: 'Number of Inland Lakes', defaultFeatureCount: 5 },
};

export interface RandomScenarioConfig {
  mapType: RandomMapType;
  mapSize: RandomMapSize;
  width: number;
  height: number;
  seed: number;
  terrainWeights: Readonly<Record<RandomLandTerrainType, number>>;
  featureCount: number;
  barbarianCampCount: number;
  addStartingScout: boolean;
  addStartingWarrior: boolean;
  nations: readonly ScenarioNation[];
  nationDetails?: Readonly<Record<string, ScenarioNationDetails>>;
}

export interface GeneratedScenarioMetadata {
  generatorVersion: 1;
  mapType: RandomMapType;
  mapSize: RandomMapSize;
  seed: number;
  width: number;
  height: number;
  terrainWeights: Readonly<Record<RandomLandTerrainType, number>>;
  requestedFeatureCount: number;
  barbarianCampCount: number;
  addStartingScout: boolean;
  addStartingWarrior: boolean;
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

export function identifyRandomMapSize(width: number, height: number): RandomMapSize {
  for (const [size, dimensions] of Object.entries(RANDOM_MAP_SIZES)) {
    if (dimensions.width === width && dimensions.height === height) return size as Exclude<RandomMapSize, 'custom'>;
  }
  return 'custom';
}

export function validateRandomMapDimensions(width: number, height: number): string | null {
  const limits = RANDOM_MAP_DIMENSION_LIMITS;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return 'Width and height must be whole numbers.';
  if (width < limits.minWidth || width > limits.maxWidth) return `Width must be between ${limits.minWidth} and ${limits.maxWidth}.`;
  if (height < limits.minHeight || height > limits.maxHeight) return `Height must be between ${limits.minHeight} and ${limits.maxHeight}.`;
  if (width * height > limits.maxTiles) return `Map area must not exceed ${limits.maxTiles.toLocaleString()} tiles.`;
  return null;
}

export function validateRandomFeatureCount(type: RandomMapType, count: number, width: number, height: number): string | null {
  if (!Number.isInteger(count) || count < 1) return 'Geographic feature count must be a positive whole number.';
  const area = width * height;
  const maximum = type === 'continents'
    ? Math.min(20, Math.floor(area * 0.43 / 150))
    : type === 'archipelago'
      ? Math.min(100, Math.floor(area * 0.34 / 50))
      : Math.min(30, Math.floor(area / 200));
  if (count > maximum) return `${RANDOM_MAP_PROFILE_DEFINITIONS[type].featureLabel} must not exceed ${maximum} for this map size.`;
  return null;
}

export function validateRandomBarbarianCampCount(count: number, width: number, height: number): string | null {
  if (!Number.isInteger(count) || count < 0) return 'Barbarian Camp count must be a non-negative whole number.';
  if (count > width * height) return 'Barbarian Camp count cannot exceed the number of map tiles.';
  return null;
}

export function normalizeTerrainWeights(weights: Readonly<Record<RandomLandTerrainType, number>>): Record<RandomLandTerrainType, number> {
  let total = 0;
  for (const type of RANDOM_LAND_TERRAIN_TYPES) {
    const value = weights[type];
    if (!Number.isFinite(value) || value < 0) throw new Error('Terrain weights must be non-negative numbers.');
    total += value;
  }
  if (total <= 0) throw new Error('At least one terrain weight must be greater than zero.');
  return Object.fromEntries(RANDOM_LAND_TERRAIN_TYPES.map((type) => [type, weights[type] / total])) as Record<RandomLandTerrainType, number>;
}
