import { TileType, type MapData } from '../../types/map';
import { BARBARIAN_CAMP_BUILDING_ID } from '../../data/barbarians';
import type { ScenarioData, ScenarioNation, ScenarioUnit } from '../../types/scenario';
import { MapGenerationValidator, buildLandComponentSizes, hexDistance, isValidStartTerrain } from './MapGenerationValidator';
import { SeededRandom } from './SeededRandom';
import {
  normalizeTerrainWeights,
  RANDOM_CAMP_MIN_CAMP_DISTANCE,
  RANDOM_CAMP_MIN_START_DISTANCE,
  RANDOM_CAMP_PREFERRED_MAX_DISTANCE,
  RANDOM_CAMP_PREFERRED_MIN_DISTANCE,
  validateRandomBarbarianCampCount,
  validateRandomFeatureCount,
  validateRandomMapDimensions,
  type GeneratedRandomScenario,
  type GeneratedScenarioMetadata,
  type RandomMapType,
  type RandomScenarioConfig,
} from './RandomScenarioTypes';

const MAX_GENERATION_ATTEMPTS = 12;
const MAP_TILE_SIZE = 48;
const EDGE_MARGIN = 3;
const DIRECTIONS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
] as const;
const PASSABLE_STARTING_LAND_TYPES: ReadonlySet<TileType> = new Set([
  TileType.Plains, TileType.Meadow, TileType.Beach, TileType.Forest, TileType.Desert, TileType.Jungle,
]);

interface MapProfile {
  readonly landFraction: number;
  readonly regionDivisor: number;
  readonly minRegions: number;
  readonly maxRegions: number;
  readonly separation: number;
  readonly heartlandShare?: number;
}

/** Named v1 tuning profiles shared by the land-growth primitives. */
export const RANDOM_MAP_PROFILES: Readonly<Record<RandomMapType, MapProfile>> = {
  continents: { landFraction: 0.43, regionDivisor: 900, minRegions: 4, maxRegions: 7, separation: 3 },
  archipelago: { landFraction: 0.34, regionDivisor: 185, minRegions: 18, maxRegions: 48, separation: 1 },
  heartland: { landFraction: 0.54, regionDivisor: 1500, minRegions: 4, maxRegions: 7, separation: 1, heartlandShare: 0.91 },
};

export class RandomScenarioGenerator {
  static generate(config: RandomScenarioConfig): GeneratedRandomScenario {
    const dimensions = { width: config.width, height: config.height };
    const dimensionError = validateRandomMapDimensions(dimensions.width, dimensions.height);
    if (dimensionError) throw new Error(dimensionError);
    const featureError = validateRandomFeatureCount(config.mapType, config.featureCount, dimensions.width, dimensions.height);
    if (featureError) throw new Error(featureError);
    const campError = validateRandomBarbarianCampCount(config.barbarianCampCount, dimensions.width, dimensions.height);
    if (campError) throw new Error(campError);
    const normalizedTerrainWeights = normalizeTerrainWeights(config.terrainWeights);
    if (!Number.isSafeInteger(config.seed)) throw new Error('Random Scenario seed must be a safe integer.');
    if (config.nations.length < 2) throw new Error('Random Scenario requires at least two participating nations.');

    const nationIds = config.nations.map((nation) => nation.id);
    if (new Set(nationIds).size !== nationIds.length) throw new Error('Participating nations must be unique.');
    let lastErrors: string[] = [];
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const attemptSeed = [
        'epoch-random-scenario-v1', config.seed, config.mapType, dimensions.width, dimensions.height,
        config.featureCount,
        config.barbarianCampCount, config.addStartingScout, config.addStartingWarrior,
        Object.entries(normalizedTerrainWeights).map(([type, weight]) => `${type}:${weight}`).join(','),
        [...nationIds].sort().join(','), `attempt-${attempt}`,
      ].join('|');
      try {
        const generated = generateAttempt(config, normalizedTerrainWeights, attemptSeed);
        const validation = MapGenerationValidator.validate(generated.scenario, generated.metadata);
        if (validation.valid) return generated;
        lastErrors = validation.errors;
      } catch (error) {
        lastErrors = [(error as Error).message];
      }
    }
    throw new Error(`Random Scenario generation failed after ${MAX_GENERATION_ATTEMPTS} deterministic attempts: ${lastErrors.join(' ')}`);
  }
}

