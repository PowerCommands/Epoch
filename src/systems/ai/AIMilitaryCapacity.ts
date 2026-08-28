import { getAIStrategyById } from '../../data/aiStrategies';
import { getLeaderMilitaryDoctrineByNationId } from '../../data/leaders';
import type { Unit } from '../../entities/Unit';

/** Canonical military count used by AI production capacity and Happiness. */
export function countMilitaryUnits(units: readonly Unit[]): number {
  return units.filter((unit) => unit.unitType.baseStrength > 0).length;
}

/** Canonical effective cap after the active strategy and doctrine modifier. */
export function getEffectiveMilitaryUnitCap(nationId: string, strategyId: string | undefined): number {
  const strategy = getAIStrategyById(strategyId);
  const doctrine = getLeaderMilitaryDoctrineByNationId(nationId);
  return Math.max(
    Math.ceil(strategy.military.maxUnits * doctrine.militaryBudget.maxUnitsMultiplier),
    1,
  );
}

export function calculateMilitaryOverCapUnhappiness(militaryCount: number, effectiveCap: number): number {
  return Math.max(0, militaryCount - effectiveCap);
}
