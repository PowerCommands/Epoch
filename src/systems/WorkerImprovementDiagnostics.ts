import { ALL_IMPROVEMENTS, type TileImprovementDefinition } from '../data/improvements';
import { WORKER, WORK_BOAT } from '../data/units';
import type { Nation } from '../entities/Nation';
import type { Unit } from '../entities/Unit';
import { TileType, type MapData } from '../types/map';
import { getImprovementOwnerId } from './ImprovementOwnership';

export interface ImprovementTypeCount {
  improvementId: string;
  name: string;
  count: number;
}

export interface NationWorkerImprovementDiagnostic {
  nationId: string;
  nationName: string;
  /** Currently existing Worker units (not historical production). */
  workers: number;
  /** Currently existing Work Boat units (not historical production). */
  workBoats: number;
  /** Completed improvements on land tiles economically owned by this nation. */
  landImprovements: number;
  /** Completed improvements on water tiles economically owned by this nation. */
  waterImprovements: number;
  landImprovementCounts: ImprovementTypeCount[];
  waterImprovementCounts: ImprovementTypeCount[];
  /** Land improvements whose id is not a known land improvement type. */
  otherLandImprovements: number;
  /** Water improvements whose id is not a known water improvement type. */
  otherWaterImprovements: number;
}

const WATER_TILE_TYPES = new Set<TileType>([TileType.Coast, TileType.Ocean]);

/** An improvement type is a water improvement when every tile it allows is water. */
function isWaterImprovement(definition: TileImprovementDefinition): boolean {
  return definition.allowedTileTypes.every((type) => WATER_TILE_TYPES.has(type));
}

const LAND_IMPROVEMENT_DEFS = ALL_IMPROVEMENTS.filter((def) => !isWaterImprovement(def));
const WATER_IMPROVEMENT_DEFS = ALL_IMPROVEMENTS.filter((def) => isWaterImprovement(def));

/**
 * Read-only autorun snapshot of how heavily each nation invests in tile
 * improvements. Counts currently existing Worker / Work Boat units and completed
 * improvements attributed by economic ownership (via {@link getImprovementOwnerId},
 * so Foreign Resource Exploitation holdings are credited to the operating nation
 * rather than the territorial tile owner). Introduces no new state — it derives
 * everything from the live units and map tiles.
 */
export function buildWorkerImprovementDiagnostics(
  nations: readonly Nation[],
  getUnitsByOwner: (nationId: string) => readonly Unit[],
  mapData: MapData,
): NationWorkerImprovementDiagnostic[] {
  // Single map pass: accumulate per economic owner, split by land / water tile.
  const landByOwner = new Map<string, Map<string, number>>();
  const waterByOwner = new Map<string, Map<string, number>>();
  for (const row of mapData.tiles) {
    for (const tile of row) {
      if (tile.improvementId === undefined) continue;
      const ownerId = getImprovementOwnerId(tile);
      if (ownerId === undefined) continue;
      const target = WATER_TILE_TYPES.has(tile.type) ? waterByOwner : landByOwner;
      let counts = target.get(ownerId);
      if (!counts) {
        counts = new Map();
        target.set(ownerId, counts);
      }
      counts.set(tile.improvementId, (counts.get(tile.improvementId) ?? 0) + 1);
    }
  }

  const toTypeCounts = (
    defs: readonly TileImprovementDefinition[],
    counts: Map<string, number> | undefined,
  ): ImprovementTypeCount[] => defs.map((def) => ({
    improvementId: def.id,
    name: def.name,
    count: counts?.get(def.id) ?? 0,
  }));

  const sum = (counts: Map<string, number> | undefined): number =>
    counts ? [...counts.values()].reduce((total, value) => total + value, 0) : 0;

  return nations.map((nation) => {
    const units = getUnitsByOwner(nation.id);
    const landCounts = landByOwner.get(nation.id);
    const waterCounts = waterByOwner.get(nation.id);
    const landImprovementCounts = toTypeCounts(LAND_IMPROVEMENT_DEFS, landCounts);
    const waterImprovementCounts = toTypeCounts(WATER_IMPROVEMENT_DEFS, waterCounts);
    const landTotal = sum(landCounts);
    const waterTotal = sum(waterCounts);
    const knownLand = landImprovementCounts.reduce((total, entry) => total + entry.count, 0);
    const knownWater = waterImprovementCounts.reduce((total, entry) => total + entry.count, 0);

    return {
      nationId: nation.id,
      nationName: nation.name,
      workers: units.filter((unit) => unit.unitType.id === WORKER.id).length,
      workBoats: units.filter((unit) => unit.unitType.id === WORK_BOAT.id).length,
      landImprovements: landTotal,
      waterImprovements: waterTotal,
      landImprovementCounts,
      waterImprovementCounts,
      otherLandImprovements: landTotal - knownLand,
      otherWaterImprovements: waterTotal - knownWater,
    };
  });
}

/** Compact, grep-friendly checkpoint lines, matching the CityEnergyDiag style. */
export function formatWorkerImprovementDiagnostics(
  diagnostics: readonly NationWorkerImprovementDiagnostic[],
): string[] {
  const lines: string[] = [];
  for (const nation of diagnostics) {
    lines.push(
      `[EconomyDiag] ${nation.nationName} workers=${nation.workers} workBoats=${nation.workBoats} `
      + `landImprovements=${nation.landImprovements} waterImprovements=${nation.waterImprovements}`,
    );

    const landParts = nation.landImprovementCounts.map((entry) => `${entry.name}=${entry.count}`);
    if (nation.otherLandImprovements > 0) landParts.push(`Other=${nation.otherLandImprovements}`);
    lines.push(`  land: ${landParts.join(' ')}`);

    const waterParts = nation.waterImprovementCounts.map((entry) => `${entry.name}=${entry.count}`);
    if (nation.otherWaterImprovements > 0) waterParts.push(`Other=${nation.otherWaterImprovements}`);
    lines.push(`  water: ${waterParts.join(' ')}`);
  }
  return lines;
}
