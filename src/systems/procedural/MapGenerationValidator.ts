import { isResourceAllowedOnTile } from '../../data/naturalResources';
import { BARBARIAN_CAMP_BUILDING_ID } from '../../data/barbarians';
import { ScenarioLoader } from '../ScenarioLoader';
import { TileType } from '../../types/map';
import type { ScenarioData } from '../../types/scenario';
import {
  RANDOM_CAMP_MIN_CAMP_DISTANCE,
  RANDOM_CAMP_MIN_START_DISTANCE,
  RANDOM_STARTING_UNIT_MAX_DISTANCE,
  type GeneratedScenarioMetadata,
  type MapGenerationValidationResult,
} from './RandomScenarioTypes';

const DIRECTIONS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
] as const;

export const MIN_ARCHIPELAGO_START_ISLAND_TILES = 32;

export class MapGenerationValidator {
  static validate(
    scenario: ScenarioData,
    metadata: GeneratedScenarioMetadata,
  ): MapGenerationValidationResult {
    const errors: string[] = [];
    const { width, height } = scenario.map;
    if (width !== metadata.width || height !== metadata.height) {
      errors.push(`Expected ${metadata.width}x${metadata.height}, got ${width}x${height}.`);
    }
    if (scenario.map.tiles.length !== width * height) {
      errors.push('Scenario tile count does not match its dimensions.');
    }
    const tileCoords = new Set<string>();
    for (const tile of scenario.map.tiles) {
      if (!Number.isInteger(tile.q) || !Number.isInteger(tile.r)
        || tile.q < 0 || tile.r < 0 || tile.q >= width || tile.r >= height) {
        errors.push(`Tile coordinate ${tile.q},${tile.r} is outside the generated map.`);
        continue;
      }
      const tileKey = coordKey(tile.q, tile.r);
      if (tileCoords.has(tileKey)) errors.push(`Generated map contains duplicate tile ${tileKey}.`);
      tileCoords.add(tileKey);
    }

    let parsed: ReturnType<typeof ScenarioLoader.parse> | null = null;
    try {
      parsed = ScenarioLoader.parse(scenario);
    } catch (error) {
      errors.push(`ScenarioLoader rejected generated data: ${(error as Error).message}`);
    }
    if (!parsed) return { valid: false, errors };

    const landCount = parsed.mapData.tiles.flat().filter((tile) => !isWater(tile.type)).length;
    if (landCount < Math.floor(width * height * 0.15)) errors.push('Generated map has too little meaningful land.');
    if (scenario.cities.length !== 0) errors.push('Random scenarios must not contain starting cities.');

    const nationIds = new Set(scenario.nations.map((nation) => nation.id));
    if (nationIds.size !== scenario.nations.length || nationIds.size === 0) {
      errors.push('Participating nation ids must be non-empty and unique.');
    }

    const starts: Array<{ nationId: string; q: number; r: number }> = [];
    const occupiedUnitTiles = new Set<string>();
    for (const nation of scenario.nations) {
      const settlers = scenario.units.filter((unit) => unit.nationId === nation.id && unit.unitTypeId === 'settler');
      const scouts = scenario.units.filter((unit) => unit.nationId === nation.id && unit.unitTypeId === 'scout');
      const warriors = scenario.units.filter((unit) => unit.nationId === nation.id && unit.unitTypeId === 'warrior');
      const otherUnits = scenario.units.filter((unit) => unit.nationId === nation.id
        && !['settler', 'scout', 'warrior'].includes(unit.unitTypeId));
      if (settlers.length !== 1) errors.push(`${nation.id} must receive exactly one Settler.`);
      if (scouts.length !== Number(metadata.addStartingScout)) errors.push(`${nation.id} has the wrong number of starting Scouts.`);
      if (warriors.length !== Number(metadata.addStartingWarrior)) errors.push(`${nation.id} has the wrong number of starting Warriors.`);
      if (otherUnits.length > 0) errors.push(`${nation.id} received an unsupported starting unit.`);
      const settler = settlers[0];
      if (!settler) continue;
      const tile = parsed.mapData.tiles[settler.r]?.[settler.q];
      if (!tile || !isValidStartTerrain(tile.type)) errors.push(`${nation.id} has an invalid start tile.`);
      if (nation.startTerritoryCenter.q !== settler.q || nation.startTerritoryCenter.r !== settler.r) {
        errors.push(`${nation.id} start territory does not match its Settler.`);
      }
      starts.push({ nationId: nation.id, q: settler.q, r: settler.r });
      for (const unit of [...settlers, ...scouts, ...warriors]) {
        const unitTile = parsed.mapData.tiles[unit.r]?.[unit.q];
        const unitKey = coordKey(unit.q, unit.r);
        if (!unitTile || !isValidStartTerrain(unitTile.type)) errors.push(`${nation.id} has a starting unit on invalid terrain.`);
        if (occupiedUnitTiles.has(unitKey)) errors.push(`Starting units overlap at ${unitKey}.`);
        occupiedUnitTiles.add(unitKey);
        if (unit.unitTypeId !== 'settler' && hexDistance(unit, settler) > RANDOM_STARTING_UNIT_MAX_DISTANCE) {
          errors.push(`${nation.id} has an optional starting unit too far from its Settler.`);
        }
      }
    }
    if (scenario.units.some((unit) => !nationIds.has(unit.nationId))) errors.push('A starting unit belongs to an unknown nation.');

    for (let first = 0; first < starts.length; first += 1) {
      for (let second = first + 1; second < starts.length; second += 1) {
        if (hexDistance(starts[first]!, starts[second]!) < metadata.minimumStartDistance) {
          errors.push(`${starts[first]!.nationId} and ${starts[second]!.nationId} start too close together.`);
        }
      }
    }

    if (metadata.mapType === 'archipelago') {
      const componentSizes = buildLandComponentSizes(parsed.mapData.tiles.map((row) => row.map((tile) => tile.type)));
      for (const start of starts) {
        const size = componentSizes.get(coordKey(start.q, start.r)) ?? 0;
        if (size < MIN_ARCHIPELAGO_START_ISLAND_TILES) {
          errors.push(`${start.nationId} starts on an unusably small island (${size} tiles).`);
        }
      }
    }

    const camps = parsed.mapData.tiles.flat().filter((tile) => tile.buildingId === BARBARIAN_CAMP_BUILDING_ID);
    if (camps.length !== metadata.barbarianCampCount) {
      errors.push(`Expected ${metadata.barbarianCampCount} Barbarian Camps, got ${camps.length}.`);
    }
    const campTiles = new Set<string>();
    const campPressure = starts.map(() => 0);
    for (const camp of camps) {
      const campKey = coordKey(camp.x, camp.y);
      if (campTiles.has(campKey)) errors.push(`Duplicate Barbarian Camp at ${campKey}.`);
      campTiles.add(campKey);
      if (!isValidCampTerrain(camp.type)) errors.push(`Barbarian Camp at ${campKey} is on invalid terrain.`);
      if (occupiedUnitTiles.has(campKey)) errors.push(`Barbarian Camp at ${campKey} overlaps a starting unit.`);
      const campCoord = { q: camp.x, r: camp.y };
      if (starts.some((start) => hexDistance(start, campCoord) < RANDOM_CAMP_MIN_START_DISTANCE)) {
        errors.push(`Barbarian Camp at ${campKey} is too close to a national start.`);
      }
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      starts.forEach((start, index) => {
        const distance = hexDistance(start, campCoord);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = index;
        }
      });
      if (campPressure.length > 0) campPressure[nearest]! += 1;
    }
    for (let first = 0; first < camps.length; first += 1) {
      for (let second = first + 1; second < camps.length; second += 1) {
        if (hexDistance(
          { q: camps[first]!.x, r: camps[first]!.y },
          { q: camps[second]!.x, r: camps[second]!.y },
        ) < RANDOM_CAMP_MIN_CAMP_DISTANCE) {
          errors.push('Generated Barbarian Camps are too close together.');
        }
      }
    }
    if (campPressure.length > 0 && Math.max(...campPressure) - Math.min(...campPressure) > 1) {
      errors.push('Barbarian Camps are not distributed fairly between national starts.');
    }

