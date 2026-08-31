/**
 * Strategic research demand: a genuinely blocked overseas expansion temporarily
 * prioritizes Sailing, then relaxes once Sailing is researched. Covers the
 * planner scoring, the ResearchSystem lifecycle wiring, and the overseas-system
 * eligibility predicate that produces the demand.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Nation } from '../src/entities/Nation.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import {
  pickBestAIResearchTechnology,
  SAILING_OVERSEAS_RESEARCH_DEMAND_BONUS,
  type ResearchDemand,
} from '../src/systems/ai/AIResearchPlanningSystem.ts';
import { AIOverseasExpansionSystem } from '../src/systems/AIOverseasExpansionSystem.ts';
import { getAILeaderEraStrategyById } from '../src/data/aiLeaderEraStrategies.ts';
import { getTechnologyById } from '../src/data/technologies.ts';
import { TileType } from '../src/types/map.ts';
import type { CityManager } from '../src/systems/CityManager.ts';
import type { MapData } from '../src/types/map.ts';
import type { WorldMarkerSystem } from '../src/systems/WorldMarkerSystem.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import type { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import type { MovementSystem } from '../src/systems/MovementSystem.ts';
import type { PathfindingSystem } from '../src/systems/PathfindingSystem.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import type { OverseasSettlementTarget } from '../src/types/ai/OverseasSettlementTarget.ts';

// nation_china → leader Qin Shi Huang → imperialInfrastructure (naval weight 0.65).
const CHINA = 'nation_china';
const SAILING_DEMAND: ResearchDemand = {
  techId: 'sailing',
  bonus: SAILING_OVERSEAS_RESEARCH_DEMAND_BONUS,
  reason: 'overseas expansion',
};

function stub<T>(overrides: Partial<T> = {}): T {
  return overrides as unknown as T;
}

// --- Planner scoring -------------------------------------------------------

test('planner: Sailing loses to a production tech normally but wins with demand', () => {
  const nation = new Nation({ id: CHINA, name: 'China', color: 0x224466 });
  const eraStrategy = getAILeaderEraStrategyById('imperialInfrastructure');
  const availableTechnologies = [getTechnologyById('sailing')!, getTechnologyById('mining')!];
  const base = { nation, availableTechnologies, currentTurn: 100, eraStrategy } as const;

  // Without demand, the naval-averse strategy prefers the production tech.
  const normal = pickBestAIResearchTechnology({ ...base });
  assert.equal(normal?.id, 'mining');

  // With demand, Sailing overcomes its −3.5 naval modifier and wins.
  const demanded = pickBestAIResearchTechnology({ ...base, researchDemands: [SAILING_DEMAND] });
  assert.equal(demanded?.id, 'sailing');
});

test('planner: demand for a tech missing from availableTechnologies has no effect (prereqs respected)', () => {
  const nation = new Nation({ id: CHINA, name: 'China', color: 0x224466 });
  const eraStrategy = getAILeaderEraStrategyById('imperialInfrastructure');
  // Sailing not offered (e.g. Pottery not researched): demand cannot conjure it.
  const availableTechnologies = [getTechnologyById('mining')!, getTechnologyById('archery')!];
  const picked = pickBestAIResearchTechnology({
    nation, availableTechnologies, currentTurn: 100, eraStrategy, researchDemands: [SAILING_DEMAND],
  });
  assert.equal(picked?.id, 'mining');
});

// --- ResearchSystem lifecycle ---------------------------------------------

function makeResearchSystem() {
  const nations = new NationManager();
  const cityManager = stub<CityManager>({ getCitiesByOwner: () => [] });
  const research = new ResearchSystem(nations, cityManager, () => 100);
  return { nations, research };
}

test('Case 1: a blocked overseas AI researches Sailing next; Case 2: demand clears afterwards', () => {
  const { nations, research } = makeResearchSystem();
  const china = new Nation({ id: CHINA, name: 'China', color: 0x224466, researchedTechIds: ['pottery'] });
  nations.addNation(china);

  // Provider mirrors the real semantics: demand Sailing only while it is missing.
  research.setResearchDemandProvider((nationId) =>
    nationId === CHINA && !nations.getNation(nationId)!.researchedTechIds.includes('sailing')
      ? [SAILING_DEMAND]
      : []);

  // Case 1 — the blocked nation picks Sailing despite the naval penalty.
  assert.equal(research.ensureResearchSelected(CHINA), true);
  assert.equal(china.currentResearchTechId, 'sailing');

  // Simulate completion, then Case 2 — with Sailing researched the demand is gone
  // and the AI returns to normal scoring (Sailing not re-picked; Optics not forced).
  china.researchedTechIds.push('sailing');
  china.currentResearchTechId = undefined;
  assert.equal(research.ensureResearchSelected(CHINA), true);
  assert.notEqual(china.currentResearchTechId, 'sailing');
  assert.notEqual(china.currentResearchTechId, 'optics');
});

test('baseline: without a demand provider the same nation does not pick Sailing', () => {
  const { nations, research } = makeResearchSystem();
  const china = new Nation({ id: CHINA, name: 'China', color: 0x224466, researchedTechIds: ['pottery'] });
  nations.addNation(china);
  assert.equal(research.ensureResearchSelected(CHINA), true);
  assert.notEqual(china.currentResearchTechId, 'sailing');
});

test('Case 5: human research is unchanged (definition-order pick, demand ignored)', () => {
  const { nations, research } = makeResearchSystem();
  const human = new Nation({ id: CHINA, name: 'China', color: 0x224466, isHuman: true, researchedTechIds: ['pottery'] });
  nations.addNation(human);
  // A provider that would demand Sailing must not affect a human.
  research.setResearchDemandProvider(() => [SAILING_DEMAND]);
  // Capture the definition-order first pick before selection mutates availability.
  const firstAvailable = research.getAvailableTechnologies(CHINA)[0]?.id;
  assert.equal(research.ensureResearchSelected(CHINA), true);
  assert.equal(human.currentResearchTechId, firstAvailable);
  assert.notEqual(human.currentResearchTechId, 'sailing');
});

// --- Overseas eligibility predicate ---------------------------------------

function makeOverseasSystem(nations: NationManager, cityManager: CityManager, mapData: MapData) {
  return new AIOverseasExpansionSystem(
    stub<WorldMarkerSystem>(),
    nations,
    cityManager,
    stub<TurnManager>({ getCurrentRound: () => 5 }),
    mapData,
    stub<ProductionSystem>({}),
    new UnitManager(4, 4),
    stub<MovementSystem>({}),
    stub<PathfindingSystem>({}),
    stub<IGridSystem>({}),
    undefined,
    (_nationId: string, message: string) => message,
  );
}

function coastalMap(): MapData {
  const tile = { type: TileType.Coast } as MapData['tiles'][number][number];
  return stub<MapData>({ tiles: [[tile]] });
}

function liveTarget(): OverseasSettlementTarget {
  return stub<OverseasSettlementTarget>({ markerId: 'm1', status: 'candidate', targetX: 5, targetY: 5 });
}

test('predicate Case 1: coastal nation with a live target and no Sailing demands it', () => {
  const nations = new NationManager();
  const nation = new Nation({ id: CHINA, name: 'China', color: 0x224466, researchedTechIds: ['pottery'] });
  nation.knownIslandTargets = [liveTarget()];
  nations.addNation(nation);
  const cityManager = stub<CityManager>({
    getCitiesByOwner: () => [{ ownerId: CHINA, ownedTileCoords: [{ x: 0, y: 0 }] } as never],
  });
  const system = makeOverseasSystem(nations, cityManager, coastalMap());
  assert.equal(system.demandsSailingResearch(CHINA), true);
});

test('predicate Case 2: once Sailing is researched there is no demand', () => {
  const nations = new NationManager();
  const nation = new Nation({ id: CHINA, name: 'China', color: 0x224466, researchedTechIds: ['pottery', 'sailing'] });
  nation.knownIslandTargets = [liveTarget()];
  nations.addNation(nation);
  const cityManager = stub<CityManager>({
    getCitiesByOwner: () => [{ ownerId: CHINA, ownedTileCoords: [{ x: 0, y: 0 }] } as never],
  });
  const system = makeOverseasSystem(nations, cityManager, coastalMap());
  assert.equal(system.demandsSailingResearch(CHINA), false);
});

test('predicate Case 3: no known target means no demand', () => {
  const nations = new NationManager();
  const nation = new Nation({ id: CHINA, name: 'China', color: 0x224466, researchedTechIds: ['pottery'] });
  nation.knownIslandTargets = [];
  nations.addNation(nation);
  const cityManager = stub<CityManager>({
    getCitiesByOwner: () => [{ ownerId: CHINA, ownedTileCoords: [{ x: 0, y: 0 }] } as never],
  });
  const system = makeOverseasSystem(nations, cityManager, coastalMap());
  assert.equal(system.demandsSailingResearch(CHINA), false);
});

test('predicate Case 3b: no coastal access means no demand', () => {
  const nations = new NationManager();
  const nation = new Nation({ id: CHINA, name: 'China', color: 0x224466, researchedTechIds: ['pottery'] });
  nation.knownIslandTargets = [liveTarget()];
  nations.addNation(nation);
  const landMap = stub<MapData>({ tiles: [[{ type: TileType.Grassland } as never]] });
  const cityManager = stub<CityManager>({
    getCitiesByOwner: () => [{ ownerId: CHINA, ownedTileCoords: [{ x: 0, y: 0 }] } as never],
  });
  const system = makeOverseasSystem(nations, cityManager, landMap);
  assert.equal(system.demandsSailingResearch(CHINA), false);
});

test('predicate Case 4: a leader city cap that blocks founding suppresses demand', () => {
  // nation_pirate → Mad Jack, maxPreferredCities = 1.
  const PIRATE = 'nation_pirate';
  const nations = new NationManager();
  const nation = new Nation({ id: PIRATE, name: 'Pirates', color: 0x111111, researchedTechIds: ['pottery'] });
  nation.knownIslandTargets = [liveTarget()];
  nations.addNation(nation);
  const cityManager = stub<CityManager>({
    getCitiesByOwner: () => [{ ownerId: PIRATE, ownedTileCoords: [{ x: 0, y: 0 }] } as never],
  });
  const system = makeOverseasSystem(nations, cityManager, coastalMap());
  assert.equal(system.demandsSailingResearch(PIRATE), false);
});
