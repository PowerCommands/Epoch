import assert from 'node:assert/strict';
import test from 'node:test';
import { GuideProgression } from '../src/systems/GuideProgression';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';

test('offers one ordered automatic tip every six completed human turns', () => {
  const progression = GuideProgression.forNewGame(50);
  const shown: number[] = [];
  for (let turn = 1; turn <= 18; turn += 1) {
    const due = progression.completeHumanTurn();
    if (due !== null) shown.push(due);
  }
  assert.deepEqual(shown, [0, 1, 2]);
  assert.deepEqual(progression.getState(), {
    nextAutomaticTipIndex: 3,
    completedHumanTurns: 18,
  });
});

test('the separate startup guide does not consume a progressive tip', () => {
  const progression = GuideProgression.forNewGame(50);
  assert.deepEqual(progression.getState(), {
    nextAutomaticTipIndex: 0,
    completedHumanTurns: 0,
  });
  for (let turn = 0; turn < 5; turn += 1) assert.equal(progression.completeHumanTurn(), null);
  assert.equal(progression.completeHumanTurn(), 0);
});

test('restores the exact next automatic tip from a save', () => {
  const progression = GuideProgression.fromSave(50, {
    nextAutomaticTipIndex: 8,
    completedHumanTurns: 48,
  }, 99);
  for (let turn = 0; turn < 5; turn += 1) assert.equal(progression.completeHumanTurn(), null);
  assert.equal(progression.completeHumanTurn(), 8);
});

test('pre-feature saves skip elapsed tips and wait for a future boundary', () => {
  const progression = GuideProgression.fromSave(50, undefined, 12);
  assert.deepEqual(progression.getState(), {
    nextAutomaticTipIndex: 2,
    completedHumanTurns: 12,
  });
  for (let turn = 0; turn < 5; turn += 1) assert.equal(progression.completeHumanTurn(), null);
  assert.equal(progression.completeHumanTurn(), 2);
});

test('stops after the final tip', () => {
  const progression = GuideProgression.fromSave(50, {
    nextAutomaticTipIndex: 49,
    completedHumanTurns: 294,
  }, 294);
  for (let turn = 0; turn < 5; turn += 1) assert.equal(progression.completeHumanTurn(), null);
  assert.equal(progression.completeHumanTurn(), 49);
  for (let turn = 0; turn < 60; turn += 1) assert.equal(progression.completeHumanTurn(), null);
});

test('save validation accepts pre-feature saves without guide progress', () => {
  const result = SaveLoadService.validate({
    version: SAVED_GAME_VERSION,
    mapKey: 'test-map',
    humanNationId: 'human',
    activeNationIds: ['human'],
    turn: { currentRound: 12, currentTurnIndex: 0 },
    tiles: [],
    nations: [],
    cities: [],
    units: [],
    diplomacy: [],
    discovery: [],
    wonders: [],
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.state.guideProgress, undefined);
});
