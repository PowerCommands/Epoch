/**
 * Focused tests for autorun/debug logging of Economic Pressure diplomacy
 * (Tariffs, Boycotts, Embargoes). Logging only — no gameplay assertions here.
 *
 * Run with: npx tsx --test tools/economicPressureLogging.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { TradeDealSystem } from '../src/systems/TradeDealSystem.ts';
import {
  EconomicPressureActionService,
  HumanEconomicPressureService,
} from '../src/systems/diplomacy/HumanEconomicPressureService.ts';
import { getNaturalResourceById } from '../src/data/naturalResources.ts';
import { getManufacturedResourceById } from '../src/data/manufacturedResources.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';

const A = 'england';
const B = 'germany';
const NAMES: Record<string, string> = { england: 'England', germany: 'Germany', france: 'France' };

function turnManagerStub(getTurn: () => number): TurnManager {
  return { getCurrentRound: getTurn } as unknown as TurnManager;
}

function makeDiplomacy(turn = 1): DiplomacyManager {
  const diplo = new DiplomacyManager(turnManagerStub(() => turn));
  diplo.setEconomicPressureTechnologyChecker(() => true);
  diplo.setNationNameResolver((id) => NAMES[id] ?? id);
  return diplo;
}

function categoryOf(resourceId: string): string {
  return getNaturalResourceById(resourceId)?.category
    ?? (getManufacturedResourceById(resourceId) ? 'manufactured' : 'unknown');
}

function makeTradeSystem(diplo: DiplomacyManager): TradeDealSystem {
  diplo.establishEmbassy(A, B);
  diplo.establishEmbassy(B, A);
  diplo.establishTradeRelations(A, B);
  const gold = new Map<string, number>([[A, 1000], [B, 1000], ['france', 1000]]);
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

/** Capture `[DIPLOMACY]` lines emitted by console.log during `fn`. */
function captureDiplomacyLogs(fn: () => void): string[] {
  const original = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines.filter((line) => line.startsWith('[DIPLOMACY]'));
}

test('imposing a tariff logs one canonical entry, retaliation logs its own', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  const service = new EconomicPressureActionService(diplo, trade);

  const logs = captureDiplomacyLogs(() => service.impose(A, B, 'tariffs', 'Germany'));

  assert.equal(logs.filter((l) => l === '[DIPLOMACY][England -> Germany] Tariff imposed').length, 1);
  assert.equal(logs.filter((l) => l === '[DIPLOMACY][Germany -> England] Retaliatory tariff imposed').length, 1);
  // Exactly the two state transitions — no duplicates.
  assert.equal(logs.length, 2);
});

test('lifting a tariff logs one entry', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  const service = new HumanEconomicPressureService(diplo, trade);
  service.apply(A, B, 'tariffs', 'Germany');

  const logs = captureDiplomacyLogs(() => service.apply(A, B, 'tariffs', 'Germany'));
  assert.deepEqual(logs, ['[DIPLOMACY][England -> Germany] Tariff lifted']);
});

test('initiating a boycott logs one entry with the cancelled-import count', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  // A imports from B (two deals) → boycott by A cancels both.
  trade.createDeal({ sellerNationId: B, buyerNationId: A, resourceId: 'iron', goldPerTurn: 10, turns: 5 });
  trade.createDeal({ sellerNationId: B, buyerNationId: A, resourceId: 'wine', goldPerTurn: 10, turns: 5 });
  const service = new EconomicPressureActionService(diplo, trade);

  const logs = captureDiplomacyLogs(() => service.impose(A, B, 'boycott', 'Germany'));
  assert.deepEqual(logs, ['[DIPLOMACY][England -> Germany] Boycott initiated, cancelled 2 import agreements']);
});

test('lifting a boycott logs one entry', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  const service = new HumanEconomicPressureService(diplo, trade);
  service.apply(A, B, 'boycott', 'Germany');

  const logs = captureDiplomacyLogs(() => service.apply(A, B, 'boycott', 'Germany'));
  assert.deepEqual(logs, ['[DIPLOMACY][England -> Germany] Boycott lifted']);
});

test('imposing an embargo logs one entry with the terminated-agreement count', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  trade.createDeal({ sellerNationId: B, buyerNationId: A, resourceId: 'iron', goldPerTurn: 10, turns: 5 });
  trade.createDeal({ sellerNationId: A, buyerNationId: B, resourceId: 'wine', goldPerTurn: 10, turns: 5 });
  const service = new EconomicPressureActionService(diplo, trade);

  const logs = captureDiplomacyLogs(() => service.impose(A, B, 'embargo', 'Germany'));
  assert.deepEqual(logs, ['[DIPLOMACY][England -> Germany] Embargo imposed, 2 active agreements terminated']);
});

test('lifting an embargo logs one entry', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  const service = new HumanEconomicPressureService(diplo, trade);
  service.apply(A, B, 'embargo', 'Germany');

  const logs = captureDiplomacyLogs(() => service.apply(A, B, 'embargo', 'Germany'));
  assert.deepEqual(logs, ['[DIPLOMACY][England -> Germany] Embargo lifted']);
});

test('human-triggered actions are logged through the Audience service', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  const service = new HumanEconomicPressureService(diplo, trade);

  const logs = captureDiplomacyLogs(() => service.apply(A, B, 'boycott', 'Germany'));
  assert.deepEqual(logs, ['[DIPLOMACY][England -> Germany] Boycott initiated, cancelled 0 import agreements']);
});

test('AI-triggered actions are logged through the shared applier', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  const service = new EconomicPressureActionService(diplo, trade);

  // The AI economic-pressure applier is wired to service.impose(...).
  const logs = captureDiplomacyLogs(() => service.impose('france', B, 'embargo', 'Germany'));
  assert.deepEqual(logs, ['[DIPLOMACY][France -> Germany] Embargo imposed, 0 active agreements terminated']);
});

test('invalid/failed actions produce no false "imposed" log', () => {
  const diplo = makeDiplomacy();
  diplo.setEconomicPressureTechnologyChecker(() => false); // prerequisite missing
  const trade = makeTradeSystem(diplo);
  const service = new EconomicPressureActionService(diplo, trade);

  const logs = captureDiplomacyLogs(() => {
    const result = service.impose(A, B, 'boycott', 'Germany');
    assert.equal(result.ok, false);
  });
  assert.deepEqual(logs, []);
});

test('a no-op re-impose of the same measure produces no duplicate log', () => {
  const diplo = makeDiplomacy();
  const trade = makeTradeSystem(diplo);
  const service = new EconomicPressureActionService(diplo, trade);
  service.impose(A, B, 'boycott', 'Germany');

  const logs = captureDiplomacyLogs(() => {
    const result = service.impose(A, B, 'boycott', 'Germany'); // already boycotting → no change
    assert.equal(result.ok, false);
  });
  assert.deepEqual(logs, []);
});
