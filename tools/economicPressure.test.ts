/**
 * Focused tests for Economic Pressure Steps 1–2: canonical directional state,
 * Human Audience actions, eligibility/UI state, diplomacy modifiers, and
 * directional trade/resource enforcement.
 *
 * Run with: npx tsx --test tools/economicPressure.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { TradeDealSystem } from '../src/systems/TradeDealSystem.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import { getNaturalResourceById } from '../src/data/naturalResources.ts';
import { getManufacturedResourceById } from '../src/data/manufacturedResources.ts';
import { TARIFF_TRADE_VALUE_MULTIPLIER } from '../src/data/economicPressure.ts';
import { HumanEconomicPressureService } from '../src/systems/diplomacy/HumanEconomicPressureService.ts';
import { DiplomaticEvaluationSystem } from '../src/systems/diplomacy/DiplomaticEvaluationSystem.ts';
import { buildEconomicPressureButtonGroup } from '../src/ui/phaser/RightSidebarPanelDataProvider.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import type { MapData } from '../src/types/map.ts';
import { TileType } from '../src/types/map.ts';
import type { TradeDeal } from '../src/types/tradeDeal.ts';

const A = 'england';
const B = 'germany';
const C = 'france';

function turnManagerStub(getTurn: () => number): TurnManager {
  return { getCurrentRound: getTurn } as unknown as TurnManager;
}

/** DiplomacyManager whose nations all know every economic prerequisite. */
function makeDiplomacy(turn = 1): DiplomacyManager {
  const diplo = new DiplomacyManager(turnManagerStub(() => turn));
  diplo.setEconomicPressureTechnologyChecker(() => true);
  return diplo;
}

function categoryOf(resourceId: string): string {
  return getNaturalResourceById(resourceId)?.category
    ?? (getManufacturedResourceById(resourceId) ? 'manufactured' : 'unknown');
}

// ─── 1, 12: impose + eligibility ─────────────────────────────────────────────

test('a nation can impose Tariffs on another nation', () => {
  const diplo = makeDiplomacy();
  assert.equal(diplo.imposeEconomicPressure(A, B, 'tariffs'), true);
  assert.equal(diplo.hasEconomicPressure(A, B), true);
  assert.equal(diplo.getEconomicPressure(A, B), 'tariffs');
});

test('eligibility blocks self-targeting, war, and missing prerequisites', () => {
  const diplo = new DiplomacyManager(turnManagerStub(() => 1));
  // No prerequisites known yet.
  diplo.setEconomicPressureTechnologyChecker(() => false);
  assert.equal(diplo.canImposeEconomicPressure(A, B, 'tariffs').ok, false);
  assert.equal(diplo.imposeEconomicPressure(A, B, 'tariffs'), false);

  diplo.setEconomicPressureTechnologyChecker(() => true);
  assert.equal(diplo.canImposeEconomicPressure(A, A, 'tariffs').ok, false); // self
  assert.equal(diplo.canImposeEconomicPressure(A, B, 'embargo').ok, true);

  diplo.declareWar(A, B);
  const duringWar = diplo.canImposeEconomicPressure(A, B, 'tariffs');
  assert.equal(duringWar.ok, false);
  assert.match(duringWar.reason ?? '', /war/i);
});

// ─── 2, 15: directionality / independence ────────────────────────────────────

test('directionality: A→B is independent of B→A', () => {
  const diplo = makeDiplomacy();
  diplo.imposeEconomicPressure(A, B, 'embargo');
  assert.equal(diplo.getEconomicPressure(A, B), 'embargo');
  assert.equal(diplo.getEconomicPressure(B, A), null);

  diplo.imposeEconomicPressure(B, A, 'tariffs');
  assert.equal(diplo.getEconomicPressure(A, B), 'embargo');
  assert.equal(diplo.getEconomicPressure(B, A), 'tariffs');

  // Lifting one direction leaves the other intact.
  diplo.liftEconomicPressure(A, B);
  assert.equal(diplo.getEconomicPressure(A, B), null);
  assert.equal(diplo.getEconomicPressure(B, A), 'tariffs');
});

// ─── 3: duplicate application ────────────────────────────────────────────────

