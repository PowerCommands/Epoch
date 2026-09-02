import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { HumanTradeDealWorkflow } from '../src/systems/HumanTradeDealWorkflow.ts';
import { TradeConnectionSystem } from '../src/systems/TradeConnectionSystem.ts';
import { TradeDealSystem } from '../src/systems/TradeDealSystem.ts';
import { DEFAULT_LONG_TRADE_DEAL_DURATION, DEFAULT_SHORT_TRADE_DEAL_DURATION } from '../src/types/tradeDeal.ts';
import { resolveTradingTabId, type RightSidebarRow } from '../src/ui/phaser/RightSidebarPanelTypes.ts';
import { RightSidebarPanelDataProvider } from '../src/ui/phaser/RightSidebarPanelDataProvider.ts';

globalThis.requestAnimationFrame ??= ((callback: FrameRequestCallback) => {
  callback(0);
  return 1;
});
globalThis.cancelAnimationFrame ??= (() => {});

const HUMAN = 'england';
const CHINA = 'china';

function createOverviewHarness(establishmentTurns: number, includeFrance = false) {
  const nations = [
    { id: HUMAN, name: 'England', color: 0x336699 },
    { id: CHINA, name: 'China', color: 0xcc3333 },
    { id: 'germany', name: 'Germany', color: 0x444444 },
    ...(includeFrance ? [{ id: 'france', name: 'France', color: 0x3355cc }] : []),
  ];
  const cities = [
    { id: 'london', ownerId: HUMAN, name: 'London', isResidenceCapital: true },
    { id: 'shanghai', ownerId: CHINA, name: 'Shanghai', isResidenceCapital: true },
    { id: 'berlin', ownerId: 'germany', name: 'Berlin', isResidenceCapital: true },
    ...(includeFrance ? [{ id: 'paris', ownerId: 'france', name: 'Paris', isResidenceCapital: true }] : []),
  ];
  const nationManager = {
    getNation: (id: string) => nations.find((nation) => nation.id === id),
    getAllNations: () => [...nations],
  };
  const cityManager = {
    getCity: (id: string) => cities.find((city) => city.id === id),
    getCitiesByOwner: (ownerId: string) => cities.filter((city) => city.ownerId === ownerId),
    getBuildings: () => ({ getAll: () => [] }),
  };
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const relations = new Set([pairKey(HUMAN, CHINA), ...(includeFrance ? [pairKey(HUMAN, 'france')] : [])]);
  const diplomacy = {
    getState: () => 'PEACE',
    hasTradeRelations: (a: string, b: string) => relations.has(pairKey(a, b)),
  };
  const queues = new Map<string, Array<{ item: any; turnsRemaining: number }>>();
  const production = {
    enqueue: (cityId: string, item: any) => {
      queues.set(cityId, [...(queues.get(cityId) ?? []), { item, turnsRemaining: item.establishmentTurns }]);
    },
    getQueue: (cityId: string) => queues.get(cityId) ?? [],
  };
  const connections = new TradeConnectionSystem(
    cityManager as never,
    diplomacy as never,
    nationManager as never,
    undefined,
    establishmentTurns,
  );
  const deals = new TradeDealSystem(
    diplomacy as never,
    () => 12,
    { getGold: () => 1_000, addGold: () => {} },
    (id) => nations.some((nation) => nation.id === id),
  );
  const quantities = new Map([
    [HUMAN, [{ resourceId: 'fish', quantity: 2 }]],
    [CHINA, [{ resourceId: 'iron', quantity: 3 }]],
  ]);
  const resourceAccess = {
    getExportableResourceQuantities: (nationId: string) => quantities.get(nationId) ?? [],
    getExportedResourceSourceCount: (nationId: string, resourceId: string) => deals.getAllDeals()
      .filter((deal) => deal.sellerNationId === nationId && deal.resourceId === resourceId).length,
  };
  deals.setCanExportResource((nationId, resourceId) => {
    const quantity = (quantities.get(nationId) ?? []).find((entry) => entry.resourceId === resourceId)?.quantity ?? 0;
    return resourceAccess.getExportedResourceSourceCount(nationId, resourceId) < quantity;
  });
  deals.setConnectionCapacityProvider((a, b) => connections.getActiveDealCapacityBetweenNations(a, b));
  deals.setHumanNationId(HUMAN);
  const workflow = new HumanTradeDealWorkflow(
    HUMAN,
    cityManager as never,
    connections,
    production as never,
    deals,
    () => 12,
  );
  const inert = undefined as never;
  const provider = new RightSidebarPanelDataProvider(
    production as never,
    cityManager as never,
    inert,
    nationManager as never,
    inert,
    HUMAN,
    inert,
    inert,
    inert,
  );
  provider.setDiplomacyManager(diplomacy as never);
  provider.setTradeDealSystem(deals);
  provider.setTradeConnectionSystem(connections);
  provider.setHumanTradeDealWorkflow(workflow);
  provider.setResourceAccessSystem(resourceAccess as never);
  return {
    provider,
    workflow,
    connections,
    deals,
    queues,
    quantities,
    setTradeRelations: (nationId: string, active: boolean) => {
      if (active) relations.add(pairKey(HUMAN, nationId));
      else relations.delete(pairKey(HUMAN, nationId));
    },
  };
}

