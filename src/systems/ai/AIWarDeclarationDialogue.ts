import { getLeaderByNationId } from '../../data/leaders';
import { getLeaderWarDeclarationPhrase } from '../../data/leaderWarDeclarations';
import type { AIDiplomacyDecisionReason } from '../../types/aiDiplomacy';
import type { WarDeclarationReason } from '../../types/warDeclaration';

export interface AIWarDeclarationDialogueRequest {
  readonly leaderId: string;
  readonly actorNationId: string;
  readonly targetNationId: string;
  readonly reason: WarDeclarationReason;
  readonly phrase: string;
}

/**
 * Convert only a direct AI decision aimed at the human into presentation data.
 * DiplomacyManager events are deliberately not accepted here: alliance joins,
 * scenario initialization, save restoration and human actions never create an
 * AIDiplomacyDecisionReason and therefore cannot create duplicate dialogs.
 */
export function createAIWarDeclarationDialogueRequest(
  decision: AIDiplomacyDecisionReason,
  humanNationId: string,
  currentRound: number,
): AIWarDeclarationDialogueRequest | null {
  if (decision.action !== 'declareWar') return null;
  if (decision.actorNationId === humanNationId || decision.targetNationId !== humanNationId) return null;
  if (!decision.warDeclarationReason) return null;
  const leader = getLeaderByNationId(decision.actorNationId);
  if (!leader) return null;

  return {
    leaderId: leader.id,
    actorNationId: decision.actorNationId,
    targetNationId: decision.targetNationId,
    reason: decision.warDeclarationReason,
    phrase: getLeaderWarDeclarationPhrase(
      leader.id,
      decision.warDeclarationReason,
      `${currentRound}|${decision.actorNationId}|${decision.targetNationId}`,
    ),
  };
}
