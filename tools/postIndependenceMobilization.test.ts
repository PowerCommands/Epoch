import assert from 'node:assert/strict';
import test from 'node:test';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import { VassalIndependenceSystem } from '../src/systems/diplomacy/VassalIndependenceSystem.ts';
import { ALL_BUILDINGS, WALLS, ARMORY, GRANARY } from '../src/data/buildings.ts';
import { ALL_WONDERS } from '../src/data/wonders.ts';
import { WARRIOR } from '../src/data/units.ts';
import { getAIStrategyById } from '../src/data/aiStrategies.ts';
import { applyMobilizationProductionWeights, isMobilizationInfrastructure } from '../src/systems/ai/PostIndependenceMobilization.ts';
import { filterAvailableAIProductionCandidates, pickBestAIProductionCandidate, type AIProductionCandidate } from '../src/systems/ai/AIProductionScoring.ts';

function harness(duration?: number) {
  let round = 20;
  const clock = { getCurrentRound: () => round } as TurnManager;
  const dm = new DiplomacyManager(clock);
  dm.setIndependenceCooldownTurns(duration);
  dm.establishVassal('freed', 'master');
  const purchase = new VassalIndependenceSystem(dm, { getGold: () => 200_000, transferGold: () => true });
  assert.ok(purchase.buyIndependence('freed'));
  return { dm, clock, setRound: (turn: number) => { round = turn; } };
}

test('default protection lasts exactly 100 turns and is specific to the former master', () => {
  const h = harness();
  assert.deepEqual(h.dm.getPostIndependenceMobilization('freed'), { nationId: 'freed', formerMasterId: 'master', startedTurn: 20, expiresTurn: 120 });
  assert.equal(h.dm.getPostIndependenceMobilization('master'), undefined);
  assert.equal(h.dm.declareWar('master', 'freed'), false);
  assert.equal(h.dm.canDeclareWar('outsider', 'freed'), true);
  assert.equal(h.dm.canDeclareWar('freed', 'outsider'), true);
  h.setRound(119);
  assert.equal(h.dm.getIndependenceProtectionRemainingTurns('master', 'freed'), 1);
  assert.equal(h.dm.canDeclareWar('master', 'freed'), false);
  h.setRound(120);
  assert.equal(h.dm.canDeclareWar('master', 'freed'), true, 'expiry works before upkeep runs');
  assert.equal(h.dm.getPostIndependenceMobilization('freed'), undefined);
  h.dm.processDiplomaticUpkeep(120);
  assert.equal(h.dm.getRelation('master', 'freed').independenceSettlement, null);
  assert.equal(h.dm.getState('master', 'freed'), 'PEACE', 'expiry does not restart war');
});

test('custom duration, zero duration and malformed legacy settings', () => {
  for (const value of [undefined, -1, NaN, Infinity, 1.5]) {
    assert.equal(harness(value).dm.getIndependenceCooldownTurns(), 100);
  }
  const short = harness(3);
  short.setRound(23);
  assert.equal(short.dm.canDeclareWar('master', 'freed'), true);
  const zero = harness(0);
  assert.equal(zero.dm.getPostIndependenceMobilization('freed'), undefined);
  assert.equal(zero.dm.canDeclareWar('master', 'freed'), true);
});

test('successful attack on former master breaks protection immediately; failed declaration does not', () => {
  const h = harness();
  h.dm.setAllianceGuard(() => true);
  assert.equal(h.dm.declareWar('freed', 'master'), false);
  assert.ok(h.dm.getPostIndependenceMobilization('freed'));
  h.dm.setAllianceGuard(() => false);
  assert.equal(h.dm.declareWar('freed', 'master'), true);
  assert.equal(h.dm.getPostIndependenceMobilization('freed'), undefined);
  assert.equal(h.dm.getIndependenceProtectionRemainingTurns('master', 'freed'), 0);
});

test('third-party wars and defensive participation leave the settlement intact', () => {
  const h = harness();
  assert.equal(h.dm.declareWar('outsider', 'freed'), true);
  assert.ok(h.dm.getPostIndependenceMobilization('freed'));
  h.dm.establishVassal('ally', 'freed');
  assert.equal(h.dm.declareWar('master', 'ally'), true);
  assert.equal(h.dm.joinWarToDefendVassal('freed', 'ally', 'master'), true);
  assert.ok(h.dm.getPostIndependenceMobilization('freed'));
});

