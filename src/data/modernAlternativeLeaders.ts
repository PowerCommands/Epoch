import type { LeaderDefinition } from '../types/leader';

/** Game interpretations, not psychological assessments. See docs/content/modern-alternative-leaders.md. */
export const MODERN_ALTERNATIVE_LEADERS: LeaderDefinition[] = [
  {
    "id": "leader_franklin_d_roosevelt",
    "isDefault": false,
    "name": "Franklin D. Roosevelt",
    "nationId": "nation_usa",
    "title": "President",
    "image": "/assets/sprites/leaders/franklin-d-roosevelt.png",
    "description": "Franklin Delano Roosevelt, U.S. President from 1933 to 1945, led economic recovery and helped build the Allied coalition during World War II.",
    "ideologyId": "liberalism",
    "aiMilitaryDoctrineId": "militaryMobilization",
    "aiNationalAgendaId": "naval_power",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "diplomatic_service",
      "mobilization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -2,
      "expansionBias": 2,
      "economyBias": 22,
      "cultureBias": 4,
      "diplomacyBias": 16,
      "warTolerance": 78,
      "peacePreference": 58,
      "minimumUnitsLostBeforePeace": 7,
      "casualtyToleranceRatio": 0.58,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Our strength grows when nations work together. Let us build a peace we can sustain."
    }
  },
  {
    "id": "leader_donald_j_trump",
    "isDefault": false,
    "name": "Donald J. Trump",
    "nationId": "nation_usa",
    "title": "President",
    "image": "/assets/sprites/leaders/donald-j-trump.png",
    "description": "A twenty-first-century U.S. President whose political identity emphasizes national advantage, trade bargaining, and challenges to established diplomatic conventions.",
    "ideologyId": "nationalism",
    "aiMilitaryDoctrineId": "prestigeProjection",
    "aiNationalAgendaId": "economic",
    "covertPersonalityId": "merchant",
    "opportunism": true,
    "impulsiveBully": true,
    "culturePriorities": [
      "foreign_trade",
      "state_workforce",
      "nationalism"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 10,
      "expansionBias": 3,
      "economyBias": 22,
      "cultureBias": 0,
      "diplomacyBias": -20,
      "warTolerance": 52,
      "peacePreference": 46,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.34,
      "resourceExploitationInterest": 4
    },
    "diplomacyFlavor": {
      "greeting": "America expects a fair deal. Tell me what your proposal brings to the table."
    }
  },
  {
    "id": "leader_mao_zedong",
    "isDefault": false,
    "name": "Mao Zedong",
    "nationId": "nation_china",
    "title": "Chairman",
    "image": "/assets/sprites/leaders/mao-zedong.png",
    "description": "A revolutionary communist leader and founding leader of the People’s Republic of China, dominant from 1949 to 1976, who pursued mass mobilization and ideological transformation.",
    "ideologyId": "nationalism",
    "aiMilitaryDoctrineId": "cheapInfantrySwarm",
    "aiNationalAgendaId": "expansionist",
    "covertPersonalityId": "fanatic",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "early_empire",
      "totalitarianism",
      "mobilization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 12,
      "expansionBias": 18,
      "economyBias": 6,
      "cultureBias": 10,
      "diplomacyBias": -8,
      "warTolerance": 92,
      "peacePreference": 18,
      "minimumUnitsLostBeforePeace": 10,
      "casualtyToleranceRatio": 0.78,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "A nation must have the determination to shape its own future. What course do you propose?"
    }
  },
  {
    "id": "leader_emmanuel_macron",
    "isDefault": false,
    "name": "Emmanuel Macron",
    "nationId": "nation_france",
    "title": "President",
    "image": "/assets/sprites/leaders/emmanuel-macron.png",
    "description": "A twenty-first-century French President associated with European cooperation, economic reform, and an active international role for France.",
    "ideologyId": "globalism",
    "aiMilitaryDoctrineId": "imperialCombinedArms",
    "aiNationalAgendaId": "culture",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "drama_civics",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -7,
      "expansionBias": -4,
      "economyBias": 16,
      "cultureBias": 22,
      "diplomacyBias": 20,
      "warTolerance": 53,
      "peacePreference": 65,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.35,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "France seeks partners with the ambition to act together. Let us give our cooperation a clear purpose."
    }
  },
  {
    "id": "leader_angela_merkel",
    "isDefault": false,
    "name": "Angela Merkel",
    "nationId": "nation_germany",
    "title": "Chancellor",
    "image": "/assets/sprites/leaders/angela-merkel.png",
    "description": "Germany’s Chancellor from 2005 to 2021, associated with pragmatic negotiation, economic stability, and sustained European cooperation.",
    "ideologyId": "globalism",
    "aiMilitaryDoctrineId": "fortifiedDefense",
    "aiNationalAgendaId": "economic",
    "covertPersonalityId": "merchant",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "civil_service_civics",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -17,
      "expansionBias": -8,
      "economyBias": 28,
      "cultureBias": 5,
      "diplomacyBias": 18,
      "warTolerance": 48,
      "peacePreference": 82,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.32,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "Durable agreements require patience and practical commitments. Let us examine where our interests meet."
    }
  },
  {
    "id": "leader_narendra_modi",
    "isDefault": false,
    "name": "Narendra Modi",
    "nationId": "nation_india",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/narendra-modi.png",
    "description": "A twenty-first-century Indian Prime Minister associated with national ambition, economic development, and an independent international posture.",
    "ideologyId": "nationalism",
    "aiMilitaryDoctrineId": "imperialCombinedArms",
    "aiNationalAgendaId": "growth",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "foreign_trade",
      "nationalism"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 5,
      "expansionBias": 7,
      "economyBias": 22,
      "cultureBias": 12,
      "diplomacyBias": 10,
      "warTolerance": 65,
      "peacePreference": 48,
      "minimumUnitsLostBeforePeace": 5,
      "casualtyToleranceRatio": 0.48,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "India will choose its own path. We welcome cooperation that advances prosperity and respects our security."
    }
  },
  {
    "id": "leader_vladimir_putin",
    "isDefault": false,
    "name": "Vladimir Putin",
    "nationId": "nation_russia",
    "title": "President",
    "image": "/assets/sprites/leaders/vladimir-putin.png",
    "description": "A Russian President and former Prime Minister associated with centralized state power, security priorities, and the pursuit of geopolitical influence.",
    "ideologyId": "nationalism",
    "aiMilitaryDoctrineId": "imperialCombinedArms",
    "aiNationalAgendaId": "homeland_defense",
    "covertPersonalityId": "schemer",
    "opportunism": true,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "defensive_tactics",
      "nationalism",
      "mobilization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 12,
      "expansionBias": 10,
      "economyBias": 12,
      "cultureBias": 3,
      "diplomacyBias": -4,
      "warTolerance": 80,
      "peacePreference": 28,
      "minimumUnitsLostBeforePeace": 7,
      "casualtyToleranceRatio": 0.62,
      "resourceExploitationInterest": 4
    },
    "diplomacyFlavor": {
      "greeting": "Lasting arrangements must account for our security and the balance of power. State your interests plainly."
    }
  },
  {
    "id": "leader_tony_blair",
    "isDefault": false,
    "name": "Tony Blair",
    "nationId": "nation_england",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/tony-blair.png",
    "description": "The United Kingdom’s Prime Minister from 1997 to 2007, associated with New Labour, international partnerships, and military interventions alongside allies.",
    "ideologyId": "liberalism",
    "aiMilitaryDoctrineId": "prestigeProjection",
    "aiNationalAgendaId": "balanced",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "diplomatic_service",
      "mobilization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 12,
      "expansionBias": -5,
      "economyBias": 18,
      "cultureBias": 6,
      "diplomacyBias": 24,
      "warTolerance": 72,
      "peacePreference": 38,
      "minimumUnitsLostBeforePeace": 5,
      "casualtyToleranceRatio": 0.48,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Our partnerships must be prepared to act as well as speak. Let us agree on what we can accomplish together."
    }
  },
  {
    "id": "leader_giorgia_meloni",
    "isDefault": false,
    "name": "Giorgia Meloni",
    "nationId": "nation_italy",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/giorgia-meloni.png",
    "description": "A twenty-first-century Italian Prime Minister associated with national conservatism, Italian interests, and pragmatic cooperation with international partners.",
    "ideologyId": "conservatism",
    "aiMilitaryDoctrineId": "disciplinedInfantry",
    "aiNationalAgendaId": "growth",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "foreign_trade",
      "nationalism"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 5,
      "expansionBias": -2,
      "economyBias": 16,
      "cultureBias": 12,
      "diplomacyBias": 6,
      "warTolerance": 58,
      "peacePreference": 50,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.42,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Italy values reliable partners and clear commitments. Our cooperation must respect the interests of both nations."
    }
  },
  {
    "id": "leader_jair_bolsonaro",
    "isDefault": false,
    "name": "Jair Bolsonaro",
    "nationId": "nation_brazil",
    "title": "President",
    "image": "/assets/sprites/leaders/jair-bolsonaro.png",
    "description": "Brazil’s President from 2019 to 2022, associated with nationalism, security-focused politics, and confrontational public rhetoric.",
    "ideologyId": "nationalism",
    "aiMilitaryDoctrineId": "disciplinedInfantry",
    "aiNationalAgendaId": "growth",
    "covertPersonalityId": "opportunist",
    "opportunism": false,
    "impulsiveBully": true,
    "culturePriorities": [
      "state_workforce",
      "military_tradition",
      "nationalism"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 16,
      "expansionBias": 8,
      "economyBias": 12,
      "cultureBias": -4,
      "diplomacyBias": -22,
      "warTolerance": 62,
      "peacePreference": 35,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.42,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Brazil will speak for itself. We expect respect for our sovereignty and our choices."
    }
  },
  {
    "id": "leader_pedro_sanchez",
    "isDefault": false,
    "name": "Pedro Sánchez",
    "nationId": "nation_spain",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/pedro-sanchez.png",
    "description": "A twenty-first-century Spanish Prime Minister associated with coalition politics, European cooperation, and economic and social development.",
    "ideologyId": "progressivism",
    "aiMilitaryDoctrineId": "balanced",
    "aiNationalAgendaId": "growth",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "games_recreation",
      "civil_service_civics",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -12,
      "expansionBias": -3,
      "economyBias": 20,
      "cultureBias": 12,
      "diplomacyBias": 22,
      "warTolerance": 38,
      "peacePreference": 78,
      "minimumUnitsLostBeforePeace": 2,
      "casualtyToleranceRatio": 0.26,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "Progress depends on finding workable agreements. Let us look for common ground and room to move forward."
    }
  },
  {
    "id": "leader_donald_tusk",
    "isDefault": false,
    "name": "Donald Tusk",
    "nationId": "nation_poland",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/donald-tusk.png",
    "description": "A Polish Prime Minister and former President of the European Council, associated with European cooperation, alliances, and Poland’s security.",
    "ideologyId": "liberalism",
    "aiMilitaryDoctrineId": "imperialCombinedArms",
    "aiNationalAgendaId": "poland_shall_endure",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "defensive_tactics",
      "diplomatic_service",
      "mobilization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -5,
      "expansionBias": -10,
      "economyBias": 16,
      "cultureBias": 4,
      "diplomacyBias": 23,
      "warTolerance": 74,
      "peacePreference": 60,
      "minimumUnitsLostBeforePeace": 6,
      "casualtyToleranceRatio": 0.55,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "Poland seeks dependable partners and a secure peace. Our commitments must be matched by preparedness."
    }
  },
  {
    "id": "leader_mette_frederiksen",
    "isDefault": false,
    "name": "Mette Frederiksen",
    "nationId": "nation_denmark",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/mette-frederiksen.png",
    "description": "A twenty-first-century Danish Prime Minister associated with pragmatic government, social welfare, international cooperation, and defensive security.",
    "ideologyId": "progressivism",
    "aiMilitaryDoctrineId": "navalPower",
    "aiNationalAgendaId": "homeland_defense",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "civil_service_civics",
      "defensive_tactics",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -9,
      "expansionBias": -9,
      "economyBias": 19,
      "cultureBias": 8,
      "diplomacyBias": 15,
      "warTolerance": 62,
      "peacePreference": 68,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.42,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "Denmark believes cooperation works best when every partner contributes. Prosperity and security require practical action."
    }
  },
  {
    "id": "leader_olof_palme",
    "isDefault": false,
    "name": "Olof Palme",
    "nationId": "nation_sweden",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/olof-palme.png",
    "description": "Sweden’s Prime Minister from 1969 to 1976 and 1982 to 1986, an outspoken advocate of international solidarity, disarmament, and social democracy.",
    "ideologyId": "progressivism",
    "aiMilitaryDoctrineId": "fortifiedDefense",
    "aiNationalAgendaId": "culture",
    "covertPersonalityId": "honorable",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "drama_civics",
      "civil_service_civics",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -22,
      "expansionBias": -10,
      "economyBias": 12,
      "cultureBias": 26,
      "diplomacyBias": 28,
      "warTolerance": 28,
      "peacePreference": 92,
      "minimumUnitsLostBeforePeace": 1,
      "casualtyToleranceRatio": 0.2,
      "resourceExploitationInterest": 0
    },
    "diplomacyFlavor": {
      "greeting": "Peace requires more than silence. Sweden will speak openly and work with those who seek justice and understanding."
    }
  },
  {
    "id": "leader_boris_johnson",
    "isDefault": false,
    "name": "Boris Johnson",
    "nationId": "nation_england",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/boris-johnson.png",
    "description": "A charismatic political opportunist who pursues national advantage through trade, active diplomacy and an exuberant public presence.",
    "ideologyId": "nationalism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "prestigeProjection",
    "covertPersonalityId": "opportunist",
    "opportunism": true,
    "impulsiveBully": false,
    "showman": true,
    "culturePriorities": [
      "foreign_trade",
      "political_philosophy",
      "nationalism",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 5,
      "expansionBias": -5,
      "economyBias": 16,
      "cultureBias": 10,
      "diplomacyBias": 12,
      "warTolerance": 58,
      "peacePreference": 55,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.4,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "Splendid, you have arrived! Let us see whether we can turn a respectable meeting into a rather remarkable opportunity.",
      "friendly": "There is real momentum here. Bring your best proposals; I shall bring the enthusiasm and, with luck, a pen that works.",
      "neutral": "Our interests need not coincide in every detail for us to do excellent business. Let us begin with the useful bits.",
      "hostile": "I would much prefer a productive relationship, but you are making cooperation an obstacle course. Our national interests are not negotiable decorations.",
      "warDeclaration": "The diplomatic road has narrowed to a dead end. We now commit our forces to securing our interests, with clear objectives and the resolve to achieve them.",
      "victory": "A formidable effort, and a result of which our people can be proud. Now comes the less photogenic but essential business of making the settlement last.",
      "defeat": "This is a serious reverse, and our people deserve candour about it. We shall secure the best peace available, repair the damage and return with renewed purpose."
    }
  },
];