function generateAttempt(
  config: RandomScenarioConfig,
  normalizedTerrainWeights: ReturnType<typeof normalizeTerrainWeights>,
  attemptSeed: string,
): GeneratedRandomScenario {
  const { width, height } = config;
  const mapKey = buildGeneratedMapKey(config, normalizedTerrainWeights);
  const rng = new SeededRandom(attemptSeed);
  const land = generateLandmass(config.mapType, width, height, config.featureCount, rng);
  const terrain = generateTerrain(land, width, height, normalizedTerrainWeights, rng);
  deriveCoasts(terrain, width, height);

  const mapData = toMapData(terrain, width, height);

  const minimumStartDistance = calculateMinimumStartDistance(width, height, land, config.nations.length);
  const optionalStartingUnitCount = Number(config.addStartingScout) + Number(config.addStartingWarrior);
  const starts = selectStartingPositions(
    mapData, config.mapType, config.nations.length, minimumStartDistance, optionalStartingUnitCount, rng,
  );
  const nations = config.nations.map((nation, index): ScenarioNation => ({
    ...nation,
    isHuman: false,
    startTerritoryCenter: { q: starts[index]!.q, r: starts[index]!.r },
  }));
  const units = placeStartingUnits(nations, starts, mapData, config.addStartingScout, config.addStartingWarrior, rng);
  placeBarbarianCamps(mapData, starts, units, config.barbarianCampCount, rng);
  const scenario: ScenarioData = {
    meta: {
      name: `Random ${profileName(config.mapType)}`,
      version: 1,
      description: `Procedurally generated ${profileName(config.mapType).toLowerCase()} world. Seed ${config.seed}.`,
      author: 'Epoch',
      startYear: 4000,
      startYearIsBC: true,
      timeProgression: { mode: 'auto' },
      barbarianSpawnInterval: 10,
    },
    map: {
      width,
      height,
      tileSize: MAP_TILE_SIZE,
      tiles: mapData.tiles.flat().map((tile) => ({
        q: tile.x,
        r: tile.y,
        type: tile.type,
        ...(tile.resourceId ? { resourceId: tile.resourceId } : {}),
        ...(tile.buildingId ? { buildingId: tile.buildingId } : {}),
      })),
    },
    nations,
    cities: [],
    units,
    nationDetails: Object.fromEntries(nations.map((nation) => [
      nation.id,
      {
        researchedTechIds: [...(config.nationDetails?.[nation.id]?.researchedTechIds ?? nation.researchedTechIds ?? [])],
        unlockedCultureNodeIds: [...(config.nationDetails?.[nation.id]?.unlockedCultureNodeIds ?? nation.unlockedCultureNodeIds ?? [])],
      },
    ])),
    initialDiplomacy: [],
  };
  const metadata: GeneratedScenarioMetadata = {
    generatorVersion: 1,
    mapType: config.mapType,
    mapSize: config.mapSize,
    seed: config.seed,
    width,
    height,
    terrainWeights: { ...config.terrainWeights },
    requestedFeatureCount: config.featureCount,
    barbarianCampCount: config.barbarianCampCount,
    addStartingScout: config.addStartingScout,
    addStartingWarrior: config.addStartingWarrior,
    minimumStartDistance,
  };
  return {
    mapKey,
    metadata,
    scenario,
  };
}

function generateLandmass(type: RandomMapType, width: number, height: number, featureCount: number, rng: SeededRandom): boolean[][] {
  const land = Array.from({ length: height }, () => Array<boolean>(width).fill(false));
  const labels = Array.from({ length: height }, () => Array<number>(width).fill(-1));
  const profile = RANDOM_MAP_PROFILES[type];
  const totalTarget = Math.floor(width * height * profile.landFraction);
  const regionCount = type === 'heartland' ? Math.max(2, Math.min(7, Math.round(width * height / profile.regionDivisor))) : featureCount;

  if (type === 'heartland') {
    const center = {
      q: Math.floor(width * (0.46 + rng.next() * 0.08)),
      r: Math.floor(height * (0.43 + rng.next() * 0.14)),
    };
    growRegion(land, labels, 0, center, Math.floor(totalTarget * profile.heartlandShare!), 0, rng);
    carveHeartlandLakes(land, width, height, featureCount, rng);
    const remaining = Math.max(0, totalTarget - countLand(land));
    growSeparatedRegions(land, labels, regionCount - 1, remaining, profile.separation, rng);
  } else {
    growSeparatedRegions(land, labels, regionCount, totalTarget, profile.separation, rng);
  }

  cleanupLand(land, type);
  return land;
}

