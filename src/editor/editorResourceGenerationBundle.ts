/**
 * Browser entry point that exposes the shared natural-resource generator to the
 * standalone Scenario Editor (`public/editor.html`, plain vanilla JS with no
 * module system). esbuild bundles this into a committed IIFE at
 * `public/editor/epoch-editor-resources.js` (see scripts/generateEditorResourceBundle.ts),
 * which the editor loads with a classic <script> tag.
 *
 * All generation logic lives in the shared TypeScript generator; this file only
 * adapts the editor's flat tile arrays to {@link MapData} and back so there is
 * no duplicated algorithm.
 */
import type { MapData, TileType } from '../types/map';
import type { ProceduralResourceDensity } from '../systems/NaturalResourceSystem';
import {
  generateScenarioResources,
  SCENARIO_EDITOR_RESOURCE_DENSITIES,
} from './generateScenarioResources';

export interface EditorResourceGenerationRequest {
  width: number;
  height: number;
  tileSize: number;
  /** [r][q] terrain-type strings (these are game TileType values). */
  tiles: string[][];
  /** [r][q] resource id, or undefined/null when empty. */
  tileResources: Array<Array<string | undefined | null>>;
  /** [r][q] building id, or undefined/null when none. */
  tileBuildings?: Array<Array<string | undefined | null>>;
  /** Authored city positions (kept clear of resources). */
  cityCoords?: Array<{ q: number; r: number }>;
  density: ProceduralResourceDensity;
}

export interface EditorResourceGenerationResponse {
  density: ProceduralResourceDensity;
  addedCount: number;
  /** [r][q] resource ids after generation: existing preserved, new added. */
  tileResources: Array<Array<string | undefined>>;
}

export interface EditorResourceClearRequest {
  /** [r][q] resource id, or undefined/null when empty. */
  tileResources: Array<Array<string | undefined | null>>;
}

export interface EditorResourceClearResponse {
  removedCount: number;
  /** [r][q] resource ids after clearing (all empty). */
  tileResources: Array<Array<string | undefined>>;
}

/**
 * Remove every natural resource from the editor's grid. Only natural-resource
 * placement is affected — terrain, cities, units and buildings live in other
 * editor arrays and are never touched here. The input array is not mutated; the
 * editor applies the returned all-empty grid itself so it can record undo.
 * Works generically over the resource grid, with no hardcoded resource ids.
 */
export function clearEditorResources(
  request: EditorResourceClearRequest,
): EditorResourceClearResponse {
  let removedCount = 0;
  const tileResources = request.tileResources.map((row) => (
    row.map((resourceId) => {
      if (resourceId !== undefined && resourceId !== null) removedCount += 1;
      return undefined;
    })
  ));
  return { removedCount, tileResources };
}

/**
 * Non-destructively generate a procedural resource layer for the editor. Builds
 * a {@link MapData} from the editor's arrays, runs the shared generator with
 * preservation enabled, and returns the resulting resource grid plus a count.
 * The input arrays are not mutated — the editor applies the returned grid itself
 * so it can record the change in its own undo history.
 */
export function generateEditorResources(
  request: EditorResourceGenerationRequest,
): EditorResourceGenerationResponse {
  const mapData: MapData = {
    width: request.width,
    height: request.height,
    tileSize: request.tileSize,
    tiles: Array.from({ length: request.height }, (_, r) => (
      Array.from({ length: request.width }, (_, q) => ({
        x: q,
        y: r,
        type: request.tiles[r]?.[q] as TileType,
        resourceId: request.tileResources[r]?.[q] ?? undefined,
        buildingId: request.tileBuildings?.[r]?.[q] ?? undefined,
      }))
    )),
  };

  const result = generateScenarioResources({
    mapData,
    density: request.density,
    cityCoords: (request.cityCoords ?? []).map((coord) => ({ x: coord.q, y: coord.r })),
  });

  return {
    density: result.density,
    addedCount: result.addedCount,
    tileResources: mapData.tiles.map((row) => row.map((tile) => tile.resourceId)),
  };
}

declare global {
  interface Window {
    EpochEditorResources?: {
      generateEditorResources: typeof generateEditorResources;
      clearEditorResources: typeof clearEditorResources;
      DENSITIES: readonly ProceduralResourceDensity[];
    };
  }
}

if (typeof window !== 'undefined') {
  window.EpochEditorResources = {
    generateEditorResources,
    clearEditorResources,
    DENSITIES: SCENARIO_EDITOR_RESOURCE_DENSITIES,
  };
}
