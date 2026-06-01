import type {
  DiplomacyManager,
  DiplomacyRelation,
  DiplomaticMemoryHook,
} from '../DiplomacyManager';

// DiplomaticMemorySystem updates relationship values based on events.
// These values are not yet used for AI decisions, but form the basis for
// future diplomacy logic.

type MemoryField = 'trust' | 'fear' | 'hostility' | 'affinity';
type MemoryDelta = Partial<Pick<DiplomacyRelation, MemoryField>>;

const MIN_VALUE = 0;
const MAX_VALUE = 100;

function clamp(value: number): number {
  return Math.max(MIN_VALUE, Math.min(MAX_VALUE, value));
}

const DELTA_DECLARE_WAR: MemoryDelta = {
  hostility: 30,
  trust: -25,
  fear: 10,
};

const DELTA_MAKE_PEACE: MemoryDelta = {
  hostility: -10,
  trust: 5,
};

const DELTA_OPEN_BORDERS: MemoryDelta = {
  trust: 5,
  affinity: 2,
};

const DELTA_CANCEL_OPEN_BORDERS: MemoryDelta = {
  trust: -3,
};

const DELTA_CITY_CAPTURED: MemoryDelta = {
  hostility: 40,
  fear: 20,
  trust: -20,
};

function goldGiftDelta(amount: number): MemoryDelta {
  const scaled = Math.min(1, Math.max(0, Math.log1p(amount) / Math.log1p(120)));
  return {
    trust: Math.round(2 + scaled * 16),
    affinity: Math.round(1 + scaled * 12),
    hostility: -Math.round(1 + scaled * 6),
  };
}

function unitGiftDelta(unitCount: number, powerValue = 0): MemoryDelta {
  const countScore = Math.min(18, unitCount * 7);
  const powerScore = Math.min(14, Math.floor(powerValue / 18));
  return {
    trust: 8 + countScore + Math.floor(powerScore / 2),
    affinity: 6 + Math.floor(countScore * 0.75) + Math.floor(powerScore / 2),
    hostility: -Math.min(16, 4 + unitCount * 3 + Math.floor(powerScore / 3)),
  };
}

const DELTA_CITY_GIFT: MemoryDelta = {
  trust: 35,
  affinity: 30,
  hostility: -28,
};

// A symbolic gift of gesture: a formal courtesy that costs the giver gold but
// transfers no value to the recipient. Its goodwill is worth a touch more than
// it costs — it lands the same relationship boost as gifting this much gold
// outright (a little value for the money), without the recipient receiving any.
const SYMBOLIC_GIFT_GOLD_EQUIVALENT = 120;

// A friendly intelligence-sharing gesture. Smaller than major agreements but
// enough to matter, and stacks modestly across repeated exchanges.
const DELTA_EXCHANGE_MAPS: MemoryDelta = {
  trust: 5,
  affinity: 2,
};

// Forming a formal alliance is a significant friendly milestone — a moderate
// mutual boost to trust and affinity.
const DELTA_FORM_ALLIANCE: MemoryDelta = {
  trust: 10,
  affinity: 8,
};

// Agreeing to a joint war is a moderate act of military cooperation between
// the proposer and receiver (the relation hit toward the shared target comes
// from the war declaration itself).
const DELTA_JOINT_WAR: MemoryDelta = {
  trust: 8,
  affinity: 6,
};

// Leaving a shared alliance is a moderate slight to the remaining member.
const DELTA_ALLIANCE_DEPARTURE: MemoryDelta = {
  trust: -10,
  affinity: -8,
  hostility: 6,
};

// Council proposal politics — small, deliberately mild so friction builds
// without tearing alliances apart.
const DELTA_PROPOSAL_APPROVED: MemoryDelta = {
  trust: 3,
  affinity: 2,
};

const DELTA_PROPOSAL_REJECTED: MemoryDelta = {
  trust: -4,
  affinity: -2,
  hostility: 2,
};

export class DiplomaticMemorySystem implements DiplomaticMemoryHook {
  constructor(private readonly diplomacyManager: DiplomacyManager) {}

  onDeclareWar(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_DECLARE_WAR);
  }

  onMakePeace(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_MAKE_PEACE);
  }

  onOpenBorders(from: string, to: string): void {
    this.adjustRelation(from, to, DELTA_OPEN_BORDERS);
  }

  onCancelOpenBorders(from: string, to: string): void {
    this.adjustRelation(from, to, DELTA_CANCEL_OPEN_BORDERS);
  }

  onCityCaptured(attacker: string, defender: string): void {
    this.adjustRelation(attacker, defender, DELTA_CITY_CAPTURED);
  }

  onGoldGift(from: string, to: string, amount: number): void {
    this.adjustRelation(from, to, goldGiftDelta(amount));
  }

  onUnitGift(from: string, to: string, unitCount: number, powerValue?: number): void {
    this.adjustRelation(from, to, unitGiftDelta(unitCount, powerValue));
  }

  onCityGift(from: string, to: string, _cityId: string): void {
    this.adjustRelation(from, to, DELTA_CITY_GIFT);
  }

  onSymbolicGift(from: string, to: string): void {
    this.adjustRelation(from, to, goldGiftDelta(SYMBOLIC_GIFT_GOLD_EQUIVALENT));
  }

  onExchangeMaps(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_EXCHANGE_MAPS);
  }

  onFormAlliance(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_FORM_ALLIANCE);
  }

  onJointWarAgreement(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_JOINT_WAR);
  }

  onAllianceDeparture(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_ALLIANCE_DEPARTURE);
  }

  onProposalApproved(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_PROPOSAL_APPROVED);
  }

  onProposalRejected(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_PROPOSAL_REJECTED);
  }

  /**
   * Read the current relation, apply per-field deltas, clamp to 0–100, and
   * persist. Effects are symmetric in this first version — both directions
   * share one stored relation, so a single write covers A↔B.
   */
  private adjustRelation(a: string, b: string, delta: MemoryDelta): void {
    const relation = this.diplomacyManager.getRelation(a, b);
    this.diplomacyManager.setMemoryValues(a, b, {
      trust: clamp(relation.trust + (delta.trust ?? 0)),
      fear: clamp(relation.fear + (delta.fear ?? 0)),
      hostility: clamp(relation.hostility + (delta.hostility ?? 0)),
      affinity: clamp(relation.affinity + (delta.affinity ?? 0)),
    });
  }
}
