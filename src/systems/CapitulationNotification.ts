import type { DiscoveryPopupData } from '../ui/hud/DiscoveryPopup';
import type { CapitulationAppliedEvent } from './CapitulationSystem';

/** The victor and surrendering player already have their own decision dialogs. */
export function buildCapitulationNotification(
  event: CapitulationAppliedEvent,
  humanNationId: string | undefined,
  nationName: (id: string) => string,
): DiscoveryPopupData | undefined {
  if (!humanNationId || humanNationId === event.demandingNationId
    || humanNationId === event.capitulatingNationId
    || !event.formerEnemyIds.includes(humanNationId)) return undefined;
  const defeated = nationName(event.capitulatingNationId);
  const victor = nationName(event.demandingNationId);
  return {
    title: `War with ${defeated} has ended`,
    imageKey: 'capitulation_peace_notice',
    imagePath: '/assets/sprites/news/peace-signed.png',
    description: `${defeated} has capitulated to ${victor} and become its vassal. `
      + `All its wars have ended, including its war with ${nationName(humanNationId)}.`,
    unlockRows: [],
    leadsToRows: [],
    hideProgression: true,
  };
}
