import assert from 'node:assert/strict';
import test from 'node:test';

import { ALL_LEADERS, setActiveLeaderSelections } from '../src/data/leaders';
import {
  getLeaderWarDeclarationPhrase,
  getLeaderWarDeclarationPhrases,
  LEADER_WAR_DECLARATIONS,
} from '../src/data/leaderWarDeclarations';
import { Nation } from '../src/entities/Nation';
import { AIDiplomacySystem } from '../src/systems/ai/AIDiplomacySystem';
import { createAIWarDeclarationDialogueRequest } from '../src/systems/ai/AIWarDeclarationDialogue';
import { classifyWarDeclarationReason } from '../src/systems/ai/WarDeclarationNarrative';
import type { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem';
import type { AIMilitaryThreatEvaluationSystem } from '../src/systems/ai/AIMilitaryThreatEvaluationSystem';
import { AllianceManager } from '../src/systems/diplomacy/AllianceManager';
import { AllianceWarSystem } from '../src/systems/diplomacy/AllianceWarSystem';
import { DiplomaticEvaluationSystem } from '../src/systems/diplomacy/DiplomaticEvaluationSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { NationManager } from '../src/systems/NationManager';
import { TurnManager } from '../src/systems/TurnManager';
import type { AIDiplomacyDecisionReason } from '../src/types/aiDiplomacy';
import { DEFAULT_AI_LEADER_PERSONALITY } from '../src/types/aiLeaderPersonality';
import type { WarDeclarationReasonContext } from '../src/types/warDeclaration';

const HUMAN = 'nation_sweden';
const AI = 'nation_england';
const THIRD = 'nation_france';

function reasonContext(overrides: Partial<WarDeclarationReasonContext> = {}): WarDeclarationReasonContext {
  return {
    militaryComparison: 'equal',
    threatLevel: 'none',
    trust: 50,
    fear: 10,
    hostility: 10,
    affinity: 0,
    suspicion: 0,
    ideologyCompatibility: 0,
    personality: { ...DEFAULT_AI_LEADER_PERSONALITY },
    ...overrides,
  };
}

test('war reason classifier selects conquest for a dominant expansionist attacker', () => {
  assert.equal(classifyWarDeclarationReason(reasonContext({
    militaryComparison: 'stronger',
    nationalAgendaId: 'expansionist',
    personality: { ...DEFAULT_AI_LEADER_PERSONALITY, expansionBias: 18, aggressionBias: 12, warTolerance: 80 },
  })), 'conquest');
});

test('war reason classifier selects threat when fear and perceived danger dominate', () => {
  assert.equal(classifyWarDeclarationReason(reasonContext({
    fear: 90,
    threatLevel: 'medium',
  })), 'threat');
});

test('war reason classifier selects hostility for a severely broken relationship', () => {
  assert.equal(classifyWarDeclarationReason(reasonContext({
    trust: 5,
    hostility: 95,
    affinity: -50,
    suspicion: 80,
  })), 'hostility');
});

test('war reason classifier selects ideological for an overwhelming ideology conflict', () => {
  assert.equal(classifyWarDeclarationReason(reasonContext({ ideologyCompatibility: -60 })), 'ideological');
});

test('war reason classifier selects ambition for aggression without a stronger specific trigger', () => {
  assert.equal(classifyWarDeclarationReason(reasonContext({
    nationalAgendaId: 'military_power',
    personality: { ...DEFAULT_AI_LEADER_PERSONALITY, aggressionBias: 25, expansionBias: 10, warTolerance: 85 },
  })), 'ambition');
});

test('classification is deterministic and cannot alter diplomacy state', () => {
  const diplomacy = new DiplomacyManager();
  const context = reasonContext({ militaryComparison: 'stronger' });
  const before = structuredClone(context);
  const first = classifyWarDeclarationReason(context);
  const second = classifyWarDeclarationReason(context);
  assert.equal(first, second);
  assert.deepEqual(context, before);
  assert.equal(diplomacy.getState(AI, HUMAN), 'PEACE');
});

test('all current leaders have exactly two non-empty phrases for every category', () => {
  const categories = ['conquest', 'hostility', 'threat', 'ideological', 'ambition'] as const;
  assert.deepEqual(Object.keys(LEADER_WAR_DECLARATIONS).sort(), ALL_LEADERS.map((leader) => leader.id).sort());
  for (const leader of ALL_LEADERS) {
    const phrases = getLeaderWarDeclarationPhrases(leader.id);
    for (const category of categories) {
      assert.equal(phrases[category].length, 2, `${leader.id}/${category}`);
      assert.ok(phrases[category].every((phrase) => phrase.trim().length > 0), `${leader.id}/${category}`);
    }
  }
});

test('phrase selection is stable and both variants are reachable with deterministic seeds', () => {
  const first = getLeaderWarDeclarationPhrase('leader_henry_v', 'conquest', 'round-10');
  assert.equal(getLeaderWarDeclarationPhrase('leader_henry_v', 'conquest', 'round-10'), first);
  const variants = new Set(Array.from({ length: 20 }, (_, round) => (
    getLeaderWarDeclarationPhrase('leader_henry_v', 'conquest', round)
  )));
  assert.equal(variants.size, 2);
});

function decision(overrides: Partial<AIDiplomacyDecisionReason> = {}): AIDiplomacyDecisionReason {
  return {
    action: 'declareWar',
    actorNationId: AI,
    targetNationId: HUMAN,
    attitude: 'hostile',
    militaryComparison: 'stronger',
    threatLevel: 'low',
    relationState: 'PEACE',
    trust: 10,
    fear: 20,
    hostility: 80,
    affinity: -10,
    suspicion: 30,
    warDeclarationReason: 'hostility',
    reasonText: 'test',
    ...overrides,
  };
}

test('only a direct AI-to-human war decision requests a leader dialogue', () => {
  setActiveLeaderSelections(undefined);
  const request = createAIWarDeclarationDialogueRequest(decision(), HUMAN, 25);
  assert.equal(request?.leaderId, 'leader_henry_v');
  assert.equal(request?.reason, 'hostility');
  assert.ok(request?.phrase);

  assert.equal(createAIWarDeclarationDialogueRequest(decision({ targetNationId: THIRD }), HUMAN, 25), null);
  assert.equal(createAIWarDeclarationDialogueRequest(decision({ actorNationId: HUMAN, targetNationId: AI }), HUMAN, 25), null);
  assert.equal(createAIWarDeclarationDialogueRequest(decision({ action: 'openBorders' }), HUMAN, 25), null);
});

test('normal AI declaration changes war state and emits one classified dialogue request', () => {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: AI, name: 'England', color: 0, isHuman: false }));
  nations.addNation(new Nation({ id: HUMAN, name: 'Sweden', color: 0, isHuman: true }));
  const turns = new TurnManager(nations);
  const diplomacy = new DiplomacyManager(turns);
  diplomacy.setMemoryValues(AI, HUMAN, { trust: 10, fear: 10, hostility: 80, affinity: -20, suspicion: 20 });
  const evaluation = new DiplomaticEvaluationSystem(diplomacy);
  const military = {
    compareMilitaryStrength: () => 'stronger',
    compareMilitaryStrengthForWar: () => 'stronger',
    getDefensiveWarPowerBreakdown: () => ({
      defenderPower: 50, alliancePower: 0, peacekeepingPower: 0,
      totalDefensivePower: 50, allianceName: null, allyNationId: null,
    }),
  } as unknown as AIMilitaryEvaluationSystem;
  const threat = { getThreatLevel: () => 'none' } as unknown as AIMilitaryThreatEvaluationSystem;
  const system = new AIDiplomacySystem(
    diplomacy, evaluation, nations, turns, military, threat, () => true, (_nationId, message) => message,
  );
  const requests = [] as NonNullable<ReturnType<typeof createAIWarDeclarationDialogueRequest>>[];
  system.onDecision((emitted) => {
    const request = createAIWarDeclarationDialogueRequest(emitted, HUMAN, turns.getCurrentRound());
    if (request) requests.push(request);
  });

  system.runTurn(AI);
  assert.equal(diplomacy.getState(AI, HUMAN), 'WAR');
  assert.equal(requests.length, 1);
  assert.ok(requests[0].phrase.length > 0);
});

