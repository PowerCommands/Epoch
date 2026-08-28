/**
 * AI war termination: negotiated peace (capital-capture / capital-loss signals)
 * and AI-initiated capitulation, all routed through the *existing* peace and
 * capitulation systems.
 *
 * Run with: npx tsx --test tools/warTerminationAI.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { Nation } from '../src/entities/Nation.ts';
import { AIDiplomacySystem } from '../src/systems/ai/AIDiplomacySystem.ts';
import type { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem.ts';
import type { AIMilitaryThreatEvaluationSystem, ThreatLevel } from '../src/systems/ai/AIMilitaryThreatEvaluationSystem.ts';
import type { CityManager } from '../src/systems/CityManager.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { DiplomaticEvaluationSystem } from '../src/systems/diplomacy/DiplomaticEvaluationSystem.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import {
  PeaceTreatySystem,
  AI_PEACE_INITIATION_PRESSURE,
} from '../src/systems/PeaceTreatySystem.ts';
import {
  CapitulationSystem,
  CAPITULATION_ACCEPTANCE_THRESHOLD,
} from '../src/systems/CapitulationSystem.ts';
import type { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import type { ResourceSystem } from '../src/systems/ResourceSystem.ts';
import type { UnitManager } from '../src/systems/UnitManager.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import type { MapData } from '../src/types/map.ts';

const AI = 'mongolia';
const OPP = 'sweden';

interface CityStub {
  id: string; name: string; ownerId: string; isCapital: boolean; isOriginalCapital?: boolean;
  population: number; production: number; originNationId: string; tileX: number; tileY: number;
  ownedTileCoords: Array<{ x: number; y: number }>; occupiedOriginalNationId?: string;
}
interface UnitStub { id: string; unitTypeId: string; ownerId: string; }

function city(id: string, ownerId: string, over: Partial<CityStub> = {}): CityStub {
  return {
    id, name: id, ownerId, isCapital: false, population: 4, production: 4,
    originNationId: ownerId, tileX: 0, tileY: 0, ownedTileCoords: [], ...over,
  };
}

interface WarLosses { unitsLost?: number; citiesLost?: number; startStrength?: number; }

function harness(config: {
  currentTurn?: number;
  declaredTurn?: number;
  strength: Record<string, number>;
  threat?: Record<string, ThreatLevel>;
  fear?: number;
  cities: CityStub[];
  gold?: Record<string, number>;
  oppLosses?: WarLosses; // losses suffered by OPP against AI
  oppIsHuman?: boolean;
}) {
  const currentTurn = config.currentTurn ?? 30;
  const nations = new NationManager();
  nations.addNation(new Nation({ id: AI, name: AI, color: 0 }));
  nations.addNation(new Nation({ id: OPP, name: OPP, color: 0, isHuman: config.oppIsHuman ?? false }));
  for (const [id, amount] of Object.entries(config.gold ?? {})) nations.getResources(id).gold = amount;

  const turns = new TurnManager(nations);
  turns.restoreTurnState(currentTurn, 0);
  const diplomacy = new DiplomacyManager(turns, 7);
  diplomacy.restoreState(AI, OPP, {
    state: 'WAR',
    lastWarDeclarationTurn: config.declaredTurn ?? 1,
    fear: config.fear ?? 0,
  });
  const losses = config.oppLosses ?? {};
  diplomacy.snapshotWarStartStrength(OPP, AI, losses.startStrength ?? config.strength[OPP] ?? 0);
  diplomacy.snapshotWarStartStrength(AI, OPP, config.strength[AI] ?? 0);
  for (let i = 0; i < (losses.unitsLost ?? 0); i += 1) diplomacy.recordWarUnitLoss(OPP, AI);
  for (let i = 0; i < (losses.citiesLost ?? 0); i += 1) diplomacy.recordWarCityLoss(OPP, AI);

  const cities = new Map(config.cities.map((c) => [c.id, c]));
  const cityManager = {
    getAllCities: () => [...cities.values()],
    getCitiesByOwner: (owner: string) => [...cities.values()].filter((c) => c.ownerId === owner),
    getCity: (id: string) => cities.get(id),
    getResources: (id: string) => ({ productionPerTurn: cities.get(id)?.production ?? 0 }),
    transferOwnership: (id: string, to: string) => { const c = cities.get(id); if (c) c.ownerId = to; },
  } as unknown as CityManager;

  const resourceSystem = {
    addGold: (id: string, amount: number) => { nations.getResources(id).gold += amount; },
  } as unknown as ResourceSystem;
  const units = new Map<string, UnitStub[]>();
  const unitManager = {
    getUnitsByOwner: (owner: string) => [...(units.get(owner) ?? [])],
    removeUnit: () => {},
  } as unknown as UnitManager;
  const productionSystem = {
    removeMilitaryUnitsFromQueues: () => {},
  } as unknown as ProductionSystem;
  const military = {
    getMilitaryStrength: (id: string) => ({ totalStrength: config.strength[id] ?? 0, unitStrength: 0, cityStrength: 0 }),
    compareMilitaryStrength: (a: string, b: string) => {
      const ratio = (config.strength[a] ?? 0) / Math.max(1, config.strength[b] ?? 0);
      return ratio > 1.25 ? 'stronger' : ratio < 0.8 ? 'weaker' : 'equal';
    },
    compareMilitaryStrengthForWar: () => 'stronger',
    getDefensiveWarPowerBreakdown: () => ({
      defenderPower: 0, alliancePower: 0, peacekeepingPower: 0,
      totalDefensivePower: 0, allianceName: null, allyNationId: null,
    }),
  } as unknown as AIMilitaryEvaluationSystem;
  const threat = {
    getThreatLevel: (a: string, b: string) => config.threat?.[`${a}|${b}`] ?? 'none',
  } as unknown as AIMilitaryThreatEvaluationSystem;

  const peace = new PeaceTreatySystem(
    cityManager, nations, resourceSystem, diplomacy,
    { tiles: [] } as unknown as MapData,
    { getTilesInRange: () => [] } as unknown as IGridSystem,
    productionSystem, military, threat,
  );

  const capitulationEvents: string[] = [];
  const capitulation = new CapitulationSystem({
    diplomacyManager: diplomacy, cityManager, nationManager: nations, unitManager,
    resourceSystem, productionSystem, peaceTreatySystem: peace, militaryEvaluationSystem: military,
    getCurrentTurn: () => currentTurn,
    getDemilitarizationTurns: () => 10,
    onCapitulation: (e) => capitulationEvents.push(e.capitulatingNationId),
  });

  const logs: string[] = [];
  const ai = new AIDiplomacySystem(
    diplomacy, new DiplomaticEvaluationSystem(diplomacy), nations, turns, military, threat,
    () => true, (_n, m) => m, undefined, peace,
  );
  ai.setHumanNationPredicate((id) => nations.getNation(id)?.isHuman === true);
  // Mirror the GameScene wiring exactly.
  ai.setCapitulationController({
    evaluate: (demanding, target) => {
      const e = capitulation.evaluateCapitulationDemand(demanding, target);
      return { accepted: e.accepted, pressure: e.pressure, factors: e.factors };
    },
    apply: (demanding, target) => capitulation.applyCapitulation(
      demanding, target, peace.calculateReparations(target),
      capitulation.shouldDemandExploitationRights(demanding, target),
    ),
  });

  const run = () => {
    const original = console.log;
    console.log = (...args: unknown[]) => { logs.push(args.join(' ')); };
    try { ai.runTurn(AI); } finally { console.log = original; }
  };
  return { nations, diplomacy, peace, capitulation, ai, cities, logs, run, capitulationEvents };
}

// Capital owned by AI (captured from OPP) vs still owned by OPP.
const capturedCapital = (): CityStub =>
  city('stockholm', AI, { isCapital: true, isOriginalCapital: true, originNationId: OPP });
const heldCapital = (): CityStub =>
  city('stockholm', OPP, { isCapital: true, isOriginalCapital: true, originNationId: OPP });

// ---------------------------------------------------------------------------
// Negotiated peace
// ---------------------------------------------------------------------------

test('a winning AI does not seek peace merely because a war just started', () => {
  const h = harness({
    strength: { [AI]: 1200, [OPP]: 300 },
    cities: [heldCapital(), city('malmo', OPP)],
    // OPP still holds its capital and has lost nothing.
  });
  const seeking = h.peace.evaluateAIPeaceSeeking(AI, OPP, 4);
  assert.equal(seeking.factors.capitalCaptured, 0);
  assert.equal(seeking.factors.objectiveAchieved, 0);
  assert.ok(seeking.warPressure < AI_PEACE_INITIATION_PRESSURE);
  assert.equal(seeking.shouldInitiate, false);
  h.run();
  assert.equal(h.diplomacy.getPendingProposal(OPP), null);
});

test('capturing the enemy capital strongly increases a winning AI\'s peace interest', () => {
  const held = harness({ strength: { [AI]: 1200, [OPP]: 300 }, cities: [heldCapital(), city('malmo', OPP)] });
  const captured = harness({ strength: { [AI]: 1200, [OPP]: 300 }, cities: [capturedCapital(), city('malmo', OPP)] });

  const withoutCapital = held.peace.evaluateAIPeaceSeeking(AI, OPP, 20);
  const withCapital = captured.peace.evaluateAIPeaceSeeking(AI, OPP, 20);

  // The winner's war pressure stays low in both cases; the difference is the
  // objective-achieved trigger, not a sudden pressure spike.
  assert.equal(withoutCapital.shouldInitiate, false);
  assert.equal(withCapital.factors.capitalCaptured, 1);
  assert.equal(withCapital.factors.objectiveAchieved, 1);
  assert.equal(withCapital.shouldInitiate, true);
});

test('capital capture makes the winner offer peace but does NOT auto-end the war', () => {
  const h = harness({
    strength: { [AI]: 1200, [OPP]: 300 },
    cities: [capturedCapital(), city('malmo', OPP), city('gavle', OPP)],
    oppLosses: { citiesLost: 1, startStrength: 600 },
  });
  // Not collapsed enough to capitulate.
  assert.ok(h.capitulation.evaluateCapitulationDemand(AI, OPP).pressure < CAPITULATION_ACCEPTANCE_THRESHOLD);
  h.run();
  // A peace proposal was made...
  const proposal = h.diplomacy.getPendingProposal(OPP);
  assert.ok(proposal, 'winner should propose peace after capturing the capital');
  assert.equal(proposal?.fromNationId, AI);
  // ...but the war is still on until the recipient accepts, and no capitulation happened.
  assert.equal(h.diplomacy.getState(AI, OPP), 'WAR');
  assert.deepEqual(h.capitulationEvents, []);
  assert.match(h.logs.join('\n'), /\[WarTerminationAI\].*seeking peace, capitalCaptured=true/);
});

test('a losing AI seeks peace once it has lost its capital and is outmatched', () => {
  // Perspective flip: AI (mongolia) is the loser here — it lost its own capital.
  const h = harness({
    strength: { [AI]: 120, [OPP]: 1500 },
    threat: { [`${AI}|${OPP}`]: 'high' },
    fear: 70,
    cities: [
      city('karakorum', OPP, { isCapital: true, isOriginalCapital: true, originNationId: AI }), // AI's capital, captured
      city('remnant', AI),
    ],
    oppLosses: {},
  });
  const seeking = h.peace.evaluateAIPeaceSeeking(AI, OPP, 24);
  assert.equal(seeking.factors.capitalLost > 0, true, 'capital-loss pressure is present');
  assert.ok(seeking.warPressure >= AI_PEACE_INITIATION_PRESSURE);
  assert.equal(seeking.shouldInitiate, true);
});

test('the recipient can still reject an AI peace proposal (status-quo offer, low recipient pressure)', () => {
  // A comfortable recipient (low pressure) rejects a value-free status-quo offer.
  const h = harness({ strength: { [AI]: 1200, [OPP]: 300 }, cities: [capturedCapital()] });
  const evaluation = h.peace.evaluatePeaceProposal({ fromNationId: AI, toNationId: OPP, warDuration: 20 });
  // OPP here is the strong side of THIS evaluation only through pressure; with a
  // status-quo (0-value) offer and non-maximal pressure, acceptance requires
  // near-total collapse.
  assert.equal(evaluation.settlementValue, 0);
  assert.equal(evaluation.accepted, evaluation.warPressure >= 0.9 ? true : false);
});

test('a rejected peace proposal is not repeated every turn (cooldown)', () => {
  const h = harness({
    strength: { [AI]: 1200, [OPP]: 300 },
    cities: [capturedCapital(), city('malmo', OPP)],
    oppLosses: { citiesLost: 1, startStrength: 600 },
  });
  h.run();
  assert.ok(h.diplomacy.getPendingProposal(OPP), 'first proposal sent');
  // Recipient rejects, clearing the pending proposal.
  h.diplomacy.respondToPeace(AI, OPP, false);
  assert.equal(h.diplomacy.getPendingProposal(OPP), null);
  // Same turn: the cooldown must prevent an immediate re-proposal.
  h.run();
  assert.equal(h.diplomacy.getPendingProposal(OPP), null, 'no immediate re-proposal within cooldown');
});

// ---------------------------------------------------------------------------
// Capitulation
// ---------------------------------------------------------------------------

const collapse = (over: Partial<Parameters<typeof harness>[0]> = {}) => harness({
  strength: { [AI]: 2000, [OPP]: 20 },
  threat: { [`${OPP}|${AI}`]: 'high' },
  fear: 90,
  cities: [city('last-city', OPP)],
  oppLosses: { unitsLost: 12, citiesLost: 5, startStrength: 600 },
  ...over,
});

test('no capitulation is demanded outside of war', () => {
  const h = collapse();
  h.diplomacy.respondToPeace(AI, OPP, true); // end the war
  assert.notEqual(h.diplomacy.getState(AI, OPP), 'WAR');
  h.run();
  assert.deepEqual(h.capitulationEvents, []);
});

test('no capitulation when the existing threshold is not satisfied (balanced war)', () => {
  const h = harness({
    strength: { [AI]: 500, [OPP]: 500 },
    cities: [heldCapital(), city('malmo', OPP)],
  });
  assert.ok(h.capitulation.evaluateCapitulationDemand(AI, OPP).pressure < CAPITULATION_ACCEPTANCE_THRESHOLD);
  h.run();
  assert.deepEqual(h.capitulationEvents, []);
});

test('capital capture ALONE (otherwise even war) does not reach the capitulation threshold', () => {
  const h = harness({
    strength: { [AI]: 500, [OPP]: 500 }, // even military
    cities: [capturedCapital(), city('malmo', OPP), city('gavle', OPP)], // OPP lost only its capital
  });
  const evaluation = h.capitulation.evaluateCapitulationDemand(AI, OPP);
  assert.ok(evaluation.pressure < CAPITULATION_ACCEPTANCE_THRESHOLD,
    `capital loss alone must not force capitulation (pressure=${evaluation.pressure.toFixed(2)})`);
  h.run();
  assert.deepEqual(h.capitulationEvents, []);
});

test('a severe AI-vs-AI collapse triggers the existing capitulation path and ends the war', () => {
  const h = collapse();
  assert.equal(h.capitulation.evaluateCapitulationDemand(AI, OPP).accepted, true);
  h.run();
  assert.deepEqual(h.capitulationEvents, [OPP], 'the collapsed AI capitulates');
  assert.notEqual(h.diplomacy.getState(AI, OPP), 'WAR', 'war ends after capitulation');
  assert.match(h.logs.join('\n'), /\[WarTerminationAI\].*capitulation threshold reached/);
});

test('capitulation is not processed again after the war has ended', () => {
  const h = collapse();
  h.run();
  assert.deepEqual(h.capitulationEvents, [OPP]);
  h.run(); // war is already over
  assert.deepEqual(h.capitulationEvents, [OPP], 'capitulation is applied exactly once');
});

test('a human player is never silently auto-capitulated', () => {
  const h = collapse({ oppIsHuman: true });
  // The situation would satisfy the threshold for an AI target...
  assert.equal(h.capitulation.evaluateCapitulationDemand(AI, OPP).accepted, true);
  h.run();
  // ...but the AI never capitulates the human and the war continues.
  assert.deepEqual(h.capitulationEvents, []);
  assert.equal(h.diplomacy.getState(AI, OPP), 'WAR');
});
