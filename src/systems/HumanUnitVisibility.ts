import type { Unit } from '../entities/Unit';
import type { IGridSystem } from './grid/IGridSystem';

/**
 * Human-player-only unit visibility filter layered on top of map visibility.
 *
 * This deliberately does not alter UnitManager contents or expose a nation-
 * agnostic perception API: AI systems continue to see the complete simulation.
 */
export function passesHumanCovertDetection(
  unit: Unit,
  humanNationId: string,
  humanUnits: readonly Unit[],
  gridSystem: Pick<IGridSystem, 'getDistance'>,
): boolean {
  if (unit.ownerId === humanNationId || unit.unitType.covertDetectable !== true) return true;

  const target = { x: unit.tileX, y: unit.tileY };
  return humanUnits.some((detector) => {
    const range = detector.unitType.covertDetectionRange;
    return range !== undefined
      && range >= 0
      && gridSystem.getDistance({ x: detector.tileX, y: detector.tileY }, target) <= range;
  });
}

/** Compose map visibility and covert detection for the human map renderer. */
export function canRenderUnitToHuman(
  unit: Unit,
  mapVisible: boolean,
  humanNationId: string,
  humanUnits: readonly Unit[],
  gridSystem: Pick<IGridSystem, 'getDistance'>,
  revealCovertUnits = false,
): boolean {
  if (revealCovertUnits && unit.unitType.covertDetectable === true) return true;
  return mapVisible && passesHumanCovertDetection(unit, humanNationId, humanUnits, gridSystem);
}