test('human declarations, alliance cascades, and restored starting wars create no AI decision dialogue', () => {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: AI, name: 'England', color: 0, isHuman: false }));
  nations.addNation(new Nation({ id: HUMAN, name: 'Sweden', color: 0, isHuman: true }));
  nations.addNation(new Nation({ id: THIRD, name: 'France', color: 0, isHuman: false }));
  const turns = new TurnManager(nations);
  const diplomacy = new DiplomacyManager(turns);
  const alliances = new AllianceManager();
  new AllianceWarSystem(diplomacy, alliances);
  alliances.createAlliance(HUMAN, THIRD, 'Defensive League', 1);
  diplomacy.setMemoryValues(AI, THIRD, { trust: 10, fear: 10, hostility: 80, affinity: -20, suspicion: 20 });
  const evaluation = new DiplomaticEvaluationSystem(diplomacy);
  const military = {
    compareMilitaryStrength: () => 'stronger',
    compareMilitaryStrengthForWar: () => 'stronger',
    getDefensiveWarPowerBreakdown: () => ({
      defenderPower: 50, alliancePower: 50, peacekeepingPower: 0,
      totalDefensivePower: 100, allianceName: 'Defensive League', allyNationId: HUMAN,
    }),
  } as unknown as AIMilitaryEvaluationSystem;
  const threat = { getThreatLevel: () => 'none' } as unknown as AIMilitaryThreatEvaluationSystem;
  const system = new AIDiplomacySystem(
    diplomacy, evaluation, nations, turns, military, threat, () => true, (_nationId, message) => message,
  );
  let directDecisions = 0;
  const presentationRequests = [] as NonNullable<ReturnType<typeof createAIWarDeclarationDialogueRequest>>[];
  system.onDecision((emitted) => {
    directDecisions += 1;
    const request = createAIWarDeclarationDialogueRequest(emitted, HUMAN, turns.getCurrentRound());
    if (request) presentationRequests.push(request);
  });

  // The AI directly chooses war with France. Sweden joins defensively, but the
  // one AI decision still targets France and therefore requests no human dialog.
  system.runTurn(AI);
  assert.equal(diplomacy.getState(AI, THIRD), 'WAR');
  assert.equal(diplomacy.getState(HUMAN, AI), 'WAR');
  assert.equal(directDecisions, 1);
  assert.equal(presentationRequests.length, 0);

  const humanDiplomacy = new DiplomacyManager();
  assert.equal(humanDiplomacy.declareWar(HUMAN, AI), true);
  assert.equal(presentationRequests.length, 0);

  const restored = new DiplomacyManager();
  let restoredEvents = 0;
  restored.onWarDeclared(() => { restoredEvents += 1; });
  restored.restoreState(AI, HUMAN, { state: 'WAR' });
  assert.equal(restored.getState(AI, HUMAN), 'WAR');
  assert.equal(restoredEvents, 0);
});
