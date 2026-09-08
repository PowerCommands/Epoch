import type { GossipDefinition, GossipFlavorContext } from '../types/gossip';

/** Contextual provocations reuse Gossip's canonical definition and History paths. */
const stages: readonly [GossipFlavorContext, readonly string[]][] = [
  ['opportunity_mockery', [
    'Does your entire army attend these parades, or are a few soldiers still expected?',
    'Your banners promise rather more protection than the men beneath them.',
    'I admire how little you spend persuading your neighbors to respect you.',
    'Your generals must find their roll calls refreshingly brief.',
  ]],
  ['opportunity_intimidation', [
    'Before you refuse us, consider who would be asked to defend that refusal.',
    'Good relations with us are doing much of the work your army ought to do.',
    'Your independence deserves a larger guard than you have provided it.',
    'We notice the gaps in your defenses, even when you prefer not to discuss them.',
  ]],
  ['opportunity_territorial', [
    'Some of your frontier towns lie rather far from anyone who could protect them.',
    'Maps have a habit of following armies. Yours seem unlikely to lead the way.',
    'You claim a great deal of land for a ruler with so few men to hold it.',
    'A border is a promise that someone will defend it. Yours is beginning to sound hollow.',
  ]],
  ['opportunity_military', [
    'If our columns cross your frontier, I doubt your army can stop the first one.',
    'Recruit quickly. Our patience is now a larger obstacle than your defenses.',
    'Your ministers should consider what terms they could accept before our armies meet.',
    'We are weighing the cost of a campaign against you. Your army is making the calculation easy.',
  ]],
];
export const OPPORTUNISTIC_GOSSIP: readonly GossipDefinition[] = stages.flatMap(([context, lines], stage) =>
  lines.map((textTemplate, index) => ({
    id: `${context}_${index + 1}`, type: 'insult', textTemplate, requiresTarget: false, automaticOnly: true,
    insultWeight: 1 + stage * 0.25,
    insultSubtype: stage === 0 ? 'provocation' : 'threat',
    flavorContexts: [context],
    // Tension belongs to the reversible opportunity memory; these automatic
    // remarks never apply permanent interactive Gossip penalties.
  })));
