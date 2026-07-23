/** Focused deterministic tests for progressive technology-era research costs. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getGameSpeedById } from '../src/data/gameSpeeds.ts';
import {
  TECH_ERA_COST_MULTIPLIERS,
  getEffectiveTechnologyCost,
  getTechnologyEraCostMultiplier,
} from '../src/data/technologyResearchCosts.ts';
import { getTechnologyById, type Era, type TechnologyDefinition } from '../src/data/technologies.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { applySavedResearchState } from '../src/systems/SaveLoadService.ts';
import { NationHudDataProvider } from '../src/ui/hud/NationHudDataProvider.ts';

const EXPECTED_MULTIPLIERS: Readonly<Record<Era, number>> = {
  ancient: 1.00,
  classical: 1.00,
  medieval: 1.10,
  renaissance: 1.25,
  industrial: 1.50,
  modern: 1.80,
  atomic: 2.20,
  information: 2.40,
  future: 2.60,
};

function makeTechnology(era: Era, cost = 101): TechnologyDefinition {
  return {
    id: `test_${era}`,
    name: `Test ${era}`,
    era,
    cost,
    description: '',
    prerequisites: [],
    leadsTo: [],
    unlocks: [],
  };
}

function makeResearchHarness(input: {
  nationId: string;
  isHuman: boolean;
  technologyId: string;
  progress: number;
}) {
  const nationManager = new NationManager();
  const nation = new Nation({
    id: input.nationId,
    name: input.nationId,
    color: 0xffffff,
    isHuman: input.isHuman,
    currentResearchTechId: input.technologyId,
    researchProgress: input.progress,
  });
  nationManager.addNation(nation);
  const cityManager = new CityManager();
  const researchSystem = new ResearchSystem(nationManager, cityManager, () => 1);
  return { nation, nationManager, cityManager, researchSystem };
}

test('all technology eras use the centralized configured multipliers', () => {
  assert.deepEqual(TECH_ERA_COST_MULTIPLIERS, EXPECTED_MULTIPLIERS);
  for (const [era, multiplier] of Object.entries(EXPECTED_MULTIPLIERS) as Array<[Era, number]>) {
    assert.equal(getTechnologyEraCostMultiplier(era), multiplier);
  }
});

test('effective cost applies game speed, then era scaling, with nearest-integer rounding', () => {
  const standard = getGameSpeedById('standard');
  // 101 × 0.50 rounds to 51 under the existing speed rule; 51 × 1.10 = 56.1 → 56.
  assert.equal(getEffectiveTechnologyCost(makeTechnology('medieval'), standard), 56);
});

test('technology definitions retain their existing base costs', () => {
  const technology = getTechnologyById('combined_arms')!;
  const originalBaseCost = technology.cost;
  const effectiveCost = getEffectiveTechnologyCost(technology, getGameSpeedById('standard'));
  assert.equal(technology.cost, originalBaseCost);
  assert.equal(originalBaseCost, 6100);
  assert.equal(effectiveCost, 6710);
});

test('human research cannot finish at base cost and completes at effective cost', () => {
  const technology = getTechnologyById('combined_arms')!;
  const { nation, researchSystem } = makeResearchHarness({
    nationId: 'human',
    isHuman: true,
    technologyId: technology.id,
    progress: technology.cost,
  });
  const effectiveCost = researchSystem.getEffectiveCost(technology.id);
  assert.ok(effectiveCost > technology.cost);

  researchSystem.advanceResearchForNation(nation.id);
  assert.equal(nation.currentResearchTechId, technology.id);
  assert.equal(nation.researchedTechIds.includes(technology.id), false);

  nation.researchProgress = effectiveCost - 1;
  researchSystem.advanceResearchForNation(nation.id);
  assert.equal(nation.currentResearchTechId, undefined);
  assert.equal(nation.researchedTechIds.includes(technology.id), true);
});

test('AI research completion uses the same effective cost without a nation modifier', () => {
  const technology = getTechnologyById('combined_arms')!;
  const human = makeResearchHarness({
    nationId: 'human',
    isHuman: true,
    technologyId: technology.id,
    progress: 0,
  });
  const ai = makeResearchHarness({
    nationId: 'ai',
    isHuman: false,
    technologyId: technology.id,
    progress: 0,
  });
  const effectiveCost = human.researchSystem.getEffectiveCost(technology.id);
  assert.equal(ai.researchSystem.getEffectiveCost(technology.id), effectiveCost);

  ai.nation.researchProgress = effectiveCost - 1;
  ai.researchSystem.advanceResearchForNation(ai.nation.id);
  assert.equal(ai.nation.researchedTechIds.includes(technology.id), true);
});

test('research HUD state displays and calculates progress from effective cost', () => {
  const technology = getTechnologyById('biology')!;
  const { nation, nationManager, cityManager, researchSystem } = makeResearchHarness({
    nationId: 'hud',
    isHuman: true,
    technologyId: technology.id,
    progress: 750,
  });
  const provider = new NationHudDataProvider(
    nationManager,
    cityManager,
    {} as never,
    researchSystem,
    {} as never,
    {} as never,
    {} as never,
  );
  const state = provider.getResearchState(nation.id);
  const effectiveCost = researchSystem.getEffectiveCost(technology.id);
  assert.equal(state.cost, effectiveCost);
  assert.equal(state.progressPercent, Math.round((750 / effectiveCost) * 100));
});

test('existing and saved accumulated research remains an absolute value', () => {
  const technology = getTechnologyById('biology')!;
  const { nation, researchSystem } = makeResearchHarness({
    nationId: 'saved',
    isHuman: true,
    technologyId: technology.id,
    progress: 700,
  });
  assert.equal(nation.researchProgress, 700);
  assert.ok(researchSystem.getEffectiveCost(technology.id) > 700);

  applySavedResearchState(nation, {
    currentResearchTechId: technology.id,
    researchProgress: 913,
  });
  assert.equal(nation.currentResearchTechId, technology.id);
  assert.equal(nation.researchProgress, 913);
});
