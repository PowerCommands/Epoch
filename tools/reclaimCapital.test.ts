/**
 * Reclaim Capital — persistent strategic objective for AI nations.
 *
 * Covers the pure derivation/evaluation module, the ReclaimCapitalSystem
 * orchestration + logging, and the integration seams (offensive targeting and
 * joint-war acceptance). All state is derived from canonical city ownership, so
 * "save/load" is exercised as a re-derive from the same city state.
 *
 * Run with: npx tsx --test tools/reclaimCapital.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessReclaimOpportunity,
  deriveReclaimObjective,
  reclaimWarModifier,
  RECLAIM_WAR_DESIRE_BONUS,
  type ReclaimCityView,
} from '../src/systems/ai/reclaimCapital.ts';
import { ReclaimCapitalSystem, type ReclaimCapitalDeps } from '../src/systems/ai/ReclaimCapitalSystem.ts';
import { OffensiveOperationSystem, type OperationParams } from '../src/systems/ai/OffensiveOperationSystem.ts';
import { JointWarSystem } from '../src/systems/diplomacy/JointWarSystem.ts';
import { AIStrategySelector } from '../src/systems/ai/AIStrategySelector.ts';
import { NavalExpeditionTargetingSystem } from '../src/systems/ai/NavalExpeditionTargetingSystem.ts';
import { DEFAULT_AI_LEADER_PERSONALITY } from '../src/types/aiLeaderPersonality.ts';
import { TileType, type MapData } from '../src/types/map.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import type { City } from '../src/entities/City.ts';
import type { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import type { DiplomaticEvaluationSystem } from '../src/systems/diplomacy/DiplomaticEvaluationSystem.ts';
import type { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem.ts';
import type { AllianceManager } from '../src/systems/diplomacy/AllianceManager.ts';
import type { NationManager } from '../src/systems/NationManager.ts';

const SWEDEN = 'sweden';
const MONGOLIA = 'mongolia';
const ENGLAND = 'england';

function capitalView(over: Partial<ReclaimCityView> = {}): ReclaimCityView {
  return { id: 'stockholm', name: 'Stockholm', ownerId: SWEDEN, originNationId: SWEDEN, isOriginalCapital: true, ...over };
}

// ─── Pure derivation ────────────────────────────────────────────────────────

test('losing the capital activates the objective and identifies city + holder', () => {
  const cities = [capitalView({ ownerId: MONGOLIA })];
  const obj = deriveReclaimObjective(SWEDEN, cities);
  assert.ok(obj);
  assert.equal(obj.targetCityId, 'stockholm');
  assert.equal(obj.currentHolderId, MONGOLIA);
  assert.equal(obj.nationId, SWEDEN);
});

test('holding your own capital yields no objective', () => {
  assert.equal(deriveReclaimObjective(SWEDEN, [capitalView()]), null);
});

test('losing a non-capital city does not activate the objective', () => {
  const cities: ReclaimCityView[] = [
    capitalView(), // still owned
    { id: 'malmo', name: 'Malmo', ownerId: MONGOLIA, originNationId: SWEDEN, isOriginalCapital: false },
  ];
  assert.equal(deriveReclaimObjective(SWEDEN, cities), null);
});

test('ownership transfer occupier A -> B updates the holder on re-derive', () => {
  // A save/load is just a re-derive from the same canonical city state.
  assert.equal(deriveReclaimObjective(SWEDEN, [capitalView({ ownerId: MONGOLIA })])?.currentHolderId, MONGOLIA);
  assert.equal(deriveReclaimObjective(SWEDEN, [capitalView({ ownerId: ENGLAND })])?.currentHolderId, ENGLAND);
});

test('recapturing the capital clears the objective', () => {
  assert.equal(deriveReclaimObjective(SWEDEN, [capitalView({ ownerId: SWEDEN })]), null);
});

// ─── Opportunity assessment ─────────────────────────────────────────────────

const baseOpp = {
  ownMilitaryStrength: 100,
  holderMilitaryStrength: 100,
  holderOtherWarCount: 0,
  availablePartnerCount: 0,
  economyHealthy: true,
  warPermittedByCooldown: true,
};

test('overwhelmingly weaker nation waits (low) regardless of distractions', () => {
  const result = assessReclaimOpportunity({
    ...baseOpp, ownMilitaryStrength: 20, holderMilitaryStrength: 100,
    holderOtherWarCount: 2, availablePartnerCount: 2,
  });
  assert.equal(result.level, 'low');
});

test('rebuilt nation with a distracted holder and a partner reaches high', () => {
  const result = assessReclaimOpportunity({
    ...baseOpp, ownMilitaryStrength: 110, holderMilitaryStrength: 100,
    holderOtherWarCount: 1, availablePartnerCount: 1,
  });
  assert.equal(result.level, 'high');
});

test('strong but undistracted holder is only a medium opportunity', () => {
  const result = assessReclaimOpportunity({
    ...baseOpp, ownMilitaryStrength: 160, holderMilitaryStrength: 100,
  });
  assert.equal(result.level, 'medium');
});

test('high opportunity is capped to medium when a war cannot start yet', () => {
  const favorable = { ...baseOpp, ownMilitaryStrength: 110, holderOtherWarCount: 1, availablePartnerCount: 1 };
  assert.equal(assessReclaimOpportunity(favorable).level, 'high');
  assert.equal(assessReclaimOpportunity({ ...favorable, warPermittedByCooldown: false }).level, 'medium');
});

// ─── War modifier ───────────────────────────────────────────────────────────

test('war modifier: high opportunity toward the holder commits + boosts', () => {
  const obj = deriveReclaimObjective(SWEDEN, [capitalView({ ownerId: MONGOLIA })]);
  const mod = reclaimWarModifier(obj, 'high', MONGOLIA);
  assert.equal(mod.treatAsWarDesire, true);
  assert.equal(mod.warScoreDelta, RECLAIM_WAR_DESIRE_BONUS);
  assert.equal(mod.suppressUnrelated, false);
});

test('war modifier: low opportunity toward the holder is patient (no bonus)', () => {
  const obj = deriveReclaimObjective(SWEDEN, [capitalView({ ownerId: MONGOLIA })]);
  const mod = reclaimWarModifier(obj, 'low', MONGOLIA);
  assert.equal(mod.treatAsWarDesire, false);
  assert.equal(mod.warScoreDelta, 0);
});

test('war modifier: unrelated opponent is suppressed while recovering', () => {
  const obj = deriveReclaimObjective(SWEDEN, [capitalView({ ownerId: MONGOLIA })]);
  const mod = reclaimWarModifier(obj, 'high', ENGLAND);
  assert.equal(mod.suppressUnrelated, true);
  assert.equal(mod.treatAsWarDesire, false);
});

test('war modifier: no objective is a no-op toward everyone', () => {
  const mod = reclaimWarModifier(null, 'high', MONGOLIA);
  assert.equal(mod.warScoreDelta, 0);
  assert.equal(mod.suppressUnrelated, false);
});

// ─── ReclaimCapitalSystem orchestration + logging ───────────────────────────

function makeSystem(over: Partial<ReclaimCapitalDeps> = {}): {
  system: ReclaimCapitalSystem; logs: string[]; cities: ReclaimCityView[];
  strength: Record<string, number>; wars: Record<string, string[]>;
} {
  const cities: ReclaimCityView[] = [capitalView()];
  const strength: Record<string, number> = { [SWEDEN]: 100, [MONGOLIA]: 100, [ENGLAND]: 100 };
  const wars: Record<string, string[]> = {};
  const logs: string[] = [];
  const deps: ReclaimCapitalDeps = {
    getAllCities: () => cities,
    getAllNationIds: () => [SWEDEN, MONGOLIA, ENGLAND],
    getNonHumanNationIds: () => [SWEDEN, MONGOLIA, ENGLAND],
    nationExists: () => true,
    getMilitaryStrength: (id) => strength[id] ?? 0,
    getWarringNationIds: (id) => wars[id] ?? [],
    isHostileTowards: () => false,
    haveMet: () => true,
    isEconomyHealthy: () => true,
    isWarPermitted: () => true,
    isAtWarWith: (a, b) => (wars[a] ?? []).includes(b),
    log: (m) => logs.push(m),
    ...over,
  };
  return { system: new ReclaimCapitalSystem(deps), logs, cities, strength, wars };
}

test('system logs activation and exposes objective + holder accessors', () => {
  const { system, logs, cities } = makeSystem();
  system.handleRoundStart(1);
  assert.equal(logs.length, 0); // no one has lost a capital yet
  assert.equal(system.getReclaimHolderId(SWEDEN), undefined);

  cities[0] = capitalView({ ownerId: MONGOLIA });
  system.handleRoundStart(2);
  assert.ok(logs.some((l) => l.includes('Strategic objective activated')));
  assert.equal(system.getReclaimHolderId(SWEDEN), MONGOLIA);
  assert.equal(system.getObjective(SWEDEN)?.targetCityId, 'stockholm');
});

test('system retargets and finally reports completion', () => {
  const { system, logs, cities } = makeSystem();
  cities[0] = capitalView({ ownerId: MONGOLIA });
  system.handleRoundStart(1);

  cities[0] = capitalView({ ownerId: ENGLAND }); // A -> B
  system.handleRoundStart(2);
  assert.equal(system.getReclaimHolderId(SWEDEN), ENGLAND);
  assert.ok(logs.some((l) => l.includes('retargeted')));

  cities[0] = capitalView({ ownerId: SWEDEN }); // recovered
  system.handleRoundStart(3);
  assert.equal(system.getReclaimHolderId(SWEDEN), undefined);
  assert.ok(logs.some((l) => l.includes('objective completed')));
});

test('peace and later reevaluation do not clear the derived objective', () => {
  const { system, cities, wars } = makeSystem();
  cities[0] = capitalView({ ownerId: MONGOLIA });
  wars[SWEDEN] = [MONGOLIA];
  wars[MONGOLIA] = [SWEDEN];
  system.handleRoundStart(1);

  // Signing peace changes diplomacy only; canonical city ownership is intact.
  wars[SWEDEN] = [];
  wars[MONGOLIA] = [];
  system.handleRoundStart(25);
  assert.equal(system.getReclaimHolderId(SWEDEN), MONGOLIA);
  assert.equal(system.getObjective(SWEDEN)?.targetCityId, 'stockholm');
});

test('system produces high-opportunity war desire toward holder, suppression elsewhere', () => {
  const { system, cities, strength, wars } = makeSystem();
  cities[0] = capitalView({ ownerId: MONGOLIA });
  // Sweden rebuilt to parity; Mongolia distracted by a war with England.
  strength[SWEDEN] = 110;
  wars[MONGOLIA] = [ENGLAND];
  wars[ENGLAND] = [MONGOLIA];
  system.handleRoundStart(1);

  assert.equal(system.getOpportunity(SWEDEN), 'high');
  assert.equal(system.getReclaimWarModifier(SWEDEN, MONGOLIA).treatAsWarDesire, true);
  assert.equal(system.getReclaimWarModifier(SWEDEN, ENGLAND).suppressUnrelated, true);
});

test('system logs seeking-peace once while weak and at war with the holder', () => {
  const { system, logs, cities, strength, wars } = makeSystem();
  cities[0] = capitalView({ ownerId: MONGOLIA });
  strength[SWEDEN] = 20; // overwhelmed
  wars[SWEDEN] = [MONGOLIA];
  wars[MONGOLIA] = [SWEDEN];
  system.handleRoundStart(1);
  system.handleRoundStart(2);
  const peaceLogs = logs.filter((l) => l.includes('seeking peace'));
  assert.equal(system.getOpportunity(SWEDEN), 'low');
  assert.equal(peaceLogs.length, 1); // throttled to once per span
});

test('recovery biases normal strategy selection, and disappears after reclamation', () => {
  const selector = new AIStrategySelector();
  const context = {
    nationId: SWEDEN,
    currentTurn: 20,
    currentStrategyId: 'balanced',
    strategyStartedTurn: 0,
    nationalAgendaId: 'growth' as const,
    leaderPersonality: DEFAULT_AI_LEADER_PERSONALITY,
    cityCount: 4,
    unitCount: 4,
    gold: 200,
    goldPerTurn: 5,
    netHappiness: 5,
    atWar: false,
    enemyMilitaryNearby: false,
    highestThreatLevel: 'low' as const,
  };
  assert.equal(selector.selectStrategy(context), 'balanced');
  assert.equal(selector.selectStrategy({ ...context, reclaimRecovering: true }), 'economic');
  assert.equal(selector.selectStrategy({ ...context, reclaimRecovering: false }), 'balanced');
});

// ─── Offensive targeting integration ────────────────────────────────────────

function cityStub(id: string, ownerId: string, tileX: number, health = 100): City {
  return { id, name: id, ownerId, tileX, tileY: 0, health } as unknown as City;
}

function offensiveParams(reclaimTargetCityId?: string): OperationParams {
  return {
    nationId: SWEDEN,
    round: 1,
    warEnemyNationIds: [MONGOLIA],
    // Near normal city vs the far-away lost capital.
    allCities: [cityStub('ulaanbaatar', MONGOLIA, 3), cityStub('stockholm', MONGOLIA, 25)],
    ownAnchor: { x: 0, y: 0 },
    ownLandCombatUnits: [],
    aggression: 1,
    distanceFn: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
    reclaimTargetCityId,
  };
}

test('without the objective, the near enemy city is the target (far capital is out of range)', () => {
  const op = new OffensiveOperationSystem().getOperation(offensiveParams());
  assert.equal(op?.targetCityId, 'ulaanbaatar');
});

test('with the objective, the lost capital dominates targeting despite distance', () => {
  const op = new OffensiveOperationSystem().getOperation(offensiveParams('stockholm'));
  assert.equal(op?.targetCityId, 'stockholm');
});

test('a coastal lost capital also dominates existing naval expedition targeting', () => {
  const ordinary = cityStub('coastal-normal', MONGOLIA, 1);
  const capital = cityStub('stockholm', MONGOLIA, 2);
  ordinary.ownedTileCoords = [{ x: 0, y: 0 }];
  capital.ownedTileCoords = [{ x: 1, y: 0 }];
  ordinary.population = 10; // ordinarily the more valuable naval target
  capital.population = 1;
  const mapData = {
    width: 2,
    height: 1,
    tileSize: 64,
    tiles: [[
      { x: 0, y: 0, type: TileType.Coast },
      { x: 1, y: 0, type: TileType.Coast },
    ]],
  } satisfies MapData;
  const grid = {
    getDistance: (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
    getTilesInRange: () => [],
  } as unknown as IGridSystem;
  const targeting = new NavalExpeditionTargetingSystem();
  const base = {
    nationId: SWEDEN,
    warEnemyNationIds: [MONGOLIA],
    allCities: [ordinary, capital],
    allUnits: [],
    mapData,
    gridSystem: grid,
    homeUnderThreat: false,
    hasRangedNavalCapability: false,
  };
  assert.equal(targeting.getBestTarget(base)?.cityId, 'coastal-normal');
  assert.equal(targeting.getBestTarget({ ...base, reclaimTargetCityId: 'stockholm' })?.cityId, 'stockholm');
});

// ─── Joint-war acceptance integration ───────────────────────────────────────

function makeJointWar(attitudes: Record<string, string> = {}): JointWarSystem {
  const nations = [SWEDEN, MONGOLIA, ENGLAND];
  const diplomacy = {
    getState: () => 'PEACE',
    getRelation: () => ({ trust: 50, affinity: 0, hostility: 0, fear: 0 }),
    canUseExploitationRights: () => false,
    hasExploitationRights: () => false,
  } as unknown as DiplomacyManager;
  const evaluation = {
    evaluateAttitude: (viewer: string, target: string) => attitudes[`${viewer}|${target}`] ?? 'neutral',
  } as unknown as DiplomaticEvaluationSystem;
  const military = {
    isNationActive: () => true,
    getMilitaryStrength: () => ({ totalStrength: 100, unitStrength: 0, cityStrength: 0 }),
    getDefensiveWarPowerAgainst: () => 50,
  } as unknown as AIMilitaryEvaluationSystem;
  const alliance = { areAllied: () => false } as unknown as AllianceManager;
  const nationManager = { getAllNations: () => nations.map((id) => ({ id })) } as unknown as NationManager;
  return new JointWarSystem(diplomacy, evaluation, military, alliance, nationManager, () => true);
}

test('joint war against the capital holder passes a borderline acceptance only with the objective', () => {
  // Sweden (receiver) is asked by England to jointly attack Mongolia. Relations
  // are neutral, so the base score sits below the acceptance threshold.
  const jw = makeJointWar();
  assert.equal(jw.shouldAccept(SWEDEN, ENGLAND, MONGOLIA, 'request'), false);

  jw.setReclaimHolderProvider((id) => (id === SWEDEN ? MONGOLIA : undefined));
  assert.equal(jw.shouldAccept(SWEDEN, ENGLAND, MONGOLIA, 'request'), true);
});

test('the reclaim bonus never overrides the refuse-to-attack-a-friend gate', () => {
  const jw = makeJointWar({ [`${SWEDEN}|${MONGOLIA}`]: 'friendly' });
  jw.setReclaimHolderProvider((id) => (id === SWEDEN ? MONGOLIA : undefined));
  assert.equal(jw.shouldAccept(SWEDEN, ENGLAND, MONGOLIA, 'request'), false);
});

test('a recovering nation hard-refuses unrelated offensive joint wars', () => {
  const jw = makeJointWar({ [`${SWEDEN}|${ENGLAND}`]: 'hostile' });
  // Without the objective, Sweden has enough ordinary hostility and military
  // strength to accept England's proposed war against a third nation.
  assert.equal(jw.shouldAccept(SWEDEN, MONGOLIA, ENGLAND, 'request'), true);

  jw.setReclaimHolderProvider((id) => (id === SWEDEN ? MONGOLIA : undefined));
  assert.equal(jw.shouldAccept(SWEDEN, MONGOLIA, ENGLAND, 'request'), false);
});

test('a recovering proposer never falls back to an unrelated joint war', () => {
  const jw = makeJointWar({
    [`${SWEDEN}|${ENGLAND}`]: 'hostile',
    [`${SWEDEN}|${MONGOLIA}`]: 'friendly',
  });
  // Legacy behavior can select an ordinary hostile target.
  assert.equal(jw.findAIProposal(SWEDEN)?.targetNationId, ENGLAND);

  // The holder is Mongolia, but the only receiver (Mongolia itself) cannot be
  // used for a proposal against Mongolia. The correct result is to wait, not
  // to fall back to England.
  jw.setReclaimHolderProvider((id) => (id === SWEDEN ? MONGOLIA : undefined));
  assert.equal(jw.findAIProposal(SWEDEN), null);
});

test('a neutral enemy of the holder becomes a plausible proactive partner', () => {
  const attitudes = { [`${ENGLAND}|${MONGOLIA}`]: 'hostile' };
  const jw = makeJointWar(attitudes);
  assert.equal(jw.findAIProposal(SWEDEN), null);

  jw.setReclaimHolderProvider((id) => (id === SWEDEN ? MONGOLIA : undefined));
  const proposal = jw.findAIProposal(SWEDEN);
  assert.equal(proposal?.receiverNationId, ENGLAND);
  assert.equal(proposal?.targetNationId, MONGOLIA);
  assert.equal(proposal?.kind, 'request');
  // This method only proposes cooperation; alliance formation remains entirely
  // in the existing alliance system.
});

test('shared opposition does not make a deeply hostile nation a reclaim partner', () => {
  const jw = makeJointWar({
    [`${SWEDEN}|${ENGLAND}`]: 'hostile',
    [`${ENGLAND}|${MONGOLIA}`]: 'hostile',
  });
  jw.setReclaimHolderProvider((id) => (id === SWEDEN ? MONGOLIA : undefined));
  assert.equal(jw.findAIProposal(SWEDEN), null);
});
