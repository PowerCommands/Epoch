import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ECONOMIC_PRESSURE_DURATION_TURNS,
  ECONOMIC_PRESSURE_REMOVAL_PRICE,
} from '../src/data/economicPressure.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import { TradeDealSystem } from '../src/systems/TradeDealSystem.ts';
import { EconomicPressureActionService } from '../src/systems/diplomacy/HumanEconomicPressureService.ts';
import { EconomicPressureNegotiationService } from '../src/systems/diplomacy/EconomicPressureNegotiationService.ts';
import { buildEconomicPressureRemovalRow } from '../src/ui/phaser/RightSidebarPanelDataProvider.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';

const H = 'england';
const A = 'germany';
const B = 'france';

interface Harness {
  turn: number;
  diplomacy: DiplomacyManager;
  gold: Map<string, number>;
  negotiation: EconomicPressureNegotiationService;
}

function harness(humanGold = 2000, aiGold = 2000): Harness {
  const state = { turn: 1 };
  const turns = { getCurrentRound: () => state.turn } as unknown as TurnManager;
  const diplomacy = new DiplomacyManager(turns);
  diplomacy.setEconomicPressureTechnologyChecker(() => true);
  const gold = new Map<string, number>([[H, humanGold], [A, aiGold], [B, aiGold]]);
  const negotiation = new EconomicPressureNegotiationService(diplomacy, {
    getGold: (nationId) => gold.get(nationId) ?? 0,
    transferGold: (from, to, amount) => {
      const available = gold.get(from) ?? 0;
      if (available < amount) return false;
      gold.set(from, available - amount);
      gold.set(to, (gold.get(to) ?? 0) + amount);
      return true;
    },
  });
  return {
    get turn() { return state.turn; },
    set turn(value: number) { state.turn = value; },
    diplomacy,
    gold,
    negotiation,
  };
}

function mature(h: Harness): void {
  h.turn = 1 + ECONOMIC_PRESSURE_DURATION_TURNS;
}

test('Human-related sanctions remain active at 25 turns in both directions', () => {
  const h = harness();
  h.diplomacy.imposeEconomicPressure(H, A, 'embargo');
  h.diplomacy.imposeEconomicPressure(A, H, 'boycott');
  mature(h);
  assert.equal(h.diplomacy.getEconomicPressure(H, A), 'embargo');
  assert.equal(h.diplomacy.getEconomicPressure(A, H), 'boycott');
});

test('AI removal offer appears at exactly 25 turns and is exactly 1000 gold', () => {
  const h = harness();
  h.diplomacy.imposeEconomicPressure(H, A, 'embargo');
  h.turn = 25;
  assert.equal(h.negotiation.takeNextAutomaticOffer(H, h.turn), null);
  mature(h);
  const offer = h.negotiation.takeNextAutomaticOffer(H, h.turn);
  assert.equal(offer?.price, ECONOMIC_PRESSURE_REMOVAL_PRICE);
  assert.equal(offer?.type, 'embargo');
});

test('accepting AI offer transfers gold and lifts only Human → AI', () => {
  const h = harness();
  h.diplomacy.imposeEconomicPressure(H, A, 'embargo');
  h.diplomacy.imposeEconomicPressure(A, H, 'tariffs');
  mature(h);
  const offer = h.negotiation.takeNextAutomaticOffer(H, h.turn)!;
  assert.equal(h.negotiation.acceptAutomaticOffer(offer).ok, true);
  assert.equal(h.gold.get(A), 1000);
  assert.equal(h.gold.get(H), 3000);
  assert.equal(h.diplomacy.getEconomicPressure(H, A), null);
  assert.equal(h.diplomacy.getEconomicPressure(A, H), 'tariffs');
});

test('refusing leaves sanction active and the presented offer never repeats', () => {
  const h = harness();
  h.diplomacy.imposeEconomicPressure(H, A, 'boycott');
  mature(h);
  assert.ok(h.negotiation.takeNextAutomaticOffer(H, h.turn));
  // Refusal intentionally performs no transaction; the claimed marker is enough.
  h.turn += 100;
  assert.equal(h.negotiation.takeNextAutomaticOffer(H, h.turn), null);
  assert.equal(h.diplomacy.getEconomicPressure(H, A), 'boycott');
  assert.equal(h.gold.get(H), 2000);
});

test('save/load preserves the presented/refused offer marker', () => {
  const h = harness();
  h.diplomacy.imposeEconomicPressure(H, A, 'tariffs');
  mature(h);
  h.negotiation.takeNextAutomaticOffer(H, h.turn);
  const saved = SaveLoadService.serializeDiplomacy(h.diplomacy);

  const restored = harness();
  restored.turn = h.turn;
  SaveLoadService.restoreDiplomacy(saved, restored.diplomacy);
  assert.equal(restored.diplomacy.getEconomicPressureRecord(H, A)?.removalOfferPresented, true);
  assert.equal(restored.negotiation.takeNextAutomaticOffer(H, restored.turn), null);
});

test('older saves without offer markers load safely as not presented', () => {
  const h = harness();
  SaveLoadService.restoreDiplomacy([{
    nationA: A,
    nationB: H,
    state: 'PEACE',
    economicPressureFromAToB: 'embargo',
    economicPressureFromAToBTurn: 1,
  }], h.diplomacy);
  const source = A < H ? A : H;
  const target = source === A ? H : A;
  assert.equal(h.diplomacy.getEconomicPressureRecord(source, target)?.removalOfferPresented, false);
});

