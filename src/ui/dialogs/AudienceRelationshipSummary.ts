import type { DiplomacyManager } from '../../systems/DiplomacyManager';

/** Add a target nation's geopolitical subordination to its attitude label. */
export function formatAudienceRelationshipSummary(
  attitudeLabel: string,
  targetNationId: string,
  humanNationId: string,
  diplomacyManager: Pick<DiplomacyManager, 'getVassalHost'>,
  getNationName: (nationId: string) => string | undefined,
): string {
  const hostNationId = diplomacyManager.getVassalHost(targetNationId);
  if (!hostNationId) return attitudeLabel;
  const hostLabel = hostNationId === humanNationId
    ? 'you'
    : (getNationName(hostNationId) ?? hostNationId);
  return `${attitudeLabel} (Vassal to ${hostLabel})`;
}
