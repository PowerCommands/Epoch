import type { CultureNode } from '../types/CultureNode';

function node(input: CultureNode): CultureNode {
  return input;
}

/** Canonical culture-node id for the existing Colonialism progression node. */
export const COLONIALISM_CULTURE_NODE_ID = 'colonialism';

/** Completing this node permanently reveals the world map to the human player. */
export const ENLIGHTENMENT_CULTURE_NODE_ID = 'enlightenment';

/** Completing this node reveals archaeological resources to a nation. */
export const HUMANISM_CULTURE_NODE_ID = 'humanism';

/** Completing this node makes the United Nations transition available. */
export const LIBERALISM_CULTURE_NODE_ID = 'liberalism';

export const CULTURE_TREE: CultureNode[] = [
  node({ id: 'code_of_laws', name: 'Code of Laws', era: 'ancient', cost: 20, description: 'Formal rules turn custom into authority. Shared laws give the first cities a common structure for justice, duty, and rule.', unlocks: [{ type: 'government', value: 'chiefdom' }, { type: 'policySlot', value: 'economic' }] }),
  node({ id: 'craftsmanship', name: 'Craftsmanship', era: 'ancient', cost: 48, description: 'Skilled hands organize labor, tools, and local defense. Craft traditions help settlements turn raw materials into lasting civic strength.', prerequisites: ['code_of_laws'], unlocks: [{ type: 'policySlot', value: 'military' }] }),
  node({ id: 'foreign_trade', name: 'Foreign Trade', era: 'ancient', cost: 52, description: 'Merchants and envoys begin carrying goods beyond familiar borders. Trade customs make distant neighbors part of city life.', prerequisites: ['code_of_laws'], unlocks: [{ type: 'diplomacy', value: 'trade_delegations' }, { type: 'policySlot', value: 'diplomatic' }] }),
  node({ id: 'early_empire', name: 'Early Empire', era: 'ancient', cost: 50, description: 'Small settlements learn to think as a realm. Borders, tribute, and local chiefs become the first shape of expansion.', prerequisites: ['craftsmanship'], unlocks: [{ type: 'government', value: 'tribal_council' }] }),
  node({ id: 'state_workforce', name: 'State Workforce', era: 'ancient', cost: 55, description: 'Public labor becomes an instrument of government. Organized work crews raise monuments, roads, and shared civic projects.', prerequisites: ['craftsmanship'], unlocks: [{ type: 'building', value: 'sewers' }] }),
  node({ id: 'mysticism', name: 'Mysticism', era: 'ancient', cost: 60, description: 'Ritual, omen, and sacred authority bind people through wonder. Flexible traditions make room for leaders who act beyond ordinary law.', prerequisites: ['foreign_trade'], unlocks: [{ type: 'policySlot', value: 'wildcard' }] }),
  node({ id: 'military_tradition', name: 'Military Tradition', era: 'classical', cost: 90, description: 'War stories become doctrine, ceremony, and inherited command. Armies fight with shared memory as much as weapons.', prerequisites: ['early_empire'], unlocks: [{ type: 'unit', value: 'horseman' }] }),
  node({ id: 'political_philosophy', name: 'Political Philosophy', era: 'classical', cost: 110, description: 'Debate turns rule into an idea that can be compared and chosen. Citizens and rulers begin asking what government is for.', prerequisites: ['early_empire', 'state_workforce'], unlocks: [{ type: 'government', value: 'classical_republic' }, { type: 'government', value: 'autocracy' }, { type: 'policySlot', value: 'wildcard' }] }),
  node({ id: 'drama_civics', name: 'Drama and Poetry', era: 'classical', cost: 120, description: 'Public performance gives a civilization a voice. Poetry, theatre, and ceremony carry memory from one generation to the next.', prerequisites: ['mysticism'], unlocks: [{ type: 'building', value: 'amphitheater' }] }),
  node({ id: 'games_recreation', name: 'Games Of Nations', era: 'classical', cost: 200, description: 'Nations turn competition into grand public games. Shared contests build prestige, unity, and friendly rivalry between peoples.', prerequisites: ['state_workforce'], unlocks: [{ type: 'building', value: 'arena' }, { type: 'policySlot', value: 'culture' }] }),
  node({ id: 'defensive_tactics', name: 'Defensive Tactics', era: 'classical', cost: 120, description: 'Communities learn to prepare before danger arrives. Fortified habits and trained reserves make survival part of public policy.', prerequisites: ['military_tradition', 'political_philosophy'], unlocks: [{ type: 'policySlot', value: 'military' }] }),
  node({ id: 'recorded_history', name: 'Recorded History', era: 'classical', cost: 128, description: 'Archives turn memory into an institution. Written accounts help rulers learn from victories, failures, laws, and lineages.', prerequisites: ['drama_civics', 'political_philosophy'], unlocks: [{ type: 'building', value: 'library' }] }),
  node({ id: 'theology_civics', name: 'Theology', era: 'medieval', cost: 175, description: 'Faith becomes doctrine, hierarchy, and public purpose. Sacred institutions shape law, learning, and the authority of rulers.', prerequisites: ['drama_civics'], unlocks: [{ type: 'government', value: 'theocracy' }] }),
  node({ id: 'feudalism', name: 'Feudalism', era: 'medieval', cost: 190, description: 'Land, loyalty, and protection form a layered social order. Local obligations bind farms, warriors, and nobles into durable power.', prerequisites: ['defensive_tactics'], unlocks: [{ type: 'policySlot', value: 'economic' }] }),
  node({ id: 'civil_service_civics', name: 'Civil Service', era: 'medieval', cost: 200, description: 'Administration becomes a profession instead of a favor. Trained officials help distant cities answer to the same state.', prerequisites: ['recorded_history'], unlocks: [{ type: 'diplomacy', value: 'alliances' }] }),
  node({ id: 'mercenaries', name: 'Mercenaries', era: 'medieval', cost: 210, description: 'War becomes a market as soldiers sell skill to the highest cause. Coin, contracts, and reputation can raise armies quickly.', prerequisites: ['feudalism'], unlocks: [{ type: 'unit', value: 'mercenary_company' }] }),
  node({ id: 'medieval_faires', name: 'Medieval Faires', era: 'medieval', cost: 220, description: 'Seasonal gatherings join trade, craft, and celebration. Faires turn regional wealth into civic contact and commercial habit.', prerequisites: ['feudalism', 'civil_service_civics'], unlocks: [{ type: 'building', value: 'market' }] }),
  node({ id: 'guilds', name: 'Guilds', era: 'medieval', cost: 230, description: 'Craft masters organize skill, price, and apprenticeship. Guild life gives cities economic identity and durable urban influence.', prerequisites: ['civil_service_civics'], unlocks: [{ type: 'policySlot', value: 'economic' }] }),
  node({ id: 'diplomatic_service', name: 'Diplomatic Service', era: 'renaissance', cost: 280, description: 'Envoys become professionals who speak for the state. Protocol, letters, and permanent missions make diplomacy a civic craft.', prerequisites: ['guilds'], unlocks: [{ type: 'diplomacy', value: 'embassies' }, { type: 'policySlot', value: 'diplomatic' }] }),
  node({ id: 'exploration', name: 'Exploration', era: 'renaissance', cost: 285, description: 'Curiosity and ambition push officials beyond known maps. Exploration turns discovery into policy, profit, and new claims.', prerequisites: ['medieval_faires'], unlocks: [{ type: 'government', value: 'merchant_republic' }] }),
  node({ id: HUMANISM_CULTURE_NODE_ID, name: 'Humanism', era: 'renaissance', cost: 290, description: 'Art, history, and human dignity move toward the center of public life. Cities preserve achievement as a source of identity and learn to recognize archaeological sites.', prerequisites: ['guilds'], unlocks: [{ type: 'building', value: 'museum' }, { type: 'policySlot', value: 'culture' }] }),
  node({ id: 'reformed_church', name: 'Reformed Church', era: 'renaissance', cost: 400, description: 'Religious authority is challenged, refined, and reorganized. Belief becomes a force for reform as well as tradition.', prerequisites: ['theology_civics', 'humanism'], unlocks: [{ type: 'government', value: 'reformed_theocracy' }], effects: [{ type: 'happinessPerTurnFlat', value: 2 }] }),
  node({ id: 'mercantilism', name: 'Mercantilism', era: 'renaissance', cost: 430, description: 'The state treats commerce as national strategy. Ports, charters, and controlled markets turn trade into power.', prerequisites: ['exploration'], unlocks: [] }),
  node({ id: 'nationalism', name: 'Nationalism', era: 'renaissance', cost: 440, description: 'Shared language, memory, and symbols forge mass identity. Popular movements, independence struggles, and organized resistance take root.', prerequisites: ['humanism', 'mercantilism'], unlocks: [{ type: 'unit', value: 'corps' }, { type: 'unit', value: 'rebels' }] }),
  node({ id: ENLIGHTENMENT_CULTURE_NODE_ID, name: 'The Enlightenment', era: 'industrial', cost: 470, description: 'Reason, rights, and public inquiry challenge inherited authority. Knowledge becomes a civic engine for reform and progress. Permanently reveals the entire world map. Makes the World Council available.', prerequisites: ['humanism', 'diplomatic_service'], unlocks: [{ type: 'building', value: 'university' }, { type: 'diplomacy', value: 'world_council' }], effects: [{ type: 'happinessPerTurnFlat', value: 2 }] }),
  node({ id: 'natural_history', name: 'Natural History', era: 'industrial', cost: 500, description: 'Careful observation and classification turn the living world into a shared field of public knowledge.', prerequisites: ['enlightenment'], unlocks: [] }),
  node({ id: 'opera_ballet', name: 'Opera and Ballet', era: 'industrial', cost: 510, description: 'Grand music, theatre, and disciplined movement bring civic performance to an ambitious new scale.', prerequisites: ['enlightenment'], unlocks: [] }),
  node({ id: COLONIALISM_CULTURE_NODE_ID, name: 'Colonialism', era: 'industrial', cost: 600, description: 'Overseas ambition becomes administration, extraction, and settlement. Distant holdings reshape diplomacy and the home economy.', prerequisites: ['mercantilism'], unlocks: [{ type: 'diplomacy', value: 'colonial_charters' }] }),
  node({ id: 'civil_engineering', name: 'Civil Engineering', era: 'industrial', cost: 525, description: 'Public works become symbols of modern administration. Bridges, districts, and services let cities grow with intent.', prerequisites: ['enlightenment'], unlocks: [{ type: 'building', value: 'public_works' }] }),
  node({ id: 'urbanization', name: 'Urbanization', era: 'modern', cost: 600, description: 'City life becomes the dominant rhythm of society. Planning, housing, and services define the politics of modern growth.', prerequisites: ['civil_engineering'], unlocks: [{ type: 'building', value: 'neighborhood' }] }),
  node({ id: 'ideology', name: 'Ideology', era: 'modern', cost: 650, description: 'Politics hardens into competing visions for society. Parties, states, and citizens organize around total answers to modern life.', prerequisites: ['urbanization', 'nationalism'], unlocks: [{ type: 'government', value: 'ideological_state' }] }),
  node({ id: 'democracy', name: 'Democracy', era: 'modern', cost: 700, description: 'Representative institutions turn public consent into durable government. Elections, legislatures, and civic participation make authority answerable to citizens.', prerequisites: ['ideology'], unlocks: [] }),
  node({ id: LIBERALISM_CULTURE_NODE_ID, name: 'Liberalism', era: 'modern', cost: 750, description: 'Individual liberty and equal rights become foundations of public life. Constitutional limits protect conscience, expression, and association from arbitrary power. Makes the United Nations transition available.', prerequisites: ['democracy'], unlocks: [{ type: 'diplomacy', value: 'united_nations' }] }),
  node({ id: 'suffrage', name: 'Suffrage', era: 'modern', cost: 700, description: 'Political voice expands from privilege toward citizenship. Representation becomes a public promise and a source of legitimacy.', prerequisites: ['urbanization', 'ideology'], unlocks: [{ type: 'government', value: 'democracy' }] }),
  node({ id: 'totalitarianism', name: 'Totalitarianism', era: 'modern', cost: 745, description: 'The state reaches for control over every public institution. Unity, surveillance, and command become tools of national direction.', prerequisites: ['ideology'], unlocks: [{ type: 'government', value: 'fascism' }, { type: 'policySlot', value: 'military' }] }),
  node({ id: 'class_struggle', name: 'Class Struggle', era: 'modern', cost: 855, description: 'Economic conflict becomes a lens for history and power. Workers, parties, and states reorganize society around material equality.', prerequisites: ['ideology'], unlocks: [{ type: 'government', value: 'communism' }], effects: [{ type: 'happinessPerTurnFlat', value: 2 }] }),
  node({ id: 'mobilization', name: 'Mobilization', era: 'atomic', cost: 780, description: 'Industry, citizens, and command networks prepare for total war. The nation learns to move as one vast military machine.', prerequisites: ['ideology'], unlocks: [{ type: 'unit', value: 'army' }] }),
  node({ id: 'cold_war', name: 'Cold War', era: 'atomic', cost: 820, description: 'Rival blocs compete through pressure, research, and influence. Diplomacy becomes a contest fought beneath the threshold of war.', prerequisites: ['suffrage', 'totalitarianism', 'class_struggle'], unlocks: [{ type: 'diplomacy', value: 'research_agreements' }, { type: 'policySlot', value: 'diplomatic' }] }),
  node({ id: 'professional_sports', name: 'Professional Sports', era: 'atomic', cost: 930, description: 'Games become industry, spectacle, and civic identity. Stadium crowds turn recreation into shared culture at national scale.', prerequisites: ['urbanization'], unlocks: [{ type: 'building', value: 'stadium' }, { type: 'policySlot', value: 'culture' }] }),
  node({ id: 'globalization', name: 'Globalization', era: 'information', cost: 1030, description: 'Markets, institutions, and crises cross borders with new speed. Policy begins to operate on a world-sized stage.', prerequisites: ['cold_war'], unlocks: [] }),
  node({ id: 'social_media', name: 'Social Media', era: 'information', cost: 1100, description: 'Public life moves through networks of instant attention. Influence spreads through images, messages, and communities without borders.', prerequisites: ['professional_sports', 'globalization'], unlocks: [{ type: 'diplomacy', value: 'cultural_influence' }] }),
  node({ id: 'near_future_governance', name: 'Near-Future Governance', era: 'future', cost: 1280, description: 'Digital systems reshape how states listen, decide, and adapt. Governance becomes faster, more connected, and more contested.', prerequisites: ['social_media'], unlocks: [{ type: 'government', value: 'digital_democracy' }, { type: 'policySlot', value: 'wildcard' }], effects: [{ type: 'futureCultureHappiness', value: 1 }] }),
];

export function getCultureNodeById(id: string): CultureNode | undefined {
  return CULTURE_TREE.find((cultureNode) => cultureNode.id === id);
}

/** The culture node that unlocks a given unit, if any (e.g. Nationalism → Rebels). */
export function getRequiredCultureNodeForUnit(unitId: string): CultureNode | undefined {
  return CULTURE_TREE.find((cultureNode) =>
    (cultureNode.unlocks ?? []).some((unlock) => unlock.type === 'unit' && unlock.value === unitId),
  );
}

/** The culture node that unlocks a given building, if any. */
export function getRequiredCultureNodeForBuilding(buildingId: string): CultureNode | undefined {
  return CULTURE_TREE.find((cultureNode) =>
    (cultureNode.unlocks ?? []).some((unlock) => unlock.type === 'building' && unlock.value === buildingId),
  );
}