test('a removed and newly imposed sanction receives a fresh negotiation cycle', () => {
  const h = harness();
  h.diplomacy.imposeEconomicPressure(H, A, 'boycott');
  mature(h);
  assert.ok(h.negotiation.takeNextAutomaticOffer(H, h.turn));
  h.diplomacy.liftEconomicPressure(H, A);
  h.turn = 40;
  h.diplomacy.imposeEconomicPressure(H, A, 'boycott');
  assert.equal(h.diplomacy.getEconomicPressureRecord(H, A)?.removalOfferPresented, false);
  assert.equal(h.negotiation.takeNextAutomaticOffer(H, 64), null);
  assert.ok(h.negotiation.takeNextAutomaticOffer(H, 65));
});

for (const [from, to] of [['tariffs', 'boycott'], ['boycott', 'embargo']] as const) {
  test(`escalating ${from} → ${to} resets age and offer marker`, () => {
    const h = harness();
    h.diplomacy.imposeEconomicPressure(H, A, from);
    mature(h);
    assert.ok(h.negotiation.takeNextAutomaticOffer(H, h.turn));
    h.diplomacy.imposeEconomicPressure(H, A, to);
    const changed = h.diplomacy.getEconomicPressureRecord(H, A)!;
    assert.equal(changed.imposedTurn, h.turn);
    assert.equal(changed.removalOfferPresented, false);
    assert.equal(h.negotiation.takeNextAutomaticOffer(H, h.turn + 24), null);
    assert.ok(h.negotiation.takeNextAutomaticOffer(H, h.turn + 25));
  });
}

test('unaffordable AI makes no offer but is reconsidered after gaining gold', () => {
  const h = harness(2000, 999);
  h.diplomacy.imposeEconomicPressure(H, A, 'embargo');
  mature(h);
  assert.equal(h.negotiation.takeNextAutomaticOffer(H, h.turn), null);
  assert.equal(h.diplomacy.getEconomicPressureRecord(H, A)?.removalOfferPresented, false);
  h.gold.set(A, 1000);
  assert.ok(h.negotiation.takeNextAutomaticOffer(H, h.turn + 1));
});

test('Audience removal action appears at maturity, shows price, and disables for insufficient gold', () => {
  const h = harness(640);
  h.diplomacy.imposeEconomicPressure(A, H, 'embargo');
  assert.equal(buildEconomicPressureRemovalRow(h.diplomacy, H, A, 25, 640, 0, () => {}), null);
  const row = buildEconomicPressureRemovalRow(h.diplomacy, H, A, 26, 640, 0, () => {});
  assert.equal(row?.kind, 'button');
  if (row?.kind !== 'button') assert.fail('Expected removal button');
  assert.match(row.text, /1000 gold/);
  assert.equal(row.disabled, true);
  assert.match(row.disabledReason ?? '', /have 640, need 1000/);
});

test('Human payment is always accepted, transfers 1000, and lifts only AI → Human', () => {
  const h = harness();
  h.diplomacy.imposeEconomicPressure(A, H, 'embargo');
  h.diplomacy.imposeEconomicPressure(H, A, 'boycott');
  mature(h);
  const result = h.negotiation.payToLiftIncomingSanction(H, A, h.turn);
  assert.equal(result.ok, true);
  assert.equal(h.gold.get(H), 1000);
  assert.equal(h.gold.get(A), 3000);
  assert.equal(h.diplomacy.getEconomicPressure(A, H), null);
  assert.equal(h.diplomacy.getEconomicPressure(H, A), 'boycott');
});

test('Human cannot pay before maturity or with less than 1000 gold', () => {
  const h = harness(999);
  h.diplomacy.imposeEconomicPressure(A, H, 'tariffs');
  assert.equal(h.negotiation.payToLiftIncomingSanction(H, A, 25).ok, false);
  assert.equal(h.negotiation.payToLiftIncomingSanction(H, A, 26).ok, false);
  assert.equal(h.gold.get(H), 999);
  assert.equal(h.diplomacy.getEconomicPressure(A, H), 'tariffs');
});

test('reciprocal Tariffs are negotiated independently', () => {
  const h = harness();
  h.diplomacy.imposeEconomicPressureAction(H, A, 'tariffs');
  mature(h);
  const offer = h.negotiation.takeNextAutomaticOffer(H, h.turn)!;
  h.negotiation.acceptAutomaticOffer(offer);
  assert.equal(h.diplomacy.getEconomicPressure(H, A), null);
  assert.equal(h.diplomacy.getEconomicPressure(A, H), 'tariffs');
  h.negotiation.payToLiftIncomingSanction(H, A, h.turn);
  assert.equal(h.diplomacy.getEconomicPressure(A, H), null);
});

test('lifting Boycott and Embargo unblocks future exchange without recreating terminated agreements', () => {
  const h = harness();
  const trade = new TradeDealSystem(h.diplomacy, () => h.turn, {
    getGold: (id) => h.gold.get(id) ?? 0,
    addGold: (id, delta) => h.gold.set(id, (h.gold.get(id) ?? 0) + delta),
  });
  const actions = new EconomicPressureActionService(h.diplomacy, trade);

  actions.impose(A, H, 'boycott');
  assert.equal(h.diplomacy.isEconomicExchangeBlocked(A, H, 'strategic'), true);
  mature(h);
  h.negotiation.payToLiftIncomingSanction(H, A, h.turn);
  assert.equal(h.diplomacy.isEconomicExchangeBlocked(A, H, 'strategic'), false);

  h.turn = 40;
  h.diplomacy.restoreState(A, H, {
    ...h.diplomacy.getRelation(A, H),
    tradeRelations: true,
  });
  actions.impose(A, H, 'embargo');
  assert.equal(h.diplomacy.hasTradeRelations(A, H), false);
  h.turn = 65;
  h.negotiation.payToLiftIncomingSanction(H, A, h.turn);
  assert.equal(h.diplomacy.getEffectiveEconomicPressure(A, H), null);
  assert.equal(h.diplomacy.hasTradeRelations(A, H), false);
});