function growSeparatedRegions(
  land: boolean[][],
  labels: number[][],
  regionCount: number,
  target: number,
  separation: number,
  rng: SeededRandom,
): void {
  if (regionCount <= 0 || target <= 0) return;
  const weights = Array.from({ length: regionCount }, () => 0.55 + rng.next() * 0.9);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;
  for (let region = 0; region < regionCount; region += 1) {
    const remainingRegions = regionCount - region;
    const regionTarget = region === regionCount - 1
      ? target - assigned
      : Math.max(12, Math.floor(target * weights[region]! / totalWeight));
    assigned += regionTarget;
    const center = findRegionSeed(land, separation + 2, rng);
    if (!center) continue;
    growRegion(land, labels, region, center, regionTarget, separation, rng);
    if (remainingRegions === 1) break;
  }
}

function growRegion(
  land: boolean[][],
  labels: number[][],
  label: number,
  center: Coord,
  target: number,
  separation: number,
  rng: SeededRandom,
): void {
  const width = land[0]!.length;
  const height = land.length;
  const frontier: Coord[] = [];
  const frontierKeys = new Set<string>();
  const addFrontier = (q: number, r: number): void => {
    if (q < EDGE_MARGIN || r < EDGE_MARGIN || q >= width - EDGE_MARGIN || r >= height - EDGE_MARGIN) return;
    if (land[r]![q] || frontierKeys.has(key(q, r))) return;
    frontierKeys.add(key(q, r));
    frontier.push({ q, r });
  };
  const claim = (coord: Coord): void => {
    land[coord.r]![coord.q] = true;
    labels[coord.r]![coord.q] = label;
    frontierKeys.delete(key(coord.q, coord.r));
    for (const [dq, dr] of DIRECTIONS) addFrontier(coord.q + dq, coord.r + dr);
  };
  claim(center);
  let placed = 1;
  let safety = Math.max(500, target * 40);
  while (placed < target && frontier.length > 0 && safety-- > 0) {
    const index = rng.integer(0, frontier.length - 1);
    const candidate = frontier[index]!;
    frontier[index] = frontier[frontier.length - 1]!;
    frontier.pop();
    if (!frontierKeys.delete(key(candidate.q, candidate.r)) || land[candidate.r]![candidate.q]) continue;
    if (separation > 0 && hasDifferentRegionNearby(labels, candidate, label, separation)) continue;
    const sameNeighbors = countNeighbors(candidate.q, candidate.r, width, height, (q, r) => labels[r]![q] === label);
    const compactness = Math.min(0.92, 0.30 + sameNeighbors * 0.14);
    if (sameNeighbors === 0 || rng.next() > compactness) {
      addFrontier(candidate.q, candidate.r);
      continue;
    }
    claim(candidate);
    placed += 1;
  }
}

function findRegionSeed(land: boolean[][], clearance: number, rng: SeededRandom): Coord | null {
  const width = land[0]!.length;
  const height = land.length;
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = { q: rng.integer(EDGE_MARGIN, width - EDGE_MARGIN - 1), r: rng.integer(EDGE_MARGIN, height - EDGE_MARGIN - 1) };
    if (!hasLandNearby(land, candidate, clearance)) return candidate;
  }
  return null;
}

function cleanupLand(land: boolean[][], type: RandomMapType): void {
  const height = land.length;
  const width = land[0]!.length;
  const original = land.map((row) => [...row]);
  for (let r = 1; r < height - 1; r += 1) {
    for (let q = 1; q < width - 1; q += 1) {
      const neighbors = countNeighbors(q, r, width, height, (nq, nr) => original[nr]![nq]);
      if (original[r]![q] && neighbors <= (type === 'archipelago' ? 0 : 1)) land[r]![q] = false;
      if (!original[r]![q] && neighbors >= 5) land[r]![q] = true;
    }
  }
}

