import type { WonderType } from '../entities/Wonder';

export const PYRAMIDS: WonderType = {
  id: 'pyramids',
  name: 'Pyramids',
  era: 'ancient',
  productionCost: 380,
  description: 'Ancient monuments that boost production across the empire.',
  modifiers: { productionPerTurn: 1 },
  requiredTechnologyId: 'masonry',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 6,
};

export const GREAT_LIGHTHOUSE: WonderType = {
  id: 'great_lighthouse',
  name: 'Great Lighthouse',
  era: 'ancient',
  productionCost: 360,
  description: 'A beacon for naval power and trade.',
  modifiers: { goldPerTurn: 1 },
  requiredTechnologyId: 'sailing',
  scope: 'nation',
  placement: { requiresCoast: true },
  minimumPopulation: 6,
};

export const COLOSSUS: WonderType = {
  id: 'colossus',
  name: 'Colossus',
  era: 'ancient',
  productionCost: 360,
  description: 'A bronze giant that draws gold to the realm.',
  modifiers: { goldPerTurn: 2 },
  requiredTechnologyId: 'bronze_working',
  scope: 'nation',
  placement: { requiresCoast: true },
  minimumPopulation: 6,
};

export const HANGING_GARDENS: WonderType = {
  id: 'hanging_gardens',
  name: 'Hanging Gardens',
  era: 'ancient',
  productionCost: 360,
  description: 'Lush gardens that delight the people and feed the cities.',
  modifiers: { foodPerTurn: 1, happinessPerTurn: 2 },
  requiredTechnologyId: 'mathematics',
  scope: 'nation',
  minimumPopulation: 6,
};

export const GREAT_WALL: WonderType = {
  id: 'great_wall',
  name: 'Great Wall',
  era: 'classical',
  productionCost: 500,
  description: 'A massive defensive structure that inspires the nation.',
  modifiers: { culturePerTurn: 1 },
  requiredTechnologyId: 'construction',
  scope: 'nation',
  minimumPopulation: 8,
};

export const ORACLE: WonderType = {
  id: 'oracle',
  name: 'Oracle',
  era: 'classical',
  productionCost: 400,
  description: 'A sacred shrine that yields culture and insight.',
  modifiers: { culturePerTurn: 1, sciencePerTurn: 1 },
  requiredTechnologyId: 'philosophy',
  scope: 'nation',
  minimumPopulation: 8,
};

export const STONEHENGE: WonderType = {
  id: 'stonehenge',
  name: 'Stonehenge',
  era: 'ancient',
  productionCost: 330,
  description: 'Ancient standing stones that strengthen early cultural identity.',
  modifiers: { culturePerTurn: 2, happinessPerTurn: 1 },
  requiredTechnologyId: 'calendar',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 6,
};

export const ANGKOR_WAT: WonderType = {
  id: 'angkor-wat',
  name: 'Angkor Wat',
  era: 'medieval',
  productionCost: 750,
  description: 'A vast temple complex that projects faith, order, and cultural authority.',
  modifiers: { culturePerTurn: 2, foodPerTurn: 1, happinessPerTurn: 1 },
  requiredTechnologyId: 'theology',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 10,
};

export const HAGIA_SOPHIA: WonderType = {
  id: 'hagia-sophia',
  name: 'Hagia Sophia',
  era: 'medieval',
  productionCost: 800,
  description: 'A monumental holy site where architecture, faith, and imperial prestige meet.',
  modifiers: { culturePerTurn: 2, sciencePerTurn: 1, happinessPerTurn: 1 },
  requiredTechnologyId: 'theology',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 10,
};

export const MACHU_PICCHU: WonderType = {
  id: 'machu-picchu',
  name: 'Machu Picchu',
  era: 'medieval',
  productionCost: 800,
  description: 'A mountain sanctuary that turns remote terrain into cultural and economic prestige.',
  modifiers: { goldPerTurn: 2, culturePerTurn: 1, productionPerTurn: 1 },
  requiredTechnologyId: 'currency',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 10,
};

export const FORBIDDEN_CITY: WonderType = {
  id: 'forbidden-city',
  name: 'Forbidden City',
  era: 'renaissance',
  productionCost: 1200,
  description: 'An imperial palace complex that concentrates administration, ceremony, and authority.',
  modifiers: { culturePerTurn: 2, goldPerTurn: 2, happinessPerTurn: 1 },
  requiredTechnologyId: 'banking',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 12,
};

