import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getActiveLeaderSelections,
  getAlternativeLeadersByNationId,
  getLeaderByNationId,
  getLeaderById,
  setActiveLeaderForNation,
  setActiveLeaderSelections,
  setScenarioLeaderOverrides,
} from '../src/data/leaders.ts';
import { CapitulationSystem } from '../src/systems/CapitulationSystem.ts';
import { PeaceTreatySystem } from '../src/systems/PeaceTreatySystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import { SAVED_GAME_VERSION } from '../src/types/saveGame.ts';
import { NEWSPAPER_EVENT_DEFINITIONS } from '../src/data/newspaperContent.ts';
import { getUnitTypeById } from '../src/data/units.ts';
import type { CityManager } from '../src/systems/CityManager.ts';
import type { NationManager } from '../src/systems/NationManager.ts';
import type { ResourceSystem } from '../src/systems/ResourceSystem.ts';
import type { UnitManager } from '../src/systems/UnitManager.ts';
import type { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import type { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem.ts';
import type { AIMilitaryThreatEvaluationSystem } from '../src/systems/ai/AIMilitaryThreatEvaluationSystem.ts';
import type { MapData } from '../src/types/map.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import type { NewspaperArticleContext } from '../src/types/newspaper.ts';
import type { HistoricalEvent } from '../src/types/historicalTimeline.ts';

// Germany's roster is exactly the feature's worked example: Hermann (default),
// Adolf Hitler, and Angela Merkel.
const GERMANY = 'nation_germany';

function resetLeaders(): void {
  setActiveLeaderSelections(undefined);
  setScenarioLeaderOverrides([]);
}

// --- Candidate resolution ---------------------------------------------------

test('overthrow candidates exclude the current leader and offer the rest', () => {
  try {
    setActiveLeaderSelections({ [GERMANY]: 'leader_adolf_hitler' });
    assert.deepEqual(
      getAlternativeLeadersByNationId(GERMANY).map((leader) => leader.id).sort(),
      ['hermann-the-cheruscan', 'leader_angela_merkel'],
    );

    setActiveLeaderSelections({ [GERMANY]: 'leader_angela_merkel' });
    assert.deepEqual(
      getAlternativeLeadersByNationId(GERMANY).map((leader) => leader.id).sort(),
      ['hermann-the-cheruscan', 'leader_adolf_hitler'],
    );
  } finally {
    resetLeaders();
  }
});

test('the current leader is never offered as its own replacement', () => {
  try {
    setActiveLeaderSelections({ [GERMANY]: 'leader_adolf_hitler' });
    const candidates = getAlternativeLeadersByNationId(GERMANY);
    assert.equal(candidates.some((leader) => leader.id === 'leader_adolf_hitler'), false);
  } finally {
    resetLeaders();
  }
});

test('a nation with no roster has no alternatives', () => {
  assert.deepEqual(getAlternativeLeadersByNationId('nation_does_not_exist'), []);
});

test('scenario replacement identity drives eligibility, not the runtime nation id', () => {
  try {
    // A scenario nation that borrows Germany's identity must offer Germany's
    // leaders, never require leader.nationId to equal the runtime nation id.
    setScenarioLeaderOverrides([{ id: 'nation_scenario_x', replacementNationId: GERMANY }]);
    setActiveLeaderForNation('nation_scenario_x', 'leader_adolf_hitler');
    assert.equal(getLeaderByNationId('nation_scenario_x')?.id, 'leader_adolf_hitler');
    assert.deepEqual(
      getAlternativeLeadersByNationId('nation_scenario_x').map((leader) => leader.id).sort(),
      ['hermann-the-cheruscan', 'leader_angela_merkel'],
    );
  } finally {
    resetLeaders();
  }
});

// --- Canonical leader change ------------------------------------------------

test('setActiveLeaderForNation validates the leader belongs to the nation identity', () => {
  try {
    assert.equal(setActiveLeaderForNation(GERMANY, 'leader_henry_v'), false);
    assert.equal(setActiveLeaderForNation(GERMANY, 'not_a_leader'), false);
    assert.equal(getLeaderByNationId(GERMANY)?.id, 'hermann-the-cheruscan');

    assert.equal(setActiveLeaderForNation(GERMANY, 'leader_angela_merkel'), true);
    assert.equal(getLeaderByNationId(GERMANY)?.id, 'leader_angela_merkel');
    assert.equal(getActiveLeaderSelections()[GERMANY], 'leader_angela_merkel');
  } finally {
    resetLeaders();
  }
});

// --- Capitulation harness ---------------------------------------------------

interface CityStub { id: string; ownerId: string; originNationId: string; }
interface UnitStub { id: string; unitTypeId: string; ownerId: string; }

function harness(config: {
  target: string;
  demander: string;
  cities?: CityStub[];
  units?: UnitStub[];
  gold?: Record<string, number>;
}) {
  const cities = new Map((config.cities ?? []).map((c) => [c.id, c]));
  const units = new Map<string, UnitStub[]>();
  for (const u of config.units ?? []) {
    if (!units.has(u.ownerId)) units.set(u.ownerId, []);
    units.get(u.ownerId)!.push(u);
  }
  const gold = new Map(Object.entries(config.gold ?? {}));
  const vassalHosts = new Map<string, string>();
  const amicableResets: string[] = [];
  const active = new Set([config.target, config.demander]);
  const warring: Record<string, string[]> = {
    [config.target]: [config.demander],
    [config.demander]: [config.target],
  };

  const cityManager = {
    getCitiesByOwner: (owner: string) => [...cities.values()].filter((c) => c.ownerId === owner),
    getCity: (id: string) => cities.get(id),
    getResources: () => ({ productionPerTurn: 0 }),
    transferOwnership: (id: string, to: string) => { const c = cities.get(id); if (c) c.ownerId = to; },
  } as unknown as CityManager;
  const nationManager = {
    getNation: (id: string) => (active.has(id) ? { id } : undefined),
    getResources: (id: string) => ({ gold: gold.get(id) ?? 0 }),
  } as unknown as NationManager;
  const resourceSystem = {
    addGold: (id: string, amount: number) => gold.set(id, (gold.get(id) ?? 0) + amount),
  } as unknown as ResourceSystem;
  const unitManager = {
    getUnitsByOwner: (owner: string) => [...(units.get(owner) ?? [])].map((u) => ({ id: u.id, unitType: getUnitTypeById(u.unitTypeId) })),
    removeUnit: (id: string) => {
      for (const list of units.values()) {
        const i = list.findIndex((u) => u.id === id);
        if (i >= 0) { list.splice(i, 1); return; }
      }
    },
  } as unknown as UnitManager;
  const diplomacyManager = {
    getState: (a: string, b: string) => (warring[a]?.includes(b) ? 'WAR' : 'PEACE'),
    getWarringNationIds: (n: string) => warring[n] ?? [],
    getWarDuration: () => 20,
    getWarExhaustion: () => ({ unitsLost: 12, citiesLost: 5, startStrength: 600 }),
    getRelation: () => ({ fear: 90, hostility: 0 }),
    respondToPeace: () => {},
    canEstablishVassal: () => true,
    establishVassal: (vassalId: string, hostId: string) => { vassalHosts.set(vassalId, hostId); return true; },
    terminateVassalage: (hostId: string, vassalId: string) => {
      if (vassalHosts.get(vassalId) !== hostId) return false;
      vassalHosts.delete(vassalId);
      return true;
    },
    applyAmicableRelationshipReset: (a: string, b: string) => {
      amicableResets.push([a, b].sort().join('|'));
      return { previousAffinity: 10, affinity: 50 };
    },
    getNationDisplayName: (id: string) => id,
  } as unknown as DiplomacyManager;
  const mil = {
    getMilitaryStrength: (id: string) => ({ totalStrength: id === config.target ? 20 : 2000, unitStrength: 0, cityStrength: 0 }),
  } as unknown as AIMilitaryEvaluationSystem;
  const threatEval = {
    getThreatLevel: () => 'high',
  } as unknown as AIMilitaryThreatEvaluationSystem;
  const mapData = { tiles: [] } as unknown as MapData;
  const gridSystem = { getTilesInRange: () => [] } as unknown as IGridSystem;
  const productionSystem = {
    removeMilitaryUnitsFromQueues: () => {},
  } as unknown as ProductionSystem;

  const peaceTreatySystem = new PeaceTreatySystem(
    cityManager, nationManager, resourceSystem, diplomacyManager,
    mapData, gridSystem, productionSystem, mil, threatEval,
  );
  const logs: string[] = [];
  const system = new CapitulationSystem({
    diplomacyManager, cityManager, nationManager, unitManager, resourceSystem, productionSystem,
    peaceTreatySystem, militaryEvaluationSystem: mil,
    getCurrentTurn: () => 100,
    getDemilitarizationTurns: () => 10,
    log: (m) => logs.push(m),
  });
  return { system, vassalHosts, logs, diplomacyManager, amicableResets };
}

// --- Overthrow capitulation outcome -----------------------------------------

test('Overthrow Leadership replaces the leader without creating a vassal', () => {
  try {
    setActiveLeaderSelections({ [GERMANY]: 'leader_adolf_hitler' });
    const h = harness({ target: GERMANY, demander: 'atk', cities: [{ id: 'c1', ownerId: GERMANY, originNationId: GERMANY }] });

    const result = h.system.applyCapitulation(
      'atk', GERMANY, 0, false, false, { overthrowLeaderId: 'leader_angela_merkel' },
    );

    assert.equal(result.accepted, true);
    assert.ok(result.leadershipOverthrow);
    assert.equal(result.leadershipOverthrow?.previousLeaderName, 'Adolf Hitler');
    assert.equal(result.leadershipOverthrow?.newLeaderName, 'Angela Merkel');
    // The nation identity is unchanged and the new leader is live.
    assert.equal(getLeaderByNationId(GERMANY)?.id, 'leader_angela_merkel');
    assert.equal(getLeaderByNationId(GERMANY)?.nationId, GERMANY);
    // Leader-derived behavior now resolves from Merkel (globalism), not Hitler.
    assert.equal(getLeaderByNationId(GERMANY)?.ideologyId, 'globalism');
    // No vassalage was created.
    assert.equal(h.vassalHosts.has(GERMANY), false);
    assert.ok(h.logs.some((line) => line.includes('leadership overthrown')));
    // The new regime gets an amicable reset toward the victor that installed it.
    assert.deepEqual(h.amicableResets, [['atk', GERMANY].sort().join('|')]);
  } finally {
    resetLeaders();
  }
});

test('an invalid replacement leader is rejected with no side effects', () => {
  try {
    setActiveLeaderSelections({ [GERMANY]: 'leader_adolf_hitler' });
    const h = harness({ target: GERMANY, demander: 'atk', cities: [{ id: 'c1', ownerId: GERMANY, originNationId: GERMANY }] });

    const result = h.system.applyCapitulation(
      'atk', GERMANY, 0, false, false, { overthrowLeaderId: 'leader_henry_v' },
    );

    assert.equal(result.accepted, false);
    assert.equal(getLeaderByNationId(GERMANY)?.id, 'leader_adolf_hitler');
    assert.equal(h.vassalHosts.has(GERMANY), false);
    // A rejected overthrow must not reset any relations.
    assert.deepEqual(h.amicableResets, []);
  } finally {
    resetLeaders();
  }
});

test('the default capitulation outcome still creates a vassal', () => {
  try {
    setActiveLeaderSelections({ [GERMANY]: 'leader_adolf_hitler' });
    const h = harness({ target: GERMANY, demander: 'atk', cities: [{ id: 'c1', ownerId: GERMANY, originNationId: GERMANY }] });

    const result = h.system.applyCapitulation('atk', GERMANY, 0);

    assert.equal(result.accepted, true);
    assert.equal(result.leadershipOverthrow, undefined);
    assert.equal(h.vassalHosts.get(GERMANY), 'atk');
    // Leadership is unchanged in the vassal outcome.
    assert.equal(getLeaderByNationId(GERMANY)?.id, 'leader_adolf_hitler');
    // The vassal outcome performs no leader-change relationship reset.
    assert.deepEqual(h.amicableResets, []);
  } finally {
    resetLeaders();
  }
});

// --- Converting an applied conquest vassalage into a regime change -----------

test('convertVassalageToOverthrow dissolves the vassal and installs the chosen leader', () => {
  try {
    setActiveLeaderSelections({ [GERMANY]: 'leader_adolf_hitler' });
    const h = harness({ target: GERMANY, demander: 'atk' });
    // The conquest already vassalized Germany under the human victor.
    h.diplomacyManager.establishVassal(GERMANY, 'atk');
    assert.equal(h.vassalHosts.get(GERMANY), 'atk');

    const overthrow = h.system.convertVassalageToOverthrow('atk', GERMANY, 'leader_angela_merkel');

    assert.ok(overthrow);
    assert.equal(overthrow?.previousLeaderName, 'Adolf Hitler');
    assert.equal(overthrow?.newLeaderName, 'Angela Merkel');
    assert.equal(getLeaderByNationId(GERMANY)?.id, 'leader_angela_merkel');
    // The fresh vassal contract with the victor is gone: the nation is independent.
    assert.equal(h.vassalHosts.has(GERMANY), false);
    // ...and the new regime starts on a clean slate toward the victor.
    assert.deepEqual(h.amicableResets, [['atk', GERMANY].sort().join('|')]);
  } finally {
    resetLeaders();
  }
});

test('convertVassalageToOverthrow rejects an invalid leader and keeps the vassalage', () => {
  try {
    setActiveLeaderSelections({ [GERMANY]: 'leader_adolf_hitler' });
    const h = harness({ target: GERMANY, demander: 'atk' });
    h.diplomacyManager.establishVassal(GERMANY, 'atk');

    const overthrow = h.system.convertVassalageToOverthrow('atk', GERMANY, 'leader_henry_v');

    assert.equal(overthrow, undefined);
    assert.equal(getLeaderByNationId(GERMANY)?.id, 'leader_adolf_hitler');
    // The vassalage is untouched when the replacement leader is invalid.
    assert.equal(h.vassalHosts.get(GERMANY), 'atk');
    // No leader change → no relationship reset.
    assert.deepEqual(h.amicableResets, []);
  } finally {
    resetLeaders();
  }
});

// --- Overthrow availability + AI victor selection ---------------------------

test('canOverthrowLeadership reflects whether an alternative exists', () => {
  try {
    const h = harness({ target: GERMANY, demander: 'atk' });
    assert.equal(h.system.canOverthrowLeadership(GERMANY), true);
    assert.equal(h.system.canOverthrowLeadership('nation_does_not_exist'), false);
  } finally {
    resetLeaders();
  }
});

test('AI victor prefers a more compatible replacement and otherwise keeps the vassal outcome', () => {
  try {
    const h = harness({ target: GERMANY, demander: 'nation_england' });
    // England's Henry V (militarism) finds Hitler (militarism) more compatible
    // than the incumbent Hermann (nationalism).
    setActiveLeaderSelections({ [GERMANY]: 'hermann-the-cheruscan', nation_england: 'leader_henry_v' });
    assert.equal(h.system.chooseOverthrowLeaderForVictor('nation_england', GERMANY), 'leader_adolf_hitler');

    // With Hitler already in power, no remaining candidate is more compatible
    // with a militarist victor, so the AI keeps the default (vassal) outcome.
    setActiveLeaderSelections({ [GERMANY]: 'leader_adolf_hitler', nation_england: 'leader_henry_v' });
    assert.equal(h.system.chooseOverthrowLeaderForVictor('nation_england', GERMANY), undefined);
  } finally {
    resetLeaders();
  }
});

// --- Persistence ------------------------------------------------------------

test('a runtime leadership change is captured in save state and restored on load', () => {
  try {
    setActiveLeaderSelections({ [GERMANY]: 'leader_adolf_hitler' });
    assert.equal(setActiveLeaderForNation(GERMANY, 'leader_angela_merkel'), true);

    // The change is part of the selections the save writer serializes.
    const selections = getActiveLeaderSelections();
    assert.equal(selections[GERMANY], 'leader_angela_merkel');

    const saved = {
      version: SAVED_GAME_VERSION,
      savedAt: new Date(0).toISOString(),
      mapKey: 'test',
      humanNationId: 'nation_england',
      activeNationIds: ['nation_england', GERMANY],
      turn: { currentRound: 1, currentTurnIndex: 0 },
      tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
      leaderSelections: selections,
    };
    const validated = SaveLoadService.validate(saved);
    assert.equal(validated.ok, true);

    // Simulate a fresh load: clear runtime state, then restore from the save.
    resetLeaders();
    assert.equal(getLeaderByNationId(GERMANY)?.id, 'hermann-the-cheruscan');
    if (validated.ok) setActiveLeaderSelections(validated.state.leaderSelections);
    assert.equal(getLeaderByNationId(GERMANY)?.id, 'leader_angela_merkel');
  } finally {
    resetLeaders();
  }
});

test('older saves without runtime leadership changes still load', () => {
  const base = {
    version: SAVED_GAME_VERSION,
    savedAt: new Date(0).toISOString(),
    mapKey: 'test',
    humanNationId: 'nation_england',
    activeNationIds: ['nation_england'],
    turn: { currentRound: 1, currentTurnIndex: 0 },
    tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
  };
  assert.equal(SaveLoadService.validate(base).ok, true);
});

// --- Newspaper --------------------------------------------------------------

test('the regime-change newspaper article names the nation and both leaders generically', () => {
  const event = {
    type: 'leadershipOverthrown',
    metadata: {
      overthrownPreviousLeaderName: 'Adolf Hitler',
      overthrownNewLeaderName: 'Angela Merkel',
    },
  } as unknown as HistoricalEvent;
  const context = {
    event,
    nationNames: ['Germany', 'France'],
    leaderNames: ['Angela Merkel', 'Napoleon'],
  } as unknown as NewspaperArticleContext;
  const definition = NEWSPAPER_EVENT_DEFINITIONS.leadershipOverthrown;
  assert.equal(definition.buildHeadline(context), 'REGIME CHANGE IN GERMANY');
  const body = definition.buildBody(context);
  assert.match(body, /Adolf Hitler/);
  assert.match(body, /Angela Merkel/);
  assert.match(body, /Germany/);
});
