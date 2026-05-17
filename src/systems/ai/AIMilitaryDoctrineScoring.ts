import type { UnitType } from '../../entities/UnitType';
import type { Unit } from '../../entities/Unit';
import type { AIMilitaryDoctrine } from '../../types/aiMilitaryDoctrine';
import { getMilitaryUnitRole, type MilitaryUnitRole } from '../../utils/unitRoleUtils';
import { getEraIndex } from '../../data/eraTimeline';

export interface ArmyRoleProfile {
  readonly roleCounts: Partial<Record<MilitaryUnitRole, number>>;
  readonly totalCombatUnits: number;
}

export function buildArmyRoleProfile(units: readonly Unit[]): ArmyRoleProfile {
  const roleCounts: Partial<Record<MilitaryUnitRole, number>> = {};
  let totalCombatUnits = 0;

  for (const unit of units) {
    if (unit.unitType.category === 'leader') continue;
    if (unit.unitType.baseStrength <= 0) continue;
    const role = getMilitaryUnitRole(unit.unitType);
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    totalCombatUnits++;
  }

  return { roleCounts, totalCombatUnits };
}

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
 * Higher scores indicate better fit given the nation's doctrine, current era, and army composition.
 */
export function scoreMilitaryUnitCandidate(
  unitType: UnitType,
  doctrine: AIMilitaryDoctrine,
  nationEraIndex: number,
  armyProfile: ArmyRoleProfile,
): number {
  const role = getMilitaryUnitRole(unitType);
  const roleWeight = getDoctrineRoleWeight(doctrine, role);

  // Use effective offensive strength: ranged units score by rangedStrength
  const effectiveStrength = Math.max(unitType.baseStrength, unitType.rangedStrength ?? 0);
  const upkeep = unitType.upkeepGold ?? 1;
  const strengthEfficiency = effectiveStrength / Math.max(1, upkeep);

  const qualityScore = strengthEfficiency * doctrine.qualityBias;
  // Scale by 100 so quantity and quality are in comparable ranges
  const quantityScore = (100 / Math.max(1, unitType.productionCost)) * doctrine.quantityBias;

  const unitEraIndex = getEraIndex(unitType.era);
  const eraGap = nationEraIndex - unitEraIndex;
  // Old units become progressively less attractive; never impossible to build
  const eraMultiplier = eraGap > 0 ? Math.max(0.15, 1 - eraGap * 0.35) : 1.0;

  const compositionMultiplier = getCompositionMultiplier(role, armyProfile);

  return roleWeight
    * (qualityScore * 0.7 + quantityScore * 0.3)
    * eraMultiplier
    * compositionMultiplier;
}

function getCompositionMultiplier(
  role: MilitaryUnitRole,
  { roleCounts, totalCombatUnits }: ArmyRoleProfile,
): number {
  if (totalCombatUnits === 0) return 1.0;
  const roleCount = roleCounts[role] ?? 0;
  const roleShare = roleCount / totalCombatUnits;
  // Heavily over-represented role gets penalized
  if (roleShare > 0.6) return 0.7;
  // Missing role gets a slight boost to encourage diversity
  if (roleCount === 0) return 1.4;
  return 1.0;
}

/** True for doctrines that strongly prefer naval units. */
export function isMaritimeDoctrine(doctrine: AIMilitaryDoctrine): boolean {
  return doctrine.preferredRoles.navalMelee > 1.3 || doctrine.preferredRoles.navalRanged > 1.3;
}
