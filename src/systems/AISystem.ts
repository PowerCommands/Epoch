import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import type { UnitType } from '../entities/UnitType';
import type { MapData, Tile } from '../types/map';
import type { GridCoord } from '../types/grid';
import type { Producible } from '../types/producible';
import { TileType } from '../types/map';
import { ALL_UNIT_TYPES, WARRIOR, ARCHER, SETTLER, SCOUT, SCOUT_BOAT, WORKER, WORK_BOAT } from '../data/units';
import { ALL_BUILDINGS, GRANARY, WORKSHOP, MARKET, getBuildingById } from '../data/buildings';
import { ALL_WONDERS } from '../data/wonders';
import { getNaturalResourceById, getNaturalResourceImprovementIdForTile } from '../data/naturalResources';
import type { BuildingType } from '../entities/Building';
import type { WonderType } from '../entities/Wonder';
import type { CityBuildings } from '../entities/CityBuildings';
import { UnitManager } from './UnitManager';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import { TurnManager } from './TurnManager';
import { getTileMovementCost, MovementSystem } from './MovementSystem';
import { CombatSystem } from './CombatSystem';
import { ProductionSystem } from './ProductionSystem';
import { canCityProduceUnit, cityHasWaterTile } from './ProductionRules';
import { FoundCitySystem } from './FoundCitySystem';
import { PathfindingSystem } from './PathfindingSystem';
import type { BuilderSystem } from './BuilderSystem';
import type { BuildingPlacementSystem } from './BuildingPlacementSystem';
import type { WonderSystem } from './WonderSystem';
import type { WonderPlacementSystem } from './WonderPlacementSystem';
import { calculateCityEconomy, getTileYield } from './CityEconomy';
import { CityTerritorySystem } from './CityTerritorySystem';
import { getAIStrategyById } from '../data/aiStrategies';
import type { AIStrategy } from '../types/aiStrategy';
import type { IGridSystem } from './grid/IGridSystem';
import { EMPTY_MODIFIERS } from '../types/modifiers';
import type { ResearchSystem } from './ResearchSystem';
import type { DiplomacyManager } from './DiplomacyManager';
import type { DiscoverySystem } from './DiscoverySystem';
import type { HappinessSystem } from './HappinessSystem';
import type { TradeDealSystem } from './TradeDealSystem';
import type { ResourceAccessSystem } from './ResourceAccessSystem';
import type { ExplorationMemorySystem } from './ExplorationMemorySystem';
import type { StrategicResourceCapacitySystem } from './StrategicResourceCapacitySystem';
import { getBehaviorWeights, getMaxTradeDealsPerTurn } from './AIStrategyService';
import { AIGoalSystem } from './ai/AIGoalSystem';
import { AIStrategySelector, type AIStrategyContext } from './ai/AIStrategySelector';
import {
  AIStrategyEvaluationSystem,
  getStrategyDisplayName,
} from './ai/AIStrategyEvaluationSystem';
import type { AIMilitaryThreatEvaluationSystem, ThreatLevel } from './ai/AIMilitaryThreatEvaluationSystem';
import {
  pickBestAIProductionCandidate,
  scoreAIProductionCandidate,
  type AIProductionCandidate,
} from './ai/AIProductionScoring';
import {
  applyGoalWeights,
  getCandidateGoalCategory,
  getProductionWeights,
} from './ai/utils/AIProductionGoalWeights';
import { hasGoalOfType } from './ai/utils/AIExpansionUtils';
import { getMilitaryIntent } from './ai/utils/AIMilitaryUtils';
import { scoreCombatTarget, type AICombatContext } from './ai/AICombatScoring';
import {
  pickBestMovementCandidate,
  type AIMovementCandidate,
} from './ai/AIMovementScoring';
import { CITY_BASE_HEALTH } from '../data/cities';
import { getLeaderByNationId, getLeaderPersonalityByNationId } from '../data/leaders';
import { resolveLeaderEraStrategy } from '../data/aiLeaderEraStrategies';
import type { AILeaderEraStrategy } from '../types/aiLeaderEraStrategy';
import type { EraSystem } from './EraSystem';
import type { Era } from '../data/technologies';
import type { AILogFormatter } from './ai/AILogFormatter';
import {
  getSharedAISettlementMemorySystem,
  type AISettlementMemorySystem,
  type SettlementCandidate,
} from './ai/AISettlementMemorySystem';
import {
  getSharedAISeaResourceMemorySystem,
  type AISeaResourceMemorySystem,
  type SeaResourceCandidate,
} from './ai/AISeaResourceMemorySystem';
import { CityFocusSystem } from './ai/CityFocusSystem';

// Friendly-support radius is not yet exposed via AIStrategy; preserved here
// so baseline behavior matches the pre-refactor profile.
const FRIENDLY_SUPPORT_DISTANCE = 2;
const NEAR_OWN_CITY_DISTANCE = 3;
// Distance from a discovered enemy city where at-peace military units stage.
// Tight enough to form a visible border presence, loose enough to stay one
// step outside a 1-radius city's owned tiles.
const MILITARY_STAGING_DISTANCE = 2;
// Maximum extra outward steps when the geometric staging tile lands inside
// enemy territory or off-map. Keeps the search bounded and deterministic.
const MILITARY_STAGING_OUTWARD_RETRY = 3;
// AI nations below this city count are still in Foundation Phase: scouts,
// settlers, and basic defense first; no offensive staging behavior yet.
const FOUNDATION_PHASE_CITY_COUNT = 3;
// Settler production is suppressed in Foundation Phase if happiness drops
// below this floor — the nation needs to recover before it can absorb
// another city.
const FOUNDATION_HAPPINESS_FLOOR = -2;
const PEACE_UNITS_BEFORE_INFRASTRUCTURE = 2;
const WAR_UNITS_BEFORE_INFRASTRUCTURE = 3;
const WARTIME_INFRASTRUCTURE_BUILDING_IDS = [
  'walls',
  'barracks',
  'castle',
  'armory',
  'military_academy',
  'arsenal',
  'military_base',
] as const;
type AIPhase = 'FOUNDATION' | 'STRATEGY';
type ProductionRhythmPhase = 'peace' | 'war';
const fallbackFormatLog: AILogFormatter = (nationId, message) => `[r?] ${nationId} (era: ancient, gold: 0, happiness: 0) ${message}`;

