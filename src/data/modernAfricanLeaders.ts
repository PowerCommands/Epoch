import type { LeaderDefinition } from '../types/leader';

/** Gameplay interpretations, not claims about personal beliefs. Dialogue and sport preferences are fictional. */
export const MODERN_AFRICAN_LEADERS: LeaderDefinition[] = [
  {
    "id": "leader_bola_tinubu",
    "isDefault": true,
    "name": "Bola Tinubu",
    "nationId": "nation_nigeria",
    "title": "President",
    "image": "/assets/sprites/leaders/bola-tinubu.png",
    "description": "Former governor of Lagos State (1999–2007), inaugurated as Nigerian president in 2023. His administration has pursued economic reforms and investment in infrastructure and energy.",
    "ideologyId": "liberalism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "merchant",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "mercantilism",
      "civil_engineering",
      "globalization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "long_jump",
      "additionalFavourite": "hundred_metres"
    },
    "aiPersonality": {
      "aggressionBias": -8,
      "expansionBias": 2,
      "economyBias": 36,
      "cultureBias": 10,
      "diplomacyBias": 20,
      "warTolerance": 48,
      "peacePreference": 70,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.32,
      "resourceExploitationInterest": 4
    },
    "diplomacyFlavor": {
      "greeting": "Nigeria welcomes partners ready to turn commerce and investment into shared prosperity.",
      "friendly": "Let us develop our oil and natural gas resources through agreements that reward both partners.",
      "neutral": "Show us the investment, the terms and the benefit to our people.",
      "hostile": "Pressure that disrupts our trade will make cooperation harder.",
      "warDeclaration": "Nigeria will use force to secure the interests that negotiation has failed to protect.",
      "victory": "Let us reopen commerce and put recovery at the centre of the settlement.",
      "defeat": "We must reach practical terms and return our attention to livelihoods."
    }
  },
  {
    "id": "leader_goodluck_jonathan",
    "isDefault": false,
    "name": "Goodluck Jonathan",
    "nationId": "nation_nigeria",
    "title": "President",
    "image": "/assets/sprites/leaders/goodluck-jonathan.png",
    "description": "President of Nigeria from 2010 to 2015. He conceded the 2015 election and subsequently participated in international election observation and regional mediation.",
    "ideologyId": "globalism",
    "aiNationalAgendaId": "balanced",
    "aiMilitaryDoctrineId": "culturalDefense",
    "covertPersonalityId": "honorable",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "civil_service_civics",
      "democracy",
      "diplomatic_service",
      "foreign_trade"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "wrestling",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": -24,
      "expansionBias": -12,
      "economyBias": 20,
      "cultureBias": 20,
      "diplomacyBias": 34,
      "warTolerance": 30,
      "peacePreference": 88,
      "minimumUnitsLostBeforePeace": 2,
      "casualtyToleranceRatio": 0.22,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Nigeria welcomes dialogue founded on mutual respect and dependable institutions.",
      "friendly": "Cooperation lasts when nations honour their commitments to one another.",
      "neutral": "Let our institutions work through the details and find common ground.",
      "hostile": "There is still time for mediation. Do not let disagreement become a war.",
      "warDeclaration": "We enter this conflict reluctantly, to defend Nigeria and restore a secure peace.",
      "victory": "Let this settlement strengthen peace and the institutions that sustain it.",
      "defeat": "An agreement that ends the suffering deserves a serious hearing."
    }
  },
  {
    "id": "leader_william_ruto",
    "isDefault": true,
    "name": "William Ruto",
    "nationId": "nation_kenya",
    "title": "President",
    "image": "/assets/sprites/leaders/william-ruto.png",
    "description": "Inaugurated as Kenyan president in 2022 after serving as deputy president from 2013 to 2022. His economic programme emphasizes agriculture, housing and small enterprises.",
    "ideologyId": "liberalism",
    "aiNationalAgendaId": "growth",
    "aiMilitaryDoctrineId": "economicMinimalArmy",
    "covertPersonalityId": "merchant",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "civil_engineering",
      "guilds",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "hundred_metres"
    },
    "aiPersonality": {
      "aggressionBias": -18,
      "expansionBias": -4,
      "economyBias": 30,
      "cultureBias": 12,
      "diplomacyBias": 26,
      "warTolerance": 36,
      "peacePreference": 80,
      "minimumUnitsLostBeforePeace": 2,
      "casualtyToleranceRatio": 0.28,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "Kenya welcomes partners in farming, enterprise and regional prosperity.",
      "friendly": "Better roads, stronger farms and open markets can lift both our peoples.",
      "neutral": "Let us judge this proposal by the opportunities it creates.",
      "hostile": "Disruption of regional commerce serves neither of us. Return to negotiations.",
      "warDeclaration": "Kenya will defend its people and the foundations of their prosperity.",
      "victory": "Let us restore trade and give our people room to build better lives.",
      "defeat": "We should secure peace and resume the work of development."
    }
  },
  {
    "id": "leader_uhuru_kenyatta",
    "isDefault": false,
    "name": "Uhuru Kenyatta",
    "nationId": "nation_kenya",
    "title": "President",
    "image": "/assets/sprites/leaders/uhuru-kenyatta.png",
    "description": "President of Kenya from 2013 to 2022. His presidency included major transport infrastructure projects, regional diplomacy and security cooperation.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "civil_engineering",
      "diplomatic_service",
      "defensive_tactics"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": -10,
      "expansionBias": 2,
      "economyBias": 28,
      "cultureBias": 14,
      "diplomacyBias": 24,
      "warTolerance": 52,
      "peacePreference": 72,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.38,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "Kenya seeks dependable partners for development and regional stability.",
      "friendly": "Our infrastructure will achieve more when it connects prosperous neighbours.",
      "neutral": "A sound agreement needs financing, delivery and credible security.",
      "hostile": "Kenya will maintain the strength needed to safeguard its independence.",
      "warDeclaration": "Our forces will act to protect Kenya and restore regional security.",
      "victory": "The settlement must secure stability so that development can continue.",
      "defeat": "Let us agree on workable terms and preserve the means to rebuild."
    }
  },
  {
    "id": "leader_nelson_mandela",
    "isDefault": true,
    "name": "Nelson Mandela",
    "nationId": "nation_south_africa",
    "title": "President",
    "image": "/assets/sprites/leaders/nelson-mandela.png",
    "description": "Anti-apartheid leader and president of South Africa from 1994 to 1999 after its first national election with universal adult suffrage. He promoted reconciliation and a constitutional democracy.",
    "ideologyId": "progressivism",
    "aiNationalAgendaId": "culture",
    "aiMilitaryDoctrineId": "culturalDefense",
    "covertPersonalityId": "honorable",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "humanism",
      "democracy",
      "diplomatic_service",
      "games_recreation",
      "suffrage"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": -40,
      "expansionBias": -30,
      "economyBias": 14,
      "cultureBias": 38,
      "diplomacyBias": 40,
      "warTolerance": 22,
      "peacePreference": 96,
      "minimumUnitsLostBeforePeace": 1,
      "casualtyToleranceRatio": 0.18,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "South Africa greets you as an equal. Let us begin with respect and the possibility of friendship.",
      "friendly": "Reconciliation grows through patient cooperation. Our peoples deserve that effort.",
      "neutral": "Every nation deserves a voice. Let us seek a solution that respects us both.",
      "hostile": "Even now, dialogue remains possible. Let us step back from unnecessary suffering.",
      "warDeclaration": "We have sought a peaceful resolution. South Africa will defend its sovereignty, while keeping the door open to peace.",
      "victory": "Victory must become reconciliation. Let us build a peace that respects the dignity of both peoples.",
      "defeat": "We must end the suffering through a just settlement and begin the work of reconciliation."
    }
  },
  {
    "id": "leader_thabo_mbeki",
    "isDefault": false,
    "name": "Thabo Mbeki",
    "nationId": "nation_south_africa",
    "title": "President",
    "image": "/assets/sprites/leaders/thabo-mbeki.png",
    "description": "President of South Africa from 1999 to 2008. His administration emphasized economic policy and African diplomacy, including regional cooperation and the development of continental institutions.",
    "ideologyId": "globalism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "merchant",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "civil_service_civics",
      "civil_engineering",
      "diplomatic_service",
      "globalization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "hundred_metres"
    },
    "aiPersonality": {
      "aggressionBias": -22,
      "expansionBias": -8,
      "economyBias": 34,
      "cultureBias": 20,
      "diplomacyBias": 32,
      "warTolerance": 40,
      "peacePreference": 84,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.3,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "South Africa welcomes practical cooperation for development across our region.",
      "friendly": "Trade and capable institutions can turn our shared ambitions into lasting progress.",
      "neutral": "Let us examine the economic consequences and our wider regional responsibilities.",
      "hostile": "Your actions undermine regional cooperation. We need a credible change of course.",
      "warDeclaration": "South Africa will act to protect its security and the conditions for regional stability.",
      "victory": "Let this settlement restore stability, trade and the work of development.",
      "defeat": "We must negotiate a sustainable peace and preserve the foundations of recovery."
    }
  }
];
