import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import type { UnitType } from '../entities/UnitType';
import type { MapData, Tile } from '../types/map';
import type { GridCoord } from '../types/grid';
import type { Producible } from '../types/producible';
import { TileType } from '../types/map';
import { ALL_UNIT_TYPES, WARRIOR, ARCHER, SETTLER } from '../data/units';
import { ALL_BUILDINGS, GRANARY, WORKSHOP, MARKET } from '../data/buildings';
import { getNaturalResourceById } from '../data/naturalResources';
import type { BuildingType } from '../entities/Building';
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
import { calculateCityEconomy } from './CityEconomy';
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
import type { AIMilitaryThreatEvaluationSystem, ThreatLevel } from './ai/AIMilitaryThreatEvaluationSystem';
import {
  pickBestAIProductionCandidate,
  type AIProductionCandidate,
} from './ai/AIProductionScoring';
import {
  applyGoalWeights,
  getCandidateGoalCategory,
  getProductionWeights,
} from './ai/utils/AIProductionGoalWeights';
import { getExpansionBias, hasGoalOfType } from './ai/utils/AIExpansionUtils';
import { getMilitaryIntent } from './ai/utils/AIMilitaryUtils';
import { scoreCombatTarget, type AICombatContext } from './ai/AICombatScoring';
import {
  pickBestMovementCandidate,
  type AIMovementCandidate,
} from './ai/AIMovementScoring';
import { CITY_BASE_HEALTH } from '../data/cities';
import { getLeaderPersonalityByNationId } from '../data/leaders';

