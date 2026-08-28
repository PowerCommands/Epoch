import type { City } from '../../entities/City';
import type { Unit } from '../../entities/Unit';
import { CITY_BASE_HEALTH } from '../../data/cities';
import { TileType, type MapData } from '../../types/map';
import type { GridCoord } from '../../types/grid';
import type { IGridSystem } from '../grid/IGridSystem';
import { cityHasWaterTile } from '../ProductionRules';
import { RECLAIM_TARGET_BONUS } from './reclaimCapital';

export interface NavalExpeditionTarget {
  readonly type: 'navalExpeditionTarget';
  readonly cityId: string;
  readonly cityName: string;
  readonly ownerNationId: string;
  readonly x: number;
  readonly y: number;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface NavalExpeditionTargetingParams {
  readonly nationId: string;
  readonly warEnemyNationIds: readonly string[];
  readonly allCities: readonly City[];
  readonly allUnits: readonly Unit[];
  readonly mapData: MapData;
  readonly gridSystem: IGridSystem;
  readonly homeUnderThreat: boolean;
  readonly hasRangedNavalCapability: boolean;
  /** Lost original capital to prioritize when it is a valid coastal target. */
  readonly reclaimTargetCityId?: string;
}

interface ScoredNavalExpeditionTarget extends NavalExpeditionTarget {
  readonly rawScore: number;
}

const BASE_ENEMY_COASTAL_CITY_SCORE = 40;
const DIRECT_WAR_ENEMY_BONUS = 25;
const RANGED_NAVAL_CAPABILITY_BONUS = 28;
const FAR_FROM_OUR_CITIES_BONUS = 10;
const STRONG_WATER_APPROACH_BONUS = 14;
const WEAK_DEFENSE_BONUS = 18;
const RESOURCE_VALUE_PER_TILE = 5;
const IMPROVEMENT_VALUE_PER_TILE = 3;
const CAPITAL_VALUE_BONUS = 12;
const POPULATION_VALUE_WEIGHT = 2;
const FAR_FROM_ENEMY_ARMY_BONUS = 12;
const ENEMY_MILITARY_PENALTY = 8;
const HOME_THREAT_PENALTY = 35;

const NEARBY_VALUE_RADIUS = 2;
const NEARBY_MILITARY_RADIUS = 3;
const FAR_FROM_ENEMY_ARMY_DISTANCE = 8;
const FAR_FROM_OUR_CITY_DISTANCE = 12;

export class NavalExpeditionTargetingSystem {
  getBestTarget(params: NavalExpeditionTargetingParams): NavalExpeditionTarget | null {
    return this.getRankedTargets(params)[0] ?? null;
  }

  getRankedTargets(params: NavalExpeditionTargetingParams): NavalExpeditionTarget[] {
    const warEnemyIds = new Set(params.warEnemyNationIds);
    if (warEnemyIds.size === 0) return [];

    const ownCities = params.allCities.filter((city) => city.ownerId === params.nationId);
    const enemyLandCombatUnits = params.allUnits.filter((unit) => (
      warEnemyIds.has(unit.ownerId) &&
      unit.unitType.isNaval !== true &&
      unit.unitType.baseStrength > 0
    ));

    const scored: ScoredNavalExpeditionTarget[] = [];
    for (const city of params.allCities) {
      if (!warEnemyIds.has(city.ownerId)) continue;
      if (!cityHasWaterTile(city, params.mapData)) continue;

      const target = this.scoreCity(city, ownCities, enemyLandCombatUnits, params);
      if (target.rawScore <= 0) continue;
      scored.push(target);
    }

    return scored
      .sort((a, b) => (
        b.rawScore - a.rawScore
        || a.cityName.localeCompare(b.cityName)
        || a.cityId.localeCompare(b.cityId)
      ))
      .map(({ rawScore: _rawScore, ...target }) => target);
  }

