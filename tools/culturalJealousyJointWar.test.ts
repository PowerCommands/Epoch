import assert from 'node:assert/strict';
import test from 'node:test';

import { Nation } from '../src/entities/Nation.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import type { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem.ts';
import type { AllianceManager } from '../src/systems/diplomacy/AllianceManager.ts';
import type { DiplomaticEvaluationSystem } from '../src/systems/diplomacy/DiplomaticEvaluationSystem.ts';
import { JointWarSystem } from '../src/systems/diplomacy/JointWarSystem.ts';
import type { JointWarProposal } from '../src/types/jointWar.ts';

const CHINA = 'china';
const MONGOLIA = 'mongolia';
const FRANCE = 'france';
const SWEDEN = 'sweden';
const ENGLAND = 'england';

interface HarnessOptions {
  inactiveNationIds?: ReadonlySet<string>;
  alliedPairs?: ReadonlySet<string>;
}

function pair(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function harness(options: HarnessOptions = {}) {
  const nations = new NationManager();
  for (const id of [CHINA, MONGOLIA, FRANCE, SWEDEN, ENGLAND]) {
    nations.addNation(new Nation({ id, name: id, color: 0xffffff, isHuman: id === CHINA }));
  }
  const diplomacy = new DiplomacyManager();
  diplomacy.setMemoryValues(MONGOLIA, FRANCE, {
    trust: 0,
    fear: 100,
    hostility: 0,
    affinity: 100,
    suspicion: 0,
  });
  const evaluation = {
    evaluateAttitude: (viewerId: string, targetId: string) => (
      viewerId === MONGOLIA && (targetId === FRANCE || targetId === SWEDEN)
        ? 'friendly'
        : 'hostile'
    ),
  } as unknown as DiplomaticEvaluationSystem;
  const military = {
    isNationActive: (nationId: string) => !options.inactiveNationIds?.has(nationId),
    getMilitaryStrength: (nationId: string) => ({ totalStrength: nationId === MONGOLIA ? 1 : 100 }),
    getDefensiveWarPowerAgainst: () => 10_000,
  } as unknown as AIMilitaryEvaluationSystem;
  const alliances = {
    areAllied: (a: string, b: string) => options.alliedPairs?.has(pair(a, b)) ?? false,
  } as unknown as AllianceManager;
  const system = new JointWarSystem(
    diplomacy,
    evaluation,
    military,
    alliances,
    nations,
    () => true,
  );
  system.setCulturalJealousyTargetPredicate((nationId, targetId) =>
    nations.getNation(nationId)?.culturalJealousyTargetId === targetId);
  return { diplomacy, nations, system };
}

test('Cultural Jealousy alone does not declare unilateral war on its antagonist', () => {
  const h = harness();
  h.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = FRANCE;
  assert.equal(h.diplomacy.getState(MONGOLIA, FRANCE), 'PEACE');
});

test('a legal coalition proposal against the jealousy antagonist is accepted despite all desirability rejects', () => {
  const h = harness();
  h.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = FRANCE;

  // Friendly attitude, extreme fear, near-zero receiver strength, and enormous
  // defensive overmatch would each keep the ordinary acceptance path negative.
  assert.equal(h.system.shouldAccept(MONGOLIA, CHINA, FRANCE, 'request', false, 0), true);

  // Joining an existing proposer war uses the same override.
  h.diplomacy.declareWar(ENGLAND, FRANCE);
  assert.equal(h.system.shouldAccept(MONGOLIA, ENGLAND, FRANCE, 'join', false, 0), true);
});

test('human-to-AI and AI-to-AI proposals share the jealousy acceptance path', () => {
  const h = harness();
  h.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = FRANCE;
  assert.equal(h.nations.getNation(CHINA)?.isHuman, true);
  assert.equal(h.nations.getNation(ENGLAND)?.isHuman, false);
  assert.equal(h.system.shouldAccept(MONGOLIA, CHINA, FRANCE, 'request'), true);
  assert.equal(h.system.shouldAccept(MONGOLIA, ENGLAND, FRANCE, 'request'), true);
});

test('an active jealousy opportunity requires no gold and bypasses prior payment escalation', () => {
  const h = harness();
  h.diplomacy.declareWar(ENGLAND, FRANCE);
  const proposal: JointWarProposal = {
    proposerNationId: ENGLAND,
    receiverNationId: MONGOLIA,
    targetNationId: FRANCE,
    kind: 'join',
  };
  h.system.recordRejectedProposal(proposal);
  h.system.recordRejectedProposal(proposal);
  assert.equal(h.system.getGoldOffer(ENGLAND, MONGOLIA, FRANCE), 20_000);

  h.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = FRANCE;
  assert.equal(h.system.getGoldOffer(ENGLAND, MONGOLIA, FRANCE), 0);
  assert.equal(h.system.shouldAccept(MONGOLIA, ENGLAND, FRANCE, 'join', false, 0), true);
});

test('non-antagonist, cleared, and changed jealousy targets retain normal rejection logic', () => {
  const h = harness();
  h.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = FRANCE;
  assert.equal(h.system.shouldAccept(MONGOLIA, CHINA, SWEDEN, 'request'), false);

  h.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = undefined;
  assert.equal(h.system.shouldAccept(MONGOLIA, CHINA, FRANCE, 'request'), false);

  h.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = SWEDEN;
  assert.equal(h.system.shouldAccept(MONGOLIA, CHINA, FRANCE, 'request'), false);
});

test('hard Joint War legality still blocks jealousy acceptance', () => {
  const allied = harness({ alliedPairs: new Set([pair(MONGOLIA, FRANCE)]) });
  allied.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = FRANCE;
  assert.equal(allied.system.shouldAccept(MONGOLIA, CHINA, FRANCE, 'request'), false);

  const inactive = harness({ inactiveNationIds: new Set([FRANCE]) });
  inactive.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = FRANCE;
  assert.equal(inactive.system.shouldAccept(MONGOLIA, CHINA, FRANCE, 'request'), false);

  const inactiveReceiver = harness({ inactiveNationIds: new Set([MONGOLIA]) });
  inactiveReceiver.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = FRANCE;
  assert.equal(inactiveReceiver.system.shouldAccept(MONGOLIA, CHINA, FRANCE, 'request'), false);

  const alreadyAtWar = harness();
  alreadyAtWar.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = FRANCE;
  alreadyAtWar.diplomacy.declareWar(MONGOLIA, FRANCE);
  assert.equal(alreadyAtWar.system.shouldAccept(MONGOLIA, CHINA, FRANCE, 'request'), false);

  const ceasefire = harness();
  ceasefire.nations.getNation(MONGOLIA)!.culturalJealousyTargetId = FRANCE;
  ceasefire.diplomacy.declareWar(MONGOLIA, FRANCE);
  ceasefire.diplomacy.enforceCeasefire(MONGOLIA, FRANCE, 5);
  assert.equal(ceasefire.system.shouldAccept(MONGOLIA, CHINA, FRANCE, 'request'), false);
});