// Friendly-support radius is not yet exposed via AIStrategy; preserved here
// so baseline behavior matches the pre-refactor profile.
const FRIENDLY_SUPPORT_DISTANCE = 2;
const NEAR_OWN_CITY_DISTANCE = 3;

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
const SCORE_FALLBACK = 25;
const SCORE_NAVAL = 40;
const LOW_GOLD_PER_TURN = 0;

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
  private readonly mapData: MapData;
  private readonly strategySelector = new AIStrategySelector();
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
    private readonly researchSystem?: ResearchSystem,
    private readonly diplomacyManager?: DiplomacyManager,
    private readonly happinessSystem?: HappinessSystem,
    private readonly threatEvaluationSystem?: AIMilitaryThreatEvaluationSystem,
    private readonly discoverySystem?: DiscoverySystem,
    private readonly tradeDealSystem?: TradeDealSystem,
    private readonly resourceAccessSystem?: ResourceAccessSystem,
    private readonly explorationMemorySystem?: ExplorationMemorySystem,
    private readonly strategicResourceCapacitySystem?: StrategicResourceCapacitySystem,
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
    this.mapData = mapData;
  }

  isHuman(nationId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    return nation?.isHuman ?? false;
  }

  runTurn(nationId: string): void {
    this.updateStrategyForNation(nationId);
    this.markVisibleTilesForNation(nationId);

    const nation = this.nationManager.getNation(nationId);
    if (nation) {
      this.aiGoalSystem.update(nation);
      console.log(
        `[AI Goal Selected] ${nation.name}:`,
        (nation.aiGoals ?? []).map((g) => `${g.type}(${g.priority.toFixed(2)})`).join(', '),
      );
    }

    this.runSettlers(nationId);
    this.runCombat(nationId);
    this.runMovement(nationId);
    this.runProduction(nationId);
    this.runDiplomacyForNation(nationId);
    this.runTradeForNation(nationId);

    if (nation?.aiGoals && nation.aiGoals.length > 0) {
      console.log(
        `[AI Goals] ${nation.name}:`,
        nation.aiGoals.map((g) => `${g.type}(${g.remainingTurns})`).join(', '),
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

  // ─── Diplomacy ───────────────────────────────────────────────────────────────

  private runDiplomacyForNation(nationId: string): void {
    if (!this.diplomacyManager) return;
    const weights = getBehaviorWeights(this.nationManager.getNation(nationId)?.aiStrategyId);
    if (weights.diplomacy <= 0) {
      const name = this.nationManager.getNation(nationId)?.name ?? nationId;
      console.debug(`AI ${name} skipped diplomacy because diplomacy weight is 0.`);
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
          const actor = this.nationManager.getNation(nationId)?.name ?? nationId;
          const target = other.name;
          console.debug(`AI ${actor} established embassy with ${target}`);
        }
      }

      if (!dm.hasTradeRelations(nationId, other.id)) {
        const tradeCheck = dm.canEstablishTradeRelations(nationId, other.id, validationContext);
        if (tradeCheck.ok && dm.establishTradeRelations(nationId, other.id)) {
          const actor = this.nationManager.getNation(nationId)?.name ?? nationId;
          const target = other.name;
          console.debug(`AI ${actor} established trade relations with ${target}`);
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
    const buyerName = this.nationManager.getNation(nationId)?.name ?? nationId;
    let dealsCreated = 0;

    if (luxuryValueMultiplier > 1.0) {
      console.debug(
        `AI ${buyerName} increasing luxury value (x${luxuryValueMultiplier}) due to happiness ${happiness?.netHappiness} (state: ${happiness?.state}).`,
      );
    }

    outer: for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.diplomacyManager.getState(nationId, other.id) === 'WAR') continue;
      if (!this.diplomacyManager.hasTradeRelations(nationId, other.id)) continue;

      const ownedResources = this.resourceAccessSystem.getOwnedResources(other.id);
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
          `AI ${buyerName} bought ${resourceId} from ${other.name} (${dealTurns} turns, ${offerGoldPerTurn} gold/turn)`,
        );
        dealsCreated++;
        if (dealsCreated >= maxDeals) break outer;
      }
    }

    if (dealsCreated > 1) {
      console.debug(`AI ${buyerName} created ${dealsCreated} trade deals due to trade weight ${weights.trade}.`);
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
    }
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

  // ─── Settlers ────────────────────────────────────────────────────────────────

  private runSettlers(nationId: string): void {
    const settlers = this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.canFound);
    const strategy = this.getStrategy(nationId);

    for (const settler of settlers) {
      if (this.unitManager.getUnit(settler.id) === undefined) continue;

      const ownsNoCities = this.cityManager.getCitiesByOwner(nationId).length === 0;
      const isOpeningRound = this.turnManager.getCurrentRound() === 1;

      // Opening-round rule: every AI founds its capital immediately if possible.
      if (isOpeningRound && ownsNoCities && this.foundCitySystem.canFound(settler)) {
        this.foundCitySystem.foundCity(settler);
        continue; // settler consumed
      }

      // Later settlers respect spacing from all existing cities. With an
      // active "expand" goal, the spacing requirement is relaxed deterministically
      // so eager nations settle slightly closer together.
      if (this.foundCitySystem.canFound(settler)) {
        const allCities = this.cityManager.getAllCities();
        const minDist = this.minDistanceToCities(settler.tileX, settler.tileY, allCities);
        const expansionBias = getExpansionBias(this.nationManager.getNation(nationId)?.aiGoals);
        const effectiveMinDist = strategy.expansion.settlerMinCityDistance / expansionBias;
        if (minDist >= effectiveMinDist) {
          this.foundCitySystem.foundCity(settler);
          continue; // settler consumed
        }
      }

      // Move toward valid founding site
      this.moveSettlerTowardSite(settler, nationId, strategy);
    }
  }

  private moveSettlerTowardSite(settler: Unit, nationId: string, strategy: AIStrategy): void {
    const target = this.findFoundingSite(settler, nationId, strategy);
    if (!target) return;

    const path = this.pathfindingSystem.findPath(settler, target.x, target.y, {
      respectMovementPoints: false,
    });
    if (path === null) return;

    this.movementSystem.moveAlongPath(settler, path);

    if (settler.tileX === target.x && settler.tileY === target.y) {
      if (this.foundCitySystem.canFound(settler)) {
        this.foundCitySystem.foundCity(settler);
      }
    }
  }

  private findFoundingSite(
    settler: Unit,
    nationId: string,
    strategy: AIStrategy,
  ): { x: number; y: number } | null {
    const allCities = this.cityManager.getAllCities();
    const nation = this.nationManager.getNation(nationId);
    const goals = nation?.aiGoals;
    const expansionBias = getExpansionBias(goals);
    const effectiveMinCityDistance = strategy.expansion.settlerMinCityDistance / expansionBias;
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

        const cityDist = this.minDistanceToCities(x, y, allCities);
        if (cityDist < effectiveMinCityDistance) continue;

        const settlerDist = this.gridSystem.getDistance(
          { x: settler.tileX, y: settler.tileY },
          { x, y },
        );
        const score = this.scoreFoundingTile(tile, settlerDist, capital, {
          wantsResources,
          wantsCoast,
          hasExpandGoal,
        });

        if (score > bestScore) {
          bestScore = score;
          bestTile = { x, y };
        }
      }
    }

    if (bestTile) {
      const nationName = nation?.name ?? nationId;
      console.log(
        `[AI Expansion] ${nationName}: targeting tile (${bestTile.x}, ${bestTile.y})`,
      );
    }

    return bestTile;
  }

  private scoreFoundingTile(
    tile: Tile,
    settlerDist: number,
    capital: City | undefined,
    intents: { wantsResources: boolean; wantsCoast: boolean; hasExpandGoal: boolean },
  ): number {
    let score = this.computeCoastalSiteBonus({ x: tile.x, y: tile.y }) - settlerDist;

    if (tile.resourceId !== undefined) score += 5;

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

  private computeCoastalSiteBonus(coord: GridCoord): number {
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
    if (coastCount > 0) bonus += COASTAL_SITE_BONUS;
    bonus += coastCount * COASTAL_TILE_BONUS;
    bonus += waterResourceCount * WATER_RESOURCE_BONUS;
    return bonus;
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
      const name = this.nationManager.getNation(nationId)?.name ?? nationId;
      console.debug(`AI ${name} exploration score adjusted by strategy weight ${weights.exploration}.`);
    }

    // Naval state shared across this nation's ships for the turn: defines
    // where we want to defend and which tiles are already claimed/occupied,
    // so multiple ships spread out instead of stacking.
    const navalContext = this.buildNavalPatrolContext(nationId);

    for (const unit of units) {
      if (unit.movementPoints <= 0) continue;
      if (unit.unitType.canFound) continue; // settlers handled in runSettlers
      if (this.unitManager.getUnit(unit.id) === undefined) continue;

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

  // Strategy-based movement scoring shapes where AI units want to go,
  // while existing pathfinding and movement rules still decide how they move.
  private moveByStrategyScoring(unit: Unit, nationId: string, strategy: AIStrategy): void {
    const choices = this.collectMovementChoices(unit, nationId, strategy);
    if (choices.length === 0) return; // fallback: hold position

    const candidates = choices.map((choice) => choice.candidate);
    const best = pickBestMovementCandidate(candidates, strategy);
    if (!best) return;

    const chosen = choices.find((c) => c.candidate === best);
    if (!chosen || !chosen.path) return; // holdPosition or unreachable

    this.movementSystem.moveAlongPath(unit, chosen.path);
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

    // Exploration — pick the most "curious" tile in range so idle units
    // wander toward unseen territory instead of holding position.
    // Strategy weight 0 disables this entirely; weight 2 doubles its appeal.
    const weights = getBehaviorWeights(this.nationManager.getNation(nationId)?.aiStrategyId);
    if (this.explorationMemorySystem && weights.exploration > 0) {
      const currentTurn = this.turnManager.getCurrentRound();
      const tilesInRange = this.gridSystem.getTilesInRange(
        unitPos,
        engageDistance,
        this.mapData,
        { includeCenter: false },
      );
      let bestTile: Tile | null = null;
      let bestScore = 0;
      for (const tile of tilesInRange) {
        if (tile.type === TileType.Ocean || tile.type === TileType.Coast || tile.type === TileType.Ice) continue;
        const score = this.explorationMemorySystem.getExplorationScore(nationId, tile, currentTurn);
        if (score > bestScore) {
          bestScore = score;
          bestTile = tile;
        }
      }
      if (bestTile) {
        const dest = { x: bestTile.x, y: bestTile.y };
        const path = this.findApproachPath(unit, dest);
        const distance = this.gridSystem.getDistance(unitPos, dest);
        choices.push({
          candidate: this.buildMovementCandidate(
            dest,
            'exploration',
            distance,
            path,
            nationId,
            bestScore * weights.exploration,
          ),
          path,
        });
      }
    }

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
    const strategy = this.getStrategy(nationId);
    let plannedMilitaryCount = this.countMilitary(nationId);
    let plannedSettlerCount = this.countSettlers(nationId);
    let plannedNavalCount = this.countNavalUnits(nationId);
    const coastalCityCount = this.countCoastalCities(nationId);

    for (const city of cities) {
      if (this.productionSystem.getProduction(city.id)) continue;

      let choice = this.chooseCityProduction(
        city,
        nationId,
        plannedMilitaryCount,
        plannedSettlerCount,
        plannedNavalCount,
        coastalCityCount,
        strategy,
      );

      let usedFallback = false;
      if (!choice) {
        choice = this.pickFallbackProduction(city, nationId, strategy, plannedSettlerCount);
        usedFallback = choice !== undefined;
      }

      if (!choice) {
        const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
        console.warn(
          `[AI Production] ${nationName}/${city.name}: no valid candidate (queue stays empty)`,
        );
        continue;
      }

      if (usedFallback) {
        const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
        console.debug(
          `[AI Production Fallback] ${nationName}/${city.name}: ${describeProducible(choice)}`,
        );
      }

      this.productionSystem.setProduction(city.id, choice);
      if (choice.kind === 'unit') {
        if (choice.unitType.baseStrength > 0) plannedMilitaryCount++;
        if (choice.unitType.canFound === true) plannedSettlerCount++;
        if (choice.unitType.isNaval === true && choice.unitType.baseStrength > 0) {
          plannedNavalCount++;
        }
      }
    }
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
      })
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
    coastalCityCount: number,
    strategy: AIStrategy,
  ): Producible | undefined {
    const buildings = this.cityManager.getBuildings(city.id);
    const economy = calculateCityEconomy(
      city,
      this.mapData,
      buildings,
      this.gridSystem,
      EMPTY_MODIFIERS,
    );

    const happiness = this.happinessSystem?.getNationState(nationId);
    const happinessBuilding = (happiness && happiness.netHappiness <= AI_HAPPINESS_LOW)
      ? this.findBuildableHappinessBuilding(nationId, buildings)
      : null;

    if (
      happiness
      && happiness.netHappiness <= AI_HAPPINESS_CRITICAL
      && happinessBuilding
    ) {
      const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
      console.debug(
        `AI ${nationName} prioritizing ${happinessBuilding.name} due to critical happiness (${happiness.netHappiness}, state: ${happiness.state}).`,
      );
      return { kind: 'building', buildingType: happinessBuilding };
    }
    const canBuildMilitary = plannedMilitaryCount < strategy.military.maxUnits;
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
        baseScore: SCORE_ACUTE_DEFENDER,
        category: 'military',
      });
    }

    if (wantsMoreCities && plannedSettlerCount === 0 && canProduceSettler) {
      candidates.push({
        item: { kind: 'unit', unitType: SETTLER },
        baseScore: SCORE_SETTLER,
        category: 'settler',
      });
    }

    if (canBuildMilitary) {
      candidates.push({
        item: { kind: 'unit', unitType: this.pickMilitaryUnitForCity(city, nationId) },
        baseScore: SCORE_MILITARY,
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
          baseScore: SCORE_NAVAL,
          category: 'military',
        });
      }
    }

    if (
      economy.netFood <= strategy.production.lowNetFoodThreshold &&
      !buildings.has(GRANARY.id) &&
      this.canBuildBuilding(nationId, GRANARY.id)
    ) {
      candidates.push({
        item: { kind: 'building', buildingType: GRANARY },
        baseScore: SCORE_FOOD_BUILDING,
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
        baseScore: SCORE_PRODUCTION_BUILDING,
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
        baseScore: SCORE_GOLD_BUILDING,
        category: 'goldBuilding',
      });
    }

    if (happinessBuilding) {
      const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
      console.debug(
        `AI ${nationName} prioritizing happiness building ${happinessBuilding.name} due to low happiness (${happiness?.netHappiness}, state: ${happiness?.state}).`,
      );
      candidates.push({
        item: { kind: 'building', buildingType: happinessBuilding },
        baseScore: SCORE_HAPPINESS_BUILDING_LOW,
        // foodBuilding category reused: scoring weight is consistent across
        // strategies (=1) so the boosted baseScore drives the priority.
        category: 'foodBuilding',
      });
    }

    // Fallback so the city always has something to do when room is left.
    if (canBuildMilitary) {
      candidates.push({
        item: { kind: 'unit', unitType: this.pickMilitaryUnitForCity(city, nationId) },
        baseScore: SCORE_FALLBACK,
        category: 'military',
      });
    }

    const nation = this.nationManager.getNation(nationId);
    const goalWeights = getProductionWeights(nation?.aiGoals);
    const weightedCandidates = applyGoalWeights(candidates, goalWeights);
    const best = pickBestAIProductionCandidate(weightedCandidates, strategy);
    if (best) {
      const nationName = nation?.name ?? nationId;
      console.log(
        `[AI Production] ${nationName}: chose ${getCandidateGoalCategory(best)} (weights:`,
        goalWeights,
        ')',
      );
    }
    return best?.item;
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