  private scoreCity(
    city: City,
    ownCities: readonly City[],
    enemyLandCombatUnits: readonly Unit[],
    params: NavalExpeditionTargetingParams,
  ): ScoredNavalExpeditionTarget {
    const reasons: string[] = ['coastal enemy city'];
    let score = BASE_ENEMY_COASTAL_CITY_SCORE;

    score += DIRECT_WAR_ENEMY_BONUS;
    reasons.push('current war enemy');

    if (params.hasRangedNavalCapability) {
      score += RANGED_NAVAL_CAPABILITY_BONUS;
      reasons.push('ranged fleet available');
    }

    const waterApproach = this.getWaterApproachScore(city, params);
    score += waterApproach.score;
    if (waterApproach.score >= STRONG_WATER_APPROACH_BONUS) reasons.push('strong water approach');

    const minOwnCityDistance = this.getMinCityDistance(city, ownCities, params.gridSystem);
    if (minOwnCityDistance >= FAR_FROM_OUR_CITY_DISTANCE) {
      score += FAR_FROM_OUR_CITIES_BONUS;
      reasons.push('long-range target');
    }

    const healthRatio = city.health / CITY_BASE_HEALTH;
    if (healthRatio < 0.7) {
      score += Math.round((1 - healthRatio) * WEAK_DEFENSE_BONUS);
      reasons.push('weak defense');
    }

    const localValue = this.getNearbyStrategicValue(city, params);
    score += localValue.score;
    if (localValue.resourceCount > 0) reasons.push('nearby resources');
    if (localValue.improvementCount > 0) reasons.push('improved coastline');

    if (city.isCapital || city.isResidenceCapital) {
      score += CAPITAL_VALUE_BONUS;
      reasons.push('strategic capital');
    }
    if (city.id === params.reclaimTargetCityId) {
      score += RECLAIM_TARGET_BONUS;
      reasons.push('lost original capital');
    }
    if (city.population > 1) score += Math.min(12, city.population * POPULATION_VALUE_WEIGHT);

    const nearbyEnemyMilitary = enemyLandCombatUnits.filter((unit) => (
      params.gridSystem.getDistance(
        { x: city.tileX, y: city.tileY },
        { x: unit.tileX, y: unit.tileY },
      ) <= NEARBY_MILITARY_RADIUS
    )).length;
    if (nearbyEnemyMilitary > 0) {
      score -= nearbyEnemyMilitary * ENEMY_MILITARY_PENALTY;
    } else {
      reasons.push('low nearby enemy military');
    }

    const nearestEnemyArmyDistance = this.getNearestUnitDistance(city, enemyLandCombatUnits, params.gridSystem);
    if (nearestEnemyArmyDistance >= FAR_FROM_ENEMY_ARMY_DISTANCE) {
      score += FAR_FROM_ENEMY_ARMY_BONUS;
      reasons.push('far from enemy land army');
    }

    if (params.homeUnderThreat) {
      score -= HOME_THREAT_PENALTY;
      reasons.push('home coast threatened');
    }

    return {
      type: 'navalExpeditionTarget',
      cityId: city.id,
      cityName: city.name,
      ownerNationId: city.ownerId,
      x: city.tileX,
      y: city.tileY,
      score: Math.round(score),
      rawScore: score,
      reasons,
    };
  }

  private getWaterApproachScore(
    city: City,
    params: NavalExpeditionTargetingParams,
  ): { score: number } {
    const cityPos = { x: city.tileX, y: city.tileY };
    const nearbyWater = params.gridSystem.getTilesInRange(
      cityPos,
      NEARBY_VALUE_RADIUS,
      params.mapData,
      { includeCenter: false },
    ).filter((tile) => tile.type === TileType.Coast || tile.type === TileType.Ocean).length;

    if (nearbyWater >= 5) return { score: STRONG_WATER_APPROACH_BONUS };
    if (nearbyWater >= 2) return { score: Math.round(STRONG_WATER_APPROACH_BONUS * 0.6) };
    return { score: 0 };
  }

  private getNearbyStrategicValue(
    city: City,
    params: NavalExpeditionTargetingParams,
  ): { score: number; resourceCount: number; improvementCount: number } {
    let resourceCount = 0;
    let improvementCount = 0;
    for (const tile of params.gridSystem.getTilesInRange(
      { x: city.tileX, y: city.tileY },
      NEARBY_VALUE_RADIUS,
      params.mapData,
      { includeCenter: true },
    )) {
      if (tile.resourceId !== undefined) resourceCount += 1;
      if (tile.improvementId !== undefined || tile.buildingId !== undefined || tile.wonderId !== undefined) {
        improvementCount += 1;
      }
    }

    return {
      score: resourceCount * RESOURCE_VALUE_PER_TILE + improvementCount * IMPROVEMENT_VALUE_PER_TILE,
      resourceCount,
      improvementCount,
    };
  }

  private getMinCityDistance(
    city: City,
    cities: readonly City[],
    gridSystem: IGridSystem,
  ): number {
    if (cities.length === 0) return Infinity;
    let best = Infinity;
    for (const other of cities) {
      const dist = gridSystem.getDistance(
        { x: city.tileX, y: city.tileY },
        { x: other.tileX, y: other.tileY },
      );
      if (dist < best) best = dist;
    }
    return best;
  }

  private getNearestUnitDistance(
    city: City,
    units: readonly Unit[],
    gridSystem: IGridSystem,
  ): number {
    if (units.length === 0) return Infinity;
    const cityPos: GridCoord = { x: city.tileX, y: city.tileY };
    let best = Infinity;
    for (const unit of units) {
      const dist = gridSystem.getDistance(cityPos, { x: unit.tileX, y: unit.tileY });
      if (dist < best) best = dist;
    }
    return best;
  }
}
