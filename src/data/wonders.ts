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

export const STONEHENGE: WonderType = {
  id: 'stonehenge',
  name: 'Stonehenge',
  era: 'ancient',
  productionCost: 180,
  description: 'Ancient standing stones that strengthen early cultural identity.',
  modifiers: { culturePerTurn: 2, happinessPerTurn: 1 },
  requiredTechnologyId: 'calendar',
  scope: 'nation',
  placement: { landOnly: true },
};

export const ANGKOR_WAT: WonderType = {
  id: 'angkor-wat',
  name: 'Angkor Wat',
  era: 'medieval',
  productionCost: 300,
  description: 'A vast temple complex that projects faith, order, and cultural authority.',
  modifiers: { culturePerTurn: 2, foodPerTurn: 1, happinessPerTurn: 1 },
  requiredTechnologyId: 'theology',
  scope: 'nation',
  placement: { landOnly: true },
};

export const HAGIA_SOPHIA: WonderType = {
  id: 'hagia-sophia',
  name: 'Hagia Sophia',
  era: 'medieval',
  productionCost: 320,
  description: 'A monumental holy site where architecture, faith, and imperial prestige meet.',
  modifiers: { culturePerTurn: 2, sciencePerTurn: 1, happinessPerTurn: 1 },
  requiredTechnologyId: 'theology',
  scope: 'nation',
  placement: { landOnly: true },
};

export const MACHU_PICCHU: WonderType = {
  id: 'machu-picchu',
  name: 'Machu Picchu',
  era: 'medieval',
  productionCost: 325,
  description: 'A mountain sanctuary that turns remote terrain into cultural and economic prestige.',
  modifiers: { goldPerTurn: 2, culturePerTurn: 1, productionPerTurn: 1 },
  requiredTechnologyId: 'currency',
  scope: 'nation',
  placement: { landOnly: true },
};

export const FORBIDDEN_CITY: WonderType = {
  id: 'forbidden-city',
  name: 'Forbidden City',
  era: 'renaissance',
  productionCost: 450,
  description: 'An imperial palace complex that concentrates administration, ceremony, and authority.',
  modifiers: { culturePerTurn: 2, goldPerTurn: 2, happinessPerTurn: 1 },
  requiredTechnologyId: 'banking',
  scope: 'nation',
  placement: { landOnly: true },
};

export const TAJ_MAHAL: WonderType = {
  id: 'taj-mahal',
  name: 'Taj Mahal',
  era: 'renaissance',
  productionCost: 475,
  description: 'A marble monument of dynastic memory, prestige, and cultural splendor.',
  modifiers: { culturePerTurn: 3, happinessPerTurn: 2 },
  requiredTechnologyId: 'printing_press',
  scope: 'nation',
  placement: { landOnly: true },
};

export const ALL_WONDERS: WonderType[] = [
  PYRAMIDS,
  GREAT_LIGHTHOUSE,
  COLOSSUS,
  HANGING_GARDENS,
  GREAT_WALL,
  ORACLE,
  STONEHENGE,
  ANGKOR_WAT,
  HAGIA_SOPHIA,
  MACHU_PICCHU,
  FORBIDDEN_CITY,
  TAJ_MAHAL,
];

export function getWonderById(id: string): WonderType | undefined {
  return ALL_WONDERS.find((wonder) => wonder.id === id);
}
