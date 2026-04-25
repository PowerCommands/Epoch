import type { WonderType } from '../entities/Wonder';

export const PYRAMIDS: WonderType = {
  id: 'pyramids',
  name: 'Pyramids',
  era: 'ancient',
  productionCost: 200,
  description: 'Ancient monuments that boost production across the empire.',
  modifiers: { productionPerTurn: 1 },
  requiredTechnologyId: 'masonry',
  scope: 'nation',
  placement: { landOnly: true },
};

export const GREAT_LIGHTHOUSE: WonderType = {
  id: 'great_lighthouse',
  name: 'Great Lighthouse',
  era: 'ancient',
  productionCost: 200,
  description: 'A beacon for naval power and trade.',
  modifiers: { goldPerTurn: 1 },
  requiredTechnologyId: 'sailing',
  scope: 'nation',
  placement: { requiresCoast: true },
};

export const COLOSSUS: WonderType = {
  id: 'colossus',
  name: 'Colossus',
  era: 'ancient',
  productionCost: 200,
  description: 'A bronze giant that draws gold to the realm.',
  modifiers: { goldPerTurn: 2 },
  requiredTechnologyId: 'bronze_working',
  scope: 'nation',
  placement: { requiresCoast: true },
};

export const HANGING_GARDENS: WonderType = {
  id: 'hanging_gardens',
  name: 'Hanging Gardens',
  era: 'ancient',
  productionCost: 200,
  description: 'Lush gardens that delight the people and feed the cities.',
  modifiers: { foodPerTurn: 1, happinessPerTurn: 2 },
  requiredTechnologyId: 'mathematics',
  scope: 'nation',
};

export const GREAT_WALL: WonderType = {
  id: 'great_wall',
  name: 'Great Wall',
  era: 'classical',
  productionCost: 250,
  description: 'A massive defensive structure that inspires the nation.',
  modifiers: { culturePerTurn: 1 },
  requiredTechnologyId: 'construction',
  scope: 'nation',
};

export const ORACLE: WonderType = {
  id: 'oracle',
  name: 'Oracle',
  era: 'classical',
  productionCost: 200,
  description: 'A sacred shrine that yields culture and insight.',
  modifiers: { culturePerTurn: 1, sciencePerTurn: 1 },
  requiredTechnologyId: 'philosophy',
  scope: 'nation',
};

export const ALL_WONDERS: WonderType[] = [
  PYRAMIDS,
  GREAT_LIGHTHOUSE,
  COLOSSUS,
  HANGING_GARDENS,
  GREAT_WALL,
  ORACLE,
];

export function getWonderById(id: string): WonderType | undefined {
  return ALL_WONDERS.find((wonder) => wonder.id === id);
}
