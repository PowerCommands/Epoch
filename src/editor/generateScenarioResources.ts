import {
  generateNaturalResources,
  type NaturalResourceGenerationOptions,
  type ProceduralResourceDensity,
} from '../systems/NaturalResourceSystem';
import type { MapData } from '../types/map';

/** Densities the Scenario Editor exposes, in Low → High order (shared values). */
export const SCENARIO_EDITOR_RESOURCE_DENSITIES: readonly ProceduralResourceDensity[] = [
  'scarce',
  'normal',
  'abundant',
];

export interface ScenarioResourceGenerationInput {
  /** Map to add resources to, mutated in place. */
  mapData: MapData;
  /** Selected procedural density (Low/Medium/High) — shared with Game Setup. */
  density: ProceduralResourceDensity;
  /** City tiles to keep clear of resources, mirroring game-startup behavior. */
  cityCoords?: readonly { x: number; y: number }[];
  /** Seed handed to the shared generator; defaults to a fresh random seed. */
  worldSeed?: string;
  /** Map identity mixed into the seed; a stable placeholder by default. */
  mapKey?: string;
}

export interface ScenarioResourceGenerationResult {
  density: ProceduralResourceDensity;
  addedCount: number;
}

function countNaturalResources(mapData: MapData): number {
  let count = 0;
  for (const row of mapData.tiles) {
    for (const tile of row) {
      if (tile.resourceId !== undefined) count += 1;
    }
  }
  return count;
}

function createEditorSeed(): string {
  return `scenario-editor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Scenario Editor "Generate Resources" command.
 *
 * Adds a procedural base layer to the map using the single canonical
 * {@link generateNaturalResources} generator, non-destructively: resources
 * already on the map are preserved (never moved, replaced, or removed) and new
 * resources only land on eligible empty tiles, respecting the generator's own
 * spacing against the existing layout. Mutates {@link ScenarioResourceGenerationInput.mapData}
 * in place and reports how many resources were added.
 */
export function generateScenarioResources(
  input: ScenarioResourceGenerationInput,
): ScenarioResourceGenerationResult {
  const before = countNaturalResources(input.mapData);

  const options: NaturalResourceGenerationOptions = {
    mapKey: input.mapKey ?? 'scenario_editor',
    activeNationIds: [],
    humanNationId: '',
    resourceAbundance: input.density,
    cityCoords: (input.cityCoords ?? []).map((coord) => ({ x: coord.x, y: coord.y })),
    worldSeed: input.worldSeed ?? createEditorSeed(),
    preserveExistingResources: true,
  };
  generateNaturalResources(input.mapData, options);

  return {
    density: input.density,
    addedCount: countNaturalResources(input.mapData) - before,
  };
}
