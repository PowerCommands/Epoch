import { getNaturalResourcesForTileType, isResourceAllowedOnTile, NATURAL_RESOURCES } from '../data/naturalResources';
import type { MapData, Tile } from '../types/map';
import type { NaturalResourceDefinition } from '../types/naturalResources';
import type { ResourceAbundance } from '../types/gameConfig';

/**
 * Procedural densities the generator can produce. This is the {@link ResourceAbundance}
 * set minus `scenario`: "Scenario Only" is not a density — it means the generator
 * is never called (gated out in {@link WorldResourceInitialization}).
 */
export type ProceduralResourceDensity = Exclude<ResourceAbundance, 'scenario'>;

export interface NaturalResourceGenerationOptions {
  mapKey: string;
  activeNationIds: string[];
  humanNationId: string;
  /** Procedural density (Low/Medium/High). "Scenario Only" is not a density here. */
  resourceAbundance: ProceduralResourceDensity;
  cityCoords: Array<{ x: number; y: number }>;
  worldSeed: string;
  /**
   * Non-destructive generation (default `true`). Existing natural resources are
   * always kept and never overwritten, and only empty eligible tiles receive new
   * resources; existing resources always constrain adjacency spacing. When `true`,
   * resources already on the map count toward the density target so the total
   * honors the requested density — this is the Game Setup behavior. When `false`,
   * a full target-sized layer is added on top of whatever already exists.
   */
  preserveExistingResources?: boolean;
}

const DENSITY_BY_ABUNDANCE: Record<ProceduralResourceDensity, number> = {
  scarce: 0.02,
  normal: 0.03,
  abundant: 0.08,
};

/**
 * Canonical procedural natural-resource generator. Both game startup and (in a
 * later task) the Scenario Editor call this so there is a single implementation
 * of the density, weighting, eligibility, spacing and seeding rules. It operates
 * only on the supplied map and options, with no dependency on GameScene or UI.
 */
export function generateNaturalResources(
  mapData: MapData,
  options: NaturalResourceGenerationOptions,
): void {
  new NaturalResourceSystem().generate(mapData, options);
}

export class NaturalResourceSystem {
  generate(mapData: MapData, options: NaturalResourceGenerationOptions): void {
    const preserveExisting = options.preserveExistingResources ?? true;
    const cityCoordKeys = new Set(options.cityCoords.map((coord) => this.coordKey(coord.x, coord.y)));
    this.warnAboutInvalidExistingResources(mapData, cityCoordKeys);
    const validResourceTileCount = this.countValidResourceTiles(mapData, cityCoordKeys);
    // Preserving callers count resources already on the map against the density
    // target so the total honors the requested density (Game Setup behavior).
    // Either way, occupied tiles are never candidates, so nothing is overwritten.
    const existingResourceCount = preserveExisting
      ? this.countExistingValidResources(mapData, cityCoordKeys)
      : 0;
    const targetTotalCount = Math.round(validResourceTileCount * DENSITY_BY_ABUNDANCE[options.resourceAbundance]);
    const remainingToPlace = Math.max(0, targetTotalCount - existingResourceCount);
    if (remainingToPlace <= 0) return;

    const candidates = this.shuffle(
      this.getValidCandidates(mapData, cityCoordKeys),
      new SeededRng(this.buildSeed(options)),
    );

    let placed = 0;
    placed += this.placeFromCandidates(mapData, candidates, remainingToPlace, true, new SeededRng(`${this.buildSeed(options)}:weighted:first`));
    if (placed < remainingToPlace) {
      this.placeFromCandidates(mapData, candidates, remainingToPlace - placed, false, new SeededRng(`${this.buildSeed(options)}:weighted:second`));
    }
  }

