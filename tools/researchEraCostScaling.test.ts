/** Focused deterministic tests for progressive technology-era research costs. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getGameSpeedById } from '../src/data/gameSpeeds.ts';
import {
  AHEAD_OF_TIME_EXPONENT,
  AHEAD_OF_TIME_REFERENCE_PENALTY,
  AHEAD_OF_TIME_REFERENCE_YEARS,
  AHEAD_OF_TIME_TAIL_START_YEARS,
  AHEAD_OF_TIME_TAIL_STRENGTH,
  MAX_AHEAD_OF_TIME_MULTIPLIER,
  TECH_ERA_COST_MULTIPLIERS,
  getAheadOfTimeResearchCostMultiplier,
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
  currentYear?: number;
  researchedTechIds?: string[];
}) {
  const nationManager = new NationManager();
  const nation = new Nation({
    id: input.nationId,
    name: input.nationId,
    color: 0xffffff,
    isHuman: input.isHuman,
    currentResearchTechId: input.technologyId,
    researchProgress: input.progress,
    researchedTechIds: input.researchedTechIds,
  });
  nationManager.addNation(nation);
  const cityManager = new CityManager();
  const researchSystem = new ResearchSystem(
    nationManager,
    cityManager,
    () => 1,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    () => input.currentYear ?? Number.POSITIVE_INFINITY,
  );
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

test('timeline multiplier is 1 after and exactly at the canonical era start', () => {
  assert.equal(getAheadOfTimeResearchCostMultiplier('industrial', 1750), 1);
  assert.equal(getAheadOfTimeResearchCostMultiplier('industrial', 1700), 1);
});

test('timeline multiplier follows the configured smooth ahead-of-time curve', () => {
  assert.equal(AHEAD_OF_TIME_REFERENCE_YEARS, 100);
  assert.equal(AHEAD_OF_TIME_REFERENCE_PENALTY, 0.7);
  assert.equal(AHEAD_OF_TIME_EXPONENT, 1.5);
  assert.equal(AHEAD_OF_TIME_TAIL_START_YEARS, 150);
  assert.equal(AHEAD_OF_TIME_TAIL_STRENGTH, 1.53);
  assert.equal(MAX_AHEAD_OF_TIME_MULTIPLIER, 8);

  const fiftyYearsAhead = getAheadOfTimeResearchCostMultiplier('industrial', 1650);
  const centuryAhead = getAheadOfTimeResearchCostMultiplier('industrial', 1600);
  const centuryAndHalfAhead = getAheadOfTimeResearchCostMultiplier('industrial', 1550);
  const twoCenturiesAhead = getAheadOfTimeResearchCostMultiplier('industrial', 1500);

  assert.ok(fiftyYearsAhead > 1.2 && fiftyYearsAhead < 1.3);
  assert.ok(Math.abs(centuryAhead - 1.7) < 1e-10);
  assert.ok(Math.abs(centuryAndHalfAhead - 2.22) < 0.1);
  assert.ok(Math.abs(twoCenturiesAhead - 3.3) < 0.1);
});

test('timeline multiplier reaches and remains at the exact 8x ceiling', () => {
  assert.equal(getAheadOfTimeResearchCostMultiplier('industrial', 1400), 8);
  assert.equal(getAheadOfTimeResearchCostMultiplier('industrial', 1350), 8);
  assert.equal(getAheadOfTimeResearchCostMultiplier('industrial', 1200), 8);
  assert.equal(getAheadOfTimeResearchCostMultiplier('future', 1901), 8);
});

test('timeline multiplier is monotonic until the cap and never exceeds it', () => {
  const yearsAhead = [0, 25, 50, 100, 150, 200, 250, 300, 350, 500, 1000];
  const multipliers = yearsAhead.map((ahead) => (
    getAheadOfTimeResearchCostMultiplier('industrial', 1700 - ahead)
  ));
  for (let index = 1; index < multipliers.length; index += 1) {
    assert.ok(multipliers[index] >= multipliers[index - 1]);
  }
  assert.ok(multipliers.every((multiplier) => multiplier <= MAX_AHEAD_OF_TIME_MULTIPLIER));
});

test('different nations receive the same timeline cost in the same year', () => {
  const technology = getTechnologyById('combined_arms')!;
  const human = makeResearchHarness({
    nationId: 'human',
    isHuman: true,
    technologyId: technology.id,
    progress: 0,
    currentYear: 1800,
  });
  const ai = makeResearchHarness({
    nationId: 'ai',
    isHuman: false,
    technologyId: technology.id,
    progress: 0,
    currentYear: 1800,
  });
  assert.equal(
    human.researchSystem.getEffectiveCost(technology.id),
    ai.researchSystem.getEffectiveCost(technology.id),
  );
});

test('technology era, not the nation current era, determines timeline resistance', () => {
  const technology = getTechnologyById('combined_arms')!;
  const earlyNation = makeResearchHarness({
    nationId: 'early',
    isHuman: true,
    technologyId: technology.id,
    progress: 0,
    currentYear: 1800,
    researchedTechIds: ['agriculture'],
  });
  const advancedNation = makeResearchHarness({
    nationId: 'advanced',
    isHuman: true,
    technologyId: technology.id,
    progress: 0,
    currentYear: 1800,
    researchedTechIds: ['particle_physics'],
  });
  assert.equal(
    earlyNation.researchSystem.getEffectiveCost(technology.id),
    advancedNation.researchSystem.getEffectiveCost(technology.id),
  );
  assert.equal(
    earlyNation.researchSystem.getAheadOfTimeCostDetails(technology.id)?.eraStartYear,
    1945,
  );
});

test('progressive era scaling and timeline scaling both apply exactly once', () => {
  const standard = getGameSpeedById('standard');
  const technology = makeTechnology('modern', 1000);
  const progressiveCost = getEffectiveTechnologyCost(
    technology,
    standard,
    Number.POSITIVE_INFINITY,
  );
  const timelineMultiplier = getAheadOfTimeResearchCostMultiplier('modern', 1800);
  assert.equal(progressiveCost, 900);
  assert.equal(
    getEffectiveTechnologyCost(technology, standard, 1800),
    Math.round(progressiveCost * timelineMultiplier),
  );
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

test('research HUD exposes the timeline penalty only when it applies', () => {
  const technology = getTechnologyById('biology')!;
  const ahead = makeResearchHarness({
    nationId: 'ahead',
    isHuman: true,
    technologyId: technology.id,
    progress: 750,
    currentYear: 1600,
  });
  const provider = new NationHudDataProvider(
    ahead.nationManager,
    ahead.cityManager,
    {} as never,
    ahead.researchSystem,
    {} as never,
    {} as never,
    {} as never,
  );
  const state = provider.getResearchState(ahead.nation.id);
  assert.equal(state.cost, ahead.researchSystem.getEffectiveCost(technology.id));
  assert.match(state.tooltip, /Ahead of historical timeline: \+\d+% research cost/);

  const onTime = makeResearchHarness({
    nationId: 'on_time',
    isHuman: true,
    technologyId: technology.id,
    progress: 0,
    currentYear: 1700,
  });
  const onTimeProvider = new NationHudDataProvider(
    onTime.nationManager,
    onTime.cityManager,
    {} as never,
    onTime.researchSystem,
    {} as never,
    {} as never,
    {} as never,
  );
  assert.doesNotMatch(onTimeProvider.getResearchState(onTime.nation.id).tooltip, /historical timeline/);
});

test('research start diagnostics include canonical timeline and effective-cost details', () => {
  const nationManager = new NationManager();
  const nation = new Nation({
    id: 'diagnostic',
    name: 'Diagnostic Nation',
    color: 0xffffff,
    researchedTechIds: ['economics'],
  });
  nationManager.addNation(nation);
  const messages: string[] = [];
  const researchSystem = new ResearchSystem(
    nationManager,
    new CityManager(),
    () => 1,
    undefined,
    undefined,
    undefined,
    (_nationId, message) => messages.push(message),
    undefined,
    () => 1600,
  );

  assert.equal(researchSystem.startResearch(nation.id, 'industrialization'), true);
  assert.match(
    messages[0] ?? '',
    /Industrialization; era=industrial currentYear=1600 eraStartYear=1700 yearsAhead=100 baseCost=1900 effectiveCost=\d+ aheadOfTimeMultiplier=1\.700/,
  );
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
