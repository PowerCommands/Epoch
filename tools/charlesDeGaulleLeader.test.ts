import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getAINationalAgendaById } from '../src/data/aiNationalAgendas';
import { CULTURAL_DOMINANCE_AI_STRATEGY, DEFENSIVE_AI_STRATEGY } from '../src/data/aiStrategies';
import { getLeaderWarDeclarationPhrases } from '../src/data/leaderWarDeclarations';
import {
  CHARLES_DE_GAULLE,
  getDefaultLeaderByNationId,
  getLeaderByNationId,
  getLeaderCovertPersonalityId,
  getLeaderMilitaryDoctrineById,
  getLeaderPersonalityByNationId,
  getLeadersByNationId,
  setActiveLeaderSelections,
} from '../src/data/leaders';
import { WARRIOR } from '../src/data/units';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { AIStrategySelector } from '../src/systems/ai/AIStrategySelector';
import { scoreAIProductionCandidate } from '../src/systems/ai/AIProductionScoring';
import { describeGossipAgenda } from '../src/systems/gossip/GossipInformationResolver';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';
import type { ScenarioData } from '../src/types/scenario';

const FRANCE_ID = 'nation_france';
const CHARLES_VII_ID = 'leader_charles_vii';
const DE_GAULLE_ID = 'leader_charles_de_gaulle';

test('France keeps Charles VII as default and exposes de Gaulle as a non-default alternative', () => {
  assert.deepEqual(getLeadersByNationId(FRANCE_ID).map((leader) => leader.id), [CHARLES_VII_ID, DE_GAULLE_ID]);
  assert.equal(getDefaultLeaderByNationId(FRANCE_ID)?.id, CHARLES_VII_ID);
  assert.equal(CHARLES_DE_GAULLE.isDefault, false);
  assert.equal(CHARLES_DE_GAULLE.nationId, FRANCE_ID);
  assert.equal(CHARLES_DE_GAULLE.title, 'General');
  assert.equal(CHARLES_DE_GAULLE.image, '/assets/sprites/leaders/charles-de-gaulle.png');
});

test('active selection resolves de Gaulle gameplay data and clearing it restores Charles VII', () => {
  try {
    setActiveLeaderSelections({ [FRANCE_ID]: DE_GAULLE_ID });
    assert.equal(getLeaderByNationId(FRANCE_ID)?.id, DE_GAULLE_ID);
    assert.equal(getLeaderPersonalityByNationId(FRANCE_ID).warTolerance, 72);
    assert.equal(getLeaderMilitaryDoctrineById(DE_GAULLE_ID).id, 'disciplinedInfantry');
    assert.equal(getLeaderCovertPersonalityId(DE_GAULLE_ID), 'honorable');
    assert.equal(getAINationalAgendaById(getLeaderByNationId(FRANCE_ID)?.aiNationalAgendaId).id, 'france_libre');
  } finally {
    setActiveLeaderSelections(undefined);
  }
  assert.equal(getLeaderByNationId(FRANCE_ID)?.id, CHARLES_VII_ID);
});

test('France Libre produces defensive independence rather than conquest-oriented behavior', () => {
  const selector = new AIStrategySelector();
  const base = {
    nationId: FRANCE_ID,
    currentTurn: 20,
    currentStrategyId: 'balanced',
    strategyStartedTurn: 0,
    nationalAgendaId: CHARLES_DE_GAULLE.aiNationalAgendaId!,
    leaderPersonality: CHARLES_DE_GAULLE.aiPersonality!,
    cityCount: 4,
    unitCount: 4,
    gold: 200,
    goldPerTurn: 5,
    netHappiness: 5,
    atWar: false,
    enemyMilitaryNearby: false,
    highestThreatLevel: 'low' as const,
  };
  assert.equal(selector.selectStrategy(base), 'defensive');
  assert.equal(selector.selectStrategy({ ...base, highestThreatLevel: 'high' }), 'defensive');
  assert.equal(selector.selectStrategy({ ...base, atWar: true }), 'aggressive');
  assert.ok(CHARLES_DE_GAULLE.aiPersonality!.expansionBias < 0);
  assert.ok(CHARLES_DE_GAULLE.aiPersonality!.aggressionBias < 10);
});

