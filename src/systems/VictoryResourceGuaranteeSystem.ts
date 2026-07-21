import { getNaturalResourceById, isResourceAllowedOnTile } from '../data/naturalResources';
import type { MapData, Tile } from '../types/map';
import {
  isNaturalResourcePlacementTileAvailable,
  naturalResourcePlacementCoordKey,
} from './NaturalResourceSystem';
import {
  DEFAULT_REQUIRED_AEROSPACE_PARTS,
  SCIENCE_VICTORY_REQUIRED_NATURAL_RESOURCE_IDS,
  getScienceVictoryResourceBonusCount,
} from '../data/scienceVictory';

export { getScienceVictoryResourceBonusCount } from '../data/scienceVictory';

export type GuaranteedVictoryId = 'science';

export interface VictoryResourceGuaranteeRule {
  readonly victoryId: GuaranteedVictoryId;
  readonly resourceId: string;
  readonly getBonusCount: (activeNationCount: number, requiredAerospaceParts: number) => number;
}

/**
 * Victory-critical natural resources. Adding another resource to an existing
 * victory only requires another entry here; placement remains shared.
 */
export const VICTORY_RESOURCE_GUARANTEE_RULES: readonly VictoryResourceGuaranteeRule[] =
  SCIENCE_VICTORY_REQUIRED_NATURAL_RESOURCE_IDS.map((resourceId) => ({
    victoryId: 'science',
    resourceId,
    getBonusCount: getScienceVictoryResourceBonusCount,
  }));

export interface VictoryResourceGuaranteeOptions {
  readonly mapKey: string;
  readonly worldSeed: string;
  readonly activeNationIds: readonly string[];
  readonly humanNationId: string;
  readonly cityCoords: readonly { x: number; y: number }[];
  readonly enabledVictories: Readonly<Record<GuaranteedVictoryId, boolean>>;
  readonly requiredAerospaceParts?: number;
}

export interface GuaranteedResourcePlacement {
  readonly x: number;
  readonly y: number;
}

export interface GuaranteedResourceResult {
  readonly victoryId: GuaranteedVictoryId;
  readonly resourceId: string;
  readonly existingBefore: number;
  readonly requested: number;
  readonly placed: number;
  readonly placements: readonly GuaranteedResourcePlacement[];
}

export interface VictoryResourceGuaranteeResult {
  readonly enabledVictories: Readonly<Record<GuaranteedVictoryId, boolean>>;
  readonly resources: readonly GuaranteedResourceResult[];
}

export interface VictoryResourceGuaranteeLogger {
  info(message: string): void;
  warn(message: string): void;
}

const CONSOLE_LOGGER: VictoryResourceGuaranteeLogger = {
  info: (message) => console.log(message),
  warn: (message) => console.warn(message),
};

/**
 * Additive, deterministic pass run only after ordinary resources are complete.
 * Existing resources are anchors for spacing but never reduce the bonus count.
 */
export class VictoryResourceGuaranteeSystem {
  constructor(
    private readonly logger: VictoryResourceGuaranteeLogger = CONSOLE_LOGGER,
    private readonly rules: readonly VictoryResourceGuaranteeRule[] = VICTORY_RESOURCE_GUARANTEE_RULES,
  ) {}

  apply(mapData: MapData, options: VictoryResourceGuaranteeOptions): VictoryResourceGuaranteeResult {
    const resources: GuaranteedResourceResult[] = [];
    const cityCoordKeys = new Set(
      options.cityCoords.map((coord) => naturalResourcePlacementCoordKey(coord.x, coord.y)),
    );

    for (const victoryId of this.getVictoryIds()) {
      if (!options.enabledVictories[victoryId]) {
        const considered = this.rules
          .filter((rule) => rule.victoryId === victoryId)
          .map((rule) => rule.resourceId)
          .join(', ');
        this.logger.info(
          `[VictoryResourceGuarantee] ${victoryId} disabled: considered ${considered}; no bonus victory resources requested.`,
        );
        continue;
      }

      for (const rule of this.rules.filter((candidate) => candidate.victoryId === victoryId)) {
        const result = this.applyRule(mapData, options, cityCoordKeys, rule);
        resources.push(result);
        const coords = result.placements.length > 0
          ? ` at ${result.placements.map((placement) => `(${placement.x},${placement.y})`).join(', ')}`
          : '';
        this.logger.info(
          `[VictoryResourceGuarantee] ${victoryId} enabled: placed ${result.placed}/${result.requested} bonus ${rule.resourceId} resources${coords}.`,
        );
        if (result.placed < result.requested) {
          this.logger.warn(
            `[VictoryResourceGuarantee] Warning: requested ${result.requested} bonus ${rule.resourceId} resources but only ${result.placed} valid placement tiles were available.`,
          );
        }
      }
    }

    return { enabledVictories: { ...options.enabledVictories }, resources };
  }

