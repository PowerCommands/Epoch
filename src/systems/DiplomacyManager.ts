export type DiplomacyState = 'WAR' | 'PEACE';

export interface DiplomacyRelation {
  state: DiplomacyState;
  openBorders: boolean;
}

export interface PeaceProposal {
  fromNationId: string;
  toNationId: string;
}

type PeaceProposedListener = (proposal: PeaceProposal) => void;
type PeaceAcceptedListener = (nationA: string, nationB: string) => void;
type PeaceDeclinedListener = (nationA: string, nationB: string) => void;
type WarDeclaredListener = (aggressorId: string, targetId: string) => void;
type DiplomacyChangedListener = (nationA: string, nationB: string, relation: DiplomacyRelation) => void;

const DEFAULT_RELATION: DiplomacyRelation = {
  state: 'PEACE',
  openBorders: false,
};
const PAIR_KEY_SEPARATOR = '|';

/**
 * DiplomacyManager — tracks diplomatic state between nation pairs.
 * Default state is PEACE. Supports war declaration, peace proposals and responses.
 */
export class DiplomacyManager {
  private readonly relations = new Map<string, DiplomacyRelation>();
  private readonly pendingProposals = new Map<string, PeaceProposal>();
  private readonly proposedListeners: PeaceProposedListener[] = [];
  private readonly acceptedListeners: PeaceAcceptedListener[] = [];
  private readonly declinedListeners: PeaceDeclinedListener[] = [];
  private readonly warDeclaredListeners: WarDeclaredListener[] = [];
  private readonly changedListeners: DiplomacyChangedListener[] = [];

  private pairKey(a: string, b: string): string {
    return [a, b].sort().join(PAIR_KEY_SEPARATOR);
  }

  getState(a: string, b: string): DiplomacyState {
    return this.getRelation(a, b).state;
  }

  getRelation(a: string, b: string): DiplomacyRelation {
    return { ...(this.relations.get(this.pairKey(a, b)) ?? DEFAULT_RELATION) };
  }

  canAttack(a: string, b: string): boolean {
    return this.getState(a, b) === 'WAR';
  }

  declareWar(aggressorId: string, targetId: string): void {
    const key = this.pairKey(aggressorId, targetId);
    if (this.relations.get(key)?.state === 'WAR') return;
    this.relations.set(key, { state: 'WAR', openBorders: false });
    // Clear any pending peace proposal between these nations
    this.pendingProposals.delete(aggressorId);
    this.pendingProposals.delete(targetId);
    for (const cb of this.warDeclaredListeners) cb(aggressorId, targetId);
    this.notifyChanged(aggressorId, targetId);
  }

  proposePeace(fromId: string, toId: string): void {
    if (this.getState(fromId, toId) !== 'WAR') return;
    const proposal: PeaceProposal = { fromNationId: fromId, toNationId: toId };
    this.pendingProposals.set(toId, proposal);
    for (const cb of this.proposedListeners) cb(proposal);
  }

  respondToPeace(fromId: string, toId: string, accept: boolean): void {
    this.pendingProposals.delete(toId);
    if (accept) {
      this.relations.set(this.pairKey(fromId, toId), { state: 'PEACE', openBorders: false });
      for (const cb of this.acceptedListeners) cb(fromId, toId);
      this.notifyChanged(fromId, toId);
    } else {
      for (const cb of this.declinedListeners) cb(fromId, toId);
    }
  }

  toggleOpenBorders(a: string, b: string): boolean {
    const key = this.pairKey(a, b);
    const current = this.getRelation(a, b);
    const next: DiplomacyRelation = {
      ...current,
      openBorders: !current.openBorders,
    };
    this.relations.set(key, next);
    this.notifyChanged(a, b);
    return next.openBorders;
  }

  getPendingProposal(toId: string): PeaceProposal | null {
    return this.pendingProposals.get(toId) ?? null;
  }

  onPeaceProposed(callback: PeaceProposedListener): void {
    this.proposedListeners.push(callback);
  }

  onPeaceAccepted(callback: PeaceAcceptedListener): void {
    this.acceptedListeners.push(callback);
  }

  onPeaceDeclined(callback: PeaceDeclinedListener): void {
    this.declinedListeners.push(callback);
  }

  onWarDeclared(callback: WarDeclaredListener): void {
    this.warDeclaredListeners.push(callback);
  }

  onDiplomacyChanged(callback: DiplomacyChangedListener): void {
    this.changedListeners.push(callback);
  }

  /**
   * Return every nation-pair whose diplomatic state differs from the
   * default PEACE. Used by save-load serialization.
   */
  getAllStates(): { keys: [string, string]; relation: DiplomacyRelation }[] {
    const out: { keys: [string, string]; relation: DiplomacyRelation }[] = [];
    for (const [key, relation] of this.relations) {
      const [a, b] = key.split(PAIR_KEY_SEPARATOR);
      if (a === undefined || b === undefined) continue;
      if (relation.state === DEFAULT_RELATION.state && relation.openBorders === DEFAULT_RELATION.openBorders) continue;
      out.push({ keys: [a, b], relation: { ...relation } });
    }
    return out;
  }

  /**
   * Silently overwrite the state between two nations. Does not fire
   * listeners. Used by save-load restoration.
   */
  restoreState(a: string, b: string, state: DiplomacyState, openBorders = false): void {
    this.relations.set(this.pairKey(a, b), { state, openBorders });
  }

  /** Reset all diplomacy state. Used before applying a loaded save. */
  resetAll(): void {
    this.relations.clear();
    this.pendingProposals.clear();
  }

  private notifyChanged(a: string, b: string): void {
    const relation = this.getRelation(a, b);
    for (const cb of this.changedListeners) cb(a, b, relation);
  }
}