function carveHeartlandLakes(land: boolean[][], width: number, height: number, lakeCount: number, rng: SeededRandom): void {
  for (let lake = 0; lake < lakeCount; lake += 1) {
    const seed = findExistingLand(land, rng);
    if (!seed) continue;
    const target = rng.integer(8, 24);
    const frontier = [seed];
    const seen = new Set<string>();
    for (let index = 0; index < frontier.length && seen.size < target; index += 1) {
      const current = frontier[index]!;
      if (current.q < 5 || current.r < 5 || current.q >= width - 5 || current.r >= height - 5) continue;
      if (!land[current.r]![current.q] || seen.has(key(current.q, current.r))) continue;
      seen.add(key(current.q, current.r));
      land[current.r]![current.q] = false;
      for (const [dq, dr] of rng.shuffle(DIRECTIONS)) frontier.push({ q: current.q + dq, r: current.r + dr });
    }
  }
}

function generateTerrain(
  land: boolean[][],
  width: number,
  height: number,
  weights: ReturnType<typeof normalizeTerrainWeights>,
  rng: SeededRandom,
): TileType[][] {
  const baseWeight = weights.plains + weights.meadow;
  const plainsShare = baseWeight > 0 ? weights.plains / baseWeight : 0.5;
  const terrain = land.map((row) => row.map((isLand) => isLand
    ? (rng.next() < plainsShare ? TileType.Plains : TileType.Meadow)
    : TileType.Ocean));
  const landCount = countLand(land);
  paintTerrainPatches(terrain, land, TileType.Forest, Math.floor(landCount * weights.forest), 5, 18, rng);
  paintTerrainPatches(terrain, land, TileType.Desert, Math.floor(landCount * weights.desert), 7, 22, rng, (coord) => latitude(coord.r, height) < 0.68);
  paintTerrainPatches(terrain, land, TileType.Jungle, Math.floor(landCount * weights.jungle), 6, 18, rng, (coord) => latitude(coord.r, height) < 0.48);
  paintMountainChains(terrain, land, Math.floor(landCount * weights.mountain), rng);
  paintTerrainPatches(terrain, land, TileType.Ice, Math.floor(landCount * weights.ice), 4, 12, rng, (coord) => latitude(coord.r, height) > 0.70);
  paintBeaches(terrain, land, Math.floor(landCount * weights.beach), rng);
  return terrain;
}

function paintBeaches(terrain: TileType[][], land: boolean[][], target: number, rng: SeededRandom): void {
  if (target <= 0) return;
  const height = land.length;
  const width = land[0]!.length;
  const candidates: Coord[] = [];
  for (let r = 0; r < height; r += 1) {
    for (let q = 0; q < width; q += 1) {
      if (!isBaseTerrain(terrain[r]![q])) continue;
      if (countNeighbors(q, r, width, height, (nq, nr) => !land[nr]![nq]) > 0) candidates.push({ q, r });
    }
  }
  for (const coord of rng.shuffle(candidates).slice(0, target)) terrain[coord.r]![coord.q] = TileType.Beach;
}

function paintTerrainPatches(
  terrain: TileType[][],
  land: boolean[][],
  type: TileType,
  target: number,
  minPatch: number,
  maxPatch: number,
  rng: SeededRandom,
  allowed: (coord: Coord) => boolean = () => true,
): void {
  let painted = 0;
  let attempts = target * 20;
  while (painted < target && attempts-- > 0) {
    const seed = findExistingLand(land, rng, (coord) => allowed(coord) && isBaseTerrain(terrain[coord.r]![coord.q]));
    if (!seed) break;
    const patchTarget = Math.min(target - painted, rng.integer(minPatch, maxPatch));
    const queue = [seed];
    const queued = new Set([key(seed.q, seed.r)]);
    for (let index = 0; index < queue.length && painted < target && index < patchTarget * 5; index += 1) {
      const current = queue[index]!;
      if (!land[current.r]?.[current.q] || !allowed(current) || !isBaseTerrain(terrain[current.r]![current.q])) continue;
      terrain[current.r]![current.q] = type;
      painted += 1;
      for (const [dq, dr] of rng.shuffle(DIRECTIONS)) {
        const next = { q: current.q + dq, r: current.r + dr };
        const nextKey = key(next.q, next.r);
        if (!queued.has(nextKey) && rng.next() < 0.78) {
          queued.add(nextKey);
          queue.push(next);
        }
      }
      if (painted >= target || painted % patchTarget === 0) break;
    }
  }
}

