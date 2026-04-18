export type TechnologyUnlockKind = 'improvement';

export interface TechnologyUnlock {
  kind: TechnologyUnlockKind;
  id: string;
}

export interface TechnologyDefinition {
  id: string;
  name: string;
  cost: number;
  prerequisites: string[];
  unlocks: TechnologyUnlock[];
}

export const IRRIGATION: TechnologyDefinition = {
  id: 'irrigation',
  name: 'Irrigation',
  cost: 20,
  prerequisites: [],
  unlocks: [{ kind: 'improvement', id: 'farm' }],
};

export const FORESTRY: TechnologyDefinition = {
  id: 'forestry',
  name: 'Forestry',
  cost: 20,
  prerequisites: [],
  unlocks: [{ kind: 'improvement', id: 'lumber_mill' }],
};

export const MASONRY: TechnologyDefinition = {
  id: 'masonry',
  name: 'Masonry',
  cost: 25,
  prerequisites: [],
  unlocks: [{ kind: 'improvement', id: 'mine' }],
};

export const CULTIVATION: TechnologyDefinition = {
  id: 'cultivation',
  name: 'Cultivation',
  cost: 20,
  prerequisites: [],
  unlocks: [{ kind: 'improvement', id: 'plantation' }],
};

export const ALL_TECHNOLOGIES: TechnologyDefinition[] = [
  IRRIGATION,
  FORESTRY,
  MASONRY,
  CULTIVATION,
];

export function getTechnologyById(id: string): TechnologyDefinition | undefined {
  return ALL_TECHNOLOGIES.find((technology) => technology.id === id);
}

export function hasTechnologyDefinition(id: string): boolean {
  return getTechnologyById(id) !== undefined;
}
