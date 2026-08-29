/** Run with: npx tsx --test tools/aiVictoryFocus.test.ts */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FACTORY } from '../src/data/buildings.ts';
import { getCorporationById } from '../src/data/corporations.ts';
import { getGameSpeedById } from '../src/data/gameSpeeds.ts';
import { AEROSPACE_PART_PRODUCTION } from '../src/data/scienceVictory.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import type { ScienceVictoryProgress } from '../src/systems/VictorySystem.ts';
import {
  AEROSPACE_INDUSTRIES_ID,
  AI_AEROSPACE_SCIENCE_VICTORY_SCORE,
  getAICorporationProductionScore,
} from '../src/systems/ai/AICorporationProduction.ts';
import {
  SCIENCE_VICTORY_FOCUS_PRODUCTION_SCORE,
  applyVictoryFocusProductionPriority,
  evaluateAIVictoryFocus,
} from '../src/systems/ai/AIVictoryFocus.ts';
import {
  pickBestAIProductionCandidate,
  scoreAIProductionCandidate,
  type AIProductionCandidate,
} from '../src/systems/ai/AIProductionScoring.ts';
import { getAIStrategyById } from '../src/data/aiStrategies.ts';
import type { AIVictoryFocusState } from '../src/types/aiVictoryFocus.ts';
import type { SavedNation } from '../src/types/saveGame.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const AEROSPACE = getCorporationById(AEROSPACE_INDUSTRIES_ID)!;

function scienceProgress(overrides: Partial<ScienceVictoryProgress> = {}): ScienceVictoryProgress {
  const progress: ScienceVictoryProgress = {
    nationId: 'nation_ai',
    aerospaceParts: 0,
    requiredAerospaceParts: 10,
    hasRocketry: false,
    hasAluminum: false,
    hasFactory: false,
    hasAerospaceIndustries: false,
    fulfilledMilestones: 0,
    scienceScore: 0,
    researchPerTurn: 0,
    researchedTechnologyCount: 0,
    ...overrides,
  };
  progress.fulfilledMilestones = [
    progress.hasRocketry,
    progress.hasAluminum,
    progress.hasFactory,
    progress.hasAerospaceIndustries,
  ].filter(Boolean).length;
  return progress;
}

const scienceFocus: AIVictoryFocusState = {
  type: 'science',
  objective: 'foundAerospaceIndustries',
  activatedTurn: 500,
};

function aerospaceCandidate(): AIProductionCandidate {
  return {
    item: { kind: 'corporation', corporationType: AEROSPACE },
    baseScore: getAICorporationProductionScore(AEROSPACE, true),
    category: 'corporation',
  };
}

test('early game and high science output alone do not activate Victory Focus', () => {
  assert.equal(evaluateAIVictoryFocus(undefined, true, scienceProgress(), 50).focus, undefined);
  const highScience = scienceProgress({ scienceScore: 9999, researchPerTurn: 800, researchedTechnologyCount: 80 });
  assert.equal(evaluateAIVictoryFocus(undefined, true, highScience, 500).focus, undefined);
});

test('three canonical Science Victory milestones enter a stable Science focus', () => {
  const progress = scienceProgress({ hasRocketry: true, hasAluminum: true, hasFactory: true });
  const entered = evaluateAIVictoryFocus(undefined, true, progress, 500);
  assert.equal(entered.transition, 'entered');
  assert.deepEqual(entered.focus, scienceFocus);

  const temporarilyReduced = scienceProgress({ hasRocketry: true, hasFactory: true });
  const retained = evaluateAIVictoryFocus(entered.focus, true, temporarilyReduced, 501);
  assert.equal(retained.transition, 'unchanged');
  assert.equal(retained.focus?.activatedTurn, 500);
});

test('substantial invalidation exits focus, while independent nations can both qualify', () => {
  const invalidated = evaluateAIVictoryFocus(
    scienceFocus,
    true,
    scienceProgress({ hasRocketry: true }),
    510,
  );
  assert.equal(invalidated.transition, 'exited');
  assert.equal(invalidated.reason, 'pathInvalidated');

  const contender = scienceProgress({ hasRocketry: true, hasAluminum: true, hasFactory: true });
  const china = evaluateAIVictoryFocus(undefined, true, { ...contender, nationId: 'china' }, 510);
  const usa = evaluateAIVictoryFocus(undefined, true, { ...contender, nationId: 'usa' }, 510);
  assert.equal(china.focus?.type, 'science');
  assert.equal(usa.focus?.type, 'science');
});

