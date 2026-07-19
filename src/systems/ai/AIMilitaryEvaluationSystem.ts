import type { UnitManager } from '../UnitManager';
import type { CityManager } from '../CityManager';
import type { DiplomacyManager } from '../DiplomacyManager';
import type { AllianceManager } from '../diplomacy/AllianceManager';
import { CITY_BASE_HEALTH, CITY_BASE_DEFENSE } from '../../data/cities';

// Military evaluation gives diplomacy a basic sense of relative power.
// It does not change combat rules; it only informs AI decisions.

export type MilitaryComparison = 'weaker' | 'equal' | 'stronger';

export interface MilitaryStrengthBreakdown {
  readonly unitStrength: number;
  readonly cityStrength: number;
  readonly totalStrength: number;
}

/**
 * Alliance-aware defensive strength a would-be attacker must reckon with:
 * the defender plus the ally that defensive alliance activation would pull in.
 */
export interface DefensiveWarPowerBreakdown {
  readonly defenderPower: number;
  readonly alliancePower: number;
  readonly peacekeepingPower: number;
  readonly totalDefensivePower: number;
  readonly allianceName: string | null;
  readonly allyNationId: string | null;
}

export type PeacekeepingDefensivePowerProvider = (
  attackerNationId: string,
  defenderNationId: string,
  getMilitaryStrength: (nationId: string) => MilitaryStrengthBreakdown,
) => number;

const STRONGER_RATIO = 1.25;
const WEAKER_RATIO = 0.75;

export class AIMilitaryEvaluationSystem {
  private peacekeepingDefensivePowerProvider: PeacekeepingDefensivePowerProvider = () => 0;

  constructor(
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
    // Optional so existing callers/tests keep working; when present they make
    // war evaluation account for the defender's alliance.
    private readonly allianceManager?: AllianceManager,
    private readonly diplomacyManager?: DiplomacyManager,
  ) {}

  setPeacekeepingDefensivePowerProvider(provider: PeacekeepingDefensivePowerProvider): void {
    this.peacekeepingDefensivePowerProvider = provider;
  }

  getMilitaryStrength(nationId: string): MilitaryStrengthBreakdown {
    let unitStrength = 0;
    for (const unit of this.unitManager.getUnitsByOwner(nationId)) {
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

  /** Deterministic three-way strength comparison (see {@link classifyStrength}). */
  compareMilitaryStrength(a: string, b: string): MilitaryComparison {
    return this.classifyStrength(
      this.getMilitaryStrength(a).totalStrength,
      this.getMilitaryStrength(b).totalStrength,
    );
  }

  /**
   * Total defensive power `attackerNationId` would face by declaring war on
   * `defenderNationId`: the defender plus its alliance partner when defensive
   * alliance activation would pull that ally in.
   */
  getDefensiveWarPowerAgainst(attackerNationId: string, defenderNationId: string): number {
    return this.getDefensiveWarPowerBreakdown(attackerNationId, defenderNationId).totalDefensivePower;
  }

  /** Detailed breakdown of {@link getDefensiveWarPowerAgainst}, for logging. */
  getDefensiveWarPowerBreakdown(attackerNationId: string, defenderNationId: string): DefensiveWarPowerBreakdown {
    const defenderPower = this.getMilitaryStrength(defenderNationId).totalStrength;
    const allyNationId = this.allianceManager?.getAllyNationId(defenderNationId) ?? null;
    const peacekeepingPower = Math.max(0, this.peacekeepingDefensivePowerProvider(
      attackerNationId,
      defenderNationId,
      (nationId) => this.getMilitaryStrength(nationId),
    ));

    if (allyNationId && this.shouldIncludeAlly(attackerNationId, defenderNationId, allyNationId)) {
      const alliancePower = this.getMilitaryStrength(allyNationId).totalStrength;
      return {
        defenderPower,
        alliancePower,
        peacekeepingPower,
        totalDefensivePower: defenderPower + alliancePower + peacekeepingPower,
        allianceName: this.allianceManager?.getAllianceForNation(defenderNationId)?.name ?? null,
        allyNationId,
      };
    }

    return {
      defenderPower,
      alliancePower: 0,
      peacekeepingPower,
      totalDefensivePower: defenderPower + peacekeepingPower,
      allianceName: null,
      allyNationId: null,
    };
  }

  /**
   * Alliance-aware variant of {@link compareMilitaryStrength}: compares the
   * attacker against the defender's full defensive (alliance) power.
   */
  compareMilitaryStrengthForWar(attackerNationId: string, defenderNationId: string): MilitaryComparison {
    return this.classifyStrength(
      this.getMilitaryStrength(attackerNationId).totalStrength,
      this.getDefensiveWarPowerAgainst(attackerNationId, defenderNationId),
    );
  }

  /**
   * Include the defender's ally in defensive power only when defensive alliance
   * activation would actually pull it into the war: a distinct, living nation
   * (not the attacker) that is not already at war with the attacker.
   */
  private shouldIncludeAlly(attackerNationId: string, defenderNationId: string, allyNationId: string): boolean {
    if (allyNationId === attackerNationId || allyNationId === defenderNationId) return false;
    if (!this.isNationActive(allyNationId)) return false;
    if (this.diplomacyManager?.getState(allyNationId, attackerNationId) === 'WAR') return false;
    return true;
  }

  /** A nation still in the game: city ownership is the survival condition. */
  isNationActive(nationId: string): boolean {
    return this.cityManager.getCitiesByOwner(nationId).length > 0;
  }

  /**
   * Deterministic three-way comparison. Edge cases:
   *   - both zero → 'equal'
   *   - one zero, other positive → the positive side is 'stronger'/'weaker'
   * Otherwise the STRONGER/WEAKER ratio thresholds keep small fluctuations
   * from flipping the verdict.
   */
  private classifyStrength(aStrength: number, bStrength: number): MilitaryComparison {
    if (aStrength === 0 && bStrength === 0) return 'equal';
    if (bStrength === 0) return 'stronger';
    if (aStrength === 0) return 'weaker';

    if (aStrength >= bStrength * STRONGER_RATIO) return 'stronger';
    if (aStrength <= bStrength * WEAKER_RATIO) return 'weaker';
    return 'equal';
  }
}
