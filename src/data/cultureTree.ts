import type { CultureNode } from '../types/CultureNode';

function node(input: CultureNode): CultureNode {
  return input;
}

export const CULTURE_TREE: CultureNode[] = [
  node({ id: 'code_of_laws', name: 'Code of Laws', era: 'ancient', cost: 16, unlocks: [{ type: 'government', value: 'chiefdom' }, { type: 'policySlot', value: 'economic' }] }),
  node({ id: 'craftsmanship', name: 'Craftsmanship', era: 'ancient', cost: 28, prerequisites: ['code_of_laws'], unlocks: [{ type: 'policySlot', value: 'military' }] }),
  node({ id: 'foreign_trade', name: 'Foreign Trade', era: 'ancient', cost: 28, prerequisites: ['code_of_laws'], unlocks: [{ type: 'diplomacy', value: 'trade_delegations' }] }),
  node({ id: 'early_empire', name: 'Early Empire', era: 'ancient', cost: 42, prerequisites: ['craftsmanship'], unlocks: [{ type: 'government', value: 'tribal_council' }] }),
  node({ id: 'state_workforce', name: 'State Workforce', era: 'ancient', cost: 42, prerequisites: ['craftsmanship'], unlocks: [{ type: 'building', value: 'monument' }] }),
  node({ id: 'mysticism', name: 'Mysticism', era: 'ancient', cost: 48, prerequisites: ['foreign_trade'], unlocks: [{ type: 'policySlot', value: 'wildcard' }] }),
  node({ id: 'military_tradition', name: 'Military Tradition', era: 'classical', cost: 70, prerequisites: ['early_empire'], unlocks: [{ type: 'unit', value: 'horseman' }] }),
  node({ id: 'political_philosophy', name: 'Political Philosophy', era: 'classical', cost: 78, prerequisites: ['early_empire', 'state_workforce'], unlocks: [{ type: 'government', value: 'classical_republic' }, { type: 'government', value: 'autocracy' }] }),
  node({ id: 'drama_civics', name: 'Drama and Poetry', era: 'classical', cost: 86, prerequisites: ['mysticism'], unlocks: [{ type: 'building', value: 'amphitheater' }] }),
  node({ id: 'games_recreation', name: 'Games and Recreation', era: 'classical', cost: 92, prerequisites: ['state_workforce'], unlocks: [{ type: 'building', value: 'arena' }] }),
  node({ id: 'defensive_tactics', name: 'Defensive Tactics', era: 'classical', cost: 100, prerequisites: ['military_tradition', 'political_philosophy'], unlocks: [{ type: 'policySlot', value: 'military' }] }),
  node({ id: 'recorded_history', name: 'Recorded History', era: 'classical', cost: 108, prerequisites: ['drama_civics', 'political_philosophy'], unlocks: [{ type: 'building', value: 'library' }] }),
  node({ id: 'theology_civics', name: 'Theology', era: 'medieval', cost: 135, prerequisites: ['drama_civics'], unlocks: [{ type: 'government', value: 'theocracy' }] }),
  node({ id: 'feudalism', name: 'Feudalism', era: 'medieval', cost: 150, prerequisites: ['defensive_tactics'], unlocks: [{ type: 'policySlot', value: 'economic' }] }),
  node({ id: 'civil_service_civics', name: 'Civil Service', era: 'medieval', cost: 160, prerequisites: ['recorded_history'], unlocks: [{ type: 'diplomacy', value: 'alliances' }] }),
  node({ id: 'mercenaries', name: 'Mercenaries', era: 'medieval', cost: 170, prerequisites: ['feudalism'], unlocks: [{ type: 'unit', value: 'mercenary_company' }] }),
  node({ id: 'medieval_faires', name: 'Medieval Faires', era: 'medieval', cost: 182, prerequisites: ['feudalism', 'civil_service_civics'], unlocks: [{ type: 'building', value: 'market' }] }),
  node({ id: 'guilds', name: 'Guilds', era: 'medieval', cost: 195, prerequisites: ['civil_service_civics'], unlocks: [{ type: 'policySlot', value: 'economic' }] }),
  node({ id: 'diplomatic_service', name: 'Diplomatic Service', era: 'renaissance', cost: 230, prerequisites: ['guilds'], unlocks: [{ type: 'diplomacy', value: 'embassies' }] }),
  node({ id: 'exploration', name: 'Exploration', era: 'renaissance', cost: 245, prerequisites: ['medieval_faires'], unlocks: [{ type: 'government', value: 'merchant_republic' }] }),
  node({ id: 'humanism', name: 'Humanism', era: 'renaissance', cost: 260, prerequisites: ['guilds'], unlocks: [{ type: 'building', value: 'museum' }] }),
  node({ id: 'reformed_church', name: 'Reformed Church', era: 'renaissance', cost: 275, prerequisites: ['theology_civics', 'humanism'], unlocks: [{ type: 'government', value: 'reformed_theocracy' }] }),
  node({ id: 'mercantilism', name: 'Mercantilism', era: 'renaissance', cost: 300, prerequisites: ['exploration'], unlocks: [{ type: 'policySlot', value: 'economic' }] }),
  node({ id: 'enlightenment', name: 'The Enlightenment', era: 'industrial', cost: 340, prerequisites: ['humanism', 'diplomatic_service'], unlocks: [{ type: 'building', value: 'university' }] }),
  node({ id: 'colonialism', name: 'Colonialism', era: 'industrial', cost: 360, prerequisites: ['mercantilism'], unlocks: [{ type: 'diplomacy', value: 'colonial_charters' }] }),
  node({ id: 'civil_engineering', name: 'Civil Engineering', era: 'industrial', cost: 385, prerequisites: ['enlightenment'], unlocks: [{ type: 'building', value: 'public_works' }] }),
  node({ id: 'nationalism', name: 'Nationalism', era: 'industrial', cost: 420, prerequisites: ['colonialism', 'civil_engineering'], unlocks: [{ type: 'unit', value: 'corps' }] }),
  node({ id: 'urbanization', name: 'Urbanization', era: 'modern', cost: 470, prerequisites: ['civil_engineering'], unlocks: [{ type: 'building', value: 'neighborhood' }] }),
  node({ id: 'ideology', name: 'Ideology', era: 'modern', cost: 510, prerequisites: ['nationalism'], unlocks: [{ type: 'government', value: 'ideological_state' }] }),
  node({ id: 'suffrage', name: 'Suffrage', era: 'modern', cost: 545, prerequisites: ['urbanization', 'ideology'], unlocks: [{ type: 'government', value: 'democracy' }] }),
  node({ id: 'totalitarianism', name: 'Totalitarianism', era: 'modern', cost: 545, prerequisites: ['ideology'], unlocks: [{ type: 'government', value: 'fascism' }] }),
  node({ id: 'class_struggle', name: 'Class Struggle', era: 'modern', cost: 545, prerequisites: ['ideology'], unlocks: [{ type: 'government', value: 'communism' }] }),
  node({ id: 'mobilization', name: 'Mobilization', era: 'atomic', cost: 620, prerequisites: ['nationalism'], unlocks: [{ type: 'unit', value: 'army' }] }),
  node({ id: 'cold_war', name: 'Cold War', era: 'atomic', cost: 690, prerequisites: ['suffrage', 'totalitarianism', 'class_struggle'], unlocks: [{ type: 'diplomacy', value: 'research_agreements' }] }),
  node({ id: 'professional_sports', name: 'Professional Sports', era: 'atomic', cost: 730, prerequisites: ['urbanization'], unlocks: [{ type: 'building', value: 'stadium' }] }),
  node({ id: 'globalization', name: 'Globalization', era: 'information', cost: 830, prerequisites: ['cold_war'], unlocks: [{ type: 'diplomacy', value: 'world_congress' }] }),
  node({ id: 'social_media', name: 'Social Media', era: 'information', cost: 880, prerequisites: ['professional_sports', 'globalization'], unlocks: [{ type: 'diplomacy', value: 'cultural_influence' }] }),
  node({ id: 'near_future_governance', name: 'Near-Future Governance', era: 'future', cost: 980, prerequisites: ['social_media'], unlocks: [{ type: 'government', value: 'digital_democracy' }] }),
];

export function getCultureNodeById(id: string): CultureNode | undefined {
  return CULTURE_TREE.find((cultureNode) => cultureNode.id === id);
}
