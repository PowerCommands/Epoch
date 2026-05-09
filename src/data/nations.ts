export interface NationDefinition {
  id: string;
  name: string;
  color: string;
  secondaryColor: string;
}

export const NATION_DEFINITIONS: readonly NationDefinition[] = [
  { id: 'nation_england', name: 'England', color: '#4a90d9', secondaryColor: '#f2d479' },
  { id: 'nation_france', name: 'France', color: '#7bc67e', secondaryColor: '#f4efe2' },
  { id: 'nation_hre', name: 'Holy Roman Empire', color: '#e8c84a', secondaryColor: '#4a4030' },
  { id: 'nation_sweden', name: 'Sweden', color: '#e87c4a', secondaryColor: '#f3e3c4' },
  { id: 'nation_lithuania', name: 'Lithuania', color: '#c0392b', secondaryColor: '#d8b06a' },
  { id: 'nation_novgorod', name: 'Novgorod', color: '#16a085', secondaryColor: '#e7d7a8' },
  { id: 'nation_ottoman', name: 'Ottoman Empire', color: '#c44ae8', secondaryColor: '#7fd1c7' },
  { id: 'nation_spain', name: 'Spain', color: '#e84a4a', secondaryColor: '#f2d15c' },
  { id: 'nation_morocco_empire', name: 'Morocco', color: '#9b5f4b', secondaryColor: '#d9c39a' },
  { id: 'nation_usa', name: 'United States', color: '#2f80ed', secondaryColor: '#dfeaf8' },
  { id: 'nation_india', name: 'India', color: '#27ae60', secondaryColor: '#f3d27a' },
  { id: 'nation_china', name: 'China', color: '#d64541', secondaryColor: '#f0c46b' },
  { id: 'nation_taiwan', name: 'Taiwan', color: '#012169', secondaryColor: '#fe0000' },
  { id: 'nation_brazil', name: 'Brazil', color: '#009739', secondaryColor: '#ffdf00' },
  { id: 'nation_mali_empire', name: 'Mali Empire', color: '#b7950b', secondaryColor: '#5b4b2a' },
  { id: 'nation_mongolia', name: 'Mongolia', color: '#c49a2c', secondaryColor: '#3a2a14' },
  { id: 'nation_japan', name: 'Japan', color: '#ffffff', secondaryColor: '#bc002d' },
];

export function getNationDefinitionById(nationId: string): NationDefinition | undefined {
  return NATION_DEFINITIONS.find((nation) => nation.id === nationId);
}