  private applyRule(
    mapData: MapData,
    options: VictoryResourceGuaranteeOptions,
    cityCoordKeys: ReadonlySet<string>,
    rule: VictoryResourceGuaranteeRule,
  ): GuaranteedResourceResult {
    const existing = this.getTilesWithResource(mapData, rule.resourceId);
    const requested = Math.max(0, Math.floor(rule.getBonusCount(
      options.activeNationIds.length,
      options.requiredAerospaceParts ?? DEFAULT_REQUIRED_AEROSPACE_PARTS,
    )));
    const resource = getNaturalResourceById(rule.resourceId);
    if (!resource || requested === 0) {
      return {
        victoryId: rule.victoryId,
        resourceId: rule.resourceId,
        existingBefore: existing.length,
        requested,
        placed: 0,
        placements: [],
      };
    }

    const candidates = this.seededShuffle(
      mapData.tiles.flat().filter((tile) => (
        isNaturalResourcePlacementTileAvailable(tile, cityCoordKeys)
        && isResourceAllowedOnTile(resource.id, tile.type)
      )),
      this.buildSeed(options, rule, requested),
    );
    const anchors = [...existing];
    const selected: Tile[] = [];

    while (selected.length < requested && candidates.length > 0) {
      const index = this.findMostSeparatedCandidateIndex(candidates, anchors);
      const [tile] = candidates.splice(index, 1);
      tile.resourceId = resource.id;
      selected.push(tile);
      anchors.push(tile);
    }

    return {
      victoryId: rule.victoryId,
      resourceId: rule.resourceId,
      existingBefore: existing.length,
      requested,
      placed: selected.length,
      placements: selected.map((tile) => ({ x: tile.x, y: tile.y })),
    };
  }

  private getVictoryIds(): GuaranteedVictoryId[] {
    return [...new Set(this.rules.map((rule) => rule.victoryId))];
  }

  private getTilesWithResource(mapData: MapData, resourceId: string): Tile[] {
    return mapData.tiles.flat().filter((tile) => tile.resourceId === resourceId);
  }

  /** Seed order resolves equal-distance choices; distance spreads placements. */
  private findMostSeparatedCandidateIndex(candidates: readonly Tile[], anchors: readonly Tile[]): number {
    if (anchors.length === 0) return 0;

    let bestIndex = 0;
    let bestDistance = -1;
    for (let index = 0; index < candidates.length; index++) {
      const minimumDistance = Math.min(
        ...anchors.map((anchor) => this.hexDistance(candidates[index], anchor)),
      );
      if (minimumDistance > bestDistance) {
        bestDistance = minimumDistance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  private hexDistance(a: Pick<Tile, 'x' | 'y'>, b: Pick<Tile, 'x' | 'y'>): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
  }

  private buildSeed(
    options: VictoryResourceGuaranteeOptions,
    rule: VictoryResourceGuaranteeRule,
    requested: number,
  ): string {
    return [
      options.worldSeed,
      options.mapKey,
      options.humanNationId,
      [...options.activeNationIds].sort().join(','),
      rule.victoryId,
      rule.resourceId,
      requested,
      'victory-resource-guarantee-v1',
    ].join('|');
  }

  private seededShuffle<T>(items: readonly T[], seed: string): T[] {
    const result = [...items];
    const rng = new SeededRng(seed);
    for (let index = result.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(rng.next() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }
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
    for (let index = 0; index < seed.length; index++) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
