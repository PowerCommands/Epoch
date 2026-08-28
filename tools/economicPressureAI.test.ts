import assert from 'node:assert/strict';
import test from 'node:test';

import { Nation } from '../src/entities/Nation.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { DiplomaticEvaluationSystem } from '../src/systems/diplomacy/DiplomaticEvaluationSystem.ts';
import {
  AIDiplomacySystem,
  evaluateEconomicPressureWillingness,
} from '../src/systems/ai/AIDiplomacySystem.ts';
import type { AIMilitaryEvaluationSystem, MilitaryComparison } from '../src/systems/ai/AIMilitaryEvaluationSystem.ts';
import type { AIMilitaryThreatEvaluationSystem, ThreatLevel } from '../src/systems/ai/AIMilitaryThreatEvaluationSystem.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';

const A = 'england';
const B = 'germany';
const C = 'france';
const H = 'sweden';

interface Harness {
  nations: NationManager;
  turns: TurnManager;
  diplomacy: DiplomacyManager;
  ai: AIDiplomacySystem;
  comparison: Map<string, MilitaryComparison>;
  threat: Map<string, ThreatLevel>;
  met: Set<string>;
}

function pair(a: string, b: string): string {
  return `${a}>${b}`;
}

function harness(): Harness {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: A, name: 'England', color: 0, isHuman: false }));
  nations.addNation(new Nation({ id: B, name: 'Germany', color: 0, isHuman: false }));
  nations.addNation(new Nation({ id: C, name: 'France', color: 0, isHuman: false }));
  nations.addNation(new Nation({ id: H, name: 'Sweden', color: 0, isHuman: true }));
  const turns = new TurnManager(nations);
  const diplomacy = new DiplomacyManager(turns);
  diplomacy.setEconomicPressureTechnologyChecker(() => true);
  const comparison = new Map<string, MilitaryComparison>();
  const threat = new Map<string, ThreatLevel>();
  const met = new Set<string>();
  const military = {
    compareMilitaryStrength: (a: string, b: string) => comparison.get(pair(a, b)) ?? 'equal',
    compareMilitaryStrengthForWar: (a: string, b: string) => comparison.get(pair(a, b)) ?? 'equal',
    getDefensiveWarPowerBreakdown: () => ({
      defenderPower: 50,
      alliancePower: 0,
      peacekeepingPower: 0,
      totalDefensivePower: 50,
      allianceName: null,
      allyNationId: null,
    }),
  } as unknown as AIMilitaryEvaluationSystem;
  const threats = {
    getThreatLevel: (a: string, b: string) => threat.get(pair(a, b)) ?? 'none',
  } as unknown as AIMilitaryThreatEvaluationSystem;
  const ai = new AIDiplomacySystem(
    diplomacy,
    new DiplomaticEvaluationSystem(diplomacy),
    nations,
    turns,
    military,
    threats,
    (a, b) => met.has(pair(a, b)),
    (_nationId, message) => message,
    undefined,
    undefined,
    () => 0, // deterministic: every eligible weighted choice succeeds
  );
  ai.setHumanNationPredicate((nationId) => nationId === H);
  return { nations, turns, diplomacy, ai, comparison, threat, met };
}

function meet(h: Harness, ...ids: string[]): void {
  for (const a of ids) for (const b of ids) if (a !== b) h.met.add(pair(a, b));
}

function relation(h: Harness, a: string, b: string, values: Partial<{
  trust: number; fear: number; hostility: number; affinity: number; suspicion: number;
}>): void {
  h.diplomacy.setMemoryValues(a, b, {
    trust: values.trust ?? 50,
    fear: values.fear ?? 0,
    hostility: values.hostility ?? 0,
    affinity: values.affinity ?? 0,
    suspicion: values.suspicion ?? 0,
  });
}

test('AI imposes Tariffs on a deteriorated relation but not a friendly target', () => {
  const hostile = harness();
  meet(hostile, A, B);
  relation(hostile, A, B, { trust: 25, hostility: 49, affinity: -40, suspicion: 20 });
  hostile.ai.runTurn(A);
  assert.equal(hostile.diplomacy.getEconomicPressure(A, B), 'tariffs');
  assert.equal(hostile.diplomacy.getEconomicPressure(B, A), 'tariffs');
  assert.equal(hostile.diplomacy.getEconomicPressureAgainst(B).length, 1); // reciprocal, no recursion

  const friendly = harness();
  meet(friendly, A, B);
  relation(friendly, A, B, { trust: 85, hostility: 0, affinity: 30 });
  friendly.ai.runTurn(A);
  assert.equal(friendly.diplomacy.getEconomicPressure(A, B), null);
});

test('severe hostility escalates Tariffs to Embargo when war is too risky', () => {
  const h = harness();
  meet(h, A, B);
  relation(h, A, B, { trust: 5, hostility: 90, affinity: -40, suspicion: 40 });
  h.comparison.set(pair(A, B), 'weaker');
  h.diplomacy.imposeEconomicPressure(A, B, 'tariffs');
  h.turns.restoreTurnState(10, 0); // older than escalation cooldown
  h.ai.runTurn(A);
  assert.equal(h.diplomacy.getEconomicPressure(A, B), 'embargo');
  assert.equal(h.diplomacy.getState(A, B), 'PEACE');
});