test('re-imposing the same measure does not duplicate state', () => {
  const diplo = makeDiplomacy();
  assert.equal(diplo.imposeEconomicPressure(A, B, 'boycott'), true);
  assert.equal(diplo.imposeEconomicPressure(A, B, 'boycott'), false); // no-op
  assert.equal(diplo.getEconomicPressureAgainst(A).length, 1);
});

// ─── 4, 5, 6: escalation and single effective level ──────────────────────────

test('measures escalate in place: Tariffs → Boycott → Embargo, one level only', () => {
  const diplo = makeDiplomacy();
  diplo.imposeEconomicPressure(A, B, 'tariffs');
  assert.equal(diplo.imposeEconomicPressure(A, B, 'boycott'), true);
  assert.equal(diplo.getEconomicPressure(A, B), 'boycott');
  assert.equal(diplo.imposeEconomicPressure(A, B, 'embargo'), true);
  assert.equal(diplo.getEconomicPressure(A, B), 'embargo');

  // Never stacked: exactly one record for this directional pair.
  const against = diplo.getEconomicPressureAgainst(A);
  assert.equal(against.length, 1);
  assert.equal(against[0].type, 'embargo');

  // Lowering also replaces rather than stacking.
  assert.equal(diplo.imposeEconomicPressure(A, B, 'tariffs'), true);
  assert.equal(diplo.getEconomicPressure(A, B), 'tariffs');
  assert.equal(diplo.getEconomicPressureAgainst(A).length, 1);
});

// ─── 7: lifting removes the effect ───────────────────────────────────────────

test('lifting pressure removes the state and its economic effect', () => {
  const diplo = makeDiplomacy();
  diplo.imposeEconomicPressure(A, B, 'embargo');
  assert.equal(diplo.getEconomicPressureTradeValueMultiplier(A, B), 1);
  assert.equal(diplo.isEconomicExchangeBlocked(A, B, 'strategic'), true);

  diplo.liftEconomicPressure(A, B);
  assert.equal(diplo.hasEconomicPressure(A, B), false);
  assert.equal(diplo.getEconomicPressureTradeValueMultiplier(A, B), 1);
  assert.equal(diplo.isEconomicExchangeBlocked(A, B, 'strategic'), false);
});

// ─── effective (bilateral) level + query helpers ─────────────────────────────

test('effective pressure is the stronger of the two directions', () => {
  const diplo = makeDiplomacy();
  diplo.imposeEconomicPressure(A, B, 'tariffs');
  diplo.imposeEconomicPressure(B, A, 'embargo');
  assert.equal(diplo.getEffectiveEconomicPressure(A, B), 'embargo');
  assert.equal(diplo.getEconomicPressureTargeting(A).length, 1);
  assert.equal(diplo.getEconomicPressureTargeting(A)[0].sourceNationId, B);
});

// ─── 8: Tariffs affect trade (DiplomacyManager multiplier) ───────────────────

test('Tariffs and all sanction levels never alter trade value directly', () => {
  const diplo = makeDiplomacy();
  assert.equal(diplo.getEconomicPressureTradeValueMultiplier(A, B), 1);
  diplo.imposeEconomicPressure(A, B, 'tariffs');
  assert.equal(diplo.getEconomicPressureTradeValueMultiplier(A, B), TARIFF_TRADE_VALUE_MULTIPLIER);
  diplo.imposeEconomicPressure(A, B, 'boycott');
  assert.equal(diplo.getEconomicPressureTradeValueMultiplier(A, B), 1);
});

// ─── 8: Tariffs affect trade (TradeDealSystem applies the multiplier) ─────────

test('TradeDealSystem transfers full gold while Tariffs are active', () => {
  const gold = new Map<string, number>([[A, 1000], [B, 1000]]);
  const diploStub = {
    getState: () => 'PEACE',
    hasTradeRelations: () => true,
  } as unknown as DiplomacyManager;

  const trade = new TradeDealSystem(diploStub, () => 1, {
    getGold: (n) => gold.get(n) ?? 0,
    addGold: (n, delta) => gold.set(n, (gold.get(n) ?? 0) + delta),
  });
  trade.setCanExportResource(() => true);

  // B buys iron from A for 100 gold/turn.
  const result = trade.createDeal({ sellerNationId: A, buyerNationId: B, resourceId: 'iron', goldPerTurn: 100, turns: 10 });
  assert.equal(result.ok, true);

  trade.advanceTurnForNation(B);
  assert.equal(gold.get(B), 900); // full 100 transferred
  assert.equal(gold.get(A), 1100);

  trade.advanceTurnForNation(B);
  assert.equal(gold.get(B), 800); // full value remains economically untouched
  assert.equal(gold.get(A), 1200);
});

