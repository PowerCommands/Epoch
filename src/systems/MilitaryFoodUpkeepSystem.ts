import type { UnitManager } from './UnitManager';
import { calculateMilitaryFoodUpkeep } from './MilitaryFoodUpkeep';

/**
 * Computes a nation's total military food upkeep — the summed
 * {@link UnitType.foodUpkeep} of every unit it owns (civilian units contribute
 * zero). Human and AI nations use this identical, modifier-free calculation.
 *
 * The upkeep is consumed from the national population-growth food pool by
 * {@link ResourceSystem}; this system only reports the number and holds no
 * state of its own, so it needs no save/load handling.
 */
export class MilitaryFoodUpkeepSystem {
  constructor(private readonly unitManager: UnitManager) {}

  /** Sum of food upkeep for all units belonging to the nation. */
  getMilitaryFoodUpkeep(nationId: string): number {
    return calculateMilitaryFoodUpkeep(this.unitManager.getUnitsByOwner(nationId));
  }
}