function paintMountainChains(terrain: TileType[][], land: boolean[][], target: number, rng: SeededRandom): void {
  let painted = 0;
  while (painted < target) {
    const start = findExistingLand(land, rng, (coord) => isBaseTerrain(terrain[coord.r]![coord.q]));
    if (!start) break;
    let current = start;
    const direction = rng.pick(DIRECTIONS);
    const chainLength = Math.min(target - painted, rng.integer(4, 12));
    for (let step = 0; step < chainLength; step += 1) {
      if (land[current.r]?.[current.q] && isBaseTerrain(terrain[current.r]![current.q])) {
        terrain[current.r]![current.q] = TileType.Mountain;
        painted += 1;
      }
      const drift = rng.next() < 0.72 ? direction : rng.pick(DIRECTIONS);
      current = { q: current.q + drift[0], r: current.r + drift[1] };
    }
  }
}

function deriveCoasts(terrain: TileType[][], width: number, height: number): void {
  const land = terrain.map((row) => row.map((type) => type !== TileType.Ocean));
  for (let r = 0; r < height; r += 1) {
    for (let q = 0; q < width; q += 1) {
      if (terrain[r]![q] !== TileType.Ocean) continue;
      if (countNeighbors(q, r, width, height, (nq, nr) => land[nr]![nq]) > 0) terrain[r]![q] = TileType.Coast;
    }
  }
}

function selectStartingPositions(
  mapData: MapData,
  mapType: RandomMapType,
  count: number,
  minimumDistance: number,
  requiredAdjacentUnitTiles: number,
  rng: SeededRandom,
): Coord[] {
  const types = mapData.tiles.map((row) => row.map((tile) => tile.type));
  const components = buildLandComponentSizes(types);
  const candidates = mapData.tiles.flat()
    .filter((tile) => isValidStartTerrain(tile.type))
    .filter((tile) => countNeighbors(tile.x, tile.y, mapData.width, mapData.height, (q, r) => (
      PASSABLE_STARTING_LAND_TYPES.has(mapData.tiles[r]![q]!.type)
    )) >= requiredAdjacentUnitTiles)
    .filter((tile) => (components.get(key(tile.x, tile.y)) ?? 0) >= (mapType === 'archipelago' ? 32 : 55))
    .map((tile) => ({
      q: tile.x,
      r: tile.y,
      score: scoreStart(mapData, tile.x, tile.y) + rng.next() * 3,
    }))
    .filter((candidate) => candidate.score >= 20)
    .sort((a, b) => b.score - a.score || a.r - b.r || a.q - b.q);
  const selected: Coord[] = [];
  while (selected.length < count) {
    const eligible = candidates.filter((candidate) => selected.every((start) => hexDistance(start, candidate) >= minimumDistance));
    if (eligible.length === 0) throw new Error(`Could not find ${count} viable starts separated by ${minimumDistance} tiles.`);
    const diversityPool = eligible.slice(0, Math.min(24, eligible.length));
    const choice = rng.pick(diversityPool);
    selected.push({ q: choice.q, r: choice.r });
  }
  return selected;
}

function placeStartingUnits(
  nations: readonly ScenarioNation[],
  starts: readonly Coord[],
  mapData: MapData,
  addScout: boolean,
  addWarrior: boolean,
  rng: SeededRandom,
): ScenarioUnit[] {
  const units: ScenarioUnit[] = [];
  const occupied = new Set<string>();
  const optionalTypes = [
    ...(addScout ? ['scout'] : []),
    ...(addWarrior ? ['warrior'] : []),
  ];
  for (let index = 0; index < nations.length; index += 1) {
    const nation = nations[index]!;
    const start = starts[index]!;
    units.push({ nationId: nation.id, unitTypeId: 'settler', q: start.q, r: start.r });
    occupied.add(key(start.q, start.r));
    const neighbors = rng.shuffle(DIRECTIONS)
      .map(([dq, dr]) => ({ q: start.q + dq, r: start.r + dr }))
      .filter((coord) => {
        const tile = mapData.tiles[coord.r]?.[coord.q];
        return tile !== undefined && PASSABLE_STARTING_LAND_TYPES.has(tile.type) && !occupied.has(key(coord.q, coord.r));
      });
    if (neighbors.length < optionalTypes.length) throw new Error(`${nation.id} has no room for its requested starting units.`);
    optionalTypes.forEach((unitTypeId, unitIndex) => {
      const coord = neighbors[unitIndex]!;
      occupied.add(key(coord.q, coord.r));
      units.push({ nationId: nation.id, unitTypeId, q: coord.q, r: coord.r });
    });
  }
  return units;
}

