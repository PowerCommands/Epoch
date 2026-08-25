import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GOSSIP_DEFINITIONS } from '../src/data/gossip';
import { getGamesSportById } from '../src/data/gamesOfNationsSports';
import { getLeaderByNationId } from '../src/data/leaders';
import { Nation } from '../src/entities/Nation';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { GossipSystem } from '../src/systems/GossipSystem';
import { NationManager } from '../src/systems/NationManager';
import { GossipDialogModel, type GossipDialogContext } from '../src/ui/dialogs/GossipDialogModel';

const HUMAN = 'nation_sweden';
const ENGLAND = 'nation_england';
const LITHUANIA = 'nation_lithuania';
const NOVGOROD = 'nation_novgorod';

function pairKey(a: string, b: string): string { return a < b ? `${a}|${b}` : `${b}|${a}`; }

function harness(options: { founded?: boolean; met?: string[] } = {}) {
  let round = 100;
  let founded = options.founded ?? true;
  const nations = new NationManager();
  for (const config of [
    { id: HUMAN, name: 'Sweden', isHuman: true },
    { id: ENGLAND, name: 'England', isHuman: false },
    { id: LITHUANIA, name: 'Lithuania', isHuman: false },
    { id: NOVGOROD, name: 'Novgorod', isHuman: false },
  ]) nations.addNation(new Nation({ ...config, color: 0 }));
  const diplomacy = new DiplomacyManager();
  const met = new Set((options.met ?? [ENGLAND, LITHUANIA, NOVGOROD]).map((id) => pairKey(HUMAN, id)));
  let influenceSpent = 0;
  const gossip = new GossipSystem(
    nations,
    diplomacy,
    { spendInfluence: (_nationId, amount) => { influenceSpent += amount; return amount; } },
    () => round,
    {
      hasMet: (a, b) => a === b || met.has(pairKey(a, b)),
      isGamesOfNationsFounded: () => founded,
    },
  );
  return {
    nations, diplomacy, gossip,
    get influenceSpent() { return influenceSpent; },
    setFounded(value: boolean) { founded = value; },
    setRound(value: number) { round = value; },
  };
}

function ask(gossip: GossipSystem, recipientNationId = ENGLAND) {
  return gossip.execute({
    itemId: 'ask_sports_preferences',
    sourceNationId: HUMAN,
    recipientNationId,
  });
}

test('sports question requires founded Games and an encountered recipient, but no relationship threshold', () => {
  const before = harness({ founded: false, met: [ENGLAND] });
  assert.deepEqual(before.gossip.getItemAvailability(HUMAN, 'ask_sports_preferences', ENGLAND), {
    available: false, visible: false, failureReason: 'games_not_founded',
  });
  before.setFounded(true);
  assert.equal(before.gossip.getItemAvailability(HUMAN, 'ask_sports_preferences', ENGLAND).available, true);

  const unmet = harness({ founded: true, met: [] });
  assert.deepEqual(unmet.gossip.getItemAvailability(HUMAN, 'ask_sports_preferences', ENGLAND), {
    available: false, visible: false, failureReason: 'invalid_recipient',
  });
  assert.equal(ask(unmet.gossip).success, false);

  for (const relation of [
    { trust: 90, affinity: 90, hostility: 0, suspicion: 0, state: 'PEACE' as const },
    { trust: 50, affinity: 50, hostility: 50, suspicion: 50, state: 'PEACE' as const },
    { trust: 0, affinity: 0, hostility: 100, suspicion: 100, state: 'WAR' as const },
  ]) {
    const h = harness();
    h.diplomacy.setMemoryValues(HUMAN, ENGLAND, relation);
    if (relation.state === 'WAR') h.diplomacy.declareWar(HUMAN, ENGLAND);
    assert.equal(h.gossip.getItemAvailability(HUMAN, 'ask_sports_preferences', ENGLAND).available, true);
    assert.equal(ask(h.gossip).success, true);
  }
});

test('answer reveals both canonical leader preferences, including an unintroduced additional sport', () => {
  for (const recipientNationId of [ENGLAND, LITHUANIA, NOVGOROD]) {
    const h = harness();
    const leader = getLeaderByNationId(recipientNationId)!;
    const expectedTraditional = getGamesSportById(leader.gamesOfNationsPreferences.traditionalFavourite).name;
    const expectedAdditional = getGamesSportById(leader.gamesOfNationsPreferences.additionalFavourite).name;
    const result = ask(h.gossip, recipientNationId);
    assert.equal(result.success, true);
    if (!result.success) continue;
    assert.match(result.responseText!, new RegExp(expectedTraditional, 'i'));
    assert.match(result.responseText!, new RegExp(expectedAdditional, 'i'));
    assert.deepEqual(h.gossip.getKnownSportsPreferences(HUMAN, recipientNationId), {
      traditionalSport: expectedTraditional,
      additionalSport: expectedAdditional,
    });
  }
  assert.equal(harness().gossip.getKnownSportsPreferences(HUMAN, LITHUANIA), null);
});

