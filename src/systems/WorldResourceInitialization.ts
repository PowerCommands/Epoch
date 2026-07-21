import type { MapData } from '../types/map';
import type { ResourceAbundance } from '../types/gameConfig';
import { NaturalResourceSystem } from './NaturalResourceSystem';
import {
  VictoryResourceGuaranteeSystem,
  type VictoryResourceGuaranteeLogger,
  type VictoryResourceGuaranteeResult,
} from './VictoryResourceGuaranteeSystem';

export interface WorldResourceInitializationOptions {
  readonly isLoadedGame: boolean;
  readonly mapKey: string;
  readonly activeNationIds: readonly string[];
  readonly humanNationId: string;
  readonly resourceAbundance: ResourceAbundance;
  readonly cityCoords: readonly { x: number; y: number }[];
  readonly worldSeed: string;
  readonly scienceVictoryEnabled: boolean;
  readonly requiredAerospaceParts?: number;
}

export interface WorldResourceInitializationResult {
  readonly ordinaryGenerationRan: boolean;
  readonly guarantee: VictoryResourceGuaranteeResult | null;
}

/** Fresh-world orchestration: ordinary generation first, additive guarantee second. */
export function initializeWorldNaturalResources(
  mapData: MapData,
  options: WorldResourceInitializationOptions,
  logger?: VictoryResourceGuaranteeLogger,
): WorldResourceInitializationResult {
  if (options.isLoadedGame) {
    return { ordinaryGenerationRan: false, guarantee: null };
  }

  new NaturalResourceSystem().generate(mapData, {
    mapKey: options.mapKey,
    activeNationIds: [...options.activeNationIds],
    humanNationId: options.humanNationId,
    resourceAbundance: options.resourceAbundance,
    cityCoords: [...options.cityCoords],
    worldSeed: options.worldSeed,
  });

  const guarantee = new VictoryResourceGuaranteeSystem(logger).apply(mapData, {
    mapKey: options.mapKey,
    worldSeed: options.worldSeed,
    activeNationIds: options.activeNationIds,
    humanNationId: options.humanNationId,
    cityCoords: options.cityCoords,
    enabledVictories: { science: options.scienceVictoryEnabled },
    requiredAerospaceParts: options.requiredAerospaceParts,
  });

  return { ordinaryGenerationRan: true, guarantee };
}
