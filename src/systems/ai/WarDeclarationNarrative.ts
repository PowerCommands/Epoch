import type { WarDeclarationReason, WarDeclarationReasonContext } from '../../types/warDeclaration';

const REASON_PRECEDENCE: readonly WarDeclarationReason[] = [
  'threat',
  'hostility',
  'ideological',
  'conquest',
  'ambition',
];

/**
 * Classify an already-approved AI war declaration for presentation only.
 *
 * Each score uses values that the normal war decision has already evaluated.
 * Ties use the documented precedence above: an immediate threat is the clearest
 * story, followed by an explicit grievance, ideology, opportunistic conquest,
 * and finally leader ambition. The result never feeds back into AI decisions.
 */
export function classifyWarDeclarationReason(context: WarDeclarationReasonContext): WarDeclarationReason {
  const { personality } = context;
  const militaristicAgenda = context.nationalAgendaId === 'military_power';
  const expansionAgenda = context.nationalAgendaId === 'expansionist';

  const scores: Record<WarDeclarationReason, number> = {
    threat:
      context.fear
      + threatBonus(context.threatLevel)
      + (context.militaryComparison === 'weaker' ? 25 : context.militaryComparison === 'equal' ? 10 : 0),
    hostility:
      context.hostility
      + Math.max(0, 40 - context.trust)
      + Math.max(0, -context.affinity)
      + context.suspicion * 0.2,
    ideological:
      Math.max(0, -context.ideologyCompatibility) * 2
      + (context.ideologyCompatibility <= -30 ? 20 : 0),
    conquest:
      (context.militaryComparison === 'stronger' ? 65 : context.militaryComparison === 'equal' ? 20 : 0)
      + Math.max(0, personality.expansionBias) * 2
      + personality.warTolerance * 0.15
      + (militaristicAgenda || expansionAgenda ? 15 : 0),
    ambition:
      Math.max(0, personality.aggressionBias) * 2
      + Math.max(0, personality.expansionBias)
      + personality.warTolerance * 0.35
      + (militaristicAgenda || expansionAgenda ? 15 : 0),
  };

  let winner = REASON_PRECEDENCE[0];
  for (const reason of REASON_PRECEDENCE.slice(1)) {
    if (scores[reason] > scores[winner]) winner = reason;
  }
  return winner;
}

function threatBonus(level: WarDeclarationReasonContext['threatLevel']): number {
  switch (level) {
    case 'high': return 70;
    case 'medium': return 35;
    case 'low': return 0;
    case 'none': return 0;
  }
}
