import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCapitulationNotification } from '../src/systems/CapitulationNotification.ts';
import type { CapitulationAppliedEvent } from '../src/systems/CapitulationSystem.ts';

const event: CapitulationAppliedEvent = {
  demandingNationId: 'Mexico', capitulatingNationId: 'United States',
  formerEnemyIds: ['Mexico', 'Canada', 'Argentina'], reparationsPaid: 0, reparationShares: [],
  removedUnitCount: 1, restoredCityIds: [], demilitarizedUntilTurn: 209,
  exploitationRightsGranted: false, exploitationHoldingsRemoved: 0,
};
const name = (id: string) => id;

test('a third-party player receives the cause and consequence of compulsory peace', () => {
  const notice = buildCapitulationNotification(event, 'Canada', name);
  assert.ok(notice);
  assert.match(notice.description, /United States has capitulated to Mexico and become its vassal/);
  assert.match(notice.description, /including its war with Canada/);
  assert.equal(notice.hideProgression, true);
});

test('uninvolved players and participants with existing dialogs get no duplicate notice', () => {
  for (const player of ['Brazil', 'Mexico', 'United States', undefined]) {
    assert.equal(buildCapitulationNotification(event, player, name), undefined);
  }
});