function placeBarbarianCamps(
  mapData: MapData,
  starts: readonly Coord[],
  units: readonly ScenarioUnit[],
  requestedCount: number,
  rng: SeededRandom,
): void {
  if (requestedCount === 0) return;
  const occupied = new Set(units.map((unit) => key(unit.q, unit.r)));
  const camps: Coord[] = [];
  const anchorOrder = rng.shuffle(starts.map((_, index) => index));
  const allocations = Array.from({ length: requestedCount }, (_, index) => anchorOrder[index % anchorOrder.length]!);

  for (const anchorIndex of allocations) {
    const anchor = starts[anchorIndex]!;
    const allCandidates = mapData.tiles.flat().filter((tile) => {
      const coord = { q: tile.x, r: tile.y };
      if (!PASSABLE_STARTING_LAND_TYPES.has(tile.type) || tile.buildingId || occupied.has(key(tile.x, tile.y))) return false;
      if (starts.some((start) => hexDistance(start, coord) < RANDOM_CAMP_MIN_START_DISTANCE)) return false;
      if (camps.some((camp) => hexDistance(camp, coord) < RANDOM_CAMP_MIN_CAMP_DISTANCE)) return false;
      return nearestStartIndex(tile, starts) === anchorIndex;
    });
    const preferred = allCandidates.filter((tile) => {
      const distance = hexDistance(anchor, { q: tile.x, r: tile.y });
      return distance >= RANDOM_CAMP_PREFERRED_MIN_DISTANCE && distance <= RANDOM_CAMP_PREFERRED_MAX_DISTANCE;
    });
    const candidates = preferred.length > 0 ? preferred : allCandidates;
    if (candidates.length === 0) throw new Error(`Could not place ${requestedCount} fairly distributed Barbarian Camps.`);
    const shuffled = rng.shuffle(candidates);
    shuffled.sort((a, b) => (
      Math.abs(hexDistance(anchor, { q: a.x, r: a.y }) - 10)
      - Math.abs(hexDistance(anchor, { q: b.x, r: b.y }) - 10)
    ));
    const choice = shuffled[0]!;
    choice.buildingId = BARBARIAN_CAMP_BUILDING_ID;
    camps.push({ q: choice.x, r: choice.y });
  }
}

function nearestStartIndex(coord: { q?: number; r?: number; x?: number; y?: number }, starts: readonly Coord[]): number {
  const point = { q: coord.q ?? coord.x!, r: coord.r ?? coord.y! };
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < starts.length; index += 1) {
    const distance = hexDistance(point, starts[index]!);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }
  return nearestIndex;
}

function scoreStart(mapData: MapData, q: number, r: number): number {
  let score = 0;
  let workable = 0;
  let mountains = 0;
  let deserts = 0;
  for (let dq = -3; dq <= 3; dq += 1) {
    const minDr = Math.max(-3, -dq - 3);
    const maxDr = Math.min(3, -dq + 3);
    for (let dr = minDr; dr <= maxDr; dr += 1) {
      const tile = mapData.tiles[r + dr]?.[q + dq];
      if (!tile) continue;
      const distance = hexDistance({ q, r }, { q: tile.x, r: tile.y });
      const proximity = distance <= 1 ? 1.5 : distance === 2 ? 1 : 0.65;
      if (tile.type === TileType.Plains || tile.type === TileType.Meadow) {
        score += 3 * proximity;
        workable += 1;
      } else if (tile.type === TileType.Forest || tile.type === TileType.Jungle) {
        score += 2 * proximity;
        workable += 1;
      } else if (tile.type === TileType.Desert) {
        score -= 1.5 * proximity;
        deserts += 1;
        workable += 1;
      } else if (tile.type === TileType.Mountain || tile.type === TileType.Ice) {
        score -= 2.5 * proximity;
        mountains += 1;
      } else if (tile.type === TileType.Coast) {
        score += 0.25;
      }
      if (tile.resourceId) score += 2.5 * proximity;
    }
  }
  if (workable < 14 || mountains > 10 || deserts > 12) return -100;
  return score + workable * 0.35;
}

