import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getPolicyById, getPoliciesByRequiredCultureNodeId } from '../src/data/policies.ts';
import { SPY, AGENT, REBELS, PARTISANS, WARRIOR } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { getForeignInsurgentStrengthMultiplier } from '../src/systems/CombatSystem.ts';
import { resolveCombat } from '../src/systems/CombatResolver.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { GossipSystem } from '../src/systems/GossipSystem.ts';
import type { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { PolicySystem } from '../src/systems/PolicySystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { ResourceSystem } from '../src/systems/ResourceSystem.ts';
import { TileResourceGenerator } from '../src/systems/ResourceGenerator.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { isWorldCouncilVoteActive } from '../src/systems/WorldCouncilSystem.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { getCulturePolicyUnlockNames } from '../src/ui/hud/NationHudDataProvider.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const HUMAN = 'human';
const FOREIGN = 'foreign';
const DIPLOMATIC_POLICIES = [
  ['foreign_intelligence', 'colonialism', 'unitProductionCostPercent'],
  ['backroom_diplomacy', 'ideology', 'gossipManipulationInfluenceCostPercent'],
  ['economic_imperialism', 'class_struggle', 'foreignExploitationYieldPercent'],
  ['international_lobbying', 'suffrage', 'activeWorldCouncilVoteInfluencePercent'],
  ['proxy_warfare', 'cold_war', 'foreignInsurgentEffectivenessPercent'],
] as const;

function makePolicyHarness(nodeId: string) {
  const nations = new NationManager();
  nations.addNation(new Nation({
    id: HUMAN,
    name: 'Human',
    color: 0,
    isHuman: true,
    unlockedCultureNodeIds: ['mysticism', 'diplomatic_service', nodeId],
  }));
  const policies = new PolicySystem(nations);
  return { nations, policies };
}

test('five ordinary Diplomatic policies use the requested conflict-free culture nodes and modifiers', () => {
  for (const [policyId, nodeId, modifierType] of DIPLOMATIC_POLICIES) {
    const policy = getPolicyById(policyId);
    assert.ok(policy);
    assert.equal(policy.category, 'diplomatic');
    assert.equal(policy.requiredCultureNodeId, nodeId);
    assert.equal(policy.modifiers[0]?.type, modifierType);
    assert.deepEqual(
      getPoliciesByRequiredCultureNodeId(nodeId).map((entry) => entry.id),
      [policyId],
    );
  }
});

test('new Diplomatic policies use normal Diplomatic slots, remain wildcard-compatible, and survive save/load', () => {
  for (const [policyId, nodeId] of DIPLOMATIC_POLICIES) {
    const { nations, policies } = makePolicyHarness(nodeId);
    assert.equal(policies.getSlotCounts(HUMAN).diplomatic, 1);
    assert.equal(policies.activatePolicy(HUMAN, policyId, 'diplomatic'), true);
    const saved = policies.getActivePolicyAssignments(HUMAN);
    const restored = new PolicySystem(nations);
    restored.loadNationPolicies(HUMAN, saved);
    assert.deepEqual(restored.getActivePolicyAssignments(HUMAN), saved);
    assert.equal(policies.deactivatePolicy(HUMAN, policyId), true);
    assert.equal(policies.activatePolicy(HUMAN, policyId, 'wildcard'), true);
  }
});

test('Foreign Intelligence halves only the four configured covert-unit Production costs while active', () => {
  const { nations, policies } = makePolicyHarness('colonialism');
  const cities = new CityManager();
  cities.addCity(new City({ id: 'capital', name: 'Capital', ownerId: HUMAN, tileX: 0, tileY: 0 }));
  const production = new ProductionSystem(
    cities,
    { on: () => {} } as unknown as TurnManager,
    {} as HappinessSystem,
    undefined,
    policies,
    nations,
  );
  const cost = (unitType: typeof SPY) => production.getCost({ kind: 'unit', unitType }, 'capital');
  const baseCosts = [SPY, AGENT, REBELS, PARTISANS].map((unitType) => cost(unitType));
  assert.equal(policies.activatePolicy(HUMAN, 'foreign_intelligence', 'wildcard'), true);
  assert.deepEqual(
    [SPY, AGENT, REBELS, PARTISANS].map((unitType) => cost(unitType)),
    baseCosts.map((value) => Math.round(value * 0.5)),
  );
  assert.equal(production.getCost({ kind: 'unit', unitType: WARRIOR }, 'capital'), WARRIOR.productionCost);
  policies.deactivatePolicy(HUMAN, 'foreign_intelligence');
  assert.deepEqual([SPY, AGENT, REBELS, PARTISANS].map((unitType) => cost(unitType)), baseCosts);
});

test('Backroom Diplomacy discounts the final Manipulation cost without changing selected strength', () => {
  const { nations, policies } = makePolicyHarness('ideology');
  nations.addNation(new Nation({ id: FOREIGN, name: 'Foreign', color: 1 }));
  nations.addNation(new Nation({ id: 'target', name: 'Target', color: 2 }));
  nations.getResources(HUMAN).influence = 1_000;
  const diplomacy = new DiplomacyManager();
  const gossip = new GossipSystem(
    nations,
    diplomacy,
    { spendInfluence: (_nationId, amount) => amount },
    () => 10,
    { hasMet: () => true },
    () => 'renaissance',
    () => 0,
    (nationId) => policies.getPercentModifierTotal(nationId, 'gossipManipulationInfluenceCostPercent'),
  );
  const before = gossip.getManipulationCost('spread_slander', HUMAN, 25)!;
  assert.equal(policies.activatePolicy(HUMAN, 'backroom_diplomacy', 'wildcard'), true);
  const after = gossip.getManipulationCost('spread_slander', HUMAN, 25)!;
  assert.equal(after.actualCost, Math.ceil(before.actualCost * 0.5));
  assert.equal(after.selectedInfluenceTier, before.selectedInfluenceTier);
  assert.equal(after.itemWeight, before.itemWeight);
  assert.equal(gossip.getManipulationCost('share_opinion', HUMAN, 25), undefined);
});

test('Economic Imperialism boosts valid foreign exploitation yield but not domestic or invalid-rights yield', () => {
  const { policies } = makePolicyHarness('class_struggle');
  const foreignIron: Tile = {
    x: 0, y: 0, type: TileType.Plains, ownerId: FOREIGN,
    resourceId: 'iron', improvementId: 'mine', improvementOwnerId: HUMAN,
  };
  const domesticIron: Tile = {
    x: 1, y: 0, type: TileType.Plains, ownerId: HUMAN,
    resourceId: 'iron', improvementId: 'mine', improvementOwnerId: HUMAN,
  };
  const mapData: MapData = { width: 2, height: 1, tileSize: 1, tiles: [[foreignIron, domesticIron]] };
  const access = new ResourceAccessSystem(mapData, { getAllDeals: () => [] });
  let rightsActive = true;
  access.setForeignExploitationYieldPercentProvider((beneficiary, owner) => (
    rightsActive && beneficiary === HUMAN && owner === FOREIGN
      ? policies.getPercentModifierTotal(beneficiary, 'foreignExploitationYieldPercent')
      : 0
  ));
  assert.equal(access.getOwnedResourceSourceCount(HUMAN, 'iron'), 4);
  assert.equal(policies.activatePolicy(HUMAN, 'economic_imperialism', 'wildcard'), true);
  assert.equal(access.getOwnedResourceSourceCount(HUMAN, 'iron'), 5);
  rightsActive = false;
  assert.equal(access.getOwnedResourceSourceCount(HUMAN, 'iron'), 4);
});

test('International Lobbying adds 50% Influence generation only during the existing active-vote state', () => {
  const { nations, policies } = makePolicyHarness('suffrage');
  const cities = new CityManager();
  const city = new City({ id: 'capital', name: 'Capital', ownerId: HUMAN, tileX: 0, tileY: 0 });
  city.population = 10;
  city.ownedTileCoords = [{ x: 0, y: 0 }];
  cities.addCity(city);
  const tile: Tile = { x: 0, y: 0, type: TileType.Plains, ownerId: HUMAN };
  const mapData: MapData = { width: 1, height: 1, tileSize: 1, tiles: [[tile]] };
  const turns = new TurnManager(nations);
  const resources = new ResourceSystem(
    nations,
    cities,
    turns,
    new TileResourceGenerator(),
    mapData,
    new HexGridSystem(),
    { recalculateNation: () => {}, getProductionModifier: () => 1 } as unknown as HappinessSystem,
    undefined,
    undefined,
    undefined,
    policies,
  );
  let voteActive = false;
  resources.setWorldCouncilVoteActiveProvider(() => voteActive);
  resources.recalculateForNation(HUMAN);
  const normal = nations.getResources(HUMAN).influencePerTurn;
  assert.equal(policies.activatePolicy(HUMAN, 'international_lobbying', 'wildcard'), true);
  resources.recalculateForNation(HUMAN);
  assert.equal(nations.getResources(HUMAN).influencePerTurn, normal);
  voteActive = true;
  resources.recalculateForNation(HUMAN);
  assert.equal(nations.getResources(HUMAN).influencePerTurn, Math.round(normal * 1.5));
  voteActive = false;
  resources.recalculateForNation(HUMAN);
  assert.equal(nations.getResources(HUMAN).influencePerTurn, normal);

  assert.equal(isWorldCouncilVoteActive({ status: 'active', nextRegularMeetingTurn: 20, meetings: [] }, 20), true);
  assert.equal(isWorldCouncilVoteActive({
    status: 'active',
    nextRegularMeetingTurn: 40,
    meetings: [{ id: 1, kind: 'regular', turn: 20, cityId: 'capital', proposals: [{ slot: 'host', resolutionId: 'shared_cartography' }] }],
  }, 20), true);
  assert.equal(isWorldCouncilVoteActive({ status: 'active', nextRegularMeetingTurn: 40, meetings: [] }, 20), false);
});

test('Proxy Warfare adds exactly 50% combat effectiveness only to Rebels and Partisans in foreign territory', () => {
  assert.equal(getForeignInsurgentStrengthMultiplier('rebels', HUMAN, FOREIGN, 50), 1.5);
  assert.equal(getForeignInsurgentStrengthMultiplier('partisans', HUMAN, FOREIGN, 50), 1.5);
  assert.equal(getForeignInsurgentStrengthMultiplier('rebels', HUMAN, HUMAN, 50), 1);
  assert.equal(getForeignInsurgentStrengthMultiplier('spy', HUMAN, FOREIGN, 50), 1);
  assert.equal(getForeignInsurgentStrengthMultiplier('agent', HUMAN, FOREIGN, 50), 1);
  assert.equal(getForeignInsurgentStrengthMultiplier('warrior', HUMAN, FOREIGN, 50), 1);

  const attacker = new Unit({ id: 'rebels', name: 'Rebels', ownerId: HUMAN, unitType: REBELS, tileX: 0, tileY: 0 });
  const defender = new Unit({ id: 'warrior', name: 'Warrior', ownerId: FOREIGN, unitType: WARRIOR, tileX: 1, tileY: 0 });
  const normal = resolveCombat(attacker, defender);
  const boosted = resolveCombat(attacker, defender, { attackerStrengthMultiplier: 1.5 });
  assert.equal(boosted.defenderDamageTaken, Math.round(normal.defenderDamageTaken * 1.5));
});

test('Culture Tree policy unlock labels are derived for new, athlete, and existing policy cards', () => {
  assert.deepEqual(getCulturePolicyUnlockNames('colonialism'), ['Foreign Intelligence']);
  assert.deepEqual(getCulturePolicyUnlockNames('games_recreation'), ['Aleksandr Barelin']);
  assert.deepEqual(getCulturePolicyUnlockNames('craftsmanship'), ['Republic', 'Discipline']);
});

test('five Diplomatic policy artworks are unique 256x256 RGBA non-interlaced PNG files', () => {
  const hashes = new Set<string>();
  for (const [policyId] of DIPLOMATIC_POLICIES) {
    const png = readFileSync(new URL(`../public/assets/sprites/policies/${policyId}.png`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[25], 6, `${policyId} must be RGBA`);
    assert.equal(png[28], 0, `${policyId} must be non-interlaced`);
    hashes.add(createHash('sha256').update(png).digest('hex'));
  }
  assert.equal(hashes.size, DIPLOMATIC_POLICIES.length);
});