// Structural type guard — Unit/City are imported as types, so `instanceof`
// is unavailable. `unitType` is unique to Unit.
function isUnit(target: Unit | City): target is Unit {
  return (target as Unit).unitType !== undefined;
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

interface CoastalDefenseTargets {
  readonly zone: Set<string>;          // tile keys for the coastal patrol zone
  readonly patrolTiles: readonly Tile[]; // water tiles inside the zone
  readonly resourceTiles: readonly Tile[]; // patrol tiles that hold a resource
}

interface EnemyCoastalTargets {
  readonly zone: Set<string>;                  // tile keys across all war enemies
  readonly zoneTiles: readonly Tile[];          // patrol-pressure water tiles
  readonly navalUnits: readonly Unit[];         // priority 1: enemy ships in zone
  readonly coastAdjacentUnits: readonly Unit[]; // priority 3: enemy land near coast
}

interface NavalPatrolContext {
  readonly targets: CoastalDefenseTargets;
  readonly enemyTargets: EnemyCoastalTargets;
  readonly claimedNavalTiles: Set<string>;
  readonly ownZoneHasEnemy: boolean;
}

interface MilitaryStagingTarget {
  readonly enemyCity: GridCoord;   // discovered enemy capital/city we're staging against
  readonly stagingTile: GridCoord; // shared rally tile, MILITARY_STAGING_DISTANCE from enemyCity
}

function maxThreatLevel(a: ThreatLevel, b: ThreatLevel): ThreatLevel {
  if (threatRank(b) > threatRank(a)) return b;
  return a;
}

function threatRank(level: ThreatLevel): number {
  switch (level) {
    case 'none':
      return 0;
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
  }
}

const MILITARY_OPTIONS = ALL_UNIT_TYPES.filter((unitType) => (
  unitType.baseStrength > 0
));

function luxuryRank(resourceId: string): number {
  return getNaturalResourceById(resourceId)?.category === 'luxury' ? 1 : 0;
}

function resolveLuxuryValueMultiplier(netHappiness: number | undefined): number {
  if (netHappiness === undefined) return 1.0;
  if (netHappiness <= AI_HAPPINESS_CRITICAL) return LUXURY_VALUE_MULTIPLIER_CRITICAL;
  if (netHappiness <= AI_HAPPINESS_LOW) return LUXURY_VALUE_MULTIPLIER_LOW;
  return 1.0;
}

// Base scores reflect how acute the underlying need is. Strategy weights then
// reshape the final ordering, but the raw signal always comes from city state.
const SCORE_ACUTE_DEFENDER = 100;
const SCORE_SETTLER = 80;
const SCORE_MILITARY = 70;
const SCORE_FOOD_BUILDING = 65;
const SCORE_PRODUCTION_BUILDING = 60;
const SCORE_GOLD_BUILDING = 55;
const SCORE_CULTURE_BUILDING = 75;
const SCORE_WORLD_WONDER = 68;
const SCORE_FALLBACK = 25;
const SCORE_NAVAL = 40;
const SCORE_WORK_BOAT = 42;
const SCORE_WORKER = 62;
const LOW_GOLD_PER_TURN = 0;
const TILE_PURCHASE_DEFAULT_RESERVE = 100;
const TILE_PURCHASE_DEFAULT_MIN_SCORE = 45;
// Foundation Phase production tuning. Building base scores get a flat boost
// so they outscore the regular military candidate (70) when food/production/
// gold thresholds fire — a Foundation city with a real building need always
// beats fallback-warriors. Happiness building threshold is loosened so
// nations build colosseums proactively rather than only when collapsing.
const SCORE_FOUNDATION_BUILDING_BOOST = 20;
const FOUNDATION_HAPPINESS_BUILDING_THRESHOLD = 1;

// Coastal site evaluation. Combined with -settlerDistance so that the AI still
// favors closer founding sites but breaks toward the sea when the bonus
// outweighs a few extra tiles of travel.
const COASTAL_SITE_BONUS = 3;
const COASTAL_TILE_BONUS = 1;
const WATER_RESOURCE_BONUS = 4;

// Naval patrol behavior. Distance is subtracted from the score directly so
// units favor close targets; resource bonuses can pull them ~3 tiles out.
const NAVAL_COASTAL_ZONE_RADIUS = 2;
const NAVAL_ENEMY_NEAR_CITY_RADIUS = 3;
const NAVAL_PATROL_RESOURCE_BONUS = 3;
const MIN_KNOWN_SEA_RESOURCE_TARGETS = 3;
const DESIRED_EARLY_NAVAL_RECON_COUNT = 1;
const MAX_EARLY_WORK_BOATS_COASTAL_FOUNDATION = 2;

// Naval offensive behavior. Cap on how far a ship will travel to reach an
// offensive target so it doesn't wander deep into open ocean. Targets must
// already be in/near an enemy coastal zone, so this primarily limits per-unit
// engagement range from current position.
const NAVAL_MAX_OFFENSIVE_REACH = 8;

// Happiness thresholds drive both production prioritization and trade
// evaluation. Below LOW the AI starts preferring happiness buildings and
// values luxury trades higher; below CRITICAL it overrides production
// entirely and doubles the luxury value.
const AI_HAPPINESS_LOW = -5;
const AI_HAPPINESS_CRITICAL = -10;

// Boosted score for happiness building when at LOW (not CRITICAL): +50%
// over a normal food/production building. Stays under SCORE_ACUTE_DEFENDER
// so a city that lacks a defender still defends first.
const SCORE_HAPPINESS_BUILDING_LOW = SCORE_FOOD_BUILDING * 1.5;

const LUXURY_VALUE_MULTIPLIER_LOW = 1.5;
const LUXURY_VALUE_MULTIPLIER_CRITICAL = 2.0;

function describeProducible(item: Producible): string {
  switch (item.kind) {
    case 'unit': return `unit:${item.unitType.name}`;
    case 'building': return `building:${item.buildingType.name}`;
    case 'wonder': return `wonder:${item.wonderType.name}`;
    case 'corporation': return `corporation:${item.corporationType.name}`;
  }
}

/**
 * AISystem kör grundläggande AI för icke-mänskliga nationer.
 *
 * Prioritetsordning per tur:
 * 0. Settlers — found the first city immediately, then expand toward spaced sites
 * 1. Strid — attackera angränsande fiender (skip 0-strength units)
 * 2. Rörelse — gå mot närmaste fiendestad
 * 3. Produktion — respektera 2-warrior cap, settler-villkor
 */
export class AISystem {
  private readonly unitManager: UnitManager;
  private readonly cityManager: CityManager;
  private readonly nationManager: NationManager;
  private readonly turnManager: TurnManager;
  private readonly movementSystem: MovementSystem;
  private readonly pathfindingSystem: PathfindingSystem;
  private readonly combatSystem: CombatSystem;
  private readonly productionSystem: ProductionSystem;
  private readonly foundCitySystem: FoundCitySystem;
  private readonly settlementMemorySystem: AISettlementMemorySystem;
  private readonly seaResourceMemorySystem: AISeaResourceMemorySystem;
  private readonly mapData: MapData;
  private readonly workBoatTargetsByUnit = new Map<string, string>();
  private readonly workBoatMovementLogKeyByUnit = new Map<string, string>();
  private readonly coastalSpacingLoggedBySettler = new Set<string>();
  private readonly strategySelector = new AIStrategySelector();
  private readonly strategyEvaluationSystem = new AIStrategyEvaluationSystem();
  // Pass-1 evaluation rollout: only Mongolia logs the result for now.
  // Add more ids as the evaluation pass is validated against other leaders.
  private readonly strategyEvaluationNationIds = new Set<string>(['nation_mongolia']);

  // Last AI phase logged per nation. Phase itself is derived live in
  // getAIPhase; this map only deduplicates the transition log line.
  private readonly aiPhaseByNation = new Map<string, AIPhase>();

  // Last era-strategy id logged per nation, so the transition log fires once
  // per era change instead of every turn.
  private readonly loggedEraStrategyByNation = new Map<string, string>();

  // Per-nation military staging targets: one shared staging tile per met
  // enemy nation. All this nation's military units gather toward the SAME
  // staging tile per enemy so they form a visible border presence rather
  // than spreading. Cached per round so collectMovementChoices doesn't
  // recompute it for every unit.
  private militaryStagingCacheRound = -1;
  private readonly militaryStagingByNation = new Map<string, Map<string, MilitaryStagingTarget>>();
  // Per-nation set of "enemyId@x,y" descriptors already logged, so the
  // "staging near enemy city" line is emitted once per (nation, target) pair.
  private readonly militaryStagingLoggedKeys = new Map<string, Set<string>>();
  // Per-nation last round we logged the "moving to staging position" line,
  // so the per-unit movement logs collapse to one per nation per round.
  private readonly militaryAdvanceLoggedRound = new Map<string, number>();
  // Per-nation last round we logged the "holding position at staging
  // distance" line, also one-per-round.
  private readonly militaryHoldingLoggedRound = new Map<string, number>();
  private readonly defensiveModeLoggedRound = new Map<string, number>();
  private readonly settlerHappinessDelayLoggedRound = new Map<string, number>();
  private readonly aiGoalSystem = new AIGoalSystem((nation) => {
    const resources = this.nationManager.getResources(nation.id);
    return {
      cityCount: this.cityManager.getCitiesByOwner(nation.id).length,
      gold: resources.gold,
      goldPerTurn: resources.goldPerTurn,
      isAtWar: this.isAtWarWithAnyone(nation.id),
      happiness: this.happinessSystem?.getNetHappiness(nation.id) ?? 0,
    };
  });
  private readonly cityFocusSystem: CityFocusSystem;

  constructor(
    unitManager: UnitManager,
    cityManager: CityManager,
    nationManager: NationManager,
    turnManager: TurnManager,
    movementSystem: MovementSystem,
    pathfindingSystem: PathfindingSystem,
    combatSystem: CombatSystem,
    productionSystem: ProductionSystem,
    foundCitySystem: FoundCitySystem,
    mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly cityTerritorySystem: CityTerritorySystem = new CityTerritorySystem(undefined, gridSystem),
    private readonly researchSystem?: ResearchSystem,
    private readonly diplomacyManager?: DiplomacyManager,
    private readonly happinessSystem?: HappinessSystem,
    private readonly threatEvaluationSystem?: AIMilitaryThreatEvaluationSystem,
    private readonly discoverySystem?: DiscoverySystem,
    private readonly tradeDealSystem?: TradeDealSystem,
    private readonly resourceAccessSystem?: ResourceAccessSystem,
    private readonly explorationMemorySystem?: ExplorationMemorySystem,
    private readonly strategicResourceCapacitySystem?: StrategicResourceCapacitySystem,
    private readonly formatLog: AILogFormatter = fallbackFormatLog,
    private readonly eraSystem?: EraSystem,
    settlementMemorySystem?: AISettlementMemorySystem,
    seaResourceMemorySystem?: AISeaResourceMemorySystem,
    private readonly builderSystem?: BuilderSystem,
    private readonly wonderSystem?: WonderSystem,
    private readonly wonderPlacementSystem?: WonderPlacementSystem,
    private readonly buildingPlacementSystem?: BuildingPlacementSystem,
    private readonly logStrategicEvent?: (nationId: string, message: string) => void,
  ) {
    this.unitManager = unitManager;
    this.cityManager = cityManager;
    this.nationManager = nationManager;
    this.turnManager = turnManager;
    this.movementSystem = movementSystem;
    this.pathfindingSystem = pathfindingSystem;
    this.combatSystem = combatSystem;
    this.productionSystem = productionSystem;
    this.foundCitySystem = foundCitySystem;
    this.settlementMemorySystem = settlementMemorySystem ?? getSharedAISettlementMemorySystem(mapData);
    this.seaResourceMemorySystem = seaResourceMemorySystem ?? getSharedAISeaResourceMemorySystem(mapData);
    this.mapData = mapData;
    this.cityFocusSystem = new CityFocusSystem(
      this.cityManager,
      this.nationManager,
      this.mapData,
      this.gridSystem,
      this.formatLog,
      (nationId) => this.getActiveEraStrategy(nationId),
      this.logStrategicEvent,
    );
    this.foundCitySystem.onCityFounded((city) => this.cityFocusSystem.updateFocusForCity(city));
  }

  isHuman(nationId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    return nation?.isHuman ?? false;
  }

  private getNationEra(nationId: string): Era {
    return this.eraSystem?.getNationEra(nationId) ?? 'ancient';
  }

  /**
   * Resolve the active era strategy for the leader of `nationId` and log a
   * one-shot transition line when the resolved strategy id changes. Always
   * returns a usable strategy; falls back to balancedGrowth via the resolver.
   */
  private getActiveEraStrategy(nationId: string): AILeaderEraStrategy {
    const leaderId = getLeaderByNationId(nationId)?.id;
    const era = this.getNationEra(nationId);
    const strategy = resolveLeaderEraStrategy(leaderId, era);

    const lastLogged = this.loggedEraStrategyByNation.get(nationId);
    const tag = `${strategy.id}@${era}`;
    if (lastLogged !== tag) {
      this.loggedEraStrategyByNation.set(nationId, tag);
      console.log(
        this.formatLog(nationId, `active AI strategy: ${strategy.name} (${era})`),
      );
    }
    return strategy;
  }

  runTurn(nationId: string): void {
    this.cityFocusSystem.updateFocusForNation(nationId);
    this.updateStrategyForNation(nationId);
    this.evaluateStrategyForNation(nationId);
    this.markVisibleTilesForNation(nationId);

    const nation = this.nationManager.getNation(nationId);
    if (nation) {
      this.aiGoalSystem.update(nation);
      console.log(
        this.formatLog(nationId, `AI goal selected: ${(nation.aiGoals ?? []).map((g) => `${g.type}(${g.priority.toFixed(2)})`).join(', ')}`),
      );
    }

    this.runSettlers(nationId);
    this.runCombat(nationId);
    this.runMovement(nationId);
    this.runTilePurchases(nationId);
    this.runProduction(nationId);
    this.runDiplomacyForNation(nationId);
    this.runTradeForNation(nationId);

    if (nation?.aiGoals && nation.aiGoals.length > 0) {
      console.log(
        this.formatLog(nationId, `AI goals: ${nation.aiGoals.map((g) => `${g.type}(${g.remainingTurns})`).join(', ')}`),
      );
    }
  }

  // ─── Exploration memory ──────────────────────────────────────────────────────

  private markVisibleTilesForNation(nationId: string): void {
    if (!this.explorationMemorySystem) return;
    const turn = this.turnManager.getCurrentRound();
    const visible = new Map<string, Tile>();

    const recordCenterAndAdjacent = (centerX: number, centerY: number): void => {
      const center = this.mapData.tiles[centerY]?.[centerX];
      if (center) visible.set(`${center.x},${center.y}`, center);
      for (const adj of this.gridSystem.getAdjacentCoords({ x: centerX, y: centerY })) {
        const tile = this.mapData.tiles[adj.y]?.[adj.x];
        if (tile) visible.set(`${tile.x},${tile.y}`, tile);
      }
    };

    for (const unit of this.unitManager.getUnitsByOwner(nationId)) {
      recordCenterAndAdjacent(unit.tileX, unit.tileY);
    }
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      recordCenterAndAdjacent(city.tileX, city.tileY);
    }

    this.explorationMemorySystem.markVisibleTiles(nationId, [...visible.values()], turn);
  }

  // ─── Tile Purchases ─────────────────────────────────────────────────────────

  private runTilePurchases(nationId: string): void {
    const eraStrategy = this.getActiveEraStrategy(nationId);
    if (!eraStrategy.tilePurchase) return;

    const currentTurn = this.turnManager.getCurrentRound();
    const resources = this.nationManager.getResources(nationId);
    const minReserve = eraStrategy.tilePurchase.minGoldReserve ?? TILE_PURCHASE_DEFAULT_RESERVE;
    const minScore = eraStrategy.tilePurchase.minScore ?? TILE_PURCHASE_DEFAULT_MIN_SCORE;

    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      if (city.lastTilePurchaseTurn === currentTurn) continue;

      const cost = this.cityTerritorySystem.getClaimCost(city, this.mapData);
      if (resources.gold < Math.max(cost + minReserve, cost + 75)) continue;

      const target = this.pickBestTilePurchaseTarget(city, minScore);
      if (!target) continue;

      resources.gold -= cost;
      const claimed = this.cityTerritorySystem.claimTileForCity(city, target.tile, this.mapData);
      if (!claimed) {
        resources.gold += cost;
        continue;
      }

      city.lastTilePurchaseTurn = currentTurn;
      console.log(
        this.formatLog(
          nationId,
          `${this.nationManager.getNation(nationId)?.name ?? 'AI'} purchased tile (${target.tile.x},${target.tile.y}) for ${city.name}; reason: ${target.reason}`,
        ),
      );
    }
  }

  private pickBestTilePurchaseTarget(
    city: City,
    minScore: number,
  ): { tile: Tile; score: number; reason: string } | null {
    const claimable = new Set(
      this.cityTerritorySystem.getClaimableTiles(city, this.mapData).map((coord) => tileKey(coord.x, coord.y)),
    );
    let best: { tile: Tile; score: number; reason: string } | null = null;

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (!claimable.has(tileKey(tile.x, tile.y))) continue;
        if (tile.ownerId !== undefined) continue;

        const score = this.scoreTilePurchaseTarget(city, tile);
        if (score.score < minScore) continue;
        if (!best || score.score > best.score) {
          best = { tile, ...score };
        }
      }
    }

    return best;
  }

  private scoreTilePurchaseTarget(city: City, tile: Tile): { score: number; reason: string } {
    const yieldValue = getTileYield(tile);
    const resource = tile.resourceId ? getNaturalResourceById(tile.resourceId) : undefined;
    const distance = this.cityTerritorySystem.getExpansionRingDistance(city, tile);
    let score = 0;
    const reasons: string[] = [];

    if (resource) {
      score += 50;
      reasons.push('resource');
      if (resource.category === 'luxury') {
        score += 70;
        reasons.push('luxury');
      }
      if (tile.type === TileType.Coast || tile.type === TileType.Ocean) {
        score += 25;
        reasons.push('water resource');
      }
    }

    score += yieldValue.food * 10;
    score += yieldValue.production * 10;
    score += yieldValue.gold * 4;
    score += (yieldValue.happiness ?? 0) * 20;
    if (yieldValue.food > 0) reasons.push('food');
    if (yieldValue.production > 0) reasons.push('production');
    if (yieldValue.gold > 0) reasons.push('gold');
    if ((yieldValue.happiness ?? 0) > 0) reasons.push('happiness');
    if (tile.type === TileType.Desert || tile.type === TileType.Ice) score -= 40;
    score -= Math.max(0, distance - 2) * 4;

    return {
      score,
      reason: reasons.length > 0 ? reasons.slice(0, 3).join('/') : 'yield',
    };
  }

  // ─── Diplomacy ───────────────────────────────────────────────────────────────

  private runDiplomacyForNation(nationId: string): void {
    if (!this.diplomacyManager) return;
    const weights = getBehaviorWeights(this.nationManager.getNation(nationId)?.aiStrategyId);
    if (weights.diplomacy <= 0) {
      console.debug(this.formatLog(nationId, 'AI skipped diplomacy because diplomacy weight is 0.'));
      return;
    }
    const dm = this.diplomacyManager;
    const validationContext = {
      haveMet: (a: string, b: string): boolean => this.discoverySystem?.hasMet(a, b) ?? true,
      hasTechnology: (target: string, techId: string): boolean =>
        this.researchSystem?.isResearched(target, techId) ?? false,
    };

    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.discoverySystem && !this.discoverySystem.hasMet(nationId, other.id)) continue;
      if (dm.getState(nationId, other.id) === 'WAR') continue;

      if (!dm.hasEmbassy(nationId, other.id)) {
        const embassyCheck = dm.canEstablishEmbassy(nationId, other.id, validationContext);
        if (embassyCheck.ok && dm.establishEmbassy(nationId, other.id)) {
          const target = other.name;
          console.debug(this.formatLog(nationId, `AI established embassy with ${target}`));
        }
      }

      if (!dm.hasTradeRelations(nationId, other.id)) {
        const tradeCheck = dm.canEstablishTradeRelations(nationId, other.id, validationContext);
        if (tradeCheck.ok && dm.establishTradeRelations(nationId, other.id)) {
          const target = other.name;
          console.debug(this.formatLog(nationId, `AI established trade relations with ${target}`));
        }
      }
    }
  }

  // ─── Trade ───────────────────────────────────────────────────────────────────

  private runTradeForNation(nationId: string): void {
    if (!this.diplomacyManager || !this.tradeDealSystem || !this.resourceAccessSystem) return;

    const weights = getBehaviorWeights(this.nationManager.getNation(nationId)?.aiStrategyId);
    const maxDeals = getMaxTradeDealsPerTurn(weights.trade);
    if (maxDeals <= 0) return;

    const dealTurns = 10;
    const baseGoldPerTurn = 5;
    if (this.nationManager.getResources(nationId).gold < baseGoldPerTurn) return;

    const happiness = this.happinessSystem?.getNationState(nationId);
    const luxuryValueMultiplier = resolveLuxuryValueMultiplier(happiness?.netHappiness);

    const available = new Set(this.resourceAccessSystem.getAvailableResources(nationId));
    let dealsCreated = 0;

    if (luxuryValueMultiplier > 1.0) {
      console.debug(
        this.formatLog(nationId, `AI increasing luxury value (x${luxuryValueMultiplier}) due to happiness ${happiness?.netHappiness} (state: ${happiness?.state}).`),
      );
    }

    outer: for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.diplomacyManager.getState(nationId, other.id) === 'WAR') continue;
      if (!this.diplomacyManager.hasTradeRelations(nationId, other.id)) continue;

      const ownedResources = this.resourceAccessSystem.getOwnedNaturalResources(other.id);
      const orderedResources = luxuryValueMultiplier > 1.0
        ? [...ownedResources].sort((a, b) => luxuryRank(b) - luxuryRank(a))
        : ownedResources;

      for (const resourceId of orderedResources) {
        if (available.has(resourceId)) continue;
        if (this.resourceAccessSystem.hasImportedResource(nationId, resourceId)) continue;
        const isLuxury = getNaturalResourceById(resourceId)?.category === 'luxury';
        const offerGoldPerTurn = isLuxury
          ? Math.round(baseGoldPerTurn * luxuryValueMultiplier)
          : baseGoldPerTurn;
        if (this.nationManager.getResources(nationId).gold < offerGoldPerTurn * (dealsCreated + 1)) break outer;

        const result = this.tradeDealSystem.createDeal({
          sellerNationId: other.id,
          buyerNationId: nationId,
          resourceId,
          turns: dealTurns,
          goldPerTurn: offerGoldPerTurn,
        });
        if (!result.ok) continue;

        console.debug(
          this.formatLog(nationId, `AI bought ${resourceId} from ${other.name} (${dealTurns} turns, ${offerGoldPerTurn} gold/turn)`),
        );
        dealsCreated++;
        if (dealsCreated >= maxDeals) break outer;
      }
    }

    if (dealsCreated > 1) {
      console.debug(this.formatLog(nationId, `AI created ${dealsCreated} trade deals due to trade weight ${weights.trade}.`));
    }
  }

  // ─── Strategy selection ──────────────────────────────────────────────────────

  private updateStrategyForNation(nationId: string): void {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || nation.isHuman) return; // humans never get auto-selected

    const context = this.buildStrategyContext(nationId);
    const nextId = this.strategySelector.selectStrategy(context);
    if (nation.aiStrategyId !== nextId) {
      nation.previousAiStrategyId = nation.aiStrategyId;
      nation.aiStrategyId = nextId;
      nation.aiStrategyStartedTurn = context.currentTurn;
      console.log(
        this.formatLog(nationId, `strategic focus: ${getStrategyDisplayName(nextId)}.`),
      );
    }
  }

  // Pass-1 strategy evaluation: scores primary + secondary slots from the
  // leader personality and stores them on the nation. Does not yet drive
  // production, diplomacy, research, culture, or military behavior.
  // Restricted to a small allowlist (currently Mongolia only) so we can
  // validate the scoring against intended leader character before rolling out.
  private evaluateStrategyForNation(nationId: string): void {
    if (!this.strategyEvaluationNationIds.has(nationId)) return;
    const nation = this.nationManager.getNation(nationId);
    if (!nation || nation.isHuman) return;

    const result = this.strategyEvaluationSystem.evaluate({
      leaderPersonality: getLeaderPersonalityByNationId(nationId),
    });
    nation.aiPrimaryStrategyId = result.primaryStrategyId;
    nation.aiSecondaryStrategyId = result.secondaryStrategyId;

    const primary = getStrategyDisplayName(result.primaryStrategyId);
    const secondary = getStrategyDisplayName(result.secondaryStrategyId);
    console.log(this.formatLog(nationId, `AI strategy: ${primary} / ${secondary}`));
  }

  private buildStrategyContext(nationId: string): AIStrategyContext {
    const nation = this.nationManager.getNation(nationId);
    const cityCount = this.cityManager.getCitiesByOwner(nationId).length;
    const unitCount = this.unitManager.getUnitsByOwner(nationId).length;
    const resources = this.nationManager.getResources(nationId);

    const highestThreatLevel = this.getHighestThreatLevel(nationId);
    return {
      nationId,
      currentTurn: this.turnManager.getCurrentRound(),
      currentStrategyId: nation?.aiStrategyId ?? this.getStrategy(nationId).id,
      strategyStartedTurn: nation?.aiStrategyStartedTurn ?? 0,
      nationalAgendaId: nation?.aiNationalAgendaId ?? 'balanced',
      leaderPersonality: getLeaderPersonalityByNationId(nationId),
      cityCount,
      unitCount,
      gold: resources.gold,
      goldPerTurn: resources.goldPerTurn,
      netHappiness: this.happinessSystem?.getNetHappiness(nationId) ?? 0,
      atWar: this.isAtWarWithAnyone(nationId),
      enemyMilitaryNearby: highestThreatLevel !== 'none',
      highestThreatLevel,
    };
  }

  private getHighestThreatLevel(nationId: string): ThreatLevel {
    if (!this.threatEvaluationSystem) return 'none';
    let highest: ThreatLevel = 'none';
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      highest = maxThreatLevel(highest, this.threatEvaluationSystem.getThreatLevel(nationId, other.id));
      if (highest === 'high') return highest;
    }
    return highest;
  }

  private isAtWarWithAnyone(nationId: string): boolean {
    if (!this.diplomacyManager) return false;
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.diplomacyManager.getState(nationId, other.id) === 'WAR') return true;
    }
    return false;
  }

  private isNationAtWar(nationId: string): boolean {
    return this.isAtWarWithAnyone(nationId);
  }

  // ─── Foundation Phase ────────────────────────────────────────────────────────
  // Early-game gate: until a nation has FOUNDATION_PHASE_CITY_COUNT cities it
  // builds scouts + settlers and avoids offensive staging. Past that, normal
  // strategy logic resumes. Derived live so any city founded mid-turn is
  // reflected immediately by all callers.

  private getAIPhase(nationId: string): AIPhase {
    const cityCount = this.cityManager.getCitiesByOwner(nationId).length;
    return cityCount < FOUNDATION_PHASE_CITY_COUNT ? 'FOUNDATION' : 'STRATEGY';
  }

  private updateAndLogAIPhase(nationId: string): AIPhase {
    const next = this.getAIPhase(nationId);
    if (this.aiPhaseByNation.get(nationId) === next) return next;
    this.aiPhaseByNation.set(nationId, next);
    const tail = next === 'FOUNDATION' ? 'establishing base' : 'normal AI behavior';
    console.log(this.formatLog(nationId, `phase: ${next} - ${tail}`));
    return next;
  }

  // Settler production is suppressed in Foundation Phase if happiness has
  // dropped below the recovery floor. Outside Foundation Phase the normal
  // strategy logic still gates settlers via desiredCityCount, etc.
  private isSettlerProductionBlockedByHappiness(nationId: string): boolean {
    if (this.getAIPhase(nationId) !== 'FOUNDATION') return false;
    const netHappiness = this.happinessSystem?.getNetHappiness(nationId) ?? 0;
    return netHappiness < FOUNDATION_HAPPINESS_FLOOR;
  }

  // Single gate for offensive military staging behavior: never while at war
  // (combat candidates dominate then) and never in Foundation Phase
  // (military stays near territory until the base is established).
  private shouldStageMilitary(nationId: string): boolean {
    if (this.isAtWarWithAnyone(nationId)) return false;
    if (this.getAIPhase(nationId) === 'FOUNDATION') return false;
    return true;
  }

  // ─── Military staging targets ────────────────────────────────────────────────
  // For each met enemy nation, pick one enemy city to stage against and one
  // shared rally tile MILITARY_STAGING_DISTANCE outside it. All this nation's
  // military units use the SAME staging tile per enemy so they form a visible
  // border presence rather than spreading. Combat still requires a war
  // declaration; the staging tile is placed outside enemy territory, so units
  // do not cross enemy borders while at peace.

  private getMilitaryStagingByEnemy(nationId: string): Map<string, MilitaryStagingTarget> {
    const round = this.turnManager.getCurrentRound();
    if (round !== this.militaryStagingCacheRound) {
      this.militaryStagingByNation.clear();
      this.militaryStagingCacheRound = round;
    }
    const cached = this.militaryStagingByNation.get(nationId);
    if (cached) return cached;

    const result = new Map<string, MilitaryStagingTarget>();
    const ownCities = this.cityManager.getCitiesByOwner(nationId);
    if (ownCities.length === 0) {
      this.militaryStagingByNation.set(nationId, result);
      return result;
    }

    // First own city is a stable anchor across the run, so the chosen enemy
    // city per nation and the line we lerp along are both deterministic.
    const anchor: GridCoord = { x: ownCities[0].tileX, y: ownCities[0].tileY };

    for (const enemy of this.nationManager.getAllNations()) {
      if (enemy.id === nationId) continue;
      if (this.discoverySystem && !this.discoverySystem.hasMet(nationId, enemy.id)) continue;

      const enemyCities = this.cityManager.getCitiesByOwner(enemy.id);
      if (enemyCities.length === 0) continue;

      let bestCity = enemyCities[0];
      let bestDist = this.gridSystem.getDistance(anchor, { x: bestCity.tileX, y: bestCity.tileY });
      for (const city of enemyCities) {
        const dist = this.gridSystem.getDistance(anchor, { x: city.tileX, y: city.tileY });
        if (dist < bestDist) {
          bestCity = city;
          bestDist = dist;
        }
      }
      const enemyCityCoord: GridCoord = { x: bestCity.tileX, y: bestCity.tileY };

      const enemyTerritory = this.collectEnemyTerritory(enemy.id);
      const stagingTile = this.findStagingTile(enemyCityCoord, anchor, enemyTerritory);
      if (!stagingTile) continue;

      result.set(enemy.id, { enemyCity: enemyCityCoord, stagingTile });
      this.logStagingTargetOnce(nationId, enemy.id, enemyCityCoord);
    }

    this.militaryStagingByNation.set(nationId, result);
    return result;
  }

  // Walks the line from enemy city back toward the anchor and returns the
  // first tile that is on-map and outside enemy territory, starting at
  // MILITARY_STAGING_DISTANCE and stepping outward up to the retry cap.
  private findStagingTile(
    enemyCity: GridCoord,
    anchor: GridCoord,
    enemyTerritory: Set<string>,
  ): GridCoord | null {
    const dist = this.gridSystem.getDistance(enemyCity, anchor);
    if (dist === 0) return null;

    for (let extra = 0; extra <= MILITARY_STAGING_OUTWARD_RETRY; extra++) {
      const d = MILITARY_STAGING_DISTANCE + extra;
      if (d > dist) return null;
      const t = d / dist;
      const sx = Math.round(enemyCity.x + (anchor.x - enemyCity.x) * t);
      const sy = Math.round(enemyCity.y + (anchor.y - enemyCity.y) * t);
      if (this.mapData.tiles[sy]?.[sx] === undefined) continue;
      if (enemyTerritory.has(`${sx},${sy}`)) continue;
      return { x: sx, y: sy };
    }
    return null;
  }

  private collectEnemyTerritory(enemyNationId: string): Set<string> {
    const set = new Set<string>();
    for (const city of this.cityManager.getCitiesByOwner(enemyNationId)) {
      for (const c of city.ownedTileCoords) set.add(`${c.x},${c.y}`);
    }
    return set;
  }

  private isWithinAnyStagingDistance(unitPos: GridCoord, nationId: string): boolean {
    const staging = this.getMilitaryStagingByEnemy(nationId);
    for (const entry of staging.values()) {
      if (this.gridSystem.getDistance(unitPos, entry.enemyCity) <= MILITARY_STAGING_DISTANCE) return true;
    }
    return false;
  }

  private logStagingTargetOnce(
    nationId: string,
    enemyNationId: string,
    enemyCity: GridCoord,
  ): void {
    let logged = this.militaryStagingLoggedKeys.get(nationId);
    if (!logged) {
      logged = new Set<string>();
      this.militaryStagingLoggedKeys.set(nationId, logged);
    }
    const key = `${enemyNationId}@${enemyCity.x},${enemyCity.y}`;
    if (logged.has(key)) return;
    logged.add(key);
    console.log(this.formatLog(nationId, `staging near enemy city at (${enemyCity.x},${enemyCity.y})`));
  }

  private logStagingAdvanceOncePerRound(nationId: string): void {
    const round = this.turnManager.getCurrentRound();
    if (this.militaryAdvanceLoggedRound.get(nationId) === round) return;
    this.militaryAdvanceLoggedRound.set(nationId, round);
    console.log(this.formatLog(nationId, 'unit moving to staging position'));
  }

  private logStagingHoldingOncePerRound(nationId: string): void {
    const round = this.turnManager.getCurrentRound();
    if (this.militaryHoldingLoggedRound.get(nationId) === round) return;
    this.militaryHoldingLoggedRound.set(nationId, round);
    console.log(this.formatLog(nationId, 'unit holding position at staging distance'));
  }

  // ─── Settlers ────────────────────────────────────────────────────────────────

  // Per-(settler, tile, round) keys we've already logged a spacing rejection
  // for. Prevents the same rejection from spamming the log when a settler
  // sits on an invalid tile across the same turn pass.
  private readonly settlerSpacingRejectionLogged = new Set<string>();
  private readonly settlerAssignmentLogKeyByUnit = new Map<string, string>();
  private readonly settlerScoutMemoryLogKeyByUnit = new Map<string, string>();
  private readonly settlerFallbackLogRoundByNation = new Map<string, number>();
  private readonly settlerNoValidSiteLogRoundByNation = new Map<string, number>();

  // Single source of truth for "is this settler allowed to found a city
  // here, right now?" — combines the FoundCitySystem terrain rules with the
  // strategy's settlerMinCityDistance spacing requirement against ALL cities
  // (own and foreign).
  private canFoundWithSpacing(settler: Unit, strategy: AIStrategy, eraStrategy: AILeaderEraStrategy): boolean {
    if (!this.foundCitySystem.canFound(settler)) return false;
    const minDist = this.minDistanceToCities(
      settler.tileX,
      settler.tileY,
      this.cityManager.getAllCities(),
    );
    return minDist >= this.getEffectiveSettlerMinCityDistance(strategy, eraStrategy);
  }

  private logSettlerSpacingRejection(
    nationId: string,
    settler: Unit,
    requiredDistance: number,
  ): void {
    const round = this.turnManager.getCurrentRound();
    const key = `${settler.id}@${settler.tileX},${settler.tileY}:${round}`;
    if (this.settlerSpacingRejectionLogged.has(key)) return;
    this.settlerSpacingRejectionLogged.add(key);
    const distance = this.minDistanceToCities(
      settler.tileX,
      settler.tileY,
      this.cityManager.getAllCities(),
    );
    console.debug(
      this.formatLog(nationId, `settler rejected founding site at (${settler.tileX},${settler.tileY}): too close to existing city, distance ${distance}, required ${requiredDistance}`),
    );
  }

  private runSettlers(nationId: string): void {
    const settlers = this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.canFound);
    const strategy = this.getStrategy(nationId);
    const eraStrategy = this.getActiveEraStrategy(nationId);
    const claimedTargets = new Set<string>();

    for (const settler of settlers) {
      if (this.unitManager.getUnit(settler.id) === undefined) continue;

      // Single spacing-aware gate. The strategy's settlerMinCityDistance is
      // the absolute floor — even capitals respect it, so two AIs that start
      // within range walk apart before founding instead of double-booking
      // adjacent territory. expansionBias used to relax this rule and is no
      // longer applied; expansionist nations may want more cities, but they
      // earn them by traveling farther rather than crowding the border.
      if (this.canFoundWithSpacing(settler, strategy, eraStrategy)) {
        const founded = this.foundCitySystem.foundCity(settler);
        if (founded) this.logFoundedCity(nationId, founded);
        continue; // settler consumed
      }
      if (this.foundCitySystem.canFound(settler)) {
        // canFound passed but spacing failed — log so the rejection is
        // visible in autoplay traces.
        this.logSettlerSpacingRejection(nationId, settler, strategy.expansion.settlerMinCityDistance);
      }

      // Move toward valid founding site
      this.moveSettlerTowardSite(settler, nationId, strategy, eraStrategy, claimedTargets);
    }
  }

  private moveSettlerTowardSite(
    settler: Unit,
    nationId: string,
    strategy: AIStrategy,
    eraStrategy: AILeaderEraStrategy,
    claimedTargets: Set<string>,
  ): void {
    let target = this.findScoutDiscoveredFoundingSite(settler, nationId, strategy, eraStrategy, claimedTargets);
    const usingScoutMemory = target !== null;
    if (!target) {
      target = this.findFoundingSite(settler, nationId, strategy, eraStrategy, claimedTargets);
      if (target) this.logSettlerFallback(nationId);
    }
    if (!target) {
      this.logSettlerNoValidSite(nationId);
      return;
    }

    const path = this.pathfindingSystem.findPath(settler, target.x, target.y, {
      respectMovementPoints: false,
    });
    if (path === null) {
      if (usingScoutMemory) this.settlementMemorySystem?.removeCandidate(nationId, target.x, target.y);
      this.logSettlerNoValidSite(nationId);
      return;
    }

    claimedTargets.add(tileKey(target.x, target.y));
    this.logSettlerAssignment(nationId, settler, target);
    if (usingScoutMemory) this.logSettlerUsingScoutMemory(nationId, settler, target);
    this.movementSystem.moveAlongPath(settler, path);

    if (settler.tileX === target.x && settler.tileY === target.y) {
      // World may have changed during the trip (another nation founded a city
      // nearby), so re-validate spacing — never just canFound — at the moment
      // of commitment.
      if (this.canFoundWithSpacing(settler, strategy, eraStrategy)) {
        const founded = this.foundCitySystem.foundCity(settler);
        if (founded) this.logFoundedCity(nationId, founded);
      } else if (this.foundCitySystem.canFound(settler)) {
        this.logSettlerSpacingRejection(nationId, settler, strategy.expansion.settlerMinCityDistance);
      }
    }
  }

  private findScoutDiscoveredFoundingSite(
    settler: Unit,
    nationId: string,
    strategy: AIStrategy,
    eraStrategy: AILeaderEraStrategy,
    claimedTargets: Set<string>,
  ): { x: number; y: number; score: number } | null {
    if (!this.settlementMemorySystem) return null;

    const candidates = this.settlementMemorySystem.getCandidates(nationId)
      .map((candidate) => ({
        candidate,
        score: this.scoreSettlementCandidate(settler, candidate, eraStrategy),
      }))
      .sort((a, b) => (
        b.score - a.score
        || a.candidate.discoveredTurn - b.candidate.discoveredTurn
        || a.candidate.y - b.candidate.y
        || a.candidate.x - b.candidate.x
      ));

    for (const { candidate, score } of candidates) {
      if (claimedTargets.has(tileKey(candidate.x, candidate.y))) continue;
      if (!this.isFoundingTargetValid(candidate.x, candidate.y, strategy, eraStrategy)) {
        this.settlementMemorySystem.removeCandidate(nationId, candidate.x, candidate.y);
        continue;
      }
      const path = this.pathfindingSystem.findPath(settler, candidate.x, candidate.y, {
        respectMovementPoints: false,
      });
      if (path === null) {
        this.settlementMemorySystem.removeCandidate(nationId, candidate.x, candidate.y);
        continue;
      }
      return { x: candidate.x, y: candidate.y, score };
    }

    return null;
  }

  private scoreSettlementCandidate(
    settler: Unit,
    candidate: SettlementCandidate,
    eraStrategy: AILeaderEraStrategy,
  ): number {
    const preferences = eraStrategy.foundingPreferences;
    let multiplier = 1;
    if (candidate.hasStrategicResource) multiplier += preferences?.strategicResource ?? 0;
    if (candidate.hasLuxuryResource) multiplier += preferences?.luxuryResource ?? 0;
    if (candidate.hasNaturalWonder) multiplier += preferences?.naturalWonder ?? 0;
    if (candidate.hasWaterAccess) multiplier += preferences?.coastalAccess ?? 0;
    if (candidate.hasWaterResource) multiplier += preferences?.waterResource ?? 0;

    const yields = this.settlementMemorySystem?.getSiteYields(candidate.x, candidate.y) ?? {
      foodYield: 0,
      productionYield: 0,
      cultureYield: 0,
    };
    multiplier += ((preferences?.foodYield ?? 1) - 1) * Math.min(yields.foodYield / 12, 1);
    multiplier += ((preferences?.productionYield ?? 1) - 1) * Math.min(yields.productionYield / 10, 1);
    multiplier += ((preferences?.cultureYield ?? 1) - 1) * Math.min(yields.cultureYield / 3, 1);

    const distance = this.gridSystem.getDistance(
      { x: settler.tileX, y: settler.tileY },
      { x: candidate.x, y: candidate.y },
    );
    return candidate.scoreBase * multiplier - distance * (preferences?.distancePenalty ?? 1);
  }

  private findFoundingSite(
    settler: Unit,
    nationId: string,
    strategy: AIStrategy,
    eraStrategy: AILeaderEraStrategy,
    claimedTargets: Set<string> = new Set<string>(),
  ): { x: number; y: number; score: number } | null {
    const allCities = this.cityManager.getAllCities();
    const nation = this.nationManager.getNation(nationId);
    const goals = nation?.aiGoals;
    // Strict spacing — same floor canFoundWithSpacing enforces — so the site
    // search and the commit check stay consistent. expansionBias no longer
    // shrinks the floor; expansionist nations travel farther for cities.
    const minCityDistance = this.getEffectiveSettlerMinCityDistance(strategy, eraStrategy);
    const wantsResources = hasGoalOfType(goals, 'build_economy');
    const wantsCoast = hasGoalOfType(goals, 'build_navy');
    const hasExpandGoal = hasGoalOfType(goals, 'expand');

    const ownCities = this.cityManager.getCitiesByOwner(nationId);
    const capital = ownCities[0];

    let bestTile: { x: number; y: number } | null = null;
    let bestScore = -Infinity;

    for (let y = 0; y < this.mapData.height; y++) {
      for (let x = 0; x < this.mapData.width; x++) {
        const tile = this.mapData.tiles[y][x];
        if (tile.type === TileType.Ocean || tile.type === TileType.Coast || tile.type === TileType.Ice) continue;
        if (this.cityManager.getCityAt(x, y) !== undefined) continue;
        if (this.unitManager.getUnitAt(x, y) !== null) continue;
        if (claimedTargets.has(tileKey(x, y))) continue;

        const cityDist = this.minDistanceToCities(x, y, allCities);
        if (cityDist < minCityDistance) continue;

        const settlerDist = this.gridSystem.getDistance(
          { x: settler.tileX, y: settler.tileY },
          { x, y },
        );
        const score = this.scoreFoundingTile(
          tile,
          settlerDist,
          capital,
          {
            wantsResources,
            wantsCoast,
            hasExpandGoal,
          },
          eraStrategy,
        );

        if (score > bestScore) {
          bestScore = score;
          bestTile = { x, y };
        }
      }
    }

    if (bestTile) {
      console.log(
        this.formatLog(nationId, `AI expansion targeting tile (${bestTile.x}, ${bestTile.y})`),
      );
    }

    return bestTile ? { ...bestTile, score: bestScore } : null;
  }

  private isFoundingTargetValid(
    x: number,
    y: number,
    strategy: AIStrategy,
    eraStrategy: AILeaderEraStrategy,
  ): boolean {
    const tile = this.mapData.tiles[y]?.[x];
    if (!tile) return false;
    if (tile.type === TileType.Ocean || tile.type === TileType.Coast || tile.type === TileType.Ice) return false;
    if (this.cityManager.getCityAt(x, y) !== undefined) return false;
    if (this.unitManager.getUnitAt(x, y) !== null) return false;
    const cityDist = this.minDistanceToCities(x, y, this.cityManager.getAllCities());
    return cityDist >= this.getEffectiveSettlerMinCityDistance(strategy, eraStrategy);
  }

  private logSettlerAssignment(
    nationId: string,
    settler: Unit,
    target: { x: number; y: number; score: number },
  ): void {
    const key = `${target.x},${target.y}`;
    if (this.settlerAssignmentLogKeyByUnit.get(settler.id) === key) return;
    this.settlerAssignmentLogKeyByUnit.set(settler.id, key);
    this.maybeLogCoastalSpacingOverride(nationId, settler, target);
    if (this.isCoastalFoundingTile(target.x, target.y)) {
      console.log(
        this.formatLog(nationId, `settler assigned coastal target at (${target.x},${target.y}) score: ${Math.round(target.score)}`),
      );
      return;
    }
    console.log(
      this.formatLog(nationId, `settler assigned target (${target.x},${target.y}) score: ${Math.round(target.score)}`),
    );
  }

  private logFoundedCity(nationId: string, city: City): void {
    const prefix = this.isCoastalFoundingTile(city.tileX, city.tileY) ? 'founded coastal city' : 'founded city';
    console.log(this.formatLog(nationId, `${prefix} at (${city.tileX},${city.tileY})`));
  }

  private maybeLogCoastalSpacingOverride(
    nationId: string,
    settler: Unit,
    target: { x: number; y: number },
  ): void {
    const strategy = this.getStrategy(nationId);
    const eraStrategy = this.getActiveEraStrategy(nationId);
    const effectiveMin = this.getEffectiveSettlerMinCityDistance(strategy, eraStrategy);
    const genericMin = strategy.expansion.settlerMinCityDistance;
    if (effectiveMin >= genericMin) return;
    const nearestCityDistance = this.minDistanceToCities(target.x, target.y, this.cityManager.getAllCities());
    if (nearestCityDistance >= genericMin) return;
    const key = `${settler.id}:${effectiveMin}`;
    if (this.coastalSpacingLoggedBySettler.has(key)) return;
    this.coastalSpacingLoggedBySettler.add(key);
    console.log(this.formatLog(nationId, `settler using coastal spacing minDistance=${effectiveMin}`));
  }

  private logSettlerUsingScoutMemory(
    nationId: string,
    settler: Unit,
    target: { x: number; y: number },
  ): void {
    const key = `${target.x},${target.y}`;
    if (this.settlerScoutMemoryLogKeyByUnit.get(settler.id) === key) return;
    this.settlerScoutMemoryLogKeyByUnit.set(settler.id, key);
    console.log(this.formatLog(nationId, 'settler using scout-discovered site'));
  }

  private logSettlerFallback(nationId: string): void {
    const round = this.turnManager.getCurrentRound();
    if (this.settlerFallbackLogRoundByNation.get(nationId) === round) return;
    this.settlerFallbackLogRoundByNation.set(nationId, round);
    console.log(this.formatLog(nationId, 'settler fallback to local search'));
  }

  private logSettlerNoValidSite(nationId: string): void {
    const round = this.turnManager.getCurrentRound();
    if (this.settlerNoValidSiteLogRoundByNation.get(nationId) === round) return;
    this.settlerNoValidSiteLogRoundByNation.set(nationId, round);
    console.log(this.formatLog(nationId, 'settler found no valid settlement candidates'));
  }

  private scoreFoundingTile(
    tile: Tile,
    settlerDist: number,
    capital: City | undefined,
    intents: { wantsResources: boolean; wantsCoast: boolean; hasExpandGoal: boolean },
    eraStrategy?: AILeaderEraStrategy,
  ): number {
    let score = this.computeCoastalSiteBonus({ x: tile.x, y: tile.y }, eraStrategy) - settlerDist;

    if (tile.resourceId !== undefined) score += 5;
    score += this.computeCulturalSiteBonus({ x: tile.x, y: tile.y }, eraStrategy);

    let touchesCoast = false;
    for (const adj of this.gridSystem.getAdjacentCoords({ x: tile.x, y: tile.y })) {
      const adjTile = this.mapData.tiles[adj.y]?.[adj.x];
      if (adjTile?.type === TileType.Coast) {
        touchesCoast = true;
        break;
      }
    }
    if (touchesCoast) score += 2;

    if (tile.type === TileType.Desert) score -= 2;
    if (tile.type === TileType.Mountain) score -= 3;

    if (capital) {
      const capitalDist = this.gridSystem.getDistance(
        { x: capital.tileX, y: capital.tileY },
        { x: tile.x, y: tile.y },
      );
      score -= capitalDist * 0.2;
    }

    if (intents.hasExpandGoal) score += 2;
    if (intents.wantsResources && tile.resourceId !== undefined) score += 3;
    if (intents.wantsCoast && touchesCoast) score += 3;

    return score;
  }

  private computeCoastalSiteBonus(coord: GridCoord, eraStrategy?: AILeaderEraStrategy): number {
    let coastCount = 0;
    let waterResourceCount = 0;
    for (const adj of this.gridSystem.getAdjacentCoords(coord)) {
      const tile = this.mapData.tiles[adj.y]?.[adj.x];
      if (!tile) continue;
      if (tile.type === TileType.Coast) coastCount++;
      const isWater = tile.type === TileType.Coast || tile.type === TileType.Ocean;
      if (isWater && tile.resourceId !== undefined) waterResourceCount++;
    }
    let bonus = 0;
    const foundingPreferences = eraStrategy?.resourcePriorities?.seaResourceExploitation !== undefined
      ? eraStrategy.foundingPreferences
      : undefined;
    const coastalAccessWeight = foundingPreferences?.coastalAccess ?? 1;
    const waterResourceWeight = foundingPreferences?.waterResource ?? 1;
    if (coastCount > 0) bonus += COASTAL_SITE_BONUS * coastalAccessWeight;
    bonus += coastCount * COASTAL_TILE_BONUS;
    bonus += waterResourceCount * WATER_RESOURCE_BONUS * waterResourceWeight;
    return bonus;
  }

  private computeCulturalSiteBonus(coord: GridCoord, eraStrategy?: AILeaderEraStrategy): number {
    const preferences = eraStrategy?.foundingPreferences;
    if (!preferences) return 0;

    let cultureYield = 0;
    let hasNaturalWonder = false;
    const coords = [
      coord,
      ...this.gridSystem.getAdjacentCoords(coord),
    ];
    for (const entry of coords) {
      const tile = this.mapData.tiles[entry.y]?.[entry.x];
      if (!tile?.resourceId) continue;
      const resource = getNaturalResourceById(tile.resourceId);
      if (!resource) continue;
      cultureYield += resource.yieldBonus.culture;
      if (resource.isNaturalWonder === true || resource.notes?.toLowerCase().includes('natural wonder') === true) {
        hasNaturalWonder = true;
      }
    }

    return cultureYield * (preferences.cultureYield ?? 1) * 2
      + (hasNaturalWonder ? (preferences.naturalWonder ?? 0) * 10 : 0);
  }

  private isCoastalFoundingTile(x: number, y: number): boolean {
    return this.gridSystem.getAdjacentCoords({ x, y }).some((adj) => {
      const tile = this.mapData.tiles[adj.y]?.[adj.x];
      return tile?.type === TileType.Coast || tile?.type === TileType.Ocean;
    });
  }

  private getEffectiveSettlerMinCityDistance(
    strategy: AIStrategy,
    eraStrategy: AILeaderEraStrategy,
  ): number {
    return eraStrategy.foundingRules?.minCityDistance
      ?? strategy.expansion.settlerMinCityDistance
      ?? 7;
  }

  private minDistanceToCities(tileX: number, tileY: number, cities: City[]): number {
    if (cities.length === 0) return Infinity;
    let min = Infinity;
    for (const city of cities) {
      const d = this.gridSystem.getDistance(
        { x: city.tileX, y: city.tileY },
        { x: tileX, y: tileY },
      );
      if (d < min) min = d;
    }
    return min;
  }

  // ─── Combat ──────────────────────────────────────────────────────────────────

  private runCombat(nationId: string): void {
    const units = this.unitManager.getUnitsByOwner(nationId);
    const strategy = this.getStrategy(nationId);

    for (const unit of units) {
      if (unit.movementPoints <= 0) continue;
      if (unit.unitType.baseStrength <= 0) continue; // settlers can't attack
      if (!this.canTakeAggressiveAction(unit, strategy)) continue;
      if (this.unitManager.getUnit(unit.id) === undefined) continue;

      this.tryAttackBestTarget(unit, nationId, strategy);
    }
  }

  // Strategy-based scoring allows AI to prioritize targets differently
  // without changing core combat rules.
  private tryAttackBestTarget(unit: Unit, nationId: string, strategy: AIStrategy): boolean {
    const range = unit.unitType.range ?? 1;
    const tiles = this.gridSystem.getTilesInRange(
      { x: unit.tileX, y: unit.tileY },
      range,
      this.mapData,
      { includeCenter: false },
    );

    const intent = getMilitaryIntent(this.nationManager.getNation(nationId)?.aiGoals);

    const scored: { x: number; y: number; score: number }[] = [];
    for (const tile of tiles) {
      const target = this.findEnemyTargetAt(tile.x, tile.y, nationId);
      if (!target) continue;

      const context = this.buildCombatContext(unit, target, nationId, tile.x, tile.y);
      const score = scoreCombatTarget(context, strategy, intent);
      scored.push({ x: tile.x, y: tile.y, score });
    }

    if (scored.length === 0) return false;

    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score < 0) return false; // not worth attacking this turn

    for (const candidate of scored) {
      if (candidate.score < 0) break;
      if (this.combatSystem.tryAttack(unit, candidate.x, candidate.y)) return true;
    }
    return false;
  }

  private findEnemyTargetAt(
    tileX: number,
    tileY: number,
    nationId: string,
  ): Unit | City | undefined {
    const targetUnit = this.unitManager.getUnitAt(tileX, tileY);
    if (targetUnit && targetUnit.ownerId !== nationId) return targetUnit;

    const targetCity = this.cityManager.getCityAt(tileX, tileY);
    if (targetCity && targetCity.ownerId !== nationId) return targetCity;

    return undefined;
  }

  private buildCombatContext(
    attacker: Unit,
    target: Unit | City,
    nationId: string,
    targetX: number,
    targetY: number,
  ): AICombatContext {
    const attackerPosition = { x: attacker.tileX, y: attacker.tileY };
    const targetPosition = { x: targetX, y: targetY };
    const distance = this.gridSystem.getDistance(attackerPosition, targetPosition);
    const isTargetUnit = isUnit(target);
    const isTargetCity = !isTargetUnit;

    const canAttack = this.diplomacyManager
      ? this.diplomacyManager.canAttack(nationId, target.ownerId)
      : true;

    const targetHealthRatio = isTargetUnit
      ? target.health / target.unitType.baseHealth
      : target.health / CITY_BASE_HEALTH;

    return {
      attacker,
      attackerPosition,
      target,
      targetPosition,
      distance,
      canAttack,
      attackerHealthRatio: attacker.health / attacker.unitType.baseHealth,
      targetHealthRatio,
      isTargetCity,
      isTargetUnit,
      isNearOwnCity: this.isNearOwnCity(targetPosition, nationId),
    };
  }

  private isNearOwnCity(position: GridCoord, nationId: string): boolean {
    const ownCities = this.cityManager.getCitiesByOwner(nationId);
    for (const city of ownCities) {
      const dist = this.gridSystem.getDistance(
        { x: city.tileX, y: city.tileY },
        position,
      );
      if (dist <= NEAR_OWN_CITY_DISTANCE) return true;
    }
    return false;
  }

  // ─── Movement ────────────────────────────────────────────────────────────────

  private runMovement(nationId: string): void {
    const units = this.unitManager.getUnitsByOwner(nationId);
    const strategy = this.getStrategy(nationId);

    const weights = getBehaviorWeights(this.nationManager.getNation(nationId)?.aiStrategyId);
    if (weights.exploration !== 1) {
      console.debug(this.formatLog(nationId, `AI exploration score adjusted by strategy weight ${weights.exploration}.`));
    }

    // Naval state shared across this nation's ships for the turn: defines
    // where we want to defend and which tiles are already claimed/occupied,
    // so multiple ships spread out instead of stacking.
    const navalContext = this.buildNavalPatrolContext(nationId);

    for (const unit of units) {
      if (unit.movementPoints <= 0) continue;
      if (unit.unitType.canFound) continue; // settlers handled in runSettlers
      if (unit.unitType.id === SCOUT.id) continue; // scouts use AIExplorationSystem
      if (unit.unitType.id === SCOUT_BOAT.id || unit.unitType.category === 'naval_recon') continue;
      if (this.unitManager.getUnit(unit.id) === undefined) continue;

      if (unit.unitType.id === WORK_BOAT.id) {
        this.runWorkBoat(unit, nationId);
        continue;
      }

      if (unit.unitType.isNaval) {
        this.moveNavalUnitForPatrol(unit, nationId, strategy, navalContext);
        continue;
      }

      if (!this.canTakeAggressiveAction(unit, strategy)) continue;

      this.moveByStrategyScoring(unit, nationId, strategy);
    }
  }

  // ─── Naval patrol ────────────────────────────────────────────────────────────

  private buildNavalPatrolContext(nationId: string): NavalPatrolContext {
    const targets = this.getCoastalDefenseTargets(nationId);
    const enemyTargets = this.getEnemyCoastalTargets(nationId);
    const ownZoneHasEnemy = this.ownCoastalZoneHasEnemy(nationId, targets);
    // Pre-claim tiles that own naval units already occupy so other ships
    // don't try to converge onto a tile they can't enter (no stacking).
    const claimedNavalTiles = new Set<string>();
    for (const u of this.unitManager.getUnitsByOwner(nationId)) {
      if (u.unitType.isNaval) claimedNavalTiles.add(tileKey(u.tileX, u.tileY));
    }
    return { targets, enemyTargets, claimedNavalTiles, ownZoneHasEnemy };
  }

  private moveNavalUnitForPatrol(
    unit: Unit,
    nationId: string,
    strategy: AIStrategy,
    context: NavalPatrolContext,
  ): void {
    // Combat naval first try to intercept high-priority enemies near our
    // coast. The combat phase already attacks adjacent ones; this just
    // closes distance so the next turn's combat phase can finish the job.
    if (unit.unitType.baseStrength > 0) {
      const enemy = this.findHighPriorityNavalEnemy(unit, nationId, context.targets);
      if (enemy && this.moveNavalUnitToward(unit, { x: enemy.tileX, y: enemy.tileY })) return;
    }

    // Offensive harassment along enemy coasts. Gated by:
    //  - combat naval only (no work boats / cargo)
    //  - no enemy presence in our own coastal zone (else we defend instead)
    //  - at least one war enemy with a coastal zone (the helper already
    //    enforces the WAR diplomacy requirement)
    if (
      unit.unitType.baseStrength > 0 &&
      !context.ownZoneHasEnemy &&
      context.enemyTargets.zone.size > 0 &&
      this.tryOffensiveNavalMove(unit, context)
    ) return;

    if (this.moveNavalUnitToPatrolTile(unit, context)) return;

    // No coastal zone available (e.g. nation lost its coast): fall back to
    // generic water exploration so units don't sit still indefinitely.
    this.moveNavalUnitForExploration(unit, nationId, strategy);
  }

  private tryOffensiveNavalMove(unit: Unit, context: NavalPatrolContext): boolean {
    const { enemyTargets, claimedNavalTiles } = context;
    // Priority 1 → Priority 3: enemy ships in zone, then exposed land units.
    // (Priority 2 — embarked units — does not apply: this game has no embarkation.)
    if (this.tryMoveTowardNearestEnemyUnit(unit, enemyTargets.navalUnits, claimedNavalTiles)) return true;
    if (this.tryMoveTowardNearestEnemyUnit(unit, enemyTargets.coastAdjacentUnits, claimedNavalTiles)) return true;

    // Priority 4: patrol-pressure on enemy coast.
    return this.tryMoveTowardNearestZoneTile(unit, enemyTargets.zoneTiles, claimedNavalTiles);
  }

  private tryMoveTowardNearestEnemyUnit(
    unit: Unit,
    enemies: readonly Unit[],
    claimed: Set<string>,
  ): boolean {
    const unitPos = { x: unit.tileX, y: unit.tileY };
    const sorted = enemies
      .filter((e) => !claimed.has(tileKey(e.tileX, e.tileY)))
      .map((e) => ({
        enemy: e,
        dist: this.gridSystem.getDistance(unitPos, { x: e.tileX, y: e.tileY }),
      }))
      .filter(({ dist }) => dist <= NAVAL_MAX_OFFENSIVE_REACH)
      .sort((a, b) => a.dist - b.dist);

    for (const { enemy } of sorted) {
      if (this.moveNavalUnitToward(unit, { x: enemy.tileX, y: enemy.tileY })) {
        claimed.add(tileKey(enemy.tileX, enemy.tileY));
        return true;
      }
    }
    return false;
  }

  private tryMoveTowardNearestZoneTile(
    unit: Unit,
    zoneTiles: readonly Tile[],
    claimed: Set<string>,
  ): boolean {
    const unitPos = { x: unit.tileX, y: unit.tileY };
    let bestTile: Tile | null = null;
    let bestDist = Infinity;
    for (const tile of zoneTiles) {
      const key = tileKey(tile.x, tile.y);
      if (claimed.has(key)) continue;
      const dist = this.gridSystem.getDistance(unitPos, { x: tile.x, y: tile.y });
      if (dist > NAVAL_MAX_OFFENSIVE_REACH) continue;
      if (dist < bestDist) {
        bestDist = dist;
        bestTile = tile;
      }
    }
    if (!bestTile) return false;
    if (!this.moveNavalUnitToward(unit, { x: bestTile.x, y: bestTile.y })) return false;
    claimed.add(tileKey(bestTile.x, bestTile.y));
    return true;
  }

  private moveNavalUnitToPatrolTile(
    unit: Unit,
    context: NavalPatrolContext,
  ): boolean {
    const { targets, claimedNavalTiles } = context;
    if (targets.patrolTiles.length === 0) return false;

    const unitPos = { x: unit.tileX, y: unit.tileY };
    const resourceKeys = new Set(
      targets.resourceTiles.map((tile) => tileKey(tile.x, tile.y)),
    );

    let bestTile: Tile | null = null;
    let bestScore = -Infinity;
    for (const tile of targets.patrolTiles) {
      const key = tileKey(tile.x, tile.y);
      if (claimedNavalTiles.has(key)) continue;
      const distance = this.gridSystem.getDistance(unitPos, { x: tile.x, y: tile.y });
      let score = -distance;
      if (this.tileIsNearWaterResource(tile, resourceKeys)) {
        score += NAVAL_PATROL_RESOURCE_BONUS;
      }
      if (score > bestScore) {
        bestScore = score;
        bestTile = tile;
      }
    }
    if (!bestTile) return false;
    if (!this.moveNavalUnitToward(unit, { x: bestTile.x, y: bestTile.y })) return false;
    claimedNavalTiles.add(tileKey(bestTile.x, bestTile.y));
    return true;
  }

  private tileIsNearWaterResource(tile: Tile, resourceKeys: Set<string>): boolean {
    if (resourceKeys.has(tileKey(tile.x, tile.y))) return true;
    for (const adj of this.gridSystem.getAdjacentCoords({ x: tile.x, y: tile.y })) {
      if (resourceKeys.has(tileKey(adj.x, adj.y))) return true;
    }
    return false;
  }

  private moveNavalUnitToward(unit: Unit, dest: GridCoord): boolean {
    const path = this.pathfindingSystem.findPath(unit, dest.x, dest.y, {
      respectMovementPoints: false,
    });
    if (path !== null) {
      this.movementSystem.moveAlongPath(unit, path);
      return true;
    }
    // Land destinations (e.g. coastal city tiles) are unreachable for naval
    // units; try water tiles adjacent to the target instead.
    for (const adj of this.gridSystem.getAdjacentCoords(dest)) {
      const adjTile = this.mapData.tiles[adj.y]?.[adj.x];
      if (!adjTile) continue;
      if (adjTile.type !== TileType.Coast && adjTile.type !== TileType.Ocean) continue;
      const adjPath = this.pathfindingSystem.findPath(unit, adj.x, adj.y, {
        respectMovementPoints: false,
      });
      if (adjPath !== null) {
        this.movementSystem.moveAlongPath(unit, adjPath);
        return true;
      }
    }
    return false;
  }

  private findHighPriorityNavalEnemy(
    unit: Unit,
    nationId: string,
    targets: CoastalDefenseTargets,
  ): Unit | null {
    const coastalCities = this.cityManager.getCitiesByOwner(nationId)
      .filter((city) => cityHasWaterTile(city, this.mapData));
    const unitPos = { x: unit.tileX, y: unit.tileY };

    let best: Unit | null = null;
    let bestDist = Infinity;
    for (const enemy of this.unitManager.getAllUnits()) {
      if (enemy.ownerId === nationId) continue;
      if (this.diplomacyManager
        && !this.diplomacyManager.canAttack(nationId, enemy.ownerId)) continue;

      const enemyPos = { x: enemy.tileX, y: enemy.tileY };
      const enemyKey = tileKey(enemyPos.x, enemyPos.y);

      let highPriority = targets.zone.has(enemyKey);
      if (!highPriority) {
        for (const city of coastalCities) {
          const d = this.gridSystem.getDistance(
            { x: city.tileX, y: city.tileY },
            enemyPos,
          );
          if (d <= NAVAL_ENEMY_NEAR_CITY_RADIUS) { highPriority = true; break; }
        }
      }
      if (!highPriority) continue;

      const dist = this.gridSystem.getDistance(unitPos, enemyPos);
      if (dist < bestDist) {
        bestDist = dist;
        best = enemy;
      }
    }
    return best;
  }

  /**
   * Enemy coastal targets across all war enemies. Diplomacy gates the entire
   * helper: nations not at WAR contribute no zone tiles and no targets, so
   * downstream offensive logic never selects them.
   */
  private getEnemyCoastalTargets(nationId: string): EnemyCoastalTargets {
    const empty: EnemyCoastalTargets = {
      zone: new Set(),
      zoneTiles: [],
      navalUnits: [],
      coastAdjacentUnits: [],
    };
    if (!this.diplomacyManager) return empty;

    const dm = this.diplomacyManager;
    const warEnemyIds = new Set<string>();
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (dm.getState(nationId, other.id) !== 'WAR') continue;
      warEnemyIds.add(other.id);
    }
    if (warEnemyIds.size === 0) return empty;

    const zone = new Set<string>();
    const zoneTiles: Tile[] = [];
    const addZoneTile = (tile: Tile | undefined): void => {
      if (!tile) return;
      if (tile.type !== TileType.Coast && tile.type !== TileType.Ocean) return;
      const key = tileKey(tile.x, tile.y);
      if (zone.has(key)) return;
      zone.add(key);
      zoneTiles.push(tile);
    };

    for (const enemyId of warEnemyIds) {
      for (const city of this.cityManager.getCitiesByOwner(enemyId)) {
        // Water tiles adjacent to enemy territory.
        for (const owned of city.ownedTileCoords) {
          for (const adj of this.gridSystem.getAdjacentCoords(owned)) {
            addZoneTile(this.mapData.tiles[adj.y]?.[adj.x]);
          }
        }
        // Water tiles within radius 2 of enemy coastal cities.
        if (cityHasWaterTile(city, this.mapData)) {
          const inRange = this.gridSystem.getTilesInRange(
            { x: city.tileX, y: city.tileY },
            NAVAL_COASTAL_ZONE_RADIUS,
            this.mapData,
            { includeCenter: true },
          );
          for (const tile of inRange) addZoneTile(tile);
        }
      }
    }

    if (zone.size === 0) return empty;

    const navalUnits: Unit[] = [];
    const coastAdjacentUnits: Unit[] = [];
    for (const enemy of this.unitManager.getAllUnits()) {
      if (!warEnemyIds.has(enemy.ownerId)) continue;
      if (!dm.canAttack(nationId, enemy.ownerId)) continue;

      const enemyKey = tileKey(enemy.tileX, enemy.tileY);
      if (enemy.unitType.isNaval === true) {
        if (zone.has(enemyKey)) navalUnits.push(enemy);
        continue;
      }

      // Land unit: count it only if it sits on a tile adjacent to a
      // zone water tile, i.e. exposed to naval attack.
      const adjacentToZone = this.gridSystem
        .getAdjacentCoords({ x: enemy.tileX, y: enemy.tileY })
        .some((adj) => zone.has(tileKey(adj.x, adj.y)));
      if (adjacentToZone) coastAdjacentUnits.push(enemy);
    }

    return { zone, zoneTiles, navalUnits, coastAdjacentUnits };
  }

  /**
   * True if any enemy unit we can attack sits inside our coastal zone or
   * within `NAVAL_ENEMY_NEAR_CITY_RADIUS` of one of our coastal cities.
   * When this is true, naval units stay in defensive/patrol mode rather
   * than venturing offensive — even if we are at war elsewhere.
   */
  private ownCoastalZoneHasEnemy(
    nationId: string,
    ownTargets: CoastalDefenseTargets,
  ): boolean {
    const coastalCities = this.cityManager.getCitiesByOwner(nationId)
      .filter((city) => cityHasWaterTile(city, this.mapData));

    for (const enemy of this.unitManager.getAllUnits()) {
      if (enemy.ownerId === nationId) continue;
      if (this.diplomacyManager
        && !this.diplomacyManager.canAttack(nationId, enemy.ownerId)) continue;

      const enemyPos = { x: enemy.tileX, y: enemy.tileY };
      if (ownTargets.zone.has(tileKey(enemyPos.x, enemyPos.y))) return true;
      for (const city of coastalCities) {
        const d = this.gridSystem.getDistance(
          { x: city.tileX, y: city.tileY },
          enemyPos,
        );
        if (d <= NAVAL_ENEMY_NEAR_CITY_RADIUS) return true;
      }
    }
    return false;
  }

  /**
   * Coastal defense targets for a nation: water tiles near our borders plus
   * water tiles holding resources. Anchors are Coast tiles either owned by
   * the nation or adjacent to its territory; the zone expands outward by
   * `NAVAL_COASTAL_ZONE_RADIUS` over water tiles.
   */
  private getCoastalDefenseTargets(nationId: string): CoastalDefenseTargets {
    const ownedCoords: GridCoord[] = [];
    const ownedKeys = new Set<string>();
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      for (const coord of city.ownedTileCoords) {
        const key = tileKey(coord.x, coord.y);
        if (ownedKeys.has(key)) continue;
        ownedKeys.add(key);
        ownedCoords.push(coord);
      }
    }

    const anchorSet = new Set<string>();
    const anchors: Tile[] = [];
    const addAnchor = (x: number, y: number): void => {
      const tile = this.mapData.tiles[y]?.[x];
      if (!tile) return;
      if (tile.type !== TileType.Coast) return;
      const key = tileKey(x, y);
      if (anchorSet.has(key)) return;
      anchorSet.add(key);
      anchors.push(tile);
    };

    for (const owned of ownedCoords) {
      addAnchor(owned.x, owned.y);
      for (const adj of this.gridSystem.getAdjacentCoords(owned)) {
        addAnchor(adj.x, adj.y);
      }
    }

    const zone = new Set<string>(anchorSet);
    const patrolTiles: Tile[] = [...anchors];
    for (const anchor of anchors) {
      const inRange = this.gridSystem.getTilesInRange(
        { x: anchor.x, y: anchor.y },
        NAVAL_COASTAL_ZONE_RADIUS,
        this.mapData,
        { includeCenter: false },
      );
      for (const tile of inRange) {
        if (tile.type !== TileType.Coast && tile.type !== TileType.Ocean) continue;
        const key = tileKey(tile.x, tile.y);
        if (zone.has(key)) continue;
        zone.add(key);
        patrolTiles.push(tile);
      }
    }

    const resourceTiles = patrolTiles.filter((tile) => tile.resourceId !== undefined);

    return { zone, patrolTiles, resourceTiles };
  }

  private moveNavalUnitForExploration(
    unit: Unit,
    nationId: string,
    strategy: AIStrategy,
  ): void {
    if (!this.explorationMemorySystem) return;
    const weights = getBehaviorWeights(this.nationManager.getNation(nationId)?.aiStrategyId);
    if (weights.exploration <= 0) return;

    const unitPos = { x: unit.tileX, y: unit.tileY };
    const tilesInRange = this.gridSystem.getTilesInRange(
      unitPos,
      strategy.military.engageDistance,
      this.mapData,
      { includeCenter: false },
    );
    const currentTurn = this.turnManager.getCurrentRound();

    let bestTile: Tile | null = null;
    let bestScore = 0;
    for (const tile of tilesInRange) {
      if (tile.type !== TileType.Ocean && tile.type !== TileType.Coast) continue;
      const score = this.explorationMemorySystem.getExplorationScore(nationId, tile, currentTurn);
      if (score > bestScore) {
        bestScore = score;
        bestTile = tile;
      }
    }
    if (!bestTile) return;

    const path = this.pathfindingSystem.findPath(unit, bestTile.x, bestTile.y, {
      respectMovementPoints: false,
    });
    if (path === null) return;
    this.movementSystem.moveAlongPath(unit, path);
  }

  // ─── Work boats ─────────────────────────────────────────────────────────────

  private runWorkBoat(unit: Unit, nationId: string): void {
    if (!this.builderSystem) return;
    if (unit.unitType.canBuildImprovements !== true || unit.unitType.isNaval !== true) return;

    let target = this.getAssignedWorkBoatTarget(unit, nationId);
    if (target === null) {
      target = this.getValidSeaResourceTargetsForWorkBoat(nationId, unit, {
        requireReachable: true,
        includeAssigned: false,
      })[0] ?? null;
      if (target === null) return;
      this.workBoatTargetsByUnit.set(unit.id, tileKey(target.x, target.y));
      console.log(
        this.formatLog(
          nationId,
          `Work Boat assigned sea resource ${target.resourceId} at (${target.x},${target.y})`,
        ),
      );
    }

    const tile = this.mapData.tiles[target.y]?.[target.x];
    if (!tile) {
      this.workBoatTargetsByUnit.delete(unit.id);
      return;
    }

    if (unit.tileX === target.x && unit.tileY === target.y) {
      const result = this.builderSystem.build(unit, tile, {
        consumeMovement: true,
        requireMovement: true,
      });
      if (result !== null) {
        this.workBoatTargetsByUnit.delete(unit.id);
      }
      return;
    }

    const path = this.pathfindingSystem.findPath(unit, target.x, target.y, {
      respectMovementPoints: false,
    });
    if (path === null) {
      this.workBoatTargetsByUnit.delete(unit.id);
      return;
    }

    const fromX = unit.tileX;
    const fromY = unit.tileY;
    this.movementSystem.moveAlongPath(unit, path);
    if (unit.tileX === fromX && unit.tileY === fromY) return;

    const logKey = `${target.x},${target.y}:${unit.tileX},${unit.tileY}`;
    if (this.workBoatMovementLogKeyByUnit.get(unit.id) !== logKey) {
      this.workBoatMovementLogKeyByUnit.set(unit.id, logKey);
      console.log(
        this.formatLog(
          nationId,
          `Work Boat moved toward sea resource ${target.resourceId} at (${target.x},${target.y})`,
        ),
      );
    }
  }

  private getAssignedWorkBoatTarget(unit: Unit, nationId: string): SeaResourceCandidate | null {
    const key = this.workBoatTargetsByUnit.get(unit.id);
    if (key === undefined) return null;
    const [xRaw, yRaw] = key.split(',');
    const x = Number(xRaw);
    const y = Number(yRaw);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      this.workBoatTargetsByUnit.delete(unit.id);
      return null;
    }
    const target = this.getValidSeaResourceTargetsForWorkBoat(nationId, unit, {
      requireReachable: true,
      includeAssigned: true,
      allowedAssignedKey: key,
    }).find((candidate) => candidate.x === x && candidate.y === y) ?? null;
    if (target === null) this.workBoatTargetsByUnit.delete(unit.id);
    return target;
  }

  private getValidSeaResourceTargetsForWorkBoat(
    nationId: string,
    unit: Unit | undefined,
    options: {
      requireReachable: boolean;
      includeAssigned: boolean;
      allowedAssignedKey?: string;
    },
  ): SeaResourceCandidate[] {
    const assignedKeys = new Set(this.workBoatTargetsByUnit.values());
    const eraStrategy = this.getActiveEraStrategy(nationId);
    const exploitation = eraStrategy.resourcePriorities?.seaResourceExploitation ?? 1;
    return this.seaResourceMemorySystem.getBestSeaResourceTargetsForNation(nationId)
      .filter((candidate) => {
        const key = tileKey(candidate.x, candidate.y);
        if (
          !options.includeAssigned &&
          assignedKeys.has(key) &&
          key !== options.allowedAssignedKey
        ) return false;
        if (
          options.includeAssigned &&
          assignedKeys.has(key) &&
          key !== options.allowedAssignedKey
        ) return false;
        return this.isValidWorkBoatTarget(nationId, candidate, unit, options.requireReachable);
      })
      .sort((a, b) => (
        this.scoreWorkBoatTarget(b, nationId, exploitation) - this.scoreWorkBoatTarget(a, nationId, exploitation)
        || a.discoveredTurn - b.discoveredTurn
        || a.y - b.y
        || a.x - b.x
      ));
  }

  private isValidWorkBoatTarget(
    nationId: string,
    candidate: SeaResourceCandidate,
    unit: Unit | undefined,
    requireReachable: boolean,
  ): boolean {
    const tile = this.mapData.tiles[candidate.y]?.[candidate.x];
    if (!tile) return false;
    if (tile.type !== TileType.Coast && tile.type !== TileType.Ocean) return false;
    if (tile.resourceId !== candidate.resourceId) return false;
    if (tile.improvementId !== undefined || tile.improvementConstruction !== undefined) return false;

    const ownerNationId = tile.resourceOwnerNationId ?? tile.ownerId;
    if (ownerNationId !== undefined && ownerNationId !== nationId) return false;

    const resource = getNaturalResourceById(tile.resourceId);
    if (resource === undefined) return false;
    const improvementId = getNaturalResourceImprovementIdForTile(resource, tile.type);
    if (improvementId === undefined) return false;
    if (!this.researchSystem?.isImprovementUnlocked(nationId, improvementId)) return false;

    if (requireReachable && unit !== undefined) {
      return this.pathfindingSystem.findPath(unit, tile.x, tile.y, {
        respectMovementPoints: false,
      }) !== null;
    }
    return true;
  }

  private scoreWorkBoatTarget(
    candidate: SeaResourceCandidate,
    nationId: string,
    exploitation: number,
  ): number {
    const tile = this.mapData.tiles[candidate.y]?.[candidate.x];
    const ownerNationId = tile ? tile.resourceOwnerNationId ?? tile.ownerId : undefined;
    let score = candidate.scoreBase * exploitation;
    if (ownerNationId === undefined) score += 4;
    else if (ownerNationId === nationId) score += 2;
    return score;
  }

  // Strategy-based movement scoring shapes where AI units want to go,
  // while existing pathfinding and movement rules still decide how they move.
  private moveByStrategyScoring(unit: Unit, nationId: string, strategy: AIStrategy): void {
    const choices = this.collectMovementChoices(unit, nationId, strategy);
    if (choices.length === 0) return; // fallback: hold position

    const candidates = choices.map((choice) => choice.candidate);
    const best = pickBestMovementCandidate(candidates, strategy);
    if (!best) return;

    const chosen = choices.find((c) => c.candidate === best);
    if (!chosen) return;

    // A combat unit that ended on holdPosition while inside the staging ring
    // of any known enemy is the "army holding the line" case — log it once
    // per nation per round so the ongoing presence is visible.
    if (
      chosen.candidate.kind === 'holdPosition'
      && unit.unitType.baseStrength > 0
      && this.shouldStageMilitary(nationId)
      && this.isWithinAnyStagingDistance({ x: unit.tileX, y: unit.tileY }, nationId)
    ) {
      this.logStagingHoldingOncePerRound(nationId);
    }

    if (!chosen.path) return; // holdPosition or unreachable: nothing to walk

    this.movementSystem.moveAlongPath(unit, chosen.path);

    if (chosen.candidate.kind === 'militaryInterest') {
      this.logStagingAdvanceOncePerRound(nationId);
    }
  }

  private collectMovementChoices(
    unit: Unit,
    nationId: string,
    strategy: AIStrategy,
  ): { candidate: AIMovementCandidate; path: Tile[] | null }[] {
    const choices: { candidate: AIMovementCandidate; path: Tile[] | null }[] = [];
    const unitPos = { x: unit.tileX, y: unit.tileY };
    const engageDistance = strategy.military.engageDistance;

    // Enemy cities — approach via adjacent tile, gated by engageDistance.
    for (const city of this.cityManager.getAllCities()) {
      if (city.ownerId === nationId) continue;
      const dest = { x: city.tileX, y: city.tileY };
      const distance = this.gridSystem.getDistance(unitPos, dest);
      if (distance > engageDistance) continue;

      const path = this.findApproachPath(unit, dest);
      choices.push({
        candidate: this.buildMovementCandidate(
          dest,
          'enemyCity',
          distance,
          path,
          nationId,
        ),
        path,
      });
    }

    // Enemy units — approach adjacently, also gated by engageDistance.
    for (const enemy of this.unitManager.getAllUnits()) {
      if (enemy.ownerId === nationId) continue;
      const dest = { x: enemy.tileX, y: enemy.tileY };
      const distance = this.gridSystem.getDistance(unitPos, dest);
      if (distance > engageDistance) continue;

      const path = this.findApproachPath(unit, dest);
      choices.push({
        candidate: this.buildMovementCandidate(
          dest,
          'enemyUnit',
          distance,
          path,
          nationId,
        ),
        path,
      });
    }

    // Own cities — useful for defensive strategies and pulling back to safety.
    for (const ownCity of this.cityManager.getCitiesByOwner(nationId)) {
      const dest = { x: ownCity.tileX, y: ownCity.tileY };
      if (dest.x === unitPos.x && dest.y === unitPos.y) continue;
      const distance = this.gridSystem.getDistance(unitPos, dest);

      const path = this.findApproachPath(unit, dest);
      choices.push({
        candidate: this.buildMovementCandidate(
          dest,
          'ownCity',
          distance,
          path,
          nationId,
        ),
        path,
      });
    }

    // Friendly settlers — escort opportunities for combat units.
    if (unit.unitType.baseStrength > 0) {
      for (const friendly of this.unitManager.getUnitsByOwner(nationId)) {
        if (friendly.id === unit.id) continue;
        if (friendly.unitType.canFound !== true) continue;
        const dest = { x: friendly.tileX, y: friendly.tileY };
        const distance = this.gridSystem.getDistance(unitPos, dest);
        if (distance > engageDistance) continue;

        const path = this.findApproachPath(unit, dest);
        choices.push({
          candidate: this.buildMovementCandidate(
            dest,
            'settlerEscort',
            distance,
            path,
            nationId,
          ),
          path,
        });
      }
    }

    // Military staging — push combat units toward a shared staging tile
    // outside each known enemy city. All units of this nation rally to the
    // SAME staging tile per enemy, forming a visible border presence rather
    // than spreading. Suppressed when at war so the existing enemyCity /
    // enemyUnit candidates dominate. Units already inside staging distance
    // do not get a candidate — holdPosition wins, and the move loop logs
    // the hold once per round.
    if (
      unit.unitType.baseStrength > 0
      && this.shouldStageMilitary(nationId)
    ) {
      for (const entry of this.getMilitaryStagingByEnemy(nationId).values()) {
        if (this.gridSystem.getDistance(unitPos, entry.enemyCity) <= MILITARY_STAGING_DISTANCE) continue;
        if (entry.stagingTile.x === unitPos.x && entry.stagingTile.y === unitPos.y) continue;
        const path = this.findApproachPath(unit, entry.stagingTile);
        const distance = this.gridSystem.getDistance(unitPos, entry.stagingTile);
        choices.push({
          candidate: this.buildMovementCandidate(
            entry.stagingTile,
            'militaryInterest',
            distance,
            path,
            nationId,
          ),
          path,
        });
      }
    }

    // Hold position is always a valid fallback so the unit picks something.
    choices.push({
      candidate: this.buildMovementCandidate(
        unitPos,
        'holdPosition',
        0,
        null,
        nationId,
      ),
      path: null,
    });

    // Military units no longer pick "exploration" as a destination.
    // Exploration is the scouts' job (see AIExplorationSystem); armies should
    // act on already-discovered information rather than wander into unseen
    // territory looking for enemies.

    // TODO: apply weights.aggression / weights.defense to combat candidates
    // once those weights are validated to not regress current combat balance.
    // TODO: add 'frontline' candidates once front detection helpers exist.
    return choices;
  }

  private buildMovementCandidate(
    destination: GridCoord,
    kind: AIMovementCandidate['kind'],
    distance: number,
    path: Tile[] | null,
    nationId: string,
    explorationScore?: number,
  ): AIMovementCandidate {
    const isReachable = kind === 'holdPosition' ? true : path !== null;
    const pathCost = path ? this.getPathCost(path) : 0;

    return {
      destination,
      kind,
      distance,
      pathCost,
      isReachable,
      isNearOwnCity: this.isNearOwnCity(destination, nationId),
      isNearEnemyCity: this.isNearEnemyCity(destination, nationId),
      isNearEnemyUnit: this.isNearEnemyUnit(destination, nationId),
      explorationScore,
    };
  }

  private findApproachPath(unit: Unit, target: GridCoord): Tile[] | null {
    const targets = [target, ...this.gridSystem.getAdjacentCoords(target)];
    return this.pathfindingSystem.findBestPathToAnyTarget(unit, targets, {
      respectMovementPoints: false,
    });
  }

  private getPathCost(path: Tile[]): number {
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
      cost += getTileMovementCost(path[i]);
    }
    return cost;
  }

  private isNearEnemyCity(position: GridCoord, nationId: string): boolean {
    for (const city of this.cityManager.getAllCities()) {
      if (city.ownerId === nationId) continue;
      const dist = this.gridSystem.getDistance(
        { x: city.tileX, y: city.tileY },
        position,
      );
      if (dist <= NEAR_OWN_CITY_DISTANCE) return true;
    }
    return false;
  }

  private isNearEnemyUnit(position: GridCoord, nationId: string): boolean {
    for (const enemy of this.unitManager.getAllUnits()) {
      if (enemy.ownerId === nationId) continue;
      const dist = this.gridSystem.getDistance(
        { x: enemy.tileX, y: enemy.tileY },
        position,
      );
      if (dist <= NEAR_OWN_CITY_DISTANCE) return true;
    }
    return false;
  }

  private getStrategy(nationId: string): AIStrategy {
    const nation = this.nationManager.getNation(nationId);
    return getAIStrategyById(nation?.aiStrategyId);
  }

  private canTakeAggressiveAction(unit: Unit, strategy: AIStrategy): boolean {
    const healthRatio = unit.health / unit.unitType.baseHealth;
    if (healthRatio < strategy.military.minAttackHealthRatio) return false;
    if (this.hasFriendlySupport(unit, FRIENDLY_SUPPORT_DISTANCE)) return true;
    return healthRatio >= Math.min(1, strategy.military.minAttackHealthRatio + 0.15);
  }

  private hasFriendlySupport(unit: Unit, distance: number): boolean {
    return this.unitManager.getUnitsByOwner(unit.ownerId)
      .some((other) => {
        if (other.id === unit.id) return false;
        if (other.unitType.baseStrength <= 0) return false;
        if (other.unitType.isNaval) return false;
        const dist = this.gridSystem.getDistance(
          { x: other.tileX, y: other.tileY },
          { x: unit.tileX, y: unit.tileY },
        );
        return dist <= distance;
      });
  }

  // ─── Production ──────────────────────────────────────────────────────────────

  private runProduction(nationId: string): void {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    this.updateAndLogAIPhase(nationId);
    this.ensureScoutProduction(nationId, cities);
    this.ensureFoundationSettlerProduction(nationId, cities);
    this.ensureNavalReconProduction(nationId, cities);

    const strategy = this.getStrategy(nationId);
    const eraStrategy = this.getActiveEraStrategy(nationId);
    let plannedMilitaryCount = this.countMilitary(nationId);
    let plannedSettlerCount = this.countSettlers(nationId);
    let plannedNavalCount = this.countNavalUnits(nationId);
    let plannedWorkerCount = this.countWorkers(nationId) + this.countQueuedWorkers(nationId);
    let plannedWorkBoatCount = this.countWorkBoats(nationId) + this.countQueuedWorkBoats(nationId);
    const coastalCityCount = this.countCoastalCities(nationId);

    for (const city of cities) {
      if (this.productionSystem.getProduction(city.id)) continue;

      let choice = this.chooseCityProduction(
        city,
        nationId,
        plannedMilitaryCount,
        plannedSettlerCount,
        plannedNavalCount,
        plannedWorkerCount,
        plannedWorkBoatCount,
        coastalCityCount,
        strategy,
        eraStrategy,
      );

      let usedFallback = false;
      if (!choice) {
        choice = this.pickFallbackProduction(city, nationId, strategy, plannedSettlerCount);
        usedFallback = choice !== undefined;
      }

      if (!choice) {
        console.warn(
          this.formatLog(nationId, `AI production in ${city.name}: no valid candidate (queue stays empty)`),
        );
        continue;
      }

      if (usedFallback) {
        console.debug(
          this.formatLog(nationId, `AI production fallback in ${city.name}: ${describeProducible(choice)}`),
        );
      }

      const placement = choice.kind === 'wonder'
        ? this.reserveAIWonderPlacement(city, choice.wonderType)
        : choice.kind === 'building'
          ? this.reserveAIBuildingPlacement(city, choice.buildingType)
          : undefined;
      if (choice.kind === 'wonder' && !placement) {
        console.warn(
          this.formatLog(nationId, `AI production in ${city.name}: skipped ${choice.wonderType.name}, no wonder placement available`),
        );
        continue;
      }
      if (choice.kind === 'building' && this.buildingPlacementSystem && !placement) {
        console.warn(
          this.formatLog(nationId, `AI production in ${city.name}: skipped ${choice.buildingType.name}, no building placement available`),
        );
        continue;
      }

      this.productionSystem.setProduction(city.id, choice, { placement });
      if (choice.kind === 'unit') {
        if (choice.unitType.baseStrength > 0) plannedMilitaryCount++;
        if (choice.unitType.canFound === true) plannedSettlerCount++;
        if (choice.unitType.id === WORKER.id) plannedWorkerCount++;
        if (choice.unitType.isNaval === true && choice.unitType.baseStrength > 0) {
          plannedNavalCount++;
        }
        if (choice.unitType.id === WORK_BOAT.id) plannedWorkBoatCount++;
      }
    }
  }

  // Each AI nation should keep at least this many active recon units in the
  // early game so exploration is done by scouts, not military units.
  private static readonly DESIRED_SCOUT_COUNT = 2;

  private ensureScoutProduction(nationId: string, cities: City[]): void {
    if (cities.length === 0) return;
    const activeScouts = this.unitManager.getUnitsByOwner(nationId)
      .filter((unit) => unit.unitType.id === SCOUT.id).length;
    const queuedScouts = this.countQueuedScouts(nationId);
    if (activeScouts + queuedScouts >= AISystem.DESIRED_SCOUT_COUNT) return;
    if (!this.canBuildUnit(nationId, SCOUT.id)) return;

    // Enqueue at most one scout per pass — runProduction is per-turn, so the
    // next turn will enqueue another if we are still short.
    const city = cities.find((candidate) => (
      canCityProduceUnit(candidate, SCOUT, this.mapData, this.gridSystem, {
        strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
      })
    ));
    if (!city) return;

    this.productionSystem.enqueueFront(city.id, { kind: 'unit', unitType: SCOUT });
    const planned = activeScouts + queuedScouts + 1;
    console.debug(
      this.formatLog(nationId, `AI production in ${city.name}: prioritized Scout (${planned}/${AISystem.DESIRED_SCOUT_COUNT})`),
    );
  }

  private countQueuedScouts(nationId: string): number {
    let count = 0;
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      for (const entry of this.productionSystem.getQueue(city.id)) {
        if (entry.item.kind === 'unit' && entry.item.unitType.id === SCOUT.id) count++;
      }
    }
    return count;
  }

  private ensureNavalReconProduction(nationId: string, cities: City[]): void {
    if (cities.length === 0) return;
    if (!this.canBuildUnit(nationId, SCOUT_BOAT.id)) return;

    const coastalCities = cities.filter((city) => cityHasWaterTile(city, this.mapData));
    if (coastalCities.length === 0) return;

    const plannedNavalRecon = this.countNavalReconUnits(nationId) + this.countQueuedNavalRecon(nationId);
    if (plannedNavalRecon >= DESIRED_EARLY_NAVAL_RECON_COUNT) return;
    if (!this.shouldBuildNavalRecon(nationId, coastalCities)) return;

    const city = coastalCities.find((candidate) => (
      this.productionSystem.getProduction(candidate.id) === undefined &&
      canCityProduceUnit(candidate, SCOUT_BOAT, this.mapData, this.gridSystem, {
        strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
      })
    ));
    if (!city) return;

    this.productionSystem.setProduction(city.id, { kind: 'unit', unitType: SCOUT_BOAT });
    console.debug(
      this.formatLog(nationId, `AI production in ${city.name}: prioritized Scout Boat (${plannedNavalRecon + 1}/${DESIRED_EARLY_NAVAL_RECON_COUNT})`),
    );
  }

  private shouldBuildNavalRecon(nationId: string, coastalCities: readonly City[]): boolean {
    const knownTargets = this.seaResourceMemorySystem.getBestSeaResourceTargetsForNation(nationId).length;
    if (knownTargets < MIN_KNOWN_SEA_RESOURCE_TARGETS) return true;
    return this.hasUnexploredWaterNearCoastalCities(nationId, coastalCities);
  }

  private hasUnexploredWaterNearCoastalCities(nationId: string, coastalCities: readonly City[]): boolean {
    if (!this.explorationMemorySystem) return true;
    for (const city of coastalCities) {
      const tiles = this.gridSystem.getTilesInRange(
        { x: city.tileX, y: city.tileY },
        6,
        this.mapData,
        { includeCenter: false },
      );
      for (const tile of tiles) {
        if (tile.type !== TileType.Coast && tile.type !== TileType.Ocean) continue;
        if (!this.explorationMemorySystem.hasSeenTile(nationId, tile.x, tile.y)) return true;
      }
    }
    return false;
  }

  private countQueuedNavalRecon(nationId: string): number {
    let count = 0;
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      for (const entry of this.productionSystem.getQueue(city.id)) {
        if (
          entry.item.kind === 'unit' &&
          (entry.item.unitType.id === SCOUT_BOAT.id || entry.item.unitType.category === 'naval_recon')
        ) {
          count++;
        }
      }
    }
    return count;
  }

  // Foundation Phase settler push: enqueues a single settler at the front of
  // a producible city's queue when the nation has none active or in flight.
  // Symmetric to ensureScoutProduction so settlers and scouts share the
  // same prioritization mechanism. Strategy Phase falls back to the regular
  // chooseCityProduction settler scoring.
  private ensureFoundationSettlerProduction(nationId: string, cities: City[]): void {
    if (cities.length === 0) return;
    if (this.getAIPhase(nationId) !== 'FOUNDATION') return;
    if (this.isSettlerProductionBlockedByHappiness(nationId)) return;
    if (this.countSettlers(nationId) > 0) return; // already have or queued one
    if (!this.canBuildUnit(nationId, SETTLER.id)) return;

    const city = cities.find((candidate) => (
      canCityProduceUnit(candidate, SETTLER, this.mapData, this.gridSystem, {
        strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
      })
    ));
    if (!city) return;

    this.productionSystem.enqueueFront(city.id, { kind: 'unit', unitType: SETTLER });
    console.log(this.formatLog(nationId, `phase: FOUNDATION - producing settler in ${city.name}`));
  }

  /**
   * Deterministic fallback used when scoring yields no candidate (e.g. military
   * cap reached and economy is comfortable). Walks a fixed priority ladder so
   * AI cities never stay idle when something legal is buildable.
   */
  private pickFallbackProduction(
    city: City,
    nationId: string,
    strategy: AIStrategy,
    plannedSettlerCount: number,
  ): Producible | undefined {
    const buildings = this.cityManager.getBuildings(city.id);

    // 1. Defender if no friendly combat unit at or adjacent to the city.
    if (this.needsDefender(city, nationId)) {
      const defender = this.pickAnyValidMilitaryForCity(city, nationId);
      if (defender) return { kind: 'unit', unitType: defender };
    }

    // 2. Settler if the nation is still below its strategy's desired city count.
    const cityCount = this.cityManager.getCitiesByOwner(nationId).length;
    if (
      cityCount < strategy.expansion.desiredCityCount &&
      plannedSettlerCount === 0 &&
      this.canBuildUnit(nationId, SETTLER.id) &&
      canCityProduceUnit(city, SETTLER, this.mapData, this.gridSystem, {
        strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
      }) &&
      !this.isSettlerProductionBlockedByHappiness(nationId)
    ) {
      return { kind: 'unit', unitType: SETTLER };
    }

    // 3-5. Core economy buildings (granary -> workshop -> market) if missing.
    for (const buildingType of [GRANARY, WORKSHOP, MARKET]) {
      if (!buildings.has(buildingType.id) && this.canBuildBuilding(nationId, buildingType.id)) {
        return { kind: 'building', buildingType };
      }
    }

    // 6-7. Warrior, then Archer if the city can actually build them.
    for (const unitType of [WARRIOR, ARCHER]) {
      if (
        this.canBuildUnit(nationId, unitType.id) &&
        canCityProduceUnit(city, unitType, this.mapData, this.gridSystem, {
          strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
        })
      ) {
        return { kind: 'unit', unitType };
      }
    }

    // 8. Any valid producible military unit (cheapest first).
    const anyMilitary = this.pickAnyValidMilitaryForCity(city, nationId);
    if (anyMilitary) return { kind: 'unit', unitType: anyMilitary };

    return undefined;
  }

  private pickAnyValidMilitaryForCity(city: City, nationId: string): UnitType | undefined {
    const candidates = MILITARY_OPTIONS.filter((u) => (
      this.canBuildUnit(nationId, u.id) &&
      canCityProduceUnit(city, u, this.mapData, this.gridSystem, {
        strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
      })
    ));
    if (candidates.length === 0) return undefined;
    return candidates.reduce((a, b) => (a.productionCost <= b.productionCost ? a : b));
  }

  private countMilitary(nationId: string): number {
    return this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.baseStrength > 0)
      .length;
  }

  private countNavalUnits(nationId: string): number {
    return this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.isNaval === true && u.unitType.baseStrength > 0)
      .length;
  }

  private countNavalReconUnits(nationId: string): number {
    return this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.id === SCOUT_BOAT.id || u.unitType.category === 'naval_recon')
      .length;
  }

  private countWorkBoats(nationId: string): number {
    return this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.id === WORK_BOAT.id)
      .length;
  }

  private countWorkers(nationId: string): number {
    return this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.id === WORKER.id)
      .length;
  }

  private countQueuedWorkers(nationId: string): number {
    let count = 0;
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const current = this.productionSystem.getProduction(city.id);
      if (current?.item.kind === 'unit' && current.item.unitType.id === WORKER.id) count++;
      for (const entry of this.productionSystem.getQueue(city.id)) {
        if (entry.item.kind === 'unit' && entry.item.unitType.id === WORKER.id) count++;
      }
    }
    return count;
  }

  private countQueuedWorkBoats(nationId: string): number {
    let count = 0;
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const current = this.productionSystem.getProduction(city.id);
      if (current?.item.kind === 'unit' && current.item.unitType.id === WORK_BOAT.id) count++;
      for (const entry of this.productionSystem.getQueue(city.id)) {
        if (entry.item.kind === 'unit' && entry.item.unitType.id === WORK_BOAT.id) count++;
      }
    }
    return count;
  }

  private countCoastalCities(nationId: string): number {
    return this.cityManager.getCitiesByOwner(nationId)
      .filter((city) => cityHasWaterTile(city, this.mapData))
      .length;
  }

  private countSettlers(nationId: string): number {
    const existing = this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.canFound === true)
      .length;
    let queued = 0;
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const current = this.productionSystem.getProduction(city.id);
      if (
        current?.item.kind === 'unit' &&
        current.item.unitType.canFound === true
      ) {
        queued++;
      }
    }
    return existing + queued;
  }

  private chooseCityProduction(
    city: City,
    nationId: string,
    plannedMilitaryCount: number,
    plannedSettlerCount: number,
    plannedNavalCount: number,
    plannedWorkerCount: number,
    plannedWorkBoatCount: number,
    coastalCityCount: number,
    strategy: AIStrategy,
    eraStrategy: AILeaderEraStrategy,
  ): Producible | undefined {
    const buildings = this.cityManager.getBuildings(city.id);
    const economy = calculateCityEconomy(
      city,
      this.mapData,
      buildings,
      this.gridSystem,
      EMPTY_MODIFIERS,
    );

    const inFoundation = this.getAIPhase(nationId) === 'FOUNDATION';
    const buildingBoost = inFoundation ? SCORE_FOUNDATION_BUILDING_BOOST : 0;
    // Foundation Phase reaches for happiness buildings much earlier so the
    // 2-3 city ramp doesn't strand the nation in negative happiness.
    const happinessBuildingThreshold = inFoundation
      ? FOUNDATION_HAPPINESS_BUILDING_THRESHOLD
      : Math.max(AI_HAPPINESS_LOW, eraStrategy.happinessBehavior?.stabilizationThreshold ?? AI_HAPPINESS_LOW);
    const criticalHappinessThreshold = Math.max(
      AI_HAPPINESS_CRITICAL,
      eraStrategy.happinessBehavior?.criticalThreshold ?? AI_HAPPINESS_CRITICAL,
    );
    const happiness = this.happinessSystem?.getNationState(nationId);
    const happinessBuilding = (happiness && happiness.netHappiness <= happinessBuildingThreshold)
      ? this.findBuildableHappinessBuilding(nationId, buildings)
      : null;

    if (
      happiness
      && happiness.netHappiness <= criticalHappinessThreshold
      && happinessBuilding
    ) {
      console.debug(
        this.formatLog(nationId, `AI prioritizing ${happinessBuilding.name} due to happiness stabilization priority (${happiness.netHappiness}, state: ${happiness.state}).`),
      );
      return { kind: 'building', buildingType: happinessBuilding };
    }
    const canBuildMilitary = plannedMilitaryCount < strategy.military.maxUnits;
    const defensivePressure = this.isDefensivePressureActive(nationId);
    const cityCount = this.cityManager.getCitiesByOwner(nationId).length;
    const wantsMoreCities = cityCount < strategy.expansion.desiredCityCount;
    const canProduceSettler =
      this.canBuildUnit(nationId, SETTLER.id) &&
      canCityProduceUnit(city, SETTLER, this.mapData, this.gridSystem, {
        strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
      });
    const goldPerTurn = this.nationManager.getResources(nationId).goldPerTurn;

    // Build candidates from preferred to fallback so ties resolve sensibly.
    const candidates: AIProductionCandidate[] = [];

    if (canBuildMilitary && this.needsDefender(city, nationId)) {
      candidates.push({
        item: { kind: 'unit', unitType: this.pickMilitaryUnitForCity(city, nationId) },
        baseScore: this.getMilitaryProductionScore(SCORE_ACUTE_DEFENDER, nationId, eraStrategy, true, false),
        category: 'military',
      });
    }

    if (
      wantsMoreCities
      && plannedSettlerCount === 0
      && canProduceSettler
    ) {
      if (this.isSettlerProductionBlockedByHappiness(nationId)) {
        this.logSettlerHappinessDelayOnce(nationId, eraStrategy, happiness?.netHappiness);
      } else {
        candidates.push({
          item: { kind: 'unit', unitType: SETTLER },
          baseScore: this.getSettlerProductionScore(SCORE_SETTLER, eraStrategy, happiness?.netHappiness),
          category: 'settler',
        });
      }
    }

    if (canBuildMilitary) {
      candidates.push({
        item: { kind: 'unit', unitType: this.pickMilitaryUnitForCity(city, nationId) },
        baseScore: this.getMilitaryProductionScore(SCORE_MILITARY, nationId, eraStrategy, defensivePressure),
        category: 'military',
      });
    }

    if (
      canBuildMilitary &&
      coastalCityCount > 0 &&
      cityHasWaterTile(city, this.mapData) &&
      plannedNavalCount < coastalCityCount
    ) {
      const navalUnit = this.pickNavalUnitForCity(city, nationId);
      if (navalUnit) {
        candidates.push({
          item: { kind: 'unit', unitType: navalUnit },
          baseScore: this.getMilitaryProductionScore(SCORE_NAVAL, nationId, eraStrategy, defensivePressure),
          category: 'military',
        });
      }
    }

    if (
      eraStrategy.productionWeights.worker !== undefined &&
      plannedWorkerCount < Math.max(1, cityCount) &&
      this.canBuildUnit(nationId, WORKER.id) &&
      canCityProduceUnit(city, WORKER, this.mapData, this.gridSystem, {
        strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
      })
    ) {
      console.debug(
        this.formatLog(nationId, `AI worker prioritized in ${city.name} (strategy: ${eraStrategy.id}).`),
      );
      candidates.push({
        item: { kind: 'unit', unitType: WORKER },
        baseScore: SCORE_WORKER,
        category: 'worker',
      });
    }

    const workBoatTarget = this.pickBestWorkBoatTargetForProduction(nationId);
    if (
      eraStrategy.resourcePriorities?.workBoatProduction !== undefined &&
      workBoatTarget !== null &&
      cityHasWaterTile(city, this.mapData) &&
      plannedWorkBoatCount < this.getMaxWorkBoatsForStrategy(nationId, eraStrategy) &&
      this.canBuildUnit(nationId, WORK_BOAT.id) &&
      canCityProduceUnit(city, WORK_BOAT, this.mapData, this.gridSystem, {
        strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
      })
    ) {
      const priority = eraStrategy.resourcePriorities?.workBoatProduction ?? 1;
      candidates.push({
        item: { kind: 'unit', unitType: WORK_BOAT },
        baseScore: (SCORE_WORK_BOAT + workBoatTarget.scoreBase) * priority,
        category: 'workBoat',
      });
    }

    if (
      economy.netFood <= strategy.production.lowNetFoodThreshold &&
      !buildings.has(GRANARY.id) &&
      this.canBuildBuilding(nationId, GRANARY.id)
    ) {
      candidates.push({
        item: { kind: 'building', buildingType: GRANARY },
        baseScore: SCORE_FOOD_BUILDING + buildingBoost,
        category: 'foodBuilding',
      });
    }

    if (
      economy.production <= strategy.production.lowProductionThreshold &&
      !buildings.has(WORKSHOP.id) &&
      this.canBuildBuilding(nationId, WORKSHOP.id)
    ) {
      candidates.push({
        item: { kind: 'building', buildingType: WORKSHOP },
        baseScore: SCORE_PRODUCTION_BUILDING + buildingBoost,
        category: 'productionBuilding',
      });
    }

    if (
      goldPerTurn <= LOW_GOLD_PER_TURN &&
      !buildings.has(MARKET.id) &&
      this.canBuildBuilding(nationId, MARKET.id)
    ) {
      candidates.push({
        item: { kind: 'building', buildingType: MARKET },
        baseScore: SCORE_GOLD_BUILDING + buildingBoost,
        category: 'goldBuilding',
      });
    }

    const cultureBuilding = this.findMissingCultureBuilding(nationId, buildings);
    if (cultureBuilding) {
      candidates.push({
        item: { kind: 'building', buildingType: cultureBuilding },
        baseScore: this.getCultureBuildingProductionScore(cultureBuilding) + buildingBoost,
        category: 'cultureBuilding',
      });
    }

    const wonder = this.pickBestAvailableWorldWonder(city, nationId, eraStrategy);
    if (wonder) {
      candidates.push({
        item: { kind: 'wonder', wonderType: wonder },
        baseScore: this.getWorldWonderProductionScore(wonder),
        category: 'wonder',
      });
    }

    const economicScienceBuilding = this.findMissingEconomicScienceBuilding(nationId, buildings);
    if (economicScienceBuilding) {
      candidates.push({
        item: { kind: 'building', buildingType: economicScienceBuilding },
        baseScore: SCORE_FALLBACK + buildingBoost,
        category: this.getInfrastructureProductionCategory(economicScienceBuilding),
      });
    }

    if (happinessBuilding) {
      console.debug(
        this.formatLog(nationId, `AI prioritizing happiness building ${happinessBuilding.name} due to low happiness (${happiness?.netHappiness}, state: ${happiness?.state}).`),
      );
      candidates.push({
        item: { kind: 'building', buildingType: happinessBuilding },
        baseScore: SCORE_HAPPINESS_BUILDING_LOW + buildingBoost,
        category: 'happinessBuilding',
      });
    }

    // Fallback so the city always has something to do when room is left.
    if (canBuildMilitary) {
      candidates.push({
        item: { kind: 'unit', unitType: this.pickMilitaryUnitForCity(city, nationId) },
        baseScore: this.getMilitaryProductionScore(SCORE_FALLBACK, nationId, eraStrategy, defensivePressure),
        category: 'military',
      });
    }

    // Foundation Phase: if the city has any unbuilt available building, offer
    // it as a fallback ranked above fallback military. Keeps cities improving
    // their base instead of churning warriors when no urgent need fired.
    if (inFoundation) {
      const missingBuilding = this.findMissingBuildableBuilding(nationId, buildings);
      if (missingBuilding) {
        candidates.push({
          item: { kind: 'building', buildingType: missingBuilding },
          baseScore: SCORE_FALLBACK + buildingBoost,
          category: this.getInfrastructureProductionCategory(missingBuilding),
        });
      }
    }

    const nation = this.nationManager.getNation(nationId);
    const goalWeights = getProductionWeights(nation?.aiGoals);
    const weightedCandidates = applyGoalWeights(candidates, goalWeights);
    const cityFocus = city.focus ?? 'balanced';
    const rhythmPick = this.pickProductionRhythmCandidate(
      city,
      nationId,
      strategy,
      eraStrategy,
      cityFocus,
      happiness?.netHappiness,
      happinessBuildingThreshold,
    );
    const best = rhythmPick ?? pickBestAIProductionCandidate(weightedCandidates, strategy, eraStrategy, cityFocus);
    if (best) {
      if (cityFocus !== 'balanced') {
        const itemName = this.foundationProducibleName(best.item);
        const score = scoreAIProductionCandidate(best, strategy, eraStrategy, cityFocus);
        const message = `${city.name} production focus ${cityFocus} selected ${itemName}, score ${Math.round(score)}.`;
        console.log(this.formatLog(nationId, message));
        this.logStrategicEvent?.(nationId, this.formatLog(nationId, message));
      }
      if (best.item.kind === 'unit' && best.item.unitType.id === WORK_BOAT.id && workBoatTarget !== null) {
        const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
        console.log(
          this.formatLog(
            nationId,
            `${nationName} / ${city.name} selected Work Boat (strategy: ${eraStrategy.id}, reason: known sea resource ${workBoatTarget.resourceId} at (${workBoatTarget.x},${workBoatTarget.y}))`,
          ),
        );
      }
      console.log(
        this.formatLog(nationId, `AI production chose ${getCandidateGoalCategory(best)} (weights: ${JSON.stringify(goalWeights)})`),
      );
      if (best.item.kind === 'building' && this.isCultureBuilding(best.item.buildingType)) {
        console.log(
          this.formatLog(nationId, `prioritizing culture building: ${best.item.buildingType.name}`),
        );
      }
      if (best.item.kind === 'wonder') {
        console.log(
          this.formatLog(nationId, `prioritizing World Wonder: ${best.item.wonderType.name}`),
        );
      }
      const itemName = this.foundationProducibleName(best.item);
      const reason = this.describeFoundationProductionReason(best.item);
      console.log(
        this.formatLog(
          nationId,
          `${city.name} selected ${itemName} (strategy: ${eraStrategy.id}, reason: ${reason})`,
        ),
      );
      if (inFoundation) {
        console.log(
          this.formatLog(nationId, `phase: FOUNDATION - chose ${itemName} for ${reason}`),
        );
      }
    }
    return best?.item;
  }

  private pickProductionRhythmCandidate(
    city: City,
    nationId: string,
    strategy: AIStrategy,
    eraStrategy: AILeaderEraStrategy,
    cityFocus: City['focus'],
    netHappiness: number | undefined,
    happinessBuildingThreshold: number,
  ): AIProductionCandidate | undefined {
    const phase = this.getProductionRhythmPhase(city, nationId, eraStrategy);
    if (!phase) return undefined;

    if (phase === 'war' && this.needsDefender(city, nationId)) return undefined;

    this.logProductionRhythm(
      nationId,
      `${city.name} entered ${phase === 'war' ? 'wartime' : 'peace'} infrastructure phase after ${city.productionRhythm.completedUnitsSinceInfrastructure} completed units.`,
    );

    const candidates = phase === 'war'
      ? this.getWartimeInfrastructureCandidates(city, nationId, netHappiness, happinessBuildingThreshold)
      : this.getPeaceInfrastructureCandidates(city, nationId, eraStrategy);

    if (candidates.length === 0) {
      this.logProductionRhythm(
        nationId,
        `${city.name} skipped infrastructure phase because no valid building or wonder was available.`,
      );
      return undefined;
    }

    const best = pickBestAIProductionCandidate(candidates, strategy, eraStrategy, cityFocus ?? 'balanced');
    if (!best) return undefined;

    this.logProductionRhythm(nationId, `${city.name} production rhythm selected ${this.describeRhythmItem(best.item)}.`);
    return best;
  }

  private getProductionRhythmPhase(
    city: City,
    nationId: string,
    eraStrategy: AILeaderEraStrategy,
  ): ProductionRhythmPhase | undefined {
    const completedUnits = city.productionRhythm.completedUnitsSinceInfrastructure;
    if (this.isNationAtWar(nationId)) {
      const threshold = eraStrategy.productionRhythm?.warUnitsBeforeInfrastructure ?? WAR_UNITS_BEFORE_INFRASTRUCTURE;
      return completedUnits >= threshold ? 'war' : undefined;
    }

    const threshold = eraStrategy.productionRhythm?.peaceUnitsBeforeInfrastructure ?? PEACE_UNITS_BEFORE_INFRASTRUCTURE;
    return completedUnits >= threshold ? 'peace' : undefined;
  }

  private getPeaceInfrastructureCandidates(
    city: City,
    nationId: string,
    eraStrategy: AILeaderEraStrategy,
  ): AIProductionCandidate[] {
    const buildings = this.cityManager.getBuildings(city.id);
    const candidates: AIProductionCandidate[] = [];

    for (const building of ALL_BUILDINGS) {
      if (buildings.has(building.id)) continue;
      if (!this.canCityBuildBuilding(city, nationId, building)) continue;
      candidates.push({
        item: { kind: 'building', buildingType: building },
        baseScore: this.getInfrastructureRhythmBuildingScore(building),
        category: this.getInfrastructureProductionCategory(building),
      });
    }

    const wonder = this.pickBestAvailableWorldWonder(city, nationId, eraStrategy);
    if (wonder) {
      candidates.push({
        item: { kind: 'wonder', wonderType: wonder },
        baseScore: this.getWorldWonderProductionScore(wonder),
        category: 'wonder',
      });
    }

    return candidates;
  }

  private getWartimeInfrastructureCandidates(
    city: City,
    nationId: string,
    netHappiness: number | undefined,
    happinessBuildingThreshold: number,
  ): AIProductionCandidate[] {
    const buildings = this.cityManager.getBuildings(city.id);
    const candidates: AIProductionCandidate[] = [];

    for (const buildingId of WARTIME_INFRASTRUCTURE_BUILDING_IDS) {
      const building = getBuildingById(buildingId);
      if (!building) continue;
      if (buildings.has(building.id)) continue;
      if (!this.canCityBuildBuilding(city, nationId, building)) continue;
      candidates.push({
        item: { kind: 'building', buildingType: building },
        baseScore: SCORE_HAPPINESS_BUILDING_LOW + building.productionCost / 20,
        category: 'happinessBuilding',
      });
    }

    if (candidates.length > 0 || netHappiness === undefined || netHappiness > happinessBuildingThreshold) {
      return candidates;
    }

    const happinessBuilding = this.findBuildableHappinessBuildingForCity(city, nationId, buildings);
    if (happinessBuilding) {
      candidates.push({
        item: { kind: 'building', buildingType: happinessBuilding },
        baseScore: SCORE_HAPPINESS_BUILDING_LOW,
        category: 'happinessBuilding',
      });
    }
    return candidates;
  }

  private getInfrastructureRhythmBuildingScore(building: BuildingType): number {
    return SCORE_FALLBACK
      + building.productionCost / 100
      + (building.modifiers.foodPerTurn ?? 0) * 5
      + (building.modifiers.productionPerTurn ?? 0) * 7
      + (building.modifiers.productionPercent ?? 0)
      + (building.modifiers.happinessPerTurn ?? 0) * 6
      + (building.modifiers.sciencePerTurn ?? 0) * 5
      + (building.modifiers.goldPerTurn ?? 0) * 4
      + (building.modifiers.culturePerTurn ?? 0) * 5
      + (building.modifiers.culturePercent ?? 0);
  }

  private describeRhythmItem(item: Producible): string {
    switch (item.kind) {
      case 'building':
        return `building:${item.buildingType.name}`;
      case 'wonder':
        return `wonder:${item.wonderType.name}`;
      case 'unit':
        return `unit:${item.unitType.name}`;
      case 'corporation':
        return `corporation:${item.corporationType.name}`;
    }
  }

  private logProductionRhythm(nationId: string, message: string): void {
    console.log(this.formatLog(nationId, message));
    this.logStrategicEvent?.(nationId, this.formatLog(nationId, message));
  }

  private getSettlerProductionScore(
    baseScore: number,
    eraStrategy: AILeaderEraStrategy,
    netHappiness: number | undefined,
  ): number {
    const threshold = eraStrategy.happinessBehavior?.stabilizationThreshold;
    if (threshold === undefined || netHappiness === undefined || netHappiness >= threshold) {
      return baseScore;
    }
    return baseScore * 0.55;
  }

  private getMilitaryProductionScore(
    baseScore: number,
    nationId: string,
    eraStrategy: AILeaderEraStrategy,
    defensivePressure: boolean,
    logDefensivePressure = true,
  ): number {
    if (defensivePressure) {
      if (logDefensivePressure) {
        this.logDefensiveModeOnce(nationId, eraStrategy);
      }
      return baseScore / Math.max(eraStrategy.productionWeights.military, 0.1);
    }
    const threshold = eraStrategy.happinessBehavior?.stabilizationThreshold;
    const netHappiness = this.happinessSystem?.getNetHappiness(nationId);
    if (threshold !== undefined && netHappiness !== undefined && netHappiness < threshold) {
      return baseScore * 0.65;
    }
    return baseScore;
  }

  private isDefensivePressureActive(nationId: string): boolean {
    if (this.isAtWarWithAnyone(nationId)) return true;
    const threat = this.getHighestThreatLevel(nationId);
    if (threat === 'medium' || threat === 'high') return true;

    const eraStrategy = this.getActiveEraStrategy(nationId);
    return this.isBelowMinimumMilitaryReadiness(nationId, eraStrategy);
  }

  private logDefensiveModeOnce(nationId: string, eraStrategy: AILeaderEraStrategy): void {
    const currentRound = this.turnManager.getCurrentRound();
    if (this.defensiveModeLoggedRound.get(nationId) === currentRound) return;
    this.defensiveModeLoggedRound.set(nationId, currentRound);
    console.debug(
      this.formatLog(nationId, `AI defensive mode triggered; military production restored under ${eraStrategy.id}.`),
    );
  }

  private isBelowMinimumMilitaryReadiness(
    nationId: string,
    eraStrategy: AILeaderEraStrategy,
  ): boolean {
    const minimumReadiness = eraStrategy.militaryBehavior.minimumMilitaryReadiness;
    if (minimumReadiness <= 1) return false;

    const ownStrength = this.getNationMilitaryStrength(nationId);
    const strongestOtherStrength = this.getStrongestKnownMilitaryStrength(nationId);
    if (strongestOtherStrength <= 0) return false;

    const readinessRatio = ownStrength / strongestOtherStrength;
    const isBelowReadiness = readinessRatio < minimumReadiness;
    if (isBelowReadiness) {
      this.logLowMilitaryReadinessOnce(nationId, eraStrategy, readinessRatio, minimumReadiness);
    }
    return isBelowReadiness;
  }

  private getNationMilitaryStrength(nationId: string): number {
    return this.unitManager.getUnitsByOwner(nationId)
      .filter((unit) => unit.unitType.baseStrength > 0)
      .reduce((total, unit) => total + unit.unitType.baseStrength, 0);
  }

  private getStrongestKnownMilitaryStrength(nationId: string): number {
    let strongest = 0;
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.discoverySystem && !this.discoverySystem.hasMet(nationId, other.id)) continue;
      strongest = Math.max(strongest, this.getNationMilitaryStrength(other.id));
    }
    return strongest;
  }

  private logLowMilitaryReadinessOnce(
    nationId: string,
    eraStrategy: AILeaderEraStrategy,
    readinessRatio: number,
    minimumReadiness: number,
  ): void {
    const currentRound = this.turnManager.getCurrentRound();
    if (this.defensiveModeLoggedRound.get(nationId) === currentRound) return;
    this.defensiveModeLoggedRound.set(nationId, currentRound);
    console.debug(
      this.formatLog(
        nationId,
        `AI increased defensive readiness under ${eraStrategy.id} (military ratio ${readinessRatio.toFixed(2)} below ${minimumReadiness.toFixed(2)}).`,
      ),
    );
  }

  private logSettlerHappinessDelayOnce(
    nationId: string,
    eraStrategy: AILeaderEraStrategy,
    netHappiness: number | undefined,
  ): void {
    const currentRound = this.turnManager.getCurrentRound();
    if (this.settlerHappinessDelayLoggedRound.get(nationId) === currentRound) return;
    this.settlerHappinessDelayLoggedRound.set(nationId, currentRound);
    console.debug(
      this.formatLog(
        nationId,
        `AI delayed settler production under ${eraStrategy.id} due to low happiness (${netHappiness ?? 'unknown'}).`,
      ),
    );
  }

  private pickNavalUnitForCity(city: City, nationId: string): UnitType | undefined {
    const candidates = ALL_UNIT_TYPES.filter((u) => (
      u.isNaval === true &&
      u.baseStrength > 0 &&
      this.canBuildUnit(nationId, u.id) &&
      canCityProduceUnit(city, u, this.mapData, this.gridSystem, {
        strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
      })
    ));
    if (candidates.length === 0) return undefined;
    return candidates.reduce((a, b) => (a.productionCost <= b.productionCost ? a : b));
  }

  private pickBestWorkBoatTargetForProduction(nationId: string): SeaResourceCandidate | null {
    const targets = this.getValidSeaResourceTargetsForWorkBoat(nationId, undefined, {
      requireReachable: false,
      includeAssigned: false,
    });
    return targets[0] ?? null;
  }

  private getMaxWorkBoatsForStrategy(nationId: string, eraStrategy: AILeaderEraStrategy): number {
    const era = this.getNationEra(nationId);
    if (
      eraStrategy.resourcePriorities?.workBoatProduction !== undefined &&
      (era === 'ancient' || era === 'classical')
    ) {
      return MAX_EARLY_WORK_BOATS_COASTAL_FOUNDATION;
    }
    return 1;
  }

  private pickMilitaryUnitForCity(city: City, nationId: string): UnitType {
    const available = MILITARY_OPTIONS.filter((u) => (
      this.canBuildUnit(nationId, u.id) &&
      canCityProduceUnit(city, u, this.mapData, this.gridSystem, {
        strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
      })
    ));
    const archer = available.find((u) => u.id === ARCHER.id);
    if (archer && !this.hasFriendlyRangedUnitNearby(city, nationId)) return archer;
    return available.find((u) => u.id === WARRIOR.id) ?? WARRIOR;
  }

  private canBuildUnit(nationId: string, unitId: string): boolean {
    return this.researchSystem?.isUnitUnlocked(nationId, unitId) ?? true;
  }

  private canBuildBuilding(nationId: string, buildingId: string): boolean {
    return this.researchSystem?.isBuildingUnlocked(nationId, buildingId) ?? true;
  }

  private canCityBuildBuilding(city: City, nationId: string, building: BuildingType): boolean {
    if (!this.canBuildBuilding(nationId, building.id)) return false;
    if (!this.buildingPlacementSystem) return true;
    return this.buildingPlacementSystem.getValidPlacementCoords(city, building, this.mapData).length > 0;
  }

  private findBuildableHappinessBuilding(
    nationId: string,
    buildings: CityBuildings,
  ): BuildingType | null {
    let cheapest: BuildingType | null = null;
    for (const candidate of ALL_BUILDINGS) {
      if ((candidate.modifiers.happinessPerTurn ?? 0) <= 0) continue;
      if (buildings.has(candidate.id)) continue;
      if (!this.canBuildBuilding(nationId, candidate.id)) continue;
      if (!cheapest || candidate.productionCost < cheapest.productionCost) {
        cheapest = candidate;
      }
    }
    return cheapest;
  }

  private findBuildableHappinessBuildingForCity(
    city: City,
    nationId: string,
    buildings: CityBuildings,
  ): BuildingType | null {
    let cheapest: BuildingType | null = null;
    for (const candidate of ALL_BUILDINGS) {
      if ((candidate.modifiers.happinessPerTurn ?? 0) <= 0) continue;
      if (buildings.has(candidate.id)) continue;
      if (!this.canCityBuildBuilding(city, nationId, candidate)) continue;
      if (!cheapest || candidate.productionCost < cheapest.productionCost) {
        cheapest = candidate;
      }
    }
    return cheapest;
  }

  // Cheapest unbuilt available building of any kind. Foundation Phase uses
  // this as a fallback so cities default to infrastructure rather than
  // fallback military when no urgent need fired.
  private findMissingBuildableBuilding(
    nationId: string,
    buildings: CityBuildings,
  ): BuildingType | null {
    let cheapest: BuildingType | null = null;
    for (const candidate of ALL_BUILDINGS) {
      if (buildings.has(candidate.id)) continue;
      if (!this.canBuildBuilding(nationId, candidate.id)) continue;
      if (!cheapest || candidate.productionCost < cheapest.productionCost) {
        cheapest = candidate;
      }
    }
    return cheapest;
  }

  private findMissingEconomicScienceBuilding(
    nationId: string,
    buildings: CityBuildings,
  ): BuildingType | null {
    let cheapest: BuildingType | null = null;
    for (const candidate of ALL_BUILDINGS) {
      if (buildings.has(candidate.id)) continue;
      if (!this.canBuildBuilding(nationId, candidate.id)) continue;
      if (!this.isEconomicScienceBuilding(candidate)) continue;
      if (!cheapest || candidate.productionCost < cheapest.productionCost) {
        cheapest = candidate;
      }
    }
    return cheapest;
  }

  private findMissingCultureBuilding(
    nationId: string,
    buildings: CityBuildings,
  ): BuildingType | null {
    let best: BuildingType | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of ALL_BUILDINGS) {
      if (buildings.has(candidate.id)) continue;
      if (!this.canBuildBuilding(nationId, candidate.id)) continue;
      if (!this.isCultureBuilding(candidate)) continue;

      const score = this.getCultureBuildingProductionScore(candidate) - candidate.productionCost / 20;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  private isCultureBuilding(candidate: BuildingType): boolean {
    const modifiers = candidate.modifiers;
    return (modifiers.culturePerTurn ?? 0) > 0 || (modifiers.culturePercent ?? 0) > 0;
  }

  private getCultureBuildingProductionScore(buildingType: BuildingType): number {
    const modifiers = buildingType.modifiers;
    return SCORE_CULTURE_BUILDING
      + (modifiers.culturePerTurn ?? 0) * 8
      + (modifiers.culturePercent ?? 0) * 1.5;
  }

  private pickBestAvailableWorldWonder(
    city: City,
    nationId: string,
    eraStrategy: AILeaderEraStrategy,
  ): WonderType | null {
    if (!this.wonderSystem || !this.wonderPlacementSystem) return null;
    if ((eraStrategy.productionWeights.wonder ?? 1) <= 1) return null;

    let best: WonderType | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const wonder of ALL_WONDERS) {
      if (!this.wonderSystem.canCityBuildWonder(city, wonder, { researchSystem: this.researchSystem })) continue;
      if (this.isWonderQueued(wonder.id)) continue;
      if (this.wonderPlacementSystem.getValidPlacementCoords(city, wonder, this.mapData).length === 0) continue;

      const score = this.getWorldWonderProductionScore(wonder) - wonder.productionCost / 30;
      if (score > bestScore) {
        best = wonder;
        bestScore = score;
      }
    }
    return best;
  }

  private isWonderQueued(wonderId: string): boolean {
    return this.cityManager.getAllCities().some((city) => (
      this.productionSystem.getQueue(city.id)
        .some((entry) => entry.item.kind === 'wonder' && entry.item.wonderType.id === wonderId)
    ));
  }

  private getWorldWonderProductionScore(wonderType: WonderType): number {
    const modifiers = wonderType.modifiers;
    return SCORE_WORLD_WONDER
      + (modifiers.culturePerTurn ?? 0) * 18
      + (modifiers.culturePercent ?? 0) * 2
      + (modifiers.happinessPerTurn ?? 0) * 4
      + (modifiers.sciencePerTurn ?? 0) * 3;
  }

  private reserveAIWonderPlacement(
    city: City,
    wonderType: WonderType,
  ): { tileX: number; tileY: number } | undefined {
    return this.wonderPlacementSystem?.reserveFirstValidPlacement(city, wonderType, this.mapData);
  }

  private reserveAIBuildingPlacement(
    city: City,
    buildingType: BuildingType,
  ): { tileX: number; tileY: number } | undefined {
    return this.buildingPlacementSystem?.reserveFirstValidPlacement(city, buildingType, this.mapData);
  }

  private isEconomicScienceBuilding(candidate: BuildingType): boolean {
    const modifiers = candidate.modifiers;
    return (modifiers.sciencePerTurn ?? 0) > 0
      || (modifiers.sciencePercent ?? 0) > 0
      || (modifiers.goldPerTurn ?? 0) > 0
      || (modifiers.goldPercent ?? 0) > 0;
  }

  private getInfrastructureProductionCategory(buildingType: BuildingType): AIProductionCandidate['category'] {
    const modifiers = buildingType.modifiers;
    if ((modifiers.culturePerTurn ?? 0) > 0 || (modifiers.culturePercent ?? 0) > 0) {
      return 'cultureBuilding';
    }
    if ((modifiers.sciencePerTurn ?? 0) > 0 || (modifiers.sciencePercent ?? 0) > 0) {
      return 'scienceBuilding';
    }
    if ((modifiers.goldPerTurn ?? 0) > 0 || (modifiers.goldPercent ?? 0) > 0) {
      return 'goldBuilding';
    }
    if ((modifiers.productionPerTurn ?? 0) > 0 || (modifiers.productionPercent ?? 0) > 0) {
      return 'productionBuilding';
    }
    if ((modifiers.happinessPerTurn ?? 0) > 0) return 'happinessBuilding';
    return 'foodBuilding';
  }

  // Short reason tag derived from the chosen producible. Used only for the
  // Foundation Phase production log so traces explain why each city built
  // what it built.
  private describeFoundationProductionReason(item: Producible): string {
    if (item.kind === 'unit') {
      if (item.unitType.id === SETTLER.id) return 'core expansion';
      if (item.unitType.id === SCOUT.id) return 'exploration';
      if (item.unitType.id === SCOUT_BOAT.id || item.unitType.category === 'naval_recon') return 'naval exploration';
      if (item.unitType.canFound === true) return 'core expansion';
      if (item.unitType.isNaval === true) return 'naval coverage';
      return 'defense';
    }
    if (item.kind === 'wonder') return 'wonder';
    if (item.kind === 'corporation') return 'corporation';
    const bt = item.buildingType;
    if ((bt.modifiers.happinessPerTurn ?? 0) > 0) return 'low happiness';
    if (bt.id === GRANARY.id) return 'city growth';
    if (bt.id === WORKSHOP.id) return 'production';
    if (bt.id === MARKET.id) return 'economy';
    if ((bt.modifiers.sciencePerTurn ?? 0) > 0 || (bt.modifiers.sciencePercent ?? 0) > 0) return 'science';
    if ((bt.modifiers.goldPerTurn ?? 0) > 0 || (bt.modifiers.goldPercent ?? 0) > 0) return 'economy';
    return 'infrastructure';
  }

  private foundationProducibleName(item: Producible): string {
    if (item.kind === 'unit') return item.unitType.name;
    if (item.kind === 'wonder') return item.wonderType.name;
    if (item.kind === 'corporation') return item.corporationType.name;
    return item.buildingType.name;
  }

  private needsDefender(city: City, nationId: string): boolean {
    const tilesToCheck = [
      { x: city.tileX, y: city.tileY },
      ...this.gridSystem.getAdjacentCoords({ x: city.tileX, y: city.tileY }),
    ];

    for (const pos of tilesToCheck) {
      const unit = this.unitManager.getUnitAt(pos.x, pos.y);
      if (unit && unit.ownerId === nationId && unit.unitType.baseStrength > 0) return false;
    }

    return true;
  }

  private hasFriendlyRangedUnitNearby(city: City, nationId: string): boolean {
    const tilesToCheck = [
      { x: city.tileX, y: city.tileY },
      ...this.gridSystem.getAdjacentCoords({ x: city.tileX, y: city.tileY }),
    ];

    for (const pos of tilesToCheck) {
      const unit = this.unitManager.getUnitAt(pos.x, pos.y);
      if (
        unit &&
        unit.ownerId === nationId &&
        unit.unitType.baseStrength > 0 &&
        !unit.unitType.isNaval &&
        (unit.unitType.range ?? 1) > 1
      ) {
        return true;
      }
    }

    return false;
  }
}