test('asking is deterministic and has no diplomatic or economic effect', () => {
  const first = harness();
  const second = harness();
  const resources = first.nations.getResources(HUMAN);
  resources.gold = 321;
  resources.culture = 123;
  resources.influence = 77;
  const relationBefore = first.diplomacy.getAllStates();
  const resourcesBefore = { gold: resources.gold, culture: resources.culture, influence: resources.influence };
  const result = ask(first.gossip);
  const sameResult = ask(second.gossip);
  assert.equal(result.success, true);
  assert.equal(sameResult.success, true);
  if (result.success && sameResult.success) {
    assert.equal(result.responseText, sameResult.responseText);
    assert.equal(result.influenceSpent, 0);
    assert.equal(result.diplomaticEffect, undefined);
  }
  assert.deepEqual(first.diplomacy.getAllStates(), relationBefore);
  assert.deepEqual({ gold: resources.gold, culture: resources.culture, influence: resources.influence }, resourcesBefore);
  assert.equal(first.influenceSpent, 0);
});

test('discovery is one-time, target-specific, turn-stable, and backward-compatible through save/load', () => {
  const h = harness();
  assert.equal(h.gossip.hasDiscoveredSportsPreferences(HUMAN, ENGLAND), false);
  assert.equal(ask(h.gossip).success, true);
  assert.equal(h.gossip.hasDiscoveredSportsPreferences(HUMAN, ENGLAND), true);
  assert.equal(h.gossip.hasDiscoveredSportsPreferences(HUMAN, LITHUANIA), false);
  assert.deepEqual(h.gossip.getItemAvailability(HUMAN, 'ask_sports_preferences', ENGLAND), {
    available: false, visible: false, failureReason: 'already_discovered',
  });
  assert.equal(ask(h.gossip).success, false);
  h.setRound(999);
  assert.equal(h.gossip.hasDiscoveredSportsPreferences(HUMAN, ENGLAND), true);

  const restoredHarness = harness();
  restoredHarness.gossip.restore(JSON.parse(JSON.stringify(h.gossip.serialize())));
  assert.deepEqual(
    restoredHarness.gossip.getKnownSportsPreferences(HUMAN, ENGLAND),
    h.gossip.getKnownSportsPreferences(HUMAN, ENGLAND),
  );
  const oldSaveHarness = harness();
  oldSaveHarness.gossip.restore({ manipulationCooldowns: [] });
  assert.equal(oldSaveHarness.gossip.hasDiscoveredSportsPreferences(HUMAN, ENGLAND), false);
});

test('dialog lists the question only while discoverable and retains known names after reopening', () => {
  const h = harness();
  const context: GossipDialogContext = {
    getAvailableItems: () => GOSSIP_DEFINITIONS,
    getValidTargets: () => [],
    getHumanInfluence: () => 0,
    getItemAvailability: (source, item, recipient) => h.gossip.getItemAvailability(source, item, recipient),
    getKnownSportsPreferences: (source, recipient) => h.gossip.getKnownSportsPreferences(source, recipient),
    getManipulationStatus: (source, recipient) => h.gossip.getManipulationStatus(source, recipient),
    getManipulationCost: (item, source, tier) => h.gossip.getManipulationCost(item, source, tier),
    getInsultStatus: (source, recipient) => h.gossip.getInsultStatus(source, recipient),
    resolveText: (input) => h.gossip.resolveText(input),
    execute: (input) => h.gossip.execute(input),
  };
  const model = new GossipDialogModel(HUMAN, context);
  model.open(LITHUANIA);
  assert.equal(model.getItems().some((item) => item.id === 'ask_sports_preferences'), true);
  assert.equal(model.selectItem('ask_sports_preferences'), true);
  assert.equal(model.execute()?.success, true);
  assert.equal(model.getItems().some((item) => item.id === 'ask_sports_preferences'), false);
  model.close();
  model.open(LITHUANIA);
  assert.deepEqual(model.getKnownSportsPreferences(), {
    traditionalSport: 'Marathon', additionalSport: 'Horse Racing',
  });

  const ui = readFileSync(new URL('../src/ui/dialogs/LeaderGossipDialog.ts', import.meta.url), 'utf8');
  assert.match(ui, /Known Information/);
  assert.match(ui, /Sports Preferences/);
  assert.doesNotMatch(ui, /allocation weight|auction bid multiplier/i);
  assert.equal(getGamesSportById('hundred_metres').name, '100 Metres');
});
