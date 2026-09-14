import type { LeaderDefinition } from '../types/leader';

/** Personalities, sports and dialogue are gameplay interpretations, not historical quotations. */
export const JOHN_HOWARD: LeaderDefinition = {
  id: 'leader_john_howard',
  nationId: 'nation_australia',
  isDefault: true,
  name: 'John Howard',
  title: 'Prime Minister',
  image: '/assets/sprites/leaders/john-howard.png',
  description: 'John Howard served as Prime Minister of Australia from 1996 to 2007, leading a Liberal–National Coalition government. His government pursued tax and workplace reforms and close security cooperation with the United States.',
  ideologyId: 'conservatism',
  aiNationalAgendaId: 'economic',
  aiMilitaryDoctrineId: 'navalPower',
  covertPersonalityId: 'pragmatist',
  opportunism: false,
  impulsiveBully: false,
  maxPreferredCities: 5,
  culturePriorities: ['foreign_trade', 'diplomatic_service', 'civil_engineering'],
  gamesOfNationsPreferences: { traditionalFavourite: 'swimming', additionalFavourite: 'horse_racing' },
  aiPersonality: {
    aggressionBias: -12, expansionBias: -22, economyBias: 28, cultureBias: 8,
    diplomacyBias: 26, warTolerance: 72, peacePreference: 68,
    minimumUnitsLostBeforePeace: 4, casualtyToleranceRatio: 0.45,
    resourceExploitationInterest: 4,
  },
  diplomacyFlavor: {
    greeting: 'Australia welcomes dependable partners. Let us discuss trade, security and the interests we share.',
    friendly: 'Our partnership rests on keeping our word. You can count on Australia to take its commitments seriously.',
    neutral: 'We will judge your proposal by its practical benefits for our economy and our national security.',
    hostile: 'Your actions put stable trade and regional security at risk. Australia expects its concerns to be addressed.',
    warDeclaration: 'Our security and our commitments require action. Australia will now commit its forces.',
    victory: 'Our forces have secured their objectives. Let us establish a dependable peace and restore commerce.',
    defeat: 'We must protect our people and preserve our future. Australia is prepared to negotiate a practical settlement.',
  },
};

export const BOB_HAWKE: LeaderDefinition = {
  id: 'leader_bob_hawke',
  nationId: 'nation_australia',
  isDefault: false,
  name: 'Bob Hawke',
  title: 'Prime Minister',
  image: '/assets/sprites/leaders/bob-hawke.png',
  description: 'Bob Hawke served as Prime Minister of Australia from 1983 to 1991, leading a Labor government. His government pursued economic reform, cooperation with unions and business, and closer Asia-Pacific economic relationships.',
  ideologyId: 'globalism',
  aiNationalAgendaId: 'economic',
  aiMilitaryDoctrineId: 'defensiveModern',
  covertPersonalityId: 'merchant',
  opportunism: false,
  impulsiveBully: false,
  maxPreferredCities: 5,
  culturePriorities: ['foreign_trade', 'civil_engineering', 'diplomatic_service'],
  gamesOfNationsPreferences: { traditionalFavourite: 'swimming', additionalFavourite: 'boxing' },
  aiPersonality: {
    aggressionBias: -28, expansionBias: -26, economyBias: 36, cultureBias: 18,
    diplomacyBias: 36, warTolerance: 38, peacePreference: 90,
    minimumUnitsLostBeforePeace: 2, casualtyToleranceRatio: 0.25,
    resourceExploitationInterest: 4,
  },
  diplomacyFlavor: {
    greeting: 'Australia has much to gain from an open conversation. Let us build prosperity through trade and cooperation.',
    friendly: 'Working together gives our businesses and workers new opportunities. Let us deepen those connections.',
    neutral: 'A sound agreement should raise living standards on both sides. Let us work through the details.',
    hostile: 'Confrontation is costing both our peoples. We should return to serious negotiations before more is lost.',
    warDeclaration: 'Negotiations have failed to protect our people. Australia will defend itself while keeping a settlement in reach.',
    victory: 'Now we must turn military success into a peace that allows both our peoples to get back to work.',
    defeat: 'Continuing this war would squander our future. Let us agree on terms and begin rebuilding.',
  },
};

export const AUSTRALIAN_LEADERS: LeaderDefinition[] = [JOHN_HOWARD, BOB_HAWKE];
