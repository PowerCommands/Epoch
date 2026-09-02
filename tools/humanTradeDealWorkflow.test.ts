import assert from 'node:assert/strict';
import test from 'node:test';

import { getGameSpeedById } from '../src/data/gameSpeeds.ts';
import { HumanTradeDealWorkflow } from '../src/systems/HumanTradeDealWorkflow.ts';
import { ProductionSystem, type QueueEntry } from '../src/systems/ProductionSystem.ts';
import { TradeConnectionSystem } from '../src/systems/TradeConnectionSystem.ts';
import { TradeDealSystem } from '../src/systems/TradeDealSystem.ts';
import type { PendingTradeDeal } from '../src/types/tradeDeal.ts';
import type { TradeConnection } from '../src/types/tradeConnection.ts';

type TurnHandler = (event: { nation: { id: string } }) => void;

class FakeTurnManager {
  private readonly handlers: TurnHandler[] = [];

  on(type: string, handler: TurnHandler): void {
    if (type === 'turnStart') this.handlers.push(handler);
  }

  start(nationId: string): void {
    for (const handler of this.handlers) handler({ nation: { id: nationId } });
  }
}

function createHarness(establishmentTurns: number) {
  const cities = [
    { id: 'london', ownerId: 'england', name: 'London', isResidenceCapital: true },
    { id: 'shanghai', ownerId: 'china', name: 'Shanghai', isResidenceCapital: true },
  ];
  const cityManager = {
    getCity: (id: string) => cities.find((city) => city.id === id),
    getCitiesByOwner: (ownerId: string) => cities.filter((city) => city.ownerId === ownerId),
    getBuildings: () => ({ getAll: () => [] }),
  };
  const diplomacy = {
    getState: () => 'PEACE',
    hasTradeRelations: () => true,
  };
  const turns = new FakeTurnManager();
  const production = new ProductionSystem(
    cityManager as never,
    turns as never,
    {} as never,
    getGameSpeedById('standard'),
  );
  const connections = new TradeConnectionSystem(
    cityManager as never,
    diplomacy as never,
    { getNation: (id: string) => ({ id, name: id }) } as never,
    undefined,
    establishmentTurns,
  );
  let resourceAvailable = true;
  const deals = new TradeDealSystem(
    diplomacy as never,
    () => 20,
    { getGold: () => 1_000, addGold: () => {} },
  );
  deals.setCanExportResource(() => resourceAvailable);
  deals.setConnectionCapacityProvider((a, b) => connections.getActiveDealCapacityBetweenNations(a, b));
  deals.setHumanNationId('england');
  const workflow = new HumanTradeDealWorkflow(
    'england',
    cityManager as never,
    connections,
    production,
    deals,
    () => 20,
  );
  production.onCompleted((_cityId, item) => {
    if (item.kind === 'tradeRoute') connections.activateTradeConnection(item.connectionId);
  });
  turns.start('england'); // consume ProductionSystem's synthetic initial turn

  const startExport = () => workflow.startExport({
    sellerNationId: 'england',
    buyerNationId: 'china',
    sellerCityId: 'london',
    buyerCityId: 'shanghai',
    resourceId: 'fish',
    turns: 10,
    goldPerTurn: 4,
  });

  return {
    turns,
    production,
    connections,
    deals,
    workflow,
    startExport,
    setResourceAvailable: (available: boolean) => { resourceAvailable = available; },
  };
}

test('an existing active route is reused and no duplicate route is created', () => {
  const h = createHarness(5);
  const route = h.connections.createTradeConnectionDraft('london', 'shanghai', 10);
  h.connections.activateTradeConnection(route.id);

  const result = h.startExport();

  assert.deepEqual(result.ok && result.status, 'active');
  assert.equal(h.connections.getAllConnections().length, 1);
  assert.equal(h.workflow.getPendingDeals().length, 0);
  assert.equal(h.deals.getAllDeals()[0]?.remainingTurns, 10);
});

test('a missing route creates a pending deal whose full duration begins on activation', () => {
  const h = createHarness(5);
  const result = h.startExport();
  assert.equal(result.ok && result.status, 'pending');
  assert.equal(h.connections.getAllConnections()[0]?.status, 'building');
  assert.equal(h.deals.getAllDeals().length, 0);

  for (let elapsed = 1; elapsed < 5; elapsed++) {
    h.turns.start('england');
    h.deals.advanceTurnForNation('china');
    assert.equal(h.deals.getAllDeals().length, 0);
    assert.equal(h.workflow.getPendingDeals().length, 1);
  }

  h.turns.start('england');
  assert.equal(h.connections.getAllConnections()[0]?.status, 'active');
  assert.equal(h.workflow.getPendingDeals().length, 0);
  assert.equal(h.deals.getAllDeals()[0]?.remainingTurns, 10);
  h.deals.advanceTurnForNation('china');
  assert.equal(h.deals.getAllDeals()[0]?.remainingTurns, 9);
});

test('resource loss while pending prevents the deal but keeps the established route', () => {
  const h = createHarness(1);
  assert.equal(h.startExport().ok, true);
  h.setResourceAvailable(false);

  h.turns.start('england');

  assert.equal(h.connections.getAllConnections()[0]?.status, 'active');
  assert.equal(h.workflow.getPendingDeals().length, 0);
  assert.equal(h.deals.getAllDeals().length, 0);
});

test('0-turn establishment creates the route and active deal synchronously', () => {
  const h = createHarness(0);

  const result = h.startExport();

  assert.equal(result.ok && result.status, 'active');
  assert.equal(h.connections.getAllConnections()[0]?.status, 'active');
  assert.equal(h.deals.getAllDeals()[0]?.remainingTurns, 10);
  assert.equal(h.workflow.getPendingDeals().length, 0);
  assert.equal(h.production.getQueue('london').length, 0);
});

test('automatic creation fails cleanly when endpoint capacity is already committed', () => {
  const h = createHarness(5);
  assert.equal(h.startExport().ok, true);

  const second = h.workflow.startExport({
    sellerNationId: 'england',
    buyerNationId: 'china',
    sellerCityId: 'london',
    buyerCityId: 'shanghai',
    resourceId: 'iron',
    turns: 10,
    goldPerTurn: 4,
  });

  assert.equal(second.ok, false);
  assert.match(second.ok ? '' : second.reason, /trade capacity/i);
  assert.equal(h.connections.getAllConnections().length, 1);
  assert.equal(h.workflow.getPendingDeals().length, 1);
});

test('pending deal, route, and remaining establishment progress survive a JSON round-trip', () => {
  const before = createHarness(5);
  before.startExport();
  before.turns.start('england');
  before.turns.start('england');

  const pending = JSON.parse(JSON.stringify(before.workflow.getPendingDeals())) as PendingTradeDeal[];
  const routes = JSON.parse(JSON.stringify(before.connections.getAllConnections())) as TradeConnection[];
  const queue = JSON.parse(JSON.stringify(before.production.getProduction('london'))) as QueueEntry;

  const after = createHarness(5);
  after.connections.restoreConnections(routes);
  after.production.restoreQueue('london', [queue]);
  after.workflow.restorePendingDeals(pending);

  after.turns.start('england');
  after.turns.start('england');
  assert.equal(after.deals.getAllDeals().length, 0);
  after.turns.start('england');
  assert.equal(after.deals.getAllDeals()[0]?.remainingTurns, 10);
  assert.equal(after.workflow.getPendingDeals().length, 0);
});
