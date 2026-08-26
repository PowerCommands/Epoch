import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  ALL_LEADERS,
  getActiveLeaderSelections,
  getDefaultLeaderByNationId,
  getLeaderById,
  getLeaderByNationId,
  getLeaderCovertPersonalityId,
  getLeaderPersonalityByNationId,
  getLeadersByNationId,
  setActiveLeaderSelections,
  setScenarioLeaderOverrides,
  WINSTON_CHURCHILL,
} from '../src/data/leaders';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';
import type { LeaderDefinition } from '../src/types/leader';
import { NATION_DEFINITIONS } from '../src/data/nations';

test('every current nation has exactly one explicit default leader', () => {
  for (const { id: nationId } of NATION_DEFINITIONS) {
    const defaults = getLeadersByNationId(nationId).filter((leader) => leader.isDefault);
    assert.equal(defaults.length, 1, nationId);
    assert.equal(getDefaultLeaderByNationId(nationId)?.id, defaults[0].id);
  }
});

test('England exposes Henry V as default and Winston Churchill as a real alternative', () => {
  const leaders = getLeadersByNationId('nation_england');
  assert.deepEqual(leaders.map((leader) => leader.id), ['leader_henry_v', 'leader_winston_churchill']);
  assert.equal(getDefaultLeaderByNationId('nation_england')?.id, 'leader_henry_v');
  assert.equal(WINSTON_CHURCHILL.isDefault, false);
  assert.equal(WINSTON_CHURCHILL.title, 'Prime Minister');
});

test('Churchill currently mirrors Henry V gameplay configuration', () => {
  const henry = getDefaultLeaderByNationId('nation_england')!;
  assert.deepEqual(WINSTON_CHURCHILL.aiPersonality, henry.aiPersonality);
  assert.equal(WINSTON_CHURCHILL.ideologyId, henry.ideologyId);
  assert.equal(WINSTON_CHURCHILL.aiMilitaryDoctrineId, henry.aiMilitaryDoctrineId);
  assert.equal(WINSTON_CHURCHILL.aiNationalAgendaId, henry.aiNationalAgendaId);
  assert.deepEqual(WINSTON_CHURCHILL.culturePriorities, henry.culturePriorities);
  assert.deepEqual(WINSTON_CHURCHILL.gamesOfNationsPreferences, henry.gamesOfNationsPreferences);
  assert.equal(getLeaderCovertPersonalityId(WINSTON_CHURCHILL.id), getLeaderCovertPersonalityId(henry.id));
  assert.equal(fs.existsSync('public/assets/sprites/leaders/winston-churchill.png'), true);
  assert.equal(fs.existsSync('public/assets/sprites/leaders/winston-churchill-room.webp'), true);
});

test('an explicit active leader drives centralized lookup and leader personality', () => {
  const nationId = 'nation_england';
  const defaultLeader = getDefaultLeaderByNationId(nationId)!;
  const alternative: LeaderDefinition = {
    ...defaultLeader,
    id: 'test_alternative_england_leader',
    isDefault: false,
    name: 'Test Alternative',
    aiPersonality: { ...defaultLeader.aiPersonality!, aggressionBias: -99 },
  };
  ALL_LEADERS.push(alternative);
  try {
    const expectedIds = ['leader_henry_v', 'leader_winston_churchill', alternative.id];
    setActiveLeaderSelections({ [nationId]: alternative.id });
    assert.deepEqual(getLeadersByNationId(nationId).map((leader) => leader.id), expectedIds);
    assert.equal(getLeaderByNationId(nationId)?.id, alternative.id);
    assert.equal(getLeaderById(alternative.id)?.nationId, nationId);
    assert.equal(getLeaderPersonalityByNationId(nationId).aggressionBias, -99);
    assert.deepEqual(getActiveLeaderSelections(), { [nationId]: alternative.id });

    // A leader can never be selected for a different nation.
    setActiveLeaderSelections({ nation_france: alternative.id });
    assert.equal(getLeaderByNationId('nation_france')?.id, getDefaultLeaderByNationId('nation_france')?.id);
  } finally {
    setActiveLeaderSelections(undefined);
    setScenarioLeaderOverrides([]);
    ALL_LEADERS.splice(ALL_LEADERS.indexOf(alternative), 1);
  }
});

test('scenario name/description overrides apply to the selected active leader', () => {
  const nationId = 'nation_england';
  const defaultLeader = getDefaultLeaderByNationId(nationId)!;
  const alternative: LeaderDefinition = {
    ...defaultLeader,
    id: 'test_scenario_alternative',
    isDefault: false,
    name: 'Original alternative name',
  };
  ALL_LEADERS.push(alternative);
  try {
    setScenarioLeaderOverrides([{ id: nationId, leaderName: 'Scenario ruler', leaderDescription: 'Scenario description' }]);
    setActiveLeaderSelections({ [nationId]: alternative.id });
    assert.equal(getLeaderByNationId(nationId)?.name, 'Scenario ruler');
    assert.equal(getLeaderByNationId(nationId)?.description, 'Scenario description');
  } finally {
    setActiveLeaderSelections(undefined);
    setScenarioLeaderOverrides([]);
    ALL_LEADERS.splice(ALL_LEADERS.indexOf(alternative), 1);
  }
});

test('save validation preserves leader selections and accepts older saves without them', () => {
  const base = {
    version: SAVED_GAME_VERSION,
    savedAt: new Date(0).toISOString(),
    mapKey: 'test',
    humanNationId: 'nation_england',
    activeNationIds: ['nation_england'],
    turn: { currentRound: 1, currentTurnIndex: 0 },
    tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
  };
  const selected = SaveLoadService.validate({
    ...base,
    leaderSelections: { nation_england: 'test_alternative_england_leader' },
  });
  assert.equal(selected.ok, true);
  if (selected.ok) assert.equal(selected.state.leaderSelections?.nation_england, 'test_alternative_england_leader');
  assert.equal(SaveLoadService.validate(base).ok, true);
});
