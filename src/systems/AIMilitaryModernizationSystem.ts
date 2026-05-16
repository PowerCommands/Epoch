import type { Unit } from '../entities/Unit';
import type { UnitType } from '../entities/UnitType';
import type { AIMilitaryDoctrine } from '../types/aiMilitaryDoctrine';
import { getDoctrineRoleWeight } from './ai/AIMilitaryDoctrineScoring';
import { getMilitaryUnitRole } from '../utils/unitRoleUtils';
import { getEraIndex } from '../data/eraTimeline';

/** Gold reserve the AI keeps before spending on upgrades. */
export function getModernizationGoldReserve(doctrine: AIMilitaryDoctrine): number {
  return Math.min(800, Math.max(100, Math.round(150 * doctrine.modernizationBias)));
}

/** Maximum upgrades the AI may perform in a single turn. */
export function getModernizationMaxUpgrades(doctrine: AIMilitaryDoctrine): number {
  if (doctrine.modernizationBias >= 1.4) return 3;
  if (doctrine.modernizationBias >= 1.2) return 2;
  return 1;
}

/** Score for upgrading a unit. Higher = upgrade this first. */
export function scoreUpgradeCandidate(
  unit: Unit,
  target: UnitType,
  doctrine: AIMilitaryDoctrine,
): number {
  const oldStrength = Math.max(unit.unitType.baseStrength, unit.unitType.rangedStrength ?? 0, 1);
  const newStrength = Math.max(target.baseStrength, target.rangedStrength ?? 0, 1);

  const strengthRatio = oldStrength / newStrength;
  const strengthGain = newStrength - oldStrength;

  const oldEra = getEraIndex(unit.unitType.era);
  const newEra = getEraIndex(target.era);
  const eraGap = newEra - oldEra;

  let score = strengthRatio * 40 + strengthGain * 0.5 + eraGap * 25;
  score *= doctrine.modernizationBias * doctrine.qualityBias / Math.max(0.5, doctrine.quantityBias);

  const role = getMilitaryUnitRole(unit.unitType);
  const roleWeight = getDoctrineRoleWeight(doctrine, role);
  score *= roleWeight;

  return score;
}
