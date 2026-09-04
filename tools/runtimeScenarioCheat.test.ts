import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { CheatSystem, type GameContext } from '../src/systems/CheatSystem.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { TradeConnectionSystem } from '../src/systems/TradeConnectionSystem.ts';
import {
  validateRuntimeScenarioSettings,
  type RuntimeScenarioSettings,
} from '../src/ui/ScenarioCheatDialog.ts';

const scene = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
const dialog = readFileSync(new URL('../src/ui/ScenarioCheatDialog.ts', import.meta.url), 'utf8');
const saveLoad = readFileSync(new URL('../src/systems/SaveLoadService.ts', import.meta.url), 'utf8');

const valid: RuntimeScenarioSettings = {
  peaceTreatyCooldownTurns: 10,
  capitulationAcceptanceThreshold: 0.7,
  tradeRouteEstablishmentTurns: 10,
  shortTradeDealDuration: 25,
  longTradeDealDuration: 50,
  originalCapitalCollapsePercent: 10,
  dominationLandPercent: 20,
  dominationRequiredVassals: 3,
};

test('Scenario cheat command opens the dedicated runtime editor', () => {
  let opened = 0;
  const cheats = new CheatSystem({ openScenarioDialog: () => { opened += 1; } } as unknown as GameContext);
  assert.equal(cheats.execute('scenario'), 'Runtime Scenario editor opened.');
  assert.equal(opened, 1);
  assert.match(cheats.execute('help'), /scenario.*current-game scenario settings editor/i);
});

test('runtime dialog validates all supported endpoint semantics', () => {
  assert.equal(validateRuntimeScenarioSettings(valid), null);
  assert.equal(validateRuntimeScenarioSettings({ ...valid, capitulationAcceptanceThreshold: 0.01 }), null);
  assert.equal(validateRuntimeScenarioSettings({ ...valid, capitulationAcceptanceThreshold: 1 }), null);
  assert.equal(validateRuntimeScenarioSettings({ ...valid, peaceTreatyCooldownTurns: 0 }), null);
  assert.equal(validateRuntimeScenarioSettings({ ...valid, tradeRouteEstablishmentTurns: 0 }), null);
  assert.equal(validateRuntimeScenarioSettings({ ...valid, originalCapitalCollapsePercent: 0 }), null);
  assert.match(validateRuntimeScenarioSettings({ ...valid, longTradeDealDuration: 25 }) ?? '', /must exceed/);
});

test('cancel is non-mutating and Apply is the sole settings mutation path', () => {
  assert.match(dialog, /Cancel', \(\) => this\.close\(\)/);
  assert.doesNotMatch(dialog, /addEventListener\('input',[\s\S]{0,180}applySettings/);
  assert.match(dialog, /this\.options\.applySettings\(settings\);[\s\S]*?this\.close\(\)/);
  assert.match(dialog, /type = 'range'; thresholdInput\.min = '0\.01'; thresholdInput\.max = '1\.00'; thresholdInput\.step = '0\.01'/);
});

test('future timer settings are mutable without rewriting captured state', () => {
  const diplomacy = new DiplomacyManager(undefined, 10);
  diplomacy.setPeaceTreatyCooldownTurns(3);
  assert.equal(diplomacy.getPeaceTreatyCooldownTurns(), 3);

  const routes = new TradeConnectionSystem({} as never, {} as never, {} as never, undefined, 10);
  routes.setEstablishmentTurns(4);
  assert.equal(routes.getEstablishmentTurns(), 4);
  assert.doesNotMatch(dialog, /restoreConnections|remainingTurns|peaceTreatyUntilTurn/);
});

test('GameScene explicitly wires all eight live consumers and refreshes UI', () => {
  for (const call of [
    'setPeaceTreatyCooldownTurns',
    'setAcceptanceThreshold',
    'setEstablishmentTurns',
    'setHumanTradeDealDurations',
    'setTradeDealTurns',
    'setOriginalCapitalCollapsePercent',
    'setDominationVictorySettings',
    'requestRefresh',
  ]) assert.match(scene, new RegExp(call));
});

test('save snapshots mutable values and old saves fall back through scenario initialization', () => {
  assert.match(saveLoad, /peaceTreatyCooldownTurns: diplomacyManager\.getPeaceTreatyCooldownTurns\(\)/);
  assert.match(saveLoad, /originalCapitalCollapsePercent: context\.combatSystem\?\.getOriginalCapitalCollapsePercent\(\)/);
  assert.match(saveLoad, /capitulationAcceptanceThreshold: context\.capitulationSystem\?\.getAcceptanceThreshold\(\)/);
  assert.match(scene, /data\.savedState\?\.peaceTreatyCooldownTurns \?\? scenarioJson\.meta\?\.peaceTreatyCooldownTurns/);
  assert.match(scene, /data\.savedState\?\.originalCapitalCollapsePercent \?\? scenarioJson\.meta\?\.originalCapitalCollapsePercent/);
});
