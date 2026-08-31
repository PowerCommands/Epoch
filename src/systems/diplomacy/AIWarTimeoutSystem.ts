import type { DiplomacyManager, PeaceProposal } from '../DiplomacyManager';
import type { NationManager } from '../NationManager';

/**
 * Simple deterministic AI war timeout / peace rule.
 *
 * If an AI nation declared a war and has not forced the defender to capitulate
 * within {@link WAR_TIMEOUT_TURNS} turns, the attacker offers peace paying
 * reparations equal to {@link WAR_TIMEOUT_REPARATIONS_FRACTION} of its current
 * gold treasury:
 *
 *  - AI attacker → AI defender: peace is settled immediately (defender accepts)
 *    through the normal peace-resolution path.
 *  - AI attacker → human defender: a normal peace offer is presented; the human
 *    decides. Rejected offers are not repeated every turn.
 *  - Human attacker: this rule never applies.
 *
 * The 100 turns are measured from the original declaration of that specific
 * bilateral war (DiplomacyManager stamps it per pair), so joining wars, alliance
 * changes, or new wars never reset an existing war's timer. Capitulation ends the
 * war before this fires, so a capitulated war never appears here.
 */
export const WAR_TIMEOUT_TURNS = 100;
export const WAR_TIMEOUT_REPARATIONS_FRACTION = 0.2;
/** Turns to wait before re-offering peace to a human defender who rejected. */
export const WAR_TIMEOUT_REPROPOSE_COOLDOWN_TURNS = 5;

/** Minimal peace-settlement surface reused from PeaceTreatySystem. */
export interface WarTimeoutPeaceSettler {
  settleAcceptedPeace(proposal: PeaceProposal): unknown;
}

export class AIWarTimeoutSystem {
  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly nationManager: NationManager,
    private readonly peaceSettler: WarTimeoutPeaceSettler,
    private readonly getCurrentTurn: () => number,
    private readonly log: (message: string) => void = () => {},
  ) {}

  handleRoundStart(): void {
    const currentTurn = this.getCurrentTurn();
    for (const war of this.diplomacyManager.getActiveWars()) {
      this.evaluateWar(war.nationA, war.nationB, war.aggressorNationId, war.declarationTurn, currentTurn);
    }
  }

  private evaluateWar(
    nationA: string,
    nationB: string,
    aggressorId: string | undefined,
    declarationTurn: number | null,
    currentTurn: number,
  ): void {
    if (aggressorId === undefined || declarationTurn === null) return;
    if (currentTurn - declarationTurn < WAR_TIMEOUT_TURNS) return;

    // The original attacker must be AI-controlled.
    const attacker = this.nationManager.getNation(aggressorId);
    if (!attacker || attacker.isHuman) return;

    const defenderId = aggressorId === nationA ? nationB : nationA;
    const defender = this.nationManager.getNation(defenderId);
    if (!defender) return;

    const reparations = Math.max(
      0,
      Math.floor(this.nationManager.getResources(aggressorId).gold * WAR_TIMEOUT_REPARATIONS_FRACTION),
    );
    const warDuration = currentTurn - declarationTurn;

    if (defender.isHuman) {
      this.offerPeaceToHumanDefender(aggressorId, defenderId, reparations, warDuration, currentTurn);
    } else {
      this.forcePeaceBetweenAI(aggressorId, defenderId, reparations, warDuration);
    }
  }

  private forcePeaceBetweenAI(
    attackerId: string,
    defenderId: string,
    reparations: number,
    warDuration: number,
  ): void {
    const attackerName = this.nationName(attackerId);
    const defenderName = this.nationName(defenderId);
    this.log(
      `[WarTimeout] ${attackerName} failed to force ${defenderName} to capitulate within `
      + `${WAR_TIMEOUT_TURNS} turns. ${attackerName} offers 20% treasury (${reparations} gold) `
      + `for peace. ${defenderName} accepts.`,
    );
    this.peaceSettler.settleAcceptedPeace({
      fromNationId: attackerId,
      toNationId: defenderId,
      goldReparations: reparations,
      warDuration,
    });
  }

  private offerPeaceToHumanDefender(
    attackerId: string,
    defenderId: string,
    reparations: number,
    warDuration: number,
    currentTurn: number,
  ): void {
    // Reuse the existing proposal/cooldown behavior: never stack a second offer
    // on a pending one, and don't re-offer every turn after a rejection.
    if (this.diplomacyManager.getPendingProposal(defenderId) !== null) return;
    const lastProposalTurn = this.diplomacyManager.getRelation(attackerId, defenderId).lastPeaceProposalTurn;
    if (lastProposalTurn !== null && currentTurn - lastProposalTurn < WAR_TIMEOUT_REPROPOSE_COOLDOWN_TURNS) {
      return;
    }

    const attackerName = this.nationName(attackerId);
    const defenderName = this.nationName(defenderId);
    this.log(
      `[WarTimeout] ${attackerName} failed to force ${defenderName} to capitulate within `
      + `${WAR_TIMEOUT_TURNS} turns. ${attackerName} offers 20% treasury (${reparations} gold) `
      + `for peace. Awaiting ${defenderName}'s decision.`,
    );
    // Normal peace offer; the human decides via the existing proposal flow.
    this.diplomacyManager.proposePeace(attackerId, defenderId, { goldReparations: reparations });
  }

  private nationName(nationId: string): string {
    return this.nationManager.getNation(nationId)?.name ?? nationId;
  }
}
