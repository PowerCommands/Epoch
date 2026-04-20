export type DiplomacyState = 'WAR' | 'PEACE';

export interface PeaceProposal {
  fromNationId: string;
  toNationId: string;
}

type PeaceProposedListener = (proposal: PeaceProposal) => void;
type PeaceAcceptedListener = (nationA: string, nationB: string) => void;
type PeaceDeclinedListener = (nationA: string, nationB: string) => void;
type WarDeclaredListener = (aggressorId: string, targetId: string) => void;

/**
 * DiplomacyManager — tracks diplomatic state between nation pairs.
 * Default state is PEACE. Supports war declaration, peace proposals and responses.
 */
export class DiplomacyManager {
  private readonly states = new Map<string, DiplomacyState>();
  private readonly pendingProposals = new Map<string, PeaceProposal>();
  private readonly proposedListeners: PeaceProposedListener[] = [];
  private readonly acceptedListeners: PeaceAcceptedListener[] = [];
  private readonly declinedListeners: PeaceDeclinedListener[] = [];
  private readonly warDeclaredListeners: WarDeclaredListener[] = [];

  private pairKey(a: string, b: string): string {
    return [a, b].sort().join('_');
  }

  getState(a: string, b: string): DiplomacyState {
    return this.states.get(this.pairKey(a, b)) ?? 'PEACE';
  }

  canAttack(a: string, b: string): boolean {
    return this.getState(a, b) === 'WAR';
  }

  declareWar(aggressorId: string, targetId: string): void {
    const key = this.pairKey(aggressorId, targetId);
    if (this.states.get(key) === 'WAR') return;
    this.states.set(key, 'WAR');
    // Clear any pending peace proposal between these nations
    this.pendingProposals.delete(aggressorId);
    this.pendingProposals.delete(targetId);
    for (const cb of this.warDeclaredListeners) cb(aggressorId, targetId);
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
      this.states.set(this.pairKey(fromId, toId), 'PEACE');
      for (const cb of this.acceptedListeners) cb(fromId, toId);
    } else {
      for (const cb of this.declinedListeners) cb(fromId, toId);
    }
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

  /**
   * Return every nation-pair whose diplomatic state differs from the
   * default PEACE. Used by save-load serialization.
   */
  getAllStates(): { keys: [string, string]; state: DiplomacyState }[] {
    const out: { keys: [string, string]; state: DiplomacyState }[] = [];
    for (const [key, state] of this.states) {
      const [a, b] = key.split('_');
      if (a === undefined || b === undefined) continue;
      out.push({ keys: [a, b], state });
    }
    return out;
  }

  /**
   * Silently overwrite the state between two nations. Does not fire
   * listeners. Used by save-load restoration.
   */
  restoreState(a: string, b: string, state: DiplomacyState): void {
    this.states.set(this.pairKey(a, b), state);
  }

  /** Reset all diplomacy state. Used before applying a loaded save. */
  resetAll(): void {
    this.states.clear();
    this.pendingProposals.clear();
  }
}