test('authoritative save serializer restores the settlement and its exact expiration', () => {
  const h = harness(75);
  h.setRound(42);
  const saved = JSON.parse(JSON.stringify(SaveLoadService.serializeDiplomacy(h.dm)));
  const restored = new DiplomacyManager(h.clock);
  SaveLoadService.restoreDiplomacy(saved, restored);
  assert.equal(restored.getIndependenceProtectionRemainingTurns('master', 'freed'), 53);
  assert.deepEqual(restored.getPostIndependenceMobilization('freed'), h.dm.getPostIndependenceMobilization('freed'));
  assert.equal(restored.canDeclareWar('master', 'freed'), false);
  h.setRound(95);
  assert.equal(restored.getPostIndependenceMobilization('freed'), undefined);
  assert.equal(restored.canDeclareWar('master', 'freed'), true);
  for (const entry of saved) delete entry.independenceSettlement;
  SaveLoadService.restoreDiplomacy(saved, restored);
  assert.equal(restored.getPostIndependenceMobilization('freed'), undefined, 'old saves create no invented settlements');
});

const candidates: AIProductionCandidate[] = [
  { item: { kind: 'building', buildingType: WALLS }, category: 'productionBuilding', baseScore: 55 },
  { item: { kind: 'building', buildingType: ARMORY }, category: 'productionBuilding', baseScore: 55 },
  { item: { kind: 'building', buildingType: GRANARY }, category: 'foodBuilding', baseScore: 65 },
  { item: { kind: 'unit', unitType: WARRIOR }, category: 'military', baseScore: 70 },
];
const context = { active: true, economyStable: true, importantCity: true, armyDeficient: true };

test('all existing defensive upgrade chains participate through their definitions', () => {
  for (const id of ['walls', 'castle', 'arsenal', 'barracks', 'armory', 'military_academy', 'military_base']) {
    const building = ALL_BUILDINGS.find(b => b.id === id);
    assert.ok(building, id);
    assert.equal(isMobilizationInfrastructure(building), true, id);
  }
  assert.equal(isMobilizationInfrastructure(GRANARY), false);
});

test('mobilization shifts production to important-city defenses without bypassing availability', () => {
  const strategy = getAIStrategyById(undefined);
  assert.equal(pickBestAIProductionCandidate(candidates, strategy)?.item.kind, 'unit');
  const weighted = applyMobilizationProductionWeights(candidates, context);
  assert.equal(pickBestAIProductionCandidate(weighted, strategy)?.item, candidates[0].item);
  const available = filterAvailableAIProductionCandidates(weighted, item => item.kind === 'building' && isMobilizationInfrastructure(item.buildingType) ? 'Technology or resources unavailable' : undefined);
  assert.equal(pickBestAIProductionCandidate(available, strategy)?.item.kind, 'unit');
  const interior = applyMobilizationProductionWeights(candidates, { ...context, importantCity: false });
  assert.equal(pickBestAIProductionCandidate(interior, strategy)?.item.kind, 'unit', 'interior city fills the army deficit first');
});

test('economically unstable nations receive no buildup boost and expiration restores exact scores', () => {
  assert.deepEqual(applyMobilizationProductionWeights(candidates, { ...context, economyStable: false }), candidates);
  assert.deepEqual(applyMobilizationProductionWeights(candidates, { ...context, active: false }), candidates);
  const ready = applyMobilizationProductionWeights(candidates, { ...context, armyDeficient: false });
  assert.equal(ready[3].baseScore, candidates[3].baseScore, 'no unit boost after readiness target is met');
});


test('defensive deficiencies lower Wonder priority even when the army target is met', () => {
  const wonder: AIProductionCandidate = { item: { kind: 'wonder', wonderType: ALL_WONDERS[0] }, category: 'wonder', baseScore: 100 };
  const weighted = applyMobilizationProductionWeights([...candidates, wonder], { ...context, armyDeficient: false });
  assert.equal(weighted.at(-1)?.baseScore, 15);
  assert.equal(applyMobilizationProductionWeights([wonder], { ...context, armyDeficient: false })[0].baseScore, 40);
  assert.equal(applyMobilizationProductionWeights([wonder], { ...context, active: false })[0].baseScore, 100);
});