export const TAJ_MAHAL: WonderType = {
  id: 'taj-mahal',
  name: 'Taj Mahal',
  era: 'renaissance',
  productionCost: 1300,
  description: 'A marble monument of dynastic memory, prestige, and cultural splendor.',
  modifiers: { culturePerTurn: 3, happinessPerTurn: 2 },
  requiredTechnologyId: 'printing_press',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 12,
};

// Late-game wonders. Note: each wonder `id` must match its sprite filename in
// public/assets/sprites/wonders/<id>.png (getWonderSpritePath derives the path
// directly from the id), so the hyphenated ids below mirror the asset files.
export const EIFFEL_TOWER: WonderType = {
  id: 'eiffel_tower',
  name: 'Eiffel Tower',
  era: 'industrial',
  productionCost: 1450,
  description: 'Completed in 1889, the Eiffel Tower became a global symbol of engineering ambition, modern culture, and national prestige.',
  modifiers: { culturePerTurn: 2 },
  requiredTechnologyId: 'radio',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 15,
};

export const STATUE_OF_LIBERTY: WonderType = {
  id: 'statue_of_liberty',
  name: 'Statue of Liberty',
  era: 'industrial',
  productionCost: 1450,
  description: 'A monumental symbol of liberty and opportunity, the Statue of Liberty became an enduring icon of democracy and migration.',
  modifiers: { happinessPerTurn: 2 },
  requiredTechnologyId: 'replaceable_parts',
  scope: 'nation',
  placement: { requiresCoast: true },
  minimumPopulation: 15,
};

export const BIG_BEN: WonderType = {
  id: 'big-ben',
  name: 'Big Ben',
  era: 'industrial',
  productionCost: 1500,
  description: 'The great clock tower of Westminster became a symbol of parliamentary government, national administration, and imperial confidence.',
  modifiers: { goldPerTurn: 2 },
  requiredTechnologyId: 'industrialization',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 15,
};

export const BRANDENBURG_GATE: WonderType = {
  id: 'brandenburg-gate',
  name: 'Brandenburg Gate',
  era: 'industrial',
  productionCost: 1450,
  description: 'A neoclassical monument that came to symbolize power, division, and eventual reunification at the heart of Europe.',
  modifiers: { culturePerTurn: 2 },
  requiredTechnologyId: 'replaceable_parts',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 15,
};

export const SYDNEY_OPERA_HOUSE: WonderType = {
  id: 'sydney-opera-house',
  name: 'Sydney Opera House',
  era: 'modern',
  productionCost: 1700,
  description: 'A masterpiece of modern architecture, the Sydney Opera House became one of the world\'s most recognizable cultural landmarks.',
  modifiers: { culturePerTurn: 3 },
  requiredTechnologyId: 'telecommunications',
  scope: 'nation',
  placement: { requiresCoast: true },
  minimumPopulation: 18,
};

export const EMPIRE_STATE_BUILDING: WonderType = {
  id: 'empire-state-building',
  name: 'Empire State Building',
  era: 'modern',
  productionCost: 1750,
  description: 'A towering symbol of urban ambition, economic resilience, and the rise of the modern metropolis.',
  modifiers: { goldPerTurn: 2, productionPerTurn: 1 },
  requiredTechnologyId: 'computers',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 18,
};

export const PANAMA_CANAL: WonderType = {
  id: 'panama-canal',
  name: 'Panama Canal',
  era: 'modern',
  productionCost: 1950,
  description: 'A monumental engineering project that reshaped global trade by linking the Atlantic and Pacific Oceans.',
  modifiers: { goldPerTurn: 3 },
  requiredTechnologyId: 'globalization',
  scope: 'nation',
  placement: { requiresCoast: true },
  minimumPopulation: 18,
};

export const HOOVER_DAM: WonderType = {
  id: 'hoover-dam',
  name: 'Hoover Dam',
  era: 'modern',
  productionCost: 1900,
  description: 'A massive hydroelectric and infrastructure project that brought power, water, and industrial growth to the American Southwest.',
  modifiers: { productionPerTurn: 2 },
  requiredTechnologyId: 'nuclear_fission',
  scope: 'nation',
  placement: { landOnly: true },
  minimumPopulation: 18,
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
  EIFFEL_TOWER,
  STATUE_OF_LIBERTY,
  BIG_BEN,
  BRANDENBURG_GATE,
  SYDNEY_OPERA_HOUSE,
  EMPIRE_STATE_BUILDING,
  PANAMA_CANAL,
  HOOVER_DAM,
];

export function getWonderById(id: string): WonderType | undefined {
  return ALL_WONDERS.find((wonder) => wonder.id === id);
}
