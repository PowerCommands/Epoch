import type { City } from '../entities/City';
import type { IdeologyDefinition } from '../types/ideology';
import type { MapData, Tile } from '../types/map';
import type { CityManager } from './CityManager';
import type { DiplomacyManager, DiplomacyRelation, DiplomaticMemoryValues } from './DiplomacyManager';
import type { NationManager } from './NationManager';
import type { AIMilitaryEvaluationSystem } from './ai/AIMilitaryEvaluationSystem';
import type { IGridSystem } from './grid/IGridSystem';
import { getLeaderIdeologyByNationId } from '../data/leaders';
import {
  describeIdeologyCompatibility,
  getIdeologyCompatibility,
} from '../data/ideologyCompatibility';

export type BorderPressureLevel = 'mild' | 'strong' | 'severe';

export interface BorderPressureEvent {
  readonly nationAId: string;
  readonly nationBId: string;
  readonly nationAName: string;
  readonly nationBName: string;
  readonly pressureLevel: BorderPressureLevel;
  readonly pressureScore: number;
  readonly closestCityDistance: number | null;
  readonly adjacentBorderCount: number;
  readonly culturalBorderCount: number;
  readonly compatibility: number;
  readonly compatibilityLabel: string;
  readonly delta: BorderPressureDelta;
}

interface BorderPressureDelta {
  readonly trust?: number;
  readonly fear?: number;
  readonly hostility?: number;
}

interface BorderPressureSignals {
  readonly closestCityDistance: number | null;
  readonly adjacentBorderCount: number;
  readonly culturalBorderCount: number;
}

const PRESSURE_INTERVAL_ROUNDS = 5;
const MIN_VALUE = 0;
const MAX_VALUE = 100;

