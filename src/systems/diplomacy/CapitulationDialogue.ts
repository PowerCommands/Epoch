import { getLeaderByNationId } from '../../data/leaders';
import type { MilitaryVassalizationEvent } from './MilitaryVassalizationSystem';

export const CAPITULATION_PHRASES = [
  'I mistook my pride for strength. You have stripped me of both. I surrender; my nation will bow to your rule.',
  'I promised my people victory. Now I must ask you for mercy. We lay down our arms and accept our place as your vassal.',
  'There is no triumph left for me to claim, no speech that can disguise this defeat. You have won. We submit to your authority.',
  'I once believed you would kneel before me. Instead, I stand here begging you to end this war. We surrender and accept your rule.',
  'My threats ring hollow now. Your victory is complete, and my pride is all I have left to swallow. My nation is your vassal.',
  'Let the record show that you broke our resistance. I will sign the surrender with the same hand that declared we could never lose.',
] as const;

export function createCapitulationDialogue(
  event: MilitaryVassalizationEvent,
  humanNationId: string | undefined,
  nationName: (id: string) => string,
  random: () => number = Math.random,
): { leaderId: string; message: string } | undefined {
  if (!humanNationId || event.victorNationId !== humanNationId) return undefined;
  const leader = getLeaderByNationId(event.defeatedNationId);
  if (!leader) return undefined;
  const phrase = CAPITULATION_PHRASES[Math.min(CAPITULATION_PHRASES.length - 1,
    Math.max(0, Math.floor(random() * CAPITULATION_PHRASES.length)))];
  return {
    leaderId: leader.id,
    message: `“${phrase}”\n\n${nationName(event.defeatedNationId)} has been defeated and is now your vassal. The war is over.`,
  };
}
