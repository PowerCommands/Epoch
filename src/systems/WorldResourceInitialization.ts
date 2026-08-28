import type { MapData } from '../types/map';
import type { ResourceAbundance } from '../types/gameConfig';
import { generateNaturalResources } from './NaturalResourceSystem';
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

  // "Scenario Only": the resources already placed in the scenario are
  // authoritative. Skip both procedural generation and the victory guarantee so
  // nothing is added, moved, removed, or rebalanced — even down to zero resources.
  const density = options.resourceAbundance;
  if (density === 'scenario') {
    return { ordinaryGenerationRan: false, guarantee: null };
  }

  generateNaturalResources(mapData, {
    mapKey: options.mapKey,
    activeNationIds: [...options.activeNationIds],
    humanNationId: options.humanNationId,
    resourceAbundance: density,
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
