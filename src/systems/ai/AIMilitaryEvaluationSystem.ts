import type { UnitManager } from '../UnitManager';
import type { CityManager } from '../CityManager';
import { CITY_BASE_HEALTH, CITY_BASE_DEFENSE } from '../../data/cities';

// Military evaluation gives diplomacy a basic sense of relative power.
// It does not change combat rules; it only informs AI decisions.

export type MilitaryComparison = 'weaker' | 'equal' | 'stronger';

export interface MilitaryStrengthBreakdown {
  readonly unitStrength: number;
  readonly cityStrength: number;
  readonly totalStrength: number;
}

const STRONGER_RATIO = 1.25;
const WEAKER_RATIO = 0.75;

export class AIMilitaryEvaluationSystem {
  constructor(
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
  ) {}

  getMilitaryStrength(nationId: string): MilitaryStrengthBreakdown {
    let unitStrength = 0;
    for (const unit of this.unitManager.getUnitsByOwner(nationId)) {
      if (unit.unitType.category === 'leader') continue;
      const meleeStrength = unit.unitType.baseStrength;
      const rangedStrength = unit.unitType.rangedStrength ?? 0;
      const effectiveStrength = Math.max(meleeStrength, rangedStrength);
      if (effectiveStrength <= 0) continue; // settlers / workers contribute nothing
      const healthRatio = unit.health / unit.unitType.baseHealth;
      unitStrength += effectiveStrength * healthRatio;
    }

    let cityStrength = 0;
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const cityHealthRatio = city.health / CITY_BASE_HEALTH;
      cityStrength += CITY_BASE_DEFENSE * cityHealthRatio;
    }

    return {
      unitStrength,
      cityStrength,
      totalStrength: unitStrength + cityStrength,
    };
  }

  /**
   * Deterministic three-way comparison. Edge cases:
   *   - both zero → 'equal'
   *   - one zero, other positive → the positive side is 'stronger'
   * Otherwise we lean on the STRONGER/WEAKER ratio thresholds so small
   * fluctuations do not flip the verdict.
   */
  compareMilitaryStrength(a: string, b: string): MilitaryComparison {
    const aStrength = this.getMilitaryStrength(a).totalStrength;
    const bStrength = this.getMilitaryStrength(b).totalStrength;

    if (aStrength === 0 && bStrength === 0) return 'equal';
    if (bStrength === 0) return 'stronger';
    if (aStrength === 0) return 'weaker';

    if (aStrength >= bStrength * STRONGER_RATIO) return 'stronger';
    if (aStrength <= bStrength * WEAKER_RATIO) return 'weaker';
    return 'equal';
  }
}
