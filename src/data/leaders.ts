import type { LeaderDefinition } from '../types/leader';
import {
  DEFAULT_AI_LEADER_PERSONALITY,
  type AILeaderPersonality,
} from '../types/aiLeaderPersonality';
import { getIdeologyById } from './ideologies';
import type { IdeologyDefinition } from '../types/ideology';
import { getAIMilitaryDoctrineById } from './aiMilitaryDoctrines';
import type { AIMilitaryDoctrine } from '../types/aiMilitaryDoctrine';
import type { CovertPersonalityId } from '../types/covertPersonality';
import { DEFAULT_COVERT_PERSONALITY_ID } from './covertPersonalities';

const LEADER_IMAGE_BASE = '/assets/sprites/leaders';

export const ALL_LEADERS: LeaderDefinition[] = [
  {
    id: 'leader_henry_v',
    name: 'Henry V',
    nationId: 'nation_england',
    title: 'King of England',
    image: `${LEADER_IMAGE_BASE}/henry-v.png`,
    description: 'A martial king remembered for disciplined campaigns and a hard edge in war.',
    ideologyId: 'militarism',
    aiMilitaryDoctrineId: 'navalPower',
    aiPersonality: {
      aggressionBias: 15,
      expansionBias: 5,
      economyBias: 0,
      cultureBias: -5,
      diplomacyBias: -5,
      warTolerance: 75,
      peacePreference: 30,
      minimumUnitsLostBeforePeace: 6,
      casualtyToleranceRatio: 0.55,
    },
  },
  {
    id: 'leader_charles_vii',
    name: 'Charles VII',
    nationId: 'nation_france',
    title: 'King of France',
    image: `${LEADER_IMAGE_BASE}/charles-vi.png`,
    description: 'A prestige-minded restorer of French authority, leaning on courtly culture, diplomacy, and monumental soft power.',
    ideologyId: 'traditionalism',
    aiMilitaryDoctrineId: 'culturalDefense',
    aiNationalAgendaId: 'culture',
    culturePriorities: ['code_of_laws', 'foreign_trade', 'mysticism', 'state_workforce', 'political_philosophy', 'drama_poetry', 'recorded_history'],
    aiPersonality: {
      aggressionBias: -12,
      expansionBias: 6,
      economyBias: 5,
      cultureBias: 28,
      diplomacyBias: 12,
      warTolerance: 30,
      peacePreference: 75,
      minimumUnitsLostBeforePeace: 2,
      casualtyToleranceRatio: 0.25,
    },
  },
  {
    id: 'leader_sigismund',
    name: 'Sigismund',
    nationId: 'nation_hre',
    title: 'Holy Roman Emperor',
    image: `${LEADER_IMAGE_BASE}/sigismund.png`,
    description: 'An imperial broker balancing crowns, councils, and competing princes.',
    ideologyId: 'conservatism',
    aiMilitaryDoctrineId: 'religiousMilitia',
    aiPersonality: {
      aggressionBias: -5,
      expansionBias: 0,
      economyBias: 5,
      cultureBias: 10,
      diplomacyBias: 10,
      warTolerance: 40,
      peacePreference: 65,
      minimumUnitsLostBeforePeace: 2,
      casualtyToleranceRatio: 0.30,
    },
  },
  {
    id: 'leader_gustav_vasa',
    name: 'Gustav Vasa',
    nationId: 'nation_sweden',
    title: 'King of Sweden',
    image: `${LEADER_IMAGE_BASE}/gustaf-vasa.png`,
    description: 'A determined state-builder with an eye for independence and order.',
    ideologyId: 'nationalism',
    aiMilitaryDoctrineId: 'navalPower',
    aiPersonality: {
      aggressionBias: 5,
      expansionBias: 10,
      economyBias: 10,
      cultureBias: 0,
      diplomacyBias: 0,
      warTolerance: 55,
      peacePreference: 45,
      minimumUnitsLostBeforePeace: 3,
      casualtyToleranceRatio: 0.40,
    },
  },
  {
    id: 'leader_vytautas',
    name: 'Vytautas the Great',
    nationId: 'nation_lithuania',
    title: 'Grand Duke of Lithuania',
    image: `${LEADER_IMAGE_BASE}/vytautas-the-great.png`,
    description: 'An ambitious grand duke whose realm looks across the eastern frontier.',
    ideologyId: 'nationalism',
    aiMilitaryDoctrineId: 'economicMinimalArmy',
    aiPersonality: {
      aggressionBias: 8,
      expansionBias: 12,
      economyBias: 0,
      cultureBias: 0,
      diplomacyBias: -2,
      warTolerance: 60,
      peacePreference: 45,
      minimumUnitsLostBeforePeace: 4,
      casualtyToleranceRatio: 0.45,
    },
  },
  {
    id: 'leader_marfa_boretskaya',
    name: 'Marfa Boretskaya',
    nationId: 'nation_novgorod',
    title: 'Posadnitsa of Novgorod',
    image: `${LEADER_IMAGE_BASE}/marfa-boretskaya.png`,
    description: 'A formidable civic figure standing for Novgorod tradition and autonomy.',
    ideologyId: 'conservatism',
    aiMilitaryDoctrineId: 'disciplinedInfantry',
    aiPersonality: {
      aggressionBias: -8,
      expansionBias: -5,
      economyBias: 10,
      cultureBias: 10,
      diplomacyBias: 8,
      warTolerance: 35,
      peacePreference: 70,
      minimumUnitsLostBeforePeace: 2,
      casualtyToleranceRatio: 0.25,
    },
  },
  {
    id: 'leader_mehmed_ii',
    name: 'Mehmed II',
    nationId: 'nation_ottoman',
    title: 'Sultan of the Ottoman Empire',
    image: `${LEADER_IMAGE_BASE}/mehmed-i.png`,
    description: 'A conqueror-sultan with a taste for decisive campaigns and imperial ambition.',
    ideologyId: 'militarism',
    aiMilitaryDoctrineId: 'mountedAggression',
    aiPersonality: {
      aggressionBias: 20,
      expansionBias: 15,
      economyBias: 0,
      cultureBias: 0,
      diplomacyBias: -10,
      warTolerance: 85,
      peacePreference: 20,
      minimumUnitsLostBeforePeace: 8,
      casualtyToleranceRatio: 0.70,
    },
  },
  {
    id: 'leader_isabella_i',
    name: 'Isabella I',
    nationId: 'nation_spain',
    title: 'Queen of Castile',
    image: `${LEADER_IMAGE_BASE}/isabella.png`,
    description: 'A dynastic ruler focused on unity, faith, and royal authority.',
    ideologyId: 'traditionalism',
    aiMilitaryDoctrineId: 'cheapInfantrySwarm',
    aiPersonality: {
      aggressionBias: 5,
      expansionBias: 5,
      economyBias: 5,
      cultureBias: 10,
      diplomacyBias: 5,
      warTolerance: 55,
      peacePreference: 55,
      minimumUnitsLostBeforePeace: 3,
      casualtyToleranceRatio: 0.40,
    },
  },
  {
    id: 'leader_abu_said_uthman_ii',
    name: 'Abu Said Uthman II',
    nationId: 'nation_morocco_empire',
    title: 'Sultan of Morocco',
    image: `${LEADER_IMAGE_BASE}/abu-al-hasan.png`,
    description: 'A Maghrebi ruler anchoring Moroccan power across western trade routes.',
    ideologyId: 'globalism',
    aiMilitaryDoctrineId: 'religiousMilitia',
    aiPersonality: {
      aggressionBias: 0,
      expansionBias: 5,
      economyBias: 12,
      cultureBias: 4,
      diplomacyBias: 4,
      warTolerance: 50,
      peacePreference: 55,
      minimumUnitsLostBeforePeace: 3,
      casualtyToleranceRatio: 0.35,
    },
  },
  {
    id: 'leader_george-washington',
    name: 'George Washington',
    nationId: 'nation_usa',
    title: 'President George Washington',
    image: `${LEADER_IMAGE_BASE}/george-washington.png`,
    description: 'A visionary founding father focused on liberty, stability, and national unity.',
    ideologyId: 'liberalism',
    aiMilitaryDoctrineId: 'eliteArmy',
    aiPersonality: {
      aggressionBias: -2,
      expansionBias: 8,
      economyBias: 8,
      cultureBias: 4,
      diplomacyBias: 8,
      warTolerance: 50,
      peacePreference: 60,
      minimumUnitsLostBeforePeace: 3,
      casualtyToleranceRatio: 0.35,
    },
  },
  {
    id: 'leader_mahatma-gandhi',
    name: 'Gandhi',
    nationId: 'nation_india',
    title: 'Mahatma Gandhi',
    image: `${LEADER_IMAGE_BASE}/mahatma-gandhi.png`,
    description: 'A spiritual leader focused on non-violence, civil disobedience, and national liberation.',
    ideologyId: 'liberalism',
    aiMilitaryDoctrineId: 'defensiveModern',
    culturePriorities: ['early_empire', 'state_workforce', 'mysticism', 'political_philosophy', 'games_recreation'],
    aiPersonality: {
      aggressionBias: -15,
      expansionBias: -5,
      economyBias: 4,
      cultureBias: 12,
      diplomacyBias: 15,
      warTolerance: 20,
      peacePreference: 85,
      minimumUnitsLostBeforePeace: 1,
      casualtyToleranceRatio: 0.20,
    },
  },
  {
    id: 'leader_qin-shi-huang',
    name: 'Qin Shi Huang',
    nationId: 'nation_china',
    title: 'Emperor Qin Shi Huang',
    image: `${LEADER_IMAGE_BASE}/qin-shi-huang.png`,
    description: 'An imperial unifier focused on administration, infrastructure, discipline, and centralized expansion.',
    ideologyId: 'nationalism',
    aiMilitaryDoctrineId: 'imperialCombinedArms',
    culturePriorities: ['state_workforce', 'early_empire', 'political_philosophy', 'recorded_history', 'civil_service_civics', 'guilds'],
    aiPersonality: {
      aggressionBias: 5,
      expansionBias: 10,
      economyBias: 10,
      cultureBias: 6,
      diplomacyBias: -3,
      warTolerance: 55,
      peacePreference: 45,
      minimumUnitsLostBeforePeace: 4,
      casualtyToleranceRatio: 0.45,
    },
  },
  {
    id: 'leader_koxinga',
    name: 'Koxinga',
    nationId: 'nation_taiwan',
    title: 'Zheng Chenggong',
    image: `${LEADER_IMAGE_BASE}/koxinga.png`,
    description: 'A maritime commander focused on trade, diplomacy, technology, and resilient island defense.',
    ideologyId: 'globalism',
    aiMilitaryDoctrineId: 'maritimeRaider',
    culturePriorities: ['foreign_trade', 'state_workforce', 'political_philosophy', 'recorded_history', 'civil_service_civics', 'diplomatic_service'],
    aiPersonality: {
      aggressionBias: -4,
      expansionBias: 4,
      economyBias: 16,
      cultureBias: 4,
      diplomacyBias: 10,
      warTolerance: 45,
      peacePreference: 65,
      minimumUnitsLostBeforePeace: 2,
      casualtyToleranceRatio: 0.30,
    },
  },
  {
    id: 'leader_dom-pedro-ii',
    name: 'Dom Pedro II',
    nationId: 'nation_brazil',
    title: 'Emperor Dom Pedro II',
    image: `${LEADER_IMAGE_BASE}/dom-pedro-ii.png`,
    description: 'An enlightened monarch focused on scientific progress, cultural growth, and diplomatic stability.',
    ideologyId: 'progressivism',
    aiMilitaryDoctrineId: 'fortifiedDefense',
    aiPersonality: {
      aggressionBias: -5,
      expansionBias: 0,
      economyBias: 10,
      cultureBias: 12,
      diplomacyBias: 10,
      warTolerance: 40,
      peacePreference: 70,
      minimumUnitsLostBeforePeace: 2,
      casualtyToleranceRatio: 0.30,
    },
  },
  {
    id: 'leader_mansa-musa',
    name: 'Mansa Musa',
    nationId: 'nation_mali_empire',
    title: 'Emperor Mansa Musa',
    image: `${LEADER_IMAGE_BASE}/mansa-musa.png`,
    description: 'A legendary sovereign focused on immense wealth, trans-Saharan trade, and intellectual enlightenment.',
    ideologyId: 'globalism',
    aiMilitaryDoctrineId: 'disciplinedInfantry',
    aiPersonality: {
      aggressionBias: -5,
      expansionBias: 0,
      economyBias: 20,
      cultureBias: 8,
      diplomacyBias: 8,
      warTolerance: 35,
      peacePreference: 70,
      minimumUnitsLostBeforePeace: 2,
      casualtyToleranceRatio: 0.25,
    },
  },
  {
    id: 'leader_genghis-khan',
    name: 'Genghis Khan',
    nationId: 'nation_mongolia',
    title: 'Great Khan of the Mongols',
    image: `${LEADER_IMAGE_BASE}/genghis-khan.png`,
    description: 'A relentless conqueror whose horse-borne armies carve empires from the steppe.',
    ideologyId: 'militarism',
    aiMilitaryDoctrineId: 'steppeHorde',
    culturePriorities: ['early_empire'],
    aiPersonality: {
      aggressionBias: 18,
      expansionBias: 18,
      economyBias: 0,
      cultureBias: -5,
      diplomacyBias: -10,
      warTolerance: 85,
      peacePreference: 20,
      minimumUnitsLostBeforePeace: 8,
      casualtyToleranceRatio: 0.70,
    },
  },
  {
    id: 'leader_oda-nobunaga',
    name: 'Oda Nobunaga',
    nationId: 'nation_japan',
    title: 'Daimyo of Owari',
    image: `${LEADER_IMAGE_BASE}/oda-nobunaga.png`,
    description: 'A ruthless unifier of the islands, balancing martial prowess with disciplined defense.',
    ideologyId: 'militarism',
    aiMilitaryDoctrineId: 'maritimeRaider',
    aiPersonality: {
      aggressionBias: 15,
      expansionBias: 8,
      economyBias: 5,
      cultureBias: 5,
      diplomacyBias: -5,
      warTolerance: 70,
      peacePreference: 35,
      minimumUnitsLostBeforePeace: 5,
      casualtyToleranceRatio: 0.55,
    },
  },
  {
    // First-pass Denmark: mirrors Japan's (Oda Nobunaga's) doctrine, agenda,
    // ideology, and AI personality. Only the nation, leader, and assets differ.
    // Denmark-specific behaviour will be introduced later.
    id: 'leader_christian-iv',
    name: 'Christian IV',
    nationId: 'nation_denmark',
    title: 'King of Denmark and Norway',
    image: `${LEADER_IMAGE_BASE}/christian-iv.png`,
    description: 'An ambitious builder-king, balancing martial prowess with disciplined defense.',
    ideologyId: 'militarism',
    aiMilitaryDoctrineId: 'maritimeRaider',
    aiPersonality: {
      aggressionBias: 15,
      expansionBias: 8,
      economyBias: 5,
      cultureBias: 5,
      diplomacyBias: -5,
      warTolerance: 70,
      peacePreference: 35,
      minimumUnitsLostBeforePeace: 5,
      casualtyToleranceRatio: 0.55,
    },
  },
  {
    // Mad Jack — a fantasy one-city pirate warlord. Not balanced for victory:
    // a maritime wildcard meant to harass stronger powers. Expansion is
    // intentionally suppressed (maxPreferredCities: 1); his naval identity comes
    // from the Pirate Code doctrine + Sea Wolf era strategy + Freebooters ideology.
    id: 'leader_mad_jack',
    name: 'Mad Jack',
    nationId: 'nation_pirate',
    title: 'Pirate Lord of the Free Seas',
    image: `${LEADER_IMAGE_BASE}/pirate.png`,
    description: 'A roguish freebooter who answers to no crown — dominating shipping lanes, plundering coasts, and sowing chaos wherever stronger powers grow comfortable.',
    ideologyId: 'freebooters',
    aiMilitaryDoctrineId: 'pirateCode',
    aiNationalAgendaId: 'naval_power',
    // Pirates care nothing for high culture; only a single early node nudges the tree.
    culturePriorities: ['foreign_trade'],
    maxPreferredCities: 1,
    aiPersonality: {
      // Aggressive, opportunistic, and fickle: quick to war, slow to befriend,
      // but not suicidally stubborn — players can still buy his alliance.
      aggressionBias: 22,
      expansionBias: -12,
      economyBias: 6,
      cultureBias: -12,
      diplomacyBias: -14,
      warTolerance: 80,
      peacePreference: 30,
      minimumUnitsLostBeforePeace: 4,
      casualtyToleranceRatio: 0.50,
    },
  },
  {
    // Hermann the Cheruscan (Arminius) — a tribal-confederation defender: fierce
    // homeland resistance against larger empires rather than world conquest.
    // Nationalist identity, disciplined land army, distrust of dominant powers,
    // and (per his historical reliance on intelligence and deception) a paranoid
    // covert posture. Music/art live under nation_germany.
    id: 'hermann-the-cheruscan',
    name: 'Hermann the Cheruscan',
    nationId: 'nation_germany',
    title: 'Chieftain of the Cherusci',
    image: `${LEADER_IMAGE_BASE}/hermann-the-cheruscan.png`,
    description: "Hermann the Cheruscan, known to the Romans as Arminius, united Germanic tribes against Roman expansion and achieved one of history's most famous victories in the Teutoburg Forest. A skilled strategist who understood both Roman military doctrine and tribal warfare, Hermann represents independence, resilience, and fierce resistance against foreign domination. Under his leadership, alliances are forged through necessity, enemies are watched carefully, and freedom is defended at any cost.",
    ideologyId: 'nationalism',
    aiMilitaryDoctrineId: 'disciplinedInfantry',
    aiNationalAgendaId: 'homeland_defense',
    covertPersonalityId: 'paranoid',
    aiPersonality: {
      // Fierce homeland defender: ready to fight and punish aggressors, resilient
      // to the end (high casualty tolerance), little interest in culture/science,
      // only moderate expansion. Wary of others but will ally against stronger foes.
      aggressionBias: 10,
      expansionBias: 3,
      economyBias: 2,
      cultureBias: -10,
      diplomacyBias: -2,
      warTolerance: 70,
      peacePreference: 40,
      minimumUnitsLostBeforePeace: 6,
      casualtyToleranceRatio: 0.60,
    },
    diplomacyFlavor: {
      greeting: 'I am Hermann of the Cherusci. Speak plainly — we have learned to be cautious with strangers who come bearing fine words.',
      friendly: 'Between free peoples there is loyalty, and against the great powers there is strength in standing together. Our shields are at your side.',
      neutral: 'We watch the movements of all nations, yours among them. Walk carefully near our forests.',
      hostile: 'No empire dictates terms to free men. Press us further and you will learn what the legions learned.',
      warDeclaration: 'You reach for what is ours. Then it is settled — we defend our homeland and our freedom, whatever the cost.',
      victory: 'The tribes endure, free and unbroken. Let every empire remember the price of crossing into our lands.',
      defeat: 'You may take this ground, but freedom is not so easily conquered. Free peoples endure, and they remember.',
    },
  },
  {
    // Ivan IV (Ivan the Terrible) — a paranoid imperial empire-builder. Expansionist
    // and militaristic like Mongolia, but the deliberate twist: instead of the
    // nomadic steppeHorde's impulsive rush, he accumulates a large combined-arms
    // standing army (imperialCombinedArms: high strength/unit budget, tolerates war
    // weariness) and pressures neighbors over time. Distrustful diplomacy — low
    // alliance willingness, lasting hostility, quick to threaten — is reinforced by
    // the paranoid covert posture and the Military Power agenda. Assets live under
    // leaders/ivan-iv and nation_russia.
    id: 'ivan-iv',
    name: 'Ivan IV',
    nationId: 'nation_russia',
    title: 'Ivan the Terrible',
    image: `${LEADER_IMAGE_BASE}/ivan-iv.png`,
    description: 'Ivan IV transformed Russia from a regional kingdom into an expanding empire. Ruthless toward rivals and feared by neighbors, he centralized power, crushed opposition and pushed Russian influence across vast frontiers. Under his rule, military strength and territorial expansion took precedence over diplomacy.',
    ideologyId: 'militarism',
    aiMilitaryDoctrineId: 'imperialCombinedArms',
    aiNationalAgendaId: 'military_power',
    covertPersonalityId: 'paranoid',
    culturePriorities: ['early_empire', 'state_workforce'],
    aiPersonality: {
      // Aggressive and strongly expansionist, but less impulsive than Genghis/Mehmed:
      // a lower war tolerance means he builds up military strength before striking,
      // while very low diplomacy and peace preference keep him alliance-averse, slow
      // to forgive, and hostile for long stretches.
      aggressionBias: 14,
      expansionBias: 14,
      economyBias: 4,
      cultureBias: -8,
      diplomacyBias: -12,
      warTolerance: 72,
      peacePreference: 30,
      minimumUnitsLostBeforePeace: 6,
      casualtyToleranceRatio: 0.60,
    },
    diplomacyFlavor: {
      greeting: 'I am Ivan, Tsar of all the Russias. Speak — but know that I trust no crown that smiles too easily.',
      friendly: 'For now our interests run together. See that they continue to, lest my patience wear thin.',
      neutral: 'Russia watches its borders, and its neighbors. We forget nothing, and we forgive little.',
      hostile: 'You overreach. Russia has swallowed greater powers than yours and felt no hunger after.',
      warDeclaration: 'I have measured your strength and found it wanting. The frontier will move — at your expense.',
      victory: 'The empire grows, as it was always destined to. Let every rival remember who was master here.',
      defeat: 'So the throne falls. Yet Russia endures the cold, the famine, and the conqueror alike — and it remembers.',
    },
  },
];