function sellRows(provider: RightSidebarPanelDataProvider): RightSidebarRow[] {
  return provider.getTradingSellContent().sections.flatMap((section) => section.rows);
}

function buyRows(provider: RightSidebarPanelDataProvider): RightSidebarRow[] {
  return provider.getTradingBuyContent().sections.flatMap((section) => section.rows);
}

function button(rows: RightSidebarRow[], label: string) {
  const found = rows.find((row) => row.kind === 'button' && row.text.startsWith(label));
  assert.ok(found && found.kind === 'button', `${label} button should exist`);
  return found;
}

function contentText(content: ReturnType<RightSidebarPanelDataProvider['getTradingNationContent']>): string {
  return content.sections.flatMap((section) => section.rows)
    .filter((row): row is Extract<RightSidebarRow, { kind: 'text' }> => row.kind === 'text')
    .map((row) => row.text).join('\n');
}

test('Trading navigation is between Leaderboard and Diplomacy and exposes Buy/Sell tabs', () => {
  const source = readFileSync(new URL('../src/ui/phaser/RightSidebarPanel.ts', import.meta.url), 'utf8');
  assert.match(source, /mode: 'leaderboard'[\s\S]*mode: 'trading'[\s\S]*mode: 'diplomacy-graph'/);
  assert.match(source, /TRADING_TABS = \[\s*\{ id: 'buy', label: 'Buy'[\s\S]*\{ id: 'sell', label: 'Sell'/);
  assert.deepEqual([DEFAULT_SHORT_TRADE_DEAL_DURATION, DEFAULT_LONG_TRADE_DEAL_DURATION], [25, 50]);
});

test('nation tabs are alphabetical, relationship-driven, and safely fall back to the first tab', () => {
  const h = createOverviewHarness(5, true);
  assert.deepEqual(h.provider.getTradingNationTabs().map((tab) => tab.label), ['China', 'France']);
  assert.ok(!h.provider.getTradingNationTabs().some((tab) => tab.label === 'Germany'));

  h.setTradeRelations('germany', true);
  assert.deepEqual(h.provider.getTradingNationTabs().map((tab) => tab.label), ['China', 'France', 'Germany']);

  h.setTradeRelations(CHINA, false);
  const validIds = ['buy', 'sell', ...h.provider.getTradingNationTabs().map((tab) => tab.id)];
  assert.ok(!validIds.includes('nation:china'));
  assert.equal(resolveTradingTabId('nation:china', validIds), 'buy');
});

test('an empty nation relationship remains informative and shows authoritative city-global capacity', () => {
  const h = createOverviewHarness(5);
  const content = h.provider.getTradingNationContent(CHINA);
  const text = contentText(content);
  assert.match(text, /No active exports to China/);
  assert.match(text, /No active imports from China/);
  assert.match(text, /No pending trades/);
  assert.match(text, /No active or establishing trade routes/);
  assert.match(text, /Capacity is shared globally by each city/);
  assert.match(text, /London: 0 \/ 1 used/);
  assert.match(text, /Shanghai: 0 \/ 1 used/);
});

test('nation content groups active imports and exports and shows authoritative bilateral value', () => {
  const h = createOverviewHarness(5);
  const route = h.connections.createTradeConnectionDraft('london', 'shanghai', 1);
  h.connections.activateTradeConnection(route.id);
  assert.equal(h.deals.createDeal({ sellerNationId: HUMAN, buyerNationId: CHINA, resourceId: 'fish', turns: 25, goldPerTurn: 4 }).ok, true);
  assert.equal(h.deals.createDeal({ sellerNationId: CHINA, buyerNationId: HUMAN, resourceId: 'iron', turns: 50, goldPerTurn: 3 }).ok, true);

  const content = h.provider.getTradingNationContent(CHINA);
  const exports = content.sections.find((section) => section.title === 'Exports')!;
  const imports = content.sections.find((section) => section.title === 'Imports')!;
  const value = content.sections.find((section) => section.title === 'Bilateral Trade Value')!;
  assert.match(exports.rows.map((row) => row.kind === 'text' ? row.text : '').join('\n'), /Fish ×1[\s\S]*25 turns remaining · \+4 gold\/turn/);
  assert.match(imports.rows.map((row) => row.kind === 'text' ? row.text : '').join('\n'), /Iron ×1[\s\S]*50 turns remaining · -3 gold\/turn/);
  assert.match(value.rows.map((row) => row.kind === 'text' ? row.text : '').join('\n'), /Exports: \+4[\s\S]*Imports: -3[\s\S]*Net: \+1/);
  assert.ok(!content.sections.flatMap((section) => section.rows).some((row) => row.kind === 'button'));
});

test('nation content moves an export from Pending to Exports when its route activates', () => {
  const h = createOverviewHarness(5);
  button(sellRows(h.provider), 'Sell').onClick();

  let content = h.provider.getTradingNationContent(CHINA);
  let pendingText = content.sections.find((section) => section.title === 'Pending')!.rows
    .map((row) => row.kind === 'text' ? row.text : '').join('\n');
  let routeText = content.sections.find((section) => section.title === 'Trade Routes')!.rows
    .map((row) => row.kind === 'text' ? row.text : '').join('\n');
  assert.match(pendingText, /Fish ×1 → Shanghai[\s\S]*5 turns remaining · deal not active/);
  assert.match(pendingText, /resource is not reserved while pending/);
  assert.match(routeText, /London ↔ Shanghai[\s\S]*Establishing — 5 turns remaining/);

  h.connections.activateTradeConnection(h.connections.getAllConnections()[0]!.id);
  content = h.provider.getTradingNationContent(CHINA);
  pendingText = content.sections.find((section) => section.title === 'Pending')!.rows
    .map((row) => row.kind === 'text' ? row.text : '').join('\n');
  const exportText = content.sections.find((section) => section.title === 'Exports')!.rows
    .map((row) => row.kind === 'text' ? row.text : '').join('\n');
  routeText = content.sections.find((section) => section.title === 'Trade Routes')!.rows
    .map((row) => row.kind === 'text' ? row.text : '').join('\n');
  assert.match(pendingText, /No pending trades/);
  assert.match(exportText, /Fish ×1[\s\S]*25 turns remaining/);
  assert.match(routeText, /Active/);
});

test('Overview starts a 25-turn pending export to the selected Nation — City', () => {
  const h = createOverviewHarness(5);
  const before = sellRows(h.provider);
  const destination = before.find((row) => row.kind === 'select' && row.label === 'Sell to');
  assert.ok(destination && destination.kind === 'select');
  assert.deepEqual(destination.options.map((option) => option.label), ['China — Shanghai']);
  assert.deepEqual(
    before.filter((row) => row.kind === 'select' && row.label === 'Duration')[0]?.options.map((option) => option.label),
    ['25 turns', '50 turns'],
  );

  button(before, 'Sell').onClick();

  assert.equal(h.workflow.getPendingDeals()[0]?.turns, 25);
  assert.equal(h.workflow.getPendingDeals()[0]?.buyerCityId, 'shanghai');
  assert.equal(h.deals.getAllDeals().length, 0);
  assert.equal(h.queues.get('london')?.[0]?.turnsRemaining, 5);
  const statusText = sellRows(h.provider)
    .filter((row): row is Extract<RightSidebarRow, { kind: 'text' }> => row.kind === 'text')
    .map((row) => row.text).join('\n');
  assert.match(statusText, /Fish → China — Shanghai/);
  assert.match(statusText, /Establishing trade route — 5 turns remaining/);
});

test('Overview reuses an existing route and starts the export immediately', () => {
  const h = createOverviewHarness(5);
  const route = h.connections.createTradeConnectionDraft('london', 'shanghai', 1);
  h.connections.activateTradeConnection(route.id);

  button(sellRows(h.provider), 'Sell').onClick();

  assert.equal(h.connections.getAllConnections().length, 1);
  assert.equal(h.workflow.getPendingDeals().length, 0);
  assert.equal(h.deals.getAllDeals()[0]?.remainingTurns, 25);
});

test('Overview immediately shows an active export in a zero-turn scenario', () => {
  const h = createOverviewHarness(0);
  button(sellRows(h.provider), 'Sell').onClick();

  assert.equal(h.workflow.getPendingDeals().length, 0);
  assert.equal(h.connections.getAllConnections()[0]?.status, 'active');
  assert.equal(h.deals.getAllDeals()[0]?.remainingTurns, 25);
  const statusText = sellRows(h.provider)
    .filter((row): row is Extract<RightSidebarRow, { kind: 'text' }> => row.kind === 'text')
    .map((row) => row.text).join('\n');
  assert.match(statusText, /Active — 25 turns remaining/);
});

test('route completion replaces pending status with the full active duration', () => {
  const h = createOverviewHarness(5);
  button(sellRows(h.provider), 'Sell').onClick();
  const route = h.connections.getAllConnections()[0]!;

  h.connections.activateTradeConnection(route.id);

  assert.equal(h.workflow.getPendingDeals().length, 0);
  assert.equal(h.deals.getAllDeals()[0]?.remainingTurns, 25);
  const statusText = sellRows(h.provider)
    .filter((row): row is Extract<RightSidebarRow, { kind: 'text' }> => row.kind === 'text')
    .map((row) => row.text).join('\n');
  assert.doesNotMatch(statusText, /Establishing trade route — 5 turns remaining/);
  assert.match(statusText, /Active — 25 turns remaining/);
});

test('resource loss removes a failed pending deal while the completed route remains visible', () => {
  const h = createOverviewHarness(5);
  button(sellRows(h.provider), 'Sell').onClick();
  h.quantities.set(HUMAN, []);
  const route = h.connections.getAllConnections()[0]!;

  h.connections.activateTradeConnection(route.id);

  assert.equal(h.workflow.getPendingDeals().length, 0);
  assert.equal(h.deals.getAllDeals().length, 0);
  assert.equal(h.connections.getAllConnections()[0]?.status, 'active');
  const statusText = sellRows(h.provider)
    .filter((row): row is Extract<RightSidebarRow, { kind: 'text' }> => row.kind === 'text')
    .map((row) => row.text).join('\n');
  assert.match(statusText, /Seller does not currently have access to that resource/);
});

test('restored pending and active deals are represented by the same Overview status builder', () => {
  const before = createOverviewHarness(5);
  button(sellRows(before.provider), 'Sell').onClick();
  const pendingJson = JSON.parse(JSON.stringify(before.workflow.getPendingDeals()));
  const routeJson = JSON.parse(JSON.stringify(before.connections.getAllConnections()));
  const queueJson = JSON.parse(JSON.stringify(before.queues.get('london')));

  const pendingAfter = createOverviewHarness(5);
  pendingAfter.connections.restoreConnections(routeJson);
  pendingAfter.queues.set('london', queueJson);
  pendingAfter.workflow.restorePendingDeals(pendingJson);
  assert.deepEqual(pendingAfter.provider.getTradingNationTabs().map((tab) => tab.label), ['China']);
  let statusText = sellRows(pendingAfter.provider)
    .filter((row): row is Extract<RightSidebarRow, { kind: 'text' }> => row.kind === 'text')
    .map((row) => row.text).join('\n');
  assert.match(statusText, /Establishing trade route — 5 turns remaining/);
  assert.match(contentText(pendingAfter.provider.getTradingNationContent(CHINA)), /Establishing trade route · 5 turns remaining/);

  pendingAfter.connections.activateTradeConnection(routeJson[0].id);
  const activeJson = JSON.parse(JSON.stringify(pendingAfter.deals.getAllDeals()));
  const activeAfter = createOverviewHarness(5);
  activeAfter.connections.restoreConnections(pendingAfter.connections.getAllConnections());
  activeAfter.deals.restoreDeals(activeJson);
  statusText = sellRows(activeAfter.provider)
    .filter((row): row is Extract<RightSidebarRow, { kind: 'text' }> => row.kind === 'text')
    .map((row) => row.text).join('\n');
  assert.match(statusText, /Active — 25 turns remaining/);
  assert.match(contentText(activeAfter.provider.getTradingNationContent(CHINA)), /Fish ×1[\s\S]*25 turns remaining/);
});

test('a city known to lack route capacity is omitted as an export destination', () => {
  const h = createOverviewHarness(5, true);
  const committed = h.connections.createTradeConnectionDraft('london', 'paris', 1);
  h.connections.activateTradeConnection(committed.id);

  const destination = sellRows(h.provider).find((row) => row.kind === 'select' && row.label === 'Sell to');
  assert.ok(destination && destination.kind === 'select');
  assert.deepEqual(destination.options.map((option) => option.label), ['France — Paris']);
  assert.ok(!destination.options.some((option) => option.label === 'China — Shanghai'));
});

test('Overview buy uses the existing import path and the selected 50-turn duration', () => {
  const h = createOverviewHarness(5);
  const route = h.connections.createTradeConnectionDraft('london', 'shanghai', 1);
  h.connections.activateTradeConnection(route.id);
  const rows = buyRows(h.provider);
  const durationSelects = rows.filter((row) => row.kind === 'select' && row.label === 'Duration');
  const importDuration = durationSelects[0];
  assert.ok(importDuration && importDuration.kind === 'select');
  importDuration.onChange('50');
  button(buyRows(h.provider), 'Buy').onClick();

  const deal = h.deals.getAllDeals().find((candidate) => candidate.buyerNationId === HUMAN);
  assert.equal(deal?.remainingTurns, 50);
  assert.equal(deal?.sellerNationId, CHINA);
});