export function calculateMinimumStartDistance(
  width: number,
  height: number,
  land: readonly (readonly boolean[])[],
  nationCount: number,
): number {
  const preferred = width >= 120 ? 12 : width >= 100 ? 10 : 8;
  const capacity = Math.floor(Math.sqrt(Math.max(1, countLand(land) / nationCount)) * 0.72);
  return Math.max(5, Math.min(preferred, capacity));
}

function toMapData(terrain: TileType[][], width: number, height: number): MapData {
  return {
    width,
    height,
    tileSize: MAP_TILE_SIZE,
    tiles: terrain.map((row, r) => row.map((type, q) => ({ x: q, y: r, type }))),
  };
}

function findExistingLand(land: boolean[][], rng: SeededRandom, allowed: (coord: Coord) => boolean = () => true): Coord | null {
  const width = land[0]!.length;
  const height = land.length;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const coord = { q: rng.integer(EDGE_MARGIN, width - EDGE_MARGIN - 1), r: rng.integer(EDGE_MARGIN, height - EDGE_MARGIN - 1) };
    if (land[coord.r]![coord.q] && allowed(coord)) return coord;
  }
  return null;
}

function hasDifferentRegionNearby(labels: number[][], coord: Coord, label: number, range: number): boolean {
  for (let dq = -range; dq <= range; dq += 1) {
    for (let dr = Math.max(-range, -dq - range); dr <= Math.min(range, -dq + range); dr += 1) {
      const other = labels[coord.r + dr]?.[coord.q + dq] ?? -1;
      if (other >= 0 && other !== label) return true;
    }
  }
  return false;
}

function hasLandNearby(land: boolean[][], coord: Coord, range: number): boolean {
  for (let dq = -range; dq <= range; dq += 1) {
    for (let dr = Math.max(-range, -dq - range); dr <= Math.min(range, -dq + range); dr += 1) {
      if (land[coord.r + dr]?.[coord.q + dq]) return true;
    }
  }
  return false;
}

function countNeighbors(q: number, r: number, width: number, height: number, predicate: (q: number, r: number) => boolean): number {
  let count = 0;
  for (const [dq, dr] of DIRECTIONS) {
    const nq = q + dq;
    const nr = r + dr;
    if (nq >= 0 && nr >= 0 && nq < width && nr < height && predicate(nq, nr)) count += 1;
  }
  return count;
}

function countLand(land: readonly (readonly boolean[])[]): number {
  return land.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

function isBaseTerrain(type: TileType): boolean {
  return type === TileType.Plains || type === TileType.Meadow;
}

function latitude(r: number, height: number): number {
  const normalized = height <= 1 ? 0.5 : r / (height - 1);
  return Math.abs(normalized - 0.5) * 2;
}

function profileName(type: RandomMapType): string {
  return type === 'continents' ? 'Continents' : type === 'archipelago' ? 'Archipelago' : 'Heartland';
}

function buildGeneratedMapKey(
  config: RandomScenarioConfig,
  weights: ReturnType<typeof normalizeTerrainWeights>,
): string {
  const identity = [
    ...config.nations.map((nation) => nation.id).sort(),
    config.featureCount,
    config.barbarianCampCount,
    config.addStartingScout,
    config.addStartingWarrior,
    ...Object.entries(weights).map(([type, weight]) => `${type}:${weight}`),
  ].join('|');
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `generated_${config.mapType}_${config.width}x${config.height}_${config.seed}_${(hash >>> 0).toString(36)}`;
}

function key(q: number, r: number): string {
  return `${q},${r}`;
}

interface Coord {
  q: number;
  r: number;
}