// ─── 9, 10, 11: Boycott / Embargo resource-access restrictions, no bypass ─────

function makeMap(): MapData {
  return { width: 1, height: 1, tileSize: 32, tiles: [[{ x: 0, y: 0, type: TileType.Plains }]] };
}

function resourceAccessWithDeals(diplo: DiplomacyManager, deals: TradeDeal[]): ResourceAccessSystem {
  const access = new ResourceAccessSystem(makeMap(), { getAllDeals: () => deals });
  access.setImportBlockedPredicate((buyer, seller, rid) =>
    diplo.isEconomicExchangeBlocked(buyer, seller, categoryOf(rid)));
  return access;
}

function importDeal(id: string, seller: string, buyer: string, resourceId: string): TradeDeal {
  return { id, sellerNationId: seller, buyerNationId: buyer, resourceId, goldPerTurn: 10, startTurn: 1, remainingTurns: 10 };
}

test('Boycott blocks every import by the boycotting nation and preserves its exports', () => {
  const diplo = makeDiplomacy();
  const deals = [
    importDeal('d1', A, B, 'wine'),        // luxury
    importDeal('d2', A, B, 'iron'),        // strategic
    importDeal('d3', A, B, 'trade_goods'), // manufactured
  ];
  const access = resourceAccessWithDeals(diplo, deals);

  // No pressure: everything imported.
  assert.equal(access.hasResource(B, 'wine'), true);
  assert.equal(access.hasResource(B, 'iron'), true);
  assert.equal(access.hasResource(B, 'trade_goods'), true);

  diplo.imposeEconomicPressure(B, A, 'boycott');
  assert.equal(access.hasResource(B, 'wine'), false);
  assert.equal(access.hasResource(B, 'trade_goods'), false);
  assert.equal(access.hasResource(B, 'iron'), false);

  const exportAccess = resourceAccessWithDeals(diplo, [importDeal('d4', B, A, 'iron')]);
  assert.equal(exportAccess.hasResource(A, 'iron'), true);
});

test('Embargo blocks every import, natural and manufactured, with no bypass', () => {
  const diplo = makeDiplomacy();
  const deals = [
    importDeal('d1', A, B, 'iron'),        // strategic natural
    importDeal('d2', A, B, 'trade_goods'), // manufactured
  ];
  const access = resourceAccessWithDeals(diplo, deals);

  diplo.imposeEconomicPressure(A, B, 'embargo');
  assert.equal(access.getResourceSourceCount(B, 'iron'), 0);
  assert.equal(access.getResourceSourceCount(B, 'trade_goods'), 0);
  assert.equal(access.hasResource(B, 'iron'), false);
  assert.equal(access.hasResource(B, 'trade_goods'), false);
  assert.ok(!access.getImportedResources(B).includes('iron'));
  assert.ok(!access.getImportedResources(B).includes('trade_goods'));

  // Directional: an unrelated pair (A→C) is unaffected.
  const dealsC = [importDeal('d3', A, C, 'iron')];
  const accessC = resourceAccessWithDeals(diplo, dealsC);
  assert.equal(accessC.hasResource(C, 'iron'), true);

  // Lifting restores access automatically (deal was never deleted).
  diplo.liftEconomicPressure(A, B);
  assert.equal(access.hasResource(B, 'iron'), true);
  assert.equal(access.hasResource(B, 'trade_goods'), true);
});

// ─── 8 (war) : war clears pressure ───────────────────────────────────────────

