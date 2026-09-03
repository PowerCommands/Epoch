import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getGameSpeedById } from '../src/data/gameSpeeds.ts';
import { ProductionSystem, type QueueEntry } from '../src/systems/ProductionSystem.ts';
import { TradeConnectionSystem } from '../src/systems/TradeConnectionSystem.ts';
import type { Producible } from '../src/types/producible.ts';
import {
  DEFAULT_TRADE_ROUTE_ESTABLISHMENT_TURNS,
  resolveTradeRouteEstablishmentTurns,
} from '../src/types/tradeConnection.ts';
import type { TradeConnection } from '../src/types/tradeConnection.ts';

const editor = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');
const aiSource = readFileSync(new URL('../src/systems/AISystem.ts', import.meta.url), 'utf8');
const saveLoadSource = readFileSync(new URL('../src/systems/SaveLoadService.ts', import.meta.url), 'utf8');
const gameSceneSource = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');

type TurnHandler = (event: { nation: { id: string } }) => void;

class FakeTurnManager {
  private readonly handlers: TurnHandler[] = [];

  on(type: string, handler: TurnHandler): void {
    if (type === 'turnStart') this.handlers.push(handler);
  }

  startNationTurn(nationId: string): void {
    for (const handler of this.handlers) handler({ nation: { id: nationId } });
  }
}

function createHarness(establishmentTurns: number) {
  const cities = [
    { id: 'human-city', ownerId: 'human', name: 'Human City' },
    { id: 'ai-city', ownerId: 'ai', name: 'AI City' },
  ];
  const cityManager = {
    getCity: (id: string) => cities.find((city) => city.id === id),
    getCitiesByOwner: (ownerId: string) => cities.filter((city) => city.ownerId === ownerId),
    getBuildings: () => ({ getAll: () => [] }),
  };
  const turnManager = new FakeTurnManager();
  const production = new ProductionSystem(
    cityManager as never,
    turnManager as never,
    {} as never,
    getGameSpeedById('standard'),
  );
  const connections = new TradeConnectionSystem(
    cityManager as never,
    {} as never,
    { getNation: (id: string) => ({ id, name: id }) } as never,
    undefined,
    establishmentTurns,
  );
  production.onCompleted((_cityId, item) => {
    if (item.kind === 'tradeRoute') connections.activateTradeConnection(item.connectionId);
  });
  // ProductionSystem deliberately ignores the synthetic initial turnStart.
  turnManager.startNationTurn('human');

  return { turnManager, production, connections };
}

function queueRoute(harness: ReturnType<typeof createHarness>): TradeConnection {
  const connection = harness.connections.createTradeConnectionDraft('human-city', 'ai-city', 1);
  if (connection.status === 'building') {
    const item: Producible = {
      kind: 'tradeRoute',
      connectionId: connection.id,
      fromCityId: connection.cityAId,
      toCityId: connection.cityBId,
      targetNationId: connection.nationBId,
      displayName: 'Test Trade Route',
      establishmentTurns: harness.connections.getEstablishmentTurns(),
    };
    harness.production.enqueue(connection.cityAId, item);
  }
  return connection;
}

for (const turns of [5, 1]) {
  test(`a trade route becomes active after exactly ${turns} establishment turn(s)`, () => {
    const harness = createHarness(turns);
    const connection = queueRoute(harness);
    assert.equal(harness.connections.getConnection(connection.id)?.status, 'building');

    for (let elapsed = 1; elapsed < turns; elapsed++) {
      harness.turnManager.startNationTurn('human');
      assert.equal(harness.connections.getConnection(connection.id)?.status, 'building');
      assert.equal(harness.production.getQueue('human-city')[0]?.turnsRemaining, turns - elapsed);
    }

    harness.turnManager.startNationTurn('human');
    assert.equal(harness.connections.getConnection(connection.id)?.status, 'active');
    assert.equal(harness.production.getQueue('human-city').length, 0);
  });
}

test('0 turns activates synchronously during route creation', () => {
  const harness = createHarness(0);
  let observedStatus: string | undefined;
  harness.connections.onConnectionActivated((route) => { observedStatus = route.status; });

  const connection = queueRoute(harness);

  assert.equal(connection.status, 'active');
  assert.equal(observedStatus, 'active');
  assert.equal(harness.connections.getConnection(connection.id)?.status, 'active');
  assert.equal(harness.production.getQueue('human-city').length, 0);
});

