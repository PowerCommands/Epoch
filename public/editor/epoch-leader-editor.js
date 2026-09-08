/* Generated from src/editor/leaderEditorBundle.ts — do not edit. */
"use strict";
(() => {
  // src/data/nations.ts
  var NATION_DEFINITIONS = [
    { id: "nation_england", name: "England", color: "#dd203f", secondaryColor: "#3714c3", currencyName: "Pound Sterling", currencySymbol: "\xA3" },
    { id: "nation_france", name: "France", color: "#1e0af1", secondaryColor: "#f4efe2", currencyName: "Franc", currencySymbol: "\u20A3" },
    { id: "nation_hre", name: "Holy Roman Empire", color: "#e8c84a", secondaryColor: "#4a4030", currencyName: "Imperial Thaler", currencySymbol: "Th" },
    { id: "nation_sweden", name: "Sweden", color: "#2541d0", secondaryColor: "#e6ad3d", currencyName: "Krona", currencySymbol: "kr" },
    { id: "nation_lithuania", name: "Lithuania", color: "#f4870b", secondaryColor: "#201f1e", currencyName: "Litas", currencySymbol: "Lt" },
    { id: "nation_novgorod", name: "Novgorod", color: "#16a085", secondaryColor: "#e7d7a8", currencyName: "Novgorod Grivna", currencySymbol: "gr" },
    { id: "nation_russia", name: "Russia", color: "#ffffff", secondaryColor: "#0039a6", currencyName: "Ruble", currencySymbol: "\u20BD" },
    { id: "nation_soviet_union", name: "Soviet Union", color: "#8b1a1a", secondaryColor: "#d4af37", currencyName: "Soviet Ruble", currencySymbol: "\u20BD", audioPlaylistNationId: "nation_russia" },
    { id: "nation_ottoman", name: "Ottoman Empire", color: "#c44ae8", secondaryColor: "#7fd1c7", currencyName: "Ak\xE7e", currencySymbol: "ak" },
    { id: "nation_spain", name: "Spain", color: "#e84a4a", secondaryColor: "#f2d15c", currencyName: "Spanish Real", currencySymbol: "R" },
    { id: "nation_morocco_empire", name: "Morocco", color: "#9b5f4b", secondaryColor: "#d9c39a", currencyName: "Moroccan Dirham", currencySymbol: "\u062F.\u0645." },
    { id: "nation_usa", name: "United States", color: "#2f80ed", secondaryColor: "#fe0000", currencyName: "Dollar", currencySymbol: "$" },
    { id: "nation_india", name: "India", color: "#27ae60", secondaryColor: "#f3d27a", currencyName: "Rupee", currencySymbol: "\u20B9" },
    { id: "nation_china", name: "China", color: "#f0c46b", secondaryColor: "#d64541", currencyName: "Renminbi", currencySymbol: "\xA5" },
    { id: "nation_taiwan", name: "Taiwan", color: "#012169", secondaryColor: "#fe0000", currencyName: "New Taiwan Dollar", currencySymbol: "NT$" },
    { id: "nation_brazil", name: "Brazil", color: "#009739", secondaryColor: "#ffdf00", currencyName: "Brazilian Real", currencySymbol: "R$" },
    { id: "nation_mali_empire", name: "Mali Empire", color: "#b7950b", secondaryColor: "#5b4b2a", currencyName: "Malian Gold Dinar", currencySymbol: "MD" },
    { id: "nation_mongolia", name: "Mongolia", color: "#c49a2c", secondaryColor: "#3a2a14", currencyName: "T\xF6gr\xF6g", currencySymbol: "\u20AE" },
    { id: "nation_japan", name: "Japan", color: "#ffffff", secondaryColor: "#bc002d", currencyName: "Yen", currencySymbol: "\xA5" },
    { id: "nation_denmark", name: "Denmark", color: "#80071b", secondaryColor: "#ffffff", currencyName: "Krone", currencySymbol: "kr" },
    { id: "nation_pirate", name: "Pirates", color: "#1a1a1a", secondaryColor: "#c0392b", currencyName: "Pieces of Eight", currencySymbol: "\u2620" },
    { id: "nation_germany", name: "Germany", color: "#2b2b2b", secondaryColor: "#d4af37", currencyName: "Mark", currencySymbol: "\u2133" },
    { id: "nation_italy", name: "Italy", color: "#0b6b3a", secondaryColor: "#ce2b37", currencyName: "Lira", currencySymbol: "\u20A4" },
    { id: "nation_poland", name: "Poland", color: "#d4213d", secondaryColor: "#f5f5f5", currencyName: "Polish Z\u0142oty", currencySymbol: "z\u0142" }
  ];

  // src/types/aiLeaderPersonality.ts
  var DEFAULT_EXPLOITATION_INTEREST = 1;
  var DEFAULT_AI_LEADER_PERSONALITY = {
    aggressionBias: 0,
    expansionBias: 0,
    economyBias: 0,
    cultureBias: 0,
    diplomacyBias: 0,
    warTolerance: 50,
    peacePreference: 50,
    minimumUnitsLostBeforePeace: 3,
    casualtyToleranceRatio: 0.4,
    resourceExploitationInterest: DEFAULT_EXPLOITATION_INTEREST
  };

  // src/data/ideologies.ts
  var DEFAULT_IDEOLOGY_ID = "traditionalism";
  var IDEOLOGIES = [
    {
      id: "liberalism",
      name: "Liberalism",
      description: "Favors diplomacy, trade, open borders, and limited appetite for war.",
      diplomacyBias: 18,
      tradeBias: 18,
      warBias: -14,
      openBordersBias: 20,
      cultureResistance: 6,
      expansionBias: 0
    },
    {
      id: "conservatism",
      name: "Conservatism",
      description: "Prefers cautious diplomacy, controlled borders, steady trade, and cultural continuity.",
      diplomacyBias: 4,
      tradeBias: 8,
      warBias: 6,
      openBordersBias: -10,
      cultureResistance: 22,
      expansionBias: 2
    },
    {
      id: "nationalism",
      name: "Nationalism",
      description: "Prioritizes sovereignty, territorial growth, cultural resilience, and guarded borders.",
      diplomacyBias: -6,
      tradeBias: 6,
      warBias: 18,
      openBordersBias: -22,
      cultureResistance: 26,
      expansionBias: 22
    },
    {
      id: "globalism",
      name: "Globalism",
      description: "Strongly favors diplomacy, trade networks, open borders, and cultural exchange.",
      diplomacyBias: 28,
      tradeBias: 30,
      warBias: -20,
      openBordersBias: 30,
      cultureResistance: -8,
      expansionBias: -2
    },
    {
      id: "militarism",
      name: "Militarism",
      description: "Values military strength, conquest readiness, and territorial expansion over cooperation.",
      diplomacyBias: -18,
      tradeBias: -10,
      warBias: 30,
      openBordersBias: -18,
      cultureResistance: 14,
      expansionBias: 24
    },
    {
      id: "traditionalism",
      name: "Traditionalism",
      description: "Favors cautious relations, limited border access, modest trade, and strong cultural resistance.",
      diplomacyBias: 0,
      tradeBias: 2,
      warBias: 6,
      openBordersBias: -16,
      cultureResistance: 28,
      expansionBias: 4
    },
    {
      id: "progressivism",
      name: "Progressivism",
      description: "Leans toward diplomacy, open exchange, active trade, and low preference for war.",
      diplomacyBias: 20,
      tradeBias: 18,
      warBias: -16,
      openBordersBias: 22,
      cultureResistance: 4,
      expansionBias: -2
    },
    {
      id: "freebooters",
      name: "Freebooters",
      description: "A loose brotherhood of captains, smugglers and raiders who answer to no crown. Prizes independence, opportunism, and naval dominance over bureaucracy, diplomacy, or centralized government.",
      // Answers to no crown: scorns diplomacy and centralized order, but thrives on
      // opportunistic raiding (high war) and smuggling (modest trade). Expansion is
      // negative — Freebooters hold a single harbor and rove the seas instead.
      diplomacyBias: -16,
      tradeBias: 10,
      warBias: 26,
      openBordersBias: -8,
      cultureResistance: 8,
      expansionBias: -10
    }
  ];

  // src/data/ideologyCompatibility.ts
  var IDEOLOGY_IDS = [
    "liberalism",
    "conservatism",
    "nationalism",
    "globalism",
    "militarism",
    "traditionalism",
    "progressivism",
    "freebooters"
  ];
  var IDEOLOGY_ID_SET = new Set(IDEOLOGY_IDS);
  var IDEOLOGY_COMPATIBILITY = {
    liberalism: {
      liberalism: 30,
      conservatism: -10,
      nationalism: -15,
      globalism: 30,
      militarism: -30,
      traditionalism: -20,
      progressivism: 25
    },
    conservatism: {
      liberalism: -10,
      conservatism: 30,
      nationalism: 18,
      globalism: -18,
      militarism: 4,
      traditionalism: 26,
      progressivism: -22
    },
    nationalism: {
      liberalism: -15,
      conservatism: 18,
      nationalism: 30,
      globalism: -32,
      militarism: 12,
      traditionalism: 20,
      progressivism: -12
    },
    globalism: {
      liberalism: 30,
      conservatism: -18,
      nationalism: -32,
      globalism: 30,
      militarism: -36,
      traditionalism: -24,
      progressivism: 28
    },
    militarism: {
      liberalism: -30,
      conservatism: 4,
      nationalism: 12,
      globalism: -36,
      militarism: 30,
      traditionalism: 2,
      progressivism: -28
    },
    traditionalism: {
      liberalism: -20,
      conservatism: 26,
      nationalism: 20,
      globalism: -24,
      militarism: 2,
      traditionalism: 30,
      progressivism: -26
    },
    progressivism: {
      liberalism: 25,
      conservatism: -22,
      nationalism: -12,
      globalism: 28,
      militarism: -28,
      traditionalism: -26,
      progressivism: 30,
      freebooters: -24
    },
    // Freebooters answer to no crown: they tolerate fellow aggressors and
    // independence-minded nationalists, but clash with centralized, diplomatic,
    // and order-prizing ideologies.
    freebooters: {
      liberalism: -22,
      conservatism: -18,
      nationalism: 6,
      globalism: -30,
      militarism: 10,
      traditionalism: -14,
      progressivism: -24,
      freebooters: 28
    }
  };
  function getIdeologyCompatibility(source, target) {
    return IDEOLOGY_COMPATIBILITY[source][target] ?? IDEOLOGY_COMPATIBILITY[target][source] ?? 0;
  }
  function getIdeologyCompatibilitySafe(source, target) {
    const safeSource = isIdeologyId(source) ? source : DEFAULT_IDEOLOGY_ID;
    const safeTarget = isIdeologyId(target) ? target : DEFAULT_IDEOLOGY_ID;
    return getIdeologyCompatibility(safeSource, safeTarget);
  }
  function isIdeologyId(value) {
    return value !== void 0 && IDEOLOGY_ID_SET.has(value);
  }

  // src/data/cultureTree.ts
  function node(input) {
    return input;
  }
  var COLONIALISM_CULTURE_NODE_ID = "colonialism";
  var ENLIGHTENMENT_CULTURE_NODE_ID = "enlightenment";
  var HUMANISM_CULTURE_NODE_ID = "humanism";
  var LIBERALISM_CULTURE_NODE_ID = "liberalism";
  var TOURISM_CULTURE_NODE_ID = "tourism";
  var CULTURE_TREE = [
    node({ id: "code_of_laws", name: "Code of Laws", era: "ancient", cost: 20, description: "Formal rules turn custom into authority. Shared laws give the first cities a common structure for justice, duty, and rule.", unlocks: [{ type: "government", value: "chiefdom" }, { type: "policySlot", value: "economic" }] }),
    node({ id: "craftsmanship", name: "Craftsmanship", era: "ancient", cost: 48, description: "Skilled hands organize labor, tools, and local defense. Craft traditions help settlements turn raw materials into lasting civic strength.", prerequisites: ["code_of_laws"], unlocks: [{ type: "policySlot", value: "military" }] }),
    node({ id: "foreign_trade", name: "Foreign Trade", era: "ancient", cost: 52, description: "Merchants and envoys begin carrying goods beyond familiar borders. Trade customs make distant neighbors part of city life.", prerequisites: ["code_of_laws"], unlocks: [{ type: "diplomacy", value: "trade_delegations" }, { type: "policySlot", value: "diplomatic" }] }),
    node({ id: "early_empire", name: "Early Empire", era: "ancient", cost: 50, description: "Small settlements learn to think as a realm. Borders, tribute, and local chiefs become the first shape of expansion.", prerequisites: ["craftsmanship"], unlocks: [{ type: "government", value: "tribal_council" }] }),
    node({ id: "state_workforce", name: "State Workforce", era: "ancient", cost: 55, description: "Public labor becomes an instrument of government. Organized work crews raise monuments, roads, and shared civic projects.", prerequisites: ["craftsmanship"], unlocks: [{ type: "building", value: "sewers" }] }),
    node({ id: "mysticism", name: "Mysticism", era: "ancient", cost: 60, description: "Ritual, omen, and sacred authority bind people through wonder. Flexible traditions make room for leaders who act beyond ordinary law.", prerequisites: ["foreign_trade"], unlocks: [{ type: "policySlot", value: "wildcard" }] }),
    node({ id: "military_tradition", name: "Military Tradition", era: "classical", cost: 90, description: "War stories become doctrine, ceremony, and inherited command. Armies fight with shared memory as much as weapons.", prerequisites: ["early_empire"], unlocks: [{ type: "unit", value: "horseman" }] }),
    node({ id: "political_philosophy", name: "Political Philosophy", era: "classical", cost: 110, description: "Debate turns rule into an idea that can be compared and chosen. Citizens and rulers begin asking what government is for.", prerequisites: ["early_empire", "state_workforce"], unlocks: [{ type: "government", value: "classical_republic" }, { type: "government", value: "autocracy" }, { type: "policySlot", value: "wildcard" }] }),
    node({ id: "drama_civics", name: "Drama and Poetry", era: "classical", cost: 120, description: "Public performance gives a civilization a voice. Poetry, theatre, and ceremony carry memory from one generation to the next.", prerequisites: ["mysticism"], unlocks: [{ type: "building", value: "amphitheater" }] }),
    node({ id: "games_recreation", name: "Games Of Nations", era: "classical", cost: 200, description: "Nations turn competition into grand public games. Shared contests build prestige, unity, and friendly rivalry between peoples.", prerequisites: ["state_workforce"], unlocks: [{ type: "building", value: "arena" }, { type: "policySlot", value: "culture" }] }),
    node({ id: "defensive_tactics", name: "Defensive Tactics", era: "classical", cost: 120, description: "Communities learn to prepare before danger arrives. Fortified habits and trained reserves make survival part of public policy.", prerequisites: ["military_tradition", "political_philosophy"], unlocks: [{ type: "policySlot", value: "military" }] }),
    node({ id: "recorded_history", name: "Recorded History", era: "classical", cost: 128, description: "Archives turn memory into an institution. Written accounts help rulers learn from victories, failures, laws, and lineages.", prerequisites: ["drama_civics", "political_philosophy"], unlocks: [{ type: "building", value: "library" }] }),
    node({ id: "theology_civics", name: "Theology", era: "medieval", cost: 175, description: "Faith becomes doctrine, hierarchy, and public purpose. Sacred institutions shape law, learning, and the authority of rulers.", prerequisites: ["drama_civics"], unlocks: [{ type: "government", value: "theocracy" }] }),
    node({ id: "feudalism", name: "Feudalism", era: "medieval", cost: 190, description: "Land, loyalty, and protection form a layered social order. Local obligations bind farms, warriors, and nobles into durable power.", prerequisites: ["defensive_tactics"], unlocks: [{ type: "policySlot", value: "economic" }] }),
    node({ id: "civil_service_civics", name: "Civil Service", era: "medieval", cost: 200, description: "Administration becomes a profession instead of a favor. Trained officials help distant cities answer to the same state.", prerequisites: ["recorded_history"], unlocks: [{ type: "diplomacy", value: "alliances" }] }),
    node({ id: "mercenaries", name: "Mercenaries", era: "medieval", cost: 210, description: "War becomes a market as soldiers sell skill to the highest cause. Coin, contracts, and reputation can raise armies quickly.", prerequisites: ["feudalism"], unlocks: [{ type: "unit", value: "mercenary_company" }] }),
    node({ id: "medieval_faires", name: "Medieval Faires", era: "medieval", cost: 220, description: "Seasonal gatherings join trade, craft, and celebration. Faires turn regional wealth into civic contact and commercial habit.", prerequisites: ["feudalism", "civil_service_civics"], unlocks: [{ type: "building", value: "market" }] }),
    node({ id: "guilds", name: "Guilds", era: "medieval", cost: 230, description: "Craft masters organize skill, price, and apprenticeship. Guild life gives cities economic identity and durable urban influence.", prerequisites: ["civil_service_civics"], unlocks: [{ type: "policySlot", value: "economic" }] }),
    node({ id: "diplomatic_service", name: "Diplomatic Service", era: "renaissance", cost: 280, description: "Envoys become professionals who speak for the state. Protocol, letters, and permanent missions make diplomacy a civic craft.", prerequisites: ["guilds"], unlocks: [{ type: "diplomacy", value: "embassies" }, { type: "policySlot", value: "diplomatic" }] }),
    node({ id: "exploration", name: "Exploration", era: "renaissance", cost: 285, description: "Curiosity and ambition push officials beyond known maps. Exploration turns discovery into policy, profit, and new claims.", prerequisites: ["medieval_faires"], unlocks: [{ type: "government", value: "merchant_republic" }] }),
    node({ id: HUMANISM_CULTURE_NODE_ID, name: "Humanism", era: "renaissance", cost: 290, description: "Art, history, and human dignity move toward the center of public life. Cities preserve achievement as a source of identity and learn to recognize archaeological sites.", prerequisites: ["guilds"], unlocks: [{ type: "building", value: "museum" }, { type: "policySlot", value: "culture" }] }),
    node({ id: "reformed_church", name: "Reformed Church", era: "renaissance", cost: 400, description: "Religious authority is challenged, refined, and reorganized. Belief becomes a force for reform as well as tradition.", prerequisites: ["theology_civics", "humanism"], unlocks: [{ type: "government", value: "reformed_theocracy" }], effects: [{ type: "happinessPerTurnFlat", value: 2 }] }),
    node({ id: "mercantilism", name: "Mercantilism", era: "renaissance", cost: 430, description: "The state treats commerce as national strategy. Ports, charters, and controlled markets turn trade into power.", prerequisites: ["exploration"], unlocks: [] }),
    node({ id: "nationalism", name: "Nationalism", era: "renaissance", cost: 440, description: "Shared language, memory, and symbols forge mass identity. Popular movements, independence struggles, and organized resistance take root.", prerequisites: ["humanism", "mercantilism"], unlocks: [{ type: "unit", value: "corps" }, { type: "unit", value: "rebels" }] }),
    node({ id: ENLIGHTENMENT_CULTURE_NODE_ID, name: "The Enlightenment", era: "industrial", cost: 470, description: "Reason, rights, and public inquiry challenge inherited authority. Knowledge becomes a civic engine for reform and progress. Permanently reveals the entire world map. Makes the World Council available.", prerequisites: ["humanism", "diplomatic_service"], unlocks: [{ type: "building", value: "university" }, { type: "diplomacy", value: "world_council" }], effects: [{ type: "happinessPerTurnFlat", value: 2 }] }),
    node({ id: "natural_history", name: "Natural History", era: "industrial", cost: 500, description: "Careful observation and classification turn the living world into a shared field of public knowledge.", prerequisites: ["enlightenment"], unlocks: [] }),
    node({ id: "opera_ballet", name: "Opera and Ballet", era: "industrial", cost: 510, description: "Grand music, theatre, and disciplined movement bring civic performance to an ambitious new scale.", prerequisites: ["enlightenment"], unlocks: [] }),
    node({ id: COLONIALISM_CULTURE_NODE_ID, name: "Colonialism", era: "industrial", cost: 600, description: "Overseas ambition becomes administration, extraction, and settlement. Distant holdings reshape diplomacy and the home economy.", prerequisites: ["mercantilism"], unlocks: [{ type: "diplomacy", value: "colonial_charters" }] }),
    node({ id: "civil_engineering", name: "Civil Engineering", era: "industrial", cost: 525, description: "Public works become symbols of modern administration. Bridges, districts, and services let cities grow with intent.", prerequisites: ["enlightenment"], unlocks: [{ type: "building", value: "public_works" }] }),
    node({ id: "urbanization", name: "Urbanization", era: "modern", cost: 600, description: "City life becomes the dominant rhythm of society. Planning, housing, and services define the politics of modern growth.", prerequisites: ["civil_engineering"], unlocks: [{ type: "building", value: "neighborhood" }] }),
    node({ id: TOURISM_CULTURE_NODE_ID, name: "Tourism", era: "modern", cost: 720, description: "Railways, steamships, and growing prosperity turn travel into an industry. Hotels, resorts, and famous landmarks attract visitors from across the world.", prerequisites: ["urbanization"], unlocks: [{ type: "building", value: "hotel", requiredWithTechnology: true }] }),
    node({ id: "ideology", name: "Ideology", era: "modern", cost: 650, description: "Politics hardens into competing visions for society. Parties, states, and citizens organize around total answers to modern life.", prerequisites: ["urbanization", "nationalism"], unlocks: [{ type: "government", value: "ideological_state" }] }),
    node({ id: "democracy", name: "Democracy", era: "modern", cost: 700, description: "Representative institutions turn public consent into durable government. Elections, legislatures, and civic participation make authority answerable to citizens.", prerequisites: ["ideology"], unlocks: [] }),
    node({ id: LIBERALISM_CULTURE_NODE_ID, name: "Liberalism", era: "modern", cost: 750, description: "Individual liberty and equal rights become foundations of public life. Constitutional limits protect conscience, expression, and association from arbitrary power. Makes the United Nations transition available.", prerequisites: ["democracy"], unlocks: [{ type: "diplomacy", value: "united_nations" }] }),
    node({ id: "suffrage", name: "Suffrage", era: "modern", cost: 700, description: "Political voice expands from privilege toward citizenship. Representation becomes a public promise and a source of legitimacy.", prerequisites: ["urbanization", "ideology"], unlocks: [{ type: "government", value: "democracy" }] }),
    node({ id: "totalitarianism", name: "Totalitarianism", era: "modern", cost: 745, description: "The state reaches for control over every public institution. Unity, surveillance, and command become tools of national direction.", prerequisites: ["ideology"], unlocks: [{ type: "government", value: "fascism" }, { type: "policySlot", value: "military" }] }),
    node({ id: "class_struggle", name: "Class Struggle", era: "modern", cost: 855, description: "Economic conflict becomes a lens for history and power. Workers, parties, and states reorganize society around material equality.", prerequisites: ["ideology"], unlocks: [{ type: "government", value: "communism" }], effects: [{ type: "happinessPerTurnFlat", value: 2 }] }),
    node({ id: "mobilization", name: "Mobilization", era: "atomic", cost: 780, description: "Industry, citizens, and command networks prepare for total war. The nation learns to move as one vast military machine.", prerequisites: ["ideology"], unlocks: [{ type: "unit", value: "army" }] }),
    node({ id: "cold_war", name: "Cold War", era: "atomic", cost: 820, description: "Rival blocs compete through pressure, research, and influence. Diplomacy becomes a contest fought beneath the threshold of war.", prerequisites: ["suffrage", "totalitarianism", "class_struggle"], unlocks: [{ type: "diplomacy", value: "research_agreements" }, { type: "policySlot", value: "diplomatic" }] }),
    node({ id: "professional_sports", name: "Professional Sports", era: "atomic", cost: 930, description: "Games become industry, spectacle, and civic identity. Stadium crowds turn recreation into shared culture at national scale.", prerequisites: [TOURISM_CULTURE_NODE_ID], unlocks: [{ type: "building", value: "stadium" }, { type: "policySlot", value: "culture" }] }),
    node({ id: "globalization", name: "Globalization", era: "information", cost: 1030, description: "Markets, institutions, and crises cross borders with new speed. Policy begins to operate on a world-sized stage.", prerequisites: ["cold_war"], unlocks: [] }),
    node({ id: "social_media", name: "Social Media", era: "information", cost: 1100, description: "Public life moves through networks of instant attention. Influence spreads through images, messages, and communities without borders.", prerequisites: ["professional_sports", "globalization"], unlocks: [{ type: "diplomacy", value: "cultural_influence" }] }),
    node({ id: "near_future_governance", name: "Near-Future Governance", era: "future", cost: 1280, description: "Digital systems reshape how states listen, decide, and adapt. Governance becomes faster, more connected, and more contested.", prerequisites: ["social_media"], unlocks: [{ type: "government", value: "digital_democracy" }, { type: "policySlot", value: "wildcard" }], effects: [{ type: "futureCultureHappiness", value: 1 }] })
  ];

  // src/data/eraTimeline.ts
  var ERA_TIMELINE = [
    { era: "ancient", startYear: -4e3, endYear: -1e3 },
    { era: "classical", startYear: -1e3, endYear: 500 },
    { era: "medieval", startYear: 500, endYear: 1400 },
    { era: "renaissance", startYear: 1400, endYear: 1700 },
    { era: "industrial", startYear: 1700, endYear: 1900 },
    { era: "modern", startYear: 1900, endYear: 1945 },
    { era: "atomic", startYear: 1945, endYear: 1990 },
    { era: "information", startYear: 1990, endYear: 2200 },
    { era: "future", startYear: 2200, endYear: 2400 }
  ];
  var ERA_ORDER = ERA_TIMELINE.map((entry) => entry.era);

  // src/data/leaderEraResolution.ts
  function resolveEraAssignment(map, era) {
    const rank = ERA_TIMELINE.findIndex((e) => e.era === era);
    for (let i = rank; i >= 0; i--) {
      const from = ERA_TIMELINE[i].era;
      if (map[from]) return { id: map[from], from, source: from === era ? "Explicit" : `Inherited from ${from}` };
    }
    return { id: "balancedGrowth", from: void 0, source: "Default \xB7 Balanced Growth" };
  }

  // src/data/aiMilitaryDoctrines.ts
  var DEFAULT_AI_MILITARY_DOCTRINE_ID = "balanced";
  var DEFAULT_MILITARY_BUDGET = {
    strengthMultiplier: 1,
    maxUnitsMultiplier: 1,
    allowOverbuildingWhenThreatened: true
  };
  var DEFAULT_STRATEGIC_TOLERANCE = {
    minHappinessForMilitaryBuilds: 0,
    minGoldReserveForMilitaryBuilds: 0,
    tolerateWarWeariness: true
  };
  var BALANCED_DOCTRINE = {
    id: "balanced",
    name: "Balanced",
    description: "Neutral baseline with no strong preference for any unit role or build philosophy.",
    modernizationBias: 1,
    quantityBias: 1,
    qualityBias: 1,
    preferredRoles: {
      melee: 1,
      ranged: 1,
      mounted: 1,
      siege: 1,
      navalMelee: 1,
      navalRanged: 1,
      air: 1
    },
    targetComposition: { melee: 0.3, ranged: 0.3, mounted: 0.2, siege: 0.1, navalMelee: 0.05, navalRanged: 0.05 },
    militaryBudget: { ...DEFAULT_MILITARY_BUDGET },
    strategicTolerance: { ...DEFAULT_STRATEGIC_TOLERANCE },
    productionBehavior: { modernizationBias: 1, quantityBias: 1, qualityBias: 1 }
  };
  var STEPPE_HORDE_DOCTRINE = {
    id: "steppeHorde",
    name: "Steppe Horde",
    description: "Large land army driven by mounted and ranged units. Quantity over quality, low naval presence.",
    modernizationBias: 0.85,
    quantityBias: 1.35,
    qualityBias: 0.8,
    preferredRoles: {
      melee: 0.9,
      ranged: 1.35,
      mounted: 1.8,
      siege: 0.75,
      navalMelee: 0.25,
      navalRanged: 0.25,
      air: 0.8
    },
    targetComposition: { melee: 0.18, ranged: 0.3, mounted: 0.42, siege: 0.07, navalMelee: 0.015, navalRanged: 0.015 },
    militaryBudget: { strengthMultiplier: 1.4, maxUnitsMultiplier: 1.5, allowOverbuildingWhenThreatened: true },
    strategicTolerance: { minHappinessForMilitaryBuilds: -5, minGoldReserveForMilitaryBuilds: 0, tolerateWarWeariness: true },
    productionBehavior: { modernizationBias: 0.85, quantityBias: 1.35, qualityBias: 0.8 }
  };
  var NAVAL_POWER_DOCTRINE = {
    id: "navalPower",
    navalExpeditions: true,
    navalSaturationControl: true,
    name: "Naval Power",
    description: "Strong navy with meaningful modernization and a balanced land component.",
    modernizationBias: 1.2,
    quantityBias: 0.9,
    qualityBias: 1.15,
    preferredRoles: {
      melee: 0.9,
      ranged: 1,
      mounted: 0.65,
      siege: 0.65,
      navalMelee: 1.8,
      navalRanged: 2.3,
      air: 1
    },
    targetComposition: { melee: 0.18, ranged: 0.23, mounted: 0.08, siege: 0.06, navalMelee: 0.13, navalRanged: 0.32 },
    militaryBudget: { strengthMultiplier: 1.1, maxUnitsMultiplier: 1.1, allowOverbuildingWhenThreatened: true },
    strategicTolerance: { minHappinessForMilitaryBuilds: 0, minGoldReserveForMilitaryBuilds: 10, tolerateWarWeariness: false },
    productionBehavior: { modernizationBias: 1.2, quantityBias: 0.9, qualityBias: 1.15 }
  };
  var CULTURAL_DEFENSE_DOCTRINE = {
    id: "culturalDefense",
    name: "Cultural Defense",
    description: "Smaller, modern, defensive army leaning on ranged and siege units.",
    modernizationBias: 1.35,
    quantityBias: 0.65,
    qualityBias: 1.45,
    preferredRoles: {
      melee: 0.75,
      ranged: 1.35,
      mounted: 0.65,
      siege: 1.25,
      navalMelee: 0.75,
      navalRanged: 0.8,
      air: 1
    },
    targetComposition: { melee: 0.3, ranged: 0.38, mounted: 0.1, siege: 0.08, navalMelee: 0.07, navalRanged: 0.07 },
    militaryBudget: { strengthMultiplier: 0.8, maxUnitsMultiplier: 0.7, allowOverbuildingWhenThreatened: false },
    strategicTolerance: { minHappinessForMilitaryBuilds: 5, minGoldReserveForMilitaryBuilds: 20, tolerateWarWeariness: false },
    productionBehavior: { modernizationBias: 1.35, quantityBias: 0.65, qualityBias: 1.45 }
  };
  var DEFENSIVE_MODERN_DOCTRINE = {
    id: "defensiveModern",
    name: "Defensive Modern",
    description: "Avoids large armies. Prefers defensive quality and steady modernization.",
    modernizationBias: 1.25,
    quantityBias: 0.55,
    qualityBias: 1.35,
    preferredRoles: {
      melee: 0.8,
      ranged: 1.25,
      mounted: 0.55,
      siege: 0.75,
      navalMelee: 0.75,
      navalRanged: 0.8,
      air: 1
    },
    targetComposition: { melee: 0.18, ranged: 0.36, mounted: 0.05, siege: 0.21, navalMelee: 0.1, navalRanged: 0.1 },
    militaryBudget: { strengthMultiplier: 0.7, maxUnitsMultiplier: 0.6, allowOverbuildingWhenThreatened: false },
    strategicTolerance: { minHappinessForMilitaryBuilds: 10, minGoldReserveForMilitaryBuilds: 30, tolerateWarWeariness: false },
    productionBehavior: { modernizationBias: 1.25, quantityBias: 0.55, qualityBias: 1.35 }
  };
  var IMPERIAL_COMBINED_ARMS_DOCTRINE = {
    id: "imperialCombinedArms",
    name: "Imperial Combined Arms",
    description: "Balanced combined arms with a slight quality bias. Favors melee and siege.",
    modernizationBias: 1.15,
    quantityBias: 0.95,
    qualityBias: 1.15,
    preferredRoles: {
      melee: 1.1,
      ranged: 1.05,
      mounted: 0.9,
      siege: 1.1,
      navalMelee: 0.75,
      navalRanged: 0.75,
      air: 1
    },
    targetComposition: { melee: 0.28, ranged: 0.25, mounted: 0.2, siege: 0.17, navalMelee: 0.05, navalRanged: 0.05 },
    militaryBudget: { strengthMultiplier: 1.2, maxUnitsMultiplier: 1.1, allowOverbuildingWhenThreatened: true },
    strategicTolerance: { minHappinessForMilitaryBuilds: 0, minGoldReserveForMilitaryBuilds: 10, tolerateWarWeariness: true },
    productionBehavior: { modernizationBias: 1.15, quantityBias: 0.95, qualityBias: 1.15 }
  };
  var MARITIME_RAIDER_DOCTRINE = {
    id: "maritimeRaider",
    name: "Maritime Raider",
    description: "Aggressive coastal and naval doctrine with a competent land component.",
    modernizationBias: 1.1,
    quantityBias: 1,
    qualityBias: 1.05,
    preferredRoles: {
      melee: 1,
      ranged: 1.05,
      mounted: 0.75,
      siege: 0.95,
      navalMelee: 1.45,
      navalRanged: 1.5,
      air: 1
    },
    targetComposition: { melee: 0.16, ranged: 0.24, mounted: 0.08, siege: 0.08, navalMelee: 0.22, navalRanged: 0.22 },
    militaryBudget: { strengthMultiplier: 1.15, maxUnitsMultiplier: 1.2, allowOverbuildingWhenThreatened: true },
    strategicTolerance: { minHappinessForMilitaryBuilds: -5, minGoldReserveForMilitaryBuilds: 0, tolerateWarWeariness: true },
    productionBehavior: { modernizationBias: 1.1, quantityBias: 1, qualityBias: 1.05 }
  };
  var DISCIPLINED_INFANTRY_DOCTRINE = {
    id: "disciplinedInfantry",
    name: "Disciplined Infantry",
    description: "Professional land army centered on melee/ranged infantry and steady modernization.",
    modernizationBias: 1.2,
    quantityBias: 0.9,
    qualityBias: 1.2,
    preferredRoles: {
      melee: 1.35,
      ranged: 1.15,
      mounted: 0.65,
      siege: 1,
      navalMelee: 0.65,
      navalRanged: 0.65,
      air: 1
    },
    targetComposition: { melee: 0.38, ranged: 0.3, mounted: 0.08, siege: 0.14, navalMelee: 0.05, navalRanged: 0.05 },
    militaryBudget: { strengthMultiplier: 1.1, maxUnitsMultiplier: 1, allowOverbuildingWhenThreatened: true },
    strategicTolerance: { minHappinessForMilitaryBuilds: 0, minGoldReserveForMilitaryBuilds: 10, tolerateWarWeariness: false },
    productionBehavior: { modernizationBias: 1.2, quantityBias: 0.9, qualityBias: 1.2 }
  };
  var CHEAP_INFANTRY_SWARM_DOCTRINE = {
    id: "cheapInfantrySwarm",
    name: "Cheap Infantry Swarm",
    description: "Large low-quality army that accepts instability and prefers many basic land units.",
    modernizationBias: 0.7,
    quantityBias: 1.7,
    qualityBias: 0.55,
    preferredRoles: {
      melee: 1.55,
      ranged: 1.1,
      mounted: 0.55,
      siege: 0.55,
      navalMelee: 0.45,
      navalRanged: 0.35,
      air: 0.6
    },
    targetComposition: { melee: 0.48, ranged: 0.32, mounted: 0.07, siege: 0.06, navalMelee: 0.04, navalRanged: 0.03 },
    militaryBudget: { strengthMultiplier: 1.2, maxUnitsMultiplier: 1.8, allowOverbuildingWhenThreatened: true },
    strategicTolerance: { minHappinessForMilitaryBuilds: -8, minGoldReserveForMilitaryBuilds: -10, tolerateWarWeariness: true },
    productionBehavior: { modernizationBias: 0.7, quantityBias: 1.7, qualityBias: 0.55 }
  };
  var ELITE_ARMY_DOCTRINE = {
    id: "eliteArmy",
    name: "Elite Army",
    description: "Small, expensive, modern army focused on quality over quantity.",
    modernizationBias: 1.6,
    quantityBias: 0.45,
    qualityBias: 1.8,
    preferredRoles: {
      melee: 1.1,
      ranged: 1.25,
      mounted: 0.9,
      siege: 1.2,
      navalMelee: 0.8,
      navalRanged: 0.9,
      air: 1.3
    },
    targetComposition: { melee: 0.25, ranged: 0.32, mounted: 0.12, siege: 0.16, navalMelee: 0.07, navalRanged: 0.08 },
    militaryBudget: { strengthMultiplier: 0.9, maxUnitsMultiplier: 0.65, allowOverbuildingWhenThreatened: false },
    strategicTolerance: { minHappinessForMilitaryBuilds: 5, minGoldReserveForMilitaryBuilds: 40, tolerateWarWeariness: false },
    productionBehavior: { modernizationBias: 1.6, quantityBias: 0.45, qualityBias: 1.8 }
  };
  var NAVAL_PROJECTION_DOCTRINE = {
    id: "navalProjection",
    name: "Naval Projection",
    description: "Blue-water power projection with dominant naval forces and a lean land component.",
    modernizationBias: 1.3,
    quantityBias: 0.9,
    qualityBias: 1.25,
    preferredRoles: {
      melee: 0.75,
      ranged: 0.9,
      mounted: 0.45,
      siege: 0.85,
      navalMelee: 2.1,
      navalRanged: 2.2,
      air: 1.1
    },
    targetComposition: { melee: 0.12, ranged: 0.18, mounted: 0.04, siege: 0.08, navalMelee: 0.28, navalRanged: 0.3 },
    militaryBudget: { strengthMultiplier: 1.2, maxUnitsMultiplier: 1.25, allowOverbuildingWhenThreatened: true },
    strategicTolerance: { minHappinessForMilitaryBuilds: 0, minGoldReserveForMilitaryBuilds: 20, tolerateWarWeariness: false },
    productionBehavior: { modernizationBias: 1.3, quantityBias: 0.9, qualityBias: 1.25 }
  };
  var MOUNTED_AGGRESSION_DOCTRINE = {
    id: "mountedAggression",
    name: "Mounted Aggression",
    description: "Fast offensive land warfare built around dominant mounted forces.",
    modernizationBias: 1,
    quantityBias: 1.2,
    qualityBias: 1,
    preferredRoles: {
      melee: 0.8,
      ranged: 1,
      mounted: 2.25,
      siege: 0.8,
      navalMelee: 0.35,
      navalRanged: 0.35,
      air: 0.9
    },
    targetComposition: { melee: 0.16, ranged: 0.22, mounted: 0.48, siege: 0.08, navalMelee: 0.03, navalRanged: 0.03 },
    militaryBudget: { strengthMultiplier: 1.35, maxUnitsMultiplier: 1.35, allowOverbuildingWhenThreatened: true },
    strategicTolerance: { minHappinessForMilitaryBuilds: -5, minGoldReserveForMilitaryBuilds: 0, tolerateWarWeariness: true },
    productionBehavior: { modernizationBias: 1, quantityBias: 1.2, qualityBias: 1 }
  };
  var FORTIFIED_DEFENSE_DOCTRINE = {
    id: "fortifiedDefense",
    name: "Fortified Defense",
    description: "Static garrison defense leaning on ranged and siege units with low offensive mobility.",
    modernizationBias: 1.1,
    quantityBias: 0.85,
    qualityBias: 1.2,
    preferredRoles: {
      melee: 1.15,
      ranged: 1.45,
      mounted: 0.35,
      siege: 1.35,
      navalMelee: 0.75,
      navalRanged: 0.85,
      air: 1
    },
    targetComposition: { melee: 0.3, ranged: 0.38, mounted: 0.04, siege: 0.18, navalMelee: 0.05, navalRanged: 0.05 },
    militaryBudget: { strengthMultiplier: 1, maxUnitsMultiplier: 0.9, allowOverbuildingWhenThreatened: true },
    strategicTolerance: { minHappinessForMilitaryBuilds: 2, minGoldReserveForMilitaryBuilds: 15, tolerateWarWeariness: false },
    productionBehavior: { modernizationBias: 1.1, quantityBias: 0.85, qualityBias: 1.2 }
  };
  var RELIGIOUS_MILITIA_DOCTRINE = {
    id: "religiousMilitia",
    name: "Religious Militia",
    description: "Traditional popular army of many melee/ranged units with modest modernization.",
    modernizationBias: 0.85,
    quantityBias: 1.35,
    qualityBias: 0.75,
    preferredRoles: {
      melee: 1.35,
      ranged: 1.25,
      mounted: 0.55,
      siege: 0.75,
      navalMelee: 0.55,
      navalRanged: 0.55,
      air: 0.75
    },
    targetComposition: { melee: 0.4, ranged: 0.34, mounted: 0.07, siege: 0.09, navalMelee: 0.05, navalRanged: 0.05 },
    militaryBudget: { strengthMultiplier: 1.05, maxUnitsMultiplier: 1.35, allowOverbuildingWhenThreatened: true },
    strategicTolerance: { minHappinessForMilitaryBuilds: -3, minGoldReserveForMilitaryBuilds: 0, tolerateWarWeariness: true },
    productionBehavior: { modernizationBias: 0.85, quantityBias: 1.35, qualityBias: 0.75 }
  };
  var ECONOMIC_MINIMAL_ARMY_DOCTRINE = {
    id: "economicMinimalArmy",
    name: "Economic Minimal Army",
    description: "Very lean army that builds military reluctantly and prioritizes economy unless threatened.",
    modernizationBias: 1.15,
    quantityBias: 0.35,
    qualityBias: 1.25,
    preferredRoles: {
      melee: 0.75,
      ranged: 1.05,
      mounted: 0.45,
      siege: 0.55,
      navalMelee: 0.7,
      navalRanged: 0.75,
      air: 1
    },
    targetComposition: { melee: 0.26, ranged: 0.36, mounted: 0.06, siege: 0.1, navalMelee: 0.11, navalRanged: 0.11 },
    militaryBudget: { strengthMultiplier: 0.55, maxUnitsMultiplier: 0.45, allowOverbuildingWhenThreatened: false },
    strategicTolerance: { minHappinessForMilitaryBuilds: 8, minGoldReserveForMilitaryBuilds: 60, tolerateWarWeariness: false },
    productionBehavior: { modernizationBias: 1.15, quantityBias: 0.35, qualityBias: 1.25 }
  };
  var PIRATE_CODE_DOCTRINE = {
    id: "pirateCode",
    name: "Pirate Code",
    description: "A fleet of raiders that lives and dies at sea. Overwhelmingly naval, fast and aggressive, with only a token land garrison for the home port.",
    modernizationBias: 1.1,
    quantityBias: 1.3,
    qualityBias: 1,
    preferredRoles: {
      melee: 0.5,
      ranged: 0.55,
      mounted: 0.2,
      siege: 0.3,
      navalMelee: 2.4,
      navalRanged: 2,
      air: 0.6
    },
    targetComposition: { melee: 0.08, ranged: 0.08, mounted: 0.02, siege: 0.02, navalMelee: 0.46, navalRanged: 0.34 },
    militaryBudget: { strengthMultiplier: 1.3, maxUnitsMultiplier: 1.5, allowOverbuildingWhenThreatened: true },
    strategicTolerance: { minHappinessForMilitaryBuilds: -8, minGoldReserveForMilitaryBuilds: 0, tolerateWarWeariness: true },
    productionBehavior: { modernizationBias: 1.1, quantityBias: 1.3, qualityBias: 1 }
  };
  var MILITARY_MOBILIZATION_DOCTRINE = {
    id: "militaryMobilization",
    name: "Military Mobilization",
    description: "Sustained military buildup with a large modern combined-arms force, strong land support, and high tolerance for prolonged mobilization.",
    modernizationBias: 1.25,
    quantityBias: 1.35,
    qualityBias: 1.1,
    preferredRoles: {
      melee: 1.2,
      ranged: 1.15,
      mounted: 1.2,
      siege: 1.4,
      navalMelee: 0.65,
      navalRanged: 0.65,
      air: 1.3
    },
    targetComposition: {
      melee: 0.27,
      ranged: 0.24,
      mounted: 0.17,
      siege: 0.17,
      navalMelee: 0.04,
      navalRanged: 0.04,
      air: 0.07
    },
    militaryBudget: {
      strengthMultiplier: 1.55,
      maxUnitsMultiplier: 1.75,
      allowOverbuildingWhenThreatened: true
    },
    strategicTolerance: {
      minHappinessForMilitaryBuilds: -6,
      minGoldReserveForMilitaryBuilds: -10,
      tolerateWarWeariness: true
    },
    productionBehavior: {
      modernizationBias: 1.25,
      quantityBias: 1.35,
      qualityBias: 1.1
    }
  };
  var PRESTIGE_PROJECTION_DOCTRINE = {
    id: "prestigeProjection",
    name: "Prestige Projection",
    description: "Maintains an imposing mixed land force and a meaningful navy, favoring attainable demonstrations of power over unlimited mobilization.",
    modernizationBias: 1.15,
    quantityBias: 1.15,
    qualityBias: 1.05,
    preferredRoles: {
      melee: 1.2,
      ranged: 1.05,
      mounted: 1.05,
      siege: 1.15,
      navalMelee: 1.35,
      navalRanged: 1.4,
      air: 1.1
    },
    targetComposition: {
      melee: 0.25,
      ranged: 0.22,
      mounted: 0.13,
      siege: 0.14,
      navalMelee: 0.12,
      navalRanged: 0.12,
      air: 0.02
    },
    militaryBudget: {
      strengthMultiplier: 1.3,
      maxUnitsMultiplier: 1.35,
      allowOverbuildingWhenThreatened: true
    },
    strategicTolerance: {
      minHappinessForMilitaryBuilds: -2,
      minGoldReserveForMilitaryBuilds: 5,
      tolerateWarWeariness: false
    },
    productionBehavior: {
      modernizationBias: 1.15,
      quantityBias: 1.15,
      qualityBias: 1.05
    }
  };
  var AI_MILITARY_DOCTRINES = [
    BALANCED_DOCTRINE,
    STEPPE_HORDE_DOCTRINE,
    NAVAL_POWER_DOCTRINE,
    CULTURAL_DEFENSE_DOCTRINE,
    DEFENSIVE_MODERN_DOCTRINE,
    IMPERIAL_COMBINED_ARMS_DOCTRINE,
    MARITIME_RAIDER_DOCTRINE,
    DISCIPLINED_INFANTRY_DOCTRINE,
    CHEAP_INFANTRY_SWARM_DOCTRINE,
    ELITE_ARMY_DOCTRINE,
    NAVAL_PROJECTION_DOCTRINE,
    MOUNTED_AGGRESSION_DOCTRINE,
    FORTIFIED_DEFENSE_DOCTRINE,
    RELIGIOUS_MILITIA_DOCTRINE,
    ECONOMIC_MINIMAL_ARMY_DOCTRINE,
    PIRATE_CODE_DOCTRINE,
    MILITARY_MOBILIZATION_DOCTRINE,
    PRESTIGE_PROJECTION_DOCTRINE
  ];

  // src/data/covertPersonalities.ts
  var DEFAULT_COVERT_PERSONALITY_ID = "pragmatist";
  var COVERT_PERSONALITIES = [
    {
      id: "pragmatist",
      name: "Pragmatist",
      description: "Treats covert warfare as one tool among many, with no strong leaning.",
      covertUsageBias: 0,
      suspicionSensitivity: 1,
      riskTolerance: 1,
      proxyWarPreference: 0.5,
      espionagePreference: 0.5,
      suspicionToWar: 1,
      suspicionToTrade: 1
    },
    {
      id: "honorable",
      name: "Honorable",
      description: "Considers covert warfare dishonorable; rarely uses it and reacts strongly when targeted.",
      covertUsageBias: -0.75,
      suspicionSensitivity: 1.3,
      riskTolerance: 0.4,
      proxyWarPreference: 0.1,
      espionagePreference: 0.2,
      suspicionToWar: 1.25,
      suspicionToTrade: 1
    },
    {
      id: "schemer",
      name: "Schemer",
      description: "Actively employs spies and agents and tolerates the diplomatic risk.",
      covertUsageBias: 0.75,
      suspicionSensitivity: 0.9,
      riskTolerance: 1.4,
      proxyWarPreference: 0.8,
      espionagePreference: 0.9,
      suspicionToWar: 1,
      suspicionToTrade: 0.8
    },
    {
      id: "opportunist",
      name: "Opportunist",
      description: "Uses covert actions mainly against weaker targets when the moment is favourable.",
      covertUsageBias: 0.4,
      suspicionSensitivity: 0.9,
      riskTolerance: 1.1,
      proxyWarPreference: 0.6,
      espionagePreference: 0.6,
      suspicionToWar: 1.1,
      suspicionToTrade: 0.9
    },
    {
      id: "paranoid",
      name: "Paranoid",
      description: "Rarely initiates covert operations but becomes suspicious very quickly and escalates.",
      covertUsageBias: -0.3,
      suspicionSensitivity: 1.6,
      riskTolerance: 0.6,
      proxyWarPreference: 0.3,
      espionagePreference: 0.4,
      suspicionToWar: 1.5,
      suspicionToTrade: 1.1
    },
    {
      id: "fanatic",
      name: "Fanatic",
      description: "Wields covert warfare against ideological rivals and escalates readily.",
      covertUsageBias: 0.5,
      suspicionSensitivity: 1.2,
      riskTolerance: 1.3,
      proxyWarPreference: 0.7,
      espionagePreference: 0.6,
      suspicionToWar: 1.4,
      suspicionToTrade: 1
    },
    {
      id: "merchant",
      name: "Merchant",
      description: "Avoids covert actions that threaten trade; punishes suspicion through commerce, not war.",
      covertUsageBias: -0.4,
      suspicionSensitivity: 1,
      riskTolerance: 0.5,
      proxyWarPreference: 0.2,
      espionagePreference: 0.4,
      suspicionToWar: 0.7,
      suspicionToTrade: 1.5
    },
    {
      id: "pirate",
      name: "Pirate",
      description: "Heavily favours privateers and maritime disruption; thrives on chaos.",
      covertUsageBias: 0.8,
      suspicionSensitivity: 0.8,
      riskTolerance: 1.5,
      proxyWarPreference: 0.9,
      espionagePreference: 0.5,
      suspicionToWar: 1,
      suspicionToTrade: 0.7
    }
  ];
  var BY_ID = new Map(COVERT_PERSONALITIES.map((p) => [p.id, p]));

  // src/data/leaders.ts
  var LEADER_IMAGE_BASE = "/assets/sprites/leaders";
  var DEFAULT_LEADERS_WITHOUT_GAMES_PREFERENCES = [
    {
      id: "leader_henry_v",
      name: "Henry V",
      opportunism: true,
      nationId: "nation_england",
      title: "King of England",
      image: `${LEADER_IMAGE_BASE}/henry-v.png`,
      description: "A martial king remembered for disciplined campaigns and a hard edge in war.",
      ideologyId: "militarism",
      aiMilitaryDoctrineId: "navalPower",
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
        casualtyToleranceRatio: 0.55
      }
    },
    {
      id: "leader_charles_vii",
      name: "Charles VII",
      nationId: "nation_france",
      title: "King of France",
      image: `${LEADER_IMAGE_BASE}/charles-vi.png`,
      description: "A prestige-minded restorer of French authority, leaning on courtly culture, diplomacy, and monumental soft power.",
      ideologyId: "traditionalism",
      aiMilitaryDoctrineId: "culturalDefense",
      aiNationalAgendaId: "culture",
      culturePriorities: ["code_of_laws", "foreign_trade", "mysticism", "state_workforce", "political_philosophy", "drama_poetry", "recorded_history"],
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
        casualtyToleranceRatio: 0.25
      }
    },
    {
      id: "leader_sigismund",
      name: "Sigismund",
      nationId: "nation_hre",
      title: "Holy Roman Emperor",
      image: `${LEADER_IMAGE_BASE}/sigismund.png`,
      description: "An imperial broker balancing crowns, councils, and competing princes.",
      ideologyId: "conservatism",
      aiMilitaryDoctrineId: "religiousMilitia",
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
        casualtyToleranceRatio: 0.3
      }
    },
    {
      id: "leader_gustav_vasa",
      name: "Gustav Vasa",
      nationId: "nation_sweden",
      title: "King of Sweden",
      image: `${LEADER_IMAGE_BASE}/gustaf-vasa.png`,
      description: "A determined state-builder with an eye for independence and order.",
      ideologyId: "nationalism",
      aiMilitaryDoctrineId: "navalPower",
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
        casualtyToleranceRatio: 0.4
      }
    },
    {
      id: "leader_vytautas",
      name: "Vytautas the Great",
      nationId: "nation_lithuania",
      title: "Grand Duke of Lithuania",
      image: `${LEADER_IMAGE_BASE}/vytautas-the-great.png`,
      description: "An ambitious grand duke whose realm looks across the eastern frontier.",
      ideologyId: "nationalism",
      aiMilitaryDoctrineId: "economicMinimalArmy",
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
        casualtyToleranceRatio: 0.45
      }
    },
    {
      id: "leader_marfa_boretskaya",
      name: "Marfa Boretskaya",
      nationId: "nation_novgorod",
      title: "Posadnitsa of Novgorod",
      image: `${LEADER_IMAGE_BASE}/marfa-boretskaya.png`,
      description: "A formidable civic figure standing for Novgorod tradition and autonomy.",
      ideologyId: "conservatism",
      aiMilitaryDoctrineId: "disciplinedInfantry",
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
        casualtyToleranceRatio: 0.25
      }
    },
    {
      id: "leader_mehmed_ii",
      name: "Mehmed II",
      opportunism: true,
      nationId: "nation_ottoman",
      title: "Sultan of the Ottoman Empire",
      image: `${LEADER_IMAGE_BASE}/mehmed-i.png`,
      description: "A conqueror-sultan with a taste for decisive campaigns and imperial ambition.",
      ideologyId: "militarism",
      aiMilitaryDoctrineId: "mountedAggression",
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
        casualtyToleranceRatio: 0.7
      }
    },
    {
      id: "leader_isabella_i",
      name: "Isabella I",
      nationId: "nation_spain",
      title: "Queen of Castile",
      image: `${LEADER_IMAGE_BASE}/isabella.png`,
      description: "A dynastic ruler focused on unity, faith, and royal authority.",
      ideologyId: "traditionalism",
      aiMilitaryDoctrineId: "cheapInfantrySwarm",
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
        casualtyToleranceRatio: 0.4
      }
    },
    {
      id: "leader_abu_said_uthman_ii",
      name: "Abu Said Uthman II",
      nationId: "nation_morocco_empire",
      title: "Sultan of Morocco",
      image: `${LEADER_IMAGE_BASE}/abu-al-hasan.png`,
      description: "A Maghrebi ruler anchoring Moroccan power across western trade routes.",
      ideologyId: "globalism",
      aiMilitaryDoctrineId: "religiousMilitia",
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
        casualtyToleranceRatio: 0.35
      }
    },
    {
      id: "leader_george-washington",
      name: "George Washington",
      nationId: "nation_usa",
      title: "President George Washington",
      image: `${LEADER_IMAGE_BASE}/george-washington.png`,
      description: "A visionary founding father focused on liberty, stability, and national unity.",
      ideologyId: "liberalism",
      aiMilitaryDoctrineId: "eliteArmy",
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
        casualtyToleranceRatio: 0.35
      }
    },
    {
      id: "leader_mahatma-gandhi",
      name: "Gandhi",
      nationId: "nation_india",
      title: "Mahatma Gandhi",
      image: `${LEADER_IMAGE_BASE}/mahatma-gandhi.png`,
      description: "A spiritual leader focused on non-violence, civil disobedience, and national liberation.",
      ideologyId: "liberalism",
      aiMilitaryDoctrineId: "defensiveModern",
      culturePriorities: ["early_empire", "state_workforce", "mysticism", "political_philosophy", "games_recreation"],
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
        casualtyToleranceRatio: 0.2
      }
    },
    {
      id: "leader_qin-shi-huang",
      name: "Qin Shi Huang",
      opportunism: true,
      nationId: "nation_china",
      title: "Emperor Qin Shi Huang",
      image: `${LEADER_IMAGE_BASE}/qin-shi-huang.png`,
      description: "An imperial unifier focused on administration, infrastructure, discipline, and centralized expansion.",
      ideologyId: "nationalism",
      aiMilitaryDoctrineId: "imperialCombinedArms",
      culturePriorities: ["state_workforce", "early_empire", "political_philosophy", "recorded_history", "civil_service_civics", "guilds"],
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
        casualtyToleranceRatio: 0.45
      }
    },
    {
      id: "leader_koxinga",
      name: "Koxinga",
      nationId: "nation_taiwan",
      title: "Zheng Chenggong",
      image: `${LEADER_IMAGE_BASE}/koxinga.png`,
      description: "A maritime commander focused on trade, diplomacy, technology, and resilient island defense.",
      ideologyId: "globalism",
      aiMilitaryDoctrineId: "maritimeRaider",
      culturePriorities: ["foreign_trade", "state_workforce", "political_philosophy", "recorded_history", "civil_service_civics", "diplomatic_service"],
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
        casualtyToleranceRatio: 0.3
      }
    },
    {
      id: "leader_dom-pedro-ii",
      name: "Dom Pedro II",
      nationId: "nation_brazil",
      title: "Emperor Dom Pedro II",
      image: `${LEADER_IMAGE_BASE}/dom-pedro-ii.png`,
      description: "An enlightened monarch focused on scientific progress, cultural growth, and diplomatic stability.",
      ideologyId: "progressivism",
      aiMilitaryDoctrineId: "fortifiedDefense",
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
        casualtyToleranceRatio: 0.3
      }
    },
    {
      id: "leader_mansa-musa",
      name: "Mansa Musa",
      nationId: "nation_mali_empire",
      title: "Emperor Mansa Musa",
      image: `${LEADER_IMAGE_BASE}/mansa-musa.png`,
      description: "A legendary sovereign focused on immense wealth, trans-Saharan trade, and intellectual enlightenment.",
      ideologyId: "globalism",
      aiMilitaryDoctrineId: "disciplinedInfantry",
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
        casualtyToleranceRatio: 0.25
      }
    },
    {
      id: "leader_genghis-khan",
      name: "Genghis Khan",
      opportunism: true,
      nationId: "nation_mongolia",
      title: "Great Khan of the Mongols",
      image: `${LEADER_IMAGE_BASE}/genghis-khan.png`,
      description: "A relentless conqueror whose horse-borne armies carve empires from the steppe.",
      ideologyId: "militarism",
      aiMilitaryDoctrineId: "steppeHorde",
      culturePriorities: ["early_empire"],
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
        casualtyToleranceRatio: 0.7
      }
    },
    {
      id: "leader_oda-nobunaga",
      name: "Oda Nobunaga",
      opportunism: true,
      nationId: "nation_japan",
      title: "Daimyo of Owari",
      image: `${LEADER_IMAGE_BASE}/oda-nobunaga.png`,
      description: "A ruthless unifier of the islands, balancing martial prowess with disciplined defense.",
      ideologyId: "militarism",
      aiMilitaryDoctrineId: "maritimeRaider",
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
        casualtyToleranceRatio: 0.55
      }
    },
    {
      // First-pass Denmark: mirrors Japan's (Oda Nobunaga's) doctrine, agenda,
      // ideology, and AI personality. Only the nation, leader, and assets differ.
      // Denmark-specific behaviour will be introduced later.
      id: "leader_christian-iv",
      name: "Christian IV",
      nationId: "nation_denmark",
      title: "King of Denmark and Norway",
      image: `${LEADER_IMAGE_BASE}/christian-iv.png`,
      description: "An ambitious builder-king, balancing martial prowess with disciplined defense.",
      ideologyId: "militarism",
      aiMilitaryDoctrineId: "maritimeRaider",
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
        casualtyToleranceRatio: 0.55
      }
    },
    {
      // Mad Jack — a fantasy one-city pirate warlord. Not balanced for victory:
      // a maritime wildcard meant to harass stronger powers. Expansion is
      // intentionally suppressed (maxPreferredCities: 1); his naval identity comes
      // from the Pirate Code doctrine + Sea Wolf era strategy + Freebooters ideology.
      id: "leader_mad_jack",
      name: "Mad Jack",
      opportunism: true,
      nationId: "nation_pirate",
      title: "Pirate Lord of the Free Seas",
      image: `${LEADER_IMAGE_BASE}/pirate.png`,
      description: "A roguish freebooter who answers to no crown \u2014 dominating shipping lanes, plundering coasts, and sowing chaos wherever stronger powers grow comfortable.",
      ideologyId: "freebooters",
      aiMilitaryDoctrineId: "pirateCode",
      aiNationalAgendaId: "naval_power",
      // Pirates care nothing for high culture; only a single early node nudges the tree.
      culturePriorities: ["foreign_trade"],
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
        casualtyToleranceRatio: 0.5
      }
    },
    {
      // Hermann the Cheruscan (Arminius) — a tribal-confederation defender: fierce
      // homeland resistance against larger empires rather than world conquest.
      // Nationalist identity, disciplined land army, distrust of dominant powers,
      // and (per his historical reliance on intelligence and deception) a paranoid
      // covert posture. Music/art live under nation_germany.
      id: "hermann-the-cheruscan",
      name: "Hermann the Cheruscan",
      nationId: "nation_germany",
      title: "Chieftain of the Cherusci",
      image: `${LEADER_IMAGE_BASE}/hermann-the-cheruscan.png`,
      description: "Hermann the Cheruscan, known to the Romans as Arminius, united Germanic tribes against Roman expansion and achieved one of history's most famous victories in the Teutoburg Forest. A skilled strategist who understood both Roman military doctrine and tribal warfare, Hermann represents independence, resilience, and fierce resistance against foreign domination. Under his leadership, alliances are forged through necessity, enemies are watched carefully, and freedom is defended at any cost.",
      ideologyId: "nationalism",
      aiMilitaryDoctrineId: "disciplinedInfantry",
      aiNationalAgendaId: "homeland_defense",
      covertPersonalityId: "paranoid",
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
        casualtyToleranceRatio: 0.6
      },
      diplomacyFlavor: {
        greeting: "I am Hermann of the Cherusci. Speak plainly \u2014 we have learned to be cautious with strangers who come bearing fine words.",
        friendly: "Between free peoples there is loyalty, and against the great powers there is strength in standing together. Our shields are at your side.",
        neutral: "We watch the movements of all nations, yours among them. Walk carefully near our forests.",
        hostile: "No empire dictates terms to free men. Press us further and you will learn what the legions learned.",
        warDeclaration: "You reach for what is ours. Then it is settled \u2014 we defend our homeland and our freedom, whatever the cost.",
        victory: "The tribes endure, free and unbroken. Let every empire remember the price of crossing into our lands.",
        defeat: "You may take this ground, but freedom is not so easily conquered. Free peoples endure, and they remember."
      }
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
      id: "ivan-iv",
      name: "Ivan IV",
      opportunism: true,
      nationId: "nation_russia",
      title: "Ivan the Terrible",
      image: `${LEADER_IMAGE_BASE}/ivan-iv.png`,
      description: "Ivan IV transformed Russia from a regional kingdom into an expanding empire. Ruthless toward rivals and feared by neighbors, he centralized power, crushed opposition and pushed Russian influence across vast frontiers. Under his rule, military strength and territorial expansion took precedence over diplomacy.",
      ideologyId: "militarism",
      aiMilitaryDoctrineId: "imperialCombinedArms",
      aiNationalAgendaId: "military_power",
      covertPersonalityId: "paranoid",
      culturePriorities: ["early_empire", "state_workforce"],
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
        casualtyToleranceRatio: 0.6
      },
      diplomacyFlavor: {
        greeting: "I am Ivan, Tsar of all the Russias. Speak \u2014 but know that I trust no crown that smiles too easily.",
        friendly: "For now our interests run together. See that they continue to, lest my patience wear thin.",
        neutral: "Russia watches its borders, and its neighbors. We forget nothing, and we forgive little.",
        hostile: "You overreach. Russia has swallowed greater powers than yours and felt no hunger after.",
        warDeclaration: "I have measured your strength and found it wanting. The frontier will move \u2014 at your expense.",
        victory: "The empire grows, as it was always destined to. Let every rival remember who was master here.",
        defeat: "So the throne falls. Yet Russia endures the cold, the famine, and the conqueror alike \u2014 and it remembers."
      }
    },
    {
      id: "leader_joseph_stalin",
      name: "Joseph Stalin",
      opportunism: true,
      nationId: "nation_soviet_union",
      title: "General Secretary",
      image: `${LEADER_IMAGE_BASE}/joseph-stalin.png`,
      description: "The authoritarian Soviet leader who drove rapid industrialization, concentrated state power, and led the Soviet Union through World War II.",
      ideologyId: "militarism",
      aiMilitaryDoctrineId: "imperialCombinedArms",
      aiNationalAgendaId: "military_power",
      covertPersonalityId: "paranoid",
      culturePriorities: ["state_workforce", "early_empire", "totalitarianism", "class_struggle"],
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
        casualtyToleranceRatio: 0.65
      },
      diplomacyFlavor: {
        greeting: "The Soviet Union listens. Speak clearly, and do not mistake patience for weakness.",
        friendly: "Our states have found common purpose. Let discipline and mutual interest keep it so.",
        neutral: "We judge nations by their actions, not their assurances. The Soviet Union is watching.",
        hostile: "Your intentions are no longer in doubt. We are prepared for what follows.",
        warDeclaration: "You have made coexistence impossible. The full strength of the Soviet state will now be brought against you.",
        victory: "The Soviet state stands stronger than before. History has rendered its judgment.",
        defeat: "You may occupy our ground, but no victory over such a vast people is ever complete."
      }
    },
    {
      // Opportunistic prestige-seeker: maintains a substantial mixed force and
      // presses weaker rivals, but remains more sensitive to unfavorable military
      // comparisons than the most committed conquest personalities.
      id: "leader_benito_mussolini",
      name: "Benito Mussolini",
      opportunism: true,
      nationId: "nation_italy",
      title: "Il Duce",
      image: `${LEADER_IMAGE_BASE}/benito-mussolini.png`,
      description: "Italy\u2019s Fascist dictator, an authoritarian nationalist who pursued military prestige, territorial expansion, and recognition as a major power.",
      ideologyId: "nationalism",
      aiMilitaryDoctrineId: "prestigeProjection",
      aiNationalAgendaId: "new_roman_empire",
      covertPersonalityId: "opportunist",
      culturePriorities: ["state_workforce", "early_empire", "military_tradition", "nationalism", "totalitarianism", "mobilization"],
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
        casualtyToleranceRatio: 0.5
      },
      diplomacyFlavor: {
        greeting: "Italy expects to be heard among the great powers. Speak, and let us discover whether your proposal is worthy of our attention.",
        friendly: "Together our nations command respect. Let our partnership increase the prestige and strength of both.",
        neutral: "Italy watches the balance of power closely. We respect strength, ambition, and those who understand opportunity.",
        hostile: "Your obstruction is an insult to Italy\u2019s dignity. Do not mistake restraint for weakness.",
        warDeclaration: "The hour for speeches has ended. Italy now advances to defend its honor and claim the greatness it deserves.",
        victory: "Italy has demonstrated its strength before the world. Let every nation recognize our renewed greatness.",
        defeat: "Fortune has turned against us today, but Italy\u2019s pride and ambition will not be erased."
      }
    },
    {
      // Prepared alliance-builder: credible defensive strength and firm resistance
      // to threats, without the expansion bias of conquest-oriented leaders.
      id: "leader_wladyslaw_sikorski",
      name: "W\u0142adys\u0142aw Sikorski",
      nationId: "nation_poland",
      title: "General",
      image: `${LEADER_IMAGE_BASE}/wladyslaw-sikorski.png`,
      description: "A Polish general and statesman defined by military preparedness, diplomatic cooperation, and determination to preserve Poland\u2019s sovereignty.",
      ideologyId: "conservatism",
      aiMilitaryDoctrineId: "disciplinedInfantry",
      aiNationalAgendaId: "poland_shall_endure",
      covertPersonalityId: "honorable",
      culturePriorities: ["state_workforce", "early_empire", "military_tradition", "defensive_tactics", "civil_service_civics", "diplomatic_service", "nationalism", "mobilization"],
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
        casualtyToleranceRatio: 0.55
      },
      diplomacyFlavor: {
        greeting: "Poland seeks peace founded on respect, preparedness, and clear commitments. Speak candidly, and you will receive the same.",
        friendly: "A dependable friend is a source of strength in uncertain times. Poland will honor the commitments we make together.",
        neutral: "Poland judges nations by their conduct. We prepare for danger, but we remain ready for honest cooperation.",
        hostile: "Threats will not decide Poland\u2019s future. Continued pressure will meet disciplined and determined resistance.",
        warDeclaration: "Poland\u2019s security can no longer rest on assurances. Our forces are prepared, and we will act with resolve.",
        victory: "Poland stands sovereign because its people and its partners did not yield when tested.",
        defeat: "An army may be defeated, but a nation\u2019s determination to endure cannot be erased by force."
      }
    }
  ];
  var GAMES_PREFERENCES_BY_LEADER = {
    leader_henry_v: { traditionalFavourite: "wrestling", additionalFavourite: "boxing" },
    leader_charles_vii: { traditionalFavourite: "long_jump", additionalFavourite: "fencing" },
    leader_sigismund: { traditionalFavourite: "javelin", additionalFavourite: "pole_vault" },
    leader_gustav_vasa: { traditionalFavourite: "javelin", additionalFavourite: "fencing" },
    leader_vytautas: { traditionalFavourite: "marathon", additionalFavourite: "horse_racing" },
    leader_marfa_boretskaya: { traditionalFavourite: "swimming", additionalFavourite: "hundred_metres" },
    leader_mehmed_ii: { traditionalFavourite: "wrestling", additionalFavourite: "horse_racing" },
    leader_isabella_i: { traditionalFavourite: "long_jump", additionalFavourite: "fencing" },
    leader_abu_said_uthman_ii: { traditionalFavourite: "marathon", additionalFavourite: "horse_racing" },
    "leader_george-washington": { traditionalFavourite: "javelin", additionalFavourite: "boxing" },
    "leader_mahatma-gandhi": { traditionalFavourite: "marathon", additionalFavourite: "hundred_metres" },
    "leader_qin-shi-huang": { traditionalFavourite: "swimming", additionalFavourite: "pole_vault" },
    leader_koxinga: { traditionalFavourite: "swimming", additionalFavourite: "fencing" },
    "leader_dom-pedro-ii": { traditionalFavourite: "long_jump", additionalFavourite: "pole_vault" },
    "leader_mansa-musa": { traditionalFavourite: "marathon", additionalFavourite: "hundred_metres" },
    "leader_genghis-khan": { traditionalFavourite: "wrestling", additionalFavourite: "horse_racing" },
    "leader_oda-nobunaga": { traditionalFavourite: "javelin", additionalFavourite: "fencing" },
    "leader_christian-iv": { traditionalFavourite: "swimming", additionalFavourite: "pole_vault" },
    leader_mad_jack: { traditionalFavourite: "swimming", additionalFavourite: "boxing" },
    "hermann-the-cheruscan": { traditionalFavourite: "wrestling", additionalFavourite: "hundred_metres" },
    "ivan-iv": { traditionalFavourite: "javelin", additionalFavourite: "horse_racing" },
    leader_joseph_stalin: { traditionalFavourite: "wrestling", additionalFavourite: "boxing" },
    leader_benito_mussolini: { traditionalFavourite: "wrestling", additionalFavourite: "fencing" },
    leader_wladyslaw_sikorski: { traditionalFavourite: "javelin", additionalFavourite: "fencing" }
  };
  var DEFAULT_LEADERS = DEFAULT_LEADERS_WITHOUT_GAMES_PREFERENCES.map((leader) => ({
    ...leader,
    isDefault: true,
    gamesOfNationsPreferences: GAMES_PREFERENCES_BY_LEADER[leader.id]
  }));
  var HENRY_V = DEFAULT_LEADERS.find((leader) => leader.id === "leader_henry_v");
  var JOSEPH_STALIN = DEFAULT_LEADERS.find((leader) => leader.id === "leader_joseph_stalin");
  var BENITO_MUSSOLINI = DEFAULT_LEADERS.find((leader) => leader.id === "leader_benito_mussolini");
  var WLADYSLAW_SIKORSKI = DEFAULT_LEADERS.find((leader) => leader.id === "leader_wladyslaw_sikorski");
  var WINSTON_CHURCHILL = {
    ...HENRY_V,
    id: "leader_winston_churchill",
    isDefault: false,
    name: "Winston Churchill",
    opportunism: false,
    title: "Prime Minister",
    image: `${LEADER_IMAGE_BASE}/winston-churchill.png`,
    description: "Britain\u2019s wartime Prime Minister, renowned for determined leadership and defiant resistance during World War II.",
    aiPersonality: HENRY_V.aiPersonality ? { ...HENRY_V.aiPersonality } : void 0,
    culturePriorities: HENRY_V.culturePriorities ? [...HENRY_V.culturePriorities] : void 0,
    gamesOfNationsPreferences: { ...HENRY_V.gamesOfNationsPreferences },
    diplomacyFlavor: HENRY_V.diplomacyFlavor ? { ...HENRY_V.diplomacyFlavor } : void 0
  };
  var CHARLES_DE_GAULLE = {
    id: "leader_charles_de_gaulle",
    isDefault: false,
    name: "Charles de Gaulle",
    nationId: "nation_france",
    title: "General",
    image: `${LEADER_IMAGE_BASE}/charles-de-gaulle.png`,
    description: "Leader of Free France and later President of the French Republic, defined by national independence, resistance, and an uncompromising defense of French sovereignty.",
    ideologyId: "nationalism",
    aiMilitaryDoctrineId: "disciplinedInfantry",
    aiNationalAgendaId: "france_libre",
    covertPersonalityId: "honorable",
    culturePriorities: ["state_workforce", "early_empire", "military_tradition", "nationalism", "mobilization"],
    gamesOfNationsPreferences: { traditionalFavourite: "javelin", additionalFavourite: "fencing" },
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
      casualtyToleranceRatio: 0.6
    },
    diplomacyFlavor: {
      greeting: "France speaks in its own name and chooses its own course. Let us deal with one another as sovereign nations.",
      friendly: "Our friendship is strongest when neither nation asks the other to surrender its independence.",
      neutral: "France listens to allies and rivals alike, but its decisions remain French decisions.",
      hostile: "Pressure will not make France submit. It will only make our resistance more determined.",
      warDeclaration: "France will not accept intimidation or subordination. We shall resist, and France shall endure.",
      victory: "France stands sovereign and unbroken. That was the purpose of our struggle.",
      defeat: "A battle may be lost, but France is not extinguished. Resistance will continue wherever French resolve remains."
    }
  };
  var ADOLF_HITLER = {
    id: "leader_adolf_hitler",
    isDefault: false,
    name: "Adolf Hitler",
    opportunism: true,
    nationId: "nation_germany",
    title: "F\xFChrer",
    image: `${LEADER_IMAGE_BASE}/adolf-hitler.png`,
    description: "Germany\u2019s Nazi dictator during World War II, responsible for militarization, aggressive expansion, mass persecution, and genocide.",
    ideologyId: "militarism",
    aiMilitaryDoctrineId: "militaryMobilization",
    aiNationalAgendaId: "military_power",
    covertPersonalityId: "paranoid",
    culturePriorities: ["state_workforce", "early_empire", "military_tradition", "totalitarianism"],
    gamesOfNationsPreferences: { traditionalFavourite: "javelin", additionalFavourite: "boxing" },
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
      casualtyToleranceRatio: 0.68
    },
    diplomacyFlavor: {
      greeting: "Germany will judge your proposal by strength, discipline, and advantage. Speak plainly.",
      friendly: "Our present interests are aligned. That alignment will endure only while it remains useful to Germany.",
      neutral: "Germany is preparing for every possibility. Your actions will determine which one follows.",
      hostile: "You have placed yourself against German interests. Do not expect hesitation in our response.",
      warDeclaration: "Diplomacy no longer serves our aims. Germany will now settle this by force.",
      victory: "Germany has imposed its will through preparation and force.",
      defeat: "Our military position has collapsed. History will record the consequences."
    }
  };
  var ALL_LEADERS = [
    ...DEFAULT_LEADERS,
    WINSTON_CHURCHILL,
    CHARLES_DE_GAULLE,
    ADOLF_HITLER
  ];
  var LEADER_COVERT_PERSONALITY_DEFAULTS = {
    leader_henry_v: "opportunist",
    leader_winston_churchill: "opportunist",
    leader_charles_vii: "honorable",
    leader_sigismund: "pragmatist",
    leader_gustav_vasa: "opportunist",
    leader_vytautas: "opportunist",
    leader_marfa_boretskaya: "merchant",
    leader_mehmed_ii: "fanatic",
    leader_isabella_i: "fanatic",
    leader_abu_said_uthman_ii: "merchant",
    "leader_george-washington": "honorable",
    "leader_mahatma-gandhi": "honorable",
    "leader_qin-shi-huang": "schemer",
    leader_koxinga: "merchant",
    "leader_dom-pedro-ii": "honorable",
    "leader_mansa-musa": "merchant",
    "leader_genghis-khan": "opportunist",
    "leader_oda-nobunaga": "schemer",
    "leader_christian-iv": "opportunist",
    leader_mad_jack: "pirate"
  };

  // src/data/aiStrategies.ts
  var BASELINE_AI_STRATEGY_ID = "baseline";
  var BALANCED_AI_STRATEGY_ID = "balanced";
  var EXPANSIONIST_AI_STRATEGY_ID = "expansionist";
  var DEFENSIVE_AI_STRATEGY_ID = "defensive";
  var AGGRESSIVE_AI_STRATEGY_ID = "aggressive";
  var ECONOMIC_AI_STRATEGY_ID = "economic";
  var CULTURAL_DOMINANCE_AI_STRATEGY_ID = "cultural_dominance";
  var BASELINE_AI_STRATEGY = {
    id: BASELINE_AI_STRATEGY_ID,
    name: "Baseline",
    military: {
      maxUnits: 3,
      minAttackHealthRatio: 0.5,
      engageDistance: 6,
      preferReachableTargets: true,
      randomnessFactor: 0.1,
      aggression: 1
    },
    expansion: {
      desiredCityCount: 3,
      settlerMinCityDistance: 7,
      settlerInterval: 8
    },
    production: {
      lowNetFoodThreshold: 1,
      lowProductionThreshold: 2,
      settlerWeight: 1,
      militaryWeight: 1,
      foodBuildingWeight: 1,
      productionBuildingWeight: 1,
      goldBuildingWeight: 1,
      cultureBuildingWeight: 1,
      wonderWeight: 1
    }
  };
  var BALANCED_AI_STRATEGY = {
    id: BALANCED_AI_STRATEGY_ID,
    name: "Balanced",
    military: {
      maxUnits: 3,
      minAttackHealthRatio: 0.5,
      engageDistance: 8,
      preferReachableTargets: true,
      randomnessFactor: 0.1,
      aggression: 1
    },
    expansion: {
      desiredCityCount: 3,
      settlerMinCityDistance: 8,
      settlerInterval: 7
    },
    production: {
      lowNetFoodThreshold: 1,
      lowProductionThreshold: 2,
      settlerWeight: 1,
      militaryWeight: 1,
      foodBuildingWeight: 1,
      productionBuildingWeight: 1,
      goldBuildingWeight: 1,
      cultureBuildingWeight: 1,
      wonderWeight: 1
    }
  };
  var EXPANSIONIST_AI_STRATEGY = {
    id: EXPANSIONIST_AI_STRATEGY_ID,
    name: "Expansionist",
    military: {
      maxUnits: 3,
      minAttackHealthRatio: 0.55,
      engageDistance: 6,
      preferReachableTargets: true,
      randomnessFactor: 0.1,
      aggression: 1.2
    },
    expansion: {
      desiredCityCount: 5,
      settlerMinCityDistance: 8,
      settlerInterval: 4
    },
    production: {
      lowNetFoodThreshold: 1,
      lowProductionThreshold: 2,
      settlerWeight: 2,
      militaryWeight: 0.75,
      foodBuildingWeight: 1.25,
      productionBuildingWeight: 1,
      goldBuildingWeight: 1,
      cultureBuildingWeight: 1.15,
      wonderWeight: 0.9
    }
  };
  var DEFENSIVE_AI_STRATEGY = {
    id: DEFENSIVE_AI_STRATEGY_ID,
    name: "Defensive",
    military: {
      maxUnits: 5,
      minAttackHealthRatio: 0.7,
      engageDistance: 5,
      preferReachableTargets: true,
      randomnessFactor: 0.05,
      aggression: 0.7
    },
    expansion: {
      desiredCityCount: 4,
      settlerMinCityDistance: 7,
      settlerInterval: 8
    },
    production: {
      lowNetFoodThreshold: 1,
      lowProductionThreshold: 2,
      settlerWeight: 0.75,
      militaryWeight: 1.5,
      foodBuildingWeight: 1,
      productionBuildingWeight: 1.25,
      goldBuildingWeight: 1,
      cultureBuildingWeight: 1,
      wonderWeight: 0.85
    }
  };
  var AGGRESSIVE_AI_STRATEGY = {
    id: AGGRESSIVE_AI_STRATEGY_ID,
    name: "Aggressive",
    military: {
      maxUnits: 6,
      minAttackHealthRatio: 0.35,
      engageDistance: 12,
      preferReachableTargets: true,
      randomnessFactor: 0.2,
      aggression: 1.8
    },
    expansion: {
      desiredCityCount: 3,
      settlerMinCityDistance: 7,
      settlerInterval: 5
    },
    production: {
      lowNetFoodThreshold: 1,
      lowProductionThreshold: 2,
      settlerWeight: 0.5,
      militaryWeight: 1.75,
      foodBuildingWeight: 1,
      productionBuildingWeight: 1,
      goldBuildingWeight: 0.75,
      cultureBuildingWeight: 0.75,
      wonderWeight: 0.6
    }
  };
  var ECONOMIC_AI_STRATEGY = {
    id: ECONOMIC_AI_STRATEGY_ID,
    name: "Economic",
    military: {
      maxUnits: 2,
      minAttackHealthRatio: 0.6,
      engageDistance: 6,
      preferReachableTargets: true,
      randomnessFactor: 0.1,
      aggression: 0.8
    },
    expansion: {
      desiredCityCount: 6,
      settlerMinCityDistance: 9,
      settlerInterval: 7
    },
    production: {
      lowNetFoodThreshold: 1,
      lowProductionThreshold: 2,
      settlerWeight: 0.75,
      militaryWeight: 0.5,
      foodBuildingWeight: 1.25,
      productionBuildingWeight: 1.5,
      goldBuildingWeight: 1.75,
      cultureBuildingWeight: 1.1,
      wonderWeight: 1.1
    }
  };
  var CULTURAL_DOMINANCE_AI_STRATEGY = {
    id: CULTURAL_DOMINANCE_AI_STRATEGY_ID,
    name: "Cultural Dominance",
    military: {
      maxUnits: 2,
      minAttackHealthRatio: 0.65,
      engageDistance: 5,
      preferReachableTargets: true,
      randomnessFactor: 0.05,
      aggression: 0.55
    },
    expansion: {
      desiredCityCount: 5,
      settlerMinCityDistance: 8,
      settlerInterval: 10
    },
    production: {
      lowNetFoodThreshold: 1,
      lowProductionThreshold: 2,
      settlerWeight: 1.15,
      militaryWeight: 0.45,
      foodBuildingWeight: 1,
      productionBuildingWeight: 0.9,
      goldBuildingWeight: 0.85,
      cultureBuildingWeight: 2.75,
      wonderWeight: 2.2
    }
  };
  var AI_STRATEGIES = [
    BASELINE_AI_STRATEGY,
    BALANCED_AI_STRATEGY,
    EXPANSIONIST_AI_STRATEGY,
    DEFENSIVE_AI_STRATEGY,
    AGGRESSIVE_AI_STRATEGY,
    ECONOMIC_AI_STRATEGY,
    CULTURAL_DOMINANCE_AI_STRATEGY
  ];

  // src/data/aiNationalAgendas.ts
  var BALANCED_AGENDA_ID = "balanced";
  var BALANCED_AGENDA = {
    id: BALANCED_AGENDA_ID,
    name: "Balanced",
    description: "Keeps a flexible posture without strong long-term bias.",
    strategyBias: {
      [BALANCED_AI_STRATEGY_ID]: 10
    }
  };
  var GROWTH_AGENDA = {
    id: "growth",
    name: "Growth",
    description: "Prioritizes city development, food, and production.",
    strategyBias: {
      [BALANCED_AI_STRATEGY_ID]: 10,
      [ECONOMIC_AI_STRATEGY_ID]: 10,
      [EXPANSIONIST_AI_STRATEGY_ID]: 5
    }
  };
  var CULTURE_AGENDA = {
    id: "culture",
    name: "Culture",
    description: "Prioritizes stability, culture, happiness, and peaceful development.",
    strategyBias: {
      [CULTURAL_DOMINANCE_AI_STRATEGY_ID]: 20,
      [BALANCED_AI_STRATEGY_ID]: 5,
      [ECONOMIC_AI_STRATEGY_ID]: 5,
      [DEFENSIVE_AI_STRATEGY_ID]: 5
    }
  };
  var ECONOMIC_AGENDA = {
    id: "economic",
    name: "Economic",
    description: "Prioritizes gold, production, and infrastructure.",
    strategyBias: {
      [ECONOMIC_AI_STRATEGY_ID]: 20,
      [BALANCED_AI_STRATEGY_ID]: 5
    }
  };
  var MILITARY_POWER_AGENDA = {
    id: "military_power",
    name: "Military Power",
    description: "Seeks military dominance and tolerates conflict.",
    strategyBias: {
      [AGGRESSIVE_AI_STRATEGY_ID]: 20,
      [EXPANSIONIST_AI_STRATEGY_ID]: 10
    }
  };
  var EXPANSIONIST_AGENDA = {
    id: "expansionist",
    name: "Expansionist",
    description: "Wants many cities and broad territorial growth.",
    strategyBias: {
      [EXPANSIONIST_AI_STRATEGY_ID]: 20,
      [AGGRESSIVE_AI_STRATEGY_ID]: 5,
      [ECONOMIC_AI_STRATEGY_ID]: 5
    }
  };
  var NAVAL_POWER_AGENDA = {
    id: "naval_power",
    name: "Naval Power",
    description: "Prioritizes coasts, fleets, and sea control.",
    strategyBias: {
      [BALANCED_AI_STRATEGY_ID]: 5,
      [AGGRESSIVE_AI_STRATEGY_ID]: 5,
      [ECONOMIC_AI_STRATEGY_ID]: 5
    }
  };
  var ISOLATIONIST_AGENDA = {
    id: "isolationist",
    name: "Isolationist",
    description: "Prefers security, controlled borders, and low conflict risk.",
    strategyBias: {
      [DEFENSIVE_AI_STRATEGY_ID]: 20,
      [ECONOMIC_AI_STRATEGY_ID]: 5
    }
  };
  var HOMELAND_DEFENSE_AGENDA = {
    id: "homeland_defense",
    name: "Homeland Defense",
    description: "Defends the homeland fiercely, opposes runaway empires, builds military strength, and punishes nearby aggressors rather than chasing endless expansion.",
    strategyBias: {
      // Defensive resilience is the core identity; a real military edge to punish
      // aggressors; a touch of balance so it is not a pure turtle.
      [DEFENSIVE_AI_STRATEGY_ID]: 20,
      [AGGRESSIVE_AI_STRATEGY_ID]: 8,
      [BALANCED_AI_STRATEGY_ID]: 5
    }
  };
  var FRANCE_LIBRE_AGENDA = {
    id: "france_libre",
    name: "France Libre",
    description: "Defends national sovereignty, respects states that maintain their independence, and distrusts powers that bully or subordinate weaker nations.",
    strategyBias: {
      [DEFENSIVE_AI_STRATEGY_ID]: 25,
      [BALANCED_AI_STRATEGY_ID]: 8,
      [AGGRESSIVE_AI_STRATEGY_ID]: 5
    }
  };
  var NEW_ROMAN_EMPIRE_AGENDA = {
    id: "new_roman_empire",
    name: "New Roman Empire",
    description: "Seeks military prestige, territorial influence, national strength, and recognition as a major power, while preferring opportunities that promise a favorable victory.",
    strategyBias: {
      [EXPANSIONIST_AI_STRATEGY_ID]: 18,
      [AGGRESSIVE_AI_STRATEGY_ID]: 12,
      [BALANCED_AI_STRATEGY_ID]: 5
    }
  };
  var POLAND_SHALL_ENDURE_AGENDA = {
    id: "poland_shall_endure",
    name: "Poland Shall Endure",
    description: "Protects sovereignty through military preparedness, dependable alliances, resistance to aggression, and respect for nations that honor their commitments.",
    strategyBias: {
      [DEFENSIVE_AI_STRATEGY_ID]: 24,
      [BALANCED_AI_STRATEGY_ID]: 10,
      [AGGRESSIVE_AI_STRATEGY_ID]: 5
    }
  };
  var AI_NATIONAL_AGENDAS = [
    BALANCED_AGENDA,
    GROWTH_AGENDA,
    CULTURE_AGENDA,
    ECONOMIC_AGENDA,
    MILITARY_POWER_AGENDA,
    EXPANSIONIST_AGENDA,
    NAVAL_POWER_AGENDA,
    ISOLATIONIST_AGENDA,
    HOMELAND_DEFENSE_AGENDA,
    FRANCE_LIBRE_AGENDA,
    NEW_ROMAN_EMPIRE_AGENDA,
    POLAND_SHALL_ENDURE_AGENDA
  ];

  // src/data/aiStrategyBehaviorWeights.ts
  var BALANCED_BEHAVIOR_WEIGHTS = {
    exploration: 1,
    diplomacy: 1,
    trade: 1,
    aggression: 1,
    defense: 1
  };
  var AI_STRATEGY_BEHAVIOR_WEIGHTS = {
    [BASELINE_AI_STRATEGY_ID]: BALANCED_BEHAVIOR_WEIGHTS,
    [BALANCED_AI_STRATEGY_ID]: BALANCED_BEHAVIOR_WEIGHTS,
    [ECONOMIC_AI_STRATEGY_ID]: {
      exploration: 1,
      diplomacy: 1,
      trade: 2,
      aggression: 0,
      defense: 1
    },
    [EXPANSIONIST_AI_STRATEGY_ID]: {
      exploration: 2,
      diplomacy: 0,
      trade: 1,
      aggression: 1,
      defense: 0
    },
    [DEFENSIVE_AI_STRATEGY_ID]: {
      exploration: 0,
      diplomacy: 1,
      trade: 1,
      aggression: 0,
      defense: 2
    },
    [AGGRESSIVE_AI_STRATEGY_ID]: {
      exploration: 1,
      diplomacy: 0,
      trade: 0,
      aggression: 2,
      defense: 1
    },
    [CULTURAL_DOMINANCE_AI_STRATEGY_ID]: {
      exploration: 2,
      diplomacy: 2,
      trade: 1,
      aggression: 0,
      defense: 1
    }
  };

  // src/data/aiLeaderEraStrategies.ts
  var NEUTRAL_PRODUCTION = {
    settler: 1,
    scout: 1,
    military: 1,
    melee: 1,
    ranged: 1,
    naval: 1,
    foodBuilding: 1,
    productionBuilding: 1,
    goldBuilding: 1,
    happinessBuilding: 1,
    wonder: 1
  };
  var NEUTRAL_RESEARCH = {
    food: 1,
    production: 1,
    military: 1,
    naval: 1,
    economy: 1,
    science: 1,
    expansion: 1
  };
  var NEUTRAL_CULTURE = {
    expansion: 1,
    diplomacy: 1,
    military: 1,
    happiness: 1,
    economy: 1
  };
  var NEUTRAL_DIPLOMACY = {
    openBorders: 1,
    embassy: 1,
    trade: 1,
    war: 1
  };
  var NEUTRAL_MILITARY = {
    prepareForWar: false,
    targetWeakNeighbor: false,
    preferCapitalTargets: false,
    minimumMilitaryReadiness: 1
  };
  var FRONTIER_EXPANSION_STRATEGY = {
    id: "frontierExpansion",
    name: "Frontier Expansion",
    description: "Early foundation strategy focused on founding cities, scouting territory, securing resources, and staying stable before later military escalation.",
    productionWeights: {
      settler: 1.35,
      scout: 1.25,
      military: 0.9,
      melee: 0.9,
      ranged: 1,
      naval: 0.8,
      foodBuilding: 1,
      productionBuilding: 1,
      goldBuilding: 1,
      happinessBuilding: 1,
      wonder: 0.8
    },
    researchWeights: {
      food: 1.15,
      production: 1.05,
      military: 0.9,
      naval: 0.8,
      economy: 1,
      science: 1,
      expansion: 1.25
    },
    cultureWeights: {
      expansion: 1.3,
      diplomacy: 1,
      military: 0.9,
      happiness: 1,
      economy: 1
    },
    diplomacyWeights: {
      openBorders: 1,
      embassy: 1,
      trade: 1,
      war: 0.35
    },
    militaryBehavior: {
      prepareForWar: false,
      targetWeakNeighbor: false,
      preferCapitalTargets: false,
      minimumMilitaryReadiness: 0.8
    },
    foundingPreferences: {
      strategicResource: 1.4,
      luxuryResource: 1,
      coastalAccess: 0.6,
      waterResource: 0.8,
      foodYield: 1,
      productionYield: 1.2,
      distancePenalty: 0.8
    }
  };
  var COASTAL_FOUNDATION_STRATEGY = {
    id: "coastalFoundation",
    name: "Coastal Foundation",
    description: "Ancient coastal expansion strategy focused on locating coastlines, founding cities near water, preparing for Sailing, and enabling later naval recon/work boat play.",
    productionWeights: {
      settler: 1.25,
      scout: 1.1,
      military: 0.85,
      melee: 0.85,
      ranged: 0.95,
      naval: 1.2,
      foodBuilding: 1,
      productionBuilding: 1,
      goldBuilding: 1.05,
      happinessBuilding: 1,
      wonder: 0.9
    },
    researchWeights: {
      food: 1,
      production: 1,
      military: 0.8,
      naval: 1.6,
      economy: 1.1,
      science: 1,
      expansion: 1.2
    },
    cultureWeights: {
      expansion: 1.2,
      diplomacy: 1,
      military: 0.8,
      happiness: 1,
      economy: 1
    },
    diplomacyWeights: {
      openBorders: 1,
      embassy: 1,
      trade: 1,
      war: 0.35
    },
    militaryBehavior: {
      prepareForWar: false,
      targetWeakNeighbor: false,
      preferCapitalTargets: false,
      minimumMilitaryReadiness: 0.8
    },
    foundingPreferences: {
      strategicResource: 0.8,
      luxuryResource: 1.1,
      coastalAccess: 2,
      waterResource: 1.6,
      foodYield: 1.1,
      productionYield: 1,
      distancePenalty: 0.8
    },
    foundingRules: {
      minCityDistance: 6
    },
    resourcePriorities: {
      seaResourceExploitation: 1.8,
      workBoatProduction: 1.6
    }
  };
  var COASTAL_TECH_ECONOMY_STRATEGY = {
    ...COASTAL_FOUNDATION_STRATEGY,
    id: "coastalTechEconomy",
    name: "Coastal Tech Economy",
    description: "Compact coastal development strategy layered on Coastal Foundation, focused on science, trade, food, sea resources, and defensive economic growth.",
    productionWeights: {
      ...COASTAL_FOUNDATION_STRATEGY.productionWeights,
      settler: 0.95,
      military: 0.65,
      melee: 0.65,
      ranged: 0.9,
      naval: 1,
      foodBuilding: 1.35,
      productionBuilding: 1.1,
      scienceBuilding: 1.55,
      goldBuilding: 1.45,
      happinessBuilding: 1.25,
      wonder: 0.85,
      worker: 1.15,
      workBoat: 1.65
    },
    researchWeights: {
      ...COASTAL_FOUNDATION_STRATEGY.researchWeights,
      food: 1.25,
      production: 1,
      military: 0.6,
      naval: 1.35,
      economy: 1.45,
      science: 1.6,
      expansion: 0.95
    },
    cultureWeights: {
      ...COASTAL_FOUNDATION_STRATEGY.cultureWeights,
      expansion: 0.9,
      diplomacy: 1.15,
      military: 0.55,
      happiness: 1.2,
      economy: 1.35
    },
    diplomacyWeights: {
      ...COASTAL_FOUNDATION_STRATEGY.diplomacyWeights,
      openBorders: 1.05,
      embassy: 1.1,
      trade: 1.3,
      war: 0.2
    },
    militaryBehavior: {
      ...COASTAL_FOUNDATION_STRATEGY.militaryBehavior,
      minimumMilitaryReadiness: 0.9
    },
    foundingPreferences: {
      ...COASTAL_FOUNDATION_STRATEGY.foundingPreferences,
      strategicResource: 0.75,
      luxuryResource: 1.15,
      coastalAccess: 1.85,
      waterResource: 1.9,
      foodYield: 1.4,
      productionYield: 0.95,
      distancePenalty: 1.2
    },
    foundingRules: {
      minCityDistance: 7
    },
    resourcePriorities: {
      ...COASTAL_FOUNDATION_STRATEGY.resourcePriorities,
      seaResourceExploitation: 2.25,
      workBoatProduction: 2.05
    },
    tilePurchase: {
      minGoldReserve: 110,
      minScore: 55
    },
    happinessBehavior: {
      stabilizationThreshold: 4,
      criticalThreshold: 0
    }
  };
  var TALL_GROWTH_STRATEGY = {
    id: "tallGrowth",
    name: "Tall Growth",
    description: "Peaceful tall-growth strategy focused on population, production, happiness stability, active workers, and selective tile purchases.",
    productionWeights: {
      settler: 0.85,
      scout: 0.85,
      military: 0.35,
      melee: 0.35,
      ranged: 0.45,
      naval: 0.45,
      foodBuilding: 1.6,
      productionBuilding: 1.5,
      goldBuilding: 1.15,
      happinessBuilding: 1.8,
      wonder: 0.75,
      worker: 1.8,
      workBoat: 1.3
    },
    researchWeights: {
      food: 1.4,
      production: 1.35,
      military: 0.45,
      naval: 0.75,
      economy: 1.2,
      science: 1,
      expansion: 0.9
    },
    cultureWeights: {
      expansion: 0.9,
      diplomacy: 1.15,
      military: 0.35,
      happiness: 1.6,
      economy: 1.2
    },
    diplomacyWeights: {
      openBorders: 1.2,
      embassy: 1.2,
      trade: 1.3,
      war: 0.15
    },
    militaryBehavior: {
      prepareForWar: false,
      targetWeakNeighbor: false,
      preferCapitalTargets: false,
      minimumMilitaryReadiness: 0.65
    },
    foundingPreferences: {
      strategicResource: 0.8,
      luxuryResource: 1.4,
      coastalAccess: 0.7,
      waterResource: 0.9,
      foodYield: 1.6,
      productionYield: 1.45,
      distancePenalty: 1
    },
    resourcePriorities: {
      workBoatProduction: 1.3
    },
    tilePurchase: {
      minGoldReserve: 100,
      minScore: 45
    },
    happinessBehavior: {
      stabilizationThreshold: 5,
      criticalThreshold: 0
    }
  };
  var CULTURAL_DOMINANCE_ERA_STRATEGY = {
    id: "culturalDominance",
    name: "Cultural Dominance",
    description: "France test profile focused on culture buildings, World Wonders, beautiful settlement sites, diplomacy, and long-range cultural sphere growth.",
    productionWeights: {
      settler: 1.15,
      scout: 1.25,
      military: 0.35,
      melee: 0.3,
      ranged: 0.55,
      naval: 0.45,
      foodBuilding: 1,
      productionBuilding: 0.85,
      scienceBuilding: 1,
      cultureBuilding: 4,
      goldBuilding: 0.8,
      happinessBuilding: 1.25,
      wonder: 4.25,
      worker: 1.15,
      workBoat: 1
    },
    cityFocusRules: {
      primaryCityFocus: "cultural",
      largeCityPopulationThreshold: 10
    },
    researchWeights: {
      food: 0.95,
      production: 0.95,
      military: 0.45,
      naval: 0.75,
      economy: 1,
      science: 1.15,
      expansion: 1.1,
      culture: 1.85,
      wonder: 1.9
    },
    cultureWeights: {
      expansion: 1.35,
      diplomacy: 1.35,
      military: 0.35,
      happiness: 1.25,
      economy: 1
    },
    diplomacyWeights: {
      openBorders: 1.35,
      embassy: 1.35,
      trade: 1.15,
      war: 0.15
    },
    militaryBehavior: {
      prepareForWar: false,
      targetWeakNeighbor: false,
      preferCapitalTargets: false,
      minimumMilitaryReadiness: 0.65
    },
    foundingPreferences: {
      strategicResource: 0.65,
      luxuryResource: 1.4,
      coastalAccess: 0.75,
      waterResource: 0.9,
      naturalWonder: 3,
      cultureYield: 2.35,
      foodYield: 1.05,
      productionYield: 0.9,
      distancePenalty: 0.7
    },
    foundingRules: {
      minCityDistance: 7
    },
    tilePurchase: {
      minGoldReserve: 125,
      minScore: 50
    },
    happinessBehavior: {
      stabilizationThreshold: 3,
      criticalThreshold: -1
    }
  };
  var IMPERIAL_INFRASTRUCTURE_STRATEGY = {
    id: "imperialInfrastructure",
    name: "Imperial Infrastructure",
    description: "Structured imperial development strategy focused on controlled expansion, production, workers, science, infrastructure, and defensive readiness.",
    productionWeights: {
      settler: 1.15,
      scout: 1,
      military: 0.85,
      melee: 0.9,
      ranged: 1.05,
      naval: 0.75,
      foodBuilding: 1.1,
      productionBuilding: 1.55,
      goldBuilding: 1.15,
      happinessBuilding: 1.15,
      wonder: 1.1,
      worker: 1.45,
      workBoat: 0.8
    },
    researchWeights: {
      food: 1.05,
      production: 1.45,
      military: 0.9,
      naval: 0.65,
      economy: 1.2,
      science: 1.35,
      expansion: 1.1
    },
    cultureWeights: {
      expansion: 1.15,
      diplomacy: 0.85,
      military: 0.8,
      happiness: 1.05,
      economy: 1.25
    },
    diplomacyWeights: {
      openBorders: 0.8,
      embassy: 1,
      trade: 1.15,
      war: 0.45
    },
    militaryBehavior: {
      prepareForWar: false,
      targetWeakNeighbor: false,
      preferCapitalTargets: false,
      minimumMilitaryReadiness: 1.05
    },
    foundingPreferences: {
      strategicResource: 1.25,
      luxuryResource: 1.05,
      coastalAccess: 0.55,
      waterResource: 0.65,
      foodYield: 1.15,
      productionYield: 1.55,
      distancePenalty: 1.15
    },
    foundingRules: {
      minCityDistance: 8
    },
    tilePurchase: {
      minGoldReserve: 125,
      minScore: 60
    },
    happinessBehavior: {
      stabilizationThreshold: 3,
      criticalThreshold: 0
    }
  };
  var BALANCED_GROWTH_STRATEGY = {
    id: "balancedGrowth",
    name: "Balanced Growth",
    description: "Neutral baseline. No category is pushed; existing AI scoring is preserved.",
    productionWeights: { ...NEUTRAL_PRODUCTION },
    researchWeights: { ...NEUTRAL_RESEARCH },
    cultureWeights: { ...NEUTRAL_CULTURE },
    diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
    militaryBehavior: { ...NEUTRAL_MILITARY }
  };
  var MILITARY_PREPARATION_STRATEGY = {
    id: "militaryPreparation",
    name: "Military Preparation",
    description: "Builds production capacity and a large combined-arms force before exploiting favorable military opportunities.",
    productionWeights: {
      settler: 1.05,
      scout: 0.9,
      military: 1.65,
      melee: 1.3,
      ranged: 1.25,
      naval: 0.75,
      foodBuilding: 0.9,
      productionBuilding: 1.4,
      scienceBuilding: 0.9,
      cultureBuilding: 0.5,
      goldBuilding: 0.85,
      happinessBuilding: 1,
      wonder: 0.45,
      worker: 1.15,
      workBoat: 0.75
    },
    researchWeights: {
      food: 0.9,
      production: 1.4,
      military: 1.6,
      naval: 0.75,
      economy: 1,
      science: 0.9,
      expansion: 1.25
    },
    cultureWeights: {
      expansion: 1.3,
      diplomacy: 0.45,
      military: 1.7,
      happiness: 0.9,
      economy: 1
    },
    diplomacyWeights: {
      openBorders: 0.55,
      embassy: 0.5,
      trade: 0.75,
      war: 1.35
    },
    militaryBehavior: {
      prepareForWar: true,
      targetWeakNeighbor: true,
      preferCapitalTargets: false,
      minimumMilitaryReadiness: 1.35
    },
    cityFocusRules: {
      primaryCityFocus: "military",
      largeCityPopulationThreshold: 8
    },
    foundingPreferences: {
      strategicResource: 1.5,
      luxuryResource: 0.8,
      coastalAccess: 0.7,
      waterResource: 0.75,
      foodYield: 0.95,
      productionYield: 1.5,
      distancePenalty: 0.9
    },
    happinessBehavior: {
      stabilizationThreshold: -2,
      criticalThreshold: -6
    }
  };
  var CONQUEST_CAMPAIGN_STRATEGY = {
    id: "conquestCampaign",
    name: "Conquest Campaign",
    description: "Placeholder \u2014 active offensive posture targeting weak neighbors.",
    productionWeights: { ...NEUTRAL_PRODUCTION },
    researchWeights: { ...NEUTRAL_RESEARCH },
    cultureWeights: { ...NEUTRAL_CULTURE },
    diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
    militaryBehavior: { ...NEUTRAL_MILITARY }
  };
  var DEFENSIVE_BUILDER_STRATEGY = {
    id: "defensiveBuilder",
    name: "Defensive Builder",
    description: "Maintains a prepared defensive army, productive infrastructure, stable borders, and dependable diplomatic partnerships.",
    productionWeights: {
      settler: 0.9,
      scout: 1,
      military: 1.35,
      melee: 1.15,
      ranged: 1.3,
      naval: 0.8,
      foodBuilding: 1,
      productionBuilding: 1.25,
      scienceBuilding: 1,
      cultureBuilding: 0.9,
      goldBuilding: 1,
      happinessBuilding: 1.15,
      wonder: 0.7,
      worker: 1.1,
      workBoat: 0.8
    },
    researchWeights: {
      food: 1,
      production: 1.2,
      military: 1.3,
      naval: 0.8,
      economy: 1,
      science: 1,
      expansion: 0.85
    },
    cultureWeights: {
      expansion: 0.8,
      diplomacy: 1.35,
      military: 1.3,
      happiness: 1.15,
      economy: 1
    },
    diplomacyWeights: {
      openBorders: 1.2,
      embassy: 1.4,
      trade: 1.15,
      war: 0.8
    },
    militaryBehavior: {
      prepareForWar: true,
      targetWeakNeighbor: false,
      preferCapitalTargets: false,
      minimumMilitaryReadiness: 1.2
    },
    foundingPreferences: {
      strategicResource: 1.3,
      luxuryResource: 0.9,
      coastalAccess: 0.75,
      waterResource: 0.85,
      foodYield: 1,
      productionYield: 1.25,
      distancePenalty: 1.1
    },
    happinessBehavior: {
      stabilizationThreshold: 2,
      criticalThreshold: -2
    }
  };
  var NAVAL_EXPANSION_STRATEGY = {
    id: "navalExpansion",
    name: "Naval Expansion",
    description: "Placeholder \u2014 emphasizes maritime reach and overseas presence.",
    productionWeights: { ...NEUTRAL_PRODUCTION },
    researchWeights: { ...NEUTRAL_RESEARCH },
    cultureWeights: { ...NEUTRAL_CULTURE },
    diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
    militaryBehavior: { ...NEUTRAL_MILITARY }
  };
  var SCIENTIFIC_DEVELOPMENT_STRATEGY = {
    id: "scientificDevelopment",
    name: "Scientific Development",
    description: "Placeholder \u2014 biases toward research output and science infrastructure.",
    productionWeights: { ...NEUTRAL_PRODUCTION },
    researchWeights: { ...NEUTRAL_RESEARCH },
    cultureWeights: { ...NEUTRAL_CULTURE },
    diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
    militaryBehavior: { ...NEUTRAL_MILITARY }
  };
  var CIVIC_DEVELOPMENT_STRATEGY = {
    id: "civicDevelopment",
    name: "Civic Development",
    description: "Placeholder \u2014 biases toward culture, happiness, and civic policies.",
    productionWeights: { ...NEUTRAL_PRODUCTION },
    researchWeights: { ...NEUTRAL_RESEARCH },
    cultureWeights: { ...NEUTRAL_CULTURE },
    diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
    militaryBehavior: { ...NEUTRAL_MILITARY }
  };
  var SEA_WOLF_STRATEGY = {
    id: "seaWolf",
    name: "Sea Wolf",
    description: "Aggressive one-port naval-raider strategy: explore coastlines, exploit every sea resource, and flood the oceans with warships and Privateers while neglecting territory, culture, and wonders.",
    productionWeights: {
      settler: 0.1,
      scout: 1.3,
      military: 1.2,
      melee: 0.55,
      ranged: 0.6,
      naval: 2.4,
      foodBuilding: 1,
      productionBuilding: 1.1,
      scienceBuilding: 0.85,
      cultureBuilding: 0.4,
      goldBuilding: 1.25,
      happinessBuilding: 1,
      wonder: 0.25,
      worker: 0.9,
      workBoat: 2
    },
    researchWeights: {
      food: 0.9,
      production: 1,
      military: 1.1,
      naval: 2.2,
      economy: 1.2,
      science: 0.85,
      expansion: 0.7,
      culture: 0.4,
      wonder: 0.35
    },
    cultureWeights: {
      expansion: 0.7,
      diplomacy: 0.6,
      military: 1.2,
      happiness: 1,
      economy: 1.2
    },
    diplomacyWeights: {
      openBorders: 0.8,
      embassy: 0.7,
      trade: 1,
      war: 1.4
    },
    militaryBehavior: {
      prepareForWar: true,
      targetWeakNeighbor: true,
      preferCapitalTargets: false,
      minimumMilitaryReadiness: 1.2
    },
    foundingPreferences: {
      strategicResource: 0.8,
      luxuryResource: 1,
      coastalAccess: 2.5,
      waterResource: 2.2,
      foodYield: 1,
      productionYield: 1,
      distancePenalty: 0.6
    },
    resourcePriorities: {
      seaResourceExploitation: 2.5,
      workBoatProduction: 2.2
    }
  };
  var ALL_AI_LEADER_ERA_STRATEGIES = [
    FRONTIER_EXPANSION_STRATEGY,
    COASTAL_FOUNDATION_STRATEGY,
    COASTAL_TECH_ECONOMY_STRATEGY,
    TALL_GROWTH_STRATEGY,
    IMPERIAL_INFRASTRUCTURE_STRATEGY,
    BALANCED_GROWTH_STRATEGY,
    MILITARY_PREPARATION_STRATEGY,
    CONQUEST_CAMPAIGN_STRATEGY,
    DEFENSIVE_BUILDER_STRATEGY,
    NAVAL_EXPANSION_STRATEGY,
    SCIENTIFIC_DEVELOPMENT_STRATEGY,
    CIVIC_DEVELOPMENT_STRATEGY,
    CULTURAL_DOMINANCE_ERA_STRATEGY,
    SEA_WOLF_STRATEGY
  ];
  var LEADER_ERA_STRATEGY_PROFILES = [
    {
      leaderId: "leader_charles_vii",
      strategiesByEra: {
        ancient: "culturalDominance"
      }
    },
    {
      leaderId: "leader_genghis-khan",
      strategiesByEra: {
        ancient: "frontierExpansion"
      }
    },
    {
      leaderId: "leader_adolf_hitler",
      strategiesByEra: {
        ancient: "militaryPreparation"
      }
    },
    {
      leaderId: "leader_benito_mussolini",
      strategiesByEra: {
        ancient: "militaryPreparation"
      }
    },
    {
      leaderId: "leader_wladyslaw_sikorski",
      strategiesByEra: {
        ancient: "defensiveBuilder"
      }
    },
    {
      leaderId: "leader_oda-nobunaga",
      strategiesByEra: {
        ancient: "coastalFoundation"
      }
    },
    {
      leaderId: "leader_mahatma-gandhi",
      strategiesByEra: {
        ancient: "tallGrowth"
      }
    },
    {
      leaderId: "leader_qin-shi-huang",
      strategiesByEra: {
        ancient: "imperialInfrastructure"
      }
    },
    {
      leaderId: "leader_koxinga",
      strategiesByEra: {
        ancient: "coastalTechEconomy"
      }
    },
    {
      leaderId: "leader_gustav_vasa",
      strategiesByEra: {
        ancient: "coastalTechEconomy"
      }
    },
    {
      leaderId: "leader_henry_v",
      strategiesByEra: {
        ancient: "coastalFoundation"
      }
    },
    {
      // Mad Jack runs the Sea Wolf posture across every era; the era progression
      // itself supplies the phases (explore → naval economy → Privateer raids).
      leaderId: "leader_mad_jack",
      strategiesByEra: {
        ancient: "seaWolf"
      }
    }
  ];

  // src/data/gamesOfNationsSports.ts
  var IMAGE_ROOT = "/assets/sprites/news/games-of-nations/";
  var GAMES_OF_NATIONS_SPORT_DEFINITIONS = [
    { id: "wrestling", name: "Wrestling", category: "traditional", image: `${IMAGE_ROOT}wrestling.jpg` },
    { id: "marathon", name: "Marathon", category: "traditional", image: `${IMAGE_ROOT}marathon.jpg` },
    { id: "swimming", name: "Swimming", category: "traditional", image: `${IMAGE_ROOT}swimming.jpg` },
    { id: "javelin", name: "Javelin", category: "traditional", image: `${IMAGE_ROOT}javelin.jpg` },
    { id: "long_jump", name: "Long Jump", category: "traditional", image: `${IMAGE_ROOT}long-jump.jpg` },
    { id: "horse_racing", name: "Horse Racing", category: "additional", image: `${IMAGE_ROOT}horse-racing.jpg` },
    { id: "boxing", name: "Boxing", category: "additional", image: `${IMAGE_ROOT}boxing.jpg` },
    { id: "hundred_metres", name: "100 Metres", category: "additional", image: `${IMAGE_ROOT}hundred-metres.jpg` },
    { id: "pole_vault", name: "Pole Vault", category: "additional", image: `${IMAGE_ROOT}pole-vault.jpg` },
    { id: "fencing", name: "Fencing", category: "additional", image: `${IMAGE_ROOT}fencing.jpg` }
  ];
  var TRADITIONAL_GAMES_SPORTS = GAMES_OF_NATIONS_SPORT_DEFINITIONS.filter((sport) => sport.category === "traditional");
  var ADDITIONAL_GAMES_SPORTS = GAMES_OF_NATIONS_SPORT_DEFINITIONS.filter((sport) => sport.category === "additional");
  var TRADITIONAL_GAMES_SPORT_IDS = TRADITIONAL_GAMES_SPORTS.map((sport) => sport.id);
  var ADDITIONAL_GAMES_SPORT_IDS = ADDITIONAL_GAMES_SPORTS.map((sport) => sport.id);
  var ALL_GAMES_SPORTS = GAMES_OF_NATIONS_SPORT_DEFINITIONS.map((sport) => sport.name);
  var BY_ID2 = new Map(GAMES_OF_NATIONS_SPORT_DEFINITIONS.map((sport) => [sport.id, sport]));
  var BY_NAME = new Map(GAMES_OF_NATIONS_SPORT_DEFINITIONS.map((sport) => [sport.name, sport]));

  // src/data/leaderWarDeclarations.ts
  var LEADER_WAR_DECLARATIONS = {
    leader_henry_v: {
      conquest: ["Your defenses invite a campaign, and I intend to finish it decisively.", "The field is prepared and your realm lies before us. England marches."],
      hostility: ["Your offenses have exhausted the patience of my crown. We shall answer them in battle.", "You have chosen defiance at every turn. Let arms now settle what words could not."],
      threat: ["Your growing host leaves England no safe course but action. We strike before you are ready.", "I will not wait while your armies gather against us. The danger ends now."],
      ideological: ["Your rule stands against the order we defend. England will oppose it by force.", "Our principles can no longer share the same peace. The sword must judge between them."],
      ambition: ["A king who hesitates loses both honor and opportunity. England advances.", "History rewards resolve, not caution. I claim this hour for England."]
    },
    leader_charles_vii: {
      conquest: ["Your weakness threatens the balance of the realm. France will restore order under its own banner.", "The lands between us require firmer stewardship. France will provide it."],
      hostility: ["Every avenue of reconciliation has been spoiled by your conduct. France now takes up arms.", "You have turned courtesy into contempt and patience into folly. This quarrel ends in war."],
      threat: ["Your preparations leave my kingdom exposed. I act now because delay would endanger France.", "France cannot remain still while your power gathers at our frontier. Necessity compels us."],
      ideological: ["The order you impose is incompatible with the dignity of our realm. France will resist it.", "Your principles corrupt peace itself. We must oppose them before they spread further."],
      ambition: ["France must recover the authority that caution has surrendered. Our armies will secure it.", "The crown cannot be restored by ceremony alone. France now asserts its place by force."]
    },
    leader_charles_de_gaulle: {
      conquest: ["France does not seek dominion, but this position can no longer remain in hands that endanger our independence.", "Strategic necessity requires us to secure this ground. France will take it and answer for the decision herself."],
      hostility: ["You have answered French independence with pressure and contempt. France will now answer with arms.", "Every attempt at honorable relations has met another demand for submission. France refuses, and France fights."],
      threat: ["Your military preparations leave France no safe future in waiting. We shall resist before resistance becomes impossible.", "No foreign power will be permitted to decide France\u2019s fate through intimidation. We act now to remain free."],
      ideological: ["Your system demands obedience where France insists upon sovereignty. Between those principles, there can be no surrender.", "France cannot accept an order in which nations exist only by another power\u2019s permission. We will oppose it."],
      ambition: ["France must stand among the powers that shape events, not among those who merely endure them. We shall act.", "National independence requires the will to use national strength. France now demonstrates that will."]
    },
    leader_sigismund: {
      conquest: ["Your lands have become a danger to imperial order. I will bring them beneath firmer authority.", "Where your rule has failed, imperial power must now prevail."],
      hostility: ["Council and compromise have answered every grievance but yours. You leave the Empire only war.", "You have rejected settlement and insulted imperial authority. The matter passes from council to battlefield."],
      threat: ["Your power now imperils every crown around you. The Empire will act before all are placed at your mercy.", "I would prefer judgment in council, but your armies permit no delay. We go to war."],
      ideological: ["Your doctrine divides the order I am sworn to preserve. It will be opposed by force.", "No council can reconcile principles that deny the foundations of the Empire. War is upon us."],
      ambition: ["An emperor must sometimes command where diplomacy cannot persuade. I will enlarge the peace by victory.", "The moment demands imperial resolve. Our banners will carry authority beyond these borders."]
    },
    leader_gustav_vasa: {
      conquest: ["Your frontier is exposed, and Sweden will not leave such an advantage unused.", "Sweden needs secure borders, not promises. We will take the ground required to defend them."],
      hostility: ["You have answered honest dealings with provocation. Sweden now answers with steel.", "Our patience was offered freely and abused repeatedly. There will be no further warning."],
      threat: ["Your strength grows too near Sweden for comfort. We will break the danger before it closes around us.", "I built Sweden to be independent, not vulnerable. Your preparations force our hand."],
      ideological: ["The rule you advance would make free nations dependent. Sweden rejects it with arms.", "Your principles threaten the order and independence of my kingdom. We will resist."],
      ambition: ["Sweden was not raised from weakness to stand idle. We now claim the position our strength deserves.", "A state is secured by decisive action. Sweden marches to shape its own future."]
    },
    leader_vytautas: {
      conquest: ["Your open frontier offers Lithuania room to grow and safety to gain. I will take both.", "The balance favors my riders and your lands lie within reach. Lithuania advances."],
      hostility: ["Your hostility has crossed every border before my army did. Now Lithuania answers.", "You have made enmity your policy. I will make war its consequence."],
      threat: ["Your power gathers along our horizon. Lithuania will ride before that storm can break.", "I will not permit your armies to choose the time and place. We strike first."],
      ideological: ["Your vision leaves no place for the realm I defend. Lithuania will contest it in battle.", "The order you demand is one we cannot accept. Our banners will answer yours."],
      ambition: ["Great realms are made by those who see beyond their present borders. Lithuania rides.", "Opportunity has opened the eastern road. I intend to follow it with an army."]
    },
    leader_marfa_boretskaya: {
      conquest: ["Your weakness endangers the roads and markets around us. Novgorod will secure them.", "Trade needs stable hands and guarded routes. Your territory will now provide both."],
      hostility: ["You have repaid negotiation with insult and commerce with obstruction. Novgorod has had enough.", "Our council sought peace long after you abandoned good faith. We now choose war."],
      threat: ["Your forces threaten the liberty of our city. We will meet them before they reach our gates.", "Novgorod will not wait to be surrounded. We act now to preserve our freedom."],
      ideological: ["Your rule would silence the liberties of our republic. Novgorod will resist it.", "We will not exchange civic freedom for your imposed order. Let arms defend our choice."],
      ambition: ["Novgorod must command the routes on which its future depends. We will secure them by force.", "A wealthy republic that cannot act will soon serve another. We act today."]
    },
    leader_mehmed_ii: {
      conquest: ["Your walls mark only the next boundary of my empire. They will fall.", "I have studied your defenses and chosen the hour. Your realm will be added to mine."],
      hostility: ["You have mistaken restraint for weakness and insulted my throne once too often. War begins.", "Every provocation has brought you closer to this judgment. My armies will deliver it."],
      threat: ["Your growing power obstructs the future of my empire. I will break it before it hardens.", "I do not wait for rivals to become invincible. We strike while victory is ours to command."],
      ideological: ["Your order denies the destiny of mine. The contest will now be decided by arms.", "Two visions claim this frontier, and they cannot both prevail. My army will decide."],
      ambition: ["The world remembers conquerors, not those who guarded yesterday. My empire advances.", "A throne proves its greatness by extending its reach. Today I prove mine."]
    },
    leader_isabella_i: {
      conquest: ["Your divided realm invites a stronger crown to restore order. We shall do so.", "Unity and security require lands your rule cannot hold. My armies will claim them."],
      hostility: ["You have rejected peace and dishonored every pledge. My crown now answers with war.", "Your offenses can no longer be forgiven without weakening the realm. Judgment comes by arms."],
      threat: ["Your power threatens the unity I have built. We will strike before you can divide us.", "I will not leave my kingdoms at the mercy of your preparations. War is now necessary."],
      ideological: ["Your beliefs stand against the sacred order of my realm. We will oppose them.", "There can be no lasting peace while your doctrine challenges the foundation of our crown."],
      ambition: ["A united crown must carry its purpose beyond old frontiers. We now advance.", "Providence favors resolve. My kingdoms will seize the future before others shape it for us."]
    },
    leader_abu_said_uthman_ii: {
      conquest: ["Your hold on these roads is weak. Morocco will secure the routes and the lands around them.", "The western trade paths require a stronger guardian. My armies will provide one."],
      hostility: ["You have poisoned commerce and friendship alike. Morocco will endure no more.", "Our patience crossed deserts to reach you, yet you answered only with hostility. War follows."],
      threat: ["Your preparations threaten our cities and caravans. We will move before you close the routes.", "Morocco cannot wait while danger gathers beyond its frontier. We strike to preserve our realm."],
      ideological: ["Your order leaves no honorable peace for ours. Morocco will defend its principles.", "The values you impose cannot pass unchallenged into our lands. We take up arms."],
      ambition: ["Morocco must command its own horizon. Our banners will travel with our caravans.", "Wealth without strength invites conquest. Today Morocco chooses strength and expansion."]
    },
    "leader_george-washington": {
      conquest: ["Your position threatens the security of our republic. We will seize the ground needed for a lasting peace.", "The frontier cannot remain in hands that endanger our people. Our army will secure it."],
      hostility: ["You have met every peaceful appeal with injury. We now take up arms with a clear conscience.", "Our patience was not submission. Your repeated offenses have made war unavoidable."],
      threat: ["Your military preparations place our liberty in immediate danger. We will act before it is too late.", "A free people need not wait for the first blow. We march to prevent it."],
      ideological: ["Your tyranny is incompatible with the liberty of our republic. We will resist it by force.", "We cannot preserve freedom while your system seeks to extinguish it. Our nations are at war."],
      ambition: ["The republic must secure its future with more than declarations. We will act decisively.", "Our nation has earned a place among powers, and we will defend that claim in battle."]
    },
    "leader_mahatma-gandhi": {
      conquest: ["I sought no territory by violence, yet your weakness now endangers millions. We act with sorrow, not triumph.", "This war is contrary to all I value, but leaving your misrule unchecked would bring greater suffering."],
      hostility: ["You have closed every peaceful path and answered restraint with cruelty. With profound regret, we resist by force.", "I cannot call this choice good, only necessary after every appeal has failed. War begins."],
      threat: ["Your armies place our people in immediate peril. We will act now to prevent a greater violence later.", "Nonviolence cannot require a nation to await destruction. We move because your threat leaves no safe alternative."],
      ideological: ["Your system denies the dignity and freedom of our people. We oppose it reluctantly but firmly.", "Peace cannot endure where human dignity is treated as weakness. We are compelled to resist."],
      ambition: ["I distrust ambition armed with soldiers, even our own. Yet the state has chosen this course, and I will demand restraint.", "This is not a war I celebrate. May its purpose be limited and its end come quickly."]
    },
    "leader_qin-shi-huang": {
      conquest: ["Your fragmented lands require order. They will be brought beneath one law and one authority.", "The map contains a disorder that my armies will correct. Your realm will be unified with mine."],
      hostility: ["Your defiance has outlived every warning. The state will now remove it.", "You have made disorder a policy. I will answer with the full discipline of the empire."],
      threat: ["Your forces disturb the security of the realm. They will be broken before they can advance.", "An emperor does not wait for danger to cross his walls. We strike now."],
      ideological: ["Your divided customs resist the order that secures civilization. One law will prevail.", "There cannot be two foundations for lasting rule. Yours will yield to mine."],
      ambition: ["All beneath heaven must know a single order. My armies continue that work.", "History is shaped by unification, not hesitation. The empire expands."]
    },
    leader_koxinga: {
      conquest: ["Your coast is exposed and your harbors command our future. We will take them.", "The sea has shown me the opening in your defenses. My fleet will widen it."],
      hostility: ["You have harried our ships and mocked every warning. The fleet now answers.", "Your conduct has turned disputed waters into a battlefield. We come prepared."],
      threat: ["Your fleet threatens our islands and trade. We will meet it before it reaches our shores.", "I will not allow you to close the sea around us. We strike to keep it open."],
      ideological: ["Your rule would extinguish the cause we carry across the sea. We will not submit.", "The loyalties that divide us admit no compromise. Our fleets will decide the matter."],
      ambition: ["Command of the sea belongs to those bold enough to claim it. We sail for victory.", "An island power must expand or be contained. I choose expansion."]
    },
    "leader_dom-pedro-ii": {
      conquest: ["Your weakness destabilizes our frontier. Brazil will establish the security you could not.", "The future of this continent requires firmer borders. Brazil will draw them."],
      hostility: ["I preferred reason, but you have made reason impossible. Brazil now goes to war.", "Your repeated provocations have defeated every attempt at accommodation. The responsibility is yours."],
      threat: ["Your military growth threatens the peace of our people. We must act before the balance is lost.", "I will not gamble Brazil\u2019s future on your restraint. Our forces move today."],
      ideological: ["Your political order stands against the institutions we mean to preserve. Brazil will oppose it.", "Our nations no longer dispute policy alone, but the principles of government. War follows."],
      ambition: ["Brazil must take its rightful place among the great nations. Reluctantly, we will prove our strength.", "Progress requires security and influence. Our armies will obtain what diplomacy could not."]
    },
    "leader_mansa-musa": {
      conquest: ["Your lands command routes that prosperity cannot leave unsecured. Mali will take responsibility for them.", "The roads of trade favor the strong. My army will place them under Mali\u2019s protection."],
      hostility: ["You have answered generosity with contempt and trade with obstruction. Mali now answers in force.", "Gold bought patience, but it cannot purchase honor from you. We go to war."],
      threat: ["Your armies threaten the cities and caravans of Mali. We will act before commerce becomes ruin.", "I will not wait while danger gathers along the roads that sustain our people."],
      ideological: ["Your principles would impoverish both spirit and society. Mali will defend its order.", "Our learning and faith cannot prosper beneath the rule you propose. We resist."],
      ambition: ["Mali\u2019s wealth must be matched by influence and strength. Our reach now expands.", "A great realm does not merely possess riches; it shapes the world around them. We march."]
    },
    "leader_genghis-khan": {
      conquest: ["Your army is weak and your lands are open. My riders will take both before sunset forgets your name.", "The steppe has no walls, and soon neither will your kingdom. The horde is coming."],
      hostility: ["You have insulted the Khan and broken faith with the Mongols. Your cities will answer for it.", "I offered you the peace of obedience. You chose the ruin of defiance."],
      threat: ["Your warriors gather as if the Khan were blind. I will scatter them before they can strike.", "A rival army grows only once beneath my sky. The horde rides now."],
      ideological: ["Your customs make you proud and divided. The law of the steppe will humble both.", "You cling to an order too weak to survive. The Mongols will replace it."],
      ambition: ["The sky is vast, and one will is enough beneath it. Mine.", "Every horizon calls to the horde. Your realm happens to stand beyond the next one."]
    },
    "leader_oda-nobunaga": {
      conquest: ["Your defenses belong to an age already ending. I will sweep them aside and unify what remains.", "I see the weakness in your formation and the prize beyond it. We attack."],
      hostility: ["You have mistaken discipline for patience without limit. I will now correct you by force.", "Your insolence has become an obstacle to unification. Obstacles are removed."],
      threat: ["Your armies gather while lesser rulers hesitate. I do not. We strike first.", "I will not permit an old rival to become a new master. Your strength ends here."],
      ideological: ["You cling to traditions that preserve division and weakness. I will break them with your armies.", "The future cannot coexist with the order you defend. Let battle choose the age that survives."],
      ambition: ["The realm will be remade by fire, discipline, and will. Today that work reaches you.", "Only decisive rulers shape history. I intend to leave it no doubt."]
    },
    "leader_christian-iv": {
      conquest: ["Your ports and provinces would prosper under a stronger crown. Denmark will claim them.", "The northern balance favors us. My fleet and army will turn advantage into territory."],
      hostility: ["You have made an enemy of a king who offered fair terms. Denmark now answers your choice.", "Every slight has been counted, and the account is due. We are at war."],
      threat: ["Your growing power casts too long a shadow across northern waters. Denmark will shorten it.", "I will not wait for your fleet to command our coasts. We sail and march now."],
      ideological: ["The order you champion threatens crown and kingdom alike. Denmark will oppose it.", "Your principles leave no secure peace for my realm. Our forces will settle the dispute."],
      ambition: ["Denmark was built for more than watching others divide the north. We make our claim.", "A builder-king must sometimes build with victories. This war will enlarge my legacy."]
    },
    leader_mad_jack: {
      conquest: ["Your coast is fat, your guard is thin, and my crews are bored. A perfect war.", "I have room in my hold and your ports have plenty to fill it. Here we come."],
      hostility: ["You have crossed Mad Jack once too often. Now I cross your border.", "No more letters, no more warnings. I am coming for your ships and everything behind them."],
      threat: ["That fleet of yours is getting far too large for my comfort. Best I sink it early.", "You look ready to hunt pirates. Bad luck\u2014I have decided to hunt you first."],
      ideological: ["You call it law; I call it chains with a fancy seal. My cannons vote against it.", "Your tidy little order has no place for free captains. We will make some room."],
      ambition: ["The sea deserves a legend, and I deserve a larger legend. Your shores will help.", "Why rule one harbor when I can plunder ten? Hoist the colors\u2014we are going to war."]
    },
    "hermann-the-cheruscan": {
      conquest: ["Your frontier is weak, and taking it will keep stronger empires from our forests. The tribes advance.", "The ground beyond our shields offers safety and strength. We will claim it."],
      hostility: ["You have pressed us as Rome once did. You will receive the same answer.", "Every warning was ignored and every boundary tested. Now the tribes rise against you."],
      threat: ["Your armies approach the freedom of our people. We strike before they enter our forests.", "We know what follows when an empire gathers at the frontier. This time, we meet it first."],
      ideological: ["No empire dictates the life of free tribes. We will break the order you seek to impose.", "Your rule demands submission; our freedom demands resistance. War decides between them."],
      ambition: ["The tribes have stood apart long enough. United, we will carry our strength beyond the forest.", "Freedom survives through strength, and strength must sometimes seize the initiative. We march."]
    },
    "ivan-iv": {
      conquest: ["I have measured your strength and found it wanting. The frontier will move at your expense.", "Your lands lie exposed before the Russian state. They will not remain yours for long."],
      hostility: ["Every insult has been remembered and every betrayal recorded. Russia now delivers judgment.", "You mistook my suspicion for uncertainty. I am certain now: you are an enemy to be crushed."],
      threat: ["Your power grows too near my throne. I will destroy it before it can turn against Russia.", "I trust neither your assurances nor your armies. We strike before your mask slips."],
      ideological: ["Your order challenges the authority on which Russia stands. It will be broken.", "There is no peace between your vision and my throne. One must submit, and it will not be Russia."],
      ambition: ["Russia does not ask history for room. It takes room and dares others to object.", "An empire that stops expanding begins to decay. I will permit neither."]
    },
    leader_joseph_stalin: {
      conquest: ["Your weakness has become a strategic liability. The Soviet state will secure the territory itself.", "The balance of forces is decisive. Our armies will advance and establish a new reality."],
      hostility: ["Your actions have made coexistence impossible. The full strength of the Soviet state will answer.", "We have recorded every provocation. The time for warnings is over; military operations begin."],
      threat: ["Your military preparations constitute an intolerable threat. We will eliminate it before you strike.", "We do not rely on an enemy\u2019s promises while its armies mobilize. The Soviet Union acts now."],
      ideological: ["Your system stands in irreconcilable opposition to ours. The conflict now enters its military phase.", "The struggle between our orders can no longer be contained by diplomacy. We are at war."],
      ambition: ["History does not wait for hesitant states. The Soviet Union will shape the balance by force.", "Our strength has created an opportunity that the state will not waste. The advance begins."]
    },
    leader_winston_churchill: {
      conquest: ["Your weakness has opened a danger that Britain must close. We shall take the ground and hold it.", "The strategic position cannot remain in uncertain hands. Britain will secure it."],
      hostility: ["You have exhausted argument, patience, and every honorable alternative. Britain will now fight.", "Your repeated provocations have made peace a disguise for surrender. We reject it."],
      threat: ["Your armaments and ambitions leave us no safe refuge in delay. We shall strike and we shall endure.", "Britain will not wait meekly for the blow you prepare. We enter this struggle with our eyes open."],
      ideological: ["Your tyranny cannot be accommodated without abandoning everything free nations defend. We are at war.", "Between your doctrine and our liberty there can be no lasting compromise. Britain will resist."],
      ambition: ["Britain does not seek glory cheaply, but neither will she surrender opportunity to the timid. We act.", "The hour calls for boldness, and history will not forgive hesitation. Britain goes forward."]
    },
    leader_adolf_hitler: {
      conquest: ["Your weakness has made the outcome inevitable. German forces will take what strategy requires.", "The balance of power is settled. Your territory now stands in the path of German expansion."],
      hostility: ["Relations between us have passed beyond repair. Germany will now answer your opposition with force.", "Every confrontation has confirmed that coexistence no longer serves German interests. War begins."],
      threat: ["Your military buildup threatens Germany\u2019s position. We will strike before you can use it against us.", "Waiting would hand you the strategic advantage. Germany will act first and remove the danger."],
      ideological: ["Our political orders cannot occupy the same future. Germany will impose the issue by force.", "The conflict between our systems can no longer be contained by diplomacy. We are at war."],
      ambition: ["Germany has the strength to reshape the balance of power, and it will now use it.", "History is decided by nations willing to act. Germany will seize this opportunity by force."]
    },
    leader_benito_mussolini: {
      conquest: [
        "Your weakness is plain, and Italy will not let such an opportunity pass. Our standards advance, and victory will enlarge our greatness.",
        "The balance of strength favors Italy. We shall take the ground your feeble defense can no longer command."
      ],
      hostility: [
        "You have answered Italian dignity with insult and obstruction. Before the world, Italy now answers your provocations with war.",
        "Your hostility has exhausted our patience and offended our national honor. The accusation is yours; the reply will be delivered by our armies."
      ],
      threat: [
        "You gather strength as though Italy would tremble and wait. We defy your threat and strike before it can overshadow our nation.",
        "Your preparations menace Italy, but intimidation will earn you no submission. We meet danger with steel and unbroken resolve."
      ],
      ideological: [
        "Your political order denies the authority, unity, and national purpose Italy represents. The contest between us will now be decided by force.",
        "Your principles stand against the disciplined greatness Italy demands. There can be no prestige in yielding to them, so we march."
      ],
      ambition: [
        "A great nation does not wait meekly for history to grant it stature. Italy seizes this hour, and the world shall witness our ascent.",
        "Italy was not made for a minor place among nations. Our strength is ready, our ambition is declared, and our armies move."
      ]
    },
    leader_wladyslaw_sikorski: {
      conquest: [
        "Your exposed position offers Poland a strategic advantage we cannot responsibly ignore. We will secure it with disciplined force.",
        "The balance now permits us to strengthen Poland\u2019s frontier at your expense. This is a calculated campaign, and our army is ready."
      ],
      hostility: [
        "You have broken trust, rejected restraint, and treated every commitment as expendable. Poland now answers your hostility with arms.",
        "Your repeated provocations have destroyed the basis for peace between us. Poland will meet this betrayal with firm military action."
      ],
      threat: [
        "Your military preparations place Poland\u2019s sovereignty in immediate danger. We will not wait helplessly for the first blow.",
        "You have chosen intimidation and brought your forces against our security. Poland stands ready, and we strike to ensure that Poland endures."
      ],
      ideological: [
        "Your political order threatens the sovereignty and commitments on which our security depends. Poland will resist it with disciplined force.",
        "The principles you advance leave independent nations no dependable peace. We oppose them now, resolutely and without illusion."
      ],
      ambition: [
        "Poland cannot preserve its future by remaining absent from every contest of power. We act now because the opportunity is strategically sound.",
        "This war is not undertaken for spectacle, but for lasting security and influence. Poland\u2019s forces will pursue that objective with discipline."
      ]
    }
  };
  var FALLBACK_WAR_DECLARATIONS = {
    conquest: ["Your weakness offers an opportunity we will not ignore.", "Our forces will take the ground that victory places within reach."],
    hostility: ["Our grievances can no longer be settled peacefully. We are at war.", "You have exhausted every peaceful alternative. We now answer with force."],
    threat: ["Your preparations leave us no safe choice but to strike first.", "We will act now rather than wait for your threat to grow."],
    ideological: ["Our principles can no longer coexist in peace. War will decide between them.", "The order you defend is incompatible with ours. We take up arms."],
    ambition: ["The moment favors decisive action, and we intend to seize it.", "History offers an opportunity that our armies will now pursue."]
  };

  // src/editor/leaderEditorModel.ts
  var catalog = {
    leaders: ALL_LEADERS,
    nations: NATION_DEFINITIONS,
    eras: ERA_TIMELINE,
    cultures: CULTURE_TREE,
    sports: GAMES_OF_NATIONS_SPORT_DEFINITIONS,
    profiles: {
      agendas: AI_NATIONAL_AGENDAS,
      doctrines: AI_MILITARY_DOCTRINES,
      covert: COVERT_PERSONALITIES,
      ideologies: IDEOLOGIES,
      strategies: AI_STRATEGIES,
      eraStrategies: ALL_AI_LEADER_ERA_STRATEGIES
    }
  };
  var personalityFields = {
    aggressionBias: [-100, 100, 1, "Aggression", "Adds to aggressive strategy selection; negative values favor defense."],
    expansionBias: [-100, 100, 1, "Expansion", "Adds to expansionist strategy selection and settlement preferences."],
    economyBias: [-100, 100, 1, "Economy", "Adds to economic strategy selection."],
    cultureBias: [-100, 100, 1, "Culture", "Favors cultural dominance and also balanced and economic strategies."],
    diplomacyBias: [-100, 100, 1, "Diplomacy", "Favors balanced strategy selection and diplomatic cooperation."],
    warTolerance: [0, 100, 1, "War Tolerance", "Higher values increase willingness to remain at war; 50 is neutral."],
    peacePreference: [0, 100, 1, "Peace Preference", "Higher values favor peace negotiations; 50 is neutral."],
    minimumUnitsLostBeforePeace: [0, 1e4, 1, "Minimum Units Lost Before Peace", "Own military losses required before considering peace. Other peace gates still apply."],
    casualtyToleranceRatio: [0, 1, 0.01, "Casualty Tolerance", "Fraction of war-start military strength that must be lost before considering peace."],
    resourceExploitationInterest: [0, 4, 1, "Resource Exploitation Interest", "Interest in foreign exploitation rights: 0 none, 1 low, 2 normal, 3 high, 4 very high."]
  };
  function profiles(config, kind) {
    const merged = new Map(catalog.profiles[kind].map((p) => [p.id, p]));
    for (const p of config.profiles?.[kind] ?? []) merged.set(p.id, p);
    return [...merged.values()];
  }
  function assignments(config, leaderId) {
    return config.eraAssignments?.[leaderId] ?? LEADER_ERA_STRATEGY_PROFILES.find((p) => p.leaderId === leaderId)?.strategiesByEra ?? {};
  }
  function effectiveEra(config, leaderId, era) {
    return resolveEraAssignment(assignments(config, leaderId), era);
  }
  function effectiveLeader(config, id) {
    const base = ALL_LEADERS.find((l) => l.id === id);
    const patch = config.leaders?.[id];
    const leader = { ...base, ...patch };
    return {
      ...leader,
      opportunism: leader.opportunism ?? false,
      maxPreferredCities: leader.maxPreferredCities ?? void 0,
      diplomacyFlavor: patch?.diplomacyFlavor ? { ...base.diplomacyFlavor, ...patch.diplomacyFlavor } : base.diplomacyFlavor,
      aiPersonality: { ...DEFAULT_AI_LEADER_PERSONALITY, ...base.aiPersonality, ...patch?.aiPersonality },
      aiNationalAgendaId: leader.aiNationalAgendaId ?? BALANCED_AGENDA_ID,
      aiMilitaryDoctrineId: leader.aiMilitaryDoctrineId ?? DEFAULT_AI_MILITARY_DOCTRINE_ID,
      ideologyId: leader.ideologyId ?? DEFAULT_IDEOLOGY_ID,
      covertPersonalityId: leader.covertPersonalityId ?? LEADER_COVERT_PERSONALITY_DEFAULTS[id] ?? DEFAULT_COVERT_PERSONALITY_ID
    };
  }
  var profileLeaderFields = {
    agendas: "aiNationalAgendaId",
    doctrines: "aiMilitaryDoctrineId",
    covert: "covertPersonalityId",
    ideologies: "ideologyId"
  };
  function profileUsers(config, kind, id, nations = []) {
    return ALL_LEADERS.flatMap((base) => {
      const leader = effectiveLeader(config, base.id);
      if (kind === "eraStrategies") {
        const eras = ERA_TIMELINE.filter((e) => effectiveEra(config, leader.id, e.era).id === id).map((e) => `${e.era} (${effectiveEra(config, leader.id, e.era).source})`);
        return eras.length ? [{ leader, detail: eras.join(", ") }] : [];
      }
      if (kind === "strategies") {
        const nation2 = nations.find((n) => n.id === leader.nationId && (n.leaderId ?? ALL_LEADERS.find((l) => l.nationId === n.id && l.isDefault)?.id) === leader.id);
        return [{ leader, detail: nation2?.aiStrategyId === id ? "Scenario starting strategy; runtime may reselect" : "Potential runtime choice; depends on situation, personality and agenda" }];
      }
      const field = profileLeaderFields[kind];
      const nation = nations.find((n) => n.id === leader.nationId && (n.leaderId ?? ALL_LEADERS.find((l) => l.nationId === n.id && l.isDefault)?.id) === leader.id);
      const national = kind === "agendas" ? nation?.aiNationalAgendaId : kind === "covert" ? nation?.covertPersonalityId : void 0;
      return leader[field] === id || national === id ? [{ leader, detail: national ? `Leader: ${leader[field]}; scenario nation: ${national}` : "Leader reference (including defaults)" }] : [];
    });
  }
  function behaviorWeights(config, id) {
    return config.behaviorWeights?.[id] ?? AI_STRATEGY_BEHAVIOR_WEIGHTS[id] ?? BALANCED_BEHAVIOR_WEIGHTS;
  }
  function warPhrases(config, id) {
    return config.warDeclarations?.[id] ?? LEADER_WAR_DECLARATIONS[id] ?? FALLBACK_WAR_DECLARATIONS;
  }
  function validateConfiguration(config, nations = []) {
    const errors = [];
    if (!config || config.version !== 1) return ["Unsupported leader configuration version."];
    const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
    for (const key of ["leaders", "profiles", "eraAssignments", "behaviorWeights", "warDeclarations"]) {
      if (config[key] !== void 0 && !object(config[key])) errors.push(`${key}: expected an object`);
    }
    if (errors.length) return errors;
    for (const [kind, entries] of Object.entries(config.profiles ?? {})) {
      if (!(kind in catalog.profiles)) errors.push(`Unknown profile collection: ${kind}`);
      if (!Array.isArray(entries) || entries.some((p) => !object(p))) errors.push(`${kind}: expected a list of definitions`);
    }
    for (const key of ["leaders", "eraAssignments", "behaviorWeights", "warDeclarations"]) {
      for (const [id, value] of Object.entries(config[key] ?? {})) if (!object(value)) errors.push(`${key}.${id}: expected an object`);
    }
    for (const [id, patch] of Object.entries(config.leaders ?? {})) {
      if (!object(patch)) continue;
      for (const key of ["aiPersonality", "gamesOfNationsPreferences", "diplomacyFlavor"]) if (patch[key] !== void 0 && !object(patch[key])) errors.push(`${id}.${key}: expected an object`);
      if (patch.culturePriorities !== void 0 && !Array.isArray(patch.culturePriorities)) errors.push(`${id}.culturePriorities: expected a list`);
      for (const key of ["name", "title", "image", "description"]) if (patch[key] !== void 0 && typeof patch[key] !== "string") errors.push(`${id}.${key}: expected text`);
      for (const key of ["id", "nationId", "isDefault"]) if (key in patch) errors.push(`${id}.${key}: canonical identity cannot be overridden`);
    }
    if (errors.length) return errors;
    const knownLeader = (id) => {
      if (!ALL_LEADERS.some((l) => l.id === id)) errors.push(`Unknown leader: ${id}`);
    };
    const ref = (kind, id, context) => {
      if (!profiles(config, kind).some((p) => p.id === id)) errors.push(`${context}: unknown ${kind} ${String(id)}`);
    };
    const finiteTree = (value, path) => {
      if (typeof value === "number" && !Number.isFinite(value)) errors.push(`${path}: must be finite`);
      if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) finiteTree(child, `${path}.${key}`);
    };
    finiteTree(config, "Configuration");
    for (const kind of Object.keys(catalog.profiles)) {
      const list = config.profiles?.[kind] ?? [];
      if (!Array.isArray(list)) {
        errors.push(`${kind}: expected a list`);
        continue;
      }
      const seen = /* @__PURE__ */ new Set();
      for (const p of list) {
        if (!p || typeof p.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(p.id)) {
          errors.push(`${kind}: invalid ID`);
          continue;
        }
        if (seen.has(p.id)) errors.push(`${kind}: duplicate ID ${p.id}`);
        seen.add(p.id);
        if (typeof p.name !== "string" || !p.name.trim()) errors.push(`${kind}.${p.id}: name is required`);
        const template = catalog.profiles[kind].find((t) => t.id === p.id) ?? catalog.profiles[kind][0];
        const shape = (a, b, path) => {
          for (const key of Object.keys(a)) {
            if (key === "description" || key === "strategyBias" || key === "targetComposition") continue;
            const optional = ["foundingPreferences", "foundingRules", "resourcePriorities", "tilePurchase", "happinessBehavior", "cityFocusRules", "productionRhythm", "navalExpeditions", "navalSaturationControl", "scienceBuilding", "cultureBuilding", "worker", "workBoat", "culture", "wonder", "settlerInterval", "cultureBuildingWeight", "wonderWeight"].includes(key);
            if (b?.[key] === void 0 && optional) continue;
            if (b?.[key] === void 0) {
              errors.push(`${path}.${key}: missing parameter`);
              continue;
            }
            if (typeof a[key] !== typeof b[key]) errors.push(`${path}.${key}: expected ${typeof a[key]}`);
            else if (typeof a[key] === "object" && a[key] !== null) shape(a[key], b[key], `${path}.${key}`);
          }
        };
        shape(template, p, `${kind}.${p.id}`);
        if ((kind === "strategies" || kind === "ideologies") && !catalog.profiles[kind].some((t) => t.id === p.id)) errors.push(`${kind}: new IDs require runtime selector/compatibility support; edit existing definitions instead`);
        const domains = (value, path) => {
          for (const [key, child] of Object.entries(value)) {
            if (child && typeof child === "object") domains(child, [...path, key]);
            if (typeof child !== "number") continue;
            const ratio = path.includes("targetComposition") || ["proxyWarPreference", "espionagePreference", "minAttackHealthRatio"].includes(key);
            if (ratio && (child < 0 || child > 1)) errors.push(`${p.id}.${[...path, key].join(".")}: expected 0\u20131`);
            if (key === "covertUsageBias" && (child < -1 || child > 1)) errors.push(`${p.id}.${key}: expected \u22121\u20131`);
          }
        };
        domains(p, []);
        if (kind === "eraStrategies") {
          const focus = p.cityFocusRules?.primaryCityFocus;
          if (focus && !["balanced", "cultural", "military", "economic", "naval", "scientific"].includes(focus)) errors.push(`${p.id}: invalid city focus ${focus}`);
        }
        if (kind === "agendas") for (const id of Object.keys(p.strategyBias ?? {})) ref("strategies", id, p.id);
      }
    }
    for (const [id, patch] of Object.entries(config.leaders ?? {})) {
      knownLeader(id);
      if (patch.opportunism !== void 0 && typeof patch.opportunism !== "boolean") errors.push(`${id}: opportunism must be true or false`);
      if (patch.name !== void 0 && !patch.name.trim()) errors.push(`${id}: leader name is required`);
      if (patch.gamesOfNationsPreferences && (!patch.gamesOfNationsPreferences.traditionalFavourite || !patch.gamesOfNationsPreferences.additionalFavourite)) errors.push(`${id}: both favorite sport categories are required`);
      for (const [kind, field] of Object.entries(profileLeaderFields)) if (patch[field] !== void 0) ref(kind, patch[field], id);
      for (const [key, value] of Object.entries(patch.aiPersonality ?? {})) {
        const field = personalityFields[key];
        if (!field || typeof value !== "number" || !Number.isFinite(value) || value < field[0] || value > field[1] || field[2] === 1 && !Number.isInteger(value)) errors.push(`${id}: invalid personality ${key} (${value})`);
      }
      if (patch.maxPreferredCities != null && (!Number.isInteger(patch.maxPreferredCities) || patch.maxPreferredCities < 1)) errors.push(`${id}: city limit must be a positive integer`);
      for (const node3 of patch.culturePriorities ?? []) if (!CULTURE_TREE.some((n) => n.id === node3)) errors.push(`${id}: unknown culture priority ${node3}`);
      for (const [key, category] of [["traditionalFavourite", "traditional"], ["additionalFavourite", "additional"]]) {
        const sport = patch.gamesOfNationsPreferences?.[key];
        if (sport !== void 0 && !catalog.sports.some((s) => s.id === sport && s.category === category)) errors.push(`${id}: invalid ${category} sport ${sport}`);
      }
    }
    for (const [id, eras] of Object.entries(config.eraAssignments ?? {})) {
      knownLeader(id);
      for (const [era, strategy] of Object.entries(eras)) {
        if (!ERA_TIMELINE.some((e) => e.era === era)) errors.push(`${id}: unknown era ${era}`);
        ref("eraStrategies", strategy, `${id} / ${era}`);
      }
    }
    for (const [id, phrases] of Object.entries(config.warDeclarations ?? {})) {
      knownLeader(id);
      for (const reason of Object.keys(FALLBACK_WAR_DECLARATIONS)) {
        const lines = phrases[reason];
        if (!Array.isArray(lines) || lines.length !== 2 || lines.some((l) => typeof l !== "string" || !l.trim())) errors.push(`${id}: ${reason} requires two nonempty phrases`);
      }
    }
    for (const [id, weights] of Object.entries(config.behaviorWeights ?? {})) {
      ref("strategies", id, "Behavior weights");
      for (const key of Object.keys(BALANCED_BEHAVIOR_WEIGHTS)) if (typeof weights[key] !== "number" || !Number.isFinite(weights[key])) errors.push(`${id}.behaviorWeights.${key}: expected a finite number`);
    }
    for (const nation of nations) {
      if (nation.leaderId && !ALL_LEADERS.some((l) => l.id === nation.leaderId && l.nationId === nation.id)) errors.push(`${nation.name}: leader does not belong to this nation`);
      if (nation.aiNationalAgendaId) ref("agendas", nation.aiNationalAgendaId, nation.name);
      if (nation.covertPersonalityId) ref("covert", nation.covertPersonalityId, nation.name);
      if (nation.aiStrategyId) ref("strategies", nation.aiStrategyId, nation.name);
    }
    return errors;
  }
  function ideologyRelationships(id) {
    return IDEOLOGIES.map((other) => ({ id: other.id, name: other.name, score: getIdeologyCompatibilitySafe(id, other.id) }));
  }
  function warPhraseSource(config, id) {
    return config.warDeclarations?.[id] ? "Scenario Override" : LEADER_WAR_DECLARATIONS[id] ? "Explicit \xB7 Built-in Leader Phrase Library" : "Inherited \xB7 Generic War Phrases";
  }

  // src/editor/leaderParameterHelp.ts
  function label(key) {
    return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }
  var help = {
    militaryBehavior: "War preparation, target preferences, and required military readiness for this era strategy.",
    foundingRules: "Constraints on voluntary settlement placement.",
    resourcePriorities: "Relative priority of sea resource exploitation and work boat production.",
    tilePurchase: "Treasury and scoring thresholds for discretionary tile acquisition.",
    happinessBehavior: "Thresholds that trigger happiness stabilization and emergency measures.",
    cityFocusRules: "City specialization and population thresholds for focus changes.",
    productionRhythm: "How many units can be built consecutively before favoring infrastructure.",
    military: "Unit limits, target reach, attack health, and tactical aggression for this base strategy.",
    expansion: "City goals and settler spacing/timing for this base strategy.",
    production: "Production category scores and infrastructure need thresholds for this base strategy.",
    navalExpeditions: "Enables planning naval expeditions against enemies during war. Previously specific to Naval Power.",
    navalSaturationControl: "Reduces naval production urgency when fleet size exceeds coastal-city and active-war needs. Previously specific to Naval Power.",
    strategyBias: "Adds points to the named base strategy during situation-based selection. Positive favors it; negative discourages it. These are scores, not percentages.",
    productionWeights: "Relative production scoring weights. Higher values favor this unit or building category; actual availability and economic constraints still apply.",
    researchWeights: "Relative research scoring weights for technologies that support each goal. Higher values favor that goal.",
    cultureWeights: "Relative culture selection weights for these goals. Higher values favor matching unlocks.",
    diplomacyWeights: "Multipliers for diplomatic action scores. Higher values favor the action; they do not guarantee acceptance.",
    preferredRoles: "Multipliers on unit production scores by military role. 1 is neutral; larger values favor this role.",
    targetComposition: "Desired fraction of the army in this role (0\u20131). Role deficits influence unit production scores.",
    militaryBudget: "Controls desired army strength and unit ceilings relative to normal strategic needs.",
    strategicTolerance: "Economic and happiness conditions under which military production may continue.",
    productionBehavior: "Relative preference for upgrading units, inexpensive quantity, or stronger quality.",
    foundingPreferences: "Relative settlement-site scoring weights. Positive weights value this feature; distance penalty discourages remote sites.",
    covertUsageBias: "Propensity to initiate covert operations, roughly \u22121 (avoids) to +1 (favors). Some covert preferences are reserved for future mission selection.",
    suspicionSensitivity: "Multiplier on suspicion gained as a victim. Values above 1 make accusations accumulate faster.",
    riskTolerance: "Tolerance for covert diplomatic blowback: around 0.5 cautious to 1.5 reckless.",
    proxyWarPreference: "Preference for proxy/covert pressure over open war (0\u20131).",
    espionagePreference: "Preference for spy/agent operations (0\u20131); reserved for future covert AI selection.",
    suspicionToWar: "Multiplier converting suspicion into willingness to go to war; 1 is baseline.",
    suspicionToTrade: "Multiplier converting suspicion into reluctance to trade; 1 is baseline.",
    diplomacyBias: "Bias to diplomatic cooperation. Higher values favor cooperation.",
    tradeBias: "Bias to trade acceptance. Higher values favor trade.",
    warBias: "Bias to war willingness. Higher values favor war.",
    openBordersBias: "Bias to open-border agreements. Higher values favor access.",
    cultureResistance: "Resistance to foreign cultural pressure. Higher values increase resistance.",
    expansionBias: "Bias to territorial expansion. Higher values favor expansion.",
    strengthMultiplier: "Multiplies desired military strength. 1 is neutral; prestige projection deliberately aims for a larger army.",
    maxUnitsMultiplier: "Multiplies the normal unit cap. 1 is neutral.",
    allowOverbuildingWhenThreatened: "Allows exceeding the normal military budget when threats justify it.",
    minHappinessForMilitaryBuilds: "Minimum national happiness for discretionary military production.",
    minGoldReserveForMilitaryBuilds: "Minimum treasury reserve for discretionary military production.",
    tolerateWarWeariness: "Allows military production despite war weariness.",
    modernizationBias: "Favors modernizing the army. The production behavior block is authoritative; the top-level field is a legacy mirror.",
    quantityBias: "Favors greater numbers of units. The production behavior block is authoritative; the top-level field is a legacy mirror.",
    qualityBias: "Favors higher-quality units. The production behavior block is authoritative; the top-level field is a legacy mirror.",
    prepareForWar: "Enables preparation for a future war.",
    targetWeakNeighbor: "Prefers militarily weak neighbors when evaluating targets.",
    preferCapitalTargets: "Favors enemy capitals as military objectives.",
    minimumMilitaryReadiness: "Minimum readiness ratio for planned military action; higher requires more preparation.",
    minCityDistance: "Minimum spacing between founded cities in map tiles.",
    seaResourceExploitation: "Multiplier favoring exploitation of sea resources.",
    workBoatProduction: "Multiplier favoring work boat production.",
    minGoldReserve: "Gold that must remain available before discretionary tile purchases.",
    minScore: "Minimum site score required for a tile purchase.",
    stabilizationThreshold: "Happiness level below which stabilization becomes a priority.",
    criticalThreshold: "Happiness level considered critical for emergency stabilization.",
    primaryCityFocus: "Preferred specialization for city production and development.",
    largeCityPopulationThreshold: "Population at which large-city focus rules apply.",
    peaceUnitsBeforeInfrastructure: "Consecutive units allowed before favoring infrastructure during peace.",
    warUnitsBeforeInfrastructure: "Consecutive units allowed before favoring infrastructure during war.",
    maxUnits: "Normal military unit ceiling before doctrine and situational modifiers.",
    minAttackHealthRatio: "Minimum remaining health fraction for attacks (0\u20131).",
    engageDistance: "Maximum target engagement distance in map tiles.",
    preferReachableTargets: "Prioritizes targets that pathfinding considers reachable.",
    randomnessFactor: "Amount of random variation in military decisions.",
    aggression: "Military aggression multiplier: 0.5 defensive, 1 neutral, 2 aggressive. In behavior weights, controls aggressive action scoring.",
    desiredCityCount: "Desired number of cities. A leader city limit can further cap voluntary expansion.",
    settlerMinCityDistance: "Minimum settlement distance in map tiles.",
    settlerInterval: "Turns between settler production opportunities.",
    lowNetFoodThreshold: "Net food threshold that triggers food infrastructure priorities.",
    lowProductionThreshold: "Production threshold that triggers production infrastructure priorities.",
    exploration: "Exploration action weight; larger values favor scouting.",
    diplomacy: "Diplomatic action weight; larger values favor diplomatic activity.",
    trade: "Trade activity weight: 0 disables deals, below 2 allows one deal per turn, 2+ allows two.",
    defense: "Defensive action weight; larger values favor defense."
  };
  function parameterHelp(path) {
    const parts = path.split(".");
    return help[parts[parts.length - 1]] ?? parts.map((p) => help[p]).find(Boolean) ?? (path.includes("Weight") ? "Relative production score. Higher values favor this category." : "Finite tuning value. Effects combine with current conditions and other configuration layers.");
  }

  // src/editor/leaderEditorBundle.ts
  var clone = (v) => JSON.parse(JSON.stringify(v));
  var node2 = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== void 0) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  function button(text, action) {
    const b = node2("button", text);
    b.type = "button";
    b.onclick = action;
    return b;
  }
  function select(options, value, change) {
    const s = node2("select");
    if (value && !options.some((o) => o.id === value)) options = [{ id: value, name: `Unknown: ${value}` }, ...options];
    for (const o of options) {
      const option = node2("option", o.name);
      option.value = o.id;
      s.append(option);
    }
    s.value = value;
    s.onchange = () => change(s.value);
    return s;
  }
  function open(scenario, onApply) {
    let config = clone(scenario.leaderConfiguration ?? { version: 1 });
    const nations = clone(scenario.nations);
    let kind = "leaders";
    let selected = catalog.leaders[0].id;
    let query = "";
    let era = "ancient";
    const expanded = /* @__PURE__ */ new Set(["Personality", "Strategic Identity"]);
    const dialog = node2("dialog", void 0, "le-dialog");
    const style = node2("style");
    style.textContent = `
.le-dialog{margin:auto;color:#ddd;background:#202020;border:1px solid #666;border-radius:6px;width:min(1250px,94vw);height:90vh;padding:0;font:13px Arial,sans-serif}.le-dialog::backdrop{background:#000a}.le-shell{display:flex;flex-direction:column;height:100%}.le-head,.le-foot{padding:14px;display:flex;gap:12px;align-items:center;background:#292929;flex-wrap:wrap}.le-head strong{font-size:18px}.le-body{display:flex;flex:1;min-height:0}.le-side{width:240px;flex-shrink:0;overflow:auto;padding:12px;border-right:1px solid #444}.le-side>button{display:block;width:100%;text-align:left;margin:4px 0}.le-main{flex:1;overflow:auto;padding:20px;min-width:0}.le-dialog button,.le-dialog select,.le-dialog input,.le-dialog textarea{background:#303030;color:#eee;border:1px solid #555;border-radius:3px;padding:7px;font:inherit}.le-dialog button{cursor:pointer}.le-dialog button:hover,.le-dialog button[aria-current=true]{border-color:#93b9a0;background:#32443a}.le-dialog input:not([type=checkbox]),.le-dialog textarea{box-sizing:border-box;width:100%}.le-dialog select{max-width:100%}.le-dialog textarea{min-height:65px;resize:vertical}.le-field{display:grid;grid-template-columns:minmax(150px,1fr) minmax(150px,1.6fr) auto;gap:8px;padding:10px 0;border-bottom:1px solid #353535;align-items:start}.le-field small{display:block;color:#aaa;margin-top:5px;line-height:1.4}.le-help{color:#aaa;line-height:1.6}.le-dialog details{border:1px solid #444;border-radius:4px;padding:12px;margin:12px 0}.le-dialog summary{cursor:pointer;font-size:15px;color:#eee}.le-errors{color:#ffb3a7;max-height:130px;overflow:auto;white-space:pre-wrap;flex:1}.le-badge{color:#b7d9bb;font-size:11px}.le-summary{padding:12px;background:#29372e;line-height:1.7}.le-links{display:flex;gap:6px;flex-wrap:wrap}.le-portrait{width:80px;height:80px;object-fit:cover;float:right}.le-foot{border-top:1px solid #444}.le-side input{margin-bottom:8px}@media(max-width:750px){.le-side{width:150px}.le-field{grid-template-columns:1fr}.le-main{padding:10px}}
`;
    const shell = node2("div", void 0, "le-shell");
    const head = node2("div", void 0, "le-head");
    head.append(node2("strong", "Leaders & AI"), node2("span", "Scenario overrides \xB7 built-in defaults stay shared", "le-help"));
    const tabs = select([{ id: "leaders", name: "Leaders" }, ...Object.keys(catalog.profiles).map((id) => ({ id, name: id === "strategies" ? "Base AI Strategies" : label(id) }))], kind, (v) => {
      kind = v;
      selected = kind === "leaders" ? catalog.leaders[0].id : profiles(config, kind)[0].id;
      query = "";
      render();
    });
    head.append(tabs);
    const body = node2("div", void 0, "le-body");
    const side = node2("aside", void 0, "le-side");
    const main = node2("main", void 0, "le-main");
    body.append(side, main);
    const foot = node2("div", void 0, "le-foot");
    const errors = node2("div", void 0, "le-errors");
    errors.setAttribute("role", "status");
    foot.append(errors, button("Discard / Close", () => dialog.close()), button("Apply to Scenario", () => {
      const issues = validateConfiguration(config, nations);
      if (issues.length) {
        errors.textContent = issues.join("\n");
        return;
      }
      scenario.leaderConfiguration = clone(config);
      for (const target of scenario.nations) {
        const edited = nations.find((n) => n.id === target.id);
        if (!edited) continue;
        for (const field2 of ["leaderId", "leaderName", "leaderDescription", "aiNationalAgendaId", "covertPersonalityId", "aiStrategyId"]) {
          if (edited[field2] === void 0) delete target[field2];
          else target[field2] = edited[field2];
        }
      }
      onApply();
      dialog.close();
    }));
    shell.append(head, body, foot);
    dialog.append(style, shell);
    document.body.append(dialog);
    dialog.onclose = () => dialog.remove();
    dialog.showModal();
    function jump(k, id) {
      kind = k;
      selected = id;
      query = "";
      tabs.value = k;
      render();
    }
    function section(title, help2) {
      const d = node2("details");
      d.dataset.section = title;
      d.open = expanded.has(title);
      d.ontoggle = () => {
        if (!d.isConnected) return;
        if (d.open) expanded.add(title);
        else expanded.delete(title);
      };
      d.append(node2("summary", title));
      if (help2) d.append(node2("p", help2, "le-help"));
      main.append(d);
      return d;
    }
    function field(parent, title, input, help2 = "", source = "", reset) {
      const row = node2("div", void 0, "le-field");
      const text = node2("label", title);
      const controlId = `le-${Math.random().toString(36).slice(2)}`;
      input.id = controlId;
      input.setAttribute("aria-label", title);
      text.htmlFor = controlId;
      if (help2) text.append(node2("small", help2));
      const control = node2("div");
      control.append(input);
      if (source) control.append(node2("small", source, "le-badge"));
      row.append(text, control);
      if (reset) row.append(button("Reset", reset));
      parent.append(row);
    }
    function textInput(value, change, multiline = false) {
      const input = multiline ? node2("textarea") : node2("input");
      input.value = value;
      input.onchange = () => change(input.value);
      return input;
    }
    function patchLeader(path, value, reset = false) {
      var _a;
      config.leaders ?? (config.leaders = {});
      (_a = config.leaders)[selected] ?? (_a[selected] = {});
      let target = config.leaders[selected];
      for (const key of path.slice(0, -1)) target = target[key] ?? (target[key] = {});
      if (reset) delete target[path[path.length - 1]];
      else target[path[path.length - 1]] = value;
      render();
    }
    function render() {
      for (const details of main.querySelectorAll("details[data-section]")) {
        if (details.open) expanded.add(details.dataset.section);
        else expanded.delete(details.dataset.section);
      }
      errors.textContent = validateConfiguration(config, nations).join("\n");
      side.replaceChildren();
      main.replaceChildren();
      const search = node2("input");
      search.placeholder = "Search names, nations, profiles\u2026";
      search.value = query;
      search.setAttribute("aria-label", "Search leaders or profiles");
      search.oninput = () => {
        query = search.value;
        renderList();
      };
      side.append(search);
      const list = node2("div");
      side.append(list);
      function renderList() {
        list.replaceChildren();
        const items = kind === "leaders" ? catalog.leaders.map((l) => effectiveLeader(config, l.id)) : profiles(config, kind);
        for (const item of items) {
          if (!JSON.stringify(item).toLowerCase().includes(query.toLowerCase())) continue;
          const b = button(item.name, () => {
            selected = item.id;
            render();
          });
          b.setAttribute("aria-current", String(selected === item.id));
          b.style.cssText = "display:block;width:100%;text-align:left;margin:5px 0";
          list.append(b);
        }
      }
      renderList();
      if (kind === "leaders") renderLeader();
      else renderProfile(kind);
    }
    function renderLeader() {
      const base = catalog.leaders.find((l) => l.id === selected);
      const leader = effectiveLeader(config, selected);
      const patch = config.leaders?.[selected];
      const { id: _id, nationId: _nation, isDefault: _default, ...defaultPatch } = base;
      const defaultIssues = validateConfiguration({ version: 1, leaders: { [selected]: defaultPatch } });
      if (defaultIssues.length) main.append(node2("p", `Built-in diagnostic: ${defaultIssues.join("; ")}`, "le-errors"));
      const image = node2("img", void 0, "le-portrait");
      image.src = leader.image;
      image.alt = leader.name;
      main.append(image, node2("h2", leader.name));
      main.append(node2("p", `${catalog.nations.find((n) => n.id === leader.nationId)?.name ?? leader.nationId} \xB7 ${base.isDefault ? "Default leader" : "Alternative leader"} \xB7 ${selected}`, "le-help"));
      main.append(button("Reset all leader overrides", () => {
        delete config.leaders?.[selected];
        delete config.eraAssignments?.[selected];
        delete config.warDeclarations?.[selected];
        render();
      }));
      const source = (key) => patch?.[key] !== void 0 ? "Scenario Override" : base[key] !== void 0 ? "Explicit \xB7 Built-in Default" : "Inherited \xB7 Runtime Default";
      const p = leader.aiPersonality;
      const traits = [leader.opportunism ? "Opportunistic" : "", p.aggressionBias > 0 ? "Aggressive" : p.aggressionBias < 0 ? "Defensive" : "Neutral aggression", p.expansionBias > 0 ? "Expansionist" : "", p.cultureBias > 0 ? "Culture-minded" : "", p.economyBias > 0 ? "Economy-minded" : ""].filter(Boolean);
      const eraInfo = effectiveEra(config, selected, era);
      const profileName = (k, id) => profiles(config, k).find((p2) => p2.id === id)?.name ?? `Unknown: ${id}`;
      const activeNation = nations.find((n) => n.id === leader.nationId && (n.leaderId ?? catalog.leaders.find((l) => l.nationId === n.id && l.isDefault)?.id) === selected);
      const summaryCovert = activeNation?.covertPersonalityId ?? leader.covertPersonalityId;
      const summaryAgenda = activeNation?.aiNationalAgendaId ?? leader.aiNationalAgendaId;
      const summary = node2("div", void 0, "le-summary");
      summary.append(node2("div", `Strategic character: ${traits.join(" / ")}`), node2("div", `Diplomacy: ${p.diplomacyBias < 0 ? "Low" : p.diplomacyBias > 0 ? "High" : "Neutral"} cooperation \xB7 ${p.warTolerance >= 60 ? "High" : p.warTolerance <= 40 ? "Low" : "Moderate"} war tolerance`), node2("div", `Military: ${profileName("doctrines", leader.aiMilitaryDoctrineId)} \xB7 Covert: ${profileName("covert", summaryCovert)} \xB7 Ideology: ${profileName("ideologies", leader.ideologyId)}`), node2("div", `Era strategy: ${profileName("eraStrategies", eraInfo.id)} \xB7 ${eraInfo.source}`));
      summary.append(node2("div", `Agenda: ${profileName("agendas", summaryAgenda)}${activeNation?.aiNationalAgendaId ? " \xB7 Scenario Nation Override" : ""}`));
      if (activeNation?.covertPersonalityId) summary.append(node2("div", "Covert source: Scenario Nation Override"));
      summary.append(select(catalog.eras.map((e) => ({ id: e.era, name: label(e.era) })), era, (v) => {
        era = v;
        render();
      }));
      main.append(summary);
      const identity = section("Identity", "Names and descriptions in the older Nation Details panel take precedence for the selected scenario nation. Nation membership and built-in default status remain canonical.");
      for (const key of ["name", "title", "description", "image"]) field(identity, key === "image" ? "Portrait URL" : label(key), textInput(leader[key] ?? "", (v) => patchLeader([key], v), key === "description"), "", source(key), () => patchLeader([key], void 0, true));
      const personality = section("Personality", "Biases are additive scores, not percentages. Neutral bias is 0. Editor bias bounds are \u2212100 to 100; gameplay previously imposed no bounds on these scores.");
      const opportunism = node2("input");
      opportunism.type = "checkbox";
      opportunism.checked = leader.opportunism;
      opportunism.onchange = () => patchLeader(["opportunism"], opportunism.checked);
      field(personality, "Opportunism", opportunism, "Exploits militarily weak rivals. Makes this leader more likely to intimidate, create tension with, and potentially attack substantially weaker known nations. Military recovery and alliances can deter escalation.", source("opportunism"), () => patchLeader(["opportunism"], void 0, true));
      for (const [key, spec] of Object.entries(personalityFields)) {
        const [min, max, step, title, help2] = spec;
        const value = p[key] ?? 1;
        const input = node2("input");
        input.type = "number";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        input.onchange = () => patchLeader(["aiPersonality", key], input.value === "" ? NaN : Number(input.value));
        const interpretation = key.endsWith("Bias") ? value >= 20 ? "Strong preference" : value > 0 ? "Positive preference" : value < 0 ? "Discouraged" : "Neutral" : key === "casualtyToleranceRatio" ? `${Math.round(value * 100)}% of starting strength` : "";
        field(personality, title, input, `${help2} Range: ${min}\u2013${max}. ${interpretation}`, patch?.aiPersonality?.[key] !== void 0 ? "Scenario Override" : base.aiPersonality?.[key] !== void 0 ? "Explicit \xB7 Built-in Default" : "Inherited \xB7 Runtime Default", () => patchLeader(["aiPersonality", key], void 0, true));
      }
      const strategic = section("Strategic Identity");
      for (const [k, key] of Object.entries(profileLeaderFields)) {
        const options = profiles(config, k);
        const value = leader[key];
        const def = options.find((p2) => p2.id === value);
        field(strategic, label(k), select(options, value, (v) => patchLeader([key], v)), def?.description ?? "Unknown reference", source(key) + (key === "covertPersonalityId" && !base[key] && !patch?.[key] ? " \xB7 Leader-specific covert mapping, then pragmatist" : ""), () => patchLeader([key], void 0, true));
        strategic.append(button(`Inspect ${def?.name ?? value} \xB7 Used by ${profileUsers(config, k, value, nations).length}`, () => jump(k, value)));
      }
      const cityLimit = node2("input");
      cityLimit.type = "number";
      cityLimit.min = "1";
      cityLimit.step = "1";
      cityLimit.value = leader.maxPreferredCities?.toString() ?? "";
      cityLimit.placeholder = "No leader cap";
      cityLimit.onchange = () => patchLeader(["maxPreferredCities"], Number(cityLimit.value), !cityLimit.value);
      field(strategic, "Voluntary City Limit", cityLimit, "Caps settlers and overseas expansion. Conquest, treaties, gifts and events can exceed the cap.", source("maxPreferredCities"), () => patchLeader(["maxPreferredCities"], void 0, true));
      strategic.append(button("Remove leader city cap", () => patchLeader(["maxPreferredCities"], null)));
      const timeline = section("Era Strategy", "Assignments remain active until replaced by a later era. Remove an assignment to inherit from the nearest earlier era; without one, Balanced Growth applies. Eras follow the nation\u2019s researched technology progression, not a fixed scenario date.");
      timeline.append(button("Reset timeline to built-in", () => {
        delete config.eraAssignments?.[selected];
        render();
      }));
      const map = assignments(config, selected);
      for (const e of catalog.eras) {
        const effective = effectiveEra(config, selected, e.era);
        field(timeline, label(e.era), select([{ id: "", name: "Inherit earlier / default" }, ...profiles(config, "eraStrategies")], map[e.era] ?? "", (v) => {
          var _a;
          config.eraAssignments ?? (config.eraAssignments = {});
          (_a = config.eraAssignments)[selected] ?? (_a[selected] = clone(map));
          if (v) config.eraAssignments[selected][e.era] = v;
          else delete config.eraAssignments[selected][e.era];
          render();
        }), `${profileName("eraStrategies", effective.id)} \xB7 ${effective.source}`, config.eraAssignments?.[selected] ? "Scenario timeline" : "Built-in timeline");
        timeline.append(button(`Inspect ${profileName("eraStrategies", effective.id)}`, () => jump("eraStrategies", effective.id)));
      }
      const culture = section("Culture Priorities", "Preferred nodes receive a culture selection bonus; their list order does not change the bonus. These do not grant culture nodes at scenario start.");
      const priorities = leader.culturePriorities ?? [];
      priorities.forEach((id, i) => {
        const n = catalog.cultures.find((n2) => n2.id === id);
        const row = node2("div", void 0, "le-links");
        row.append(node2("p", `${i + 1}. ${n?.name ?? `Unknown: ${id}`} \xB7 ${n?.era ?? ""}`), button("Remove", () => patchLeader(["culturePriorities"], priorities.filter((_, j) => j !== i))));
        if (i > 0) row.append(button("Move up", () => {
          const values = [...priorities];
          [values[i - 1], values[i]] = [values[i], values[i - 1]];
          patchLeader(["culturePriorities"], values);
        }));
        culture.append(row);
      });
      const cultureSearch = node2("input");
      cultureSearch.placeholder = "Filter culture nodes\u2026";
      cultureSearch.setAttribute("aria-label", "Filter culture priorities");
      const culturePicker = node2("div");
      const updateCultures = () => {
        culturePicker.replaceChildren(select([{ id: "", name: "Add culture priority\u2026" }, ...catalog.cultures.filter((n) => !priorities.includes(n.id) && `${n.name} ${n.era}`.toLowerCase().includes(cultureSearch.value.toLowerCase())).map((n) => ({ id: n.id, name: `${n.name} \xB7 ${label(n.era)}` }))], "", (v) => {
          if (v) patchLeader(["culturePriorities"], [...priorities, v]);
        }));
      };
      cultureSearch.oninput = updateCultures;
      updateCultures();
      culture.append(cultureSearch, culturePicker, button("Reset culture priorities", () => patchLeader(["culturePriorities"], void 0, true)));
      const sports = section("Games of Nations", "Favorite sports influence Games preferences and gossip. Categories use the canonical sport definitions.");
      for (const [key, category] of [["traditionalFavourite", "traditional"], ["additionalFavourite", "additional"]]) field(sports, `${label(category)} Favorite`, select(catalog.sports.filter((s) => s.category === category), leader.gamesOfNationsPreferences[key], (v) => patchLeader(["gamesOfNationsPreferences"], { ...leader.gamesOfNationsPreferences, [key]: v })), "", source("gamesOfNationsPreferences"));
      sports.append(button("Reset sports", () => patchLeader(["gamesOfNationsPreferences"], void 0, true)));
      const flavor = section("Diplomacy Flavor", "These seven metadata lines are currently descriptive only. Actual AI war announcements use the reason-specific phrase library below, after the AI has already decided to declare war.");
      for (const key of ["greeting", "friendly", "neutral", "hostile", "warDeclaration", "victory", "defeat"]) field(flavor, label(key), textInput(leader.diplomacyFlavor?.[key] ?? "", (v) => patchLeader(["diplomacyFlavor"], { ...leader.diplomacyFlavor, [key]: v }), true));
      flavor.append(button("Reset diplomacy flavor", () => patchLeader(["diplomacyFlavor"], void 0, true)));
      const war = section("War Declaration Phrases", "Two deterministic alternatives per reason. These lines flavor a completed war decision and do not alter war willingness.");
      const phrases = warPhrases(config, selected);
      for (const [reason, lines] of Object.entries(phrases)) lines.forEach((line, i) => field(war, `${label(reason)} ${i + 1}`, textInput(line, (v) => {
        config.warDeclarations ?? (config.warDeclarations = {});
        const updated = clone(phrases);
        updated[reason][i] = v;
        config.warDeclarations[selected] = updated;
        render();
      }, true), "", warPhraseSource(config, selected)));
      war.append(button("Reset war phrases", () => {
        delete config.warDeclarations?.[selected];
        render();
      }));
      const national = section("Scenario Nation & Inherited Rules", "Nation-specific starting settings are independent of a leader. Base strategies can be reselected during play. Unit availability, nation metadata, starting technology/culture, ideology compatibility, gossip rules, and global diplomacy thresholds remain in their existing systems.");
      const nation = nations.find((n) => n.id === leader.nationId);
      if (!nation) national.append(node2("p", "This nation is not present in the scenario. Leader tuning is retained and applies if the nation/leader is added or selected later."));
      else {
        const active = nation.leaderId ?? catalog.leaders.find((l) => l.nationId === nation.id && l.isDefault).id;
        national.append(node2("p", `Scenario selection: ${effectiveLeader(config, active).name}`));
        national.append(button("Use this leader for this nation", () => {
          if (base.isDefault) delete nation.leaderId;
          else nation.leaderId = selected;
          render();
        }));
        for (const [key, k] of [["aiNationalAgendaId", "agendas"], ["covertPersonalityId", "covert"], ["aiStrategyId", "strategies"]]) field(national, label(key.replace("ai", "")), select([{ id: "", name: key === "aiStrategyId" ? "Default: Baseline (runtime can reselect)" : "Use selected leader" }, ...profiles(config, k)], nation[key] ?? "", (v) => {
          if (v) nation[key] = v;
          else delete nation[key];
          render();
        }), "A nation override takes precedence over the selected leader.", nation[key] ? "Scenario Nation Override" : "Inherited");
        for (const key of ["leaderName", "leaderDescription"]) field(national, label(key), textInput(nation[key] ?? "", (v) => {
          if (v.trim()) nation[key] = v;
          else delete nation[key];
          render();
        }, key === "leaderDescription"), "Legacy nation override; blank uses the selected leader.");
        if (active === selected && (nation.aiNationalAgendaId || nation.covertPersonalityId || nation.leaderName || nation.leaderDescription)) main.prepend(node2("p", "Scenario nation overrides are active. Open \u201CScenario Nation & Inherited Rules\u201D to inspect the values taking precedence.", "le-summary"));
      }
    }
    function renderProfile(k) {
      const profile = profiles(config, k).find((p) => p.id === selected);
      if (!profile) {
        main.append(node2("p", `Unknown profile ${selected}. Choose a valid definition from the list.`));
        return;
      }
      main.append(node2("h2", profile.name), node2("p", `${selected} \xB7 ${config.profiles?.[k]?.some((p) => p.id === selected) ? "Scenario Override / Variant" : "Built-in Default"}`, "le-badge"));
      const users = profileUsers(config, k, selected, nations);
      main.append(node2("p", `This shared definition is used by ${users.length} leaders${k === "strategies" ? " as a potential runtime choice" : ""}. Changes affect all users in this scenario.`, "le-summary"));
      const used = section("Used by");
      used.open = true;
      used.style.maxHeight = "240px";
      used.style.overflow = "auto";
      for (const user of users) {
        const row = node2("div");
        row.append(button(user.leader.name, () => jump("leaders", user.leader.id)), node2("small", ` ${user.detail}`, "le-help"));
        used.append(row);
      }
      const actions = node2("div", void 0, "le-links");
      main.append(actions);
      actions.append(button("Reset / Remove scenario definition", () => {
        if (config.profiles?.[k]) config.profiles[k] = config.profiles[k].filter((p) => p.id !== selected);
        render();
      }));
      if (k !== "ideologies" && k !== "strategies") {
        const idInput = node2("input");
        idInput.placeholder = "New variant ID";
        idInput.setAttribute("aria-label", "New variant ID");
        actions.append(idInput, button("Duplicate / Create Variant", () => {
          var _a;
          const id = idInput.value.trim();
          if (!/^[a-zA-Z0-9_-]+$/.test(id) || profiles(config, k).some((p) => p.id === id)) {
            errors.textContent = "Enter a unique ID using letters, numbers, underscores or hyphens.";
            return;
          }
          config.profiles ?? (config.profiles = {});
          (_a = config.profiles)[k] ?? (_a[k] = []);
          config.profiles[k].push({ ...clone(profile), id, name: `${profile.name} Variant` });
          selected = id;
          render();
        }));
        main.append(node2("p", "Create a variant, then select it in a leader\u2019s Strategic Identity or Era Strategy. Existing users retain the original.", "le-help"));
      } else main.append(node2("p", k === "strategies" ? "Base strategy IDs are fixed by runtime selection. Edit their parameters and behavior weights here; new selectable strategy kinds require code support." : "Ideology IDs are fixed by the diplomacy compatibility matrix. Edit existing ideology effects here; new ideology kinds require compatibility rules.", "le-help"));
      function saveProfile(value) {
        config.profiles ?? (config.profiles = {});
        const list = config.profiles[k] ?? [];
        config.profiles[k] = [...list.filter((p) => p.id !== selected), value];
        render();
      }
      if (k === "ideologies") {
        const compatibility = section("Ideology Compatibility", "Inherited global relationship scores. Higher scores indicate greater affinity. This matrix remains global and is separate from editable ideology biases.");
        for (const other of ideologyRelationships(selected)) compatibility.append(node2("p", `${other.name}: ${other.score}`));
      }
      const params = section("Parameters");
      params.open = true;
      function fields(parent, obj, path, update) {
        for (const [key, value] of Object.entries(obj)) {
          if (key === "id") continue;
          if (k === "doctrines" && path.length === 0 && ["modernizationBias", "quantityBias", "qualityBias"].includes(key)) continue;
          const next = [...path, key];
          if (value && typeof value === "object" && !Array.isArray(value)) {
            const group = node2("details");
            const groupId = next.join(".");
            group.dataset.section = groupId;
            group.open = expanded.has(groupId);
            group.ontoggle = () => {
              if (!group.isConnected) return;
              if (group.open) expanded.add(groupId);
              else expanded.delete(groupId);
            };
            group.append(node2("summary", label(key)), node2("p", parameterHelp(next.join(".")), "le-help"));
            parent.append(group);
            fields(group, value, next, update);
            continue;
          }
          let input;
          if (typeof value === "boolean") {
            const check = node2("input");
            check.type = "checkbox";
            check.checked = value;
            check.onchange = () => update(next, check.checked);
            input = check;
          } else if (typeof value === "number") {
            const number = node2("input");
            number.type = "number";
            number.step = "any";
            number.value = String(value);
            number.onchange = () => update(next, number.value === "" ? NaN : Number(number.value));
            input = number;
          } else if (key === "primaryCityFocus") input = select(["balanced", "cultural", "military", "economic", "naval", "scientific"].map((id) => ({ id, name: label(id) })), String(value), (v) => update(next, v));
          else input = textInput(String(value), (v) => update(next, v), key === "description");
          field(parent, label(key), input, ["name", "description"].includes(key) ? "" : parameterHelp(next.join(".")));
        }
        const optional = /* @__PURE__ */ new Map();
        for (const example of catalog.profiles[k]) {
          let values = example;
          for (const segment of path) values = values?.[segment];
          for (const [key, value] of Object.entries(values ?? {})) if (!(key in obj)) optional.set(key, value);
        }
        if (optional.size) parent.append(select([{ id: "", name: "Add parameter from canonical example\u2026" }, ...[...optional.keys()].map((id) => ({ id, name: label(id) }))], "", (key) => {
          if (key) update([...path, key], clone(optional.get(key)));
        }));
      }
      fields(params, k === "strategies" ? { description: "", ...profile } : profile, [], (path, value) => {
        const updated = clone(profile);
        let cursor = updated;
        for (const key of path.slice(0, -1)) cursor = cursor[key];
        cursor[path[path.length - 1]] = value;
        if (k === "doctrines") for (const key of ["modernizationBias", "quantityBias", "qualityBias"]) updated[key] = updated.productionBehavior[key];
        saveProfile(updated);
      });
      if (k === "strategies") {
        const weights = section("Strategy Behavior Weights", "A separate layer controls exploration, diplomacy, trade, aggression and defense while this base strategy is active.");
        weights.open = true;
        const values = behaviorWeights(config, selected);
        fields(weights, values, [], (path, value) => {
          config.behaviorWeights ?? (config.behaviorWeights = {});
          config.behaviorWeights[selected] = { ...values, [path[0]]: value };
          render();
        });
        weights.append(button("Reset behavior weights", () => {
          delete config.behaviorWeights?.[selected];
          render();
        }));
      }
    }
    try {
      render();
    } catch {
      const issues = validateConfiguration(config, nations);
      errors.textContent = issues.join("\n") || "The imported leader configuration has an invalid structure.";
      main.replaceChildren(node2("p", "This imported configuration cannot be displayed. Discard to preserve it, or reset the leader configuration to start from canonical defaults."), button("Reset invalid leader configuration", () => {
        config = { version: 1 };
        render();
      }));
    }
  }
  window.EpochLeaderEditor = { open, validate: (scenario) => validateConfiguration(scenario.leaderConfiguration ?? { version: 1 }, scenario.nations) };
})();
