import type { ModifierSet } from '../types/modifiers';

export interface PolicyTreeDefinition {
  id: string;
  name: string;
  description?: string;
}

export interface PolicyDefinition {
  id: string;
  name: string;
  treeId: string;
  cost: number;
  prerequisites: string[];
  description: string;
  modifiers: ModifierSet;
}

function tree(input: PolicyTreeDefinition): PolicyTreeDefinition {
  return input;
}

function policy(input: PolicyDefinition): PolicyDefinition {
  return input;
}

export const TRADITION_TREE = tree({
  id: 'tradition',
  name: 'Tradition',
  description: 'Capital growth, culture, and stable core development.',
});

export const LIBERTY_TREE = tree({
  id: 'liberty',
  name: 'Liberty',
  description: 'Expansion and productive young settlements.',
});

export const HONOR_TREE = tree({
  id: 'honor',
  name: 'Honor',
  description: 'Disciplined state support through culture, gold, and production.',
});

export const ALL_POLICY_TREES: PolicyTreeDefinition[] = [
  TRADITION_TREE,
  LIBERTY_TREE,
  HONOR_TREE,
];

export const TRADITION_ANCESTRAL_HALL = policy({
  id: 'tradition_ancestral_hall',
  name: 'Ancestral Hall',
  treeId: TRADITION_TREE.id,
  cost: 30,
  prerequisites: [],
  description: 'Each city gains +1 culture and +5% food.',
  modifiers: { culturePerTurn: 1, foodPercent: 5 },
});

export const TRADITION_GREAT_COURT = policy({
  id: 'tradition_great_court',
  name: 'Great Court',
  treeId: TRADITION_TREE.id,
  cost: 45,
  prerequisites: [TRADITION_ANCESTRAL_HALL.id],
  description: 'Each city gains +1 happiness and +1 gold.',
  modifiers: { happinessPerTurn: 1, goldPerTurn: 1 },
});

export const TRADITION_SCHOLAR_PATRONAGE = policy({
  id: 'tradition_scholar_patronage',
  name: 'Scholar Patronage',
  treeId: TRADITION_TREE.id,
  cost: 60,
  prerequisites: [TRADITION_GREAT_COURT.id],
  description: 'Each city gains +1 science and +5% culture.',
  modifiers: { sciencePerTurn: 1, culturePercent: 5 },
});

export const LIBERTY_FRONTIER_SPIRIT = policy({
  id: 'liberty_frontier_spirit',
  name: 'Frontier Spirit',
  treeId: LIBERTY_TREE.id,
  cost: 30,
  prerequisites: [],
  description: 'Each city gains +1 production and +1 food.',
  modifiers: { productionPerTurn: 1, foodPerTurn: 1 },
});

export const LIBERTY_COLONIAL_ADMIN = policy({
  id: 'liberty_colonial_admin',
  name: 'Colonial Administration',
  treeId: LIBERTY_TREE.id,
  cost: 45,
  prerequisites: [LIBERTY_FRONTIER_SPIRIT.id],
  description: 'Each city gains +10% production.',
  modifiers: { productionPercent: 10 },
});

export const LIBERTY_CIVIC_GUILDS = policy({
  id: 'liberty_civic_guilds',
  name: 'Civic Guilds',
  treeId: LIBERTY_TREE.id,
  cost: 60,
  prerequisites: [LIBERTY_COLONIAL_ADMIN.id],
  description: 'Each city gains +1 culture and +1 gold.',
  modifiers: { culturePerTurn: 1, goldPerTurn: 1 },
});

export const HONOR_WAR_TRADITIONS = policy({
  id: 'honor_war_traditions',
  name: 'War Traditions',
  treeId: HONOR_TREE.id,
  cost: 30,
  prerequisites: [],
  description: 'Each city gains +1 production and +1 culture.',
  modifiers: { productionPerTurn: 1, culturePerTurn: 1 },
});

export const HONOR_STATE_ARMORIES = policy({
  id: 'honor_state_armories',
  name: 'State Armories',
  treeId: HONOR_TREE.id,
  cost: 45,
  prerequisites: [HONOR_WAR_TRADITIONS.id],
  description: 'Each city gains +10% gold and +1 happiness.',
  modifiers: { goldPercent: 10, happinessPerTurn: 1 },
});

export const HONOR_CIVIC_DISCIPLINE = policy({
  id: 'honor_civic_discipline',
  name: 'Civic Discipline',
  treeId: HONOR_TREE.id,
  cost: 60,
  prerequisites: [HONOR_STATE_ARMORIES.id],
  description: 'Each city gains +1 science and +5% production.',
  modifiers: { sciencePerTurn: 1, productionPercent: 5 },
});

export const ALL_POLICIES: PolicyDefinition[] = [
  TRADITION_ANCESTRAL_HALL,
  TRADITION_GREAT_COURT,
  TRADITION_SCHOLAR_PATRONAGE,
  LIBERTY_FRONTIER_SPIRIT,
  LIBERTY_COLONIAL_ADMIN,
  LIBERTY_CIVIC_GUILDS,
  HONOR_WAR_TRADITIONS,
  HONOR_STATE_ARMORIES,
  HONOR_CIVIC_DISCIPLINE,
];

export function getPolicyById(id: string): PolicyDefinition | undefined {
  return ALL_POLICIES.find((policyDef) => policyDef.id === id);
}

export function getPolicyTreeById(id: string): PolicyTreeDefinition | undefined {
  return ALL_POLICY_TREES.find((treeDef) => treeDef.id === id);
}
