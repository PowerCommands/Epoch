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