test('declaring war clears any active Economic Pressure in both directions', () => {
  const diplo = makeDiplomacy();
  diplo.imposeEconomicPressure(A, B, 'embargo');
  diplo.imposeEconomicPressure(B, A, 'tariffs');
  diplo.declareWar(A, B);
  assert.equal(diplo.getEconomicPressure(A, B), null);
  assert.equal(diplo.getEconomicPressure(B, A), null);
});

// ─── 13, 14: save / load ─────────────────────────────────────────────────────

test('save/load preserves active Economic Pressure and imposed turn', () => {
  const diplo = makeDiplomacy(142);
  diplo.imposeEconomicPressure(A, B, 'boycott');
  diplo.imposeEconomicPressure(B, A, 'tariffs');

  const serialized = SaveLoadService.serializeDiplomacy(diplo);
  const restored = makeDiplomacy(200);
  SaveLoadService.restoreDiplomacy(serialized, restored);

  const ab = restored.getEconomicPressureRecord(A, B);
  const ba = restored.getEconomicPressureRecord(B, A);
  assert.equal(ab?.type, 'boycott');
  assert.equal(ab?.imposedTurn, 142);
  assert.equal(ba?.type, 'tariffs');
  assert.equal(ba?.imposedTurn, 142);
});

test('older saves without Economic Pressure load safely as no pressure', () => {
  const restored = makeDiplomacy();
  // A legacy diplomacy entry that predates the feature (no economicPressure*).
  SaveLoadService.restoreDiplomacy(
    [{ nationA: A, nationB: B, state: 'PEACE', tradeRelations: true }],
    restored,
  );
  assert.equal(restored.getEconomicPressure(A, B), null);
  assert.equal(restored.getEconomicPressure(B, A), null);
  assert.equal(restored.hasTradeRelations(A, B), true);
});

// ─── Step 2 Human Audience transaction ──────────────────────────────────────

function makeTradeSystem(diplo: DiplomacyManager): TradeDealSystem {
  diplo.establishEmbassy(A, B);
  diplo.establishEmbassy(B, A);
  assert.equal(diplo.establishTradeRelations(A, B), true);
  const gold = new Map<string, number>([[A, 1000], [B, 1000]]);
  const trade = new TradeDealSystem(diplo, () => 1, {
    getGold: (nationId) => gold.get(nationId) ?? 0,
    addGold: (nationId, amount) => gold.set(nationId, (gold.get(nationId) ?? 0) + amount),
  });
  trade.setCanExportResource(() => true);
  trade.setRestrictionProvider((input) =>
    diplo.isEconomicExchangeBlocked(input.buyerNationId, input.sellerNationId, categoryOf(input.resourceId))
      ? 'Blocked by Economic Pressure.'
      : undefined);
  return trade;
}

test('Human Tariffs create one reciprocal state, preserve trade, and lift directionally', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  assert.equal(trade.createDeal({ sellerNationId: B, buyerNationId: A, resourceId: 'iron', goldPerTurn: 10, turns: 5 }).ok, true);
  const service = new HumanEconomicPressureService(diplo, trade);

  const imposed = service.apply(A, B, 'tariffs', 'Germany');
  assert.equal(imposed.ok, true);
  assert.equal(imposed.reciprocalTariffsCreated, true);
  assert.equal(diplo.getEconomicPressure(A, B), 'tariffs');
  assert.equal(diplo.getEconomicPressure(B, A), 'tariffs');
  assert.equal(trade.getDealsBetween(A, B).length, 1); // no economic/trade effect

  assert.equal(diplo.imposeReciprocalTariffs(B, A), false);
  assert.equal(diplo.getEconomicPressureAgainst(B).length, 1); // no duplicate record

  const lifted = service.apply(A, B, 'tariffs', 'Germany');
  assert.equal(lifted.lifted, true);
  assert.equal(diplo.getEconomicPressure(A, B), null);
  assert.equal(diplo.getEconomicPressure(B, A), 'tariffs');
});

