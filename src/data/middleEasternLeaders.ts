import type { LeaderDefinition } from '../types/leader';

/** Historical game interpretations using the shared AI profiles. */
export const MIDDLE_EASTERN_LEADERS: LeaderDefinition[] = [
  {
    "id": "leader_ruhollah_khomeini",
    "isDefault": true,
    "name": "Ruhollah Khomeini",
    "nationId": "nation_iran",
    "title": "Supreme Leader",
    "image": "/assets/sprites/leaders/ruhollah-khomeini.png",
    "description": "Founder and first Supreme Leader of the Islamic Republic of Iran, Khomeini led the 1979 revolution and held supreme authority until 1989.",
    "ideologyId": "traditionalism",
    "aiNationalAgendaId": "homeland_defense",
    "aiMilitaryDoctrineId": "religiousMilitia",
    "covertPersonalityId": "fanatic",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "mysticism",
      "theology_civics",
      "nationalism"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "wrestling",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": -12,
      "expansionBias": -14,
      "economyBias": 4,
      "cultureBias": 16,
      "diplomacyBias": -24,
      "warTolerance": 92,
      "peacePreference": 24,
      "minimumUnitsLostBeforePeace": 9,
      "casualtyToleranceRatio": 0.78,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Iran receives those who respect its independence. Our convictions are not a matter for foreign negotiation.",
      "friendly": "Respect for our sovereignty has given this relationship a foundation. Let deeds preserve it.",
      "neutral": "We will examine your proposal against our obligations and our independence.",
      "hostile": "Pressure will not make our people abandon their convictions. Do not mistake endurance for weakness.",
      "warDeclaration": "Your actions have made resistance necessary. Iran will sustain this struggle.",
      "victory": "Our resistance has prevailed. The settlement must protect our independence.",
      "defeat": "Our forces have suffered defeat, but our convictions cannot be surrendered."
    }
  },
  {
    "id": "leader_saddam_hussein",
    "isDefault": true,
    "name": "Saddam Hussein",
    "nationId": "nation_iraq",
    "title": "President",
    "image": "/assets/sprites/leaders/saddam-hussein.png",
    "description": "President of Iraq from 1979 to 2003, Saddam Hussein consolidated Baathist rule through repression and led Iraq into wars with Iran and Kuwait.",
    "ideologyId": "militarism",
    "aiNationalAgendaId": "military_power",
    "aiMilitaryDoctrineId": "militaryMobilization",
    "covertPersonalityId": "paranoid",
    "opportunism": true,
    "impulsiveBully": true,
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
      "aggressionBias": 28,
      "expansionBias": 20,
      "economyBias": 14,
      "cultureBias": -8,
      "diplomacyBias": -28,
      "warTolerance": 88,
      "peacePreference": 18,
      "minimumUnitsLostBeforePeace": 8,
      "casualtyToleranceRatio": 0.7,
      "resourceExploitationInterest": 4
    },
    "diplomacyFlavor": {
      "greeting": "Iraq expects to be treated as a power whose interests cannot be ignored.",
      "friendly": "An agreement that strengthens Iraq can earn our cooperation. Keep your commitments.",
      "neutral": "State your terms clearly. Iraq will judge the advantage they offer.",
      "hostile": "You challenge Iraq while disregarding the strength we have assembled.",
      "warDeclaration": "Iraq will now impose by force what your defiance has denied us.",
      "victory": "Our armed forces have established Iraq’s position. You will recognize it in the settlement.",
      "defeat": "Our position has failed. Present the terms that will end this campaign."
    }
  },
  {
    "id": "leader_cleopatra_vii",
    "isDefault": true,
    "name": "Cleopatra VII",
    "nationId": "nation_egypt",
    "title": "Queen of Egypt",
    "image": "/assets/sprites/leaders/cleopatra-vii.png",
    "description": "The last active ruler of Ptolemaic Egypt, Cleopatra VII ruled from 51 to 30 BCE and used diplomacy and alliances with Roman leaders to defend her dynasty.",
    "ideologyId": "globalism",
    "aiNationalAgendaId": "culture",
    "aiMilitaryDoctrineId": "culturalDefense",
    "covertPersonalityId": "schemer",
    "opportunism": true,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "drama_civics",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -16,
      "expansionBias": -8,
      "economyBias": 22,
      "cultureBias": 30,
      "diplomacyBias": 30,
      "warTolerance": 42,
      "peacePreference": 76,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.3,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "Welcome to Egypt. Let us discover what each of us can gain from the other’s prosperity.",
      "friendly": "Our friendship has brought opportunity to both courts. I intend to cultivate it.",
      "neutral": "Every proposal reveals something of its author. Tell me what you truly seek.",
      "hostile": "You have narrowed my choices, but you have not exhausted them.",
      "warDeclaration": "You have left Egypt no profitable peace. I have arranged another course.",
      "victory": "The balance has shifted in Egypt’s favor. Let us put it to lasting use.",
      "defeat": "Fortune has turned against my cause. Egypt’s future still requires a settlement."
    }
  },
  {
    "id": "leader_abdel_fattah_el_sisi",
    "isDefault": false,
    "name": "Abdel Fattah el-Sisi",
    "nationId": "nation_egypt",
    "title": "President",
    "image": "/assets/sprites/leaders/abdel-fattah-el-sisi.png",
    "description": "An Egyptian military officer who became president in 2014, el-Sisi built his leadership around state authority, security and large infrastructure projects.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "homeland_defense",
    "aiMilitaryDoctrineId": "imperialCombinedArms",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "civil_engineering",
      "mobilization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": -10,
      "expansionBias": -12,
      "economyBias": 22,
      "cultureBias": 2,
      "diplomacyBias": 12,
      "warTolerance": 70,
      "peacePreference": 64,
      "minimumUnitsLostBeforePeace": 5,
      "casualtyToleranceRatio": 0.5,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Egypt seeks stability and development. Cooperation must strengthen both.",
      "friendly": "Reliable partners help us build a secure and prosperous state. Your commitment is welcome.",
      "neutral": "We will consider the practical consequences for Egypt’s security and economy.",
      "hostile": "Disorder at our borders will not be accepted as a normal condition.",
      "warDeclaration": "Egypt’s security requires action. Our armed forces will carry it out.",
      "victory": "The immediate danger has been contained. We must now establish a stable settlement.",
      "defeat": "The military situation demands a settlement that preserves the functioning of the state."
    }
  },
  {
    "id": "leader_benjamin_netanyahu",
    "isDefault": true,
    "name": "Benjamin Netanyahu",
    "nationId": "nation_israel",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/benjamin-netanyahu.png",
    "description": "A long-serving Israeli prime minister and Likud leader whose political career emphasizes national security, diplomatic bargaining and market-oriented economic policy.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "homeland_defense",
    "aiMilitaryDoctrineId": "eliteArmy",
    "covertPersonalityId": "schemer",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "code_of_laws",
      "diplomatic_service",
      "mobilization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 3,
      "expansionBias": -24,
      "economyBias": 25,
      "cultureBias": 4,
      "diplomacyBias": 6,
      "warTolerance": 86,
      "peacePreference": 42,
      "minimumUnitsLostBeforePeace": 7,
      "casualtyToleranceRatio": 0.65,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Israel is ready to discuss cooperation. Any agreement must address our security.",
      "friendly": "Practical cooperation has made both our countries stronger. Let us extend it.",
      "neutral": "We will assess your proposal by its consequences, including those beyond the first agreement.",
      "hostile": "Your assurances mean little while your actions increase the danger we face.",
      "warDeclaration": "We will act against this threat before it dictates our future.",
      "victory": "Our objectives have been secured. The terms must prevent the danger from returning.",
      "defeat": "We must now secure the strongest guarantees that the circumstances permit."
    },
    "maxPreferredCities": 4
  },
  {
    "id": "leader_recep_tayyip_erdogan",
    "isDefault": true,
    "name": "Recep Tayyip Erdoğan",
    "nationId": "nation_turkey",
    "title": "President",
    "image": "/assets/sprites/leaders/recep-tayyip-erdogan.png",
    "description": "A Turkish politician who served as prime minister before becoming president in 2014, Erdoğan combines national ambition, economic development and assertive regional diplomacy.",
    "ideologyId": "nationalism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "prestigeProjection",
    "covertPersonalityId": "opportunist",
    "opportunism": true,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "nationalism",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "wrestling",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": 6,
      "expansionBias": 8,
      "economyBias": 22,
      "cultureBias": 8,
      "diplomacyBias": 16,
      "warTolerance": 64,
      "peacePreference": 52,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.45,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "Turkey has interests across this region. There is room for cooperation if those interests are respected.",
      "friendly": "Our partnership is delivering results. We should build on the opportunities before us.",
      "neutral": "Turkey will judge this proposal on its merits and on our national interest.",
      "hostile": "You cannot expect Turkish cooperation while disregarding our position.",
      "warDeclaration": "Turkey will use its strength to secure the interests you have chosen to challenge.",
      "victory": "Turkey’s influence must now be reflected in a practical agreement.",
      "defeat": "We must reassess the balance and negotiate terms that preserve our room to act."
    }
  },
  {
    "id": "leader_mohammed_bin_salman",
    "isDefault": true,
    "name": "Mohammed bin Salman",
    "nationId": "nation_saudi_arabia",
    "title": "Crown Prince",
    "image": "/assets/sprites/leaders/mohammed-bin-salman.png",
    "description": "Saudi crown prince since 2017, Mohammed bin Salman has pursued economic diversification and state-led modernization alongside centralized political authority.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "prestigeProjection",
    "covertPersonalityId": "merchant",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "civil_engineering",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": -16,
      "expansionBias": -18,
      "economyBias": 34,
      "cultureBias": 12,
      "diplomacyBias": 20,
      "warTolerance": 34,
      "peacePreference": 80,
      "minimumUnitsLostBeforePeace": 2,
      "casualtyToleranceRatio": 0.24,
      "resourceExploitationInterest": 4
    },
    "diplomacyFlavor": {
      "greeting": "The kingdom is building for the future. Bring us a proposal that creates value.",
      "friendly": "Investment and dependable trade have made this partnership worth developing.",
      "neutral": "We will weigh the returns, the risks and the commitments behind your offer.",
      "hostile": "Access to our markets and investment depends on conduct that sustains confidence.",
      "warDeclaration": "You have put our security and economic future at risk. We will commit the force needed to protect them.",
      "victory": "Our position is secure. A stable settlement will allow development to resume.",
      "defeat": "This conflict is consuming resources needed elsewhere. We must negotiate an end."
    },
    "maxPreferredCities": 5
  }
];
