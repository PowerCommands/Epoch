import { ASIAN_LEADERS } from './asianLeaders';
import { MIDDLE_EASTERN_LEADERS } from './middleEasternLeaders';
import { MODERN_ALTERNATIVE_LEADERS } from './modernAlternativeLeaders';
import { applyBehaviorOverride } from './leaderConfiguration';
import type { LeaderDefinition } from '../types/leader';
import {
  DEFAULT_AI_LEADER_PERSONALITY,
  resolveExploitationInterest,
  type AILeaderPersonality,
  type ExploitationInterestLevel,
} from '../types/aiLeaderPersonality';
import { getIdeologyById } from './ideologies';
import type { IdeologyDefinition } from '../types/ideology';
import { getAIMilitaryDoctrineById } from './aiMilitaryDoctrines';
import type { AIMilitaryDoctrine } from '../types/aiMilitaryDoctrine';
import type { CovertPersonalityId } from '../types/covertPersonality';
import { DEFAULT_COVERT_PERSONALITY_ID } from './covertPersonalities';
import type { GamesOfNationsLeaderPreferences } from '../types/gamesOfNations';

const LEADER_IMAGE_BASE = '/assets/sprites/leaders';

const DEFAULT_LEADERS_WITHOUT_GAMES_PREFERENCES: Array<Omit<LeaderDefinition, 'gamesOfNationsPreferences' | 'isDefault'>> = [
  {
    id: 'leader_henry_v',
    name: 'Henry V',
    opportunism: true,
    nationId: 'nation_england',
    title: 'King of England',
    image: `${LEADER_IMAGE_BASE}/henry-v.png`,
    description: 'A martial king remembered for disciplined campaigns and a hard edge in war.',
    ideologyId: 'militarism',
    aiMilitaryDoctrineId: 'navalPower',
    aiPersonality: {
      resourceExploitationInterest: 3,
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
      resourceExploitationInterest: 1,
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
      resourceExploitationInterest: 1,
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
      resourceExploitationInterest: 2,
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
      resourceExploitationInterest: 3,
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
      resourceExploitationInterest: 1,
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
    opportunism: true,
    nationId: 'nation_ottoman',
    title: 'Sultan of the Ottoman Empire',
    image: `${LEADER_IMAGE_BASE}/mehmed-i.png`,
    description: 'A conqueror-sultan with a taste for decisive campaigns and imperial ambition.',
    ideologyId: 'militarism',
    aiMilitaryDoctrineId: 'mountedAggression',
    aiPersonality: {
      resourceExploitationInterest: 4,
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
      resourceExploitationInterest: 4,
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
      resourceExploitationInterest: 2,
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
      resourceExploitationInterest: 1,
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
      resourceExploitationInterest: 0,
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
    opportunism: true,
    nationId: 'nation_china',
    title: 'Emperor Qin Shi Huang',
    image: `${LEADER_IMAGE_BASE}/qin-shi-huang.png`,
    description: 'An imperial unifier focused on administration, infrastructure, discipline, and centralized expansion.',
    ideologyId: 'nationalism',
    aiMilitaryDoctrineId: 'imperialCombinedArms',
    culturePriorities: ['state_workforce', 'early_empire', 'political_philosophy', 'recorded_history', 'civil_service_civics', 'guilds'],
    aiPersonality: {
      resourceExploitationInterest: 3,
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
      resourceExploitationInterest: 2,
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
      resourceExploitationInterest: 1,
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
      resourceExploitationInterest: 3,
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
    opportunism: true,
    nationId: 'nation_mongolia',
    title: 'Great Khan of the Mongols',
    image: `${LEADER_IMAGE_BASE}/genghis-khan.png`,
    description: 'A relentless conqueror whose horse-borne armies carve empires from the steppe.',
    ideologyId: 'militarism',
    aiMilitaryDoctrineId: 'steppeHorde',
    culturePriorities: ['early_empire'],
    aiPersonality: {
      resourceExploitationInterest: 4,
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
    opportunism: true,
    nationId: 'nation_japan',
    title: 'Daimyo of Owari',
    image: `${LEADER_IMAGE_BASE}/oda-nobunaga.png`,
    description: 'A ruthless unifier of the islands, balancing martial prowess with disciplined defense.',
    ideologyId: 'militarism',
    aiMilitaryDoctrineId: 'maritimeRaider',
    aiPersonality: {
      resourceExploitationInterest: 3,
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
      resourceExploitationInterest: 2,
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
    impulsiveBully: true,
    opportunism: true,
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
      resourceExploitationInterest: 1,
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
      resourceExploitationInterest: 0,
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
    impulsiveBully: true,
    opportunism: true,
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
      resourceExploitationInterest: 4,
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
  {
    id: 'leader_joseph_stalin',
    name: 'Joseph Stalin',
    opportunism: true,
    nationId: 'nation_soviet_union',
    title: 'General Secretary',
    image: `${LEADER_IMAGE_BASE}/joseph-stalin.png`,
    description: 'The authoritarian Soviet leader who drove rapid industrialization, concentrated state power, and led the Soviet Union through World War II.',
    ideologyId: 'militarism',
    aiMilitaryDoctrineId: 'imperialCombinedArms',
    aiNationalAgendaId: 'military_power',
    covertPersonalityId: 'paranoid',
    culturePriorities: ['state_workforce', 'early_empire', 'totalitarianism', 'class_struggle'],
    aiPersonality: {
      resourceExploitationInterest: 3,
      aggressionBias: 12,
      expansionBias: 10,
      economyBias: 14,
      cultureBias: -8,
      diplomacyBias: -14,
      warTolerance: 78,
      peacePreference: 24,
      minimumUnitsLostBeforePeace: 7,
      casualtyToleranceRatio: 0.65,
    },
    diplomacyFlavor: {
      greeting: 'The Soviet Union listens. Speak clearly, and do not mistake patience for weakness.',
      friendly: 'Our states have found common purpose. Let discipline and mutual interest keep it so.',
      neutral: 'We judge nations by their actions, not their assurances. The Soviet Union is watching.',
      hostile: 'Your intentions are no longer in doubt. We are prepared for what follows.',
      warDeclaration: 'You have made coexistence impossible. The full strength of the Soviet state will now be brought against you.',
      victory: 'The Soviet state stands stronger than before. History has rendered its judgment.',
      defeat: 'You may occupy our ground, but no victory over such a vast people is ever complete.',
    },
  },
  {
    // Opportunistic prestige-seeker: maintains a substantial mixed force and
    // presses weaker rivals, but remains more sensitive to unfavorable military
    // comparisons than the most committed conquest personalities.
    id: 'leader_benito_mussolini',
    name: 'Benito Mussolini',
    impulsiveBully: true,
    opportunism: true,
    nationId: 'nation_italy',
    title: 'Il Duce',
    image: `${LEADER_IMAGE_BASE}/benito-mussolini.png`,
    description: 'Italy’s Fascist dictator, an authoritarian nationalist who pursued military prestige, territorial expansion, and recognition as a major power.',
    ideologyId: 'nationalism',
    aiMilitaryDoctrineId: 'prestigeProjection',
    aiNationalAgendaId: 'new_roman_empire',
    covertPersonalityId: 'opportunist',
    culturePriorities: ['state_workforce', 'early_empire', 'military_tradition', 'nationalism', 'totalitarianism', 'mobilization'],
    aiPersonality: {
      resourceExploitationInterest: 4,
      aggressionBias: 13,
      expansionBias: 15,
      economyBias: 3,
      cultureBias: -6,
      diplomacyBias: -2,
      warTolerance: 68,
      peacePreference: 38,
      minimumUnitsLostBeforePeace: 5,
      casualtyToleranceRatio: 0.50,
    },
    diplomacyFlavor: {
      greeting: 'Italy expects to be heard among the great powers. Speak, and let us discover whether your proposal is worthy of our attention.',
      friendly: 'Together our nations command respect. Let our partnership increase the prestige and strength of both.',
      neutral: 'Italy watches the balance of power closely. We respect strength, ambition, and those who understand opportunity.',
      hostile: 'Your obstruction is an insult to Italy’s dignity. Do not mistake restraint for weakness.',
      warDeclaration: 'The hour for speeches has ended. Italy now advances to defend its honor and claim the greatness it deserves.',
      victory: 'Italy has demonstrated its strength before the world. Let every nation recognize our renewed greatness.',
      defeat: 'Fortune has turned against us today, but Italy’s pride and ambition will not be erased.',
    },
  },
  {
    // Prepared alliance-builder: credible defensive strength and firm resistance
    // to threats, without the expansion bias of conquest-oriented leaders.
    id: 'leader_wladyslaw_sikorski',
    name: 'Władysław Sikorski',
    nationId: 'nation_poland',
    title: 'General',
    image: `${LEADER_IMAGE_BASE}/wladyslaw-sikorski.png`,
    description: 'A Polish general and statesman defined by military preparedness, diplomatic cooperation, and determination to preserve Poland’s sovereignty.',
    ideologyId: 'conservatism',
    aiMilitaryDoctrineId: 'disciplinedInfantry',
    aiNationalAgendaId: 'poland_shall_endure',
    covertPersonalityId: 'honorable',
    culturePriorities: ['state_workforce', 'early_empire', 'military_tradition', 'defensive_tactics', 'civil_service_civics', 'diplomatic_service', 'nationalism', 'mobilization'],
    aiPersonality: {
      resourceExploitationInterest: 0,
      aggressionBias: 5,
      expansionBias: -4,
      economyBias: 4,
      cultureBias: 0,
      diplomacyBias: 14,
      warTolerance: 66,
      peacePreference: 55,
      minimumUnitsLostBeforePeace: 5,
      casualtyToleranceRatio: 0.55,
    },
    diplomacyFlavor: {
      greeting: 'Poland seeks peace founded on respect, preparedness, and clear commitments. Speak candidly, and you will receive the same.',
      friendly: 'A dependable friend is a source of strength in uncertain times. Poland will honor the commitments we make together.',
      neutral: 'Poland judges nations by their conduct. We prepare for danger, but we remain ready for honest cooperation.',
      hostile: 'Threats will not decide Poland’s future. Continued pressure will meet disciplined and determined resistance.',
      warDeclaration: 'Poland’s security can no longer rest on assurances. Our forces are prepared, and we will act with resolve.',
      victory: 'Poland stands sovereign because its people and its partners did not yield when tested.',
      defeat: 'An army may be defeated, but a nation’s determination to endure cannot be erased by force.',
    },
  },
  {
    "id": "leader_alexander_stubb",
    "name": "Alexander Stubb",
    "nationId": "nation_finland",
    "title": "President",
    "image": "/assets/sprites/leaders/alexander-stubb.png",
    "description": "A diplomatic hawk who builds dependable alliances and shared prosperity, backed by a modern professional military and firm resistance to coercion.",
    "ideologyId": "globalism",
    "aiNationalAgendaId": "homeland_defense",
    "aiMilitaryDoctrineId": "disciplinedInfantry",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "state_workforce",
      "military_tradition",
      "defensive_tactics",
      "civil_service_civics",
      "diplomatic_service"
    ],
    "aiPersonality": {
      "aggressionBias": -8,
      "expansionBias": -10,
      "economyBias": 16,
      "cultureBias": 8,
      "diplomacyBias": 28,
      "warTolerance": 72,
      "peacePreference": 68,
      "minimumUnitsLostBeforePeace": 5,
      "casualtyToleranceRatio": 0.5,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "Finland believes security and cooperation reinforce one another. Let us see where our interests meet.",
      "friendly": "Reliable partners make both our nations stronger. Finland values your commitments and stands ready to uphold its own.",
      "neutral": "We can make progress through practical agreements on trade and security. Let us be clear about what each of us can deliver.",
      "hostile": "We prefer dialogue, but Finland will not negotiate its security under pressure. Do not mistake our openness for a lack of resolve.",
      "warDeclaration": "We sought cooperation. You chose coercion. Finland is prepared to defend its sovereignty and stand by its partners.",
      "victory": "Our resolve has secured the chance for peace. Let us build arrangements that protect our people and make renewed aggression harder.",
      "defeat": "We must protect our people and rebuild our defenses. This defeat does not erase Finland’s sovereignty or our commitments to our partners."
    }
  },
  {
    "id": "leader_justin_trudeau",
    "name": "Justin Trudeau",
    "nationId": "nation_canada",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/justin-trudeau.png",
    "description": "A cooperative Canadian leader who pursues prosperity through trade, diplomacy, and dependable partnerships backed by modern defenses.",
    "ideologyId": "globalism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "merchant",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "state_workforce",
      "political_philosophy",
      "civil_service_civics",
      "diplomatic_service"
    ],
    "aiPersonality": {
      "aggressionBias": -14,
      "expansionBias": -8,
      "economyBias": 22,
      "cultureBias": 9,
      "diplomacyBias": 24,
      "warTolerance": 48,
      "peacePreference": 76,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.35,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Canada welcomes practical ideas for a more secure and prosperous world. Let us find common ground.",
      "friendly": "Our partnership shows what dependable friends can accomplish. Canada is ready to build on it.",
      "neutral": "Trade and dialogue can turn shared interests into lasting cooperation. What can we achieve together?",
      "hostile": "Your pressure is damaging the trust on which peace depends. Canada expects you to change course.",
      "warDeclaration": "Our people and our partners face a danger that diplomacy has not resolved. Canada will meet its commitments.",
      "victory": "Let this victory secure a peace in which our people and our partners can prosper.",
      "defeat": "We must rebuild, protect our people, and preserve the friendships that will carry us forward."
    }
  },
  {
    "id": "leader_claudia_sheinbaum_pardo",
    "name": "Claudia Sheinbaum Pardo",
    "nationId": "nation_mexico",
    "title": "President",
    "image": "/assets/sprites/leaders/claudia-sheinbaum-pardo.png",
    "description": "A Mexican leader focused on domestic development, shared prosperity, cultural life, and sovereign decision-making.",
    "ideologyId": "progressivism",
    "aiNationalAgendaId": "growth",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "early_empire",
      "games_recreation",
      "civil_service_civics",
      "diplomatic_service"
    ],
    "aiPersonality": {
      "aggressionBias": -12,
      "expansionBias": -6,
      "economyBias": 18,
      "cultureBias": 14,
      "diplomacyBias": 14,
      "warTolerance": 52,
      "peacePreference": 70,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.4,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "Mexico seeks development with dignity and relations based on mutual respect. Let us speak as equals.",
      "friendly": "Our cooperation is delivering for our people. Mexico values a partner who respects our independence.",
      "neutral": "We will judge this proposal by its contribution to development and respect for our sovereignty.",
      "hostile": "Mexico’s future is for its people to decide. Pressure from abroad will not change that.",
      "warDeclaration": "Our sovereignty and the safety of our people require action. Mexico will defend them with determination.",
      "victory": "Peace must now make room for schools, work, and a better life in every region of Mexico.",
      "defeat": "Our people deserve recovery and dignity. We will continue the work of national development."
    }
  },
  {
    "id": "leader_javier_milei",
    "name": "Javier Milei",
    "nationId": "nation_argentina",
    "title": "President",
    "image": "/assets/sprites/leaders/javier-milei.png",
    "description": "An outspoken Argentine economic reformer who values enterprise, challenges established arrangements, and takes calculated risks without seeking territorial empire.",
    "ideologyId": "liberalism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "opportunist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "state_workforce",
      "guilds",
      "civil_service_civics"
    ],
    "aiPersonality": {
      "aggressionBias": -3,
      "expansionBias": -7,
      "economyBias": 30,
      "cultureBias": -8,
      "diplomacyBias": -6,
      "warTolerance": 48,
      "peacePreference": 58,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.35,
      "resourceExploitationInterest": 4
    },
    "diplomacyFlavor": {
      "greeting": "Argentina is ready to do business. Bring a proposal that creates value, not another arrangement that rewards failure.",
      "friendly": "You have kept your word and made cooperation worthwhile. Let us give enterprise more room to succeed.",
      "neutral": "I will examine the terms. Agreement is useful only when the benefits survive an honest accounting.",
      "hostile": "You expect Argentina to accept your terms because they are customary. That is no argument, and we reject them.",
      "warDeclaration": "Your coercion has made peaceful enterprise impossible. Argentina will use force to end it.",
      "victory": "We have secured our freedom of action. Now let production and commerce justify the cost.",
      "defeat": "This defeat demands an honest reckoning. Argentina must rebuild its strength and restore opportunity."
    }
  },
  {
    "id": "leader_volodymyr_zelenskyy",
    "name": "Volodymyr Zelenskyy",
    "nationId": "nation_ukraine",
    "title": "President",
    "image": "/assets/sprites/leaders/volodymyr-zelenskyy.png",
    "description": "A Ukrainian leader committed to national survival, military readiness, dependable partnerships, and determined resistance to aggression.",
    "ideologyId": "progressivism",
    "aiNationalAgendaId": "homeland_defense",
    "aiMilitaryDoctrineId": "disciplinedInfantry",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "military_tradition",
      "defensive_tactics",
      "civil_service_civics",
      "diplomatic_service",
      "nationalism",
      "mobilization"
    ],
    "aiPersonality": {
      "aggressionBias": -10,
      "expansionBias": -12,
      "economyBias": 8,
      "cultureBias": 6,
      "diplomacyBias": 23,
      "warTolerance": 88,
      "peacePreference": 48,
      "minimumUnitsLostBeforePeace": 8,
      "casualtyToleranceRatio": 0.72,
      "resourceExploitationInterest": 0
    },
    "diplomacyFlavor": {
      "greeting": "Ukraine seeks a peace that protects sovereignty. We welcome partners prepared to stand by their word.",
      "friendly": "You stood with us when commitments mattered. Ukraine will remember, and we will stand with you.",
      "neutral": "We are ready to cooperate. Lasting security requires clear commitments and the means to uphold them.",
      "hostile": "Our future is not yours to dictate. Every threat strengthens our determination to defend it.",
      "warDeclaration": "Our sovereignty is at stake. Ukraine will fight, with its partners, until our people can live in security.",
      "victory": "Our people have defended their future. We must secure the peace and bring life back to our cities.",
      "defeat": "Our cities may have fallen, but our right to exist has not. Ukraine will endure and rebuild."
    }
  },
];

const GAMES_PREFERENCES_BY_LEADER: Readonly<Record<string, GamesOfNationsLeaderPreferences>> = {
  leader_alexander_stubb: { traditionalFavourite: 'javelin', additionalFavourite: 'pole_vault' },
  leader_justin_trudeau: {"traditionalFavourite": "swimming", "additionalFavourite": "hundred_metres"},
  leader_claudia_sheinbaum_pardo: {"traditionalFavourite": "marathon", "additionalFavourite": "boxing"},
  leader_javier_milei: {"traditionalFavourite": "wrestling", "additionalFavourite": "horse_racing"},
  leader_volodymyr_zelenskyy: {"traditionalFavourite": "wrestling", "additionalFavourite": "boxing"},
  leader_henry_v: { traditionalFavourite: 'wrestling', additionalFavourite: 'boxing' },
  leader_charles_vii: { traditionalFavourite: 'long_jump', additionalFavourite: 'fencing' },
  leader_sigismund: { traditionalFavourite: 'javelin', additionalFavourite: 'pole_vault' },
  leader_gustav_vasa: { traditionalFavourite: 'javelin', additionalFavourite: 'fencing' },
  leader_vytautas: { traditionalFavourite: 'marathon', additionalFavourite: 'horse_racing' },
  leader_marfa_boretskaya: { traditionalFavourite: 'swimming', additionalFavourite: 'hundred_metres' },
  leader_mehmed_ii: { traditionalFavourite: 'wrestling', additionalFavourite: 'horse_racing' },
  leader_isabella_i: { traditionalFavourite: 'long_jump', additionalFavourite: 'fencing' },
  leader_abu_said_uthman_ii: { traditionalFavourite: 'marathon', additionalFavourite: 'horse_racing' },
  'leader_george-washington': { traditionalFavourite: 'javelin', additionalFavourite: 'boxing' },
  'leader_mahatma-gandhi': { traditionalFavourite: 'marathon', additionalFavourite: 'hundred_metres' },
  'leader_qin-shi-huang': { traditionalFavourite: 'swimming', additionalFavourite: 'pole_vault' },
  leader_koxinga: { traditionalFavourite: 'swimming', additionalFavourite: 'fencing' },
  'leader_dom-pedro-ii': { traditionalFavourite: 'long_jump', additionalFavourite: 'pole_vault' },
  'leader_mansa-musa': { traditionalFavourite: 'marathon', additionalFavourite: 'hundred_metres' },
  'leader_genghis-khan': { traditionalFavourite: 'wrestling', additionalFavourite: 'horse_racing' },
  'leader_oda-nobunaga': { traditionalFavourite: 'javelin', additionalFavourite: 'fencing' },
  'leader_christian-iv': { traditionalFavourite: 'swimming', additionalFavourite: 'pole_vault' },
  leader_mad_jack: { traditionalFavourite: 'swimming', additionalFavourite: 'boxing' },
  'hermann-the-cheruscan': { traditionalFavourite: 'wrestling', additionalFavourite: 'hundred_metres' },
  'ivan-iv': { traditionalFavourite: 'javelin', additionalFavourite: 'horse_racing' },
  leader_joseph_stalin: { traditionalFavourite: 'wrestling', additionalFavourite: 'boxing' },
  leader_benito_mussolini: { traditionalFavourite: 'wrestling', additionalFavourite: 'fencing' },
  leader_wladyslaw_sikorski: { traditionalFavourite: 'javelin', additionalFavourite: 'fencing' },
};

const DEFAULT_LEADERS: LeaderDefinition[] = DEFAULT_LEADERS_WITHOUT_GAMES_PREFERENCES.map((leader) => ({
  ...leader,
  isDefault: true,
  gamesOfNationsPreferences: GAMES_PREFERENCES_BY_LEADER[leader.id]!,
}));

const HENRY_V = DEFAULT_LEADERS.find((leader) => leader.id === 'leader_henry_v')!;
export const JOSEPH_STALIN = DEFAULT_LEADERS.find((leader) => leader.id === 'leader_joseph_stalin')!;
export const BENITO_MUSSOLINI = DEFAULT_LEADERS.find((leader) => leader.id === 'leader_benito_mussolini')!;
export const WLADYSLAW_SIKORSKI = DEFAULT_LEADERS.find((leader) => leader.id === 'leader_wladyslaw_sikorski')!;

/** Shares Henry V's core tuning, but keeps opportunistic wars of choice disabled. */
export const WINSTON_CHURCHILL: LeaderDefinition = {
  ...HENRY_V,
  id: 'leader_winston_churchill',
  isDefault: false,
  name: 'Winston Churchill',
  opportunism: false,
  title: 'Prime Minister',
  image: `${LEADER_IMAGE_BASE}/winston-churchill.png`,
  description: 'Britain’s wartime Prime Minister, renowned for determined leadership and defiant resistance during World War II.',
  aiPersonality: HENRY_V.aiPersonality ? { ...HENRY_V.aiPersonality } : undefined,
  culturePriorities: HENRY_V.culturePriorities ? [...HENRY_V.culturePriorities] : undefined,
  gamesOfNationsPreferences: { ...HENRY_V.gamesOfNationsPreferences },
  diplomacyFlavor: HENRY_V.diplomacyFlavor ? { ...HENRY_V.diplomacyFlavor } : undefined,
};

/** France's modern alternative leader: sovereign, resilient, and defensive rather than expansionist. */
export const CHARLES_DE_GAULLE: LeaderDefinition = {
  id: 'leader_charles_de_gaulle',
  isDefault: false,
  name: 'Charles de Gaulle',
  nationId: 'nation_france',
  title: 'General',
  image: `${LEADER_IMAGE_BASE}/charles-de-gaulle.png`,
  description: 'Leader of Free France and later President of the French Republic, defined by national independence, resistance, and an uncompromising defense of French sovereignty.',
  ideologyId: 'nationalism',
  aiMilitaryDoctrineId: 'disciplinedInfantry',
  aiNationalAgendaId: 'france_libre',
  covertPersonalityId: 'honorable',
  culturePriorities: ['state_workforce', 'early_empire', 'military_tradition', 'nationalism', 'mobilization'],
  gamesOfNationsPreferences: { traditionalFavourite: 'javelin', additionalFavourite: 'fencing' },
  aiPersonality: {
    resourceExploitationInterest: 1,
    aggressionBias: 7,
    expansionBias: -6,
    economyBias: 8,
    cultureBias: 6,
    diplomacyBias: 4,
    warTolerance: 72,
    peacePreference: 40,
    minimumUnitsLostBeforePeace: 6,
    casualtyToleranceRatio: 0.6,
  },
  diplomacyFlavor: {
    greeting: 'France speaks in its own name and chooses its own course. Let us deal with one another as sovereign nations.',
    friendly: 'Our friendship is strongest when neither nation asks the other to surrender its independence.',
    neutral: 'France listens to allies and rivals alike, but its decisions remain French decisions.',
    hostile: 'Pressure will not make France submit. It will only make our resistance more determined.',
    warDeclaration: 'France will not accept intimidation or subordination. We shall resist, and France shall endure.',
    victory: 'France stands sovereign and unbroken. That was the purpose of our struggle.',
    defeat: 'A battle may be lost, but France is not extinguished. Resistance will continue wherever French resolve remains.',
  },
};

/** Germany's WWII-era alternative leader with a distinct military buildup profile. */
export const ADOLF_HITLER: LeaderDefinition = {
  id: 'leader_adolf_hitler',
  isDefault: false,
  name: 'Adolf Hitler',
    impulsiveBully: true,
  opportunism: true,
  nationId: 'nation_germany',
  title: 'Führer',
  image: `${LEADER_IMAGE_BASE}/adolf-hitler.png`,
  description: 'Germany’s Nazi dictator during World War II, responsible for militarization, aggressive expansion, mass persecution, and genocide.',
  ideologyId: 'militarism',
  aiMilitaryDoctrineId: 'militaryMobilization',
  aiNationalAgendaId: 'military_power',
  covertPersonalityId: 'paranoid',
  culturePriorities: ['state_workforce', 'early_empire', 'military_tradition', 'totalitarianism'],
  gamesOfNationsPreferences: { traditionalFavourite: 'javelin', additionalFavourite: 'boxing' },
  aiPersonality: {
    resourceExploitationInterest: 4,
    aggressionBias: 20,
    expansionBias: 20,
    economyBias: 6,
    cultureBias: -10,
    diplomacyBias: -16,
    warTolerance: 88,
    peacePreference: 15,
    minimumUnitsLostBeforePeace: 8,
    casualtyToleranceRatio: 0.68,
  },
  diplomacyFlavor: {
    greeting: 'Germany will judge your proposal by strength, discipline, and advantage. Speak plainly.',
    friendly: 'Our present interests are aligned. That alignment will endure only while it remains useful to Germany.',
    neutral: 'Germany is preparing for every possibility. Your actions will determine which one follows.',
    hostile: 'You have placed yourself against German interests. Do not expect hesitation in our response.',
    warDeclaration: 'Diplomacy no longer serves our aims. Germany will now settle this by force.',
    victory: 'Germany has imposed its will through preparation and force.',
    defeat: 'Our military position has collapsed. History will record the consequences.',
  },
};

export const ALL_LEADERS: LeaderDefinition[] = [
  ...DEFAULT_LEADERS,
  ...MIDDLE_EASTERN_LEADERS,
  ...ASIAN_LEADERS,
  WINSTON_CHURCHILL,
  CHARLES_DE_GAULLE,
  ADOLF_HITLER,
  ...MODERN_ALTERNATIVE_LEADERS,
];

/**
 * Per-scenario leader overrides, keyed by nationId. Installed once at game start
 * via {@link setScenarioLeaderOverrides} and applied transparently by every
 * leader accessor below, so a scenario-authored leader name/description flows
 * through the whole game without each call site knowing about it.
 */
const scenarioLeaderOverrides = new Map<string, { name?: string; description?: string; replacementNationId?: string }>();
const activeLeaderIdsByNation = new Map<string, string>();

/** Minimal shape needed from a scenario nation to derive a leader override. */
interface ScenarioLeaderSource {
  id: string;
  leaderName?: string;
  leaderDescription?: string;
  replacementNationId?: string;
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
    const replacementNationId = nation.replacementNationId?.trim();
    if (!name && !description && !replacementNationId) continue;
    scenarioLeaderOverrides.set(nation.id, {
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
      ...(replacementNationId ? { replacementNationId } : {}),
    });
  }
}