test('military weakness raises Embargo willingness while capable AI retains war', () => {
  const base = {
    attitude: 'hostile' as const,
    trust: 5,
    hostility: 90,
    affinity: -40,
    suspicion: 20,
    ideologyCompatibility: 0,
    threatLevel: 'none' as const,
    currentPressure: null,
    diplomacyBias: 0,
  };
  const capable = evaluateEconomicPressureWillingness({ ...base, militaryComparison: 'stronger', warTooRisky: false });
  const weak = evaluateEconomicPressureWillingness({ ...base, militaryComparison: 'weaker', warTooRisky: true });
  assert.ok(weak.embargo > capable.embargo);

  const h = harness();
  meet(h, A, B);
  relation(h, A, B, { trust: 5, hostility: 90, affinity: -40 });
  h.comparison.set(pair(A, B), 'stronger');
  h.threat.set(pair(A, B), 'low');
  h.ai.runTurn(A);
  assert.equal(h.diplomacy.getState(A, B), 'WAR');
  assert.equal(h.diplomacy.getEconomicPressure(A, B), null);
});

test('high hostility alone never selects Boycott', () => {
  const h = harness();
  meet(h, A, B);
  relation(h, A, B, { trust: 5, hostility: 95, affinity: -50 });
  h.comparison.set(pair(A, B), 'weaker');
  h.ai.runTurn(A);
  assert.notEqual(h.diplomacy.getEconomicPressure(A, B), 'boycott');
});

test('war declaration and city capture can provoke supporters but not victim rivals', () => {
  for (const kind of ['war_declared', 'city_captured'] as const) {
    const supporter = harness();
    meet(supporter, A, B, C);
    relation(supporter, A, C, { trust: 80, affinity: 30 });
    relation(supporter, A, B, { trust: 25, hostility: 35, affinity: -10 });
    const imposed = supporter.ai.handleEconomicPressureEvent({
      kind,
      aggressorNationId: B,
      victimNationId: C,
      ...(kind === 'city_captured' ? { cityName: 'Paris' } : {}),
    });
    assert.deepEqual(imposed, [A]);
    assert.equal(supporter.diplomacy.getEconomicPressure(A, B), 'boycott');

    const rival = harness();
    meet(rival, A, B, C);
    relation(rival, A, C, { trust: 10, hostility: 60, affinity: -30 });
    relation(rival, A, B, { trust: 25, hostility: 35 });
    assert.deepEqual(rival.ai.handleEconomicPressureEvent({
      kind,
      aggressorNationId: B,
      victimNationId: C,
      ...(kind === 'city_captured' ? { cityName: 'Paris' } : {}),
    }), []);
    assert.equal(rival.diplomacy.getEconomicPressure(A, B), null);
  }
});

test('Gossip Insult, covert exposure, and incoming Embargo can cause asymmetric Boycott', () => {
  for (const kind of ['gossip_insult', 'covert_exposure', 'embargo_received'] as const) {
    const h = harness();
    meet(h, A, B);
    relation(h, A, B, { trust: 25, hostility: 30, affinity: -10 });
    if (kind === 'embargo_received') h.diplomacy.imposeEconomicPressure(B, A, 'embargo');
    const result = h.ai.handleEconomicPressureEvent({
      kind,
      aggressorNationId: B,
      victimNationId: A,
      ...(kind === 'gossip_insult' ? { insultWeight: 2 } : {}),
    });
    assert.deepEqual(result, [A]);
    assert.equal(h.diplomacy.getEconomicPressure(A, B), 'boycott');
    if (kind === 'embargo_received') assert.equal(h.diplomacy.getEconomicPressure(A, B), 'boycott');
  }
});

for (const type of ['tariffs', 'boycott', 'embargo'] as const) {
  test(`AI-to-AI ${type} expires at exactly 25 turns without same-turn reapplication`, () => {
    const h = harness();
    meet(h, A, B);
    h.diplomacy.imposeEconomicPressure(A, B, type);

    h.turns.restoreTurnState(25, 0); // imposed on round 1: only 24 elapsed
    h.ai.runTurn(A);
    assert.equal(h.diplomacy.getEconomicPressure(A, B), type);

    // Make immediate reapplication maximally attractive only on expiry turn.
    relation(h, A, B, { trust: 5, hostility: 95, affinity: -50 });
    h.comparison.set(pair(A, B), 'weaker');
    h.turns.restoreTurnState(26, 0);
    h.ai.runTurn(A);
    assert.equal(h.diplomacy.getEconomicPressure(A, B), null);
  });
}

test('sanctions involving the Human do not auto-expire', () => {
  const h = harness();
  meet(h, A, H);
  h.diplomacy.imposeEconomicPressure(A, H, 'embargo');
  h.diplomacy.imposeEconomicPressure(H, A, 'boycott');
  // Autorun temporarily marks every nation AI-controlled; stable Human identity
  // must still prevent Step 3 expiry and decision-making.
  h.nations.getNation(H)!.isHuman = false;
  h.turns.restoreTurnState(26, 0);
  h.ai.runTurn(A);
  assert.equal(h.diplomacy.getEconomicPressure(A, H), 'embargo');
  assert.equal(h.diplomacy.getEconomicPressure(H, A), 'boycott');
});

test('save/load imposed turn continues AI-to-AI duration correctly', () => {
  const original = harness();
  meet(original, A, B);
  original.diplomacy.imposeEconomicPressure(A, B, 'embargo');
  const saved = SaveLoadService.serializeDiplomacy(original.diplomacy);

  const restored = harness();
  meet(restored, A, B);
  SaveLoadService.restoreDiplomacy(saved, restored.diplomacy);
  restored.turns.restoreTurnState(26, 0);
  restored.ai.runTurn(A);
  assert.equal(restored.diplomacy.getEconomicPressure(A, B), null);
});