test('global corporation founding advances the objective and completed parts end focus', () => {
  const advanced = evaluateAIVictoryFocus(
    scienceFocus,
    true,
    scienceProgress({ hasRocketry: true, hasAluminum: true, hasFactory: true, hasAerospaceIndustries: true }),
    520,
  );
  assert.equal(advanced.transition, 'objectiveAdvanced');
  assert.equal(advanced.focus?.objective, 'produceAerospaceParts');

  const completed = evaluateAIVictoryFocus(
    advanced.focus,
    true,
    scienceProgress({ aerospaceParts: 10, hasAerospaceIndustries: true }),
    530,
  );
  assert.equal(completed.transition, 'exited');
  assert.equal(completed.reason, 'scienceVictoryAchieved');
});

test('Science focus lifts AeroSpace Industries above the observed Research Lab score', () => {
  const base = aerospaceCandidate();
  assert.equal(base.baseScore, AI_AEROSPACE_SCIENCE_VICTORY_SCORE);
  const focused = applyVictoryFocusProductionPriority(base, scienceFocus, false);
  assert.equal(focused.candidate.baseScore, SCIENCE_VICTORY_FOCUS_PRODUCTION_SCORE);
  assert.equal(focused.strategicBonus, 175);

  const researchLab: AIProductionCandidate = {
    item: { kind: 'building', buildingType: FACTORY },
    baseScore: 113,
    category: 'scienceBuilding',
  };
  const strategy = getAIStrategyById('baseline');
  assert.equal(scoreAIProductionCandidate(researchLab, strategy, undefined, 'scientific'), 226);
  assert.equal(scoreAIProductionCandidate(focused.candidate, strategy, undefined, 'scientific'), 330);
  const winner = pickBestAIProductionCandidate(
    [researchLab, focused.candidate],
    strategy,
    undefined,
    'scientific',
  );
  assert.equal(winner?.item.kind, 'corporation');
});

test('urgent production suppresses focus bonus and lets the urgent candidate win', () => {
  const focused = applyVictoryFocusProductionPriority(aerospaceCandidate(), scienceFocus, true);
  assert.equal(focused.strategicBonus, 0);
  assert.equal(focused.candidate.baseScore, AI_AEROSPACE_SCIENCE_VICTORY_SCORE);
  const urgent: AIProductionCandidate = {
    item: { kind: 'building', buildingType: FACTORY },
    baseScore: 226,
    category: 'productionBuilding',
  };
  assert.equal(
    pickBestAIProductionCandidate([focused.candidate, urgent], getAIStrategyById('baseline'))?.item.kind,
    'building',
  );
});

test('Science focus gives Aerospace Parts the same endgame priority after global unlock', () => {
  const partsFocus: AIVictoryFocusState = { ...scienceFocus, objective: 'produceAerospaceParts' };
  const candidate: AIProductionCandidate = {
    item: { kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION },
    baseScore: 120,
    category: 'aerospacePart',
  };
  const result = applyVictoryFocusProductionPriority(candidate, partsFocus, false);
  assert.equal(result.candidate.baseScore, SCIENCE_VICTORY_FOCUS_PRODUCTION_SCORE);
  assert.equal(result.strategicBonus, 180);
});

test('Victory Focus survives save/load and remains optional for old saves', () => {
  const manager = new NationManager();
  manager.addNation(new Nation({
    id: 'nation_ai',
    name: 'Test AI',
    color: 0x123456,
    aiVictoryFocus: scienceFocus,
  }));
  const cities = new CityManager();
  const turns = new TurnManager(manager, getGameSpeedById('marathon'));
  const mapData: MapData = {
    width: 1,
    height: 1,
    tileSize: 1,
    tiles: [[{ x: 0, y: 0, type: TileType.Plains }]],
  };
  const snapshot = SaveLoadService.serialize({
    mapKey: 'victory-focus-test', humanNationId: 'nation_ai', activeNationIds: ['nation_ai'],
    gameSpeedId: 'marathon', mapData, nationManager: manager, cityManager: cities,
    unitManager: { getAllUnits: () => [] },
    productionSystem: { getQueue: () => [] },
    policySystem: { getActivePolicyAssignments: () => [] },
    diplomacyManager: { getAllStates: () => [], getPendingPeaceProposals: () => [] },
    discoverySystem: { getAllMetPairs: () => [] }, turnManager: turns,
    gridSystem: new HexGridSystem(), wonderSystem: { getCompletedWonders: () => [] },
  } as unknown as SaveLoadContext);
  const saved = snapshot.nations[0];
  assert.deepEqual(saved.aiVictoryFocus, scienceFocus);

  const applyNations = (SaveLoadService as unknown as {
    applyNations: (nations: SavedNation[], nationManager: NationManager) => void;
  }).applyNations;

  manager.getNation('nation_ai')!.aiVictoryFocus = undefined;
  applyNations([saved], manager);
  assert.deepEqual(manager.getNation('nation_ai')?.aiVictoryFocus, scienceFocus);
  applyNations([{ ...saved, aiVictoryFocus: undefined }], manager);
  assert.equal(manager.getNation('nation_ai')?.aiVictoryFocus, undefined);
});