/** Apply any installed override to a leader, returning an overridden copy. */
function applyLeaderOverride(leader: LeaderDefinition | undefined, overrideNationId = leader?.nationId): LeaderDefinition | undefined {
  if (!leader) return leader;
  leader = applyBehaviorOverride(leader);
  const override = overrideNationId ? scenarioLeaderOverrides.get(overrideNationId) : undefined;
  if (!override) return leader;
  return {
    ...leader,
    name: override.name ?? leader.name,
    description: override.description ?? leader.description,
  };
}

/** Replace all explicit per-game leader selections. Missing nations use defaults. */
export function setActiveLeaderSelections(selections: Readonly<Record<string, string>> | undefined): void {
  activeLeaderIdsByNation.clear();
  for (const [nationId, leaderId] of Object.entries(selections ?? {})) {
    if (ALL_LEADERS.some((leader) => leader.id === leaderId)) activeLeaderIdsByNation.set(nationId, leaderId);
  }
}

/** Explicit selections only, suitable for game configuration and save data. */
export function getActiveLeaderSelections(): Record<string, string> {
  return Object.fromEntries(activeLeaderIdsByNation);
}

export function getLeadersByNationId(nationId: string): LeaderDefinition[] {
  return ALL_LEADERS.filter((leader) => leader.nationId === nationId);
}

