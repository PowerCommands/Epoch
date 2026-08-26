import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { AGGRESSIVE_AI_STRATEGY } from '../src/data/aiStrategies';
import { resolveLeaderEraStrategy } from '../src/data/aiLeaderEraStrategies';
import {
  ADOLF_HITLER,
  getDefaultLeaderByNationId,
  getLeaderByNationId,
  getLeaderCovertPersonalityId,
  getLeaderMilitaryDoctrineById,
  getLeaderPersonalityByNationId,
  getLeadersByNationId,
  setActiveLeaderSelections,
} from '../src/data/leaders';
import { WARRIOR } from '../src/data/units';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { AIStrategyEvaluationSystem } from '../src/systems/ai/AIStrategyEvaluationSystem';
import { scoreAIProductionCandidate } from '../src/systems/ai/AIProductionScoring';
import { AIStrategySelector } from '../src/systems/ai/AIStrategySelector';
import type { ScenarioData } from '../src/types/scenario';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';

const GERMANY_ID = 'nation_germany';
const HERMANN_ID = 'hermann-the-cheruscan';
const HITLER_ID = 'leader_adolf_hitler';
const GENGHIS_ID = 'leader_genghis-khan';

test('Germany keeps Hermann as default and exposes Hitler as a non-default alternative', () => {
  const leaders = getLeadersByNationId(GERMANY_ID);
  assert.deepEqual(leaders.map((leader) => leader.id), [HERMANN_ID, HITLER_ID]);
  assert.equal(getDefaultLeaderByNationId(GERMANY_ID)?.id, HERMANN_ID);
  assert.equal(ADOLF_HITLER.isDefault, false);
  assert.equal(ADOLF_HITLER.title, 'Führer');
  assert.equal(ADOLF_HITLER.nationId, GERMANY_ID);
});

test('selecting Hitler changes centralized gameplay lookups and clearing selection restores Hermann', () => {
  try {
    setActiveLeaderSelections({ [GERMANY_ID]: HITLER_ID });
    assert.equal(getLeaderByNationId(GERMANY_ID)?.id, HITLER_ID);
    assert.equal(getLeaderPersonalityByNationId(GERMANY_ID).aggressionBias, 20);
    assert.equal(getLeaderCovertPersonalityId(HITLER_ID), 'paranoid');
    assert.equal(getLeaderMilitaryDoctrineById(HITLER_ID).id, 'militaryMobilization');
  } finally {
    setActiveLeaderSelections(undefined);
  }
  assert.equal(getLeaderByNationId(GERMANY_ID)?.id, HERMANN_ID);
});

test('Hitler has a stronger military buildup and expansion profile than Genghis', () => {
  const genghis = getLeadersByNationId('nation_mongolia').find((leader) => leader.id === GENGHIS_ID)!;
  const hitlerPersonality = ADOLF_HITLER.aiPersonality!;
  const genghisPersonality = genghis.aiPersonality!;
  const evaluator = new AIStrategyEvaluationSystem();
  const hitlerEvaluation = evaluator.evaluate({ leaderPersonality: hitlerPersonality });
  const genghisEvaluation = evaluator.evaluate({ leaderPersonality: genghisPersonality });

  assert.ok(hitlerPersonality.aggressionBias > genghisPersonality.aggressionBias);
  assert.ok(hitlerPersonality.expansionBias > genghisPersonality.expansionBias);
  assert.ok(hitlerPersonality.warTolerance >= genghisPersonality.warTolerance);
  assert.ok(hitlerPersonality.peacePreference < genghisPersonality.peacePreference);
  assert.equal(hitlerEvaluation.primaryStrategyId, 'aggressive');
  assert.ok(hitlerEvaluation.scores.aggressive > genghisEvaluation.scores.aggressive);
  assert.ok(hitlerEvaluation.scores.expansionist > genghisEvaluation.scores.expansionist);

  const hitlerDoctrine = getLeaderMilitaryDoctrineById(HITLER_ID);
  const genghisDoctrine = getLeaderMilitaryDoctrineById(GENGHIS_ID);
  const hitlerArmyCap = Math.ceil(AGGRESSIVE_AI_STRATEGY.military.maxUnits * hitlerDoctrine.militaryBudget.maxUnitsMultiplier);
  const genghisArmyCap = Math.ceil(AGGRESSIVE_AI_STRATEGY.military.maxUnits * genghisDoctrine.militaryBudget.maxUnitsMultiplier);
  assert.equal(hitlerArmyCap, 11);
  assert.equal(genghisArmyCap, 9);
  assert.ok(hitlerArmyCap > genghisArmyCap);
});

