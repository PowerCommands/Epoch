import type { DiplomacyManager } from '../DiplomacyManager';
import type { AllianceManager } from './AllianceManager';

/** Details of a defensive alliance activation, for logging and UI feedback. */
export interface AllianceActivation {
  /** The nation that declared the original war. */
  attackerNationId: string;
  /** The attacked alliance member whose ally is being pulled in. */
  defenderNationId: string;
  /** The ally that automatically entered the war against the attacker. */
  joiningNationId: string;
  allianceId: string;
  allianceName: string;
}

type AllianceActivationListener = (activation: AllianceActivation) => void;

/**
 * Defensive Alliance Activation for Alliance Core v1.
 *
 * When any nation declares war on an alliance member, that member's ally
 * automatically enters the war against the attacker. The behaviour lives here —
 * in central diplomacy logic — rather than in UI, so both human and AI war
 * declarations trigger it. Listeners receive an {@link AllianceActivation} so
 * the surrounding scene can log it and show the human a popup; this system
 * never touches UI or the event log itself.
 *
 * Safety: a re-entrancy guard ensures the ally's own (defensive) declaration
 * does not recursively pull further nations in, and duplicate/self/at-war cases
 * are ignored. The contradictory case where the would-be ally is the attacker
 * is naturally blocked by {@link DiplomacyManager.declareWar} (alliance guard).
 */
export class AllianceWarSystem {
  private activating = false;
  private readonly listeners: AllianceActivationListener[] = [];

  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly allianceManager: AllianceManager,
  ) {
    this.diplomacyManager.onWarDeclared((attacker, defender) => this.handleWarDeclared(attacker, defender));
  }

  /**
   * True while a defensive ally declaration is in flight. Lets the scene's
   * generic war-declared logging skip the ally join (logged here instead with
   * alliance context).
   */
  isActivating(): boolean {
    return this.activating;
  }

  onActivation(listener: AllianceActivationListener): void {
    this.listeners.push(listener);
  }

  private handleWarDeclared(attackerNationId: string, defenderNationId: string): void {
    if (this.activating) return; // ignore the ally's own re-entrant declaration

    const alliance = this.allianceManager.getAllianceForNation(defenderNationId);
    if (!alliance) return;

    const allyId = this.allianceManager.getAllyNationId(defenderNationId);
    if (!allyId || allyId === attackerNationId || allyId === defenderNationId) return;
    if (this.diplomacyManager.getState(allyId, attackerNationId) === 'WAR') return;

    this.activating = true;
    const joined = this.diplomacyManager.declareWar(allyId, attackerNationId);
    this.activating = false;
    if (!joined) return;

    const activation: AllianceActivation = {
      attackerNationId,
      defenderNationId,
      joiningNationId: allyId,
      allianceId: alliance.id,
      allianceName: alliance.name,
    };
    for (const listener of this.listeners) listener(activation);
  }
}