export class BorderPressureSystem {
  private readonly listeners: Array<(event: BorderPressureEvent) => void> = [];

  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly militaryEvaluationSystem: AIMilitaryEvaluationSystem,
    private readonly haveMet: (a: string, b: string) => boolean,
  ) {}

  onPressure(listener: (event: BorderPressureEvent) => void): void {
    this.listeners.push(listener);
  }

  handleRoundStart(round: number): void {
    if (round % PRESSURE_INTERVAL_ROUNDS !== 0) return;

    const cityOwnerIds = unique(this.cityManager.getAllCities().map((city) => city.ownerId));
    for (let i = 0; i < cityOwnerIds.length; i++) {
      for (let j = i + 1; j < cityOwnerIds.length; j++) {
        const nationAId = cityOwnerIds[i];
        const nationBId = cityOwnerIds[j];
        if (!this.haveMet(nationAId, nationBId)) continue;

        const relation = this.diplomacyManager.getRelation(nationAId, nationBId);
        const signals = this.evaluateSignals(nationAId, nationBId);
        const pressureScore = getPressureScore(signals);
        const pressureLevel = getPressureLevel(pressureScore);
        if (pressureLevel === null) continue;

        const compatibility = this.getCompatibility(nationAId, nationBId);
        const delta = getBorderPressureDelta(
          pressureLevel,
          compatibility,
          relation,
          getIdeologyPressureModifier(nationAId),
          getIdeologyPressureModifier(nationBId),
          this.militaryEvaluationSystem.compareMilitaryStrength(nationAId, nationBId),
        );
        if (isEmptyDelta(delta)) continue;

        const actualDelta = this.applyDelta(nationAId, nationBId, relation, delta);
        if (isEmptyDelta(actualDelta)) continue;

        this.emitPressure({
          nationAId,
          nationBId,
          nationAName: this.nationManager.getNation(nationAId)?.name ?? nationAId,
          nationBName: this.nationManager.getNation(nationBId)?.name ?? nationBId,
          pressureLevel,
          pressureScore,
          closestCityDistance: signals.closestCityDistance,
          adjacentBorderCount: signals.adjacentBorderCount,
          culturalBorderCount: signals.culturalBorderCount,
          compatibility,
          compatibilityLabel: describeIdeologyCompatibility(compatibility),
          delta: actualDelta,
        });
      }
    }
  }

  getBorderPressureLevel(nationAId: string, nationBId: string): BorderPressureLevel | null {
    return getPressureLevel(getPressureScore(this.evaluateSignals(nationAId, nationBId)));
  }

  private evaluateSignals(nationAId: string, nationBId: string): BorderPressureSignals {
    return {
      closestCityDistance: this.getClosestCityDistance(nationAId, nationBId),
      adjacentBorderCount: this.countAdjacentBorders(nationAId, nationBId, 'ownerId'),
      culturalBorderCount: this.countAdjacentBorders(nationAId, nationBId, 'cultureOwnerId'),
    };
  }

  private getClosestCityDistance(nationAId: string, nationBId: string): number | null {
    const citiesA = this.cityManager.getCitiesByOwner(nationAId);
    const citiesB = this.cityManager.getCitiesByOwner(nationBId);
    let closest: number | null = null;

    for (const cityA of citiesA) {
      for (const cityB of citiesB) {
        const distance = getCityDistance(this.gridSystem, cityA, cityB);
        if (closest === null || distance < closest) closest = distance;
      }
    }
    return closest;
  }

  private countAdjacentBorders(
    nationAId: string,
    nationBId: string,
    ownerField: 'ownerId' | 'cultureOwnerId',
  ): number {
    let count = 0;
    const seen = new Set<string>();

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile[ownerField] !== nationAId) continue;
        for (const neighbor of this.gridSystem.getNeighbors(tile, this.mapData)) {
          if (neighbor[ownerField] !== nationBId) continue;
          const key = getTilePairKey(tile, neighbor);
          if (seen.has(key)) continue;
          seen.add(key);
          count++;
        }
      }
    }
    return count;
  }

  private getCompatibility(nationAId: string, nationBId: string): number {
    const ideologyA = getLeaderIdeologyByNationId(nationAId);
    const ideologyB = getLeaderIdeologyByNationId(nationBId);
    return getIdeologyCompatibility(ideologyA.id, ideologyB.id);
  }

  private applyDelta(
    nationAId: string,
    nationBId: string,
    relation: DiplomacyRelation,
    delta: BorderPressureDelta,
  ): BorderPressureDelta {
    const next: DiplomaticMemoryValues = {
      trust: clamp(relation.trust + (delta.trust ?? 0)),
      fear: clamp(relation.fear + (delta.fear ?? 0)),
      hostility: clamp(relation.hostility + (delta.hostility ?? 0)),
      affinity: relation.affinity,
    };
    this.diplomacyManager.setMemoryValues(nationAId, nationBId, next);
    return {
      trust: next.trust - relation.trust,
      fear: next.fear - relation.fear,
      hostility: next.hostility - relation.hostility,
    };
  }

  private emitPressure(event: BorderPressureEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function getPressureScore(signals: BorderPressureSignals): number {
  let score = 0;
  if (signals.closestCityDistance !== null) {
    if (signals.closestCityDistance <= 3) score += 6;
    else if (signals.closestCityDistance <= 6) score += 4;
    else if (signals.closestCityDistance <= 10) score += 2;
  }
  score += Math.min(4, signals.adjacentBorderCount);
  score += Math.min(2, signals.culturalBorderCount);
  return score;
}

function getPressureLevel(score: number): BorderPressureLevel | null {
  if (score >= 8) return 'severe';
  if (score >= 5) return 'strong';
  if (score >= 2) return 'mild';
  return null;
}

function getBorderPressureDelta(
  pressureLevel: BorderPressureLevel,
  compatibility: number,
  relation: DiplomacyRelation,
  ideologyAModifier: number,
  ideologyBModifier: number,
  militaryComparison: 'weaker' | 'equal' | 'stronger',
): BorderPressureDelta {
  const basePressure = getBasePressureValue(pressureLevel);
  const ideologyCompatibilityModifier = getIdeologyCompatibilityModifier(compatibility);
  const cooperationModifier = getCooperationModifier(relation);
  const ideologyModifier = (ideologyAModifier + ideologyBModifier) / 2;
  const adjustedPressure = basePressure * ideologyCompatibilityModifier * cooperationModifier * ideologyModifier;

  if (adjustedPressure < 1) return {};

  const trust = adjustedPressure >= 1 ? -1 : undefined;
  const hostility = adjustedPressure >= 2 ? 1 : undefined;
  const fear = pressureLevel === 'severe' && militaryComparison === 'weaker' && adjustedPressure >= 2.5
    ? 1
    : undefined;
  return { trust, hostility, fear };
}

function getBasePressureValue(pressureLevel: BorderPressureLevel): number {
  switch (pressureLevel) {
    case 'mild':
      return 1;
    case 'strong':
      return 2;
    case 'severe':
      return 3;
  }
}

function getIdeologyCompatibilityModifier(compatibility: number): number {
  if (compatibility >= 25) return 0.5;
  if (compatibility >= 10) return 0.75;
  if (compatibility <= -25) return 1.5;
  if (compatibility <= -10) return 1.25;
  return 1;
}

function getCooperationModifier(relation: DiplomacyRelation): number {
  if (relation.state === 'WAR') return 1;
  let modifier = 1;
  if (relation.tradeRelations) modifier -= 0.25;
  if (relation.openBordersFromAToB && relation.openBordersFromBToA) modifier -= 0.2;
  if (relation.embassyFromAToB && relation.embassyFromBToA) modifier -= 0.15;
  if (relation.lastWarDeclarationTurn === null) modifier -= 0.1;
  return Math.max(0.45, modifier);
}

function getIdeologyPressureModifier(nationId: string): number {
  const ideology = getLeaderIdeologyByNationId(nationId);
  return getIdeologyDefinitionPressureModifier(ideology);
}

function getIdeologyDefinitionPressureModifier(ideology: IdeologyDefinition): number {
  const aggression = Math.max(0, ideology.warBias) + Math.max(0, ideology.expansionBias);
  const openness = Math.max(0, ideology.diplomacyBias) + Math.max(0, ideology.openBordersBias);
  return clampToRange(1 + aggression / 120 - openness / 160, 0.75, 1.25);
}

function getCityDistance(gridSystem: IGridSystem, cityA: City, cityB: City): number {
  return gridSystem.getDistance(
    { x: cityA.tileX, y: cityA.tileY },
    { x: cityB.tileX, y: cityB.tileY },
  );
}

function getTilePairKey(tileA: Tile, tileB: Tile): string {
  const keyA = `${tileA.x},${tileA.y}`;
  const keyB = `${tileB.x},${tileB.y}`;
  return keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isEmptyDelta(delta: BorderPressureDelta): boolean {
  return (delta.trust ?? 0) === 0 &&
    (delta.fear ?? 0) === 0 &&
    (delta.hostility ?? 0) === 0;
}

function clamp(value: number): number {
  return clampToRange(value, MIN_VALUE, MAX_VALUE);
}

function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
