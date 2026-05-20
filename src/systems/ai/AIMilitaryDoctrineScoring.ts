import type { UnitType } from '../../entities/UnitType';
import type { AIMilitaryDoctrine } from '../../types/aiMilitaryDoctrine';
import { getMilitaryUnitRole, type MilitaryUnitRole } from '../../utils/unitRoleUtils';
import { getEraIndex } from '../../data/eraTimeline';

export function getDoctrineRoleWeight(doctrine: AIMilitaryDoctrine, role: MilitaryUnitRole): number {
  switch (role) {
    case 'melee':      return doctrine.preferredRoles.melee;
    case 'ranged':     return doctrine.preferredRoles.ranged;
    case 'mounted':    return doctrine.preferredRoles.mounted;
    case 'siege':      return doctrine.preferredRoles.siege;
    case 'navalMelee': return doctrine.preferredRoles.navalMelee;
    case 'navalRanged': return doctrine.preferredRoles.navalRanged;
    case 'air':        return doctrine.preferredRoles.air;
    case 'unknown':    return 1.0;
  }
}

/**
 * Returns a relative score for selecting between military unit candidates.
 * Composition-awareness is handled externally via AIMilitaryDoctrineEvaluator.getRoleDeficitMultiplier.
 */
export function scoreMilitaryUnitCandidate(
  unitType: UnitType,
  doctrine: AIMilitaryDoctrine,
  nationEraIndex: number,
): number {
  const role = getMilitaryUnitRole(unitType);
  const roleWeight = getDoctrineRoleWeight(doctrine, role);

  // Use effective offensive strength: ranged units score by rangedStrength
  const effectiveStrength = Math.max(unitType.baseStrength, unitType.rangedStrength ?? 0);
  const upkeep = unitType.upkeepGold ?? 1;
  const strengthEfficiency = effectiveStrength / Math.max(1, upkeep);

  let qualityScore = strengthEfficiency * doctrine.qualityBias;
  if (role === 'navalRanged') {
    const rangedStr = unitType.rangedStrength ?? 0;
    const attackRange = unitType.range ?? 1;
    const movement = unitType.movementPoints ?? 1;
    qualityScore += rangedStr * NAVAL_RANGED_STR_WEIGHT
      + attackRange * NAVAL_RANGE_WEIGHT
      + movement * NAVAL_MOVEMENT_WEIGHT;
  }
  // Scale by 100 so quantity and quality are in comparable ranges
  const quantityScore = (100 / Math.max(1, unitType.productionCost)) * doctrine.quantityBias;

  const unitEraIndex = getEraIndex(unitType.era);
  const eraGap = nationEraIndex - unitEraIndex;
  // Old units become progressively less attractive; never impossible to build
  const eraMultiplier = eraGap > 0 ? Math.max(0.15, 1 - eraGap * 0.35) : 1.0;

  return roleWeight
    * (qualityScore * 0.7 + quantityScore * 0.3)
    * eraMultiplier;
}

const NAVAL_RANGED_STR_WEIGHT = 0.5;
const NAVAL_RANGE_WEIGHT = 1.0;
const NAVAL_MOVEMENT_WEIGHT = 0.25;

/** True for doctrines that strongly prefer naval units. */
export function isMaritimeDoctrine(doctrine: AIMilitaryDoctrine): boolean {
  return doctrine.preferredRoles.navalMelee > 1.3 || doctrine.preferredRoles.navalRanged > 1.3;
}