/**
 * Per-scenario leader overrides, keyed by nationId. Installed once at game start
 * via {@link setScenarioLeaderOverrides} and applied transparently by every
 * leader accessor below, so a scenario-authored leader name/description flows
 * through the whole game without each call site knowing about it.
 */
const scenarioLeaderOverrides = new Map<string, { name?: string; description?: string }>();

/** Minimal shape needed from a scenario nation to derive a leader override. */
interface ScenarioLeaderSource {
  id: string;
  leaderName?: string;
  leaderDescription?: string;
}

/**
 * Replace the active scenario leader overrides from the given nations. Empty /
 * whitespace-only values are ignored, so the built-in leader name/description is
 * used as the fallback. Call once when a scenario becomes active (game start or
 * setup-screen selection); it clears any previously installed overrides first.
 */
export function setScenarioLeaderOverrides(nations: readonly ScenarioLeaderSource[]): void {
  scenarioLeaderOverrides.clear();
  for (const nation of nations) {
    const name = nation.leaderName?.trim();
    const description = nation.leaderDescription?.trim();
    if (!name && !description) continue;
    scenarioLeaderOverrides.set(nation.id, {
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
    });
  }
}

/** Apply any installed override to a leader, returning an overridden copy. */
function applyLeaderOverride(leader: LeaderDefinition | undefined): LeaderDefinition | undefined {
  if (!leader) return leader;
  const override = scenarioLeaderOverrides.get(leader.nationId);
  if (!override) return leader;
  return {
    ...leader,
    name: override.name ?? leader.name,
    description: override.description ?? leader.description,
  };
}