export function getDefaultLeaderByNationId(nationId: string): LeaderDefinition | undefined {
  return ALL_LEADERS.find((leader) => leader.nationId === nationId && leader.isDefault);
}

export function getLeaderByNationId(nationId: string): LeaderDefinition | undefined {
  const replacementNationId = scenarioLeaderOverrides.get(nationId)?.replacementNationId;
  const identityNationId = replacementNationId ?? nationId;
  const selectedLeaderId = activeLeaderIdsByNation.get(nationId);
  const selectedLeader = selectedLeaderId ? ALL_LEADERS.find((leader) => leader.id === selectedLeaderId) : undefined;
  const leader = selectedLeader?.nationId === identityNationId
    ? selectedLeader
    : getDefaultLeaderByNationId(identityNationId);
  const overridden = applyLeaderOverride(leader, nationId);
  return overridden && replacementNationId ? { ...overridden, nationId } : overridden;
}

export function getBuiltInLeaderByNationId(nationId: string): LeaderDefinition | undefined {
  return getDefaultLeaderByNationId(nationId);
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

/**
 * The leader's Foreign Resource Exploitation Rights interest (0–4), normalized
 * to a valid level. Nations without a leader-declared value fall back to the
 * conservative default. This is the single source of truth every diplomatic
 * exploitation valuation reads — never derived from the map or resources.
 */
export function getLeaderExploitationInterestByNationId(nationId: string): ExploitationInterestLevel {
  return resolveExploitationInterest(getLeaderPersonalityByNationId(nationId).resourceExploitationInterest);
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
export const LEADER_COVERT_PERSONALITY_DEFAULTS: Record<string, CovertPersonalityId> = {
  leader_henry_v: 'opportunist',
  leader_winston_churchill: 'opportunist',
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
