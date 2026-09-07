import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorldOverviewContent, type WorldOverviewSources } from '../src/ui/phaser/WorldOverviewContent';
import { GamesOfNationsSystem } from '../src/systems/GamesOfNationsSystem';
import type { WorldCouncilState } from '../src/types/worldCouncil';

function sources(overrides: Partial<WorldOverviewSources> = {}): WorldOverviewSources {
  return {
    wonders: { getCompletedWonders: () => [{ wonderId: 'pyramids', cityId: 'city', ownerId: 'owner', completedTurn: 4, broken: true }] },
    corporations: null, games: null, council: null,
    city: id => ({ id, name: 'Visible City', ownerId: 'owner', tileX: 2, tileY: 3 }),
    nationName: id => `Nation ${id}`, knowsNation: () => true,
    knowsCity: () => true, seesTile: () => true, focusCity: () => {}, resolutionTitle: id => id,
    ...overrides,
  };
}

test('completed damaged wonders use current ownership and navigate to known cities', () => {
  let focused = '';
  const model = buildWorldOverviewContent('wonders', sources({ focusCity: id => { focused = id; } }));
  const rows = model.sections[0].rows;
  assert.match(JSON.stringify(rows), /Nation owner/);
  assert.match(JSON.stringify(rows), /Damaged/);
  const link = rows.find(row => row.kind === 'button');
  assert.ok(link?.kind === 'button');
  link.onClick();
  assert.equal(focused, 'city');
});

test('undiscovered wonders expose no owner, city, condition or navigation', () => {
  const model = buildWorldOverviewContent('wonders', sources({ knowsCity: () => false, seesTile: () => false }));
  assert.doesNotMatch(JSON.stringify(model), /Visible City|Nation owner|Damaged/);
  assert.equal(model.sections[0].rows.some(row => row.kind === 'button'), false);
});

test('known cities remain navigable outside vision without exposing live damage', () => {
  const model = buildWorldOverviewContent('wonders', sources({ seesTile: () => false }));
  assert.match(JSON.stringify(model), /Visible City/);
  assert.match(JSON.stringify(model), /condition unknown/);
  assert.doesNotMatch(JSON.stringify(model), /Damaged/);
});

test('older wonder state without broken flag is active; removed cities have no link', () => {
  const source = sources({ wonders: { getCompletedWonders: () => [{ wonderId: 'pyramids', cityId: 'city', ownerId: 'owner', completedTurn: 4 }] } });
  assert.match(JSON.stringify(buildWorldOverviewContent('wonders', source)), /Active/);
  assert.doesNotThrow(() => buildWorldOverviewContent('wonders', { ...source, city: () => undefined }));
  assert.equal(buildWorldOverviewContent('wonders', { ...source, city: () => undefined }).sections[0].rows.some(row => row.kind === 'button'), false);
});

test('corporations distinguish founder from headquarters owner and hide unknown founders', () => {
  const source = sources({ corporations: { getFoundedCorporations: () => [{ corporationId: 'silk_road_consortium', founderNationId: 'founder', cityId: 'city', foundedTurn: 5 }] } });
  const model = buildWorldOverviewContent('corporations', source);
  assert.match(JSON.stringify(model), /Founded by Nation founder/);
  assert.match(JSON.stringify(model), /Headquarters nation: Nation owner/);
  assert.match(JSON.stringify(model), /Manufactured resource/);
  assert.doesNotMatch(JSON.stringify(buildWorldOverviewContent('corporations', { ...source, knowsNation: () => false })), /Silk Road Consortium/);
});

test('international institutions show empty states and only current resolutions', () => {
  assert.match(JSON.stringify(buildWorldOverviewContent('international', sources())), /have not been founded/);
  const council: WorldCouncilState = {
    foundingCityId: 'city', foundingNationId: 'owner', foundingTurn: 1, constructionStartedTurn: 1,
    constructionTurnsRemaining: 0, status: 'active', memberNationIds: ['owner'], members: [],
    lastRegularMeetingTurn: 1, nextRegularMeetingTurn: 20, meetings: [], nextMeetingId: 1,
    enactedResolutions: [
      { id: '1', resolutionId: 'international_embargo', meetingId: 1, turn: 1 },
      { id: '2', resolutionId: 'international_embargo', meetingId: 1, turn: 1, expired: true },
    ],
  };
  const games = GamesOfNationsSystem.forNewGame({ getCurrentTurn: () => 1, getLivingNationIds: () => [], getNationName: () => undefined, getCapitalCity: () => undefined, log: () => {} });
  const model = buildWorldOverviewContent('international', sources({ games, council: { getState: () => council, getOrganizationName: () => 'United Nations' } }));
  assert.match(JSON.stringify(model), /Active resolutions: 1/);
  assert.match(JSON.stringify(model), /United Nations/);
  assert.match(JSON.stringify(model), /turn 20/);
});

test('current Games show hosts and suspension without copying rankings or private investments', () => {
  const games = GamesOfNationsSystem.forNewGame({ getCurrentTurn: () => 1, getLivingNationIds: () => [], getNationName: () => undefined, getCapitalCity: () => undefined, log: () => {} });
  const summary = { ...games.getSummary(), founded: true, hostNationId: 'owner', hostCityId: 'city', suspendedForWorldWar: true, turnsUntilGames: 5 };
  const model = buildWorldOverviewContent('international', sources({ games: { getSummary: () => summary } }));
  assert.match(JSON.stringify(model), /Suspended by World War/);
  assert.match(JSON.stringify(model), /Host city: Visible City/);
  assert.doesNotMatch(JSON.stringify(model), /Next Games in|medal|investment/i);
});

test('a stale city link rechecks knowledge before navigating', () => {
  let known = true;
  let focused = false;
  const model = buildWorldOverviewContent('wonders', sources({ knowsCity: () => known, focusCity: () => { focused = true; } }));
  known = false;
  const link = model.sections[0].rows.find(row => row.kind === 'button');
  assert.ok(link?.kind === 'button');
  link.onClick();
  assert.equal(focused, false);
});
