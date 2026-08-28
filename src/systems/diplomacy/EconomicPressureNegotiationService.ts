import {
  ECONOMIC_PRESSURE_DURATION_TURNS,
  ECONOMIC_PRESSURE_REMOVAL_PRICE,
  type EconomicPressureType,
} from '../../data/economicPressure';
import type { DiplomacyManager, EconomicPressureRecord } from '../DiplomacyManager';

export interface EconomicPressureTreasury {
  getGold(nationId: string): number;
  transferGold(fromNationId: string, toNationId: string, amount: number): boolean;
}

export interface EconomicPressureRemovalOffer {
  readonly humanNationId: string;
  readonly aiNationId: string;
  readonly type: EconomicPressureType;
  readonly imposedTurn: number;
  readonly price: number;
}

export interface EconomicPressureNegotiationResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly price: number;
  readonly lifted: boolean;
}

export function isEconomicPressureNegotiable(
  record: EconomicPressureRecord | null,
  currentTurn: number,
): record is EconomicPressureRecord {
  return record !== null && currentTurn - record.imposedTurn >= ECONOMIC_PRESSURE_DURATION_TURNS;
}

/**
 * Fixed-price Human–AI sanction removal. The manager remains the sole owner of
 * directional sanction state; this service only coordinates age, treasury, and
 * the one-time incoming-offer marker.
 */
export class EconomicPressureNegotiationService {
  constructor(
    private readonly diplomacy: DiplomacyManager,
    private readonly treasury: EconomicPressureTreasury,
  ) {}

  /**
   * Claim the next affordable AI payment offer for a Human-imposed sanction.
   * Claiming marks that exact instance as presented, preventing repeat popups.
   * Unaffordable targets remain unmarked and are reconsidered on a later turn.
   */
  takeNextAutomaticOffer(
    humanNationId: string,
    currentTurn: number,
  ): EconomicPressureRemovalOffer | null {
    for (const record of this.diplomacy.getEconomicPressureAgainst(humanNationId)) {
      if (!isEconomicPressureNegotiable(record, currentTurn)) continue;
      if (record.removalOfferPresented) continue;
      if (this.treasury.getGold(record.targetNationId) < ECONOMIC_PRESSURE_REMOVAL_PRICE) continue;
      if (!this.diplomacy.markEconomicPressureRemovalOfferPresented(
        humanNationId,
        record.targetNationId,
        record.type,
        record.imposedTurn,
      )) continue;
      return {
        humanNationId,
        aiNationId: record.targetNationId,
        type: record.type,
        imposedTurn: record.imposedTurn,
        price: ECONOMIC_PRESSURE_REMOVAL_PRICE,
      };
    }
    return null;
  }

  /** Accept an AI's payment to remove the Human → AI sanction in the offer. */
  acceptAutomaticOffer(offer: EconomicPressureRemovalOffer): EconomicPressureNegotiationResult {
    const record = this.diplomacy.getEconomicPressureRecord(offer.humanNationId, offer.aiNationId);
    if (!this.isSamePresentedInstance(record, offer)) {
      return this.failure('The sanction changed before the offer was accepted.');
    }
    if (this.treasury.getGold(offer.aiNationId) < ECONOMIC_PRESSURE_REMOVAL_PRICE) {
      return this.failure('The offering nation can no longer afford the payment.');
    }
    if (!this.treasury.transferGold(
      offer.aiNationId,
      offer.humanNationId,
      ECONOMIC_PRESSURE_REMOVAL_PRICE,
    )) return this.failure('The treasury transfer could not be completed.');

    if (!this.diplomacy.liftEconomicPressure(offer.humanNationId, offer.aiNationId)) {
      this.treasury.transferGold(offer.humanNationId, offer.aiNationId, ECONOMIC_PRESSURE_REMOVAL_PRICE);
      return this.failure('The sanction could not be lifted.');
    }
    return { ok: true, price: ECONOMIC_PRESSURE_REMOVAL_PRICE, lifted: true };
  }

  /** Human pays an AI; acceptance is deterministic and removes only AI → Human. */
  payToLiftIncomingSanction(
    humanNationId: string,
    aiNationId: string,
    currentTurn: number,
  ): EconomicPressureNegotiationResult {
    const record = this.diplomacy.getEconomicPressureRecord(aiNationId, humanNationId);
    if (!isEconomicPressureNegotiable(record, currentTurn)) {
      return this.failure(`Removal becomes negotiable after ${ECONOMIC_PRESSURE_DURATION_TURNS} turns.`);
    }
    if (this.treasury.getGold(humanNationId) < ECONOMIC_PRESSURE_REMOVAL_PRICE) {
      return this.failure(
        `${humanNationId} has only ${Math.floor(this.treasury.getGold(humanNationId))} gold.`,
      );
    }
    if (!this.treasury.transferGold(humanNationId, aiNationId, ECONOMIC_PRESSURE_REMOVAL_PRICE)) {
      return this.failure('The treasury transfer could not be completed.');
    }
    if (!this.diplomacy.liftEconomicPressure(aiNationId, humanNationId)) {
      this.treasury.transferGold(aiNationId, humanNationId, ECONOMIC_PRESSURE_REMOVAL_PRICE);
      return this.failure('The sanction could not be lifted.');
    }
    return { ok: true, price: ECONOMIC_PRESSURE_REMOVAL_PRICE, lifted: true };
  }

  private isSamePresentedInstance(
    record: EconomicPressureRecord | null,
    offer: EconomicPressureRemovalOffer,
  ): boolean {
    return record !== null
      && record.type === offer.type
      && record.imposedTurn === offer.imposedTurn
      && record.removalOfferPresented;
  }

  private failure(reason: string): EconomicPressureNegotiationResult {
    return { ok: false, reason, price: ECONOMIC_PRESSURE_REMOVAL_PRICE, lifted: false };
  }
}