test('scenario fallback uses the default route-establishment duration', () => {
  assert.equal(DEFAULT_TRADE_ROUTE_ESTABLISHMENT_TURNS, 10);
  assert.equal(resolveTradeRouteEstablishmentTurns(undefined), 10);
  assert.equal(resolveTradeRouteEstablishmentTurns(-1), 10);
  assert.equal(resolveTradeRouteEstablishmentTurns(5), 5);
  assert.equal(resolveTradeRouteEstablishmentTurns(1), 1);
  assert.equal(resolveTradeRouteEstablishmentTurns(0), 0);
});

test('an in-progress configured route retains its duration and progress across a JSON save/load round-trip', () => {
  const before = createHarness(5);
  const connection = queueRoute(before);
  before.turnManager.startNationTurn('human');
  before.turnManager.startNationTurn('human');

  const savedEntry = JSON.parse(JSON.stringify(before.production.getProduction('human-city'))) as QueueEntry;
  const savedConnections = JSON.parse(JSON.stringify(before.connections.getAllConnections())) as TradeConnection[];
  assert.equal(savedEntry.item.kind === 'tradeRoute' && savedEntry.item.establishmentTurns, 5);
  assert.equal(savedEntry.accumulated, 2);

  const after = createHarness(5);
  after.connections.restoreConnections(savedConnections);
  after.production.restoreQueue('human-city', [savedEntry]);
  after.turnManager.startNationTurn('human');
  after.turnManager.startNationTurn('human');
  assert.equal(after.connections.getConnection(connection.id)?.status, 'building');
  after.turnManager.startNationTurn('human');
  assert.equal(after.connections.getConnection(connection.id)?.status, 'active');
});

test('Scenario Details loads, validates, explains, and serializes the setting', () => {
  assert.match(editor, /Trade Route Establishment Time \(turns\)/);
  assert.match(editor, /0 = trade routes are established immediately\./);
  assert.match(editor, /id="sd-trade-route-establishment-turns" type="number" min="0" step="1"/);
  assert.match(editor, /meta\.tradeRouteEstablishmentTurns = DEFAULT_TRADE_ROUTE_ESTABLISHMENT_TURNS/);
  assert.match(editor, /scenario\.meta\.tradeRouteEstablishmentTurns = tradeRouteEstablishmentTurns/);
});

test('Scenario Details exposes and validates the short/long trade deal durations', () => {
  assert.match(editor, /Short Trade Deal Duration \(turns\)/);
  assert.match(editor, /Long Trade Deal Duration \(turns\)/);
  assert.match(editor, /id="sd-short-trade-deal-duration" type="number" min="1" step="1"/);
  assert.match(editor, /id="sd-long-trade-deal-duration" type="number" min="1" step="1"/);
  // Positive-integer guards and strict long > short ordering.
  assert.match(editor, /Short Trade Deal Duration must be a positive integer/);
  assert.match(editor, /Long Trade Deal Duration must be a positive integer/);
  assert.match(editor, /Long Trade Deal Duration must be greater than Short Trade Deal Duration\./);
  assert.match(editor, /scenario\.meta\.shortTradeDealDuration = shortTradeDealDuration/);
  assert.match(editor, /scenario\.meta\.longTradeDealDuration = longTradeDealDuration/);
});

test('AI route creation consumes the same canonical duration and immediate-activation status', () => {
  assert.match(aiSource, /establishmentTurns: this\.tradeConnectionSystem\.getEstablishmentTurns\(\)/);
  assert.match(aiSource, /if \(connection\.status === 'building'\)[\s\S]*this\.productionSystem\.enqueue/);
});

test('AI trade offers use the scenario-configured deal duration, not a hardcoded value', () => {
  // The AI deal length is a configurable field, defaulted to the short duration
  // constant and used for every proposal/deal it creates (no literal 10 turns).
  assert.match(aiSource, /private tradeDealTurns = DEFAULT_SHORT_TRADE_DEAL_DURATION/);
  assert.match(aiSource, /setTradeDealTurns\(turns: number\)/);
  assert.match(aiSource, /const dealTurns = this\.tradeDealTurns/);
  assert.doesNotMatch(aiSource, /const dealTurns = 10/);
  // GameScene feeds the scenario-configured short duration into the AI.
  assert.match(gameSceneSource, /aiSystem\.setTradeDealTurns\(humanTradeDealDurations\.short\)/);
});

test('normal saves persist both the active scenario value and queued route duration', () => {
  assert.match(saveLoadSource, /tradeRouteEstablishmentTurns: tradeConnectionSystem\?\.getEstablishmentTurns\(\)/);
  assert.match(saveLoadSource, /establishmentTurns: item\.establishmentTurns/);
  assert.match(saveLoadSource, /item\.establishmentTurns \?\? tradeRouteEstablishmentTurns/);
});