    for (const tile of parsed.mapData.tiles.flat()) {
      if (tile.resourceId && !isResourceAllowedOnTile(tile.resourceId, tile.type)) {
        errors.push(`Resource ${tile.resourceId} is invalid on ${tile.type} at ${tile.x},${tile.y}.`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export function isValidStartTerrain(type: TileType): boolean {
  return type !== TileType.Ocean
    && type !== TileType.Coast
    && type !== TileType.Ice
    && type !== TileType.Mountain;
}

export function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function buildLandComponentSizes(types: readonly (readonly TileType[])[]): Map<string, number> {
  const height = types.length;
  const width = types[0]?.length ?? 0;
  const seen = new Set<string>();
  const result = new Map<string, number>();
  for (let r = 0; r < height; r += 1) {
    for (let q = 0; q < width; q += 1) {
      const originKey = coordKey(q, r);
      if (seen.has(originKey) || isWater(types[r]?.[q] ?? TileType.Ocean)) continue;
      const component: Array<{ q: number; r: number }> = [];
      const queue = [{ q, r }];
      seen.add(originKey);
      for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index]!;
        component.push(current);
        for (const [dq, dr] of DIRECTIONS) {
          const next = { q: current.q + dq, r: current.r + dr };
          const key = coordKey(next.q, next.r);
          if (next.q < 0 || next.r < 0 || next.q >= width || next.r >= height || seen.has(key)) continue;
          if (isWater(types[next.r]?.[next.q] ?? TileType.Ocean)) continue;
          seen.add(key);
          queue.push(next);
        }
      }
      for (const tile of component) result.set(coordKey(tile.q, tile.r), component.length);
    }
  }
  return result;
}

function isWater(type: TileType): boolean {
  return type === TileType.Ocean || type === TileType.Coast;
}

function isValidCampTerrain(type: TileType): boolean {
  return type === TileType.Plains
    || type === TileType.Meadow
    || type === TileType.Beach
    || type === TileType.Forest
    || type === TileType.Desert
    || type === TileType.Jungle;
}

function coordKey(q: number, r: number): string {
  return `${q},${r}`;
}
