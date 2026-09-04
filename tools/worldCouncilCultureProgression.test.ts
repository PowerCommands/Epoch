import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getWorldCouncilCultureProgressionCandidate } from '../src/systems/WorldCouncilCultureProgression.ts';
import { WorldCouncilSystem } from '../src/systems/WorldCouncilSystem.ts';

interface TestNation {
  readonly id: string;
  readonly isHuman: boolean;
  readonly unlockedCultureNodeIds: readonly string[];
}

const human: TestNation = { id: 'human', isHuman: true, unlockedCultureNodeIds: [] };
const ai: TestNation = { id: 'ai', isHuman: false, unlockedCultureNodeIds: [] };

function candidate(
  nations: readonly TestNation[],
  hasCouncil = false,
  organizationKind: 'worldCouncil' | 'un' = 'worldCouncil',
) {
  return getWorldCouncilCultureProgressionCandidate({
    nations,
    hasCouncil,
    organizationKind,
    getFoundingCityId: (nationId) => `${nationId}-capital`,
  });
}

test('The Enlightenment enables World Council founding for either a human or AI pioneer', () => {
  for (const pioneer of [human, ai]) {
    const enlightened = { ...pioneer, unlockedCultureNodeIds: ['enlightenment'] };
    assert.deepEqual(candidate([enlightened]), {
      nationId: pioneer.id,
      foundingCityId: `${pioneer.id}-capital`,
      organizationKind: 'worldCouncil',
    });
  }
});

test('restored culture state derives World Council eligibility without a discovery event', () => {
  const restoredNations = [
    human,
    { ...ai, unlockedCultureNodeIds: ['enlightenment'] },
  ];
  assert.equal(candidate(restoredNations)?.nationId, 'ai');
  assert.equal(candidate(restoredNations, true), undefined, 'an existing Council consumes the milestone');
});

test('Liberalism enables a United Nations transition only after a Council exists', () => {
  const liberal = { ...human, unlockedCultureNodeIds: ['enlightenment', 'liberalism'] };
  assert.equal(candidate([liberal])?.organizationKind, 'worldCouncil');
  assert.deepEqual(candidate([liberal], true), {
    nationId: 'human',
    foundingCityId: 'human-capital',
    organizationKind: 'un',
  });
});

test('restored United Nations state is terminal and repeated checks are idempotent', () => {
  const liberal = { ...ai, unlockedCultureNodeIds: ['enlightenment', 'liberalism'] };
  assert.equal(candidate([liberal], true, 'un'), undefined);
  assert.equal(candidate([liberal], true, 'un'), undefined);
});

test('a milestone nation without a surviving city is skipped safely', () => {
  const nations = [
    { ...human, unlockedCultureNodeIds: ['enlightenment'] },
    { ...ai, unlockedCultureNodeIds: ['enlightenment'] },
  ];
  const result = getWorldCouncilCultureProgressionCandidate({
    nations,
    hasCouncil: false,
    organizationKind: 'worldCouncil',
    getFoundingCityId: (nationId) => nationId === 'ai' ? 'ai-capital' : undefined,
  });
  assert.equal(result?.nationId, 'ai');
});

test('the existing founding workflow consumes each culture milestone exactly once', () => {
  const pioneer = {
    id: 'ai',
    name: 'AI',
    isHuman: false,
    aiGoals: [],
    unlockedCultureNodeIds: ['enlightenment', 'liberalism'],
  };
  const nationManager = {
    getNation: (nationId: string) => nationId === pioneer.id ? pioneer : undefined,
    getAllNations: () => [pioneer],
    getResources: () => ({ gold: 1_000, goldPerTurn: 10 }),
  };
  const cityManager = { getCity: (cityId: string) => cityId === 'ai-capital' ? { id: cityId } : undefined };
  const council = new WorldCouncilSystem(
    nationManager as never,
    cityManager as never,
    { addGold: () => {} } as never,
  );
  const getCandidate = () => candidate(
    [pioneer],
    council.hasCouncil(),
    council.getOrganizationKind(),
  );
  const offer = { gold: 0, sciencePercent: 10, culturePercent: 10 };

  const councilCandidate = getCandidate();
  assert.equal(councilCandidate?.organizationKind, 'worldCouncil');
  assert.equal(council.found({
    foundingCityId: councilCandidate!.foundingCityId,
    foundingNationId: councilCandidate!.nationId,
    foundingTurn: 10,
    founderOffer: offer,
    organizationKind: councilCandidate!.organizationKind,
  }), true);

  const unCandidate = getCandidate();
  assert.equal(unCandidate?.organizationKind, 'un');
  assert.equal(council.found({
    foundingCityId: unCandidate!.foundingCityId,
    foundingNationId: unCandidate!.nationId,
    foundingTurn: 20,
    founderOffer: offer,
    organizationKind: unCandidate!.organizationKind,
  }), true);
  assert.equal(council.getOrganizationKind(), 'un');
  assert.equal(getCandidate(), undefined);
  assert.equal(council.found({
    foundingCityId: 'ai-capital',
    foundingNationId: 'ai',
    foundingTurn: 21,
    founderOffer: offer,
    organizationKind: 'un',
  }), false);
});
