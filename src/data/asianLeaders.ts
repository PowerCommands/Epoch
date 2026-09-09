import type { LeaderDefinition } from '../types/leader';

/** Game interpretations, not factual claims about private motives or sport preferences. */
export const ASIAN_LEADERS: LeaderDefinition[] = [
  {
    "id": "leader_anutin_charnvirakul",
    "isDefault": true,
    "name": "Anutin Charnvirakul",
    "nationId": "nation_thailand",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/anutin-charnvirakul.png",
    "description": "Thai prime minister and Bhumjaithai Party leader, Anutin Charnvirakul previously served as interior minister and public health minister.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "balanced",
    "covertPersonalityId": "merchant",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "civil_engineering",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": -8,
      "expansionBias": 0,
      "economyBias": 24,
      "cultureBias": 8,
      "diplomacyBias": 20,
      "warTolerance": 42,
      "peacePreference": 75,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.3,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "Thailand welcomes practical partners. Let us find opportunities that benefit both our peoples.",
      "friendly": "Our cooperation is delivering results. Let us keep trade and conversation moving.",
      "neutral": "Show me how your proposal supports stability and prosperity.",
      "hostile": "Pressure damages the confidence on which our cooperation depends.",
      "warDeclaration": "We have exhausted the negotiations. Thailand will now defend its interests by force.",
      "victory": "The fighting has secured our position. A workable settlement must follow.",
      "defeat": "We must stop these losses and negotiate terms that allow our people to rebuild."
    }
  },
  {
    "id": "leader_lee_jae_myung",
    "isDefault": true,
    "name": "Lee Jae Myung",
    "nationId": "nation_south_korea",
    "title": "President",
    "image": "/assets/sprites/leaders/lee-jae-myung.png",
    "description": "President of the Republic of Korea since 2025, Lee Jae Myung previously served as governor of Gyeonggi Province and mayor of Seongnam.",
    "ideologyId": "progressivism",
    "aiNationalAgendaId": "growth",
    "aiMilitaryDoctrineId": "eliteArmy",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "civil_engineering",
      "foreign_trade",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -15,
      "expansionBias": -4,
      "economyBias": 24,
      "cultureBias": 18,
      "diplomacyBias": 22,
      "warTolerance": 58,
      "peacePreference": 80,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.4,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "Welcome. South Korea seeks security, shared prosperity and dependable cooperation.",
      "friendly": "Our partnership gives both our peoples more opportunities. We should build on it.",
      "neutral": "We will assess your proposal by its practical effects on our citizens.",
      "hostile": "Your actions undermine the trust needed for peaceful cooperation.",
      "warDeclaration": "Our security can no longer be protected through negotiation alone. We must act.",
      "victory": "Our forces have achieved their objectives. We now seek a durable peace.",
      "defeat": "The cost of continuing is too great. We must protect our people through a settlement."
    }
  },
  {
    "id": "leader_kim_jong_un",
    "isDefault": true,
    "name": "Kim Jong Un",
    "nationId": "nation_north_korea",
    "title": "General Secretary",
    "image": "/assets/sprites/leaders/kim-jong-un.png",
    "description": "Leader of North Korea since 2011, Kim Jong Un heads the Workers’ Party of Korea and the State Affairs Commission.",
    "ideologyId": "militarism",
    "aiNationalAgendaId": "isolationist",
    "aiMilitaryDoctrineId": "militaryMobilization",
    "covertPersonalityId": "paranoid",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "nationalism",
      "mobilization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "wrestling",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": 14,
      "expansionBias": -6,
      "economyBias": 4,
      "cultureBias": -4,
      "diplomacyBias": -24,
      "warTolerance": 85,
      "peacePreference": 30,
      "minimumUnitsLostBeforePeace": 7,
      "casualtyToleranceRatio": 0.65,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "North Korea expects its sovereignty to be respected. State your purpose.",
      "friendly": "You have honored our agreements. Cooperation may continue on that basis.",
      "neutral": "We will judge these terms by what they mean for our independence and security.",
      "hostile": "Threats and pressure will not secure our obedience.",
      "warDeclaration": "Your actions have brought us to war. Our forces will answer them.",
      "victory": "Our position is secure. The settlement must prevent renewed threats.",
      "defeat": "We will consider terms that preserve our sovereignty and end the fighting."
    }
  }
];
