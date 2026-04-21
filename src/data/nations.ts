export interface NationDefinition {
  id: string;
  name: string;
  color: string;
}

export const NATION_DEFINITIONS: readonly NationDefinition[] = [
  { id: 'nation_england', name: 'England', color: '#4a90d9' },
  { id: 'nation_france', name: 'France', color: '#7bc67e' },
  { id: 'nation_hre', name: 'Holy Roman Empire', color: '#e8c84a' },
  { id: 'nation_sweden', name: 'Sweden', color: '#e87c4a' },
  { id: 'nation_lithuania', name: 'Lithuania', color: '#c0392b' },
  { id: 'nation_novgorod', name: 'Novgorod', color: '#16a085' },
  { id: 'nation_ottoman', name: 'Ottoman Empire', color: '#c44ae8' },
  { id: 'nation_spain', name: 'Spain', color: '#e84a4a' },
  { id: 'nation_morocco_empire', name: 'Morocco', color: '#9b5f4b' },
  { id: 'nation_north_america', name: 'North America', color: '#2f80ed' },
  { id: 'nation_india', name: 'India', color: '#27ae60' },
  { id: 'nation_china', name: 'China', color: '#d64541' },
  { id: 'nation_south_america', name: 'South America', color: '#f2994a' },
  { id: 'nation_mali_empire', name: 'Mali Empire', color: '#b7950b' },
];

export function getNationDefinitionById(nationId: string): NationDefinition | undefined {
  return NATION_DEFINITIONS.find((nation) => nation.id === nationId);
}
