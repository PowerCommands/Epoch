import type { GossipSuccessResult } from '../types/gossip';
import type { HistoricalTimelineService } from './HistoricalTimelineService';

export interface GossipHistoryNames {
  getNationName: (nationId: string) => string | undefined;
  getLeaderName: (nationId: string) => string | undefined;
}

/** Records an already-executed interactive Insult; it never triggers Gossip itself. */
export function recordGossipInsultInHistory(
  result: GossipSuccessResult,
  historicalTimeline: HistoricalTimelineService,
  names: GossipHistoryNames,
): boolean {
  if (
    result.type !== 'insult'
    || result.sourceNationId === undefined
    || result.recipientNationId === undefined
  ) return false;

  const sourceNationName = names.getNationName(result.sourceNationId) ?? result.sourceNationId;
  const recipientNationName = names.getNationName(result.recipientNationId) ?? result.recipientNationId;
  const sourceLeaderName = names.getLeaderName(result.sourceNationId) ?? sourceNationName;
  const recipientLeaderName = names.getLeaderName(result.recipientNationId) ?? recipientNationName;
  const isThreat = result.insultSubtype === 'threat';

  historicalTimeline.record({
    type: 'leaderInsult',
    icon: '💬',
    text: `${sourceLeaderName} of ${sourceNationName} ${isThreat ? 'threatened' : 'insulted'} ${recipientLeaderName} of ${recipientNationName}: “${result.resolvedText}”`,
    eventNationIds: [result.sourceNationId, result.recipientNationId],
    metadata: {
      aggressorNationId: result.sourceNationId,
      targetNationId: result.recipientNationId,
      leaderInsultSubtype: isThreat ? 'threat' : 'insult',
      leaderInsultText: result.resolvedText,
    },
  });
  return true;
}
