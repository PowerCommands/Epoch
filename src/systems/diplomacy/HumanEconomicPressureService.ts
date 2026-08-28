import {
  ECONOMIC_PRESSURE_LABEL,
  type EconomicPressureType,
} from '../../data/economicPressure';
import type { DiplomacyManager } from '../DiplomacyManager';
import type { TradeDealSystem } from '../TradeDealSystem';

export interface EconomicPressureTradeConnections {
  cancelConnectionsBetweenNations(nationAId: string, nationBId: string): unknown;
}

export interface HumanEconomicPressureResult {
  readonly ok: boolean;
  readonly changed: boolean;
  readonly lifted: boolean;
  readonly reason?: string;
  readonly feedback: readonly string[];
  readonly cancelledImports: number;
  readonly reciprocalTariffsCreated: boolean;
}

/**
 * Applies one Human Audience sanction click as a single gameplay transaction.
 * Strategic AI choice and timed negotiation deliberately do not live here.
 */
export class EconomicPressureActionService {
  constructor(
    private readonly diplomacy: DiplomacyManager,
    private readonly tradeDeals: TradeDealSystem,
    private readonly tradeConnections?: EconomicPressureTradeConnections,
  ) {}

  applyHuman(
    humanNationId: string,
    targetNationId: string,
    type: EconomicPressureType,
    targetName: string = targetNationId,
  ): HumanEconomicPressureResult {
    if (this.diplomacy.getEconomicPressure(humanNationId, targetNationId) === type) {
      const changed = this.diplomacy.liftEconomicPressure(humanNationId, targetNationId);
      return {
        ok: changed,
        changed,
        lifted: changed,
        feedback: changed ? [`${ECONOMIC_PRESSURE_LABEL[type]} lifted from ${targetName}.`] : [],
        cancelledImports: 0,
        reciprocalTariffsCreated: false,
      };
    }

    return this.impose(humanNationId, targetNationId, type, targetName);
  }

  /** Apply a sanction chosen by either Human or AI, including canonical effects. */
  impose(
    sourceNationId: string,
    targetNationId: string,
    type: EconomicPressureType,
    targetName: string = targetNationId,
  ): HumanEconomicPressureResult {
    const eligibility = this.diplomacy.canImposeEconomicPressure(sourceNationId, targetNationId, type);
    if (!eligibility.ok) {
      return {
        ok: false,
        changed: false,
        lifted: false,
        reason: eligibility.reason,
        feedback: [],
        cancelledImports: 0,
        reciprocalTariffsCreated: false,
      };
    }
    const application = this.diplomacy.imposeEconomicPressureAction(sourceNationId, targetNationId, type);
    if (!application.imposed) {
      return {
        ok: false,
        changed: false,
        lifted: false,
        reason: 'Economic sanction was not changed.',
        feedback: [],
        cancelledImports: 0,
        reciprocalTariffsCreated: false,
      };
    }

    if (type === 'tariffs') {
      const reciprocalTariffsCreated = application.reciprocalTariffsCreated;
      return {
        ok: true,
        changed: true,
        lifted: false,
        feedback: [
          `Tariffs imposed on ${targetName}.`,
          ...(reciprocalTariffsCreated ? [`${targetName} responded with Tariffs.`] : []),
        ],
        cancelledImports: 0,
        reciprocalTariffsCreated,
      };
    }

    if (type === 'boycott') {
      const cancelledImports = this.tradeDeals.cancelImportDeals(sourceNationId, targetNationId, 'sanctions');
      return {
        ok: true,
        changed: true,
        lifted: false,
        feedback: [
          `Boycott imposed on ${targetName}.`,
          `${cancelledImports} import agreement${cancelledImports === 1 ? '' : 's'} from ${targetName} terminated.`,
        ],
        cancelledImports,
        reciprocalTariffsCreated: false,
      };
    }

    // Embargo is the migration destination of the former Cancel Trade Relations
    // action: permission, active purchase agreements, and routes all end.
    this.diplomacy.cancelTradeRelations(sourceNationId, targetNationId);
    this.tradeDeals.cancelDealsBetween(sourceNationId, targetNationId, 'sanctions');
    this.tradeConnections?.cancelConnectionsBetweenNations(sourceNationId, targetNationId);
    return {
      ok: true,
      changed: true,
      lifted: false,
      feedback: [
        `Embargo imposed on ${targetName}.`,
        'Trade between the two nations has ended.',
      ],
      cancelledImports: 0,
      reciprocalTariffsCreated: false,
    };
  }
}

/** Back-compatible Human-facing wrapper used by the Audience and Step 2 tests. */
export class HumanEconomicPressureService extends EconomicPressureActionService {
  apply(
    humanNationId: string,
    targetNationId: string,
    type: EconomicPressureType,
    targetName: string = targetNationId,
  ): HumanEconomicPressureResult {
    return this.applyHuman(humanNationId, targetNationId, type, targetName);
  }
}
