import type { LeaderDefinition } from '../types/leader';

/** Alternative governments, not ranked replacements. Fictional game dialogue and sport preferences.
 * Broad historical interpretations; Han Seo-jin is explicitly fictional.
 */
export const ROSTER_ALTERNATIVE_LEADERS: LeaderDefinition[] = [
  {
    "id": "leader_frederick_barbarossa",
    "isDefault": false,
    "nationId": "nation_hre",
    "name": "Frederick Barbarossa",
    "title": "Holy Roman Emperor",
    "image": "/assets/sprites/leaders/frederick-barbarossa.png",
    "description": "A Hohenstaufen emperor who sought to strengthen imperial authority and asserted imperial claims through military campaigns and negotiation.",
    "ideologyId": "militarism",
    "aiNationalAgendaId": "expansionist",
    "aiMilitaryDoctrineId": "imperialCombinedArms",
    "covertPersonalityId": "pragmatist",
    "opportunism": true,
    "impulsiveBully": false,
    "culturePriorities": [
      "early_empire",
      "state_workforce",
      "military_tradition"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "wrestling",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": 18,
      "expansionBias": 18,
      "economyBias": 10,
      "cultureBias": 2,
      "diplomacyBias": -4,
      "warTolerance": 78,
      "peacePreference": 30,
      "minimumUnitsLostBeforePeace": 7,
      "casualtyToleranceRatio": 0.58,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "The empire requires order, and order requires authority. Speak your terms.",
      "friendly": "You have honored the imperial settlement. Your friendship has weight at this court.",
      "neutral": "An agreement must strengthen the peace and recognize the rights of the empire.",
      "hostile": "You challenge imperial authority. Consider whether you can sustain that challenge.",
      "warDeclaration": "The imperial host will enforce the claims you have refused to acknowledge.",
      "victory": "Our authority is established. Now the conquered lands must be governed.",
      "defeat": "The campaign has failed. We will negotiate without abandoning the imperial crown."
    }
  },
  {
    "id": "leader_mindaugas",
    "isDefault": false,
    "nationId": "nation_lithuania",
    "name": "Mindaugas",
    "title": "King",
    "image": "/assets/sprites/leaders/mindaugas.png",
    "description": "A medieval Lithuanian ruler whose kingship brought together competing lands through force, negotiation and changing political alliances.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "growth",
    "aiMilitaryDoctrineId": "balanced",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "code_of_laws",
      "state_workforce",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": -5,
      "expansionBias": 2,
      "economyBias": 18,
      "cultureBias": 8,
      "diplomacyBias": 18,
      "warTolerance": 52,
      "peacePreference": 66,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.38,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Lithuania is building a state that can endure. We welcome agreements that help it stand.",
      "friendly": "Our compact has strengthened both our positions. Let us preserve it.",
      "neutral": "Before we make another promise, we must know how it will hold our lands together.",
      "hostile": "Your interference threatens the settlement on which our kingdom rests.",
      "warDeclaration": "The unity of our realm is at stake. Our warriors will now defend it.",
      "victory": "The kingdom is secure. An orderly settlement must follow the fighting.",
      "defeat": "We must preserve the state we have built. Let us negotiate an end to the losses."
    }
  },
  {
    "id": "leader_alexander_nevsky",
    "isDefault": false,
    "nationId": "nation_novgorod",
    "name": "Alexander Nevsky",
    "title": "Prince",
    "image": "/assets/sprites/leaders/alexander-nevsky.png",
    "description": "A prince of Novgorod remembered for military leadership and pragmatic dealings with stronger neighboring powers.",
    "ideologyId": "traditionalism",
    "aiNationalAgendaId": "homeland_defense",
    "aiMilitaryDoctrineId": "disciplinedInfantry",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "military_tradition",
      "nationalism",
      "mobilization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "wrestling",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 3,
      "expansionBias": -6,
      "economyBias": 4,
      "cultureBias": 0,
      "diplomacyBias": 8,
      "warTolerance": 86,
      "peacePreference": 58,
      "minimumUnitsLostBeforePeace": 8,
      "casualtyToleranceRatio": 0.64,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "Novgorod must survive between powerful neighbors. Strength and negotiation both have their place.",
      "friendly": "You have respected our lands. We can meet as dependable partners.",
      "neutral": "We shall judge your proposal by the security it offers our people.",
      "hostile": "Our frontier is defended. Do not confuse restraint with an invitation.",
      "warDeclaration": "Our forces will meet the danger you have brought to Novgorod.",
      "victory": "Our people remain free to rebuild. The victory must secure a lasting frontier.",
      "defeat": "If an agreement preserves our lands and people, we will hear it."
    }
  },
  {
    "id": "leader_mikhail_gorbachev",
    "isDefault": false,
    "nationId": "nation_soviet_union",
    "name": "Mikhail Gorbachev",
    "title": "President",
    "image": "/assets/sprites/leaders/mikhail-gorbachev.png",
    "description": "The final Soviet leader, associated with perestroika, glasnost, arms-control negotiations and attempts to reform the Soviet political and economic system.",
    "ideologyId": "progressivism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "honorable",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "diplomatic_service",
      "civil_engineering",
      "suffrage"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -28,
      "expansionBias": -18,
      "economyBias": 26,
      "cultureBias": 14,
      "diplomacyBias": 32,
      "warTolerance": 32,
      "peacePreference": 94,
      "minimumUnitsLostBeforePeace": 2,
      "casualtyToleranceRatio": 0.2,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "The Soviet Union seeks renewal at home and cooperation abroad. Let us begin with practical steps.",
      "friendly": "Every agreement that works gives us room for another. We should build on this progress.",
      "neutral": "We need terms that reduce confrontation and allow our economies to develop.",
      "hostile": "Your actions undermine the confidence that reform and cooperation require.",
      "warDeclaration": "Negotiation has failed to protect our security. We have authorized military action.",
      "victory": "The military objective is achieved. We must return to negotiations without delay.",
      "defeat": "Continuing would sacrifice the future for a failing campaign. Let us agree on peace."
    }
  },
  {
    "id": "leader_suleiman_the_magnificent",
    "isDefault": false,
    "nationId": "nation_ottoman",
    "name": "Suleiman the Magnificent",
    "title": "Sultan",
    "image": "/assets/sprites/leaders/suleiman-the-magnificent.png",
    "description": "An Ottoman sultan whose reign combined imperial campaigns with legal administration, architectural patronage and diplomacy.",
    "ideologyId": "traditionalism",
    "aiNationalAgendaId": "culture",
    "aiMilitaryDoctrineId": "imperialCombinedArms",
    "covertPersonalityId": "schemer",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "code_of_laws",
      "civil_service_civics",
      "foreign_trade",
      "humanism"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": 8,
      "expansionBias": 8,
      "economyBias": 20,
      "cultureBias": 26,
      "diplomacyBias": 16,
      "warTolerance": 68,
      "peacePreference": 54,
      "minimumUnitsLostBeforePeace": 5,
      "casualtyToleranceRatio": 0.48,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "The Porte welcomes you. A great empire is sustained by law, commerce and capable partners.",
      "friendly": "Our friendship brings prosperity to merchants and stability to the frontier.",
      "neutral": "The terms must serve both the treasury and the dignity of the imperial office.",
      "hostile": "You put profitable peace at risk. The empire has the means to answer.",
      "warDeclaration": "Our armies will secure the settlement that your actions have made impossible by negotiation.",
      "victory": "Victory gives us responsibilities as well as territory. Administration will follow the army.",
      "defeat": "Even an empire must weigh the cost of war. We will consider an honorable settlement."
    }
  },
  {
    "id": "leader_mohammed_v",
    "isDefault": false,
    "nationId": "nation_morocco_empire",
    "name": "Mohammed V",
    "title": "King",
    "image": "/assets/sprites/leaders/mohammed-v.png",
    "description": "Moroccan monarch and a central figure in the movement for independence, linking royal authority with national sovereignty and state-building.",
    "ideologyId": "nationalism",
    "aiNationalAgendaId": "growth",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "honorable",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "nationalism",
      "diplomatic_service",
      "civil_engineering"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": -12,
      "expansionBias": -8,
      "economyBias": 20,
      "cultureBias": 16,
      "diplomacyBias": 24,
      "warTolerance": 56,
      "peacePreference": 78,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.38,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Morocco welcomes partners who respect our independence and the work of national development.",
      "friendly": "Our cooperation strengthens the independence we have worked to secure.",
      "neutral": "We seek an agreement that respects the crown, the nation and our common interests.",
      "hostile": "Our sovereignty cannot be treated as a condition to be negotiated away.",
      "warDeclaration": "Morocco will defend its independence with force where negotiation no longer protects it.",
      "victory": "The nation has secured its position. Our attention must return to development.",
      "defeat": "We will seek peace that preserves Moroccan independence and allows our people to recover."
    }
  },
  {
    "id": "leader_tsai_ing_wen",
    "isDefault": false,
    "nationId": "nation_taiwan",
    "name": "Tsai Ing-wen",
    "title": "President",
    "image": "/assets/sprites/leaders/tsai-ing-wen.png",
    "description": "A former president of Taiwan whose administration emphasized economic development, international partnerships and defense preparedness.",
    "ideologyId": "liberalism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "eliteArmy",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "diplomatic_service",
      "civil_engineering"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -24,
      "expansionBias": -22,
      "economyBias": 30,
      "cultureBias": 12,
      "diplomacyBias": 28,
      "warTolerance": 64,
      "peacePreference": 84,
      "minimumUnitsLostBeforePeace": 5,
      "casualtyToleranceRatio": 0.42,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Taiwan welcomes reliable partners in trade, technology and regional security.",
      "friendly": "Our partnership gives both societies more room to prosper. We value its reliability.",
      "neutral": "We will assess the benefits, the risks and the commitments needed to sustain this agreement.",
      "hostile": "Coercion damages regional stability. Our defenses and partnerships remain ready.",
      "warDeclaration": "We must use force to protect the security that your actions now threaten.",
      "victory": "Our objectives are secured. A stable settlement is more valuable than an open-ended campaign.",
      "defeat": "We must preserve our society and capacity to recover. We will pursue a negotiated end."
    }
  },
  {
    "id": "leader_sundiata_keita",
    "isDefault": false,
    "nationId": "nation_mali_empire",
    "name": "Sundiata Keita",
    "title": "Mansa",
    "image": "/assets/sprites/leaders/sundiata-keita.png",
    "description": "The founder of the Mali Empire, remembered in Mandinka historical traditions for forging political unity and establishing a powerful regional state.",
    "ideologyId": "nationalism",
    "aiNationalAgendaId": "expansionist",
    "aiMilitaryDoctrineId": "disciplinedInfantry",
    "covertPersonalityId": "pragmatist",
    "opportunism": true,
    "impulsiveBully": false,
    "culturePriorities": [
      "early_empire",
      "military_tradition",
      "state_workforce"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "wrestling",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": 20,
      "expansionBias": 24,
      "economyBias": 8,
      "cultureBias": 6,
      "diplomacyBias": 2,
      "warTolerance": 80,
      "peacePreference": 34,
      "minimumUnitsLostBeforePeace": 7,
      "casualtyToleranceRatio": 0.6,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "Mali is gathering its strength. Those who stand with us may help shape a lasting kingdom.",
      "friendly": "Our alliance joins the strength of our peoples. Let us keep faith with it.",
      "neutral": "Your offer must strengthen the unity and security of the realm.",
      "hostile": "You would divide what we have brought together. Our forces will resist you.",
      "warDeclaration": "The armies of Mali will march to secure our realm and its future.",
      "victory": "The field is ours. We must now bind these lands into a durable state.",
      "defeat": "The people must endure beyond this battle. We will seek terms that preserve our union."
    }
  },
  {
    "id": "leader_kublai_khan",
    "isDefault": false,
    "nationId": "nation_mongolia",
    "name": "Kublai Khan",
    "title": "Great Khan",
    "image": "/assets/sprites/leaders/kublai-khan.png",
    "description": "Mongol emperor and founder of the Yuan dynasty, combining imperial military power with urban administration, infrastructure and trade.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "growth",
    "aiMilitaryDoctrineId": "imperialCombinedArms",
    "covertPersonalityId": "merchant",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "foreign_trade",
      "civil_engineering"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": 6,
      "expansionBias": 8,
      "economyBias": 28,
      "cultureBias": 20,
      "diplomacyBias": 12,
      "warTolerance": 70,
      "peacePreference": 52,
      "minimumUnitsLostBeforePeace": 6,
      "casualtyToleranceRatio": 0.5,
      "resourceExploitationInterest": 4
    },
    "diplomacyFlavor": {
      "greeting": "An empire needs roads, cities and trade as surely as it needs armies. What do you propose?",
      "friendly": "Our agreement carries goods and knowledge across great distances. It should continue.",
      "neutral": "I will judge these terms by the strength they bring to the governed realm.",
      "hostile": "You obstruct the order on which our cities and trade depend.",
      "warDeclaration": "The imperial army will remove the obstacle your government has placed before us.",
      "victory": "Our victory must become lasting government, productive cities and secure roads.",
      "defeat": "The realm cannot be spent on a single campaign. We will negotiate a workable peace."
    }
  },
  {
    "id": "leader_tokugawa_ieyasu",
    "isDefault": false,
    "nationId": "nation_japan",
    "name": "Tokugawa Ieyasu",
    "title": "Shogun",
    "image": "/assets/sprites/leaders/tokugawa-ieyasu.png",
    "description": "Founder of the Tokugawa shogunate, whose political settlement established a durable military government and consolidated authority over Japan.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "isolationist",
    "aiMilitaryDoctrineId": "fortifiedDefense",
    "covertPersonalityId": "schemer",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "code_of_laws",
      "state_workforce",
      "civil_engineering"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "wrestling",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -8,
      "expansionBias": -10,
      "economyBias": 22,
      "cultureBias": 14,
      "diplomacyBias": -8,
      "warTolerance": 72,
      "peacePreference": 68,
      "minimumUnitsLostBeforePeace": 6,
      "casualtyToleranceRatio": 0.5,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "A settled realm is built by patient work. Let us speak with care.",
      "friendly": "You have observed our agreements. Such consistency makes cooperation possible.",
      "neutral": "We will weigh the lasting consequences before we commit ourselves.",
      "hostile": "Your conduct threatens the order we have established. It will not pass unanswered.",
      "warDeclaration": "The security of the realm requires force. Our commanders have their orders.",
      "victory": "The disorder is ended. We will secure the peace and restore sound administration.",
      "defeat": "We must protect the foundations of the realm. A measured settlement is necessary."
    }
  },
  {
    "id": "leader_anne_bonny",
    "isDefault": false,
    "nationId": "nation_pirate",
    "name": "Anne Bonny",
    "title": "Captain",
    "image": "/assets/sprites/leaders/anne-bonny.png",
    "description": "An Atlantic pirate remembered for sailing with John Rackham. Epoch imagines her as a calculating captain seeking profitable raids and maritime advantage.",
    "ideologyId": "freebooters",
    "aiNationalAgendaId": "naval_power",
    "aiMilitaryDoctrineId": "maritimeRaider",
    "covertPersonalityId": "pirate",
    "opportunism": true,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "exploration",
      "mercenaries"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": 16,
      "expansionBias": 4,
      "economyBias": 22,
      "cultureBias": -4,
      "diplomacyBias": -6,
      "warTolerance": 56,
      "peacePreference": 50,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.32,
      "resourceExploitationInterest": 4
    },
    "maxPreferredCities": 3,
    "diplomacyFlavor": {
      "greeting": "Tell me what is aboard, what the passage is worth, and why we should make a bargain.",
      "friendly": "Your word has paid as well as your coin. We can do business again.",
      "neutral": "Every bargain has a risk. Show me why this one is worth taking.",
      "hostile": "You have made yourself costly company. I know cheaper ways to settle an account.",
      "warDeclaration": "Your shipping is worth the risk. My captains have their orders.",
      "victory": "Take the profit, secure the anchorage, and leave before the next fleet arrives.",
      "defeat": "The prize no longer covers the cost. Name terms that let my crews sail again."
    }
  },
  {
    "id": "leader_urho_kekkonen",
    "isDefault": false,
    "nationId": "nation_finland",
    "name": "Urho Kekkonen",
    "title": "President",
    "image": "/assets/sprites/leaders/urho-kekkonen.png",
    "description": "A Finnish president associated with neutrality, relations with the Soviet Union and efforts to maintain Finnish independence between competing powers.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "balanced",
    "aiMilitaryDoctrineId": "disciplinedInfantry",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "diplomatic_service",
      "foreign_trade",
      "code_of_laws"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "pole_vault"
    },
    "aiPersonality": {
      "aggressionBias": -20,
      "expansionBias": -14,
      "economyBias": 16,
      "cultureBias": 8,
      "diplomacyBias": 30,
      "warTolerance": 66,
      "peacePreference": 90,
      "minimumUnitsLostBeforePeace": 5,
      "casualtyToleranceRatio": 0.42,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "Finland seeks room to act independently and to maintain workable relations on every side.",
      "friendly": "We have kept our agreements through difficult circumstances. That is worth protecting.",
      "neutral": "We must consider how these terms affect the wider balance, as well as our immediate interests.",
      "hostile": "Pressure that narrows our independence also narrows the possibilities for cooperation.",
      "warDeclaration": "Finland has exhausted the available negotiations. Our defenses will now act.",
      "victory": "Our position is protected. We should restore a workable relationship before new dangers arise.",
      "defeat": "The settlement must preserve our independence and a practical basis for coexistence."
    }
  },
  {
    "id": "leader_stephen_harper",
    "isDefault": false,
    "nationId": "nation_canada",
    "name": "Stephen Harper",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/stephen-harper.png",
    "description": "A former Canadian prime minister and Conservative Party leader whose government emphasized economic policy, trade and national security.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "disciplinedInfantry",
    "covertPersonalityId": "merchant",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "civil_engineering",
      "military_tradition"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": -12,
      "expansionBias": -12,
      "economyBias": 30,
      "cultureBias": 2,
      "diplomacyBias": 8,
      "warTolerance": 60,
      "peacePreference": 72,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.36,
      "resourceExploitationInterest": 4
    },
    "diplomacyFlavor": {
      "greeting": "Canada seeks dependable trade, sound economic policy and credible security commitments.",
      "friendly": "Our partnership delivers practical benefits. We should keep those commitments firm.",
      "neutral": "We will examine what this proposal costs and what it delivers for Canada.",
      "hostile": "Your conduct puts both our security and a productive economic relationship at risk.",
      "warDeclaration": "Canada will use force to address the threat that diplomacy has failed to resolve.",
      "victory": "Our forces have achieved their objective. The settlement must justify the costs our people have borne.",
      "defeat": "We must weigh the national interest against further losses. We will negotiate."
    }
  },
  {
    "id": "leader_vicente_fox",
    "isDefault": false,
    "nationId": "nation_mexico",
    "name": "Vicente Fox",
    "title": "President",
    "image": "/assets/sprites/leaders/vicente-fox.png",
    "description": "A former Mexican president from the National Action Party, associated with electoral alternation and a commercially oriented economic agenda.",
    "ideologyId": "liberalism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "economicMinimalArmy",
    "covertPersonalityId": "merchant",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "foreign_trade",
      "diplomatic_service",
      "suffrage"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": -24,
      "expansionBias": -10,
      "economyBias": 30,
      "cultureBias": 8,
      "diplomacyBias": 26,
      "warTolerance": 30,
      "peacePreference": 92,
      "minimumUnitsLostBeforePeace": 2,
      "casualtyToleranceRatio": 0.22,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "Mexico welcomes the exchange of goods, ideas and opportunity. Let us discuss what we can build.",
      "friendly": "Our cooperation is opening markets and creating possibilities for both our peoples.",
      "neutral": "We want clear rules and benefits that reach beyond a single political moment.",
      "hostile": "Your actions are closing doors that should remain open to commerce and dialogue.",
      "warDeclaration": "Mexico will act militarily where our security can no longer be protected through negotiation.",
      "victory": "The fighting has achieved its purpose. Let us reopen the path to trade and recovery.",
      "defeat": "Peace offers our citizens more than this campaign can. We will seek a settlement."
    }
  },
  {
    "id": "leader_juan_peron",
    "isDefault": false,
    "nationId": "nation_argentina",
    "name": "Juan Perón",
    "title": "President",
    "image": "/assets/sprites/leaders/juan-peron.png",
    "description": "An Argentine president whose political movement emphasized organized labor, economic nationalism, industrial development and an active state.",
    "ideologyId": "nationalism",
    "aiNationalAgendaId": "growth",
    "aiMilitaryDoctrineId": "disciplinedInfantry",
    "covertPersonalityId": "schemer",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "nationalism",
      "civil_engineering",
      "mobilization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "wrestling",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": 2,
      "expansionBias": 0,
      "economyBias": 22,
      "cultureBias": 18,
      "diplomacyBias": 2,
      "warTolerance": 62,
      "peacePreference": 56,
      "minimumUnitsLostBeforePeace": 5,
      "casualtyToleranceRatio": 0.44,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Argentina seeks development that strengthens the nation and the working people who sustain it.",
      "friendly": "Our cooperation supports employment and national industry. Let us build on it.",
      "neutral": "We will judge your offer by what it brings to our workers and our productive independence.",
      "hostile": "You threaten a national project that Argentina intends to defend.",
      "warDeclaration": "Our armed forces will act to protect the interests of the Argentine nation.",
      "victory": "Our position is secure. The fruits of victory must serve national development.",
      "defeat": "The nation needs recovery and work. We will negotiate terms that permit both."
    }
  },
  {
    "id": "leader_petro_poroshenko",
    "isDefault": false,
    "nationId": "nation_ukraine",
    "name": "Petro Poroshenko",
    "title": "President",
    "image": "/assets/sprites/leaders/petro-poroshenko.png",
    "description": "A former Ukrainian president whose administration emphasized national sovereignty, closer European ties and rebuilding military capacity.",
    "ideologyId": "nationalism",
    "aiNationalAgendaId": "homeland_defense",
    "aiMilitaryDoctrineId": "eliteArmy",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "nationalism",
      "military_tradition",
      "mobilization",
      "state_workforce"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": -4,
      "expansionBias": -8,
      "economyBias": 16,
      "cultureBias": 4,
      "diplomacyBias": 14,
      "warTolerance": 86,
      "peacePreference": 58,
      "minimumUnitsLostBeforePeace": 7,
      "casualtyToleranceRatio": 0.58,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Ukraine welcomes cooperation founded on sovereignty, preparedness and dependable commitments.",
      "friendly": "Your support strengthens our security. We will meet our own responsibilities in return.",
      "neutral": "We require commitments that can withstand pressure, not simply favorable declarations.",
      "hostile": "Our state and its defenses are being strengthened. Your pressure will meet resistance.",
      "warDeclaration": "Ukraine will use its armed forces to protect the sovereignty your actions threaten.",
      "victory": "Our defenses have prevailed. We must consolidate the state and prevent a renewed threat.",
      "defeat": "We will consider terms that preserve sovereignty and allow our forces and economy to recover."
    }
  },
  {
    "id": "leader_mohammad_reza_pahlavi",
    "isDefault": false,
    "nationId": "nation_iran",
    "name": "Mohammad Reza Pahlavi",
    "title": "Shah",
    "image": "/assets/sprites/leaders/mohammad-reza-pahlavi.png",
    "description": "The last Shah of Iran, whose monarchy pursued state-led modernization, international economic ties and military expansion while restricting political opposition.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "eliteArmy",
    "covertPersonalityId": "schemer",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "civil_engineering",
      "foreign_trade",
      "state_workforce"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 4,
      "expansionBias": 2,
      "economyBias": 28,
      "cultureBias": 8,
      "diplomacyBias": 18,
      "warTolerance": 66,
      "peacePreference": 54,
      "minimumUnitsLostBeforePeace": 5,
      "casualtyToleranceRatio": 0.42,
      "resourceExploitationInterest": 4
    },
    "diplomacyFlavor": {
      "greeting": "Iran seeks modernization, capable institutions and a strong place in international commerce.",
      "friendly": "Our partnership advances development and security. There is room to expand it.",
      "neutral": "The proposal must support our economic plans and our strategic position.",
      "hostile": "You threaten the independence and development our state is determined to maintain.",
      "warDeclaration": "Iran will employ its armed forces to secure the position your actions now endanger.",
      "victory": "Our objectives have been achieved. Security must now support continued modernization.",
      "defeat": "We will weigh a settlement that preserves the state and its capacity for development."
    }
  },
  {
    "id": "leader_faisal_i",
    "isDefault": false,
    "nationId": "nation_iraq",
    "name": "Faisal I",
    "title": "King",
    "image": "/assets/sprites/leaders/faisal-i.png",
    "description": "The first king of modern Iraq, whose reign focused on establishing national institutions and balancing domestic and international political pressures.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "growth",
    "aiMilitaryDoctrineId": "balanced",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "code_of_laws",
      "state_workforce",
      "diplomatic_service"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": -12,
      "expansionBias": 0,
      "economyBias": 18,
      "cultureBias": 12,
      "diplomacyBias": 26,
      "warTolerance": 48,
      "peacePreference": 76,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.32,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "Iraq is building institutions that must hold together many interests. We welcome constructive partners.",
      "friendly": "Your cooperation helps establish a firmer foundation for our state.",
      "neutral": "We must find terms that can endure both here and among the interests they affect.",
      "hostile": "Your pressure unsettles a balance that neither of us should lightly disturb.",
      "warDeclaration": "The survival of our state requires military action. We have reached that point.",
      "victory": "Our position is protected. A political settlement must now make the victory durable.",
      "defeat": "We will seek terms that keep the state intact and leave room for political reconstruction."
    }
  },
  {
    "id": "leader_yitzhak_rabin",
    "isDefault": false,
    "nationId": "nation_israel",
    "name": "Yitzhak Rabin",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/yitzhak-rabin.png",
    "description": "An Israeli military commander and prime minister who combined defense policy with negotiations that produced the Oslo accords and peace with Jordan.",
    "ideologyId": "liberalism",
    "aiNationalAgendaId": "homeland_defense",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "diplomatic_service",
      "code_of_laws",
      "civil_engineering"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -22,
      "expansionBias": -16,
      "economyBias": 12,
      "cultureBias": 10,
      "diplomacyBias": 32,
      "warTolerance": 72,
      "peacePreference": 90,
      "minimumUnitsLostBeforePeace": 5,
      "casualtyToleranceRatio": 0.42,
      "resourceExploitationInterest": 1
    },
    "maxPreferredCities": 4,
    "diplomacyFlavor": {
      "greeting": "Israel seeks security that can endure. Military readiness and negotiation must both serve that aim.",
      "friendly": "We have made progress because our commitments were real. Let us keep moving.",
      "neutral": "We will consider concrete steps, verifiable commitments and the risks on both sides.",
      "hostile": "Your actions threaten security and reduce the room for an agreement.",
      "warDeclaration": "We have authorized military action to address the danger negotiations have not removed.",
      "victory": "The immediate threat is contained. We must use this moment to pursue a workable settlement.",
      "defeat": "Further fighting will not improve our position. We will negotiate terms that protect our people."
    }
  },
  {
    "id": "leader_mustafa_kemal_ataturk",
    "isDefault": false,
    "nationId": "nation_turkey",
    "name": "Mustafa Kemal Atatürk",
    "title": "President",
    "image": "/assets/sprites/leaders/mustafa-kemal-ataturk.png",
    "description": "Founder of the Republic of Turkey, whose government pursued secular institutions, national sovereignty and extensive legal and social reforms.",
    "ideologyId": "nationalism",
    "aiNationalAgendaId": "growth",
    "aiMilitaryDoctrineId": "disciplinedInfantry",
    "covertPersonalityId": "pragmatist",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "code_of_laws",
      "civil_engineering",
      "nationalism",
      "state_workforce"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": 0,
      "expansionBias": -6,
      "economyBias": 22,
      "cultureBias": 18,
      "diplomacyBias": 10,
      "warTolerance": 80,
      "peacePreference": 70,
      "minimumUnitsLostBeforePeace": 6,
      "casualtyToleranceRatio": 0.52,
      "resourceExploitationInterest": 2
    },
    "diplomacyFlavor": {
      "greeting": "The Turkish Republic will build its future through sovereign institutions, education and capable government.",
      "friendly": "Our agreement rests on mutual independence. That gives it a sound foundation.",
      "neutral": "We will judge these terms by their value to the republic and its modernization.",
      "hostile": "You will not dictate the institutions or borders of our republic.",
      "warDeclaration": "Our army will act in defense of the republic and its sovereign decisions.",
      "victory": "The republic has secured its position. The work of reform must continue.",
      "defeat": "We must preserve the republic and its capacity to rebuild. We will discuss a settlement."
    }
  },
  {
    "id": "leader_faisal_bin_abdulaziz",
    "isDefault": false,
    "nationId": "nation_saudi_arabia",
    "name": "Faisal bin Abdulaziz Al Saud",
    "title": "King",
    "image": "/assets/sprites/leaders/faisal-bin-abdulaziz.png",
    "description": "A Saudi king whose rule combined conservative monarchy with administrative reforms, strategic diplomacy and regional policy shaped by oil and Arab politics.",
    "ideologyId": "traditionalism",
    "aiNationalAgendaId": "balanced",
    "aiMilitaryDoctrineId": "fortifiedDefense",
    "covertPersonalityId": "merchant",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "mysticism",
      "diplomatic_service",
      "foreign_trade"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": -6,
      "expansionBias": -8,
      "economyBias": 14,
      "cultureBias": 18,
      "diplomacyBias": 24,
      "warTolerance": 52,
      "peacePreference": 74,
      "minimumUnitsLostBeforePeace": 4,
      "casualtyToleranceRatio": 0.34,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "The kingdom welcomes patient statecraft, dependable agreements and respect for its traditions.",
      "friendly": "We value a partner whose commitments remain steady when circumstances change.",
      "neutral": "We must consider the position of the kingdom and the consequences for our region.",
      "hostile": "Your conduct endangers relationships that have required years of careful work.",
      "warDeclaration": "The kingdom will use force to protect the interests that negotiation has failed to secure.",
      "victory": "Our position is strengthened. Careful diplomacy must make the settlement last.",
      "defeat": "We will consider peace that preserves the kingdom and restores a workable regional balance."
    }
  },
  {
    "id": "leader_thaksin_shinawatra",
    "isDefault": false,
    "nationId": "nation_thailand",
    "name": "Thaksin Shinawatra",
    "title": "Prime Minister",
    "image": "/assets/sprites/leaders/thaksin-shinawatra.png",
    "description": "A former Thai prime minister associated with domestic development programs, expanded access to services and an assertive style of economic administration.",
    "ideologyId": "progressivism",
    "aiNationalAgendaId": "growth",
    "aiMilitaryDoctrineId": "balanced",
    "covertPersonalityId": "schemer",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "civil_engineering",
      "urbanization"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": 0,
      "expansionBias": 4,
      "economyBias": 30,
      "cultureBias": 14,
      "diplomacyBias": 8,
      "warTolerance": 44,
      "peacePreference": 70,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.3,
      "resourceExploitationInterest": 3
    },
    "diplomacyFlavor": {
      "greeting": "Thailand needs growth that reaches households as well as businesses. What can we achieve together?",
      "friendly": "Our cooperation is producing results. We should turn that progress into wider opportunity.",
      "neutral": "I want to see the investment, the delivery plan and the practical effect on our people.",
      "hostile": "Your pressure obstructs the development our government was formed to deliver.",
      "warDeclaration": "Thailand will now use force to protect its interests against your actions.",
      "victory": "The objective is secured. Resources must return to development as soon as possible.",
      "defeat": "We need a settlement that lets our people rebuild their livelihoods and move forward."
    }
  },
  {
    "id": "leader_park_chung_hee",
    "isDefault": false,
    "nationId": "nation_south_korea",
    "name": "Park Chung Hee",
    "title": "President",
    "image": "/assets/sprites/leaders/park-chung-hee.png",
    "description": "A South Korean president whose authoritarian government directed rapid industrialization, export development and a strong national-security state.",
    "ideologyId": "nationalism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "militaryMobilization",
    "covertPersonalityId": "schemer",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "state_workforce",
      "civil_engineering",
      "mobilization",
      "totalitarianism"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "wrestling",
      "additionalFavourite": "boxing"
    },
    "aiPersonality": {
      "aggressionBias": 2,
      "expansionBias": -4,
      "economyBias": 34,
      "cultureBias": -2,
      "diplomacyBias": -6,
      "warTolerance": 78,
      "peacePreference": 48,
      "minimumUnitsLostBeforePeace": 6,
      "casualtyToleranceRatio": 0.52,
      "resourceExploitationInterest": 4
    },
    "diplomacyFlavor": {
      "greeting": "National strength requires production, discipline and preparedness. State your proposal.",
      "friendly": "Our cooperation supports industry and security. We will expect continued results.",
      "neutral": "We will measure these terms against our development plans and defense requirements.",
      "hostile": "Your actions threaten the security on which our industrial progress depends.",
      "warDeclaration": "Our armed forces will act against the threat to the state and its development.",
      "victory": "Our position is secure. Production and national reconstruction must continue.",
      "defeat": "We must preserve the industrial foundations of our strength. We will consider terms."
    }
  },
  {
    "id": "leader_han_seo_jin",
    "isDefault": false,
    "nationId": "nation_north_korea",
    "name": "Han Seo-jin",
    "title": "President",
    "image": "/assets/sprites/leaders/han-seo-jin.png",
    "description": "A fictional character created for Epoch: a North Korean civic organizer who leads a democratic reconstruction coalition seeking economic reform, international opening and cautious normalization with neighboring states.",
    "ideologyId": "progressivism",
    "aiNationalAgendaId": "growth",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "honorable",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "suffrage",
      "diplomatic_service",
      "foreign_trade",
      "civil_engineering"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "swimming",
      "additionalFavourite": "pole_vault"
    },
    "aiPersonality": {
      "aggressionBias": -30,
      "expansionBias": -24,
      "economyBias": 28,
      "cultureBias": 20,
      "diplomacyBias": 34,
      "warTolerance": 34,
      "peacePreference": 96,
      "minimumUnitsLostBeforePeace": 2,
      "casualtyToleranceRatio": 0.2,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "Our government is rebuilding trust as well as institutions. We welcome practical steps toward cooperation.",
      "friendly": "You have helped turn an opening into a working relationship. Our people can see the difference.",
      "neutral": "We need commitments that support reconstruction without putting our independence at risk.",
      "hostile": "Pressure on our transition endangers both reform and regional stability.",
      "warDeclaration": "We have authorized defensive military action after negotiations failed to remove this danger.",
      "victory": "The immediate danger has passed. Our priority is a settlement that lets reconstruction resume.",
      "defeat": "Our people need recovery, not further losses. We will seek peace that preserves their future."
    }
  },
  {
    "id": "leader_sviatlana_tsikhanouskaya",
    "isDefault": false,
    "nationId": "nation_belarus",
    "name": "Sviatlana Tsikhanouskaya",
    "title": "President",
    "image": "/assets/sprites/leaders/sviatlana-tsikhanouskaya.png",
    "description": "A Belarusian opposition figure and former presidential candidate advocating democratic political change. Epoch depicts an alternative government led by her.",
    "ideologyId": "liberalism",
    "aiNationalAgendaId": "economic",
    "aiMilitaryDoctrineId": "defensiveModern",
    "covertPersonalityId": "honorable",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "suffrage",
      "diplomatic_service",
      "foreign_trade"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -26,
      "expansionBias": -18,
      "economyBias": 24,
      "cultureBias": 16,
      "diplomacyBias": 32,
      "warTolerance": 38,
      "peacePreference": 94,
      "minimumUnitsLostBeforePeace": 2,
      "casualtyToleranceRatio": 0.24,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "Belarus seeks institutions its citizens can trust and partners who respect their choices.",
      "friendly": "Our cooperation is helping open new possibilities for Belarus. We value that trust.",
      "neutral": "The agreement must support economic opening and accountable national institutions.",
      "hostile": "Your coercion threatens the political choices and independence of our people.",
      "warDeclaration": "Belarus will defend its people where negotiation has failed to secure their safety.",
      "victory": "Our security has been protected. We must return our efforts to political and economic renewal.",
      "defeat": "We will seek a settlement that protects our citizens and leaves room for democratic recovery."
    }
  },
  {
    "id": "leader_peter_ii_of_yugoslavia",
    "isDefault": false,
    "nationId": "nation_yugoslavia",
    "name": "Peter II of Yugoslavia",
    "title": "King",
    "image": "/assets/sprites/leaders/peter-ii-of-yugoslavia.png",
    "description": "The last king of Yugoslavia, whose wartime government operated in exile. Epoch interprets his monarchy as a conservative alternative seeking Western partnerships.",
    "ideologyId": "conservatism",
    "aiNationalAgendaId": "culture",
    "aiMilitaryDoctrineId": "culturalDefense",
    "covertPersonalityId": "honorable",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "code_of_laws",
      "diplomatic_service",
      "recorded_history"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "javelin",
      "additionalFavourite": "horse_racing"
    },
    "aiPersonality": {
      "aggressionBias": -10,
      "expansionBias": -8,
      "economyBias": 10,
      "cultureBias": 26,
      "diplomacyBias": 20,
      "warTolerance": 46,
      "peacePreference": 80,
      "minimumUnitsLostBeforePeace": 3,
      "casualtyToleranceRatio": 0.3,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "The crown seeks a stable Yugoslavia with dependable friends and institutions that can endure.",
      "friendly": "Your friendship strengthens the prospect of a lasting constitutional settlement.",
      "neutral": "We must consider the unity of the kingdom and the commitments our partners can sustain.",
      "hostile": "Your actions put the independence and settlement of our kingdom at risk.",
      "warDeclaration": "The kingdom will commit its forces to defend the position you now threaten.",
      "victory": "The kingdom is secured. We must turn this result into political stability.",
      "defeat": "We will discuss peace that preserves the kingdom and the possibility of reconstruction."
    }
  },
  {
    "id": "leader_vaclav_havel",
    "isDefault": false,
    "nationId": "nation_czechoslovakia",
    "name": "Václav Havel",
    "title": "President",
    "image": "/assets/sprites/leaders/vaclav-havel.png",
    "description": "A playwright and dissident who became president of Czechoslovakia after the Velvet Revolution, advocating democratic institutions and international cooperation.",
    "ideologyId": "liberalism",
    "aiNationalAgendaId": "culture",
    "aiMilitaryDoctrineId": "culturalDefense",
    "covertPersonalityId": "honorable",
    "opportunism": false,
    "impulsiveBully": false,
    "culturePriorities": [
      "drama_civics",
      "suffrage",
      "diplomatic_service",
      "humanism"
    ],
    "gamesOfNationsPreferences": {
      "traditionalFavourite": "marathon",
      "additionalFavourite": "fencing"
    },
    "aiPersonality": {
      "aggressionBias": -30,
      "expansionBias": -20,
      "economyBias": 16,
      "cultureBias": 34,
      "diplomacyBias": 36,
      "warTolerance": 28,
      "peacePreference": 96,
      "minimumUnitsLostBeforePeace": 2,
      "casualtyToleranceRatio": 0.18,
      "resourceExploitationInterest": 1
    },
    "diplomacyFlavor": {
      "greeting": "Our republic seeks a politics of responsibility and a place among nations that can speak openly.",
      "friendly": "Our cooperation gives substance to the trust between our societies.",
      "neutral": "An agreement must be understandable, accountable and capable of surviving honest scrutiny.",
      "hostile": "Your coercion weakens the possibility of a peaceful relationship between our peoples.",
      "warDeclaration": "We have reached the point where force is necessary to protect our republic.",
      "victory": "The danger has been contained. We must now make peace worthy of the sacrifices made.",
      "defeat": "The responsibility of government is to protect its people. We will seek a peaceful settlement."
    }
  }
];
