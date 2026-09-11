import type { LeaderDefinition } from '../types/leader';

/** Historical game interpretations; dialogue and sport preferences are fictional.
 * Nationalism models sovereignty within Epoch's existing ideology vocabulary.
 */
export const CENTRAL_EASTERN_EUROPEAN_LEADERS: LeaderDefinition[] = [
  {
    "id": "leader_alexander_lukashenko",
    "isDefault": true,
    "name": "Alexander Lukashenko",
    "nationId": "nation_belarus",
    "title": "President",
    "image": "/assets/sprites/leaders/alexander-lukashenko.png",
    "description": "A Belarusian president associated with centralized state authority, a substantial state economic sector and close security ties with Russia.",
    "ideologyId": "nationalism",
    "aiNationalAgendaId": "isolationist",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "schemer",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "civil_engineering",
      "nationalism"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "wrestling",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": -4,
      "expansionBias": -12,
      "economyBias": 18,
      "cultureBias": -2,
      "diplomacyBias": -10,
      "warTolerance": 62,
      "peacePreference": 64,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.4,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "Belarus welcomes agreements that respect our state and keep our economy working.",
      "friendly": "Reliable partners deserve reliable deliveries. Let us keep our agreements practical.",
      "neutral": "We will examine the terms. Stability cannot rest on promises alone.",
      "hostile": "Pressure on Belarus will bring a response. Reconsider your course.",
      "warDeclaration": "Your actions have crossed the limits of negotiation. Belarus will use force.",
      "victory": "Our position is secured. The settlement must guarantee stability.",
      "defeat": "We will negotiate terms that preserve our state and allow recovery."
    }
  },
  {
    "id": "leader_josip_broz_tito",
    "isDefault": true,
    "name": "Josip Broz Tito",
    "nationId": "nation_yugoslavia",
    "title": "President",
    "image": "/assets/sprites/leaders/josip-broz-tito.png",
    "description": "Yugoslav president and former partisan commander whose socialist federation pursued independence from Moscow and a leading role in non-alignment.",
    "ideologyId": "nationalism",
    "aiNationalAgendaId": "homeland_defense",
    "aiMilitaryDoctrineId": "disciplinedInfantry",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "diplomatic_service",
      "class_struggle",
      "state_workforce",
      "foreign_trade"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 2,
      "expansionBias": 4,
      "economyBias": 12,
      "cultureBias": 14,
      "diplomacyBias": 26,
      "warTolerance": 82,
      "peacePreference": 62,
      "minimumUnitsLostBeforePeace": 7,
      "casualtyToleranceRatio": 0.62,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Yugoslavia welcomes friendship with every nation that respects our independence.",
      "friendly": "We cooperate as equals. Neither of us needs another power to speak on our behalf.",
      "neutral": "A useful agreement must leave both parties free to choose their own course.",
      "hostile": "Our independence is not a matter for your approval.",
      "warDeclaration": "Yugoslavia will fight rather than accept the terms you would impose by force.",
      "victory": "Our independence has been defended. Let us establish a peace between equals.",
      "defeat": "We can accept a settlement, but Yugoslavia must retain its own voice."
    }
  },
  {
    "id": "leader_antonin_zapotocky",
    "isDefault": true,
    "name": "Antonín Zápotocký",
    "nationId": "nation_czechoslovakia",
    "title": "President",
    "image": "/assets/sprites/leaders/antonin-zapotocky.png",
    "description": "Czechoslovak prime minister from 1948 to 1953 and president from 1953 to 1957, a Communist Party and trade-union leader involved in the repressive consolidation of the party-state.",
    "ideologyId": "nationalism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "fortifiedDefense",
    "covertPersonalityId": "paranoid",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "civil_engineering",
      "class_struggle",
      "totalitarianism"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": -18,
      "expansionBias": -14,
      "economyBias": 28,
      "cultureBias": 6,
      "diplomacyBias": -16,
      "warTolerance": 58,
      "peacePreference": 72,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.36,
      "resourceExploitationInterest": 4
    },
    "diplomacyFlavor": {
      "greeting": "Czechoslovakia receives you. State your proposal and its consequences for our workers.",
      "friendly": "Dependable agreements support our factories and the security of our republic.",
      "neutral": "We require concrete commitments, delivery schedules and respect for our institutions.",
      "hostile": "Your interference threatens the work of rebuilding our country.",
      "warDeclaration": "Our republic will answer these hostile acts with military force.",
      "victory": "Our defenses have prevailed. Reconstruction and production must now resume.",
      "defeat": "The republic needs an end to these losses. We will discuss a settlement."
    }
  }
];