test('the normal strategy selector turns Hitler toward buildup or expansion but still honors emergencies', () => {
  const selector = new AIStrategySelector();
  const context = {
    nationId: GERMANY_ID,
    currentTurn: 20,
    currentStrategyId: 'balanced',
    strategyStartedTurn: 0,
    nationalAgendaId: ADOLF_HITLER.aiNationalAgendaId!,
    leaderPersonality: ADOLF_HITLER.aiPersonality!,
    cityCount: 4,
    unitCount: 4,
    gold: 200,
    goldPerTurn: 5,
    netHappiness: 5,
    atWar: false,
    enemyMilitaryNearby: false,
    highestThreatLevel: 'low' as const,
  };
  assert.equal(selector.selectStrategy(context), 'aggressive');
  assert.equal(selector.selectStrategy({ ...context, cityCount: 2 }), 'expansionist');
  assert.equal(selector.selectStrategy({ ...context, highestThreatLevel: 'high' }), 'defensive');
});

test('Hitler military preparation is active in every era and materially raises unit production priority', () => {
  const candidate = {
    item: { kind: 'unit' as const, unitType: WARRIOR },
    baseScore: 100,
    category: 'military' as const,
  };
  const ancient = resolveLeaderEraStrategy(HITLER_ID, 'ancient');
  const modern = resolveLeaderEraStrategy(HITLER_ID, 'modern');
  const genghisModern = resolveLeaderEraStrategy(GENGHIS_ID, 'modern');

  assert.equal(ancient.id, 'militaryPreparation');
  assert.equal(modern.id, 'militaryPreparation');
  assert.equal(modern.militaryBehavior.prepareForWar, true);
  assert.equal(modern.cityFocusRules?.primaryCityFocus, 'military');
  assert.equal(modern.militaryBehavior.minimumMilitaryReadiness, 1.35);

  const hitlerScore = scoreAIProductionCandidate(candidate, AGGRESSIVE_AI_STRATEGY, modern);
  const genghisScore = scoreAIProductionCandidate(candidate, AGGRESSIVE_AI_STRATEGY, genghisModern);
  assert.ok(hitlerScore > genghisScore * 2);
});

test('portrait, audience room, generated nation manifest, and shared German audio are wired', () => {
  assert.equal(fs.existsSync('public/assets/sprites/leaders/adolf-hitler.png'), true);
  assert.equal(fs.existsSync('public/assets/sprites/leaders/adolf-hitler-room.webp'), true);

  const manifest = JSON.parse(fs.readFileSync('public/assets/data/nations-manifest.json', 'utf8')) as {
    nations: Array<{ nationId: string; leaders: Array<{ leaderId: string; leaderImage: string; isDefault: boolean }> }>;
  };
  const germany = manifest.nations.find((nation) => nation.nationId === GERMANY_ID)!;
  assert.deepEqual(germany.leaders.map((leader) => leader.leaderId), [HERMANN_ID, HITLER_ID]);
  assert.deepEqual(germany.leaders.find((leader) => leader.leaderId === HITLER_ID), {
    leaderId: HITLER_ID,
    leaderName: 'Adolf Hitler',
    leaderTitle: 'Führer',
    leaderImage: '/assets/sprites/leaders/adolf-hitler.png',
    isDefault: false,
  });

  const soundManifest = JSON.parse(fs.readFileSync('public/assets/sounds/manifest.json', 'utf8')) as Record<string, unknown>;
  assert.ok(JSON.stringify(soundManifest).includes('nation_germany'));
  assert.equal(fs.existsSync('public/assets/sounds/leader_adolf_hitler'), false);
});

test('Hitler selection survives scenario parsing and save validation', () => {
  const scenario: ScenarioData = {
    meta: { name: 'Alternative leader roundtrip', version: 1 },
    map: { width: 1, height: 1, tileSize: 64, tiles: [{ q: 0, r: 0, type: 'plains' }] },
    nations: [{
      id: GERMANY_ID,
      name: 'Germany',
      color: '#2b2b2b',
      isHuman: true,
      startTerritoryCenter: { q: 0, r: 0 },
      leaderId: HITLER_ID,
    }],
    cities: [],
    units: [],
  };
  assert.equal(ScenarioLoader.parse(JSON.parse(JSON.stringify(scenario)) as ScenarioData).nations[0].leaderId, HITLER_ID);

  const validated = SaveLoadService.validate({
    version: SAVED_GAME_VERSION,
    savedAt: new Date(0).toISOString(),
    mapKey: 'test',
    humanNationId: GERMANY_ID,
    activeNationIds: [GERMANY_ID],
    leaderSelections: { [GERMANY_ID]: HITLER_ID },
    turn: { currentRound: 1, currentTurnIndex: 0 },
    tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
  });
  assert.equal(validated.ok, true);
  if (validated.ok) assert.equal(validated.state.leaderSelections?.[GERMANY_ID], HITLER_ID);
});
