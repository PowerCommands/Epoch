import type { Unit } from '../entities/Unit';
import type { WorldCouncilEnactedResolution } from '../types/worldCouncil';

/** Small national land contingents; cargo, strategic weapons and covert forces cannot be pledged. */
export function isEligiblePeacekeepingUnit(unit: Unit): boolean {
  return Math.max(unit.unitType.baseStrength, unit.unitType.rangedStrength ?? 0) > 0
    && !unit.carriedByUnitId && !unit.unitType.isNaval
    && !['air', 'covert', 'civilian', 'recon'].includes(unit.unitType.category)
    && !unit.unitType.isInsurgentForce
    && !['atomic_bomb', 'nuclear_missile', 'guided_missile'].includes(unit.unitType.id);
}

export function isPeacekeepingAttackAllowed(
  mission: WorldCouncilEnactedResolution | undefined,
  territoryOwnerId: string | undefined,
  targetUnitOwnerId: string | undefined,
): boolean {
  return !mission || (territoryOwnerId === mission.targetNationId
    && targetUnitOwnerId !== undefined && targetUnitOwnerId === mission.secondaryTargetNationId);
}