test('de Gaulle maintains materially more credible military capacity than default France', () => {
  const charlesVII = getDefaultLeaderByNationId(FRANCE_ID)!;
  const deGaulleDoctrine = getLeaderMilitaryDoctrineById(DE_GAULLE_ID);
  const charlesVIIDoctrine = getLeaderMilitaryDoctrineById(CHARLES_VII_ID);
  const deGaulleCap = Math.ceil(DEFENSIVE_AI_STRATEGY.military.maxUnits * deGaulleDoctrine.militaryBudget.maxUnitsMultiplier);
  const charlesVIICap = Math.ceil(CULTURAL_DOMINANCE_AI_STRATEGY.military.maxUnits * charlesVIIDoctrine.militaryBudget.maxUnitsMultiplier);
  assert.equal(deGaulleCap, 5);
  assert.equal(charlesVIICap, 2);

  const candidate = { item: { kind: 'unit' as const, unitType: WARRIOR }, baseScore: 100, category: 'military' as const };
  const deGaulleScore = scoreAIProductionCandidate(candidate, DEFENSIVE_AI_STRATEGY);
  const charlesVIIScore = scoreAIProductionCandidate(candidate, CULTURAL_DOMINANCE_AI_STRATEGY);
  assert.ok(deGaulleScore > charlesVIIScore * 3);
  assert.ok(CHARLES_DE_GAULLE.aiPersonality!.warTolerance > charlesVII.aiPersonality!.warTolerance);
});

test('agenda, Gossip, Games preferences, and war declarations resolve canonical de Gaulle content', () => {
  const agenda = getAINationalAgendaById('france_libre');
  assert.equal(agenda.name, 'France Libre');
  assert.match(agenda.description, /sovereignty/i);
  assert.match(describeGossipAgenda(undefined, 'france_libre'), /independence/i);
  assert.deepEqual(CHARLES_DE_GAULLE.gamesOfNationsPreferences, {
    traditionalFavourite: 'javelin',
    additionalFavourite: 'fencing',
  });
  const declarations = getLeaderWarDeclarationPhrases(DE_GAULLE_ID);
  for (const phrases of Object.values(declarations)) assert.equal(phrases.length, 2);
});

test('de Gaulle selection survives scenario parsing and save validation while absent selection keeps the default', () => {
  const scenario: ScenarioData = {
    meta: { name: 'Free France roundtrip', version: 1 },
    map: { width: 1, height: 1, tileSize: 64, tiles: [{ q: 0, r: 0, type: 'plains' }] },
    nations: [{
      id: FRANCE_ID,
      name: 'France',
      color: '#1e0af1',
      isHuman: true,
      startTerritoryCenter: { q: 0, r: 0 },
      leaderId: DE_GAULLE_ID,
    }],
    cities: [],
    units: [],
  };
  assert.equal(ScenarioLoader.parse(structuredClone(scenario)).nations[0].leaderId, DE_GAULLE_ID);

  const validated = SaveLoadService.validate({
    version: SAVED_GAME_VERSION,
    savedAt: new Date(0).toISOString(),
    mapKey: 'test',
    humanNationId: FRANCE_ID,
    activeNationIds: [FRANCE_ID],
    leaderSelections: { [FRANCE_ID]: DE_GAULLE_ID },
    turn: { currentRound: 1, currentTurnIndex: 0 },
    tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
  });
  assert.equal(validated.ok, true);
  if (validated.ok) assert.equal(validated.state.leaderSelections?.[FRANCE_ID], DE_GAULLE_ID);

  setActiveLeaderSelections(undefined);
  assert.equal(getLeaderByNationId(FRANCE_ID)?.id, CHARLES_VII_ID);
});

test('generated manifest exposes both French leaders and keeps Charles VII as default', () => {
  const manifest = JSON.parse(fs.readFileSync('public/assets/data/nations-manifest.json', 'utf8')) as {
    nations: Array<{ nationId: string; leaderId: string; leaders: Array<Record<string, unknown>> }>;
  };
  const france = manifest.nations.find((nation) => nation.nationId === FRANCE_ID)!;
  assert.equal(france.leaderId, CHARLES_VII_ID);
  assert.deepEqual(france.leaders.map((leader) => leader.leaderId), [CHARLES_VII_ID, DE_GAULLE_ID]);
  assert.deepEqual(france.leaders[1], {
    leaderId: DE_GAULLE_ID,
    leaderName: 'Charles de Gaulle',
    leaderTitle: 'General',
    leaderImage: '/assets/sprites/leaders/charles-de-gaulle.png',
    isDefault: false,
  });
});

test('de Gaulle portrait and audience room assets are present', () => {
  assert.equal(fs.existsSync('public/assets/sprites/leaders/charles-de-gaulle.png'), true);
  assert.equal(fs.existsSync('public/assets/sprites/leaders/charles-de-gaulle-room.webp'), true);
});