test('Human Boycott terminates imports, preserves exports, and blocks new purchases only', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  assert.equal(trade.createDeal({ sellerNationId: B, buyerNationId: A, resourceId: 'iron', goldPerTurn: 10, turns: 5 }).ok, true);
  assert.equal(trade.createDeal({ sellerNationId: A, buyerNationId: B, resourceId: 'wine', goldPerTurn: 10, turns: 5 }).ok, true);

  const result = new HumanEconomicPressureService(diplo, trade).apply(A, B, 'boycott', 'Germany');
  assert.equal(result.cancelledImports, 1);
  assert.deepEqual(
    trade.getDealsBetween(A, B).map((deal) => [deal.sellerNationId, deal.buyerNationId]),
    [[A, B]],
  );
  assert.equal(trade.createDeal({ sellerNationId: B, buyerNationId: A, resourceId: 'trade_goods', goldPerTurn: 10, turns: 5 }).ok, false);
  assert.equal(trade.createDeal({ sellerNationId: A, buyerNationId: B, resourceId: 'iron', goldPerTurn: 10, turns: 5 }).ok, true);
});

test('Human Embargo replaces Cancel Trade Relations and ends/blocks both directions', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  trade.createDeal({ sellerNationId: B, buyerNationId: A, resourceId: 'iron', goldPerTurn: 10, turns: 5 });
  trade.createDeal({ sellerNationId: A, buyerNationId: B, resourceId: 'wine', goldPerTurn: 10, turns: 5 });
  let cancelledConnections = 0;
  const service = new HumanEconomicPressureService(diplo, trade, {
    cancelConnectionsBetweenNations: () => { cancelledConnections++; },
  });

  assert.equal(service.apply(A, B, 'embargo', 'Germany').ok, true);
  assert.equal(diplo.hasTradeRelations(A, B), false);
  assert.equal(trade.getDealsBetween(A, B).length, 0);
  assert.equal(cancelledConnections, 1);
  assert.equal(trade.createDeal({ sellerNationId: A, buyerNationId: B, resourceId: 'iron', goldPerTurn: 10, turns: 5 }).ok, false);
  assert.equal(trade.createDeal({ sellerNationId: B, buyerNationId: A, resourceId: 'iron', goldPerTurn: 10, turns: 5 }).ok, false);
});

test('only the current sanction level modifies diplomacy, and lifting removes it', () => {
  const diplo = makeDiplomacy();
  const evaluation = new DiplomaticEvaluationSystem(diplo);
  const base = evaluation.evaluateRelation(A, B);

  diplo.imposeEconomicPressure(A, B, 'tariffs');
  const tariffs = evaluation.evaluateRelation(A, B);
  diplo.imposeEconomicPressure(A, B, 'boycott');
  const boycott = evaluation.evaluateRelation(A, B);
  diplo.imposeEconomicPressure(A, B, 'embargo');
  const embargo = evaluation.evaluateRelation(A, B);
  assert.ok(tariffs.hostility > base.hostility);
  assert.ok(boycott.hostility > tariffs.hostility);
  assert.ok(embargo.hostility > boycott.hostility);
  assert.ok(embargo.affinity < boycott.affinity);

  diplo.liftEconomicPressure(A, B);
  const lifted = evaluation.evaluateRelation(A, B);
  assert.equal(lifted.hostility, base.hostility);
  assert.equal(lifted.affinity, base.affinity);
});

test('Audience sanction disabled/selected state matches canonical eligibility', () => {
  const diplo = new DiplomacyManager(turnManagerStub(() => 1));
  diplo.setEconomicPressureTechnologyChecker((_nationId, techId) => techId === 'currency');
  let selected: string | null = null;
  const row = buildEconomicPressureButtonGroup(diplo, A, B, undefined, (type) => { selected = type; });
  assert.equal(row.kind, 'buttonGroup');
  if (row.kind !== 'buttonGroup') return;
  assert.deepEqual(row.buttons.map((button) => button.disabled), [false, true, true]);
  assert.equal(Boolean(row.buttons[1].disabledReason), true);
  row.buttons[0].onClick();
  assert.equal(selected, 'tariffs');

  diplo.imposeEconomicPressure(A, B, 'tariffs');
  const activeRow = buildEconomicPressureButtonGroup(diplo, A, B, undefined, () => {});
  assert.equal(activeRow.kind, 'buttonGroup');
  if (activeRow.kind !== 'buttonGroup') return;
  assert.equal(activeRow.buttons[0].selected, true);
  assert.equal(activeRow.buttons[0].disabled, false); // active button remains liftable
});