  private getValidCandidates(mapData: MapData, cityCoordKeys: Set<string>): Tile[] {
    const candidates: Tile[] = [];
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (!isNaturalResourcePlacementTileAvailable(tile, cityCoordKeys)) continue;
        if (getNaturalResourcesForTileType(tile.type).length === 0) continue;
        candidates.push(tile);
      }
    }
    return candidates;
  }

  private countValidResourceTiles(mapData: MapData, cityCoordKeys: Set<string>): number {
    let count = 0;
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (cityCoordKeys.has(this.coordKey(tile.x, tile.y))) continue;
        if (tile.buildingId !== undefined) continue;
        if (getNaturalResourcesForTileType(tile.type).length === 0) continue;
        count += 1;
      }
    }
    return count;
  }

  private countExistingValidResources(mapData: MapData, cityCoordKeys: Set<string>): number {
    let count = 0;
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (!tile.resourceId) continue;
        if (cityCoordKeys.has(this.coordKey(tile.x, tile.y))) continue;
        if (!isResourceAllowedOnTile(tile.resourceId, tile.type)) continue;
        count += 1;
      }
    }
    return count;
  }

  private warnAboutInvalidExistingResources(mapData: MapData, cityCoordKeys: Set<string>): void {
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (!tile.resourceId) continue;
        if (cityCoordKeys.has(this.coordKey(tile.x, tile.y))) {
          console.warn(`NaturalResourceSystem: ignoring pre-placed resource "${tile.resourceId}" on city tile (${tile.x},${tile.y}).`);
          continue;
        }
        if (!isResourceAllowedOnTile(tile.resourceId, tile.type)) {
          console.warn(`NaturalResourceSystem: ignoring invalid pre-placed resource "${tile.resourceId}" on ${tile.type} tile (${tile.x},${tile.y}).`);
        }
      }
    }
  }

  private placeFromCandidates(
    mapData: MapData,
    candidates: Tile[],
    targetCount: number,
    avoidAdjacent: boolean,
    rng: SeededRng,
  ): number {
    let placed = 0;

    for (const tile of candidates) {
      if (placed >= targetCount) break;
      if (tile.resourceId !== undefined) continue;
      if (avoidAdjacent && this.hasAdjacentResource(mapData, tile)) continue;

      const definition = this.pickWeightedResource(getNaturalResourcesForTileType(tile.type), rng);
      if (!definition) continue;
      tile.resourceId = definition.id;
      placed += 1;
    }

    return placed;
  }

  private hasAdjacentResource(mapData: MapData, tile: Tile): boolean {
    const neighborCoords = [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x - 1, y: tile.y + 1 },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y - 1 },
      { x: tile.x + 1, y: tile.y - 1 },
    ];

    return neighborCoords.some(({ x, y }) => mapData.tiles[y]?.[x]?.resourceId !== undefined);
  }

  private pickWeightedResource(
    resources: NaturalResourceDefinition[],
    rng: SeededRng,
  ): NaturalResourceDefinition | null {
    const totalWeight = resources.reduce((sum, resource) => sum + Math.max(0, resource.weight), 0);
    if (totalWeight <= 0) return resources[0] ?? null;

    let roll = rng.next() * totalWeight;
    for (const resource of resources) {
      roll -= Math.max(0, resource.weight);
      if (roll <= 0) return resource;
    }
    return resources[resources.length - 1] ?? null;
  }

  private shuffle<T>(items: T[], rng: SeededRng): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private buildSeed(options: NaturalResourceGenerationOptions): string {
    return [
      options.worldSeed,
      options.mapKey,
      options.humanNationId,
      [...options.activeNationIds].sort().join(','),
      options.resourceAbundance,
      // Registered, editor-only resources use zero weight and must not perturb
      // the deterministic placement of existing scenarios.
      NATURAL_RESOURCES.filter((resource) => resource.weight > 0).length,
    ].join('|');
  }

  private coordKey(x: number, y: number): string {
    return naturalResourcePlacementCoordKey(x, y);
  }
}

/** Shared placement constraints used by ordinary and victory-resource passes. */
export function isNaturalResourcePlacementTileAvailable(
  tile: Tile,
  cityCoordKeys: ReadonlySet<string>,
): boolean {
  return tile.resourceId === undefined
    && tile.buildingId === undefined
    && !cityCoordKeys.has(naturalResourcePlacementCoordKey(tile.x, tile.y));
}

export function naturalResourcePlacementCoordKey(x: number, y: number): string {
  return `${x},${y}`;
}

class SeededRng {
  private state: number;

  constructor(seed: string) {
    this.state = this.hash(seed);
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  private hash(seed: string): number {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