export function getLeaderByNationId(nationId: string): LeaderDefinition | undefined {
  return applyLeaderOverride(ALL_LEADERS.find((leader) => leader.nationId === nationId));
}

export function getLeaderById(leaderId: string): LeaderDefinition | undefined {
  return applyLeaderOverride(ALL_LEADERS.find((leader) => leader.id === leaderId));
}

export function getLeaderIdeologyByNationId(nationId: string): IdeologyDefinition {
  return getIdeologyById(getLeaderByNationId(nationId)?.ideologyId);
}

export function getLeaderIdeologyById(leaderId: string): IdeologyDefinition {
  return getIdeologyById(getLeaderById(leaderId)?.ideologyId);
}

export function getLeaderPersonalityByNationId(nationId: string): AILeaderPersonality {
  return getLeaderByNationId(nationId)?.aiPersonality ?? DEFAULT_AI_LEADER_PERSONALITY;
}

export function getLeaderMilitaryDoctrineByNationId(nationId: string): AIMilitaryDoctrine {
  return getAIMilitaryDoctrineById(getLeaderByNationId(nationId)?.aiMilitaryDoctrineId);
}

export function getLeaderMilitaryDoctrineById(leaderId: string): AIMilitaryDoctrine {
  return getAIMilitaryDoctrineById(getLeaderById(leaderId)?.aiMilitaryDoctrineId);
}

