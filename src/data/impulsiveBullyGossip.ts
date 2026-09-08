import type { GossipDefinition } from '../types/gossip';
const insults = [
  'Your leader has the strategic instincts of a decorative vase.',
  'I have reviewed your nation. I remain unconvinced.',
  'Your army is impressive. I assume there is another one somewhere.',
  'Some countries make history. Others mostly make paperwork.',
  'Your ministers have mistaken my patience for an interest in their opinions.',
  'Nobody has ever been treated this unfairly. Your government should apologize for the inconvenience.',
  'Yesterday I called you a great friend. Today your judgment has become historically disappointing.',
  'Their hostile retaliation will not go unanswered. We offered fairness; they responded with aggression.',
];
const threats = [
  'We could defeat you. We simply have more important things scheduled.',
  'You have until tomorrow to show respect. Our timetable is otherwise extremely flexible.',
  'Our generals have been asked to examine your borders. They were not told which side.',
  'The consequences will be immense. I have asked someone to determine the exact size.',
  'Our patience has limits. I alone decide where they are, sometimes after you have crossed them.',
  'Your government has endangered everything over a matter I cannot currently recall.',
];
export const BULLY_GOSSIP: readonly GossipDefinition[] = [
  ...insults.map((textTemplate, i): GossipDefinition => ({ id: `bully_insult_${i}`, type: 'insult',
    textTemplate, requiresTarget: false, automaticOnly: true, insultWeight: 1, insultSubtype: 'provocation', flavorContexts: ['bully_insult'] })),
  ...threats.map((textTemplate, i): GossipDefinition => ({ id: `bully_threat_${i}`, type: 'insult',
    textTemplate, requiresTarget: false, automaticOnly: true, insultWeight: 1, insultSubtype: 'threat', flavorContexts: ['bully_threat'] })),
];
