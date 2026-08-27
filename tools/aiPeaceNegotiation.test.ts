import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { Nation } from '../src/entities/Nation.ts';
import { AIDiplomacySystem } from '../src/systems/ai/AIDiplomacySystem.ts';
import type { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem.ts';
import type { AIMilitaryThreatEvaluationSystem, ThreatLevel } from '../src/systems/ai/AIMilitaryThreatEvaluationSystem.ts';
import type { CityManager } from '../src/systems/CityManager.ts';
import { DiplomacyManager, type PeaceProposal } from '../src/systems/DiplomacyManager.ts';
import { DiplomaticEvaluationSystem } from '../src/systems/diplomacy/DiplomaticEvaluationSystem.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { PeaceTreatySystem } from '../src/systems/PeaceTreatySystem.ts';
import type { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import type { ResourceSystem } from '../src/systems/ResourceSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import type { MapData } from '../src/types/map.ts';

const AI = 'nation_england';
const HUMAN = 'nation_sweden';
const OTHER = 'nation_france';

interface CityStub {
  id: string;
  name: string;
  ownerId: string;
  isCapital: boolean;
  population: number;
  production: number;
  originNationId: string;
  tileX: number;
  tileY: number;
  ownedTileCoords: Array<{ x: number; y: number }>;
  occupiedOriginalNationId?: string;
}

interface WarConfig {
  opponentId: string;
  proposerStrength: number;
  opponentStrength: number;
  fear?: number;
  unitsLost?: number;
  citiesLost?: number;
  startStrength?: number;
  threat?: ThreatLevel;
  declaredTurn?: number;
}

function city(id: string, ownerId: string, overrides: Partial<CityStub> = {}): CityStub {
  return {
    id,
    name: id,
    ownerId,
    isCapital: false,
    population: 4,
    production: 4,
    originNationId: ownerId,
    tileX: 0,
    tileY: 0,
    ownedTileCoords: [],
    ...overrides,
  };
}

function harness(config: {
  currentTurn?: number;
  wars: WarConfig[];
  cities?: CityStub[];
  gold?: Record<string, number>;
  humanOpponentIds?: string[];
}) {
  const currentTurn = config.currentTurn ?? 25;
  const nations = new NationManager();
  const ids = new Set([AI, ...config.wars.map((war) => war.opponentId)]);
  for (const id of ids) {
    nations.addNation(new Nation({
      id,
      name: id,
      color: 0,
      isHuman: config.humanOpponentIds?.includes(id) ?? false,
    }));
    nations.getResources(id).gold = config.gold?.[id] ?? 0;
  }
  const turns = new TurnManager(nations);
  turns.restoreTurnState(currentTurn, 0);
  const diplomacy = new DiplomacyManager(turns, 7);
  const strength: Record<string, number> = {};
  const threats = new Map<string, ThreatLevel>();
  for (const war of config.wars) {
    strength[AI] = war.proposerStrength;
    strength[war.opponentId] = war.opponentStrength;
    diplomacy.restoreState(AI, war.opponentId, {
      state: 'WAR',
      lastWarDeclarationTurn: war.declaredTurn ?? 1,
      fear: war.fear ?? 0,
    });
    diplomacy.snapshotWarStartStrength(AI, war.opponentId, war.startStrength ?? war.proposerStrength);
    diplomacy.snapshotWarStartStrength(war.opponentId, AI, war.opponentStrength);
    for (let index = 0; index < (war.unitsLost ?? 0); index += 1) diplomacy.recordWarUnitLoss(AI, war.opponentId);
    for (let index = 0; index < (war.citiesLost ?? 0); index += 1) diplomacy.recordWarCityLoss(AI, war.opponentId);
    threats.set(`${AI}|${war.opponentId}`, war.threat ?? 'none');
  }

  const cities = new Map((config.cities ?? []).map((entry) => [entry.id, entry]));
  const cityManager = {
    getCitiesByOwner: (ownerId: string) => [...cities.values()].filter((entry) => entry.ownerId === ownerId),
    getCity: (id: string) => cities.get(id),
    getResources: (id: string) => ({ productionPerTurn: cities.get(id)?.production ?? 0 }),
    transferOwnership: (id: string, ownerId: string) => {
      const entry = cities.get(id);
      if (entry) entry.ownerId = ownerId;
    },
  } as unknown as CityManager;
  const resourceSystem = {
    addGold: (nationId: string, amount: number) => { nations.getResources(nationId).gold += amount; },
  } as unknown as ResourceSystem;
  const military = {
    getMilitaryStrength: (nationId: string) => ({ totalStrength: strength[nationId] ?? 0, unitStrength: 0, cityStrength: 0 }),
    compareMilitaryStrength: (a: string, b: string) => {
      const ratio = (strength[a] ?? 0) / Math.max(1, strength[b] ?? 0);
      return ratio > 1.25 ? 'stronger' : ratio < 0.8 ? 'weaker' : 'equal';
    },
    compareMilitaryStrengthForWar: () => 'equal',
    getDefensiveWarPowerBreakdown: () => ({
      defenderPower: 0,
      alliancePower: 0,
      peacekeepingPower: 0,
      totalDefensivePower: 0,
      allianceName: null,
      allyNationId: null,
    }),
  } as unknown as AIMilitaryEvaluationSystem;
  const threat = {
    getThreatLevel: (a: string, b: string) => threats.get(`${a}|${b}`) ?? 'none',
  } as unknown as AIMilitaryThreatEvaluationSystem;
  const peace = new PeaceTreatySystem(
    cityManager,
    nations,
    resourceSystem,
    diplomacy,
    { tiles: [] } as unknown as MapData,
    { getTilesInRange: () => [] } as unknown as IGridSystem,
    {} as ProductionSystem,
    military,
    threat,
  );
  const logs: string[] = [];
  const ai = new AIDiplomacySystem(
    diplomacy,
    new DiplomaticEvaluationSystem(diplomacy),
    nations,
    turns,
    military,
    threat,
    () => true,
    (_nationId, message) => message,
    undefined,
    peace,
  );
  const run = () => {
    const original = console.log;
    console.log = (...args: unknown[]) => { logs.push(args.join(' ')); };
    try { ai.runTurn(AI); } finally { console.log = original; }
  };
  return { nations, turns, diplomacy, peace, ai, cities, logs, run };
}

const favorable: WarConfig = {
  opponentId: HUMAN,
  proposerStrength: 1200,
  opponentStrength: 150,
};
const moderate: WarConfig = {
  opponentId: HUMAN,
  proposerStrength: 500,
  opponentStrength: 700,
  fear: 45,
  unitsLost: 4,
  citiesLost: 2,
  startStrength: 700,
  threat: 'low',
};
const severe: WarConfig = {
  opponentId: HUMAN,
  proposerStrength: 60,
  opponentStrength: 1800,
  fear: 90,
  unitsLost: 12,
  citiesLost: 3,
  startStrength: 700,
  threat: 'high',
};

test('favorable and moderate wars do not trigger proactive peace, while high pressure does', () => {
  const winning = harness({ wars: [favorable], humanOpponentIds: [HUMAN] });
  winning.run();
  assert.equal(winning.diplomacy.getPendingProposal(HUMAN), null);

  const costly = harness({ wars: [moderate], humanOpponentIds: [HUMAN] });
  const moderateEvaluation = costly.peace.evaluateAIPeaceSeeking(AI, HUMAN, 24);
  assert.ok(moderateEvaluation.warPressure >= 0.35);
  assert.ok(moderateEvaluation.warPressure < 0.55);
  costly.run();
  assert.equal(costly.diplomacy.getPendingProposal(HUMAN), null);

  const losing = harness({ wars: [severe], humanOpponentIds: [HUMAN], gold: { [AI]: 1000 } });
  losing.run();
  assert.ok(losing.diplomacy.getPendingProposal(HUMAN));
  assert.match(losing.logs.join('\n'), /seeks peace.*pressure=.*offer gold=/);
});

test('high pressure cannot bypass the existing minimum war duration', () => {
  const h = harness({
    currentTurn: 25,
    wars: [{ ...severe, declaredTurn: 20 }],
    humanOpponentIds: [HUMAN],
    gold: { [AI]: 1000 },
  });
  h.run();
  assert.equal(h.diplomacy.getPendingProposal(HUMAN), null);
  assert.match(h.logs.join('\n'), /cannot propose peace.*5\/15 turns elapsed/);
});

test('offer strength rises with pressure and cities appear only in serious situations', () => {
  const mild = harness({ wars: [{ ...severe, proposerStrength: 260, fear: 50, unitsLost: 6, citiesLost: 1, threat: 'medium' }], gold: { [AI]: 400 } });
  const dire = harness({
    wars: [severe],
    gold: { [AI]: 400 },
    cities: [city('capital', AI, { isCapital: true }), city('border-city', AI, { population: 2 })],
  });
  const mildPlan = mild.peace.buildAIPeaceProposal(AI, HUMAN, 24);
  const direPlan = dire.peace.buildAIPeaceProposal(AI, HUMAN, 24);
  assert.ok(direPlan.seeking.warPressure > mildPlan.seeking.warPressure);
  assert.ok((direPlan.proposal.goldReparations ?? 0) >= (mildPlan.proposal.goldReparations ?? 0));
  assert.deepEqual(mildPlan.proposal.offeredCityIds ?? [], []);
  assert.deepEqual(direPlan.proposal.offeredCityIds, ['border-city']);
  assert.ok(!direPlan.proposal.offeredCityIds?.includes('capital'));
});

test('constructed offers never exceed treasury or include foreign/capital cities', () => {
  const h = harness({
    wars: [severe],
    gold: { [AI]: 75 },
    cities: [
      city('capital', AI, { isCapital: true }),
      city('own-city', AI),
      city('foreign-city', HUMAN),
    ],
  });
  const plan = h.peace.buildAIPeaceProposal(AI, HUMAN, 24);
  assert.ok((plan.proposal.goldReparations ?? 0) <= 75);
  assert.deepEqual(plan.proposal.offeredCityIds, ['own-city']);
});

test('AI to Human offer remains pending until explicit acceptance and applies authoritative settlement', () => {
  const h = harness({
    wars: [severe],
    humanOpponentIds: [HUMAN],
    gold: { [AI]: 300, [HUMAN]: 0 },
    cities: [city('capital', AI, { isCapital: true }), city('border-city', AI)],
  });
  h.run();
  const proposal = h.diplomacy.getPendingProposal(HUMAN)!;
  assert.ok(proposal);
  assert.equal(h.diplomacy.getState(AI, HUMAN), 'WAR');
  assert.equal(h.nations.getResources(HUMAN).gold, 0);

  const result = h.peace.settleAcceptedPeace(proposal);
  assert.ok(result.goldTransferred > 0);
  assert.deepEqual(result.cityIdsTransferred, ['border-city']);
  assert.equal(h.cities.get('border-city')?.ownerId, HUMAN);
  assert.equal(h.cities.get('capital')?.ownerId, AI);
  assert.equal(h.diplomacy.getState(AI, HUMAN), 'PEACE');
  assert.equal(h.diplomacy.getPeaceTreatyRemainingTurns(AI, HUMAN, 25), 7);
  assert.equal(h.nations.getResources(HUMAN).gold, result.goldTransferred);
  assert.equal(h.diplomacy.getPendingProposal(HUMAN), null);
});

test('Human rejection transfers nothing and the saved proposal cooldown prevents spam', () => {
  const h = harness({ wars: [severe], humanOpponentIds: [HUMAN], gold: { [AI]: 1500, [HUMAN]: 0 } });
  h.run();
  const before = h.nations.getResources(AI).gold;
  h.diplomacy.respondToPeace(AI, HUMAN, false);
  assert.equal(h.diplomacy.getState(AI, HUMAN), 'WAR');
  assert.equal(h.nations.getResources(AI).gold, before);
  assert.equal(h.nations.getResources(HUMAN).gold, 0);
  h.run();
  assert.equal(h.diplomacy.getPendingProposal(HUMAN), null);
  assert.match(h.logs.join('\n'), /peace-offer cooldown/);
  assert.equal(h.diplomacy.getRelation(AI, HUMAN).lastPeaceProposalTurn, 25);
});

test('AI to AI uses the same recipient evaluation for accepted and rejected settlements', () => {
  const accepted = harness({
    wars: [severe],
    gold: { [AI]: 300, [HUMAN]: 0 },
    cities: [city('capital', AI, { isCapital: true }), city('peace-city', AI)],
  });
  accepted.diplomacy.onPeaceProposed((proposal) => {
    const evaluation = accepted.peace.evaluatePeaceProposal(proposal);
    if (evaluation.accepted) accepted.peace.settleAcceptedPeace(proposal);
    else accepted.diplomacy.respondToPeace(proposal.fromNationId, proposal.toNationId, false);
  });
  accepted.run();
  assert.equal(accepted.diplomacy.getState(AI, HUMAN), 'PEACE');
  assert.ok(accepted.nations.getResources(HUMAN).gold > 0);

  const rejected = harness({ wars: [severe], gold: { [AI]: 10, [HUMAN]: 0 } });
  rejected.diplomacy.onPeaceProposed((proposal) => {
    const evaluation = rejected.peace.evaluatePeaceProposal(proposal);
    if (evaluation.accepted) rejected.peace.settleAcceptedPeace(proposal);
    else rejected.diplomacy.respondToPeace(proposal.fromNationId, proposal.toNationId, false);
  });
  rejected.run();
  assert.equal(rejected.diplomacy.getState(AI, HUMAN), 'WAR');
  assert.equal(rejected.nations.getResources(AI).gold, 10);
});

test('multiple wars are evaluated per opponent and only the losing front gets an offer', () => {
  const h = harness({
    wars: [severe, { ...favorable, opponentId: OTHER }],
    humanOpponentIds: [HUMAN, OTHER],
    gold: { [AI]: 1200 },
  });
  h.run();
  assert.ok(h.diplomacy.getPendingProposal(HUMAN));
  assert.equal(h.diplomacy.getPendingProposal(OTHER), null);
  assert.equal(h.diplomacy.getState(AI, OTHER), 'WAR');
});

test('identical state creates an identical peace-seeking decision and offer', () => {
  const build = () => {
    const h = harness({
      wars: [severe],
      gold: { [AI]: 900 },
      cities: [city('capital', AI, { isCapital: true }), city('city-a', AI)],
    });
    return h.peace.buildAIPeaceProposal(AI, HUMAN, 24);
  };
  assert.deepEqual(build(), build());
});

test('pending AI peace proposal and its rejection cooldown survive restore', () => {
  const h = harness({ wars: [severe], humanOpponentIds: [HUMAN], gold: { [AI]: 1000 } });
  h.run();
  const pending = h.diplomacy.getPendingPeaceProposals();
  const relations = h.diplomacy.getAllStates();

  const restored = new DiplomacyManager(h.turns, 7);
  for (const relation of relations) restored.restoreState(relation.keys[0], relation.keys[1], relation.relation);
  const resumed: PeaceProposal[] = [];
  restored.onPeaceProposed((proposal) => resumed.push(proposal));
  restored.restorePendingPeaceProposals(pending);
  assert.deepEqual(resumed, pending);
  assert.equal(restored.getRelation(AI, HUMAN).lastPeaceProposalTurn, 25);
  restored.respondToPeace(AI, HUMAN, false);
  assert.equal(restored.getState(AI, HUMAN), 'WAR');
});

test('AI to Human presentation opens the existing Audience and shows complete Accept/Reject terms', () => {
  const scene = fs.readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
  assert.match(scene, /leaderAudienceDialog\?\.open\(leader\.id\)/);
  assert.match(scene, /Hostilities end immediately/);
  assert.match(scene, /Peace Treaty:.*turns/);
  assert.match(scene, /confirmLabel: 'Accept',[\s\S]*?cancelLabel: 'Reject'/);
});