/**
 * Default covert personality per leader, applied when a leader/scenario does not
 * specify one. Kept as a map so we get variety without editing every leader
 * entry; deliberately spread across personalities rather than perfectly tuned.
 */
const LEADER_COVERT_PERSONALITY_DEFAULTS: Record<string, CovertPersonalityId> = {
  leader_henry_v: 'opportunist',
  leader_charles_vii: 'honorable',
  leader_sigismund: 'pragmatist',
  leader_gustav_vasa: 'opportunist',
  leader_vytautas: 'opportunist',
  leader_marfa_boretskaya: 'merchant',
  leader_mehmed_ii: 'fanatic',
  leader_isabella_i: 'fanatic',
  leader_abu_said_uthman_ii: 'merchant',
  'leader_george-washington': 'honorable',
  'leader_mahatma-gandhi': 'honorable',
  'leader_qin-shi-huang': 'schemer',
  leader_koxinga: 'merchant',
  'leader_dom-pedro-ii': 'honorable',
  'leader_mansa-musa': 'merchant',
  'leader_genghis-khan': 'opportunist',
  'leader_oda-nobunaga': 'schemer',
  'leader_christian-iv': 'opportunist',
  leader_mad_jack: 'pirate',
};

/**
 * Resolve a leader's covert personality id: explicit field first, then the
 * per-leader default map, then the neutral global default.
 */
export function getLeaderCovertPersonalityId(leaderId: string | undefined): CovertPersonalityId {
  if (leaderId === undefined) return DEFAULT_COVERT_PERSONALITY_ID;
  const leader = getLeaderById(leaderId);
  return leader?.covertPersonalityId
    ?? LEADER_COVERT_PERSONALITY_DEFAULTS[leaderId]
    ?? DEFAULT_COVERT_PERSONALITY_ID;
}

export function getLeaderCovertPersonalityByNationId(nationId: string): CovertPersonalityId {
  const leader = getLeaderByNationId(nationId);
  return leader?.covertPersonalityId
    ?? (leader ? LEADER_COVERT_PERSONALITY_DEFAULTS[leader.id] : undefined)
    ?? DEFAULT_COVERT_PERSONALITY_ID;
}

/**
 * The leader-specific cap on voluntarily founded cities, or undefined when the
 * leader imposes no cap (strategy desiredCityCount applies as usual). Used by
 * the AI to enforce one-city / tall-play leaders such as Mad Jack.
 */
export function getLeaderMaxPreferredCitiesByNationId(nationId: string): number | undefined {
  return getLeaderByNationId(nationId)?.maxPreferredCities;
}
