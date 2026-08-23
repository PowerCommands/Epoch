/** Non-rendering coordination tests for the Step 2 Gossip GUI. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GOSSIP_DEFINITIONS } from '../src/data/gossip.ts';
import { WorldInputGate } from '../src/systems/input/WorldInputGate.ts';
import type { GossipExecutionInput, GossipExecutionResult } from '../src/types/gossip.ts';
import type { LeaderDefinition } from '../src/types/leader.ts';
import {
  GossipDialogModel,
  filterGossipTargets,
  type GossipDialogContext,
} from '../src/ui/dialogs/GossipDialogModel.ts';
import { buildLeaderDialogSection } from '../src/ui/phaser/RightSidebarPanelDataProvider.ts';

const SOURCE = 'nation_sweden';
const RECIPIENT = 'nation_england';
const TARGET = 'nation_france';

const leader: LeaderDefinition = {
  id: 'leader_henry_v',
  nationId: RECIPIENT,
  name: 'Henry V',
  title: 'King of England',
  image: '/henry.png',
  description: '',
  ideologyId: 'militarism',
  aiMilitaryDoctrineId: 'navalPower',
  aiPersonality: {
    aggressionBias: 0, expansionBias: 0, economyBias: 0, cultureBias: 0, diplomacyBias: 0,
    warTolerance: 0, peacePreference: 0, minimumUnitsLostBeforePeace: 0, casualtyToleranceRatio: 0,
  },
};

function successful(input: GossipExecutionInput): GossipExecutionResult {
  const item = GOSSIP_DEFINITIONS.find((candidate) => candidate.id === input.itemId)!;
  return {
    success: true,
    itemId: input.itemId,
    type: item.type,
    resolvedText: `${input.itemId}:${input.targetNationId ?? 'none'}`,
    responseText: item.type === 'information' ? 'A diplomatic opinion.' : undefined,
    influenceSpent: input.influence ?? 0,
    cooldownRemainingRounds: item.type === 'manipulation' ? 10 : 0,
  };
}

function makeContext(options: {
  influence?: number;
  cooldown?: number;
  insultCooldown?: number;
  lockedItemIds?: readonly string[];
} = {}) {
  const calls: GossipExecutionInput[] = [];
  const context: GossipDialogContext = {
    getAvailableItems: () => GOSSIP_DEFINITIONS,
    getValidTargets: () => [{ nationId: TARGET, nationName: 'France', leaderId: 'leader_charles_vii', leaderName: 'Charles VII' }],
    getHumanInfluence: () => options.influence ?? 100,
    getItemAvailability: (_sourceNationId, itemId) => options.lockedItemIds?.includes(itemId)
      ? {
        available: false,
        failureReason: 'culture_locked',
        requiredCultureNodeId: 'political_philosophy',
        requiredCultureNodeName: 'Political Philosophy',
      }
      : { available: true },
    getManipulationStatus: () => options.cooldown
      ? { allowed: false, remainingRounds: options.cooldown, failureReason: 'cooldown_active' }
      : { allowed: true, remainingRounds: 0 },
    getManipulationCost: (itemId, sourceNationId, selectedInfluenceTier) => ({
      itemId, sourceNationId, selectedInfluenceTier, sourceEra: 'ancient',
      eraMultiplier: 1, itemWeight: 1, actualCost: selectedInfluenceTier,
    }),
    getInsultStatus: () => options.insultCooldown
      ? { allowed: false, remainingRounds: options.insultCooldown, failureReason: 'insult_cooldown_active' }
      : { allowed: true, remainingRounds: 0 },
    resolveText: (input) => `preview:${input.itemId}:${input.targetNationId ?? 'none'}`,
    execute: (input) => {
      calls.push(input);
      return successful(input);
    },
  };
  return { context, calls };
}

test('Leader Details uses a Dialog section with Audience and Gossip actions for known foreign leaders', () => {
  const opened: string[] = [];
  const section = buildLeaderDialogSection(leader, false, true, {
    arrangeAudience: (id) => opened.push(`audience:${id}`),
    arrangeGossip: (id) => opened.push(`gossip:${id}`),
  });
  assert.equal(section?.title, 'Dialog');
  assert.deepEqual(section?.rows.map((row) => row.kind === 'button' ? row.text : ''), [
    'Arrange an audience with Henry V',
    'Gossip with Henry V',
  ]);
  for (const row of section?.rows ?? []) if (row.kind === 'button') row.onClick();
  assert.deepEqual(opened, ['audience:leader_henry_v', 'gossip:leader_henry_v']);
});

test('human and unknown leader details expose neither dialog action', () => {
  assert.equal(buildLeaderDialogSection(leader, true, true, {}), undefined);
  assert.equal(buildLeaderDialogSection(leader, false, false, {}), undefined);
});

test('target filtering includes only known third-party nations', () => {
  const filtered = filterGossipTargets([
    { nationId: SOURCE, nationName: 'Sweden', leaderId: 's', leaderName: 'Gustav Vasa', knownToHuman: true },
    { nationId: RECIPIENT, nationName: 'England', leaderId: 'e', leaderName: 'Henry V', knownToHuman: true },
    { nationId: TARGET, nationName: 'France', leaderId: 'f', leaderName: 'Charles VII', knownToHuman: true },
    { nationId: 'nation_hre', nationName: 'HRE', leaderId: 'h', leaderName: 'Sigismund', knownToHuman: false },
  ], SOURCE, RECIPIENT);
  assert.deepEqual(filtered.map((target) => target.nationId), [TARGET]);
});

test('Information execution forwards selected source, recipient, and target ids', () => {
  const { context, calls } = makeContext();
  const model = new GossipDialogModel(SOURCE, context);
  model.open(RECIPIENT);
  const result = model.execute();
  assert.equal(result?.success, true);
  assert.deepEqual(calls, [{
    itemId: 'ask_opinion', sourceNationId: SOURCE, recipientNationId: RECIPIENT,
    targetNationId: TARGET, influence: undefined,
  }]);
});

test('Manipulation forwards the selected Influence commitment', () => {
  const { context, calls } = makeContext();
  const model = new GossipDialogModel(SOURCE, context);
  model.open(RECIPIENT);
  model.selectItem('spread_distrust');
  assert.equal(model.selectInfluence(25), true);
  model.execute();
  assert.equal(calls[0]?.influence, 25);
});

test('unaffordable Influence choices cannot be selected', () => {
  const { context } = makeContext({ influence: 20 });
  const model = new GossipDialogModel(SOURCE, context);
  model.open(RECIPIENT);
  model.selectItem('spread_distrust');
  assert.equal(model.selectInfluence(25), false);
  assert.equal(model.selectInfluence(50), false);
  assert.equal(model.getSelectedInfluence(), 10);
});

test('cooldown disables Manipulation without disabling Information', () => {
  const { context, calls } = makeContext({ cooldown: 8 });
  const model = new GossipDialogModel(SOURCE, context);
  model.open(RECIPIENT);
  assert.equal(model.canExecute(), true);
  model.selectItem('spread_distrust');
  assert.equal(model.canExecute(), false);
  assert.equal(model.execute(), null);
  assert.equal(calls.length, 0);
  model.selectItem('ask_opinion');
  assert.equal(model.canExecute(), true);
});

test('culture-locked items cannot be selected while unlocked automatic questions need no target', () => {
  const lockedHarness = makeContext({ lockedItemIds: ['ask_agenda'] });
  const lockedModel = new GossipDialogModel(SOURCE, lockedHarness.context);
  lockedModel.open(RECIPIENT);
  assert.equal(lockedModel.selectItem('ask_agenda'), false);
  assert.equal(lockedModel.getSelectedItem()?.id, 'ask_opinion');
  assert.equal(lockedModel.getItemAvailability('ask_agenda').requiredCultureNodeName, 'Political Philosophy');

  const unlockedHarness = makeContext();
  const unlockedModel = new GossipDialogModel(SOURCE, unlockedHarness.context);
  unlockedModel.open(RECIPIENT);
  assert.equal(unlockedModel.selectItem('ask_agenda'), true);
  assert.equal(unlockedModel.canExecute(), true);
  unlockedModel.execute();
  assert.deepEqual(unlockedHarness.calls[0], {
    itemId: 'ask_agenda', sourceNationId: SOURCE, recipientNationId: RECIPIENT,
    targetNationId: undefined, influence: undefined,
  });
});

test('Insult cooldown disables Insults without disabling Information', () => {
  const { context, calls } = makeContext({ insultCooldown: 3 });
  const model = new GossipDialogModel(SOURCE, context);
  model.open(RECIPIENT);
  assert.equal(model.selectItem('insult_judgment'), true);
  assert.equal(model.canExecute(), false);
  assert.equal(model.execute(), null);
  assert.equal(calls.length, 0);
  assert.equal(model.selectItem('ask_opinion'), true);
  assert.equal(model.canExecute(), true);
});

test('closing Gossip restores normal world interaction', () => {
  const gate = new WorldInputGate();
  gate.blockWorld('leader-gossip-dialog');
  assert.equal(gate.isWorldInteractionBlocked(), true);
  assert.equal(gate.isPointerClaimed(1), true);
  gate.unblockWorld('leader-gossip-dialog');
  assert.equal(gate.isWorldInteractionBlocked(), false);
  assert.equal(gate.isPointerClaimed(1), false);
});
