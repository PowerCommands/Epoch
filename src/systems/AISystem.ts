import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import type { UnitType } from '../entities/UnitType';
import { getAllegianceType } from '../entities/UnitType';
import type { MapData, Tile } from '../types/map';
import type { GridCoord } from '../types/grid';
import type { Producible } from '../types/producible';
import { TileType } from '../types/map';
import { ALL_UNIT_TYPES, WARRIOR, ARCHER, SETTLER, SCOUT, SCOUT_BOAT, WORKER, WORK_BOAT, PRIVATEER, getUnitTypeById, canCarryUnitType, hasCargoCapacity } from '../data/units';
import type { CovertPersonality } from '../types/covertPersonality';
import {
  COVERT_CANDIDATE_UNIT_IDS,
  COVERT_MIN_REFERENCE_SCORE,
  getCovertDemandFactor,
  getDesiredCovertCapability,
  getPrivateerPersonalityMultiplier,
  isManagedCovertUnit,
  pickPreferredCovertUnit,
} from './ai/covertForceEvaluation';
import { ALL_BUILDINGS, FACTORY, GRANARY, WORKSHOP, MARKET, GRAND_STADIUM, GRAND_STADIUM_BUILDING_ID, getBuildingById, isBarbarianCamp } from '../data/buildings';
import { BARBARIAN_CAMP_CITY_SAFETY_DISTANCE } from '../data/barbarians';
import { ALL_WONDERS } from '../data/wonders';
import { getNaturalResourceById, getNaturalResourceImprovementIdForTile } from '../data/naturalResources';
import { getManufacturedResourceById } from '../data/manufacturedResources';
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
import {
  canCityProduceUnit,
  cityHasWaterTile,
  isMilitaryProductionUnit,
  isUnitObsoleteForNationEra,
  type UnitProductionRuleContext,
} from './ProductionRules';
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
import type { CityDefenseSystem } from './CityDefenseSystem';
import { EMPTY_MODIFIERS } from '../types/modifiers';
import type { ResearchSystem } from './ResearchSystem';
import type { CultureSystem } from './culture/CultureSystem';
import type { DiplomacyManager } from './DiplomacyManager';
import type { DiscoverySystem } from './DiscoverySystem';
import type { HappinessSystem } from './HappinessSystem';
import type { TradeDealSystem } from './TradeDealSystem';
import type { TradeConnectionSystem } from './TradeConnectionSystem';
import type { DiplomaticProposalSystem } from './diplomacy/DiplomaticProposalSystem';
import { evaluateEmbassyUnderSuspicion, evaluateTradeUnderSuspicion } from './diplomacy/suspicionEffects';
import { TRADE_ROUTE_PRODUCTION_COST } from '../types/tradeConnection';
import type { ResourceAccessSystem } from './ResourceAccessSystem';
import type { ExplorationMemorySystem } from './ExplorationMemorySystem';
import type { StrategicResourceCapacitySystem } from './StrategicResourceCapacitySystem';
import type { UnitUpkeepSystem } from './UnitUpkeepSystem';
import { UnitUpgradeSystem } from './UnitUpgradeSystem';
import type { AIOverseasExpansionSystem } from './AIOverseasExpansionSystem';
import type { ExileProtectionSystem } from './ExileProtectionSystem';
import { getBehaviorWeights, getMaxTradeDealsPerTurn } from './AIStrategyService';
import { AIGoalSystem } from './ai/AIGoalSystem';
import { AIStrategySelector, type AIStrategyContext } from './ai/AIStrategySelector';
import {
  AIStrategyEvaluationSystem,
  getStrategyDisplayName,
} from './ai/AIStrategyEvaluationSystem';
import type { AIMilitaryThreatEvaluationSystem, ThreatLevel } from './ai/AIMilitaryThreatEvaluationSystem';
import type { AIExplorationSystem } from './ai/AIExplorationSystem';
import {
  filterAvailableAIProductionCandidates,
  pickBestAIProductionCandidate,
  scoreAIProductionCandidate,
  type AIProductionCandidate,
} from './ai/AIProductionScoring';
import {
  applyGoalWeights,
  getCandidateGoalCategory,
  getProductionWeights,
} from './ai/utils/AIProductionGoalWeights';
import { hasGoalOfType, isNormalExpansionSettlerOnCooldown } from './ai/utils/AIExpansionUtils';
import { getMilitaryIntent } from './ai/utils/AIMilitaryUtils';
import { scoreCombatTarget, type AICombatContext } from './ai/AICombatScoring';
import {
  pickBestMovementCandidate,
  type AIMovementCandidate,
} from './ai/AIMovementScoring';
import {
  getMilitaryRole,
  scoreRoleBasedTarget,
  scoreRoleBasedPosition,
  type RolePositionContext,
} from './ai/MilitaryRoleBehavior';
import {
  isLandTacticsEligible,
  scoreFocusFireTarget,
  estimateAttackRisk,
  scoreRetreatPosition,
  RANGED_RETREAT_HP,
  MELEE_RETREAT_HP,
} from './ai/TacticalAwareness';
import {
  OffensiveOperationSystem,
  scoreOffensivePosition,
  OFFENSIVE_STAGING_RADIUS,
  type OffensiveOperation,
} from './ai/OffensiveOperationSystem';
import { deriveReclaimObjective } from './ai/reclaimCapital';
import { countMilitaryUnits, getEffectiveMilitaryUnitCap } from './ai/AIMilitaryCapacity';
import {
  NavalExpeditionTargetingSystem,
  type NavalExpeditionTarget,
} from './ai/NavalExpeditionTargetingSystem';
import { CITY_BASE_HEALTH } from '../data/cities';
import { getLeaderByNationId, getLeaderPersonalityByNationId, getLeaderMilitaryDoctrineByNationId, getLeaderMaxPreferredCitiesByNationId, getLeaderExploitationInterestByNationId } from '../data/leaders';
import { isExploitationRequestEligible } from './diplomacy/ExploitationRightsConcession';
import { resolveLeaderEraStrategy } from '../data/aiLeaderEraStrategies';
import { getEraIndex } from '../data/eraTimeline';
import {
  scoreMilitaryUnitCandidate,
  isMaritimeDoctrine,
} from './ai/AIMilitaryDoctrineScoring';
import type { AIMilitaryDoctrine, AIMilitaryDoctrineRole, DoctrineProductionScoreBreakdown } from '../types/aiMilitaryDoctrine';
import { AIMilitaryDoctrineEvaluator } from './ai/AIMilitaryDoctrineEvaluator';
import { getUnitDoctrineRole, isCovertOperative } from '../utils/unitRoleUtils';
import {
  getModernizationGoldReserve,
  getModernizationMaxUpgrades,
  scoreUpgradeCandidate,
} from './AIMilitaryModernizationSystem';
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
import type { CorporationSystem } from './CorporationSystem';
import {
  AEROSPACE_INDUSTRIES_ID,
  getAICorporationProductionCandidates,
  isCorporationQueuedByNation,
} from './ai/AICorporationProduction';
import type { AerospacePartSystem } from './AerospacePartSystem';
import { getAIAerospacePartProductionCandidate } from './ai/AIAerospacePartProduction';
import { AEROSPACE_PART_PRODUCTION, DEFAULT_REQUIRED_AEROSPACE_PARTS, SCIENCE_VICTORY_TECH_ID } from '../data/scienceVictory';
import { CORPORATIONS } from '../data/corporations';
import {
  getAISpaceRaceFactoryPriority,
  type AISpaceRaceFactoryPriority,
} from './ai/AIScienceVictoryFactoryProduction';
import {
  allocateEmergencyCityDefenders,
  allocateNavalFireSupport,
  detectEmergencyCityThreats,
  executeEmergencyDefenseAssignment,
  getEmergencyProductionThreats,
  getEmergencyPurchaseThreats,
  isSuitableEmergencyLandDefender,
  isSuitableEmergencyLandDefenderType,
  type EmergencyCityThreat,
  type EmergencyCityThreatSeverity,
} from './ai/EmergencyCityDefense';
import type { ProductionPurchaseSystem } from './ProductionPurchaseSystem';
import type { GamesOfNationsSystem } from './GamesOfNationsSystem';
import type { PowerPlantSystem } from './PowerPlantSystem';
import {
  planAIPowerPlants,
  type AIPowerPlantDecision,
} from './ai/AIPowerPlantPlanning';
import type { ConsolidationSystem } from './ConsolidationSystem';
import type { StrategicResourceDemandSystem, StrategicResourceDemand } from './StrategicResourceDemandSystem';
import {
  evaluateResourceExplorationNeed,
  describeUnresolvedDemand,
  type ResourceExplorationNeed,
} from './ai/resourceExplorationNeed';
import {
  classifyResourceAcquisition,
  isSignificantDemand,
  type ResourceAcquisitionPath,
  type ResourceAcquisitionPlan,
} from './ai/resourceAcquisitionPlanner';
import type { ResourceExpeditionCandidate } from './AIOverseasExpansionSystem';
import type { KnownResourceOpportunity } from './ai/AIExplorationSystem';
import { evaluateExploitationRequestDesirability } from './ai/exploitationRightsDemand';
import { ECONOMIC_DEVELOPMENT, calculateProjectGoldPerTurn } from '../data/projects';
import type { VictorySystem } from './VictorySystem';
import {
  applyVictoryFocusProductionPriority,
  evaluateAIVictoryFocus,
  planScienceVictoryProduction,
  type ScienceVictoryExecutionPlan,
} from './ai/AIVictoryFocus';

// Canonical AeroSpace Industries corporation definition, used when the Science
// Victory focus commits a city to found it.
const AEROSPACE_INDUSTRIES_DEFINITION = CORPORATIONS.find((corporation) => corporation.id === AEROSPACE_INDUSTRIES_ID);

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
const PROVOCATIVE_POSTURE_HOSTILITY_THRESHOLD = 70;
const PROVOCATIVE_POSTURE_TRUST_THRESHOLD = 20;
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
const fallbackFormatLog: AILogFormatter = (nationId, message) => `[r?] [?] ${nationId} (era: ancient, gold: 0, happiness: 0) ${message}`;

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
  readonly zone: Set<string>;                   // tile keys across all war enemies
  readonly zoneTiles: readonly Tile[];           // patrol-pressure water tiles
  readonly navalUnits: readonly Unit[];          // priority 1: enemy ships in zone
  readonly enemyCities: readonly City[];         // all war-enemy cities (ranged: geometry filters per unit)
  readonly allEnemyLandUnits: readonly Unit[];   // all enemy land combat units (ranged: firing-pos calc)
  readonly coastAdjacentUnits: readonly Unit[];  // melee naval: land units directly adjacent to coast
}

// A scored bombardment target for ranged-naval firing-position selection.
interface NavalBombardTarget {
  readonly pos: GridCoord;
  readonly value: number;
  readonly key: string; // tile key of the target itself (claimed once fired on)
}

interface NavalPatrolContext {
  readonly targets: CoastalDefenseTargets;
  readonly enemyTargets: EnemyCoastalTargets;
  readonly expeditionTarget: NavalExpeditionTarget | null;
  readonly expeditionAssignment: NavalExpeditionAssignment | null;
  readonly expeditionAdvancedUnitIds: Set<string>;
  readonly claimedNavalTiles: Set<string>;
  readonly ownZoneHasEnemy: boolean;
}

interface NavalExpeditionAssignment {
  readonly nationId: string;
  readonly targetCityId: string;
  readonly targetCityName: string;
  readonly targetOwnerNationId: string;
  readonly targetPos: GridCoord;
  readonly targetScore: number;
  readonly assignedUnitIds: readonly string[];
  readonly createdTurn: number;
  readonly lastUpdatedTurn: number;
}

interface MilitaryStagingTarget {
  readonly enemyCity: GridCoord;   // discovered enemy capital/city we're staging against
  readonly stagingTile: GridCoord; // shared rally tile, MILITARY_STAGING_DISTANCE from enemyCity
}

interface PeacetimeMilitarySpreadState {
  readonly excessUnitIds: Set<string>;
  readonly ownTerritoryTiles: Tile[];
  readonly ownCities: City[];
  readonly friendlyMilitaryPositions: GridCoord[];
  readonly claimedTargets: Set<string>;
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
  // Covert units (spy/agent/rebels/partisans) have combat strength but are
  // strategic assets, not generic army — they are evaluated separately by the
  // covert-force evaluator, never built as standing military here.
  unitType.category !== 'covert' &&
  unitType.baseStrength > 0
));
// Score boost applied to naval candidates when a maritime doctrine is active
// and the nation has fewer naval units than coastal cities.
const MARITIME_NAVAL_URGENCY_MULTIPLIER = 1.5;
const NAVAL_POWER_UNITS_PER_COASTAL_CITY = 4;
const NAVAL_POWER_UNITS_PER_ACTIVE_WAR = 6;
const NAVAL_POWER_SOFT_SATURATION_RATIO = 0.85;
const NAVAL_POWER_SATURATION_MODERATE_MULTIPLIER = 0.65;
const NAVAL_POWER_SATURATION_HIGH_MULTIPLIER = 0.35;
const NAVAL_POWER_SATURATION_EXTREME_MULTIPLIER = 0.2;
// Heavy suppression applied to melee naval candidates once a ranged naval
// ship is available — maritime doctrines should converge on the strongest
// ranged option rather than accumulating melee fallbacks.
const NAVAL_MELEE_SUPPRESSION_MULTIPLIER = 0.1;

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
const SCORE_SCIENCE_BUILDING = 78;
const SCORE_CULTURE_BUILDING = 75;
const SCORE_WORLD_WONDER = 68;
const SCORE_FALLBACK = 25;
// Economic Development during consolidation: above marginal fallbacks (25) so it
// beats churning another unit or marginal building, but below genuine-need
// buildings (55+), power plants and acute defenders so those still override.
const SCORE_CONSOLIDATION_PROJECT = 30;
const SCORE_NAVAL = 40;
const SCORE_WORK_BOAT = 42;
const SCORE_WORKER = 62;
// Caps how many ranked land-improvement candidates a Worker will pathfind to
// when searching for a reachable target, so an idle/boxed-in Worker can't
// trigger a full-territory pathfinding scan every turn.
const MAX_WORKER_REACHABILITY_CHECKS = 8;
// A Worker only considers improvement targets within this many tiles of itself.
// This keeps reachability pathfinding local and cheap (no cross-continent paths
// to far-away cities) and stops Workers wandering across the map.
const MAX_WORKER_TARGET_DISTANCE = 12;
// When a Worker has no local target and roams toward another city, it only tries
// to path to the nearest few candidate cities so an unreachable (e.g. overseas)
// city can't trigger repeated expensive full-map pathfinding.
const MAX_WORKER_RELOCATION_CITY_CHECKS = 3;
// Score penalty applied to foreign exploitation-rights targets so a Worker always
// prefers domestic resource work of equal quality; foreign resource tiles still
// outrank domestic filler tiles. Keeps AI use of exploitation rights conservative.
const FOREIGN_EXPLOITATION_TARGET_PENALTY = 1000;
// Extra Worker-target priority for a tile carrying a significantly-demanded
// strategic resource (Prompt 3). Larger than the flat resource bonus (1000) so a
// demanded Iron/Coal tile is improved ahead of ordinary resource tiles, without
// overriding the reachability/assignment safeguards around it.
const WORKER_DEMANDED_RESOURCE_BONUS = 3000;
const LOW_GOLD_PER_TURN = 0;
const POST_TARGET_SETTLER_DEFAULT_INTERVAL = 8;
const POST_TARGET_SETTLER_MIN_GOLD = 25;
const POST_TARGET_SETTLER_MIN_GOLD_PER_TURN = -1;
const TILE_PURCHASE_DEFAULT_RESERVE = 100;
const TILE_PURCHASE_DEFAULT_MIN_SCORE = 45;

export interface EconomicRecoveryInvestment {
  readonly city: City;
  readonly building: BuildingType;
  readonly queueIndex?: number;
  readonly cost: number;
  readonly goldPerTurnImprovement: number;
}

/** Highest structural GPT return per gold; deterministic ties aid tests/replays. */
export function pickBestEconomicRecoveryInvestment(
  candidates: readonly EconomicRecoveryInvestment[],
): EconomicRecoveryInvestment | undefined {
  return [...candidates].sort((a, b) => {
    const efficiencyDelta = (b.goldPerTurnImprovement / b.cost)
      - (a.goldPerTurnImprovement / a.cost);
    if (Math.abs(efficiencyDelta) > Number.EPSILON) return efficiencyDelta;
    return b.goldPerTurnImprovement - a.goldPerTurnImprovement
      || a.cost - b.cost
      || a.city.id.localeCompare(b.city.id)
      || a.building.id.localeCompare(b.building.id);
  })[0];
}

export function canFundEconomicRecoveryInvestment(
  treasury: number,
  purchaseCost: number,
  reserve: number,
): boolean {
  return treasury - purchaseCost >= reserve;
}
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
// Permanent civilian maritime presence for maritime-doctrine AI: at least one
// active/in-production Scout Boat and one Worker Boat, maintained for the whole
// game. This is a minimum, not a maximum — regular scoring may still add more.
const MARITIME_MINIMUM_UNITS = 1;
const MAX_EARLY_WORK_BOATS_COASTAL_FOUNDATION = 2;

// Naval offensive behavior. Cap on how far a ship will travel to reach an
// offensive target so it doesn't wander deep into open ocean. Targets must
// already be in/near an enemy coastal zone, so this primarily limits per-unit
// engagement range from current position.
const NAVAL_MAX_OFFENSIVE_REACH = 8;
// Extra production urgency multiplier for maritime-doctrine nations once
// ranged naval units (e.g. Galleass, Frigate) become researchable.
const NAVAL_RANGED_CAPABILITY_BOOST = 1.4;
// Scoring weights for per-unit naval bombardment position evaluation.
const BOMBARD_CITY_VALUE = 20;
const BOMBARD_UNIT_VALUE = 12;
const BOMBARD_DAMAGED_BONUS = 10;     // extra value for targets below 60 % HP
const BOMBARD_IMMEDIATE_BONUS = 15;   // bonus when firing position reachable this turn
const BOMBARD_DISTANCE_WEIGHT = 2;    // score -= distFromUnit * weight
const BOMBARD_ADJ_ENEMY_NAVAL_PENALTY = 8; // per adjacent enemy naval unit at firing tile
// Naval emergency fire support: how far a ranged warship may be from a
// genuinely threatened coastal city to be recruited to defend it (keeps distant
// fleets from being dragged across the map), and the ship cap per threat.
const NAVAL_FIRE_SUPPORT_REACH_RADIUS = 12;
const NAVAL_FIRE_SUPPORT_MAX_SHIPS_PER_THREAT = 3;
const NAVAL_EXPEDITION_MAX_SHIPS = 4;
const NAVAL_EXPEDITION_MIN_SHIPS = 2;
const NAVAL_EXPEDITION_HOME_RESERVE = 1;
const NAVAL_EXPEDITION_CRITICAL_HEALTH_RATIO = 0.45;
const NAVAL_EXPEDITION_RETARGET_SCORE_DELTA = 35;
const NAVAL_EXPEDITION_COMMITTED_DISTANCE = 8;
const NAVAL_EXPEDITION_THREAT_RADIUS = 4;
const NAVAL_EXPEDITION_COASTAL_UNIT_RADIUS = 2;
const NAVAL_EXPEDITION_DAMAGED_FLEET_RATIO = 0.55;
const NAVAL_EXPEDITION_TARGET_DEFENSE_RADIUS = 3;

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

const HUMAN_PLAYER_TRADE_PRIORITY = 50;
const TRADE_PROPOSAL_EXPIRY_TURNS = 5;
const TRADE_PROPOSAL_CADENCE = 10;

function getProposalGoldPerTurn(resourceId: string, luxuryMultiplier: number): number {
  // Manufactured resources carry their own trade price (see manufacturedResources.ts);
  // reuse it rather than the natural-resource category pricing below.
  const manufactured = getManufacturedResourceById(resourceId);
  if (manufactured) return manufactured.tradeGoldPerTurn ?? 4;
  const resource = getNaturalResourceById(resourceId);
  if (!resource) return 4;
  switch (resource.category) {
    case 'luxury': return Math.round(5 * luxuryMultiplier);
    case 'strategic': return 8;
    default: return 2; // bonus resources
  }
}

function describeProducible(item: Producible): string {
  switch (item.kind) {
    case 'unit': return `unit:${item.unitType.name}`;
    case 'building': return `building:${item.buildingType.name}`;
    case 'wonder': return `wonder:${item.wonderType.name}`;
    case 'corporation': return `corporation:${item.corporationType.name}`;
    case 'manufacturedResource': return `manufacturedResource:${item.productionType.name}`;
    case 'project': return `project:${item.projectType.name}`;
    case 'tradeRoute': return `tradeRoute:${item.displayName}`;
  }
}

export interface RoutineCityDefenderOverrideContext {
  readonly isEconomicCrisis: boolean;
  readonly structuralNetIncome: number;
  readonly militaryCount: number;
  readonly effectiveMilitaryMax: number;
  readonly hasEmergencyThreat: boolean;
}

/** Whether routine local-garrison demand may override normal military restrictions. */
export function canBuildRoutineCityDefender(
  context: RoutineCityDefenderOverrideContext,
): boolean {
  if (context.hasEmergencyThreat) return true;
  return !(
    context.isEconomicCrisis
    && context.structuralNetIncome < 0
    && context.militaryCount >= context.effectiveMilitaryMax
  );
}

/** Returns -1 when the mandatory stadium must be enqueued, its queue index when it must move, or null when already first. */
export function getGrandStadiumPriorityQueueAction(
  queue: readonly { item: Producible }[],
): number | null {
  const index = queue.findIndex((entry) =>
    entry.item.kind === 'building' && entry.item.buildingType.id === GRAND_STADIUM_BUILDING_ID,
  );
  return index === 0 ? null : index;
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
  private readonly workerTargetsByUnit = new Map<string, string>();
  private readonly workerMovementLogKeyByUnit = new Map<string, string>();
  private readonly workerNoTargetLoggedUnits = new Set<string>();
  private readonly coastalSpacingLoggedBySettler = new Set<string>();
  // Nations for which the maritime-minimum war-deferral has already been logged
  // this war, so the deferral note is emitted once rather than every turn.
  private readonly maritimeWarDeferLogged = new Set<string>();
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
  private readonly avoidedProvocativeMilitaryTileLoggedRound = new Map<string, number>();
  private readonly defensiveModeLoggedRound = new Map<string, number>();
  private readonly militaryBudgetLoggedRound = new Map<string, number>();
  private readonly budgetAllowedLoggedRound = new Map<string, number>();
  private readonly doctrinePressureLoggedRound = new Map<string, number>();
  private readonly settlerHappinessDelayLoggedRound = new Map<string, number>();
  private readonly doctrineProductionLoggedRound = new Map<string, number>();
  private readonly navalSaturationLoggedRound = new Map<string, number>();
  private readonly completedProductionCyclesSinceLastSettler = new Map<string, number>();
  private readonly lastTradeProposalTurnByNation = new Map<string, number>();
  private readonly longTermExpansionLoggedRound = new Map<string, number>();
  private readonly peacetimeSpreadLoggedRound = new Map<string, number>();
  private readonly offensiveOperationSystem = new OffensiveOperationSystem();
  private readonly navalExpeditionTargetingSystem = new NavalExpeditionTargetingSystem();
  private readonly offensiveTargetLoggedKeys = new Set<string>();
  private readonly offensiveCommitLoggedRound = new Map<string, number>();
  private readonly offensiveAdvanceLoggedRound = new Map<string, number>();
  private readonly navalExpeditionTargetLoggedKeys = new Set<string>();
  private readonly navalExpeditionNoTargetLoggedRound = new Map<string, number>();
  private readonly navalExpeditionAssignments = new Map<string, NavalExpeditionAssignment>();
  private readonly navalExpeditionMoveLoggedRound = new Map<string, number>();
  private readonly navalExpeditionAttackLoggedRound = new Map<string, number>();
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
  private readonly obsoleteMilitaryStarvationLogKeys = new Set<string>();
  private readonly aerospaceEligibilityLoggedNationIds = new Set<string>();
  private readonly victoryFocusPriorityLoggedKeys = new Set<string>();
  private readonly aerospaceManufacturingStateByNation = new Map<string, string>();
  // Nations for which "Science focus actionable (can found AeroSpace Industries)"
  // has already been logged, so the transition is announced once.
  private readonly aerospaceFoundingActionableLoggedNationIds = new Set<string>();
  // Last forced Science-Victory production message per nation, to dedupe the
  // per-turn commit/defer logging when nothing has changed.
  private readonly forcedScienceVictoryStateByNation = new Map<string, string>();
  private readonly spaceRaceFactoryPriorityStateByNation = new Map<string, string>();
  private readonly doctrineEvaluator: AIMilitaryDoctrineEvaluator;
  private readonly militaryPickRationaleByNation = new Map<string, {
    role: AIMilitaryDoctrineRole | null;
    preferredRoleMultiplier: number;
    roleDeficitMultiplier: number;
    finalScore: number;
  }>();
  private readonly emergencyThreatsByNation = new Map<string, EmergencyCityThreat[]>();
  private readonly emergencyThreatStateByNation = new Map<string, Map<string, EmergencyCityThreatSeverity>>();
  private readonly emergencyAssignmentCityByUnit = new Map<string, string>();
  // Naval fire support: ship id → the coastal emergency threat it is assigned to
  // defend this turn, computed once per nation turn from EmergencyCityDefense.
  private readonly navalFireSupportThreatByUnit = new Map<string, Map<string, EmergencyCityThreat>>();
  // Previous turn's ship id → threatened city id, used for assignment hysteresis
  // so ships don't oscillate between equidistant threatened cities each turn.
  private readonly navalFireSupportCityByUnit = new Map<string, Map<string, string>>();
  // Last logged assigned-ship count per threatened city, to avoid per-turn noise.
  private readonly navalFireSupportLoggedByNation = new Map<string, Map<string, number>>();
  private readonly routineDefenderSuppressionLoggedCityIds = new Set<string>();
  private powerPlantPlans = new Map<string, AIPowerPlantDecision>();

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
    private readonly unitUpkeepSystem?: UnitUpkeepSystem,
    private readonly unitUpgradeSystem?: UnitUpgradeSystem,
    private readonly formatLog: AILogFormatter = fallbackFormatLog,
    private readonly eraSystem?: EraSystem,
    settlementMemorySystem?: AISettlementMemorySystem,
    seaResourceMemorySystem?: AISeaResourceMemorySystem,
    private readonly builderSystem?: BuilderSystem,
    private readonly wonderSystem?: WonderSystem,
    private readonly wonderPlacementSystem?: WonderPlacementSystem,
    private readonly buildingPlacementSystem?: BuildingPlacementSystem,
    private readonly logStrategicEvent?: (nationId: string, message: string) => void,
    private readonly cityDefenseSystem?: CityDefenseSystem,
    private readonly overseasExpansionSystem?: AIOverseasExpansionSystem,
    private readonly exileProtectionSystem?: ExileProtectionSystem,
    private readonly tradeConnectionSystem?: TradeConnectionSystem,
    private readonly diplomaticProposalSystem?: DiplomaticProposalSystem,
    private readonly aiExplorationSystem?: AIExplorationSystem,
    private readonly corporationSystem?: CorporationSystem,
    private readonly scienceVictoryEnabled = false,
    private readonly aerospacePartSystem?: AerospacePartSystem,
    private readonly requiredAerospaceParts = DEFAULT_REQUIRED_AEROSPACE_PARTS,
    private readonly productionPurchaseSystem?: ProductionPurchaseSystem,
    private readonly gamesOfNationsSystem?: GamesOfNationsSystem,
    private readonly powerPlantSystem?: PowerPlantSystem,
    private readonly victorySystem?: Pick<VictorySystem, 'getScienceVictoryProgress'>,
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
    this.doctrineEvaluator = new AIMilitaryDoctrineEvaluator(unitManager);
    this.cityFocusSystem = new CityFocusSystem(
      this.cityManager,
      this.nationManager,
      this.mapData,
      this.gridSystem,
      this.formatLog,
      (nationId) => this.getActiveEraStrategy(nationId),
      this.logStrategicEvent,
    );
    this.foundCitySystem.onCityFounded((city) => {
      this.cityFocusSystem.updateFocusForCity(city);
      // Reset the AI normal-expansion cooldown from the turn a city is actually
      // founded. Recorded for every nation (harmless for humans, who never read
      // it); only AI normal-expansion Settler pathways gate on it.
      const nation = this.nationManager.getNation(city.ownerId);
      if (nation) nation.lastCityFoundedTurn = this.turnManager.getCurrentRound();
    });
    this.productionSystem.onCompletedSuccessfully((cityId, item) => {
      this.recordCompletedProductionCycle(cityId, item);
    });
  }

  /**
   * Optional culture system, injected after construction. Used to check
   * cultural permissions (e.g. Foreign Trade) during diplomacy validation.
   */
  private cultureSystem?: CultureSystem;

  setCultureSystem(cultureSystem: CultureSystem): void {
    this.cultureSystem = cultureSystem;
  }

  /**
   * Optional consolidation state, injected after construction. When a nation is
   * consolidating, city production strongly prefers Economic Development over
   * ordinary military and marginal construction (see chooseCityProduction).
   */
  private consolidationSystem?: ConsolidationSystem;

  setConsolidationSystem(consolidationSystem: ConsolidationSystem): void {
    this.consolidationSystem = consolidationSystem;
  }

  /** Optional Strategic Resource Demand source, injected for resource-driven exploration. */
  private strategicResourceDemandSystem?: StrategicResourceDemandSystem;
  /** Last-known unresolved demanded resource ids per nation (transition logging only). */
  private readonly resourceExplorationUnresolvedByNation = new Map<string, Set<string>>();

  setStrategicResourceDemandSystem(system: StrategicResourceDemandSystem): void {
    this.strategicResourceDemandSystem = system;
  }

  /** Last logged acquisition path per nation+resource (transition logging only). */
  private readonly resourceAcquisitionLoggedByNation = new Map<string, Map<string, ResourceAcquisitionPath>>();
  /** Cached land-reachable tile keys per nation, valid for one round. */
  private landReachableCache?: { round: number; byNation: Map<string, Set<string>> };

  /**
   * Whether ordinary buildup should be suppressed for this nation right now.
   * True only while consolidating AND not at war — an active war overrides
   * post-war-style restrictions so the AI can still defend/fight.
   */
  private isConsolidationSuppressionActive(nationId: string): boolean {
    if (!this.consolidationSystem?.isConsolidating(nationId)) return false;
    if (this.diplomacyManager?.isAtWarWithAnyNation(nationId) === true) return false;
    return true;
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
    this.updateVictoryFocus(nationId);
    this.refreshEmergencyCityThreats(nationId);
    this.refreshNavalFireSupport(nationId);
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

    // Offer neutral-overseas strategic-resource opportunities to the existing
    // Expedition system as launch reasons (revalidated every turn) before it
    // selects/advances an expedition. One expedition per nation still applies.
    if (this.overseasExpansionSystem && this.strategicResourceDemandSystem && this.aiExplorationSystem) {
      this.overseasExpansionSystem.refreshResourceExpeditionTargets(
        nationId,
        this.getNeutralOverseasResourceCandidates(nationId),
      );
    }
    this.overseasExpansionSystem?.runTurn(nationId);
    this.runSettlers(nationId);
    this.overseasExpansionSystem?.runStaging(nationId);
    this.runEmergencyDefenseRedeployment(nationId);
    this.runCombat(nationId);
    this.runMovement(nationId);
    this.runTilePurchases(nationId);
    this.runProduction(nationId);
    this.runResourceAcquisitionForNation(nationId);
    this.runDiplomacyForNation(nationId);
    this.runTradeForNation(nationId);
    this.runTradeRoutesForNation(nationId);

    if (nation?.aiGoals && nation.aiGoals.length > 0) {
      console.log(
        this.formatLog(nationId, `AI goals: ${nation.aiGoals.map((g) => `${g.type}(${g.remainingTurns})`).join(', ')}`),
      );
    }
  }

  private updateVictoryFocus(nationId: string): void {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || !this.victorySystem) return;

    const progress = this.victorySystem.getScienceVictoryProgress(nationId);
    const evaluation = evaluateAIVictoryFocus(
      nation.aiVictoryFocus,
      this.scienceVictoryEnabled,
      progress,
      this.turnManager.getCurrentRound(),
    );
    nation.aiVictoryFocus = evaluation.focus;

    if (evaluation.transition === 'entered') {
      this.logVictoryFocus(
        nationId,
        `${nation.name} entered Science Victory Focus: ${progress.fulfilledMilestones}/4 milestones completed.`,
      );
      this.logVictoryFocusAvailabilityIfBlocked(nationId);
    } else if (evaluation.transition === 'objectiveAdvanced') {
      this.logVictoryFocus(
        nationId,
        `${nation.name} Science focus objective advanced: AeroSpace Industries founded globally, prioritizing Aerospace Parts.`,
      );
    } else if (evaluation.transition === 'exited') {
      const reason = evaluation.reason === 'scienceVictoryAchieved'
        ? 'Science Victory achieved'
        : evaluation.reason === 'scienceVictoryDisabled'
          ? 'Science Victory disabled'
          : 'victory path substantially invalidated';
      this.logVictoryFocus(nationId, `${nation.name} left Science Victory Focus: ${reason}.`);
    }
  }

  private logVictoryFocusAvailabilityIfBlocked(nationId: string): void {
    const nation = this.nationManager.getNation(nationId);
    if (nation?.aiVictoryFocus?.objective !== 'foundAerospaceIndustries' || !this.corporationSystem) return;
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const eligible = cities.filter((city) => (
      this.corporationSystem?.canCityProduceCorporation(city, AEROSPACE_INDUSTRIES_ID) === true
    ));
    if (eligible.some((city) => this.productionSystem.getProduction(city.id) === undefined)) return;
    const blocker = eligible.length > 0
      ? 'all eligible cities are occupied by existing production'
      : 'no city satisfies the normal corporation requirements';
    this.logVictoryFocus(
      nationId,
      `${nation?.name ?? nationId} cannot currently consider AeroSpace Industries: ${blocker}.`,
    );
  }

  private applyVictoryFocusPriority(
    nationId: string,
    candidate: AIProductionCandidate,
    urgentOverride: boolean,
  ): AIProductionCandidate {
    const nation = this.nationManager.getNation(nationId);
    const result = applyVictoryFocusProductionPriority(candidate, nation?.aiVictoryFocus, urgentOverride);
    if (result.strategicBonus <= 0) return result.candidate;

    const key = `${nationId}:${nation?.aiVictoryFocus?.objective}`;
    if (!this.victoryFocusPriorityLoggedKeys.has(key)) {
      this.victoryFocusPriorityLoggedKeys.add(key);
      const itemName = result.candidate.item.kind === 'corporation'
        ? result.candidate.item.corporationType.name
        : 'Aerospace Parts';
      this.logVictoryFocus(
        nationId,
        `${nation?.name ?? nationId} Science focus boosted ${itemName}: base=${Math.round(candidate.baseScore)} strategic=+${Math.round(result.strategicBonus)} final=${Math.round(result.candidate.baseScore)}.`,
      );
    }
    return result.candidate;
  }

  private logVictoryFocus(nationId: string, message: string): void {
    console.log(`[VictoryFocus] ${message}`);
    this.logStrategicEvent?.(nationId, `[VictoryFocus] ${message}`);
  }

  getEmergencyCityThreats(nationId: string): readonly EmergencyCityThreat[] {
    return this.emergencyThreatsByNation.get(nationId) ?? [];
  }

  private refreshEmergencyCityThreats(nationId: string): void {
    const threats = detectEmergencyCityThreats({
      nationId,
      cities: this.cityManager.getCitiesByOwner(nationId),
      units: this.unitManager.getAllUnits(),
      currentRound: this.turnManager.getCurrentRound(),
      getDistance: (a, b) => this.gridSystem.getDistance(a, b),
      isAtWar: (ownerId, otherId) => this.isAtWarWith(ownerId, otherId),
      canThreatenCity: (unit, city) => (
        unit.unitType.isNaval !== true || cityHasWaterTile(city, this.mapData)
      ),
    });
    this.emergencyThreatsByNation.set(nationId, threats);

    const previous = this.emergencyThreatStateByNation.get(nationId) ?? new Map();
    const next = new Map(threats.map((threat) => [threat.city.id, threat.severity]));
    for (const threat of threats) {
      if (previous.get(threat.city.id) === threat.severity) continue;
      this.logEmergencyDefense(
        nationId,
        `${threat.city.name} entered ${threat.severity} emergency defense state: ${threat.reason}; `
        + `hostiles=${threat.hostileUnits.length}, localStrength=${threat.localHostileStrength}.`,
      );
    }
    for (const cityId of previous.keys()) {
      if (next.has(cityId)) continue;
      const cityName = this.cityManager.getCity(cityId)?.name ?? cityId;
      this.logEmergencyDefense(nationId, `${cityName} left emergency defense state.`);
    }
    this.emergencyThreatStateByNation.set(nationId, next);
  }

  /** Emergency threats limited to coastal cities (those a fleet can support). */
  private getCoastalEmergencyThreats(nationId: string): EmergencyCityThreat[] {
    return this.getEmergencyCityThreats(nationId)
      .filter((threat) => cityHasWaterTile(threat.city, this.mapData));
  }

  /** True if the ship can already reach a threatening unit with its ranged attack. */
  private isShipInThreatFiringRange(unit: Unit, threat: EmergencyCityThreat): boolean {
    const range = unit.unitType.range ?? 1;
    const unitPos = { x: unit.tileX, y: unit.tileY };
    return threat.hostileUnits.some(
      (hostile) => this.gridSystem.getDistance(unitPos, { x: hostile.tileX, y: hostile.tileY }) <= range,
    );
  }

  /**
   * Computes this turn's naval fire-support assignments (ship → coastal
   * emergency threat) from the existing EmergencyCityDefense threats, and logs
   * newly assigned support. Movement into firing position happens later in the
   * naval patrol phase; combat remains autonomous.
   */
  private refreshNavalFireSupport(nationId: string): void {
    const threats = this.getCoastalEmergencyThreats(nationId);
    const previousCityByUnit = this.navalFireSupportCityByUnit.get(nationId);
    const assignments = allocateNavalFireSupport({
      nationId,
      threats,
      friendlyUnits: this.unitManager.getUnitsByOwner(nationId).filter((unit) => !this.isCargoUnit(unit)),
      isCoastalCity: (city) => cityHasWaterTile(city, this.mapData),
      getDistance: (a, b) => this.gridSystem.getDistance(a, b),
      isInFiringRange: (unit, threat) => this.isShipInThreatFiringRange(unit, threat),
      reachRadius: NAVAL_FIRE_SUPPORT_REACH_RADIUS,
      maxShipsPerThreat: NAVAL_FIRE_SUPPORT_MAX_SHIPS_PER_THREAT,
      previousCityByUnit,
    });

    const threatByUnit = new Map<string, EmergencyCityThreat>();
    const cityByUnit = new Map<string, string>();
    for (const assignment of assignments) {
      threatByUnit.set(assignment.unit.id, assignment.threat);
      cityByUnit.set(assignment.unit.id, assignment.threat.city.id);
    }
    this.navalFireSupportThreatByUnit.set(nationId, threatByUnit);
    this.navalFireSupportCityByUnit.set(nationId, cityByUnit);
    this.logNavalFireSupportChanges(nationId, assignments);
  }

  private logNavalFireSupportChanges(
    nationId: string,
    assignments: readonly { unit: Unit; threat: EmergencyCityThreat }[],
  ): void {
    const perCity = new Map<string, { threat: EmergencyCityThreat; count: number }>();
    for (const { threat } of assignments) {
      const entry = perCity.get(threat.city.id) ?? { threat, count: 0 };
      entry.count += 1;
      perCity.set(threat.city.id, entry);
    }

    const previous = this.navalFireSupportLoggedByNation.get(nationId) ?? new Map<string, number>();
    const next = new Map<string, number>();
    for (const [cityId, { threat, count }] of perCity) {
      next.set(cityId, count);
      if (previous.get(cityId) === count) continue; // unchanged — avoid per-turn noise
      this.logEmergencyDefense(
        nationId,
        `naval fire support: assigned ${count} ranged ship(s) to defend ${threat.city.name} (${threat.severity}).`,
      );
    }
    this.navalFireSupportLoggedByNation.set(nationId, next);
  }

  private buildEmergencyDefenseAssignments(
    nationId: string,
    units: readonly Unit[],
  ) {
    const threats = this.getEmergencyCityThreats(nationId);
    const assignments = allocateEmergencyCityDefenders({
      nationId,
      threats,
      friendlyUnits: units.filter(
        (unit) => this.overseasExpansionSystem?.isUnitAssignedToActiveExpedition(unit.id) !== true,
      ),
      getDistance: (a, b) => this.gridSystem.getDistance(a, b),
      canReachCity: (unit, city) => this.pathfindingSystem.findPath(
        unit,
        city.tileX,
        city.tileY,
        { respectMovementPoints: false },
      ) !== null,
      hasFriendlyMilitaryOnCity: (city) => this.hasFriendlyMilitaryOnCity(city, nationId),
    });
    const currentlyAssignedIds = new Set(assignments.map(({ unit }) => unit.id));
    for (const unitId of this.emergencyAssignmentCityByUnit.keys()) {
      if (!currentlyAssignedIds.has(unitId)) this.emergencyAssignmentCityByUnit.delete(unitId);
    }
    for (const assignment of assignments) {
      if (this.emergencyAssignmentCityByUnit.get(assignment.unit.id) === assignment.threat.city.id) continue;
      this.emergencyAssignmentCityByUnit.set(assignment.unit.id, assignment.threat.city.id);
      this.logEmergencyDefense(
        nationId,
        `reassigned ${assignment.unit.name} to defend ${assignment.threat.city.name} `
        + `(${assignment.threat.severity}).`,
      );
    }
    return assignments;
  }

  private runEmergencyDefenseRedeployment(nationId: string): void {
    const units = this.unitManager.getUnitsByOwner(nationId).filter((unit) => !this.isCargoUnit(unit));
    for (const assignment of this.buildEmergencyDefenseAssignments(nationId, units)) {
      executeEmergencyDefenseAssignment({
        assignment,
        findPath: (unit, city) => this.pathfindingSystem.findPath(
          unit,
          city.tileX,
          city.tileY,
          { respectMovementPoints: false },
        ),
        moveAlongPath: (unit, path) => this.movementSystem.moveAlongPath(unit, path),
        onOccupied: (completed) => this.logEmergencyDefense(
          nationId,
          `${completed.unit.name} occupied threatened city ${completed.threat.city.name}.`,
        ),
      });
    }
  }

  private isEmergencyCityGarrison(unit: Unit, nationId: string): boolean {
    return this.getEmergencyCityThreats(nationId).some(
      (threat) => threat.city.tileX === unit.tileX
        && threat.city.tileY === unit.tileY
        && unit.ownerId === nationId
        && isSuitableEmergencyLandDefender(unit),
    );
  }

  private hasFriendlyMilitaryOnCity(city: City, nationId: string): boolean {
    const unit = this.unitManager.getUnitAt(city.tileX, city.tileY);
    return unit?.ownerId === nationId && isSuitableEmergencyLandDefender(unit);
  }

  private hasAdequateLocalEmergencyDefense(threat: EmergencyCityThreat, nationId: string): boolean {
    if (!this.hasFriendlyMilitaryOnCity(threat.city, nationId)) return false;
    const cityPosition = { x: threat.city.tileX, y: threat.city.tileY };
    const friendlyStrength = this.unitManager.getUnitsByOwner(nationId)
      .filter(isSuitableEmergencyLandDefender)
      .filter((unit) => this.gridSystem.getDistance(
        cityPosition,
        { x: unit.tileX, y: unit.tileY },
      ) <= 2)
      .reduce((sum, unit) => sum + unit.unitType.baseStrength, 0);
    return friendlyStrength >= threat.localHostileStrength * 0.75;
  }

  private logEmergencyDefense(nationId: string, message: string): void {
    const formatted = `[EmergencyDefense] ${message}`;
    console.log(this.formatLog(nationId, formatted));
    this.logStrategicEvent?.(nationId, formatted);
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

    for (const unit of this.unitManager.getUnitsByOwner(nationId).filter((u) => !this.isCargoUnit(u))) {
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
      hasCulture: (target: string, cultureId: string): boolean =>
        this.cultureSystem?.isUnlocked(target, cultureId) ?? false,
    };

    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.discoverySystem && !this.discoverySystem.hasMet(nationId, other.id)) continue;
      if (dm.getState(nationId, other.id) === 'WAR') continue;

      const relation = dm.getRelation(nationId, other.id);

      if (!dm.hasEmbassy(nationId, other.id)) {
        const embassyCheck = dm.canEstablishEmbassy(nationId, other.id, validationContext);
        if (embassyCheck.ok) {
          // Suspicion makes a nation reluctant to open a new embassy (less than
          // for open borders; strong trust still gets one through).
          const gate = evaluateEmbassyUnderSuspicion(relation.suspicion, relation.trust);
          if (!gate.allow) {
            if (gate.reason) console.debug(this.formatLog(nationId, `AI declined embassy with ${other.name}: ${gate.reason}.`));
          } else if (dm.establishEmbassy(nationId, other.id)) {
            const suffix = gate.reason ? ` (${gate.reason})` : '';
            console.debug(this.formatLog(nationId, `AI established embassy with ${other.name}${suffix}`));
          }
        }
      }

      if (!dm.hasTradeRelations(nationId, other.id)) {
        const tradeCheck = dm.canEstablishTradeRelations(nationId, other.id, validationContext);
        if (tradeCheck.ok) {
          // Suspicion lowers trade willingness, but economic lean / mutual benefit
          // still overcomes low–moderate suspicion (never makes trade impossible).
          // A merchant personality weighs suspicion against trade more heavily;
          // a pirate/schemer barely lets it interfere.
          const personality = this.nationManager.getCovertPersonality(nationId);
          const effectiveSuspicion = relation.suspicion * personality.suspicionToTrade;
          const gate = evaluateTradeUnderSuspicion(effectiveSuspicion, relation.trust, weights.trade);
          if (!gate.allow) {
            if (gate.reason) console.debug(this.formatLog(nationId, `AI declined trade relations with ${other.name}: ${gate.reason}.`));
          } else if (dm.establishTradeRelations(nationId, other.id)) {
            const suffix = gate.reason ? ` (${gate.reason})` : '';
            console.debug(this.formatLog(nationId, `AI established trade relations with ${other.name}${suffix}`));
          }
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
    // Strategic Resource Demand raises the buyer's priority to seek the resource:
    // demanded resources are attempted first through the *existing* trade path
    // (same pricing, seller evaluation, capacity and cooldowns). It never forces
    // a seller to accept.
    const demandedResourceIds = this.getSignificantlyDemandedResourceIds(nationId);
    const prioritizeDemanded = (ids: string[]): string[] => (
      demandedResourceIds.size === 0
        ? ids
        : [...ids.filter((id) => demandedResourceIds.has(id)), ...ids.filter((id) => !demandedResourceIds.has(id))]
    );
    let dealsCreated = 0;

    if (luxuryValueMultiplier > 1.0) {
      console.debug(
        this.formatLog(nationId, `AI increasing luxury value (x${luxuryValueMultiplier}) due to happiness ${happiness?.netHappiness} (state: ${happiness?.state}).`),
      );
    }

    // Score potential sellers: base = trust toward them, +50 bonus for human player.
    const currentRound = this.turnManager.getCurrentRound();
    const scoredSellers = this.nationManager.getAllNations()
      .filter((other) => {
        if (other.id === nationId) return false;
        // Never reach out to a nation we have not actually discovered yet —
        // consistent with every other AI diplomacy decision. Without this, a
        // scenario-configured (or otherwise pre-seeded) trade relation would let
        // the AI message the human before the two have met.
        if (this.discoverySystem && !this.discoverySystem.hasMet(nationId, other.id)) return false;
        if (this.diplomacyManager!.getState(nationId, other.id) === 'WAR') return false;
        if (!this.diplomacyManager!.hasTradeRelations(nationId, other.id)) return false;
        return true;
      })
      .map((other) => {
        const relation = this.diplomacyManager!.getRelation(nationId, other.id);
        const humanBonus = other.isHuman ? HUMAN_PLAYER_TRADE_PRIORITY : 0;
        return { nation: other, score: relation.trust + humanBonus };
      })
      .sort((a, b) => b.score - a.score);

    outer: for (const { nation: other } of scoredSellers) {
      // Human player: generate a proposal instead of creating a deal directly
      if (other.isHuman && this.diplomaticProposalSystem) {
        const humanId = other.id;
        const lastProposal = this.lastTradeProposalTurnByNation.get(nationId) ?? -999;
        if (currentRound - lastProposal < TRADE_PROPOSAL_CADENCE) continue;

        // Personality-driven request to acquire exploitation rights in the human's
        // territory. Interest-gated and resource-blind — the AI never scans the
        // human's map; it only knows its own leader values such rights. Shares the
        // trade-proposal cadence so it can never spam alongside trade offers.
        const exploitationInterest = getLeaderExploitationInterestByNationId(nationId);
        if (isExploitationRequestEligible(this.diplomacyManager!, nationId, humanId, exploitationInterest)) {
          // Actual Strategic Resource Demand now co-drives desirability: a nation
          // blocked from Workshop/Factory that knows an exploitable foreign tile
          // holding the demanded resource has substantially more reason to ask.
          // Eligibility (Colonialism, interest, war, already-held) and the shared
          // proposal cadence are unchanged, and the grantor still evaluates the
          // proposal on its own terms — demand influences the requester only.
          const matched = this.getMatchedExploitationDemand(nationId, humanId);
          const desirability = evaluateExploitationRequestDesirability(exploitationInterest, matched?.demandScore ?? 0);
          const hasPendingExploitation = this.diplomaticProposalSystem
            .getPendingProposalsForNation(humanId)
            .some((p) => p.fromNationId === nationId && p.payload.kind === 'exploitation_rights');
          if (!hasPendingExploitation) {
            this.diplomaticProposalSystem.createProposal({
              fromNationId: nationId,
              toNationId: humanId,
              kind: 'exploitation_rights',
              payload: { kind: 'exploitation_rights', grantorNationId: humanId, beneficiaryNationId: nationId },
              createdTurn: currentRound,
              expiresTurn: currentRound + TRADE_PROPOSAL_EXPIRY_TURNS,
            });
            this.lastTradeProposalTurnByNation.set(nationId, currentRound);
            if (desirability.demandDriven && matched) {
              console.log(this.formatLog(
                nationId,
                `requested Foreign Resource Exploitation Rights from human player; target strategic need: ${matched.resourceName} at (${matched.x},${matched.y}), demand ${matched.demandScore} (leader interest ${exploitationInterest}, desirability ${desirability.desirability}).`,
              ));
            } else {
              console.debug(this.formatLog(nationId, `requests exploitation rights from human player (leader interest ${exploitationInterest}).`));
            }
            break outer;
          }
        }

        const alreadyHasPending = this.diplomaticProposalSystem
          .getPendingProposalsForNation(humanId)
          .some((p) => p.fromNationId === nationId && p.payload.kind === 'resource_trade');
        if (alreadyHasPending) continue;

        // Check connection capacity exists between these nations
        const connCapacity = this.tradeConnectionSystem?.getActiveDealCapacityBetweenNations(nationId, humanId) ?? 0;
        const connUsed = this.tradeDealSystem.getDealsBetween(nationId, humanId).length;
        if (connCapacity <= connUsed) continue;

        // Try "buy from human": human sells a resource this AI lacks. Candidates
        // are everything the human can legally export (natural + manufactured),
        // so corporation goods enter the AI trade pool alongside raw resources.
        const humanResources = prioritizeDemanded(this.resourceAccessSystem
          .getExportableResourceQuantities(humanId)
          .map((entry) => entry.resourceId));
        for (const resourceId of humanResources) {
          if (available.has(resourceId)) continue;
          const alreadyImporting = this.tradeDealSystem.getDealsBetween(nationId, humanId)
            .some((d) => d.sellerNationId === humanId && d.resourceId === resourceId);
          if (alreadyImporting) continue;
          // Don't propose buying what the human cannot export: owned quantity
          // caps simultaneous exports (mirrors canExportResource).
          if (!this.resourceAccessSystem.canExportResource(humanId, resourceId)) continue;
          const gpt = getProposalGoldPerTurn(resourceId, luxuryValueMultiplier);
          if (this.nationManager.getResources(nationId).gold < gpt) continue;
          this.diplomaticProposalSystem.createProposal({
            fromNationId: nationId,
            toNationId: humanId,
            kind: 'resource_trade',
            payload: { kind: 'resource_trade', resourceId, turns: dealTurns, goldPerTurn: gpt, sellerNationId: humanId, buyerNationId: nationId },
            createdTurn: currentRound,
            expiresTurn: currentRound + TRADE_PROPOSAL_EXPIRY_TURNS,
          });
          this.lastTradeProposalTurnByNation.set(nationId, currentRound);
          console.debug(this.formatLog(nationId, `AI proposed to buy ${resourceId} from human player.`));
          break outer;
        }

        // Try "sell to human": AI offers a resource the human lacks. Candidates
        // are everything this AI can legally export (natural + manufactured).
        const humanAvailable = new Set(this.resourceAccessSystem.getAvailableResources(humanId));
        const aiResources = this.resourceAccessSystem
          .getExportableResourceQuantities(nationId)
          .map((entry) => entry.resourceId);
        for (const resourceId of aiResources) {
          if (humanAvailable.has(resourceId)) continue;
          const alreadySelling = this.tradeDealSystem.getDealsBetween(nationId, humanId)
            .some((d) => d.sellerNationId === nationId && d.resourceId === resourceId);
          if (alreadySelling) continue;
          // Only offer to sell what this nation can still export: owned quantity
          // caps simultaneous exports (mirrors canExportResource).
          if (!this.resourceAccessSystem.canExportResource(nationId, resourceId)) continue;
          const gpt = getProposalGoldPerTurn(resourceId, luxuryValueMultiplier);
          this.diplomaticProposalSystem.createProposal({
            fromNationId: nationId,
            toNationId: humanId,
            kind: 'resource_trade',
            payload: { kind: 'resource_trade', resourceId, turns: dealTurns, goldPerTurn: gpt },
            createdTurn: currentRound,
            expiresTurn: currentRound + TRADE_PROPOSAL_EXPIRY_TURNS,
          });
          this.lastTradeProposalTurnByNation.set(nationId, currentRound);
          console.debug(this.formatLog(nationId, `AI proposed to sell ${resourceId} to human player.`));
          break outer;
        }
        continue; // No suitable proposal found; try next seller (AI)
      }

      // Non-human: direct deal (existing behavior). Candidates are everything the
      // seller can legally export (natural + manufactured), so corporation goods
      // participate in AI ↔ AI trade the same way raw resources do.
      const ownedResources = this.resourceAccessSystem
        .getExportableResourceQuantities(other.id)
        .map((entry) => entry.resourceId);
      const orderedResources = prioritizeDemanded(luxuryValueMultiplier > 1.0
        ? [...ownedResources].sort((a, b) => luxuryRank(b) - luxuryRank(a))
        : [...ownedResources]);

      for (const resourceId of orderedResources) {
        if (available.has(resourceId)) continue;
        if (this.resourceAccessSystem.hasImportedResource(nationId, resourceId)) continue;
        // Manufactured goods carry their own trade price; naturals keep the
        // existing base/luxury pricing so natural-resource trades are unchanged.
        const manufactured = getManufacturedResourceById(resourceId);
        const isLuxury = getNaturalResourceById(resourceId)?.category === 'luxury';
        const offerGoldPerTurn = manufactured
          ? manufactured.tradeGoldPerTurn ?? baseGoldPerTurn
          : isLuxury
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

  // ─── Trade route creation ────────────────────────────────────────────────────

  private runTradeRoutesForNation(nationId: string): void {
    if (!this.tradeConnectionSystem || !this.diplomacyManager) return;
    if (this.turnManager.getCurrentRound() % 10 !== 0) return;

    const nation = this.nationManager.getNation(nationId);
    if (!nation || nation.isHuman) return;

    // Skip if nation is too poor
    if (this.nationManager.getResources(nationId).gold < -50) return;

    // Skip if nation already has a building connection in progress
    const alreadyBuilding = this.tradeConnectionSystem.getAllConnections()
      .some((c) => (c.nationAId === nationId || c.nationBId === nationId) && c.status === 'building');
    if (alreadyBuilding) return;

    // Own cities with available trade capacity
    const ownCities = this.cityManager.getCitiesByOwner(nationId)
      .filter((c) => this.tradeConnectionSystem!.getCityAvailableTradeCapacity(c.id) > 0);
    if (ownCities.length === 0) return;

    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.discoverySystem && !this.discoverySystem.hasMet(nationId, other.id)) continue;
      if (this.diplomacyManager.getState(nationId, other.id) === 'WAR') continue;
      if (!this.diplomacyManager.hasTradeRelations(nationId, other.id)) continue;

      // Skip hostile relations
      const relation = this.diplomacyManager.getRelation(nationId, other.id);
      if (relation.hostility >= 50) continue;

      // Skip if already have any connection between these nations
      const hasExisting = this.tradeConnectionSystem.getAllConnections().some(
        (c) => (c.nationAId === nationId && c.nationBId === other.id) ||
               (c.nationAId === other.id && c.nationBId === nationId),
      );
      if (hasExisting) continue;

      // Target cities with available capacity
      const targetCities = this.cityManager.getCitiesByOwner(other.id)
        .filter((c) => this.tradeConnectionSystem!.getCityAvailableTradeCapacity(c.id) > 0);
      if (targetCities.length === 0) continue;

      // Pick best own city (prefer capital)
      const fromCity = ownCities.find((c) => c.isResidenceCapital) ?? ownCities[0];
      // Pick best target city (prefer capital)
      const toCity = targetCities.find((c) => c.isResidenceCapital) ?? targetCities[0];
      if (!fromCity || !toCity) continue;

      const validation = this.tradeConnectionSystem.canCreateTradeConnection(fromCity.id, toCity.id);
      if (!validation.ok) continue;

      const connection = this.tradeConnectionSystem.createTradeConnectionDraft(
        fromCity.id, toCity.id, this.turnManager.getCurrentRound(),
      );
      const tradeRouteItem: Producible = {
        kind: 'tradeRoute',
        connectionId: connection.id,
        fromCityId: fromCity.id,
        toCityId: toCity.id,
        targetNationId: other.id,
        displayName: `Trade Route to ${toCity.name}`,
        productionCost: TRADE_ROUTE_PRODUCTION_COST,
      };
      this.productionSystem.enqueue(fromCity.id, tradeRouteItem);
      console.debug(this.formatLog(nationId, `AI started trade route project ${fromCity.name} ↔ ${toCity.name}.`));
      break; // One route per evaluation
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
      // Strategy changes can alter the doctrine-adjusted military cap, so the
      // over-cap Happiness component must update in the same AI turn.
      this.happinessSystem?.recalculateNation(nationId);
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
      reclaimRecovering: deriveReclaimObjective(nationId, this.cityManager.getAllCities()) !== null,
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

  private getOffensiveOperation(nationId: string, strategy: AIStrategy): OffensiveOperation | null {
    const round = this.turnManager.getCurrentRound();
    const warEnemyIds = this.nationManager.getAllNations()
      .filter((n) => n.id !== nationId && this.isAtWarWith(nationId, n.id))
      .map((n) => n.id);
    if (warEnemyIds.length === 0) return null;

    const ownCities = this.cityManager.getCitiesByOwner(nationId);
    if (ownCities.length === 0) return null;

    const ownAnchor = { x: ownCities[0].tileX, y: ownCities[0].tileY };
    const ownLandCombatUnits = this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => !u.unitType.isNaval && u.unitType.baseStrength > 0);

    // A nation recovering its lost capital fixes that city as the dominant land
    // target (only relevant when the holder is among the current war enemies).
    const reclaimTargetCityId = deriveReclaimObjective(nationId, this.cityManager.getAllCities())
      ?.targetCityId;

    const op = this.offensiveOperationSystem.getOperation({
      nationId,
      round,
      warEnemyNationIds: warEnemyIds,
      allCities: this.cityManager.getAllCities(),
      ownAnchor,
      ownLandCombatUnits,
      aggression: strategy.military.aggression,
      distanceFn: (a, b) => this.gridSystem.getDistance(a, b),
      reclaimTargetCityId,
    });

    if (op) {
      const logKey = `${nationId}:${op.targetCityId}`;
      if (!this.offensiveTargetLoggedKeys.has(logKey)) {
        this.offensiveTargetLoggedKeys.add(logKey);
        console.log(this.formatLog(nationId, `selected ${op.targetName} as offensive target.`));
      }
      if (op.committed) {
        const lastRound = this.offensiveCommitLoggedRound.get(nationId) ?? -1;
        if (lastRound !== round) {
          this.offensiveCommitLoggedRound.set(nationId, round);
          console.log(this.formatLog(nationId, `began coordinated push toward ${op.targetName} (${op.unitsNearTarget} units staged).`));
        }
      }
    }

    return op;
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
      if (!this.isProvocativeMilitaryPosture(nationId, enemy.id)) continue;

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

  // Effective number of cities this nation will voluntarily aim for. The
  // strategy's desiredCityCount is the baseline, clamped by any leader-specific
  // cap (e.g. Mad Jack's one-city challenge via maxPreferredCities). Cities
  // taken by conquest/treaty/gift bypass this entirely — it only gates the
  // nation's own settler production and expansion drive.
  private getEffectiveDesiredCityCount(nationId: string, strategy: AIStrategy): number {
    const baseline = strategy.expansion.desiredCityCount;
    const leaderCap = getLeaderMaxPreferredCitiesByNationId(nationId);
    return leaderCap === undefined ? baseline : Math.min(baseline, leaderCap);
  }

  // Single source of truth for "is this settler allowed to found a city
  // here, right now?" — combines the FoundCitySystem terrain rules with the
  // strategy's settlerMinCityDistance spacing requirement against ALL cities
  // (own and foreign).
  private canFoundWithSpacing(settler: Unit, strategy: AIStrategy, eraStrategy: AILeaderEraStrategy): boolean {
    if (!this.foundCitySystem.canFound(settler)) return false;
    // AI keeps a safety distance from active Barbarian Camps (humans may settle
    // right next to them; only the camp tile itself is universally blocked).
    if (this.minDistanceToBarbarianCamps(settler.tileX, settler.tileY) < BARBARIAN_CAMP_CITY_SAFETY_DISTANCE) {
      return false;
    }
    const minDist = this.minDistanceToCities(
      settler.tileX,
      settler.tileY,
      this.cityManager.getAllCities(),
    );
    return minDist >= this.getEffectiveSettlerMinCityDistance(strategy, eraStrategy);
  }

  /** Smallest hex distance from (tileX, tileY) to any active Barbarian Camp. */
  private minDistanceToBarbarianCamps(tileX: number, tileY: number): number {
    let min = Number.POSITIVE_INFINITY;
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (!isBarbarianCamp(tile.buildingId)) continue;
        const dist = this.gridSystem.getDistance({ x: tileX, y: tileY }, { x: tile.x, y: tile.y });
        if (dist < min) min = dist;
      }
    }
    return min;
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
      if (this.overseasExpansionSystem?.isUnitAssignedToActiveExpedition(settler.id) === true) continue;

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
    const units = this.unitManager.getUnitsByOwner(nationId).filter((unit) => !this.isCargoUnit(unit));
    const strategy = this.getStrategy(nationId);
    const navalContext = this.buildNavalPatrolContext(nationId);

    for (const unit of units) {
      if (unit.movementPoints <= 0) continue;
      if (unit.unitType.baseStrength <= 0) continue; // settlers can't attack
      if (this.emergencyAssignmentCityByUnit.has(unit.id)) continue;
      if (this.isEmergencyCityGarrison(unit, nationId)) continue;
      if (!this.canTakeAggressiveAction(unit, strategy)) continue;
      if (this.unitManager.getUnit(unit.id) === undefined) continue;

      if (this.tryNavalExpeditionAttack(unit, nationId, navalContext)) continue;
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

    const isLandTactics = isLandTacticsEligible(unit, this.mapData);
    const ownLandUnits = isLandTactics
      ? this.unitManager.getUnitsByOwner(nationId).filter((u) => !u.unitType.isNaval)
      : [];
    const enemyLandUnits = isLandTactics
      ? this.unitManager.getAllUnits().filter((u) => u.ownerId !== nationId && !u.unitType.isNaval)
      : [];

    const scored: { x: number; y: number; score: number; roleBonus: number; hadVulnerable: boolean }[] = [];
    for (const tile of tiles) {
      const target = this.findEnemyTargetAt(tile.x, tile.y, nationId);
      if (!target) continue;

      const context = this.buildCombatContext(unit, target, nationId, tile.x, tile.y);
      const baseScore = scoreCombatTarget(context, strategy, intent);
      const roleBonus = scoreRoleBasedTarget(unit, context);

      let tacBonus = 0;
      let hadVulnerable = false;
      if (isLandTactics) {
        const targetPos = { x: tile.x, y: tile.y };
        hadVulnerable = ownLandUnits.some((u) => {
          const r = getMilitaryRole(u);
          return (r === 'ranged' || r === 'siege')
            && this.gridSystem.getDistance({ x: u.tileX, y: u.tileY }, targetPos) <= FRIENDLY_SUPPORT_DISTANCE;
        });
        const enemyAllyCount = enemyLandUnits.filter(
          (u) => this.gridSystem.getDistance({ x: u.tileX, y: u.tileY }, targetPos) <= FRIENDLY_SUPPORT_DISTANCE,
        ).length;
        tacBonus = scoreFocusFireTarget(context, hadVulnerable, enemyAllyCount)
          + estimateAttackRisk(context);
      }

      scored.push({ x: tile.x, y: tile.y, score: baseScore + roleBonus + tacBonus, roleBonus, hadVulnerable });
    }

    if (scored.length === 0) return false;

    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score < 0) return false; // not worth attacking this turn

    for (const candidate of scored) {
      if (candidate.score < 0) break;
      if (this.combatSystem.tryAttack(unit, candidate.x, candidate.y)) {
        if (candidate.roleBonus < 0) {
          console.debug(this.formatLog(nationId, `${unit.unitType.name} attacked adjacent (no safe range available).`));
        } else if (candidate.hadVulnerable) {
          console.debug(this.formatLog(nationId, `${unit.unitType.name} protected nearby ranged unit.`));
        }
        return true;
      }
    }
    return false;
  }

  private tryNavalExpeditionAttack(
    unit: Unit,
    nationId: string,
    context: NavalPatrolContext,
  ): boolean {
    const assignment = context.expeditionAssignment;
    if (!assignment || !assignment.assignedUnitIds.includes(unit.id)) return false;
    if (context.ownZoneHasEnemy) return false;
    if (!this.isNavalExpeditionEligibleUnit(unit)) return false;

    if ((unit.unitType.rangedStrength ?? 0) > 0) {
      return this.tryRangedNavalExpeditionAttack(unit, nationId, assignment);
    }
    return this.tryMeleeNavalExpeditionAttack(unit, nationId, assignment);
  }

  private tryRangedNavalExpeditionAttack(
    unit: Unit,
    nationId: string,
    assignment: NavalExpeditionAssignment,
  ): boolean {
    const target = this.pickRangedNavalExpeditionTarget(unit, nationId, assignment);
    if (!target) return false;

    if (!this.combatSystem.tryAttack(unit, target.x, target.y)) return false;
    this.logNavalExpeditionAttack(nationId, assignment, target.logMessage);
    return true;
  }

  private tryMeleeNavalExpeditionAttack(
    unit: Unit,
    nationId: string,
    assignment: NavalExpeditionAssignment,
  ): boolean {
    const adjacentThreats = this.getExpeditionEnemyNavalThreats(nationId, assignment)
      .filter((enemy) => this.gridSystem.isAdjacent(
        { x: unit.tileX, y: unit.tileY },
        { x: enemy.tileX, y: enemy.tileY },
      ))
      .sort((a, b) => (
        a.health / a.unitType.baseHealth - b.health / b.unitType.baseHealth
        || a.id.localeCompare(b.id)
      ));

    for (const enemy of adjacentThreats) {
      if (this.combatSystem.tryAttack(unit, enemy.tileX, enemy.tileY)) {
        this.logNavalExpeditionAttack(nationId, assignment, `naval expedition engaged enemy ship near ${assignment.targetCityName}`);
        return true;
      }
    }
    return false;
  }

  private pickRangedNavalExpeditionTarget(
    unit: Unit,
    nationId: string,
    assignment: NavalExpeditionAssignment,
  ): { x: number; y: number; score: number; logMessage: string } | null {
    const range = unit.unitType.range ?? 1;
    const unitPos = { x: unit.tileX, y: unit.tileY };
    const candidates: { x: number; y: number; score: number; logMessage: string }[] = [];

    for (const enemy of this.getExpeditionEnemyNavalThreats(nationId, assignment)) {
      const dist = this.gridSystem.getDistance(unitPos, { x: enemy.tileX, y: enemy.tileY });
      if (dist > range) continue;
      candidates.push({
        x: enemy.tileX,
        y: enemy.tileY,
        score: 500 + Math.round((1 - enemy.health / enemy.unitType.baseHealth) * 50) - dist,
        logMessage: `naval expedition engaged enemy ship near ${assignment.targetCityName}`,
      });
    }

    const targetCity = this.cityManager.getCity(assignment.targetCityId);
    if (
      targetCity &&
      targetCity.ownerId === assignment.targetOwnerNationId &&
      (this.diplomacyManager?.canAttack(nationId, targetCity.ownerId) ?? true)
    ) {
      const cityDist = this.gridSystem.getDistance(unitPos, assignment.targetPos);
      if (cityDist <= range) {
        candidates.push({
          x: targetCity.tileX,
          y: targetCity.tileY,
          score: 420 + Math.round((1 - targetCity.health / CITY_BASE_HEALTH) * 40) - cityDist,
          logMessage: `naval expedition bombarded ${targetCity.name} with ${unit.unitType.name}`,
        });
      }
    }

    for (const enemy of this.unitManager.getAllUnits()) {
      if (enemy.ownerId === nationId) continue;
      if (enemy.unitType.isNaval === true) continue;
      if (enemy.unitType.baseStrength <= 0 && (enemy.unitType.rangedStrength ?? 0) <= 0) continue;
      if (!(this.diplomacyManager?.canAttack(nationId, enemy.ownerId) ?? true)) continue;

      const enemyPos = { x: enemy.tileX, y: enemy.tileY };
      const dist = this.gridSystem.getDistance(unitPos, enemyPos);
      if (dist > range) continue;
      if (!this.isCoastalBombardmentLandTarget(enemyPos)) continue;
      if (this.gridSystem.getDistance(enemyPos, assignment.targetPos) > Math.max(range, NAVAL_EXPEDITION_COASTAL_UNIT_RADIUS + 2)) continue;

      const isRangedOrSiege = enemy.unitType.category === 'ranged' || enemy.unitType.category === 'siege';
      const isDamaged = enemy.health / enemy.unitType.baseHealth < 0.6;
      candidates.push({
        x: enemy.tileX,
        y: enemy.tileY,
        score: (isRangedOrSiege ? 330 : 250)
          + (isDamaged ? 45 : 0)
          + Math.round((1 - enemy.health / enemy.unitType.baseHealth) * 30)
          - dist,
        logMessage: `naval expedition attacked coastal unit near ${assignment.targetCityName}`,
      });
    }

    candidates.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
    return candidates[0] ?? null;
  }

  private getExpeditionEnemyNavalThreats(
    nationId: string,
    assignment: NavalExpeditionAssignment,
  ): Unit[] {
    const assignedShips = assignment.assignedUnitIds
      .map((unitId) => this.unitManager.getUnit(unitId))
      .filter((ship): ship is Unit => ship !== undefined);

    return this.unitManager.getAllUnits()
      .filter((enemy) => enemy.ownerId !== nationId)
      .filter((enemy) => enemy.unitType.isNaval === true)
      .filter((enemy) => enemy.unitType.baseStrength > 0 || (enemy.unitType.rangedStrength ?? 0) > 0)
      .filter((enemy) => this.diplomacyManager?.canAttack(nationId, enemy.ownerId) ?? true)
      .filter((enemy) => {
        const enemyPos = { x: enemy.tileX, y: enemy.tileY };
        if (this.gridSystem.getDistance(enemyPos, assignment.targetPos) <= NAVAL_EXPEDITION_THREAT_RADIUS) return true;
        return assignedShips.some((ship) => this.gridSystem.getDistance(
          enemyPos,
          { x: ship.tileX, y: ship.tileY },
        ) <= NAVAL_EXPEDITION_THREAT_RADIUS);
      })
      .sort((a, b) => (
        this.gridSystem.getDistance({ x: a.tileX, y: a.tileY }, assignment.targetPos)
        - this.gridSystem.getDistance({ x: b.tileX, y: b.tileY }, assignment.targetPos)
        || a.id.localeCompare(b.id)
      ));
  }

  private isCoastalBombardmentLandTarget(pos: GridCoord): boolean {
    const tile = this.mapData.tiles[pos.y]?.[pos.x];
    if (!tile || tile.type === TileType.Ocean || tile.type === TileType.Coast) return false;

    for (const nearby of this.gridSystem.getTilesInRange(
      pos,
      NAVAL_EXPEDITION_COASTAL_UNIT_RADIUS,
      this.mapData,
      { includeCenter: false },
    )) {
      if (nearby.type === TileType.Coast || nearby.type === TileType.Ocean) return true;
    }
    return false;
  }

  private logNavalExpeditionAttack(
    nationId: string,
    assignment: NavalExpeditionAssignment,
    message: string,
  ): void {
    const round = this.turnManager.getCurrentRound();
    const key = `${nationId}:${assignment.targetCityId}:${message}`;
    if (this.navalExpeditionAttackLoggedRound.get(key) === round) return;
    this.navalExpeditionAttackLoggedRound.set(key, round);
    console.log(this.formatLog(nationId, message));
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

    // Hidden-nation units (insurgents, privateers, spies, agents) are freely
    // attackable by anyone without a war — matching CombatSystem's war bypass.
    const targetIsHiddenNation = isUnit(target) && getAllegianceType(target.unitType) === 'hiddenNation';
    const canAttack = targetIsHiddenNation
      ? true
      : this.diplomacyManager
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
    const units = this.unitManager.getUnitsByOwner(nationId).filter((unit) => !this.isCargoUnit(unit));
    const strategy = this.getStrategy(nationId);

    const weights = getBehaviorWeights(this.nationManager.getNation(nationId)?.aiStrategyId);
    if (weights.exploration !== 1) {
      console.debug(this.formatLog(nationId, `AI exploration score adjusted by strategy weight ${weights.exploration}.`));
    }

    // Naval state shared across this nation's ships for the turn: defines
    // where we want to defend and which tiles are already claimed/occupied,
    // so multiple ships spread out instead of stacking.
    const navalContext = this.buildNavalPatrolContext(nationId);

    // Peacetime military spread: precomputed once so excess unit IDs and target
    // claims are shared across the full unit loop (avoids multiple units picking
    // the same coverage tile this turn).
    const spreadState = this.isAtWarWithAnyone(nationId)
      ? undefined
      : this.buildPeacetimeMilitarySpreadState(nationId, units);

    let spreadCount = 0;

    for (const unit of units) {
      if (unit.movementPoints <= 0) continue;
      if (this.emergencyAssignmentCityByUnit.has(unit.id)) continue;
      if (this.isEmergencyCityGarrison(unit, nationId)) continue;
      if (this.overseasExpansionSystem?.isUnitAssignedToActiveExpedition(unit.id) === true) continue;
      if (unit.unitType.canFound) continue; // settlers handled in runSettlers
      if (unit.unitType.id === SCOUT.id) continue; // scouts use AIExplorationSystem
      if (unit.unitType.id === SCOUT_BOAT.id || unit.unitType.category === 'naval_recon') continue;
      if (unit.unitType.isInsurgentForce === true) continue; // insurgents use InsurgentBehaviorSystem
      if (isCovertOperative(unit.unitType)) continue; // Spy/Agent use AICovertOperationsSystem
      if (this.unitManager.getUnit(unit.id) === undefined) continue;

      if (unit.unitType.id === WORK_BOAT.id) {
        this.runWorkBoat(unit, nationId);
        continue;
      }

      if (unit.unitType.id === WORKER.id) {
        this.runWorker(unit, nationId);
        continue;
      }

      if (unit.unitType.isNaval) {
        this.moveNavalUnitForPatrol(unit, nationId, strategy, navalContext);
        continue;
      }

      // Peacetime spread: redirect excess city-clustered land military units to
      // coverage positions before strategy scoring can pull them back.
      if (spreadState?.excessUnitIds.has(unit.id)) {
        if (this.tryPeacetimeMilitarySpread(unit, nationId, spreadState)) {
          spreadCount += 1;
          continue;
        }
      }

      if (!this.canTakeAggressiveAction(unit, strategy)) continue;

      this.moveByStrategyScoring(unit, nationId, strategy);
    }

    if (spreadCount > 0) this.logPeacetimeRedeployOnce(nationId, spreadCount);
    this.logNavalExpeditionMovement(nationId, navalContext);
  }

  // ─── Peacetime military spread ───────────────────────────────────────────────

  private buildPeacetimeMilitarySpreadState(nationId: string, allUnits: Unit[]): PeacetimeMilitarySpreadState {
    const idleMilitary = allUnits.filter((u) => this.isIdlePeacetimeMilitaryLandUnit(u, nationId));
    const ownCities = this.cityManager.getCitiesByOwner(nationId);
    const excessUnitIds = this.findExcessClusteredUnitIds(idleMilitary, ownCities);
    return {
      excessUnitIds,
      ownTerritoryTiles: this.getOwnLandTerritoryTiles(nationId),
      ownCities,
      friendlyMilitaryPositions: idleMilitary.map((u) => ({ x: u.tileX, y: u.tileY })),
      claimedTargets: new Set<string>(),
    };
  }

  private isIdlePeacetimeMilitaryLandUnit(unit: Unit, nationId: string): boolean {
    if (unit.unitType.baseStrength <= 0) return false;
    if (unit.unitType.isNaval) return false;
    if (unit.unitType.category === 'recon') return false;
    if (unit.unitType.category === 'naval_recon') return false;
    if (unit.unitType.category === 'civilian') return false;
    if (unit.unitType.canFound) return false;
    if (unit.unitType.id === SCOUT.id) return false;
    if (this.overseasExpansionSystem?.isUnitAssignedToActiveExpedition(unit.id) === true) return false;
    if (unit.movementPoints <= 0) return false;
    return true;
  }

  private findExcessClusteredUnitIds(idleUnits: Unit[], cities: City[]): Set<string> {
    const claimedIds = new Set<string>();
    const excessIds = new Set<string>();

    for (const city of cities) {
      const cityPos = { x: city.tileX, y: city.tileY };
      const adjacent = idleUnits
        .filter((u) => !claimedIds.has(u.id))
        .filter((u) => this.gridSystem.getDistance({ x: u.tileX, y: u.tileY }, cityPos) <= 1);

      if (adjacent.length === 0) continue;

      adjacent.sort((a, b) => {
        const strengthDelta = b.unitType.baseStrength - a.unitType.baseStrength;
        if (strengthDelta !== 0) return strengthDelta;
        return (b.health / b.unitType.baseHealth) - (a.health / a.unitType.baseHealth);
      });

      claimedIds.add(adjacent[0].id);
      for (const unit of adjacent.slice(1)) excessIds.add(unit.id);
    }

    // A unit claimed as a defender by some city is never redeployed, even if
    // it was also listed as excess for a different city.
    for (const id of claimedIds) excessIds.delete(id);
    return excessIds;
  }

  private getOwnLandTerritoryTiles(nationId: string): Tile[] {
    const tiles: Tile[] = [];
    for (let y = 0; y < this.mapData.height; y++) {
      for (let x = 0; x < this.mapData.width; x++) {
        const tile = this.mapData.tiles[y]?.[x];
        if (!tile || tile.ownerId !== nationId) continue;
        if (tile.type === TileType.Coast || tile.type === TileType.Ocean || tile.type === TileType.Ice) continue;
        if (tile.type === TileType.Mountain) continue;
        tiles.push(tile);
      }
    }
    return tiles;
  }

  private tryPeacetimeMilitarySpread(
    unit: Unit,
    nationId: string,
    state: PeacetimeMilitarySpreadState,
  ): boolean {
    const target = this.findCoverageTarget(unit, state);
    if (!target) return false;

    const path = this.pathfindingSystem.findPath(unit, target.x, target.y, { respectMovementPoints: false });
    if (!path || path.length <= 1) return false;

    this.movementSystem.moveAlongPath(unit, path);
    state.claimedTargets.add(`${target.x},${target.y}`);
    return true;
  }

  private findCoverageTarget(unit: Unit, state: PeacetimeMilitarySpreadState): GridCoord | undefined {
    const unitPos = { x: unit.tileX, y: unit.tileY };
    const friendlyExcludingSelf = state.friendlyMilitaryPositions.filter(
      (p) => !(p.x === unitPos.x && p.y === unitPos.y),
    );

    const candidates = state.ownTerritoryTiles
      .filter((tile) => {
        if (tile.x === unitPos.x && tile.y === unitPos.y) return false;
        return this.unitManager.getUnitAt(tile.x, tile.y) === null;
      })
      .map((tile) => ({
        tile,
        score: this.scoreCoverageTile(tile, state.ownCities, friendlyExcludingSelf, state.claimedTargets),
      }))
      .filter(({ score }) => score > Number.NEGATIVE_INFINITY)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.tile.y - b.tile.y) || (a.tile.x - b.tile.x);
      });

    for (const { tile } of candidates.slice(0, 8)) {
      const path = this.pathfindingSystem.findPath(unit, tile.x, tile.y, { respectMovementPoints: false });
      if (path && path.length > 1) return { x: tile.x, y: tile.y };
    }
    return undefined;
  }

  private scoreCoverageTile(
    tile: Tile,
    ownCities: City[],
    friendlyMilitaryPositions: GridCoord[],
    claimedTargets: Set<string>,
  ): number {
    const pos = { x: tile.x, y: tile.y };

    if (claimedTargets.has(`${tile.x},${tile.y}`)) return Number.NEGATIVE_INFINITY;

    // Penalty: adjacent to a city center (want to avoid clustering)
    const adjacentToCity = ownCities.some(
      (city) => this.gridSystem.getDistance(pos, { x: city.tileX, y: city.tileY }) <= 1,
    );
    if (adjacentToCity) return Number.NEGATIVE_INFINITY;

    let score = 0;

    // Frontier and border bonuses — scan neighbours once
    let adjForeign = false;
    let adjUnowned = false;
    let adjCoast = false;
    let adjFriendly = false;
    for (const adj of this.gridSystem.getAdjacentCoords(pos)) {
      const adjTile = this.mapData.tiles[adj.y]?.[adj.x];
      if (!adjTile) continue;
      if (adjTile.ownerId !== undefined && adjTile.ownerId !== tile.ownerId) adjForeign = true;
      if (adjTile.ownerId === undefined) adjUnowned = true;
      if (adjTile.type === TileType.Coast || adjTile.type === TileType.Ocean) adjCoast = true;
    }
    if (adjForeign) score += 15;
    if (adjUnowned) score += 20;

    if (tile.resourceId !== undefined) score += 10;
    if (tile.improvementId !== undefined) score += 10;
    if (adjCoast) score += 8;

    // Spread bonus: reward tiles far from other friendly military
    if (friendlyMilitaryPositions.length > 0) {
      const minFriendlyDist = Math.min(
        ...friendlyMilitaryPositions.map((p) => this.gridSystem.getDistance(pos, p)),
      );
      if (minFriendlyDist <= 1) adjFriendly = true;
      score += Math.min(minFriendlyDist * 4, 32);
    } else {
      score += 16;
    }

    if (adjFriendly) score -= 50;

    // Proximity penalty: don't send units too far from nearest owned city
    if (ownCities.length > 0) {
      const minCityDist = Math.min(
        ...ownCities.map((c) => this.gridSystem.getDistance(pos, { x: c.tileX, y: c.tileY })),
      );
      score -= Math.min(minCityDist * 2, 30);
    }

    return score;
  }

  private logPeacetimeRedeployOnce(nationId: string, count: number): void {
    const round = this.turnManager.getCurrentRound();
    if (this.peacetimeSpreadLoggedRound.get(nationId) === round) return;
    this.peacetimeSpreadLoggedRound.set(nationId, round);
    this.logStrategicEvent?.(
      nationId,
      `redeploying ${count} idle military unit${count === 1 ? '' : 's'} away from city cluster.`,
    );
  }

  // ─── Naval patrol ────────────────────────────────────────────────────────────

  private buildNavalPatrolContext(nationId: string): NavalPatrolContext {
    const targets = this.getCoastalDefenseTargets(nationId);
    const enemyTargets = this.getEnemyCoastalTargets(nationId);
    // A genuine coastal EmergencyCityThreat counts as the home coast being
    // threatened, so offensive expeditions yield priority (reusing the existing
    // home-defense recall) and the home fleet stays defensive.
    const ownZoneHasEnemy = this.ownCoastalZoneHasEnemy(nationId, targets)
      || this.getCoastalEmergencyThreats(nationId).length > 0;
    const expeditionTarget = this.getNavalExpeditionTarget(nationId, ownZoneHasEnemy);
    const expeditionAssignment = this.getNavalExpeditionAssignment(nationId, expeditionTarget, ownZoneHasEnemy);
    // Pre-claim tiles that own naval units already occupy so other ships
    // don't try to converge onto a tile they can't enter (no stacking).
    const claimedNavalTiles = new Set<string>();
    for (const u of this.unitManager.getUnitsByOwner(nationId).filter((unit) => !this.isCargoUnit(unit))) {
      if (u.unitType.isNaval) claimedNavalTiles.add(tileKey(u.tileX, u.tileY));
    }
    return {
      targets,
      enemyTargets,
      expeditionTarget,
      expeditionAssignment,
      expeditionAdvancedUnitIds: new Set<string>(),
      claimedNavalTiles,
      ownZoneHasEnemy,
    };
  }

  private getNavalExpeditionTarget(nationId: string, homeUnderThreat: boolean): NavalExpeditionTarget | null {
    const doctrine = getLeaderMilitaryDoctrineByNationId(nationId);
    if (doctrine.id !== 'navalPower') return null;
    if (!this.diplomacyManager) return null;

    const warEnemyIds = this.nationManager.getAllNations()
      .filter((nation) => nation.id !== nationId && this.diplomacyManager?.getState(nationId, nation.id) === 'WAR')
      .map((nation) => nation.id);
    if (warEnemyIds.length === 0) return null;

    const target = this.navalExpeditionTargetingSystem.getBestTarget({
      nationId,
      warEnemyNationIds: warEnemyIds,
      allCities: this.cityManager.getAllCities(),
      allUnits: this.unitManager.getAllUnits(),
      mapData: this.mapData,
      gridSystem: this.gridSystem,
      homeUnderThreat,
      hasRangedNavalCapability: this.hasRangedNavalUnitAvailableOrProducible(nationId),
      reclaimTargetCityId: deriveReclaimObjective(nationId, this.cityManager.getAllCities())
        ?.targetCityId,
    });

    if (target) {
      const logKey = `${nationId}:${target.cityId}:${target.score}`;
      if (!this.navalExpeditionTargetLoggedKeys.has(logKey)) {
        this.navalExpeditionTargetLoggedKeys.add(logKey);
        console.log(this.formatLog(
          nationId,
          `selected naval expedition target: ${target.cityName}, score ${target.score}, reasons: ${target.reasons.slice(0, 4).join(', ')}`,
        ));
      }
      return target;
    }

    const round = this.turnManager.getCurrentRound();
    const lastLogged = this.navalExpeditionNoTargetLoggedRound.get(nationId) ?? -Infinity;
    if (round - lastLogged >= 10) {
      this.navalExpeditionNoTargetLoggedRound.set(nationId, round);
      console.debug(this.formatLog(nationId, `no valid naval expedition target for ${doctrine.id}.`));
    }
    return null;
  }

  private getNavalExpeditionAssignment(
    nationId: string,
    target: NavalExpeditionTarget | null,
    homeUnderThreat: boolean,
  ): NavalExpeditionAssignment | null {
    const existing = this.navalExpeditionAssignments.get(nationId);
    const cancellationReason = this.getNavalExpeditionCancellationReason(nationId, existing, homeUnderThreat);
    if (existing && cancellationReason) {
      this.navalExpeditionAssignments.delete(nationId);
      console.log(this.formatLog(nationId, `cancelled naval expedition toward ${existing.targetCityName}: ${cancellationReason}`));
    }

    if (!target) return this.navalExpeditionAssignments.get(nationId) ?? null;
    if (homeUnderThreat) return null;

    const current = this.navalExpeditionAssignments.get(nationId);
    if (current) {
      if (
        current.targetCityId === target.cityId ||
        !this.shouldRetargetNavalExpedition(current, target)
      ) {
        const refreshed = this.refreshNavalExpeditionAssignment(current, target);
        this.navalExpeditionAssignments.set(nationId, refreshed);
        return refreshed;
      }
      this.navalExpeditionAssignments.delete(nationId);
      console.log(this.formatLog(nationId, `cancelled naval expedition toward ${current.targetCityName}: better target identified`));
    }

    const assignment = this.formNavalExpeditionAssignment(nationId, target);
    if (assignment) {
      this.navalExpeditionAssignments.set(nationId, assignment);
      console.log(this.formatLog(nationId, `formed naval expedition toward ${assignment.targetCityName} with ${assignment.assignedUnitIds.length} ships`));
    }
    return assignment;
  }

  private getNavalExpeditionCancellationReason(
    nationId: string,
    assignment: NavalExpeditionAssignment | undefined,
    homeUnderThreat: boolean,
  ): string | null {
    if (!assignment) return null;
    if (homeUnderThreat) return 'home coast threatened';

    const city = this.cityManager.getCity(assignment.targetCityId);
    if (!city) return 'target city unavailable';
    if (city.ownerId !== assignment.targetOwnerNationId) return 'target city changed hands';
    if (this.diplomacyManager?.getState(nationId, city.ownerId) !== 'WAR') return 'war ended';

    const assignedUnits = assignment.assignedUnitIds
      .map((unitId) => this.unitManager.getUnit(unitId))
      .filter((unit): unit is Unit => unit !== undefined && this.isNavalExpeditionEligibleUnit(unit));
    if (assignedUnits.length < NAVAL_EXPEDITION_MIN_SHIPS) return 'not enough assigned ships remain';
    if (!assignedUnits.some((unit) => (unit.unitType.rangedStrength ?? 0) > 0)) return 'no ranged naval unit remains';

    const averageHealthRatio = assignedUnits.reduce(
      (sum, unit) => sum + unit.health / unit.unitType.baseHealth,
      0,
    ) / assignedUnits.length;
    if (averageHealthRatio < NAVAL_EXPEDITION_DAMAGED_FLEET_RATIO) return 'fleet too damaged';
    if (this.isNavalExpeditionTargetHeavilyDefended(nationId, assignment, assignedUnits.length)) {
      return 'target heavily defended';
    }

    return null;
  }

  private isNavalExpeditionTargetHeavilyDefended(
    nationId: string,
    assignment: NavalExpeditionAssignment,
    assignedShipCount: number,
  ): boolean {
    let nearbyDefenders = 0;
    for (const enemy of this.unitManager.getAllUnits()) {
      if (enemy.ownerId === nationId) continue;
      if (!(this.diplomacyManager?.canAttack(nationId, enemy.ownerId) ?? true)) continue;
      if (enemy.unitType.baseStrength <= 0 && (enemy.unitType.rangedStrength ?? 0) <= 0) continue;
      const dist = this.gridSystem.getDistance(
        { x: enemy.tileX, y: enemy.tileY },
        assignment.targetPos,
      );
      if (dist <= NAVAL_EXPEDITION_TARGET_DEFENSE_RADIUS) nearbyDefenders += 1;
    }
    return nearbyDefenders >= assignedShipCount + 3;
  }

  private refreshNavalExpeditionAssignment(
    assignment: NavalExpeditionAssignment,
    target: NavalExpeditionTarget,
  ): NavalExpeditionAssignment {
    const assignedUnitIds = assignment.assignedUnitIds.filter((unitId) => {
      const unit = this.unitManager.getUnit(unitId);
      return unit !== undefined && this.isNavalExpeditionEligibleUnit(unit);
    });
    return {
      ...assignment,
      targetCityName: target.cityName,
      targetOwnerNationId: target.ownerNationId,
      targetPos: { x: target.x, y: target.y },
      targetScore: target.score,
      assignedUnitIds,
      lastUpdatedTurn: this.turnManager.getCurrentRound(),
    };
  }

  private shouldRetargetNavalExpedition(
    assignment: NavalExpeditionAssignment,
    candidate: NavalExpeditionTarget,
  ): boolean {
    if (candidate.score < assignment.targetScore + NAVAL_EXPEDITION_RETARGET_SCORE_DELTA) return false;

    const assignedUnits = assignment.assignedUnitIds
      .map((unitId) => this.unitManager.getUnit(unitId))
      .filter((unit): unit is Unit => unit !== undefined);
    const committed = assignedUnits.some((unit) => (
      this.gridSystem.getDistance(
        { x: unit.tileX, y: unit.tileY },
        assignment.targetPos,
      ) <= NAVAL_EXPEDITION_COMMITTED_DISTANCE
    ));
    return !committed;
  }

  private formNavalExpeditionAssignment(
    nationId: string,
    target: NavalExpeditionTarget,
  ): NavalExpeditionAssignment | null {
    const combatShips = this.unitManager.getUnitsByOwner(nationId)
      .filter((unit) => this.isNavalExpeditionEligibleUnit(unit));
    if (combatShips.length < NAVAL_EXPEDITION_MIN_SHIPS + NAVAL_EXPEDITION_HOME_RESERVE) return null;

    const reservedUnitIds = this.getNavalHomeReserveUnitIds(nationId, combatShips);
    const candidates = combatShips
      .filter((unit) => !reservedUnitIds.has(unit.id))
      .filter((unit) => this.hasNavalPathToExpeditionTarget(unit, target));

    const ranged = candidates
      .filter((unit) => (unit.unitType.rangedStrength ?? 0) > 0)
      .sort((a, b) => this.compareNavalExpeditionCandidates(a, b, target))
      .slice(0, 2);
    const rangedIds = new Set(ranged.map((unit) => unit.id));
    const screens = candidates
      .filter((unit) => !rangedIds.has(unit.id))
      .filter((unit) => (unit.unitType.rangedStrength ?? 0) <= 0)
      .sort((a, b) => this.compareNavalExpeditionCandidates(a, b, target))
      .slice(0, Math.max(0, NAVAL_EXPEDITION_MAX_SHIPS - ranged.length));

    const selected = [...ranged, ...screens].slice(0, NAVAL_EXPEDITION_MAX_SHIPS);
    if (selected.length < NAVAL_EXPEDITION_MIN_SHIPS) return null;

    const round = this.turnManager.getCurrentRound();
    return {
      nationId,
      targetCityId: target.cityId,
      targetCityName: target.cityName,
      targetOwnerNationId: target.ownerNationId,
      targetPos: { x: target.x, y: target.y },
      targetScore: target.score,
      assignedUnitIds: selected.map((unit) => unit.id),
      createdTurn: round,
      lastUpdatedTurn: round,
    };
  }

  private isNavalExpeditionEligibleUnit(unit: Unit): boolean {
    if (this.isCargoUnit(unit)) return false;
    if (unit.unitType.isNaval !== true) return false;
    if (unit.unitType.category === 'civilian' || unit.unitType.category === 'naval_recon') return false;
    if (unit.unitType.baseStrength <= 0 && (unit.unitType.rangedStrength ?? 0) <= 0) return false;
    return unit.health / unit.unitType.baseHealth >= NAVAL_EXPEDITION_CRITICAL_HEALTH_RATIO;
  }

  private getNavalHomeReserveUnitIds(nationId: string, ships: readonly Unit[]): Set<string> {
    const coastalCities = this.cityManager.getCitiesByOwner(nationId)
      .filter((city) => cityHasWaterTile(city, this.mapData));
    const reserved = new Set<string>();
    if (coastalCities.length === 0) return reserved;

    const sorted = ships
      .map((unit) => ({
        unit,
        distance: this.getMinDistanceToCities(unit, coastalCities),
      }))
      .sort((a, b) => a.distance - b.distance || a.unit.id.localeCompare(b.unit.id));

    for (const entry of sorted.slice(0, NAVAL_EXPEDITION_HOME_RESERVE)) {
      reserved.add(entry.unit.id);
    }
    return reserved;
  }

  private compareNavalExpeditionCandidates(a: Unit, b: Unit, target: NavalExpeditionTarget): number {
    const aRanged = (a.unitType.rangedStrength ?? 0) > 0 ? 0 : 1;
    const bRanged = (b.unitType.rangedStrength ?? 0) > 0 ? 0 : 1;
    if (aRanged !== bRanged) return aRanged - bRanged;

    const targetPos = { x: target.x, y: target.y };
    const aDist = this.gridSystem.getDistance({ x: a.tileX, y: a.tileY }, targetPos);
    const bDist = this.gridSystem.getDistance({ x: b.tileX, y: b.tileY }, targetPos);
    return aDist - bDist || a.id.localeCompare(b.id);
  }

  private getMinDistanceToCities(unit: Unit, cities: readonly City[]): number {
    let best = Infinity;
    for (const city of cities) {
      const dist = this.gridSystem.getDistance(
        { x: unit.tileX, y: unit.tileY },
        { x: city.tileX, y: city.tileY },
      );
      if (dist < best) best = dist;
    }
    return best;
  }

  private hasNavalPathToExpeditionTarget(unit: Unit, target: NavalExpeditionTarget): boolean {
    const directPath = this.pathfindingSystem.findPath(unit, target.x, target.y, {
      respectMovementPoints: false,
    });
    if (directPath !== null) return true;

    for (const adj of this.gridSystem.getAdjacentCoords({ x: target.x, y: target.y })) {
      const tile = this.mapData.tiles[adj.y]?.[adj.x];
      if (!tile || (tile.type !== TileType.Coast && tile.type !== TileType.Ocean)) continue;
      const path = this.pathfindingSystem.findPath(unit, adj.x, adj.y, {
        respectMovementPoints: false,
      });
      if (path !== null) return true;
    }
    return false;
  }

  private moveNavalUnitForPatrol(
    unit: Unit,
    nationId: string,
    strategy: AIStrategy,
    context: NavalPatrolContext,
  ): void {
    // Highest priority: a suitable ranged warship assigned to defend a
    // genuinely threatened coastal city moves into naval fire-support position.
    // This outranks routine patrol, exploration and non-critical offensive
    // moves; combat then fires autonomously.
    if (this.tryNavalEmergencyFireSupport(unit, nationId, context)) return;

    // Combat naval first try to intercept high-priority enemies near our
    // coast. The combat phase already attacks adjacent ones; this just
    // closes distance so the next turn's combat phase can finish the job.
    if (unit.unitType.baseStrength > 0) {
      const enemy = this.findHighPriorityNavalEnemy(unit, nationId, context.targets);
      if (enemy && this.moveNavalUnitToward(unit, { x: enemy.tileX, y: enemy.tileY }, true)) return;
    }

    if (
      unit.unitType.baseStrength > 0 &&
      !context.ownZoneHasEnemy &&
      this.tryMoveAssignedNavalExpeditionUnit(unit, context)
    ) return;

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

    // Priority 1: enemy naval units in zone (both melee and ranged naval).
    if (this.tryMoveTowardNearestEnemyUnit(unit, enemyTargets.navalUnits, claimedNavalTiles)) return true;

    // Priority 2: ranged naval finds an optimal firing position for
    // cities and land targets using the unit's actual attack range.
    // Melee naval falls back to coast-adjacent land unit targeting.
    if ((unit.unitType.rangedStrength ?? 0) > 0) {
      if (this.tryRangedNavalBombardmentMove(unit, enemyTargets, claimedNavalTiles, context.expeditionTarget)) return true;
    } else {
      if (this.tryMoveTowardNearestEnemyUnit(unit, enemyTargets.coastAdjacentUnits, claimedNavalTiles)) return true;
    }

    // Final fallback: patrol-pressure on enemy coast.
    return this.tryMoveTowardNearestZoneTile(unit, enemyTargets.zoneTiles, claimedNavalTiles);
  }

  private tryMoveAssignedNavalExpeditionUnit(unit: Unit, context: NavalPatrolContext): boolean {
    const assignment = context.expeditionAssignment;
    if (!assignment || !assignment.assignedUnitIds.includes(unit.id)) return false;

    const targetPos = assignment.targetPos;
    const distanceToTarget = this.gridSystem.getDistance(
      { x: unit.tileX, y: unit.tileY },
      targetPos,
    );

    if ((unit.unitType.rangedStrength ?? 0) > 0 && distanceToTarget <= (unit.unitType.range ?? 1)) {
      return true;
    }
    if ((unit.unitType.rangedStrength ?? 0) <= 0 && distanceToTarget <= 1) {
      return true;
    }

    const before = { x: unit.tileX, y: unit.tileY };
    if (!this.moveNavalUnitToward(unit, targetPos, true)) return false;

    context.claimedNavalTiles.add(tileKey(unit.tileX, unit.tileY));
    if (before.x !== unit.tileX || before.y !== unit.tileY) {
      context.expeditionAdvancedUnitIds.add(unit.id);
    }
    return true;
  }

  private logNavalExpeditionMovement(nationId: string, context: NavalPatrolContext): void {
    const assignment = context.expeditionAssignment;
    if (!assignment || context.expeditionAdvancedUnitIds.size === 0) return;

    const round = this.turnManager.getCurrentRound();
    const key = `${nationId}:${assignment.targetCityId}`;
    const lastRound = this.navalExpeditionMoveLoggedRound.get(key) ?? -1;
    if (lastRound === round) return;

    this.navalExpeditionMoveLoggedRound.set(key, round);
    console.log(this.formatLog(
      nationId,
      `naval expedition moving toward ${assignment.targetCityName}: ${context.expeditionAdvancedUnitIds.size} ships advanced`,
    ));
  }

  /**
   * For a ranged naval unit, finds the highest-scoring (target, firing-position)
   * pair across all war-enemy cities and land units, then moves toward that tile.
   *
   * Firing positions are water/coast tiles within the unit's actual attack range
   * of the target. Each position is scored by:
   *   - Distance from current ship position (prefer closer)
   *   - Whether the position is reachable this turn (immediate-attack bonus)
   *   - Safety (penalise tiles adjacent to enemy naval units)
   * Combined with target value (city > damaged unit > healthy unit).
   *
   * No fixed reach constant is used; only the unit's own `range` governs
   * what firing positions are geometrically valid.
   */
  private tryRangedNavalBombardmentMove(
    unit: Unit,
    enemyTargets: EnemyCoastalTargets,
    claimed: Set<string>,
    expeditionTarget: NavalExpeditionTarget | null = null,
  ): boolean {
    const enemyNavalKeys = new Set(
      enemyTargets.navalUnits.map((u) => tileKey(u.tileX, u.tileY)),
    );

    const targets: NavalBombardTarget[] = [];
    for (const city of enemyTargets.enemyCities) {
      const healthRatio = city.health / CITY_BASE_HEALTH;
      const expeditionBonus = expeditionTarget?.cityId === city.id ? Math.max(10, Math.round(expeditionTarget.score / 4)) : 0;
      const cityValue = BOMBARD_CITY_VALUE + expeditionBonus + Math.round((1 - healthRatio) * BOMBARD_DAMAGED_BONUS);
      targets.push({ pos: { x: city.tileX, y: city.tileY }, value: cityValue, key: tileKey(city.tileX, city.tileY) });
    }
    for (const enemy of enemyTargets.allEnemyLandUnits) {
      const healthRatio = enemy.health / enemy.unitType.baseHealth;
      const unitValue = BOMBARD_UNIT_VALUE + (healthRatio < 0.6 ? BOMBARD_DAMAGED_BONUS : 0);
      targets.push({ pos: { x: enemy.tileX, y: enemy.tileY }, value: unitValue, key: tileKey(enemy.tileX, enemy.tileY) });
    }

    const best = this.findBestNavalFiringPosition(unit, targets, claimed, enemyNavalKeys);
    if (!best) return false;
    if (!this.moveNavalUnitToward(unit, best.firingPos, true)) return false;

    claimed.add(tileKey(best.firingPos.x, best.firingPos.y));
    claimed.add(best.targetKey);
    return true;
  }

  /**
   * Shared ranged-naval positioning kernel: given scored targets, returns the
   * best water/coast firing tile within the unit's own `range` of a target,
   * preferring closer tiles, tiles reachable this turn, and tiles away from
   * enemy ships. Used for offensive bombardment and for emergency fire support
   * so both reuse one ranged-position algorithm.
   */
  private findBestNavalFiringPosition(
    unit: Unit,
    targets: readonly NavalBombardTarget[],
    claimed: Set<string>,
    enemyNavalKeys: Set<string>,
  ): { firingPos: GridCoord; targetKey: string } | null {
    const unitRange = unit.unitType.range ?? 1;
    const unitPos = { x: unit.tileX, y: unit.tileY };

    let bestFiringPos: GridCoord | null = null;
    let bestTargetKey = '';
    let bestScore = -Infinity;

    for (const target of targets) {
      if (claimed.has(target.key)) continue;
      for (const tile of this.gridSystem.getTilesInRange(
        target.pos, unitRange, this.mapData, { includeCenter: false },
      )) {
        if (tile.type !== TileType.Ocean && tile.type !== TileType.Coast) continue;
        const posKey = tileKey(tile.x, tile.y);
        if (claimed.has(posKey)) continue;

        const tilePos = { x: tile.x, y: tile.y };
        const distFromUnit = this.gridSystem.getDistance(unitPos, tilePos);

        let posScore = -distFromUnit * BOMBARD_DISTANCE_WEIGHT;
        if (distFromUnit <= unit.movementPoints) posScore += BOMBARD_IMMEDIATE_BONUS;

        const adjEnemyNaval = this.gridSystem
          .getAdjacentCoords(tilePos)
          .filter((adj) => enemyNavalKeys.has(tileKey(adj.x, adj.y))).length;
        posScore -= adjEnemyNaval * BOMBARD_ADJ_ENEMY_NAVAL_PENALTY;

        const totalScore = target.value + posScore;
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestFiringPos = tilePos;
          bestTargetKey = target.key;
        }
      }
    }

    if (!bestFiringPos) return null;
    return { firingPos: bestFiringPos, targetKey: bestTargetKey };
  }

  /**
   * Moves a ranged warship assigned (by {@link refreshNavalFireSupport}) to a
   * threatened coastal city into naval fire-support position against the units
   * threatening it. A ship already able to fire holds station so the combat
   * phase can shoot; otherwise it moves to the best firing tile, falling back to
   * closing on the city when no firing tile is reachable. Returns true when the
   * assignment was handled (the ship should take no other naval action).
   */
  private tryNavalEmergencyFireSupport(
    unit: Unit,
    nationId: string,
    context: NavalPatrolContext,
  ): boolean {
    const threat = this.navalFireSupportThreatByUnit.get(nationId)?.get(unit.id);
    if (!threat) return false;

    // Already in a firing position: hold and let the combat phase fire rather
    // than repositioning merely to satisfy the assignment.
    if (this.isShipInThreatFiringRange(unit, threat)) {
      context.claimedNavalTiles.add(tileKey(unit.tileX, unit.tileY));
      return true;
    }

    const enemyNavalKeys = new Set(
      threat.hostileUnits
        .filter((hostile) => hostile.unitType.isNaval === true)
        .map((hostile) => tileKey(hostile.tileX, hostile.tileY)),
    );
    const targets: NavalBombardTarget[] = threat.hostileUnits.map((hostile) => {
      const healthRatio = hostile.health / hostile.unitType.baseHealth;
      const value = BOMBARD_UNIT_VALUE + (healthRatio < 0.6 ? BOMBARD_DAMAGED_BONUS : 0);
      return { pos: { x: hostile.tileX, y: hostile.tileY }, value, key: tileKey(hostile.tileX, hostile.tileY) };
    });

    const best = this.findBestNavalFiringPosition(unit, targets, context.claimedNavalTiles, enemyNavalKeys);
    if (best && this.moveNavalUnitToward(unit, best.firingPos, true)) {
      context.claimedNavalTiles.add(tileKey(best.firingPos.x, best.firingPos.y));
      return true;
    }

    // No firing tile reachable this turn: close on the threatened city so the
    // ship stays engaged instead of wandering into offensive/patrol behavior.
    if (this.moveNavalUnitToward(unit, { x: threat.city.tileX, y: threat.city.tileY }, true)) {
      context.claimedNavalTiles.add(tileKey(unit.tileX, unit.tileY));
      return true;
    }
    return false;
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
      if (this.moveNavalUnitToward(unit, { x: enemy.tileX, y: enemy.tileY }, true)) {
        claimed.add(tileKey(enemy.tileX, enemy.tileY));
        return true;
      }
    }
    return false;
  }

  private tryMoveTowardNearestEnemyCity(
    unit: Unit,
    cities: readonly City[],
    claimed: Set<string>,
  ): boolean {
    const unitPos = { x: unit.tileX, y: unit.tileY };
    const sorted = cities
      .map((c) => ({
        city: c,
        dist: this.gridSystem.getDistance(unitPos, { x: c.tileX, y: c.tileY }),
      }))
      .filter(({ dist }) => dist <= NAVAL_MAX_OFFENSIVE_REACH)
      .sort((a, b) => a.dist - b.dist);

    for (const { city } of sorted) {
      const cityKey = tileKey(city.tileX, city.tileY);
      if (claimed.has(cityKey)) continue;
      if (this.moveNavalUnitToward(unit, { x: city.tileX, y: city.tileY }, true)) {
        claimed.add(cityKey);
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
    if (!this.moveNavalUnitToward(unit, { x: bestTile.x, y: bestTile.y }, true)) return false;
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

  private moveNavalUnitToward(unit: Unit, dest: GridCoord, allowForeignTerritory = false): boolean {
    const path = this.pathfindingSystem.findPath(unit, dest.x, dest.y, {
      respectMovementPoints: false,
    });
    if (path !== null) {
      const disciplinedPath = this.getDisciplinedMilitaryPath(unit, path, allowForeignTerritory);
      if (!disciplinedPath) return false;
      this.movementSystem.moveAlongPath(unit, disciplinedPath);
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
        const disciplinedPath = this.getDisciplinedMilitaryPath(unit, adjPath, allowForeignTerritory);
        if (!disciplinedPath) continue;
        this.movementSystem.moveAlongPath(unit, disciplinedPath);
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
      enemyCities: [],
      allEnemyLandUnits: [],
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

    // All war-enemy cities — per-unit firing-position geometry determines which
    // are actually reachable; no distance pre-filter is applied here.
    const enemyCities: City[] = [];
    for (const enemyId of warEnemyIds) {
      for (const city of this.cityManager.getCitiesByOwner(enemyId)) {
        enemyCities.push(city);
      }
    }

    const navalUnits: Unit[] = [];
    const coastAdjacentUnits: Unit[] = [];
    const allEnemyLandUnits: Unit[] = [];
    for (const enemy of this.unitManager.getAllUnits()) {
      if (!warEnemyIds.has(enemy.ownerId)) continue;
      if (!dm.canAttack(nationId, enemy.ownerId)) continue;

      if (enemy.unitType.isNaval === true) {
        if (zone.has(tileKey(enemy.tileX, enemy.tileY))) navalUnits.push(enemy);
        continue;
      }

      // Skip non-combat land units (settlers, workers) as bombardment targets.
      if (enemy.unitType.baseStrength <= 0 && (enemy.unitType.rangedStrength ?? 0) <= 0) continue;

      // Track coast-adjacent units separately for melee naval movement.
      const adjacentToZone = this.gridSystem
        .getAdjacentCoords({ x: enemy.tileX, y: enemy.tileY })
        .some((adj) => zone.has(tileKey(adj.x, adj.y)));
      if (adjacentToZone) coastAdjacentUnits.push(enemy);

      // All land combat units — ranged naval uses firing-position geometry.
      allEnemyLandUnits.push(enemy);
    }

    return { zone, zoneTiles, navalUnits, enemyCities, allEnemyLandUnits, coastAdjacentUnits };
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
      if (!this.canMilitaryUnitStandOnTile(nationId, tile, false)) continue;
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
    const disciplinedPath = this.getDisciplinedMilitaryPath(unit, path, false);
    if (!disciplinedPath) return;
    this.movementSystem.moveAlongPath(unit, disciplinedPath);
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
      if (target === null) {
        // No known reachable sea-resource target: fall back to Scout-Boat-style
        // water exploration so the boat actively searches the coast/ocean instead
        // of idling. Discovery feeds the shared sea-resource memory, so a later
        // turn assigns this boat a real target through the branch above and it
        // resumes normal build behavior. Only when it still has movement.
        if (unit.movementPoints > 0) {
          this.aiExplorationSystem?.exploreNavalUtilityUnit(unit);
        }
        return;
      }
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
    if (ownerNationId !== undefined && ownerNationId !== nationId) {
      // Foreign territorial waters are eligible only under exploitation rights, and
      // only when no third party already economically owns the resource. Mirrors
      // BuilderSystem's naval exploitation gate so validity and build agree.
      const canExploitForeign = tile.resourceOwnerNationId === undefined
        && tile.ownerId !== undefined
        && this.diplomacyManager?.hasExploitationRights(nationId, tile.ownerId) === true;
      if (!canExploitForeign) return false;
    }

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

  // ─── AI Worker land improvement ──────────────────────────────────────────────
  // Land counterpart to runWorkBoat: AI Workers improve owned land tiles using
  // the shared BuilderSystem rules. Target selection is deterministic and Workers
  // never leave their own territory (every candidate is an owned land tile).
  private runWorker(unit: Unit, nationId: string): void {
    if (!this.builderSystem) return;
    if (unit.unitType.canBuildImprovements !== true || unit.unitType.isNaval === true) return;
    if (unit.isBuildingImprovement()) return; // multi-turn build already in progress

    let target = this.getAssignedWorkerTarget(unit, nationId);
    if (target === null) {
      // An idle Worker keeps searching for a target every turn until it finds a
      // suitable tile. The distance and reachability caps in the search itself
      // keep this cheap (it only ever considers nearby tiles).
      target = this.pickReachableWorkerTarget(nationId, unit);
      if (target === null) {
        // Nothing improvable within the local radius: roam toward another of this
        // nation's cities (like a scout heading somewhere useful) so the Worker
        // ends up near tiles it can improve there, instead of standing idle.
        if (this.relocateWorkerTowardOtherCity(unit, nationId)) {
          this.workerNoTargetLoggedUnits.delete(unit.id);
          return;
        }
        // Truly nowhere to go (e.g. single city, or other cities unreachable).
        // Log once per unit until it gets an assignment, so it doesn't spam.
        if (!this.workerNoTargetLoggedUnits.has(unit.id)) {
          this.workerNoTargetLoggedUnits.add(unit.id);
          console.debug(
            this.formatLog(nationId, `Worker at (${unit.tileX},${unit.tileY}) found no valid land improvement target`),
          );
        }
        return;
      }
      this.workerTargetsByUnit.set(unit.id, tileKey(target.x, target.y));
      this.workerNoTargetLoggedUnits.delete(unit.id);
    }

    const tile = this.mapData.tiles[target.y]?.[target.x];
    if (!tile) {
      this.clearWorkerAssignment(unit.id);
      return;
    }

    if (unit.tileX === target.x && unit.tileY === target.y) {
      this.tryBuildWorkerImprovement(unit, nationId, tile);
      return;
    }

    const path = this.pathfindingSystem.findPath(unit, target.x, target.y, {
      respectMovementPoints: false,
    });
    if (path === null) {
      this.clearWorkerAssignment(unit.id);
      return;
    }

    const fromX = unit.tileX;
    const fromY = unit.tileY;
    this.movementSystem.moveAlongPath(unit, path);
    if (unit.tileX === fromX && unit.tileY === fromY) return;

    // Arrived this turn with movement to spare: commit the build immediately,
    // mirroring how a player can move-then-build in one turn.
    if (unit.tileX === target.x && unit.tileY === target.y && unit.movementPoints > 0) {
      this.tryBuildWorkerImprovement(unit, nationId, tile);
      return;
    }

    const logKey = `${target.x},${target.y}:${unit.tileX},${unit.tileY}`;
    if (this.workerMovementLogKeyByUnit.get(unit.id) !== logKey) {
      this.workerMovementLogKeyByUnit.set(unit.id, logKey);
      console.log(
        this.formatLog(nationId, `Worker moved toward (${target.x},${target.y}) to build improvement`),
      );
    }
  }

  private tryBuildWorkerImprovement(unit: Unit, nationId: string, tile: Tile): void {
    const result = this.builderSystem?.build(unit, tile, {
      consumeMovement: true,
      requireMovement: true,
    });
    if (result == null) return;
    this.clearWorkerAssignment(unit.id);
    console.log(
      this.formatLog(nationId, `Worker improved ${tile.type} at (${tile.x},${tile.y}) with ${result.improvement.name}`),
    );
  }

  private clearWorkerAssignment(unitId: string): void {
    this.workerTargetsByUnit.delete(unitId);
    this.workerMovementLogKeyByUnit.delete(unitId);
  }

  private getAssignedWorkerTarget(unit: Unit, nationId: string): { x: number; y: number } | null {
    const key = this.workerTargetsByUnit.get(unit.id);
    if (key === undefined) return null;
    const [xRaw, yRaw] = key.split(',');
    const x = Number(xRaw);
    const y = Number(yRaw);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      this.clearWorkerAssignment(unit.id);
      return null;
    }
    const tile = this.mapData.tiles[y]?.[x];
    // Drop the assignment if the tile is no longer a valid target (e.g. someone
    // else improved it, or it left our territory).
    if (!tile || !this.builderSystem?.canNationImproveLandTile(nationId, tile)) {
      this.clearWorkerAssignment(unit.id);
      return null;
    }
    return { x, y };
  }

  /**
   * Picks the best reachable land improvement target for a Worker. Candidate
   * ranking is cheap (tile checks only); pathfinding — which is comparatively
   * expensive — is done lazily over the ranked list and capped at
   * {@link MAX_WORKER_REACHABILITY_CHECKS} attempts so a boxed-in Worker can't
   * trigger a full-territory pathfinding scan every turn.
   */
  private pickReachableWorkerTarget(nationId: string, unit: Unit): { x: number; y: number } | null {
    const ranked = this.getRankedWorkerLandCandidates(nationId, unit);
    const limit = Math.min(ranked.length, MAX_WORKER_REACHABILITY_CHECKS);
    for (let index = 0; index < limit; index += 1) {
      const candidate = ranked[index];
      if (this.pathfindingSystem.findPath(unit, candidate.x, candidate.y, { respectMovementPoints: false }) !== null) {
        return { x: candidate.x, y: candidate.y };
      }
    }
    return null;
  }

  /**
   * Moves an idle Worker toward another of its nation's cities when there is no
   * improvable tile within the local search radius — so it heads somewhere it can
   * be useful instead of standing still. Considers the nearest cities beyond the
   * search radius first (their territory hasn't been searched from here) and only
   * attempts a few, so an unreachable (e.g. overseas) city can't cause repeated
   * expensive pathfinding. Returns true if the Worker actually moved.
   */
  private relocateWorkerTowardOtherCity(unit: Unit, nationId: string): boolean {
    const from = { x: unit.tileX, y: unit.tileY };
    const destinations = this.cityManager.getCitiesByOwner(nationId)
      .map((city) => ({ city, distance: this.gridSystem.getDistance(from, { x: city.tileX, y: city.tileY }) }))
      // Skip cities whose territory is already within local search range.
      .filter((entry) => entry.distance > MAX_WORKER_TARGET_DISTANCE)
      .sort((a, b) => a.distance - b.distance || a.city.tileY - b.city.tileY || a.city.tileX - b.city.tileX)
      .slice(0, MAX_WORKER_RELOCATION_CITY_CHECKS);

    for (const { city } of destinations) {
      const path = this.pathfindingSystem.findPath(unit, city.tileX, city.tileY, { respectMovementPoints: false });
      if (path === null) continue;

      this.movementSystem.moveAlongPath(unit, path);
      if (unit.tileX === from.x && unit.tileY === from.y) return false; // blocked, no progress

      const logKey = `relocate:${city.tileX},${city.tileY}:${unit.tileX},${unit.tileY}`;
      if (this.workerMovementLogKeyByUnit.get(unit.id) !== logKey) {
        this.workerMovementLogKeyByUnit.set(unit.id, logKey);
        console.log(
          this.formatLog(nationId, `Worker roaming toward city at (${city.tileX},${city.tileY}) to find improvement work`),
        );
      }
      return true;
    }
    return false;
  }

  /**
   * Deterministically ranked owned land tiles this nation could improve, best
   * first. Priority: resource tiles, then high-yield tiles, then proximity to a
   * city, then a stable (y, x) tiebreak. Tiles already claimed by another Worker
   * this turn are skipped so two Workers don't converge on one tile. This does
   * NOT check reachability (no pathfinding) — see {@link pickReachableWorkerTarget}.
   */
  private getRankedWorkerLandCandidates(nationId: string, unit: Unit): Array<{ x: number; y: number }> {
    if (!this.builderSystem) return [];
    const ownCities = this.cityManager.getCitiesByOwner(nationId);
    if (ownCities.length === 0) return [];

    const assignedKeys = new Set(this.workerTargetsByUnit.values());
    const selfKey = this.workerTargetsByUnit.get(unit.id);
    const demandedResourceIds = this.getSignificantlyDemandedResourceIds(nationId);
    const seen = new Set<string>();
    const candidates: Array<{ x: number; y: number; score: number }> = [];

    for (const city of ownCities) {
      for (const coord of city.ownedTileCoords) {
        const key = tileKey(coord.x, coord.y);
        if (seen.has(key)) continue;
        seen.add(key);
        if (assignedKeys.has(key) && key !== selfKey) continue;

        const tile = this.mapData.tiles[coord.y]?.[coord.x];
        if (!tile) continue;
        // Only consider tiles near the Worker so reachability pathfinding stays
        // local and cheap, and Workers don't trek to distant overseas cities.
        if (this.gridSystem.getDistance({ x: unit.tileX, y: unit.tileY }, { x: tile.x, y: tile.y }) > MAX_WORKER_TARGET_DISTANCE) {
          continue;
        }
        if (!this.builderSystem.canNationImproveLandTile(nationId, tile)) continue;
        candidates.push({ x: tile.x, y: tile.y, score: this.scoreWorkerTile(tile, ownCities, demandedResourceIds) });
      }
    }

    this.addForeignExploitationLandCandidates(nationId, unit, ownCities, seen, assignedKeys, selfKey, candidates, demandedResourceIds);

    candidates.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
    return candidates.map(({ x, y }) => ({ x, y }));
  }

  /**
   * Adds eligible foreign natural-resource tiles the nation may improve under
   * existing exploitation rights (Step 2 mechanic) as extra Worker targets. This
   * is the first deliberate AI use of acquired rights: it reuses the shared
   * BuilderSystem validity check (which already enforces rights, unimproved
   * resource, tech, etc.) rather than any new strategy engine. Foreign targets are
   * deliberately penalized so a Worker always prefers domestic work of equal
   * quality — the AI makes *some* practical use of rights, not optimal use. No
   * economic payback is computed; interest/resource counts are never consulted.
   */
  private addForeignExploitationLandCandidates(
    nationId: string,
    unit: Unit,
    ownCities: City[],
    seen: Set<string>,
    assignedKeys: Set<string>,
    selfKey: string | undefined,
    candidates: Array<{ x: number; y: number; score: number }>,
    demandedResourceIds: ReadonlySet<string>,
  ): void {
    if (!this.builderSystem || !this.diplomacyManager) return;
    const grantorIds = this.diplomacyManager.getAllExploitationRights()
      .filter((grant) => grant.beneficiaryNationId === nationId)
      .map((grant) => grant.grantorNationId);
    if (grantorIds.length === 0) return;

    for (const grantorId of grantorIds) {
      for (const city of this.cityManager.getCitiesByOwner(grantorId)) {
        for (const coord of city.ownedTileCoords) {
          const key = tileKey(coord.x, coord.y);
          if (seen.has(key)) continue;
          seen.add(key);
          if (assignedKeys.has(key) && key !== selfKey) continue;
          const tile = this.mapData.tiles[coord.y]?.[coord.x];
          if (!tile) continue;
          if (this.gridSystem.getDistance({ x: unit.tileX, y: unit.tileY }, { x: tile.x, y: tile.y }) > MAX_WORKER_TARGET_DISTANCE) {
            continue;
          }
          if (!this.builderSystem.canNationImproveLandTile(nationId, tile)) continue;
          const score = this.scoreWorkerTile(tile, ownCities, demandedResourceIds) - FOREIGN_EXPLOITATION_TARGET_PENALTY;
          candidates.push({ x: tile.x, y: tile.y, score });
        }
      }
    }
  }

  private scoreWorkerTile(tile: Tile, ownCities: City[], demandedResourceIds: ReadonlySet<string>): number {
    let score = 0;
    if (tile.resourceId !== undefined) score += 1000; // resource tiles first
    // Strategic Resource Demand is a strong priority signal: a tile carrying a
    // significantly-demanded resource (e.g. unimproved Iron while Workshop is
    // blocked) is improved ahead of ordinary resource tiles. Passive — it only
    // reorders existing Worker targets; no extra Worker is produced here.
    if (tile.resourceId !== undefined && demandedResourceIds.has(tile.resourceId)) {
      score += WORKER_DEMANDED_RESOURCE_BONUS;
    }
    const yields = getTileYield(tile);
    score += (yields.food + yields.production + yields.gold) * 10; // high-yield next
    score -= this.distanceToNearestCity(tile, ownCities); // prefer near a city
    return score;
  }

  private distanceToNearestCity(tile: Tile, ownCities: City[]): number {
    let nearest = Number.POSITIVE_INFINITY;
    for (const city of ownCities) {
      const distance = this.gridSystem.getDistance({ x: tile.x, y: tile.y }, { x: city.tileX, y: city.tileY });
      if (distance < nearest) nearest = distance;
    }
    return Number.isFinite(nearest) ? nearest : 0;
  }

  // Strategy-based movement scoring shapes where AI units want to go,
  // while existing pathfinding and movement rules still decide how they move.
  private moveByStrategyScoring(unit: Unit, nationId: string, strategy: AIStrategy): void {
    const choices = this.collectMovementChoices(unit, nationId, strategy);
    if (choices.length === 0) return; // fallback: hold position

    const candidates = choices.map((choice) => choice.candidate);

    const isLandTactics = isLandTacticsEligible(unit, this.mapData);
    const friendlyLandCombatUnits = isLandTactics
      ? this.unitManager.getUnitsByOwner(nationId)
          .filter((u) => u.id !== unit.id && !u.unitType.isNaval && u.unitType.baseStrength > 0)
      : [];
    const enemyLandUnits = isLandTactics
      ? this.unitManager.getAllUnits().filter((u) => u.ownerId !== nationId && !u.unitType.isNaval)
      : [];

    const roleCtx: RolePositionContext = { threatActive: this.isAtWarWithAnyone(nationId) };

    // Offensive operation context: computed once per nation per round, cheap on repeated calls.
    const offensiveOp = (isLandTactics && roleCtx.threatActive)
      ? this.getOffensiveOperation(nationId, strategy)
      : null;
    const localSupportCount = offensiveOp
      ? friendlyLandCombatUnits.filter(
          (u) => this.gridSystem.getDistance(
            { x: u.tileX, y: u.tileY },
            { x: unit.tileX, y: unit.tileY },
          ) <= FRIENDLY_SUPPORT_DISTANCE,
        ).length
      : 0;

    const bonusScorer = (c: AIMovementCandidate): number => {
      let bonus = scoreRoleBasedPosition(unit, c, roleCtx);
      if (!isLandTactics) return bonus;

      // Retreat: damaged units prefer safety over advancing.
      const hasFriendlySupport = friendlyLandCombatUnits.some(
        (u) => this.gridSystem.getDistance({ x: u.tileX, y: u.tileY }, c.destination) <= FRIENDLY_SUPPORT_DISTANCE,
      );
      bonus += scoreRetreatPosition(unit, c, hasFriendlySupport);

      // Avoid positions contested by multiple enemies unless aggressive and healthy.
      if (c.isNearEnemyUnit) {
        const threatCount = enemyLandUnits.filter(
          (u) => this.gridSystem.getDistance({ x: u.tileX, y: u.tileY }, c.destination) <= FRIENDLY_SUPPORT_DISTANCE,
        ).length;
        if (threatCount >= 2) {
          const healthRatio = unit.health / unit.unitType.baseHealth;
          if (healthRatio < 0.8 || strategy.military.aggression < 1.5) {
            bonus -= (threatCount - 1) * 10;
          }
        }
      }

      // Offensive operation: push committed units toward target; penalise isolated city charges.
      if (offensiveOp) {
        bonus += scoreOffensivePosition(unit, c, offensiveOp, localSupportCount);
      }

      return bonus;
    };
    const best = pickBestMovementCandidate(candidates, strategy, bonusScorer);
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

    // Offensive operation: log once per nation per round when a unit advances toward the target.
    if (
      offensiveOp?.committed
      && best.kind === 'enemyCity'
      && best.destination.x === offensiveOp.targetPos.x
      && best.destination.y === offensiveOp.targetPos.y
    ) {
      const round = this.turnManager.getCurrentRound();
      const lastRound = this.offensiveAdvanceLoggedRound.get(nationId) ?? -1;
      if (lastRound !== round) {
        this.offensiveAdvanceLoggedRound.set(nationId, round);
        console.debug(this.formatLog(nationId, `${unit.unitType.name} advancing toward ${offensiveOp.targetName}.`));
      }
    }

    // Log when role behavior visibly steered the movement decision.
    const roleBonus = scoreRoleBasedPosition(unit, best, roleCtx);
    if (roleBonus !== 0) {
      const role = getMilitaryRole(unit);
      if (role === 'melee' && best.isNearOwnCity) {
        const nearCity = this.cityManager.getCitiesByOwner(nationId)
          .find((c) => this.gridSystem.getDistance(
            { x: c.tileX, y: c.tileY },
            best.destination,
          ) <= NEAR_OWN_CITY_DISTANCE);
        if (nearCity) {
          console.debug(this.formatLog(nationId, `${unit.unitType.name} moved to block approach to ${nearCity.name}.`));
        }
      } else if (role === 'ranged' && !best.isNearEnemyUnit && best.isNearOwnCity) {
        console.debug(this.formatLog(nationId, `${unit.unitType.name} repositioned to maintain range near friendly city.`));
      } else if (role === 'ranged' && roleBonus < 0) {
        console.debug(this.formatLog(nationId, `${unit.unitType.name} avoided adjacent enemy threat.`));
      }
    } else if (isLandTactics && best.isNearOwnCity) {
      // Retreat log: only fires when role behavior was not the primary driver.
      const healthRatio = unit.health / unit.unitType.baseHealth;
      const retreatThreshold = getMilitaryRole(unit) === 'ranged' ? RANGED_RETREAT_HP : MELEE_RETREAT_HP;
      if (healthRatio < retreatThreshold) {
        const nearCity = this.cityManager.getCitiesByOwner(nationId)
          .find((c) => this.gridSystem.getDistance(
            { x: c.tileX, y: c.tileY },
            best.destination,
          ) <= NEAR_OWN_CITY_DISTANCE);
        console.debug(this.formatLog(nationId, `${unit.unitType.name} retreated toward ${nearCity?.name ?? 'friendly city'}.`));
      }
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
    const addChoice = (
      destination: GridCoord,
      kind: AIMovementCandidate['kind'],
      distance: number,
      path: Tile[] | null,
      allowForeignTerritory = false,
    ): void => {
      const disciplinedPath = path
        ? this.getDisciplinedMilitaryPath(unit, path, allowForeignTerritory)
        : null;
      if (path && !disciplinedPath) return;
      choices.push({
        candidate: this.buildMovementCandidate(
          destination,
          kind,
          distance,
          disciplinedPath,
          nationId,
        ),
        path: disciplinedPath,
      });
    };

    // Enemy cities — approach via adjacent tile, gated by engageDistance.
    for (const city of this.cityManager.getAllCities()) {
      if (city.ownerId === nationId) continue;
      if (!this.isAtWarOrProvocativeMilitaryPosture(nationId, city.ownerId)) continue;
      const dest = { x: city.tileX, y: city.tileY };
      const distance = this.gridSystem.getDistance(unitPos, dest);
      if (distance > engageDistance) continue;

      const path = this.findApproachPath(unit, dest);
      addChoice(dest, 'enemyCity', distance, path, true);
    }

    // Enemy units — approach adjacently, also gated by engageDistance.
    for (const enemy of this.unitManager.getAllUnits()) {
      if (enemy.ownerId === nationId) continue;
      if (!this.isAtWarOrProvocativeMilitaryPosture(nationId, enemy.ownerId)) continue;
      const dest = { x: enemy.tileX, y: enemy.tileY };
      const distance = this.gridSystem.getDistance(unitPos, dest);
      if (distance > engageDistance) continue;

      const path = this.findApproachPath(unit, dest);
      addChoice(dest, 'enemyUnit', distance, path, true);
    }

    // Own cities — useful for defensive strategies and pulling back to safety.
    for (const ownCity of this.cityManager.getCitiesByOwner(nationId)) {
      const dest = { x: ownCity.tileX, y: ownCity.tileY };
      if (dest.x === unitPos.x && dest.y === unitPos.y) continue;
      const distance = this.gridSystem.getDistance(unitPos, dest);

      const path = this.findApproachPath(unit, dest);
      addChoice(dest, 'ownCity', distance, path);
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
        addChoice(dest, 'settlerEscort', distance, path);
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
        addChoice(entry.stagingTile, 'militaryInterest', distance, path, true);
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

  private getDisciplinedMilitaryPath(
    unit: Unit,
    path: Tile[],
    allowForeignTerritory: boolean,
  ): Tile[] | null {
    if (!this.isSovereigntyDisciplinedMilitaryUnit(unit)) return path;
    if (path.length <= 1) return path;

    let movementLeft = unit.movementPoints;
    let lastReachableIndex = 0;
    for (let i = 1; i < path.length; i++) {
      const cost = getTileMovementCost(path[i]);
      if (movementLeft < cost) break;
      movementLeft -= cost;
      lastReachableIndex = i;
    }

    for (let i = lastReachableIndex; i > 0; i--) {
      if (this.canMilitaryUnitStandOnTile(unit.ownerId, path[i], allowForeignTerritory)) {
        return path.slice(0, i + 1);
      }
    }

    if (lastReachableIndex > 0) {
      this.logAvoidedProvocativeMilitaryTileOncePerRound(unit.ownerId, path[lastReachableIndex]);
    }
    return null;
  }

  private isSovereigntyDisciplinedMilitaryUnit(unit: Unit): boolean {
    if (unit.unitType.baseStrength <= 0) return false;
    if (unit.unitType.category === 'recon' || unit.unitType.category === 'naval_recon') return false;
    return true;
  }

  private canMilitaryUnitStandOnTile(
    nationId: string,
    tile: Tile,
    allowForeignTerritory: boolean,
  ): boolean {
    const foreignOwnerId = this.getForeignTileOwner(nationId, tile);
    if (foreignOwnerId !== null) {
      if (this.isAtWarWith(nationId, foreignOwnerId)) return true;
      return allowForeignTerritory && this.isProvocativeMilitaryPosture(nationId, foreignOwnerId);
    }

    for (const borderOwnerId of this.getAdjacentForeignBorderOwners(nationId, tile)) {
      if (this.isAtWarWith(nationId, borderOwnerId)) continue;
      if (!this.isProvocativeMilitaryPosture(nationId, borderOwnerId)) return false;
    }

    return true;
  }

  private getForeignTileOwner(nationId: string, tile: Tile): string | null {
    if (tile.ownerId === undefined || tile.ownerId === nationId) return null;
    return tile.ownerId;
  }

  private getAdjacentForeignBorderOwners(nationId: string, tile: Tile): Set<string> {
    const owners = new Set<string>();
    for (const adj of this.gridSystem.getAdjacentCoords({ x: tile.x, y: tile.y })) {
      const ownerId = this.mapData.tiles[adj.y]?.[adj.x]?.ownerId;
      if (ownerId !== undefined && ownerId !== nationId) owners.add(ownerId);
    }
    return owners;
  }

  private isAtWarWith(nationId: string, otherNationId: string): boolean {
    return this.diplomacyManager?.getState(nationId, otherNationId) === 'WAR';
  }

  private isAtWarOrProvocativeMilitaryPosture(nationId: string, otherNationId: string): boolean {
    return this.isAtWarWith(nationId, otherNationId)
      || this.isProvocativeMilitaryPosture(nationId, otherNationId);
  }

  private isProvocativeMilitaryPosture(nationId: string, foreignNationId: string): boolean {
    if (nationId === foreignNationId) return false;
    const relation = this.diplomacyManager?.getRelation(nationId, foreignNationId);
    if (!relation || relation.state === 'WAR') return false;
    return relation.hostility >= PROVOCATIVE_POSTURE_HOSTILITY_THRESHOLD
      || relation.trust <= PROVOCATIVE_POSTURE_TRUST_THRESHOLD;
  }

  private logAvoidedProvocativeMilitaryTileOncePerRound(nationId: string, tile: Tile): void {
    const round = this.turnManager.getCurrentRound();
    if (this.avoidedProvocativeMilitaryTileLoggedRound.get(nationId) === round) return;
    this.avoidedProvocativeMilitaryTileLoggedRound.set(nationId, round);
    const foreignNationId = this.getForeignTileOwner(nationId, tile)
      ?? [...this.getAdjacentForeignBorderOwners(nationId, tile)][0];
    const foreignName = foreignNationId
      ? (this.nationManager.getNation(foreignNationId)?.name ?? foreignNationId)
      : 'foreign territory';
    console.debug(this.formatLog(nationId, `avoided provocative military tile near ${foreignName}.`));
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

  private recordCompletedProductionCycle(cityId: string, item: Producible): void {
    const city = this.cityManager.getCity(cityId);
    if (!city || this.isHuman(city.ownerId)) return;

    if (item.kind === 'unit' && item.unitType.canFound === true) {
      this.completedProductionCyclesSinceLastSettler.set(city.ownerId, 0);
      return;
    }

    const current = this.completedProductionCyclesSinceLastSettler.get(city.ownerId) ?? 0;
    this.completedProductionCyclesSinceLastSettler.set(city.ownerId, current + 1);
  }

  private recordSettlerProductionStarted(nationId: string, reason: 'earlyTarget' | 'longTerm'): void {
    this.completedProductionCyclesSinceLastSettler.set(nationId, 0);
    if (reason !== 'longTerm') return;

    const round = this.turnManager.getCurrentRound();
    if (this.longTermExpansionLoggedRound.get(nationId) === round) return;
    this.longTermExpansionLoggedRound.set(nationId, round);
    const message = 'planned a long-term expansion settler.';
    console.log(this.formatLog(nationId, message));
    this.logStrategicEvent?.(nationId, message);
  }

  private runProduction(nationId: string): void {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    this.ensureEmergencyMilitaryProduction(nationId);
    this.runEmergencyMilitaryPurchase(nationId);
    this.runEconomicConsolidationRecoveryPurchases(nationId);
    this.logSpaceRaceFactoryPriorityState(nationId);
    this.updateAndLogAIPhase(nationId);
    this.ensureScoutProduction(nationId, cities);
    this.ensureFoundationSettlerProduction(nationId, cities);
    this.ensureNavalReconProduction(nationId, cities);
    this.ensureMaritimeMinimumProduction(nationId, cities);
    this.ensureResourceExplorationProduction(nationId, cities);
    this.runMilitaryModernization(nationId);
    this.ensureGrandStadiumProduction(nationId);
    this.ensureScienceVictoryProduction(nationId, cities);

    const strategy = this.getStrategy(nationId);
    const eraStrategy = this.getActiveEraStrategy(nationId);
    this.powerPlantPlans = this.createPowerPlantPlans(nationId, cities);
    let plannedMilitaryCount = this.countMilitary(nationId);
    let plannedSettlerCount = this.countSettlers(nationId);
    let plannedNavalCount = this.countNavalUnits(nationId) + this.countQueuedNavalCombatUnits(nationId);
    let plannedWorkerCount = this.countWorkers(nationId) + this.countQueuedWorkers(nationId);
    let plannedWorkBoatCount = this.countWorkBoats(nationId) + this.countQueuedWorkBoats(nationId);
    const coastalCityCount = this.countCoastalCities(nationId);

    const doctrine = this.doctrineEvaluator.getDoctrine(nationId);
    const effectiveMaxUnits = getEffectiveMilitaryUnitCap(nationId, strategy.id);
    this.logMilitaryBudgetStatusOnce(nationId, doctrine.id, plannedMilitaryCount, effectiveMaxUnits, strategy.military.maxUnits, this.computeBudgetModifier(plannedMilitaryCount, effectiveMaxUnits));

    const currentRound = this.turnManager.getCurrentRound();
    if (currentRound % 25 === 0) {
      this.logPeriodicDoctrineStatus(nationId);
    }

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
        effectiveMaxUnits,
      );

      let usedFallback = false;
      if (!choice) {
        choice = this.pickFallbackProduction(
          city,
          nationId,
          strategy,
          plannedMilitaryCount,
          plannedSettlerCount,
          effectiveMaxUnits,
          doctrine,
        );
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
      if (
        choice.kind === 'building'
        && choice.buildingType.placement !== 'city'
        && this.buildingPlacementSystem
        && !placement
      ) {
        console.warn(
          this.formatLog(nationId, `AI production in ${city.name}: skipped ${choice.buildingType.name}, no building placement available`),
        );
        continue;
      }

      const selectedSpaceRaceFactoryPriority = choice.kind === 'building' && choice.buildingType.id === FACTORY.id
        ? this.getSpaceRaceFactoryPriority(nationId)
        : undefined;
      this.productionSystem.setProduction(city.id, choice, { placement });
      if (selectedSpaceRaceFactoryPriority?.applies) {
        const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
        this.logScienceVictoryAI(
          nationId,
          `${nationName} selected first space-race Factory in ${city.name}; baseScore=${selectedSpaceRaceFactoryPriority.baseScore} scienceVictoryBonus=${selectedSpaceRaceFactoryPriority.scienceVictoryBonus} resultingScore=${selectedSpaceRaceFactoryPriority.resultingScore}; production began.`,
        );
      }
      if (choice.kind === 'unit') {
        if (choice.unitType.canFound === true) {
          this.recordSettlerProductionStarted(
            nationId,
            this.cityManager.getCitiesByOwner(nationId).length >= this.getEffectiveDesiredCityCount(nationId, strategy)
              ? 'longTerm'
              : 'earlyTarget',
          );
        }
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

  private ensureEmergencyMilitaryProduction(nationId: string): void {
    const threats = getEmergencyProductionThreats(
      this.getEmergencyCityThreats(nationId),
      (threat) => this.hasAdequateLocalEmergencyDefense(threat, nationId),
    );
    if (threats.length === 0) return;
    const claimedProductionCityIds = new Set<string>();

    for (const threat of threats) {
      const candidateCities = this.cityManager.getCitiesByOwner(nationId)
        .map((city) => ({
          city,
          distance: this.gridSystem.getDistance(
            { x: city.tileX, y: city.tileY },
            { x: threat.city.tileX, y: threat.city.tileY },
          ),
        }))
        .filter(({ distance }) => distance <= 4)
        .sort((a, b) => {
          const directDelta = Number(b.city.id === threat.city.id) - Number(a.city.id === threat.city.id);
          return directDelta || a.distance - b.distance || a.city.id.localeCompare(b.city.id);
        });

      for (const { city: productionCity } of candidateCities) {
        if (claimedProductionCityIds.has(productionCity.id)) continue;
        const current = this.productionSystem.getProduction(productionCity.id);
        if (
          current?.item.kind === 'unit'
          && isSuitableEmergencyLandDefenderType(current.item.unitType)
          && this.canBuildUnit(nationId, current.item.unitType.id)
          && canCityProduceUnit(
            productionCity,
            current.item.unitType,
            this.mapData,
            this.gridSystem,
            this.getUnitProductionRuleContext(),
          )
        ) {
          claimedProductionCityIds.add(productionCity.id);
          break;
        }

        const unitType = this.pickEmergencyLandUnitForCity(productionCity, nationId);
        if (!unitType) continue;
        this.productionSystem.enqueueFront(
          productionCity.id,
          { kind: 'unit', unitType },
        );
        claimedProductionCityIds.add(productionCity.id);
        const overridden = current ? ` overrode ${describeProducible(current.item)}` : '';
        this.logEmergencyDefense(
          nationId,
          `emergency military production${overridden} in ${productionCity.name}: ${unitType.name} `
          + `for ${threat.city.name} (${threat.severity}); doctrine/army budget suppression bypassed.`,
        );
        break;
      }
    }
  }

  private pickEmergencyLandUnitForCity(city: City, nationId: string): UnitType | undefined {
    const doctrineContext = this.buildMilitaryDoctrineContext(nationId);
    return MILITARY_OPTIONS
      .filter(isSuitableEmergencyLandDefenderType)
      .filter((unitType) => this.canBuildUnit(nationId, unitType.id))
      .filter((unitType) => canCityProduceUnit(
        city,
        unitType,
        this.mapData,
        this.gridSystem,
        this.getUnitProductionRuleContext(),
      ))
      .map((unitType) => ({
        unitType,
        score: scoreMilitaryUnitCandidate(
          unitType,
          doctrineContext.doctrine,
          doctrineContext.nationEraIndex,
        ),
      }))
      .sort((a, b) => b.score - a.score
        || a.unitType.productionCost - b.unitType.productionCost
        || a.unitType.id.localeCompare(b.unitType.id))[0]?.unitType;
  }

  private runEmergencyMilitaryPurchase(nationId: string): void {
    if (!this.productionPurchaseSystem) return;
    const purchaseThreats = getEmergencyPurchaseThreats(
      this.getEmergencyCityThreats(nationId),
      (city) => this.hasFriendlyMilitaryOnCity(city, nationId),
    );
    for (const threat of purchaseThreats) {
      const purchaseCities = this.cityManager.getCitiesByOwner(nationId)
        .map((city) => ({
          city,
          distance: this.gridSystem.getDistance(
            { x: city.tileX, y: city.tileY },
            { x: threat.city.tileX, y: threat.city.tileY },
          ),
        }))
        .filter(({ distance }) => distance <= 4)
        .sort((a, b) => {
          const directDelta = Number(b.city.id === threat.city.id) - Number(a.city.id === threat.city.id);
          return directDelta || a.distance - b.distance || a.city.id.localeCompare(b.city.id);
        });

      for (const { city: purchaseCity } of purchaseCities) {
        const entry = this.productionSystem.getQueue(purchaseCity.id)[0];
        if (
          entry?.item.kind !== 'unit'
          || !isSuitableEmergencyLandDefenderType(entry.item.unitType)
        ) continue;
        const quote = this.productionPurchaseSystem.getQuote(purchaseCity.id, 0);
        if (!quote.ok) continue;

        const result = this.productionPurchaseSystem.purchase(purchaseCity.id, 0);
        if (!result.ok) continue;
        const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
        this.logEmergencyDefense(
          nationId,
          `purchase nation=${nationName}; defendedCity=${threat.city.name}; purchaseCity=${purchaseCity.name}; `
          + `unit=${entry.item.unitType.name}; cost=${result.cost}; gold=${result.goldBefore}->${result.goldAfter}; `
          + `reason=${threat.severity} (${threat.reason}); turn=${this.turnManager.getCurrentRound()}.`,
        );
        return;
      }
    }
  }

  /**
   * Spend accumulated consolidation liquidity on one legal structural-income
   * building. Purchasing through ProductionPurchaseSystem preserves the normal
   * cost, completion, placement, refund and resource-recalculation pipeline.
   */
  private runEconomicConsolidationRecoveryPurchases(nationId: string): void {
    if (!this.productionPurchaseSystem) return;
    if (!this.consolidationSystem?.isConsolidating(nationId)) return;

    const resources = this.nationManager.getResources(nationId);
    const netIncome = resources.goldPerTurn
      - (this.unitUpkeepSystem?.calculateUpkeep(nationId) ?? 0);
    if (netIncome >= 0) return;

    const reserve = getModernizationGoldReserve(getLeaderMilitaryDoctrineByNationId(nationId));
    const investments: EconomicRecoveryInvestment[] = [];

    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const buildings = this.cityManager.getBuildings(city.id);
      const queue = this.productionSystem.getQueue(city.id);

      for (const building of ALL_BUILDINGS) {
        if (buildings.has(building.id)) continue;
        if (!this.canBuildBuilding(nationId, building.id)) continue;

        const item: Producible = { kind: 'building', buildingType: building };
        if (this.productionSystem.getItemProductionBlockReason(city.id, item) !== undefined) continue;

        const queueIndex = queue.findIndex((entry) => (
          entry.item.kind === 'building' && entry.item.buildingType.id === building.id
        ));
        if (queueIndex < 0 && this.hasPlacedOrReservedBuilding(city, building.id)) continue;

        const goldPerTurnImprovement = this.productionPurchaseSystem
          .getBuildingGoldPerTurnImprovement(city.id, building);
        if (goldPerTurnImprovement <= 0) continue;

        if (queueIndex < 0 && !this.canCityBuildBuilding(city, nationId, building)) continue;

        const cost = queueIndex >= 0
          ? this.productionSystem.getBuyCost(city.id, queueIndex)
          : this.productionSystem.getNewItemBuyCost(city.id, item);
        if (cost === null || cost <= 0) continue;
        if (!canFundEconomicRecoveryInvestment(resources.gold, cost, reserve)) continue;

        investments.push({
          city,
          building,
          queueIndex: queueIndex >= 0 ? queueIndex : undefined,
          cost,
          goldPerTurnImprovement,
        });
      }
    }

    const selected = pickBestEconomicRecoveryInvestment(investments);
    if (!selected) return;

    let purchaseIndex = selected.queueIndex;
    if (purchaseIndex === undefined) {
      const placement = this.reserveAIBuildingPlacement(selected.city, selected.building);
      if (
        selected.building.placement !== 'city'
        && this.buildingPlacementSystem
        && !placement
      ) return;
      this.productionSystem.enqueueFront(
        selected.city.id,
        { kind: 'building', buildingType: selected.building },
        { placement },
      );
      const queued = this.productionSystem.getQueue(selected.city.id)[0];
      if (queued?.item.kind !== 'building' || queued.item.buildingType.id !== selected.building.id) {
        this.buildingPlacementSystem?.releaseCityBuildingReservation(
          selected.city.id,
          selected.building.id,
          this.mapData,
        );
        return;
      }
      purchaseIndex = 0;
    }

    const result = this.productionPurchaseSystem.purchase(selected.city.id, purchaseIndex);
    if (!result.ok) {
      if (selected.queueIndex === undefined) this.productionSystem.removeFromQueue(selected.city.id, purchaseIndex);
      return;
    }
    const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
    const improvement = selected.goldPerTurnImprovement;
    const message = `[EconomicConsolidation] ${nationName} purchased ${selected.building.name} in ${selected.city.name} for ${result.cost} gold: structural GPT recovery investment (+${improvement} GPT).`;
    console.log(message);
    this.logStrategicEvent?.(nationId, message);
  }

  private hasPlacedOrReservedBuilding(city: City, buildingId: string): boolean {
    return city.ownedTileCoords.some((coord) => {
      const tile = this.mapData.tiles[coord.y]?.[coord.x];
      return tile?.buildingId === buildingId
        || tile?.buildingConstruction?.buildingId === buildingId;
    });
  }

  private runMilitaryModernization(nationId: string): void {
    if (!this.unitUpgradeSystem) return;

    const doctrine = getLeaderMilitaryDoctrineByNationId(nationId);
    const reserve = getModernizationGoldReserve(doctrine);
    const maxUpgrades = getModernizationMaxUpgrades(doctrine);
    const resources = this.nationManager.getResources(nationId);

    const navalDoctrine = isMaritimeDoctrine(doctrine);
    // Maritime doctrines keep a smaller reserve for naval combat upgrades so
    // Triremes upgrade to ranged ships as soon as the nation can afford them,
    // rather than waiting to accumulate the full general reserve on top.
    const navalUpgradeReserve = Math.max(50, Math.round(reserve * 0.35));

    const candidates = this.unitManager.getUnitsByOwner(nationId)
      .map((unit) => {
        const isNavalCombat = unit.unitType.isNaval === true && unit.unitType.baseStrength > 0;
        const effectiveReserve = (navalDoctrine && isNavalCombat) ? navalUpgradeReserve : reserve;
        const preview = this.unitUpgradeSystem?.getUpgradePreview(unit, nationId);
        if (!preview?.canUpgrade || !preview.target || preview.cost === undefined) {
          if (navalDoctrine && isNavalCombat && preview) {
            console.debug(this.formatLog(nationId, `navalPower upgrade check: ${unit.unitType.name} → ${preview.target?.name ?? '?'} blocked: ${preview.reason ?? 'unknown'}`));
          }
          return null;
        }
        if (resources.gold - preview.cost < effectiveReserve) {
          if (navalDoctrine && isNavalCombat) {
            console.debug(this.formatLog(nationId, `navalPower upgrade check: ${unit.unitType.name} → ${preview.target.name} blocked: upgrade cost ${preview.cost} exceeds available spendable gold ${resources.gold - effectiveReserve} (reserve ${effectiveReserve})`));
          }
          return null;
        }
        const score = scoreUpgradeCandidate(unit, preview.target, doctrine);
        if (navalDoctrine && isNavalCombat) {
          console.debug(this.formatLog(nationId, `navalPower upgrade check: ${unit.unitType.name} → ${preview.target.name} candidate score ${score.toFixed(1)}`));
        }
        return { unit, target: preview.target, cost: preview.cost, score };
      })
      .filter((c): c is { unit: Unit; target: UnitType; cost: number; score: number } => c !== null)
      .sort((a, b) => b.score - a.score);

    let upgraded = 0;
    for (const candidate of candidates) {
      if (upgraded >= maxUpgrades) break;
      const isNavalCombatCandidate = candidate.unit.unitType.isNaval === true && candidate.unit.unitType.baseStrength > 0;
      const effectiveReserveForCandidate = (navalDoctrine && isNavalCombatCandidate) ? navalUpgradeReserve : reserve;
      if (resources.gold - candidate.cost < effectiveReserveForCandidate) continue;
      const fromName = candidate.unit.unitType.name;
      if (this.unitUpgradeSystem.upgradeUnit(candidate.unit, nationId)) {
        upgraded++;
        const upgradeToNavalRanged = navalDoctrine && candidate.target.category === 'naval_ranged';
        if (upgradeToNavalRanged) {
          console.log(this.formatLog(nationId, `upgraded naval unit ${fromName} → ${candidate.target.name} for navalPower ranged fleet (doctrine: ${doctrine.id})`));
        } else {
          const tag = navalDoctrine ? ' [naval]' : '';
          console.log(this.formatLog(nationId, `upgraded${tag} ${fromName} → ${candidate.target.name} for ${candidate.cost} gold (doctrine: ${doctrine.id})`));
        }
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
    if (!this.canAffordUnitProduction(nationId, SCOUT)) return;

    // Enqueue at most one scout per pass — runProduction is per-turn, so the
    // next turn will enqueue another if we are still short.
    const city = cities.find((candidate) => (
      canCityProduceUnit(candidate, SCOUT, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
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

  /**
   * Resource-driven exploration: when the nation has significant unresolved
   * Strategic Resource Demand and does not know a plausible source, invest a
   * little Production into additional exploration capacity (Scout / Scout Boat).
   * All demands feed one national need — never one explorer per resource — and
   * existing/queued explorers count toward the caps. Explorers are produced
   * through the normal rules (eligibility, upkeep, coastal requirement, queue);
   * nothing is spawned. Idle cities without a better task fall through to the
   * existing Economic Development → Gold behavior unchanged.
   */
  private ensureResourceExplorationProduction(nationId: string, cities: City[]): void {
    if (cities.length === 0) return;
    const demandSystem = this.strategicResourceDemandSystem;
    const exploration = this.aiExplorationSystem;
    if (!demandSystem || !exploration) return;

    const activeScouts = this.unitManager.getUnitsByOwner(nationId)
      .filter((unit) => unit.unitType.id === SCOUT.id).length;
    const seaScoutCapacity = this.countNavalReconUnits(nationId) + this.countQueuedNavalRecon(nationId);
    const coastalCities = cities.filter((city) => cityHasWaterTile(city, this.mapData));
    const canExploreSea = coastalCities.length > 0 && this.canBuildUnit(nationId, SCOUT_BOAT.id);

    const need = evaluateResourceExplorationNeed({
      demands: demandSystem.getDemands(nationId),
      hasKnownSource: (resourceId) => exploration.hasKnownResourceSource(nationId, resourceId),
      landScoutCapacity: activeScouts + this.countQueuedScouts(nationId),
      seaScoutCapacity,
      canExploreSea,
    });

    this.logResourceExplorationTransition(nationId, need);
    if (!need.active) return;

    if (need.wantScout && this.canBuildUnit(nationId, SCOUT.id) && this.canAffordUnitProduction(nationId, SCOUT)) {
      const city = cities.find((candidate) => (
        this.productionSystem.getProduction(candidate.id) === undefined
        && canCityProduceUnit(candidate, SCOUT, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
      ));
      if (city) {
        this.productionSystem.setProduction(city.id, { kind: 'unit', unitType: SCOUT });
        console.log(this.formatLog(
          nationId,
          `Economic Development requested Scout in ${city.name}: unresolved strategic-resource demand `
          + `(${describeUnresolvedDemand(need.unresolved)}); land exploration capacity ${activeScouts} active Scouts`,
        ));
        return; // one explorer per pass
      }
    }

    if (need.wantScoutBoat && this.canAffordUnitProduction(nationId, SCOUT_BOAT)) {
      const city = coastalCities.find((candidate) => (
        this.productionSystem.getProduction(candidate.id) === undefined
        && canCityProduceUnit(candidate, SCOUT_BOAT, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
      ));
      if (city) {
        this.productionSystem.setProduction(city.id, { kind: 'unit', unitType: SCOUT_BOAT });
        console.log(this.formatLog(
          nationId,
          `Economic Development requested Scout Boat in ${city.name}: unresolved strategic-resource demand `
          + `(${describeUnresolvedDemand(need.unresolved)}) and no known source`,
        ));
      }
    }
  }

  private logResourceExplorationTransition(nationId: string, need: ResourceExplorationNeed): void {
    const previous = this.resourceExplorationUnresolvedByNation.get(nationId) ?? new Set<string>();
    const current = new Set(need.unresolved.map((demand) => demand.resourceId));

    if (previous.size === 0 && current.size > 0) {
      console.log(this.formatLog(
        nationId,
        `resource exploration need activated. Reason: ${describeUnresolvedDemand(need.unresolved)}, no known obtainable source`,
      ));
    } else if (previous.size > 0 && current.size === 0) {
      console.log(this.formatLog(nationId, 'resource exploration need cleared: all demanded resources have a known source or demand fell'));
    } else {
      // Log resources that transitioned from unresolved to resolved.
      const resolved = [...previous].filter((resourceId) => !current.has(resourceId));
      for (const resourceId of resolved) {
        const name = getNaturalResourceById(resourceId)?.name ?? resourceId;
        const remaining = need.unresolved.length > 0 ? describeUnresolvedDemand(need.unresolved) : 'none';
        console.log(this.formatLog(
          nationId,
          `resource exploration need reduced. Reason: known ${name} source discovered. Remaining unresolved demand: ${remaining}`,
        ));
      }
    }

    this.resourceExplorationUnresolvedByNation.set(nationId, current);
  }

  // ─── Strategic resource acquisition (Prompt 3) ───────────────────────────────
  // Turns significant Strategic Resource Demand into action through the EXISTING
  // systems: domestic improvement is realized by a Worker-target priority bonus
  // (scoreWorkerTile), foreign purchase by ordering the existing resource trade
  // toward the demanded resource (runTradeForNation), and neutral land expansion
  // by the existing Settler/settlement-memory path. This method classifies and
  // registers existing-system priorities; it never spawns units, founds cities,
  // creates deals or declares war.

  private getSignificantResourceDemands(nationId: string): StrategicResourceDemand[] {
    const demands = this.strategicResourceDemandSystem?.getDemands(nationId) ?? [];
    return demands.filter((demand) => isSignificantDemand(demand.score));
  }

  /** Resource ids the nation significantly demands — the strong Worker priority signal. */
  private getSignificantlyDemandedResourceIds(nationId: string): Set<string> {
    return new Set(this.getSignificantResourceDemands(nationId).map((demand) => demand.resourceId));
  }

  private runResourceAcquisitionForNation(nationId: string): void {
    if (this.isHuman(nationId)) return;
    const demandSystem = this.strategicResourceDemandSystem;
    const exploration = this.aiExplorationSystem;
    if (!demandSystem || !exploration) return;

    const significant = this.getSignificantResourceDemands(nationId);
    if (significant.length === 0) {
      this.resourceAcquisitionLoggedByNation.get(nationId)?.clear();
      return;
    }

    const context = this.buildResourceAcquisitionContext(nationId, exploration.getKnownResourceOpportunities(nationId));
    for (const demand of significant) {
      const plan = classifyResourceAcquisition(
        { resourceId: demand.resourceId, resourceName: demand.resourceName, score: demand.score },
        context,
      );
      this.registerDemandedLandExpansionOpportunity(nationId, plan);
      this.logResourceAcquisitionTransition(nationId, plan);
    }
  }

  /** Feed the classified neutral-land target into the existing Settler memory. */
  private registerDemandedLandExpansionOpportunity(
    nationId: string,
    plan: ResourceAcquisitionPlan,
  ): void {
    if (plan.path !== 'neutral-land-expand' || !plan.tile) return;
    const evaluation = this.settlementMemorySystem.evaluateTile(
      plan.tile.x,
      plan.tile.y,
      this.turnManager.getCurrentRound(),
    );
    if (!evaluation) return;
    this.settlementMemorySystem.addCandidate(nationId, evaluation.candidate);
  }

  private buildResourceAcquisitionContext(
    nationId: string,
    opportunities: readonly KnownResourceOpportunity[],
  ) {
    return {
      opportunities,
      canImproveDomesticTile: (x: number, y: number) => {
        const tile = this.mapData.tiles[y]?.[x];
        return tile !== undefined && (this.builderSystem?.canNationImproveLandTile(nationId, tile) ?? false);
      },
      isReachableByLand: (x: number, y: number) => this.isLandReachable(nationId, x, y),
      getKnownSuppliers: (resourceId: string) => this.getKnownResourceSuppliers(nationId, resourceId),
    };
  }

  /**
   * Neutral overseas strategic-resource opportunities (Prompt 3 classification),
   * one per significantly-demanded resource, offered to the Expedition system as
   * launch reasons. Reuses the same classifier and the Prompt 3 land flood-fill
   * reachability gate — no second reachability calculation, no hidden knowledge.
   */
  private getNeutralOverseasResourceCandidates(nationId: string): ResourceExpeditionCandidate[] {
    const demandSystem = this.strategicResourceDemandSystem;
    const exploration = this.aiExplorationSystem;
    if (!demandSystem || !exploration) return [];
    const significant = this.getSignificantResourceDemands(nationId);
    if (significant.length === 0) return [];

    const context = this.buildResourceAcquisitionContext(nationId, exploration.getKnownResourceOpportunities(nationId));
    const candidates: ResourceExpeditionCandidate[] = [];
    for (const demand of significant) {
      const plan = classifyResourceAcquisition(
        { resourceId: demand.resourceId, resourceName: demand.resourceName, score: demand.score },
        context,
      );
      if (plan.path === 'neutral-overseas' && plan.tile) {
        candidates.push({
          resourceId: plan.resourceId,
          resourceName: plan.resourceName,
          x: plan.tile.x,
          y: plan.tile.y,
          demandScore: plan.demandScore,
        });
      }
    }
    return candidates;
  }

  /**
   * The most-demanded strategic resource the grantor is legitimately known to own
   * on an exploitable (foreign-owned, unimproved) tile — the concrete opportunity
   * that justifies a demand-driven exploitation-rights request. Uses only known
   * opportunities (no hidden map data); returns undefined when there is no real
   * match, so demand never triggers a *generic* request.
   */
  private getMatchedExploitationDemand(
    nationId: string,
    grantorId: string,
  ): { resourceId: string; resourceName: string; x: number; y: number; demandScore: number } | undefined {
    const exploration = this.aiExplorationSystem;
    if (!exploration) return undefined;
    const demandByResource = new Map<string, { name: string; score: number }>();
    for (const demand of this.getSignificantResourceDemands(nationId)) {
      demandByResource.set(demand.resourceId, { name: demand.resourceName, score: demand.score });
    }
    if (demandByResource.size === 0) return undefined;

    let best: { resourceId: string; resourceName: string; x: number; y: number; demandScore: number } | undefined;
    for (const opportunity of exploration.getKnownResourceOpportunities(nationId)) {
      if (opportunity.ownerId !== grantorId) continue; // must be owned by the prospective grantor
      const demand = demandByResource.get(opportunity.resourceId);
      if (!demand) continue;
      const tile = this.mapData.tiles[opportunity.y]?.[opportunity.x];
      if (!tile || tile.improvementId !== undefined) continue; // already improved → not a new exploitation opportunity
      if (best === undefined || demand.score > best.demandScore) {
        best = { resourceId: opportunity.resourceId, resourceName: demand.name, x: opportunity.x, y: opportunity.y, demandScore: demand.score };
      }
    }
    return best;
  }

  /** Nations the buyer has met that can currently export the resource (existing trade info model). */
  private getKnownResourceSuppliers(nationId: string, resourceId: string): string[] {
    if (!this.diplomacyManager || !this.resourceAccessSystem) return [];
    return this.nationManager.getAllNations()
      .filter((other) => {
        if (other.id === nationId) return false;
        if (this.discoverySystem && !this.discoverySystem.hasMet(nationId, other.id)) return false;
        if (this.diplomacyManager!.getState(nationId, other.id) === 'WAR') return false;
        return this.resourceAccessSystem!.canExportResource(other.id, resourceId);
      })
      .map((other) => other.id)
      .sort((a, b) => a.localeCompare(b));
  }

  private isLandReachable(nationId: string, x: number, y: number): boolean {
    const round = this.turnManager.getCurrentRound();
    if (this.landReachableCache?.round !== round) {
      this.landReachableCache = { round, byNation: new Map() };
    }
    let set = this.landReachableCache.byNation.get(nationId);
    if (!set) {
      set = this.computeLandReachableSet(nationId);
      this.landReachableCache.byNation.set(nationId, set);
    }
    return set.has(tileKey(x, y));
  }

  /**
   * Flood-fill the land tiles connected (by ordinary land adjacency, water
   * blocks) to any of the nation's cities. Mirrors the overseas system's
   * own-landmass concept so a neutral resource on another landmass is correctly
   * treated as overseas (deferred to Prompt 4) rather than land expansion.
   */
  private computeLandReachableSet(nationId: string): Set<string> {
    const reachable = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [];
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const key = tileKey(city.tileX, city.tileY);
      if (reachable.has(key)) continue;
      reachable.add(key);
      queue.push({ x: city.tileX, y: city.tileY });
    }
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of this.gridSystem.getAdjacentCoords(current)) {
        const tile = this.mapData.tiles[neighbor.y]?.[neighbor.x];
        if (!tile) continue;
        if (tile.type === TileType.Coast || tile.type === TileType.Ocean) continue; // water blocks land reach
        const key = tileKey(neighbor.x, neighbor.y);
        if (reachable.has(key)) continue;
        reachable.add(key);
        queue.push({ x: neighbor.x, y: neighbor.y });
      }
    }
    return reachable;
  }

  private logResourceAcquisitionTransition(nationId: string, plan: ResourceAcquisitionPlan): void {
    let logged = this.resourceAcquisitionLoggedByNation.get(nationId);
    if (!logged) {
      logged = new Map<string, ResourceAcquisitionPath>();
      this.resourceAcquisitionLoggedByNation.set(nationId, logged);
    }
    if (logged.get(plan.resourceId) === plan.path) return; // only log on a path change
    logged.set(plan.resourceId, plan.path);

    const header = `resource acquisition: ${plan.resourceName} (demand ${plan.demandScore})`;
    switch (plan.path) {
      case 'domestic-improve':
        console.log(this.formatLog(nationId, `${header}; known opportunity: domestic unimproved ${plan.resourceName} at (${plan.tile?.x},${plan.tile?.y}); action: prioritize improvement`));
        break;
      case 'foreign-trade':
        console.log(this.formatLog(nationId, `${header}; known supplier: ${this.nationManager.getNation(plan.supplierNationId ?? '')?.name ?? plan.supplierNationId}; action: attempting resource trade`));
        break;
      case 'neutral-land-expand':
        console.log(this.formatLog(nationId, `${header}; known opportunity: neutral ${plan.resourceName} at (${plan.tile?.x},${plan.tile?.y}); access: reachable by land; action: expansion opportunity registered (existing Settler AI)`));
        break;
      case 'neutral-overseas':
        console.log(this.formatLog(nationId, `${header}; known opportunity: neutral ${plan.resourceName} at (${plan.tile?.x},${plan.tile?.y}); access: overseas; action: deferred to expedition system`));
        break;
      case 'none':
        console.log(this.formatLog(nationId, `${header}; no known source; action: continue exploration / Economic Development fallback`));
        break;
    }
  }

  private ensureNavalReconProduction(nationId: string, cities: City[]): void {
    if (cities.length === 0) return;
    if (!this.canBuildUnit(nationId, SCOUT_BOAT.id)) return;
    if (!this.canAffordUnitProduction(nationId, SCOUT_BOAT)) return;

    const coastalCities = cities.filter((city) => cityHasWaterTile(city, this.mapData));
    if (coastalCities.length === 0) return;

    const plannedNavalRecon = this.countNavalReconUnits(nationId) + this.countQueuedNavalRecon(nationId);
    if (plannedNavalRecon >= DESIRED_EARLY_NAVAL_RECON_COUNT) return;
    if (!this.shouldBuildNavalRecon(nationId, coastalCities)) return;

    const city = coastalCities.find((candidate) => (
      this.productionSystem.getProduction(candidate.id) === undefined &&
      canCityProduceUnit(candidate, SCOUT_BOAT, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
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

  // Permanent civilian maritime presence: maritime AI nations keep at least one
  // active Scout Boat and one active Worker Boat at all times, representing
  // continuous exploration and sea-resource exploitation. Unlike
  // ensureNavalReconProduction, there is deliberately no exploration-complete /
  // known-resource stop condition — the minimum is maintained regardless of
  // how much ocean remains or whether a sea resource is currently known.
  //
  // Maritime identity is read from the nation's active military doctrine
  // (navalPower / maritimeRaider / navalProjection / pirateCode all qualify via
  // isMaritimeDoctrine), keeping the rule nation-agnostic: any current or future
  // nation configured with a maritime doctrine gets this behavior automatically.
  private ensureMaritimeMinimumProduction(nationId: string, cities: City[]): void {
    if (cities.length === 0) return;
    const doctrine = this.doctrineEvaluator.getDoctrine(nationId);
    if (!isMaritimeDoctrine(doctrine)) return;

    const coastalCities = cities.filter((city) => cityHasWaterTile(city, this.mapData));
    if (coastalCities.length === 0) return;

    // Count both active units and units already in production (current build +
    // queue) so multiple coastal cities do not each independently produce a
    // replacement in the same window.
    const scoutBoatMissing = this.countNavalReconUnits(nationId)
      + this.countUnitsInProduction(
        nationId,
        (unitType) => unitType.id === SCOUT_BOAT.id || unitType.category === 'naval_recon',
      ) < MARITIME_MINIMUM_UNITS;
    const workBoatMissing = this.countWorkBoats(nationId)
      + this.countQueuedWorkBoats(nationId) < MARITIME_MINIMUM_UNITS;

    // At war, drop the peacetime priority advantage: emergency defense and
    // wartime doctrine production must outrank civilian maritime replacements.
    // The minimum still exists as a preference and is restored once peace
    // returns.
    if (this.isAtWarWithAnyone(nationId)) {
      if (scoutBoatMissing || workBoatMissing) {
        if (!this.maritimeWarDeferLogged.has(nationId)) {
          this.maritimeWarDeferLogged.add(nationId);
          console.debug(this.formatLog(nationId, 'maritime minimum deferred by active war'));
        }
      }
      return;
    }
    this.maritimeWarDeferLogged.delete(nationId);

    if (scoutBoatMissing) {
      this.ensureMaritimeMinimumUnit(nationId, coastalCities, SCOUT_BOAT, 'Scout Boat');
    }
    if (workBoatMissing) {
      this.ensureMaritimeMinimumUnit(nationId, coastalCities, WORK_BOAT, 'Worker Boat');
    }
  }

  // Enqueues one maritime-minimum vessel with peacetime priority over routine
  // military production. Prefers an idle coastal city (so the replacement takes
  // the slot the scoring loop would otherwise fill with a routine military
  // unit); otherwise enqueues at the front of a busy city without interrupting
  // its current build.
  private ensureMaritimeMinimumUnit(
    nationId: string,
    coastalCities: readonly City[],
    unitType: UnitType,
    label: string,
  ): void {
    if (!this.canBuildUnit(nationId, unitType.id)) return;
    if (!this.canAffordUnitProduction(nationId, unitType)) return;

    const ctx = this.getUnitProductionRuleContext();
    const buildable = coastalCities.filter((city) => (
      canCityProduceUnit(city, unitType, this.mapData, this.gridSystem, ctx)
    ));
    if (buildable.length === 0) return;

    const idleCity = buildable.find((city) => this.productionSystem.getProduction(city.id) === undefined);
    const target = idleCity ?? buildable[0];
    if (idleCity) {
      this.productionSystem.setProduction(target.id, { kind: 'unit', unitType });
    } else {
      this.productionSystem.enqueueFront(target.id, { kind: 'unit', unitType });
    }
    console.debug(
      this.formatLog(nationId, `maritime minimum: ${label} replacement prioritized (${target.name})`),
    );
  }

  // Counts units of a given kind currently in production across all of a
  // nation's cities, including both the active build and queued entries.
  private countUnitsInProduction(
    nationId: string,
    matches: (unitType: UnitType) => boolean,
  ): number {
    let count = 0;
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const current = this.productionSystem.getProduction(city.id);
      if (current?.item.kind === 'unit' && matches(current.item.unitType)) count++;
      for (const entry of this.productionSystem.getQueue(city.id)) {
        if (entry.item.kind === 'unit' && matches(entry.item.unitType)) count++;
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
    if (this.isNormalExpansionSettlerOnCooldown(nationId)) return; // post-founding pacing
    if (this.countSettlers(nationId) > 0) return; // already have or queued one
    if (!this.canBuildUnit(nationId, SETTLER.id)) return;
    if (!this.canAffordUnitProduction(nationId, SETTLER)) return;

    const city = cities.find((candidate) => (
      this.productionSystem.getItemProductionBlockReason(candidate.id, { kind: 'unit', unitType: SETTLER }) === undefined
      && canCityProduceUnit(candidate, SETTLER, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
    ));
    if (!city) return;

    this.productionSystem.enqueueFront(city.id, { kind: 'unit', unitType: SETTLER });
    this.recordSettlerProductionStarted(nationId, 'earlyTarget');
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
    plannedMilitaryCount: number,
    plannedSettlerCount: number,
    effectiveMaxUnits: number,
    doctrine?: AIMilitaryDoctrine,
  ): Producible | undefined {
    const buildings = this.cityManager.getBuildings(city.id);

    // 1. Defender if no friendly combat unit at or adjacent to the city.
    const routineDefenderNeeded = this.needsDefender(city, nationId, doctrine);
    const routineDefenderAllowed = !routineDefenderNeeded || this.canBuildRoutineCityDefenderForCity(
      city,
      nationId,
      plannedMilitaryCount,
      effectiveMaxUnits,
    );
    if (routineDefenderNeeded && routineDefenderAllowed) {
      const defender = this.pickAnyValidMilitaryForCity(city, nationId);
      if (defender) return { kind: 'unit', unitType: defender };
    }

    // 2. Settler if the nation is still below its strategy's desired city count.
    const cityCount = this.cityManager.getCitiesByOwner(nationId).length;
    if (
      cityCount < this.getEffectiveDesiredCityCount(nationId, strategy) &&
      plannedSettlerCount === 0 &&
      this.canBuildUnit(nationId, SETTLER.id) &&
      this.productionSystem.getItemProductionBlockReason(city.id, { kind: 'unit', unitType: SETTLER }) === undefined &&
      canCityProduceUnit(city, SETTLER, this.mapData, this.gridSystem, this.getUnitProductionRuleContext()) &&
      !this.isSettlerProductionBlockedByHappiness(nationId) &&
      !this.isNormalExpansionSettlerOnCooldown(nationId)
    ) {
      return { kind: 'unit', unitType: SETTLER };
    }

    // 3-5. Core economy buildings (granary -> workshop -> market) if missing.
    for (const buildingType of [GRANARY, WORKSHOP, MARKET]) {
      if (
        !buildings.has(buildingType.id)
        && this.canBuildBuilding(nationId, buildingType.id)
        && this.productionSystem.getItemProductionBlockReason(city.id, {
          kind: 'building', buildingType,
        }) === undefined
      ) {
        return { kind: 'building', buildingType };
      }
    }

    // Do not let later generic military fallbacks recreate a routine defender
    // that the economic-crisis gate above explicitly denied.
    if (!routineDefenderAllowed) return undefined;

    // 6-7. Warrior, then Archer if the city can actually build them.
    // Skip for maritime doctrines: capability scoring via pickAnyValidMilitaryForCity
    // naturally selects naval units rather than forcing land defenders.
    if (!doctrine || !isMaritimeDoctrine(doctrine)) {
      for (const unitType of [WARRIOR, ARCHER]) {
        if (
          this.canBuildUnit(nationId, unitType.id) &&
          canCityProduceUnit(city, unitType, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
        ) {
          return { kind: 'unit', unitType };
        }
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
      canCityProduceUnit(city, u, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
    ));
    if (candidates.length === 0) return undefined;
    return candidates.reduce((a, b) => (a.productionCost <= b.productionCost ? a : b));
  }

  private countMilitary(nationId: string): number {
    return countMilitaryUnits(this.unitManager.getUnitsByOwner(nationId));
  }

  private countNavalUnits(nationId: string): number {
    return this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => this.isNavalCombatUnitType(u.unitType))
      .length;
  }

  private countQueuedNavalCombatUnits(nationId: string): number {
    let count = 0;
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const current = this.productionSystem.getProduction(city.id);
      if (
        current?.item.kind === 'unit' &&
        this.isNavalCombatUnitType(current.item.unitType)
      ) {
        count++;
      }
    }
    return count;
  }

  private isNavalCombatUnitType(unitType: UnitType): boolean {
    if (unitType.isNaval !== true) return false;
    if (unitType.category === 'civilian' || unitType.category === 'naval_recon') return false;
    return unitType.baseStrength > 0 || (unitType.rangedStrength ?? 0) > 0;
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
    effectiveMaxUnits: number = strategy.military.maxUnits,
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
      && this.productionSystem.getItemProductionBlockReason(city.id, {
        kind: 'building',
        buildingType: happinessBuilding,
      }) === undefined
    ) {
      console.debug(
        this.formatLog(nationId, `AI prioritizing ${happinessBuilding.name} due to happiness stabilization priority (${happiness.netHappiness}, state: ${happiness.state}).`),
      );
      return { kind: 'building', buildingType: happinessBuilding };
    }
    // Consolidation Mode: suppress ordinary buildup so productive capacity goes
    // into the treasury (Economic Development) rather than more permanent units
    // or marginal construction. Emergency/urgent needs below still override it.
    const consolidationSuppression = this.isConsolidationSuppressionActive(nationId);
    const defensivePressure = this.isDefensivePressureActive(nationId);
    const doctrineBudget = this.doctrineEvaluator.getDesiredMilitaryBudget(nationId);
    const isOverBudget = plannedMilitaryCount >= effectiveMaxUnits;
    // Score multiplier for non-emergency military when over doctrine budget.
    // Shrinks fast so buildings almost always win; emergency defenders bypass this.
    const budgetModifier = this.computeBudgetModifier(plannedMilitaryCount, effectiveMaxUnits);
    // General military gate: allow production unless over budget, or budget cap
    // is waived by threat when doctrine permits overbuilding when threatened.
    const canBuildGeneralMilitary = !isOverBudget ||
      (defensivePressure && doctrineBudget.allowOverbuildingWhenThreatened);
    const cityCount = this.cityManager.getCitiesByOwner(nationId).length;
    const wantsMoreCities = cityCount < this.getEffectiveDesiredCityCount(nationId, strategy);
    const canProduceSettler =
      this.canBuildUnit(nationId, SETTLER.id) &&
      this.productionSystem.getItemProductionBlockReason(city.id, { kind: 'unit', unitType: SETTLER }) === undefined &&
      canCityProduceUnit(city, SETTLER, this.mapData, this.gridSystem, this.getUnitProductionRuleContext());
    const settlerPlan = this.getSettlerProductionPlan(
      city,
      nationId,
      strategy,
      eraStrategy,
      plannedSettlerCount,
      canProduceSettler,
      happiness?.netHappiness,
    );
    const goldPerTurn = this.nationManager.getResources(nationId).goldPerTurn;
    const militaryDoctrineCtx = this.buildMilitaryDoctrineContext(nationId);

    // Build candidates from preferred to fallback so ties resolve sensibly.
    const candidates: AIProductionCandidate[] = [];
    const powerPlantPlan = this.powerPlantPlans.get(city.id);
    if (powerPlantPlan) {
      const buildingType = getBuildingById(powerPlantPlan.buildingId);
      if (buildingType) {
        candidates.push({
          item: { kind: 'building', buildingType },
          baseScore: powerPlantPlan.score,
          category: 'productionBuilding',
        });
      }
    }
    const spaceRaceFactoryPriority = this.getSpaceRaceFactoryPriority(nationId);
    const spaceRaceFactoryCandidate = spaceRaceFactoryPriority.applies
      && !buildings.has(FACTORY.id)
      && this.canBuildBuilding(nationId, FACTORY.id)
      && this.productionSystem.getItemProductionBlockReason(city.id, {
        kind: 'building', buildingType: FACTORY,
      }) === undefined
      ? {
          item: { kind: 'building' as const, buildingType: FACTORY },
          baseScore: spaceRaceFactoryPriority.resultingScore,
          category: 'productionBuilding' as const,
        }
      : undefined;
    if (spaceRaceFactoryCandidate) candidates.push(spaceRaceFactoryCandidate);

    // Routine defenders normally bypass the budget gate. During an economic
    // crisis, an over-cap nation needs a real emergency threat to do so.
    const routineDefenderNeeded = this.needsDefender(city, nationId, militaryDoctrineCtx?.doctrine);
    const acuteDefenderNeeded = routineDefenderNeeded && this.canBuildRoutineCityDefenderForCity(
      city,
      nationId,
      plannedMilitaryCount,
      effectiveMaxUnits,
    );
    const routineDefenderSuppressed = routineDefenderNeeded && !acuteDefenderNeeded;
    if (acuteDefenderNeeded) {
      const militaryUnit = this.pickMilitaryUnitForCity(city, nationId, militaryDoctrineCtx);
      if (militaryUnit) {
        candidates.push({
          item: { kind: 'unit', unitType: militaryUnit },
          baseScore: this.getMilitaryProductionScore(SCORE_ACUTE_DEFENDER, nationId, eraStrategy, true, false),
          category: 'military',
        });
      }
    }

    const availableOverseasTransportUnitTypes = ALL_UNIT_TYPES.filter((unitType) => (
      unitType.isNaval === true
      && hasCargoCapacity(unitType)
      && canCarryUnitType(unitType, SETTLER)
      && this.canBuildUnit(nationId, unitType.id)
      && canCityProduceUnit(city, unitType, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
    ));
    const overseasRequest = acuteDefenderNeeded
      ? undefined
      : this.overseasExpansionSystem?.getExpeditionProductionRequest(
        nationId,
        city,
        canProduceSettler,
        availableOverseasTransportUnitTypes,
      );
    if (overseasRequest) {
      candidates.push({
        item: { kind: 'unit', unitType: overseasRequest.unitType },
        baseScore: SCORE_ACUTE_DEFENDER - 5,
        category: overseasRequest.component === 'settler' ? 'settler' : 'workBoat',
      });
    }

    if (
      wantsMoreCities
      && settlerPlan !== undefined
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

    if (!wantsMoreCities && settlerPlan === 'longTerm') {
      candidates.push({
        item: { kind: 'unit', unitType: SETTLER },
        baseScore: this.getSettlerProductionScore(SCORE_SETTLER - 10, eraStrategy, happiness?.netHappiness),
        category: 'settler',
      });
    }

    if (canBuildGeneralMilitary && !consolidationSuppression && !routineDefenderSuppressed) {
      const militaryUnit = this.pickMilitaryUnitForCity(city, nationId, militaryDoctrineCtx);
      if (militaryUnit) {
        const navalSaturationModifier = this.getNavalSaturationUrgencyModifier(
          nationId,
          militaryDoctrineCtx.doctrine,
          militaryUnit,
          plannedNavalCount,
          coastalCityCount,
        );
        candidates.push({
          item: { kind: 'unit', unitType: militaryUnit },
          baseScore: this.getMilitaryProductionScore(SCORE_MILITARY, nationId, eraStrategy, defensivePressure) * budgetModifier * navalSaturationModifier,
          category: 'military',
        });
      }
    }

    const maritime = isMaritimeDoctrine(militaryDoctrineCtx.doctrine);
    const navalCap = maritime
      ? Math.max(
          coastalCityCount,
          Math.floor(
            effectiveMaxUnits
            * ((militaryDoctrineCtx.doctrine.targetComposition.navalMelee ?? 0)
              + (militaryDoctrineCtx.doctrine.targetComposition.navalRanged ?? 0)),
          ),
        )
      : coastalCityCount;

    if (
      canBuildGeneralMilitary &&
      !consolidationSuppression &&
      !routineDefenderSuppressed &&
      coastalCityCount > 0 &&
      cityHasWaterTile(city, this.mapData) &&
      plannedNavalCount < navalCap
    ) {
      const navalUnit = this.pickNavalUnitForCity(city, nationId, militaryDoctrineCtx);
      if (navalUnit) {
        const capabilityBoost = maritime && this.hasRangedNavalCapability(nationId)
          ? NAVAL_RANGED_CAPABILITY_BOOST
          : 1.0;
        const navalUrgency = maritime
          ? MARITIME_NAVAL_URGENCY_MULTIPLIER * capabilityBoost
          : 1.0;
        const navalSaturationModifier = this.getNavalSaturationUrgencyModifier(
          nationId,
          militaryDoctrineCtx.doctrine,
          navalUnit,
          plannedNavalCount,
          coastalCityCount,
        );
        candidates.push({
          item: { kind: 'unit', unitType: navalUnit },
          baseScore: this.getMilitaryProductionScore(SCORE_NAVAL, nationId, eraStrategy, defensivePressure) * navalUrgency * budgetModifier * navalSaturationModifier,
          category: 'military',
        });
      }
    }

    if (
      eraStrategy.productionWeights.worker !== undefined &&
      plannedWorkerCount < Math.max(1, cityCount) &&
      this.canBuildUnit(nationId, WORKER.id) &&
      canCityProduceUnit(city, WORKER, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
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
      canCityProduceUnit(city, WORK_BOAT, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
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

    const scienceBuilding = this.findMissingScienceBuilding(nationId, buildings);
    if (scienceBuilding) {
      candidates.push({
        item: { kind: 'building', buildingType: scienceBuilding },
        baseScore: this.getScienceBuildingProductionScore(scienceBuilding) + buildingBoost,
        category: 'scienceBuilding',
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

    if (this.corporationSystem) {
      const corporationCandidates = getAICorporationProductionCandidates({
        city,
        nationCities: this.cityManager.getCitiesByOwner(nationId),
        corporationSystem: this.corporationSystem,
        productionSystem: this.productionSystem,
        scienceVictoryEnabled: this.scienceVictoryEnabled,
      }).map((candidate) => this.applyVictoryFocusPriority(
        nationId,
        candidate,
        acuteDefenderNeeded || (powerPlantPlan?.score ?? 0) >= 100,
      ));
      candidates.push(...corporationCandidates);

      const aerospace = corporationCandidates.find((candidate) => (
        candidate.item.kind === 'corporation'
          && candidate.item.corporationType.id === AEROSPACE_INDUSTRIES_ID
      ));
      if (
        aerospace
        && this.scienceVictoryEnabled
        && !this.aerospaceEligibilityLoggedNationIds.has(nationId)
      ) {
        this.aerospaceEligibilityLoggedNationIds.add(nationId);
        const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
        const factoryCount = this.cityManager.getCitiesByOwner(nationId).filter((ownedCity) => (
          this.cityManager.getBuildings(ownedCity.id).hasActive('factory')
        )).length;
        this.logScienceVictoryAI(
          nationId,
          `${nationName} eligible for AeroSpace Industries: city=${city.name} factories=${factoryCount} aluminum=yes; considered candidate baseScore=${Math.round(aerospace.baseScore)}.`,
        );
      }
    }

    if (this.aerospacePartSystem) {
      const nationCities = this.cityManager.getCitiesByOwner(nationId);
      const aerospacePartCandidate = getAIAerospacePartProductionCandidate({
        city,
        nationCities,
        aerospacePartSystem: this.aerospacePartSystem,
        productionSystem: this.productionSystem,
        scienceVictoryEnabled: this.scienceVictoryEnabled,
        requiredAerospaceParts: this.requiredAerospaceParts,
      });
      if (aerospacePartCandidate) {
        candidates.push(this.applyVictoryFocusPriority(
          nationId,
          aerospacePartCandidate,
          acuteDefenderNeeded || (powerPlantPlan?.score ?? 0) >= 100,
        ));
      }

      if (this.scienceVictoryEnabled && nationCities[0]?.id === city.id) {
        const eligibleCity = nationCities.find((ownedCity) => this.aerospacePartSystem?.canCityProduce(ownedCity));
        const blockers = eligibleCity
          ? []
          : [...new Set(nationCities.flatMap((ownedCity) => (
            this.aerospacePartSystem?.getCityProductionBlockers(ownedCity) ?? []
          )))];
        const state = eligibleCity ? `eligible:${eligibleCity.id}` : `blocked:${blockers.join('|')}`;
        if (this.aerospaceManufacturingStateByNation.get(nationId) !== state) {
          this.aerospaceManufacturingStateByNation.set(nationId, state);
          const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
          if (eligibleCity) {
            this.logScienceVictoryAI(
              nationId,
              `${nationName} eligible to manufacture Aerospace Parts: city=${eligibleCity.name} progress=${this.aerospacePartSystem.getQuantity(nationId)}/${this.requiredAerospaceParts}.`,
            );
          } else if (this.aerospacePartSystem.isGloballyUnlocked()) {
            this.logScienceVictoryAI(
              nationId,
              `${nationName} cannot manufacture Aerospace Parts: ${blockers.join(', ') || 'no eligible city'}.`,
            );
          }
        }
      }
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
    if (canBuildGeneralMilitary && !consolidationSuppression && !routineDefenderSuppressed) {
      const militaryUnit = this.pickMilitaryUnitForCity(city, nationId, militaryDoctrineCtx);
      if (militaryUnit) {
        candidates.push({
          item: { kind: 'unit', unitType: militaryUnit },
          baseScore: this.getMilitaryProductionScore(SCORE_FALLBACK, nationId, eraStrategy, defensivePressure) * budgetModifier,
          category: 'military',
        });
      }
    }

    // Consolidation fallback: convert idle production into gold rather than
    // manufacturing another permanent unit or a marginal building. Ranked above
    // marginal fallbacks but below genuine-need buildings and emergencies.
    if (consolidationSuppression) {
      candidates.push({
        item: { kind: 'project', projectType: ECONOMIC_DEVELOPMENT },
        baseScore: SCORE_CONSOLIDATION_PROJECT,
        category: 'project',
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
    const weightedCandidates = filterAvailableAIProductionCandidates(
      applyGoalWeights(candidates, goalWeights),
      (item) => this.productionSystem.getItemProductionBlockReason(city.id, item),
    );
    const cityFocus = city.focus ?? 'balanced';
    const rhythmPick = consolidationSuppression || spaceRaceFactoryCandidate || (powerPlantPlan?.score ?? 0) >= 100 ? undefined : this.pickProductionRhythmCandidate(
      city,
      nationId,
      strategy,
      eraStrategy,
      cityFocus,
      happiness?.netHappiness,
      happinessBuildingThreshold,
    );
    const best = rhythmPick ?? pickBestAIProductionCandidate(weightedCandidates, strategy, eraStrategy, cityFocus);
    if (best?.item.kind === 'project') {
      const goldPerTurn = calculateProjectGoldPerTurn(
        best.item.projectType,
        this.productionSystem.getCityProductionPerTurn(city.id),
      );
      const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
      console.log(
        `[AI][${nationName}][${city.name}] Consolidation production: ${best.item.projectType.name} (+${goldPerTurn} Gold)`,
      );
      this.logStrategicEvent?.(nationId, `${city.name} consolidation production: ${best.item.projectType.name} (+${goldPerTurn} Gold/turn)`);
      return best.item;
    }
    if (best) {
      if (best.item.kind === 'unit' && best.item.unitType.baseStrength > 0) {
        this.logDoctrineProductionIfMaterial(nationId, best.item.unitType, militaryDoctrineCtx, city.name, budgetModifier);
        this.logDoctrineToleranceIfMaterial(nationId, best.item.unitType, militaryDoctrineCtx.doctrine, city.name);
        if (budgetModifier < 1.0 && acuteDefenderNeeded) {
          this.logBudgetAllowedForDefenderOnce(nationId, militaryDoctrineCtx.doctrine.id, city.name);
        }
      }
      if (cityFocus !== 'balanced') {
        const itemName = this.foundationProducibleName(best.item);
        const score = scoreAIProductionCandidate(best, strategy, eraStrategy, cityFocus);
        const message = `${city.name} production focus ${cityFocus} selected ${itemName}, score ${Math.round(score)}.`;
        console.log(this.formatLog(nationId, message));
        this.logStrategicEvent?.(nationId, message);
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
      if (powerPlantPlan && best.item.kind === 'building' && best.item.buildingType.id === powerPlantPlan.buildingId) {
        this.logPowerPlantDecision(nationId, city, powerPlantPlan);
      }
      if (best.item.kind === 'wonder') {
        console.log(
          this.formatLog(nationId, `prioritizing World Wonder: ${best.item.wonderType.name}`),
        );
      }
      if (best.item.kind === 'corporation') {
        const score = scoreAIProductionCandidate(best, strategy, eraStrategy, cityFocus);
        if (best.item.corporationType.id === AEROSPACE_INDUSTRIES_ID && this.scienceVictoryEnabled) {
          const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
          this.logScienceVictoryAI(
            nationId,
            `${nationName} selected AeroSpace Industries in ${city.name} score=${Math.round(score)}; production began.`,
          );
        } else {
          this.logStrategicEvent?.(
            nationId,
            `AI selected corporation ${best.item.corporationType.name} in ${city.name}, score ${Math.round(score)}.`,
          );
        }
      }
      if (best.item.kind === 'manufacturedResource') {
        const score = scoreAIProductionCandidate(best, strategy, eraStrategy, cityFocus);
        const bonus = this.aerospacePartSystem?.getProductionBonusPercent(nationId) ?? 0;
        const cost = this.aerospacePartSystem?.getProductionCostDetails(nationId);
        const effectiveCost = this.productionSystem.getCost(best.item, city.id);
        const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
        this.logScienceVictoryAI(
          nationId,
          `${nationName} selected Aerospace Part ${cost?.partNumber ?? '?'}/${this.requiredAerospaceParts} production in ${city.name} score=${Math.round(score)} completedParts=${cost?.completedParts ?? 0} baseCost=${cost?.baseProductionCost ?? best.item.productionType.productionCost} growthRate=${Math.round((cost?.growthRate ?? 0) * 100)}% productionCost=${cost?.productionCost ?? best.item.productionType.productionCost} effectiveCost=${effectiveCost} aerospaceIndustriesBonus=${bonus}%; production began.`,
        );
      }
      const itemName = this.foundationProducibleName(best.item);
      const reason = this.describeFoundationProductionReason(best.item);
      if (
        overseasRequest
        && best.item.kind === 'unit'
        && best.item.unitType.id === overseasRequest.unitType.id
      ) {
        this.overseasExpansionSystem?.markProductionSelected(
          nationId,
          city.name,
          overseasRequest.component,
          overseasRequest.target.markerId,
        );
      }
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

  private createPowerPlantPlans(
    nationId: string,
    cities: readonly City[],
  ): Map<string, AIPowerPlantDecision> {
    if (!this.powerPlantSystem) return new Map();
    return new Map(planAIPowerPlants({
      nationId,
      isHuman: this.isHuman(nationId),
      cities: cities.map((city) => ({
        id: city.id,
        name: city.name,
        population: city.population,
        currentPlant: this.powerPlantSystem?.getCityPowerPlant(city.id),
        currentCapacity: this.powerPlantSystem?.getCityPopulationCapacity(city.id),
        queuedPowerPlantIds: this.productionSystem.getQueue(city.id)
          .filter((entry) => entry.item.kind === 'building' && this.powerPlantSystem?.isPowerPlant(entry.item.buildingType.id))
          .map((entry) => entry.item.kind === 'building' ? entry.item.buildingType.id : ''),
        queuedCapacityInfrastructureIds: this.productionSystem.getQueue(city.id)
          .filter((entry) => entry.item.kind === 'building' && (entry.item.buildingType.modifiers.populationCapacity ?? 0) > 0)
          .map((entry) => entry.item.kind === 'building' ? entry.item.buildingType.id : ''),
        productionAvailable: this.productionSystem.getProduction(city.id) === undefined,
      })),
      getResourceCapacity: (resourceId) => this.powerPlantSystem?.getNationPowerPlantResourceCapacity(nationId, resourceId) ?? 0,
      canConstruct: (cityId, buildingId) => {
        const building = getBuildingById(buildingId);
        const city = this.cityManager.getCity(cityId);
        return Boolean(
          building
          && city
          && this.canCityBuildBuilding(city, nationId, building)
          && this.productionSystem.getItemProductionBlockReason(cityId, { kind: 'building', buildingType: building }) === undefined
        );
      },
      estimateConstructionTurns: (cityId, buildingId) => {
        const building = getBuildingById(buildingId);
        return building
          ? this.productionSystem.getTurnsEstimate(cityId, { kind: 'building', buildingType: building })
          : Number.POSITIVE_INFINITY;
      },
    }));
  }

  private logPowerPlantDecision(
    nationId: string,
    city: City,
    decision: AIPowerPlantDecision,
  ): void {
    const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
    const current = this.powerPlantSystem?.getCityPowerPlant(city.id);
    const currentName = current ? getBuildingById(current.buildingId)?.name ?? current.buildingId : 'None';
    const chosenName = getBuildingById(decision.buildingId)?.name ?? decision.buildingId;
    const remaining = decision.remainingLifespan === undefined
      ? ''
      : `, remaining lifespan ${decision.remainingLifespan}`;
    const resource = decision.requiredResourceId ? `, resource ${decision.requiredResourceId}` : '';
    const message = `[CapacityAI] ${nationName} / ${city.name}: population ${city.population}, capacity ${decision.currentCapacity}, current ${currentName}, chose ${chosenName} (capacity ${decision.targetCapacity})${resource}${remaining}, reason ${decision.reason}.`;
    console.log(this.formatLog(nationId, message));
    this.logStrategicEvent?.(nationId, message);
  }

  private getSpaceRaceFactoryPriority(nationId: string): AISpaceRaceFactoryPriority {
    const nationCities = this.cityManager.getCitiesByOwner(nationId);
    const activeFactoryCount = nationCities.filter((city) => (
      this.cityManager.getBuildings(city.id).hasActive(FACTORY.id)
    )).length;
    const queuedFactoryCount = nationCities.reduce((count, city) => (
      count + this.productionSystem.getQueue(city.id).filter((entry) => (
        entry.item.kind === 'building' && entry.item.buildingType.id === FACTORY.id
      )).length
    ), 0);
    return getAISpaceRaceFactoryPriority({
      scienceVictoryEnabled: this.scienceVictoryEnabled,
      spaceRaceGloballyUnlocked: this.aerospacePartSystem?.isGloballyUnlocked() ?? false,
      hasRocketry: this.researchSystem?.isResearched(nationId, SCIENCE_VICTORY_TECH_ID) ?? false,
      hasAluminum: this.resourceAccessSystem?.hasResource(nationId, 'aluminum') ?? false,
      activeFactoryCount,
      queuedFactoryCount,
    });
  }

  private logSpaceRaceFactoryPriorityState(nationId: string): void {
    if (!this.scienceVictoryEnabled || !this.aerospacePartSystem?.isGloballyUnlocked()) return;

    const nationCities = this.cityManager.getCitiesByOwner(nationId);
    const hasRocketry = this.researchSystem?.isResearched(nationId, SCIENCE_VICTORY_TECH_ID) ?? false;
    const hasAluminum = this.resourceAccessSystem?.hasResource(nationId, 'aluminum') ?? false;
    const activeFactoryCount = nationCities.filter((city) => (
      this.cityManager.getBuildings(city.id).hasActive(FACTORY.id)
    )).length;
    const queuedFactoryCount = nationCities.reduce((count, city) => (
      count + this.productionSystem.getQueue(city.id).filter((entry) => (
        entry.item.kind === 'building' && entry.item.buildingType.id === FACTORY.id
      )).length
    ), 0);
    const priority = getAISpaceRaceFactoryPriority({
      scienceVictoryEnabled: this.scienceVictoryEnabled,
      spaceRaceGloballyUnlocked: true,
      hasRocketry,
      hasAluminum,
      activeFactoryCount,
      queuedFactoryCount,
    });
    const state = [hasRocketry, hasAluminum, activeFactoryCount, queuedFactoryCount, priority.applies].join('|');
    if (this.spaceRaceFactoryPriorityStateByNation.get(nationId) === state) return;
    this.spaceRaceFactoryPriorityStateByNation.set(nationId, state);

    const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
    this.logScienceVictoryAI(
      nationId,
      `${nationName} space-race Factory evaluation: globallyUnlocked=yes rocketry=${hasRocketry ? 'yes' : 'no'} aluminum=${hasAluminum ? 'yes' : 'no'} activeFactories=${activeFactoryCount} queuedFactories=${queuedFactoryCount} specialPriority=${priority.applies ? 'yes' : 'no'} baseScore=${priority.baseScore} scienceVictoryBonus=${priority.scienceVictoryBonus} resultingScore=${priority.resultingScore}.`,
    );
  }

  private logScienceVictoryAI(nationId: string, message: string): void {
    const tagged = `[ScienceVictoryAI] ${message}`;
    console.log(this.formatLog(nationId, tagged));
    this.logStrategicEvent?.(nationId, tagged);
  }

  private getNavalSaturationUrgencyModifier(
    nationId: string,
    doctrine: AIMilitaryDoctrine,
    unitType: UnitType,
    plannedNavalCombatUnits: number,
    coastalCityCount: number,
  ): number {
    if (doctrine.id !== 'navalPower') return 1.0;
    if (!this.isNavalCombatUnitType(unitType)) return 1.0;

    const activeWars = this.countActiveWars(nationId);
    const desiredNavalUnits = Math.max(
      1,
      coastalCityCount * NAVAL_POWER_UNITS_PER_COASTAL_CITY
        + activeWars * NAVAL_POWER_UNITS_PER_ACTIVE_WAR,
    );
    const ratio = plannedNavalCombatUnits / desiredNavalUnits;

    let modifier = 1.0;
    if (ratio > 1.5) {
      modifier = NAVAL_POWER_SATURATION_EXTREME_MULTIPLIER;
    } else if (ratio > 1.0) {
      modifier = NAVAL_POWER_SATURATION_HIGH_MULTIPLIER;
    } else if (ratio > NAVAL_POWER_SOFT_SATURATION_RATIO) {
      modifier = NAVAL_POWER_SATURATION_MODERATE_MULTIPLIER;
    }

    if (modifier < 1.0) {
      this.logNavalSaturationOnce(nationId, plannedNavalCombatUnits, desiredNavalUnits, modifier);
    }
    return modifier;
  }

  private countActiveWars(nationId: string): number {
    if (!this.diplomacyManager) return 0;
    return this.nationManager.getAllNations()
      .filter((nation) => nation.id !== nationId && this.diplomacyManager?.getState(nationId, nation.id) === 'WAR')
      .length;
  }

  private logNavalSaturationOnce(
    nationId: string,
    navalCombatUnits: number,
    desiredNavalUnits: number,
    modifier: number,
  ): void {
    const currentRound = this.turnManager.getCurrentRound();
    const lastRound = this.navalSaturationLoggedRound.get(nationId) ?? -Infinity;
    if (currentRound - lastRound < 10) return;

    this.navalSaturationLoggedRound.set(nationId, currentRound);
    console.log(this.formatLog(
      nationId,
      `naval saturation detected: ${navalCombatUnits} naval units vs desired ${desiredNavalUnits}, urgency reduced to x${modifier.toFixed(2)}`,
    ));
  }

  // AI-only. True while normal expansion must wait after a recent city founding:
  // 20 turns after the capital (nation still at one city), 10 turns after any
  // later city. Expedition-driven settlement ignores this entirely. Nations that
  // never founded a city in-game (e.g. scenario pre-placed) have no cooldown.
  private isNormalExpansionSettlerOnCooldown(nationId: string): boolean {
    return isNormalExpansionSettlerOnCooldown({
      lastCityFoundedTurn: this.nationManager.getNation(nationId)?.lastCityFoundedTurn,
      cityCount: this.cityManager.getCitiesByOwner(nationId).length,
      currentTurn: this.turnManager.getCurrentRound(),
    });
  }

  private getSettlerProductionPlan(
    city: City,
    nationId: string,
    strategy: AIStrategy,
    eraStrategy: AILeaderEraStrategy,
    plannedSettlerCount: number,
    canProduceSettler: boolean,
    netHappiness: number | undefined,
  ): 'earlyTarget' | 'longTerm' | undefined {
    if (plannedSettlerCount > 0 || !canProduceSettler) return undefined;
    // Normal expansion respects the post-founding cooldown; expeditions do not
    // route through this plan and remain eligible.
    if (this.isNormalExpansionSettlerOnCooldown(nationId)) return undefined;

    const cityCount = this.cityManager.getCitiesByOwner(nationId).length;
    if (cityCount < this.getEffectiveDesiredCityCount(nationId, strategy)) return 'earlyTarget';

    const interval = strategy.expansion.settlerInterval ?? POST_TARGET_SETTLER_DEFAULT_INTERVAL;
    const completedCycles = this.completedProductionCyclesSinceLastSettler.get(nationId) ?? 0;
    if (completedCycles < interval) return undefined;
    if (!this.canResumeLongTermExpansion(nationId, strategy, eraStrategy, netHappiness)) return undefined;
    if (!this.hasReasonableFoundingSite(city, nationId, strategy, eraStrategy)) return undefined;

    return 'longTerm';
  }

  private canResumeLongTermExpansion(
    nationId: string,
    strategy: AIStrategy,
    eraStrategy: AILeaderEraStrategy,
    netHappiness: number | undefined,
  ): boolean {
    const resources = this.nationManager.getResources(nationId);
    if (resources.gold < POST_TARGET_SETTLER_MIN_GOLD && resources.goldPerTurn <= POST_TARGET_SETTLER_MIN_GOLD_PER_TURN) {
      return false;
    }
    if ((netHappiness ?? 0) <= AI_HAPPINESS_LOW) return false;
    if (this.getHighestThreatLevel(nationId) === 'high') return false;
    if (this.isAtWarWithAnyone(nationId) && this.isBelowMinimumMilitaryReadiness(nationId, eraStrategy)) return false;
    if (!this.canAffordUnitProduction(nationId, SETTLER)) return false;

    const cityCount = this.cityManager.getCitiesByOwner(nationId).length;
    // A leader-specific city cap (e.g. Mad Jack's one-city challenge) is an
    // absolute ceiling: never resume long-term expansion once it is reached.
    const leaderCap = getLeaderMaxPreferredCitiesByNationId(nationId);
    if (leaderCap !== undefined && cityCount >= leaderCap) return false;
    const interval = strategy.expansion.settlerInterval ?? POST_TARGET_SETTLER_DEFAULT_INTERVAL;
    return cityCount >= strategy.expansion.desiredCityCount && interval > 0;
  }

  private hasReasonableFoundingSite(
    originCity: City,
    nationId: string,
    strategy: AIStrategy,
    eraStrategy: AILeaderEraStrategy,
  ): boolean {
    const allCities = this.cityManager.getAllCities();
    const goals = this.nationManager.getNation(nationId)?.aiGoals;
    const intents = {
      wantsResources: hasGoalOfType(goals, 'build_economy'),
      wantsCoast: hasGoalOfType(goals, 'build_navy'),
      hasExpandGoal: hasGoalOfType(goals, 'expand'),
    };

    for (let y = 0; y < this.mapData.height; y++) {
      for (let x = 0; x < this.mapData.width; x++) {
        if (!this.isFoundingTargetValid(x, y, strategy, eraStrategy)) continue;
        const tile = this.mapData.tiles[y][x];
        const distance = this.gridSystem.getDistance(
          { x: originCity.tileX, y: originCity.tileY },
          { x, y },
        );
        const score = this.scoreFoundingTile(tile, distance, originCity, intents, eraStrategy);
        if (score >= 0 && this.minDistanceToCities(x, y, allCities) < Infinity) return true;
      }
    }

    return false;
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

    if (phase === 'war' && this.needsDefender(city, nationId, this.doctrineEvaluator.getDoctrine(nationId))) return undefined;

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

    const availableCandidates = filterAvailableAIProductionCandidates(
      candidates,
      (item) => this.productionSystem.getItemProductionBlockReason(city.id, item),
    );
    const best = pickBestAIProductionCandidate(availableCandidates, strategy, eraStrategy, cityFocus ?? 'balanced');
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
      + (building.modifiers.sciencePercent ?? 0) * 1.5
      + (building.modifiers.goldPerTurn ?? 0) * 4
      + (building.modifiers.culturePerTurn ?? 0) * 5
      + (building.modifiers.culturePercent ?? 0)
      // Capacity urgency is handled by the shared capacity planner; this small
      // baseline keeps infrastructure available without making cities rush it.
      + (building.modifiers.populationCapacity ?? 0)
      + (building.modifiers.cityDefensePercent ?? 0) * 2;
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
      case 'manufacturedResource':
        return `manufacturedResource:${item.productionType.name}`;
      case 'project':
        return `project:${item.projectType.name}`;
      case 'tradeRoute':
        return `tradeRoute:${item.displayName}`;
    }
  }

  private logProductionRhythm(nationId: string, message: string): void {
    console.log(this.formatLog(nationId, message));
    this.logStrategicEvent?.(nationId, message);
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

  private computeBudgetModifier(currentUnits: number, effectiveMax: number): number {
    if (effectiveMax <= 0 || currentUnits <= effectiveMax) return 1.0;
    if (currentUnits >= effectiveMax * 3) return 0.02;
    if (currentUnits >= effectiveMax * 2) return 0.05;
    return 0.15;
  }

  private buildMilitaryDoctrineContext(nationId: string): {
    doctrine: AIMilitaryDoctrine;
    nationEraIndex: number;
  } {
    return {
      doctrine: getLeaderMilitaryDoctrineByNationId(nationId),
      nationEraIndex: getEraIndex(this.getNationEra(nationId)),
    };
  }

  private logDoctrineToleranceIfMaterial(nationId: string, unitType: UnitType, doctrine: AIMilitaryDoctrine, cityName: string): void {
    const netHappiness = this.happinessSystem?.getNetHappiness(nationId);
    const gold = this.nationManager.getResources(nationId).gold;
    const warWeariness = this.happinessSystem?.getNationState(nationId)?.unhappinessFromWarWeariness ?? 0;
    const modifier = this.doctrineEvaluator.getMilitaryProductionPressureModifier(nationId, {
      happiness: netHappiness,
      gold,
      warWeariness,
      isThreatened: false,
    });
    if (modifier >= 1.0) return;

    const currentRound = this.turnManager.getCurrentRound();
    if (this.doctrinePressureLoggedRound.get(nationId) === currentRound) return;
    this.doctrinePressureLoggedRound.set(nationId, currentRound);

    const tol = doctrine.strategicTolerance;
    const reasons: string[] = [];
    if (netHappiness !== undefined && netHappiness < tol.minHappinessForMilitaryBuilds) {
      reasons.push(`happiness ${netHappiness} below threshold ${tol.minHappinessForMilitaryBuilds}`);
    }
    if (gold < tol.minGoldReserveForMilitaryBuilds) {
      reasons.push(`gold ${gold} below threshold ${tol.minGoldReserveForMilitaryBuilds}`);
    }
    if (!tol.tolerateWarWeariness && warWeariness > 0) {
      reasons.push(`war weariness ${warWeariness}`);
    }
    const toleranceMsg = `doctrine discouraged ${unitType.name} production in ${cityName} (${doctrine.id}): ${reasons.join(', ')}, pressure x${modifier.toFixed(2)}.`;
    console.log(this.formatLog(nationId, toleranceMsg));
    this.logStrategicEvent?.(nationId, toleranceMsg);
  }

  private logPeriodicDoctrineStatus(nationId: string): void {
    const status = this.doctrineEvaluator.explainDoctrineState(nationId);
    const message = `doctrine status: ${status}`;
    console.log(this.formatLog(nationId, message));
    this.logStrategicEvent?.(nationId, message);
  }

  private logMilitaryBudgetStatusOnce(
    nationId: string,
    doctrineId: string,
    currentCount: number,
    effectiveMax: number,
    baseMax: number,
    budgetModifier: number,
  ): void {
    if (effectiveMax === baseMax || currentCount < effectiveMax) return;
    const currentRound = this.turnManager.getCurrentRound();
    if (this.militaryBudgetLoggedRound.get(nationId) === currentRound) return;
    this.militaryBudgetLoggedRound.set(nationId, currentRound);
    const budgetMsg = `doctrine reduced military production: ${doctrineId}, current units ${currentCount} / effective max ${effectiveMax}, budget x${budgetModifier.toFixed(2)}.`;
    console.log(this.formatLog(nationId, budgetMsg));
    this.logStrategicEvent?.(nationId, budgetMsg);
  }

  private logDoctrineProductionIfMaterial(
    nationId: string,
    unitType: UnitType,
    ctx: { doctrine: AIMilitaryDoctrine; nationEraIndex: number },
    cityName: string,
    budgetModifier: number = 1.0,
  ): void {
    const rationale = this.militaryPickRationaleByNation.get(nationId);
    if (!rationale) return;
    if (
      rationale.roleDeficitMultiplier === 1.0 &&
      rationale.role === null &&
      rationale.preferredRoleMultiplier === 1.0 &&
      budgetModifier === 1.0
    ) return;

    const currentRound = this.turnManager.getCurrentRound();
    if (this.doctrineProductionLoggedRound.get(nationId) === currentRound) return;
    this.doctrineProductionLoggedRound.set(nationId, currentRound);

    const netHappiness = this.happinessSystem?.getNetHappiness(nationId);
    const gold = this.nationManager.getResources(nationId).gold;
    const warWeariness = this.happinessSystem?.getNationState(nationId)?.unhappinessFromWarWeariness ?? 0;
    const pressureModifier = this.doctrineEvaluator.getMilitaryProductionPressureModifier(nationId, {
      happiness: netHappiness, gold, warWeariness, isThreatened: false,
    });

    const breakdown: DoctrineProductionScoreBreakdown = {
      doctrineId: ctx.doctrine.id,
      role: rationale.role,
      preferredRoleMultiplier: rationale.preferredRoleMultiplier,
      roleDeficitMultiplier: rationale.roleDeficitMultiplier,
      pressureModifier,
      reasonParts: [],
    };

    const role = breakdown.role ?? 'none';
    const score = Math.round(rationale.finalScore);
    const selectionMsg = `doctrine selected ${unitType.name} in ${cityName}: ${breakdown.doctrineId}, role ${role}, preferred x${breakdown.preferredRoleMultiplier.toFixed(2)}, deficit x${breakdown.roleDeficitMultiplier.toFixed(2)}, budget x${budgetModifier.toFixed(2)}, pressure x${breakdown.pressureModifier.toFixed(2)}, final score ${score}.`;
    console.log(this.formatLog(nationId, selectionMsg));
    this.logStrategicEvent?.(nationId, selectionMsg);
  }

  private logBudgetAllowedForDefenderOnce(nationId: string, doctrineId: string, cityName: string): void {
    const currentRound = this.turnManager.getCurrentRound();
    if (this.budgetAllowedLoggedRound.get(nationId) === currentRound) return;
    this.budgetAllowedLoggedRound.set(nationId, currentRound);
    const msg = `doctrine allowed military despite budget: ${doctrineId}, city ${cityName} needs defender.`;
    console.log(this.formatLog(nationId, msg));
    this.logStrategicEvent?.(nationId, msg);
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

    const netHappiness = this.happinessSystem?.getNetHappiness(nationId);
    const gold = this.nationManager.getResources(nationId).gold;
    const warWeariness = this.happinessSystem?.getNationState(nationId)?.unhappinessFromWarWeariness ?? 0;

    // Era-strategy happiness threshold (existing behavior).
    const threshold = eraStrategy.happinessBehavior?.stabilizationThreshold;
    const eraModifier = (threshold !== undefined && netHappiness !== undefined && netHappiness < threshold)
      ? 0.65
      : 1.0;

    // Doctrine strategic tolerance modifier. isThreatened is false here because
    // defensivePressure already returned the boosted score above.
    const toleranceModifier = this.doctrineEvaluator.getMilitaryProductionPressureModifier(nationId, {
      happiness: netHappiness,
      gold,
      warWeariness,
      isThreatened: false,
    });

    // Use the stronger discouragement signal without double-stacking.
    return baseScore * Math.min(eraModifier, toleranceModifier);
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

  private hasRangedNavalCapability(nationId: string): boolean {
    return ALL_UNIT_TYPES.some(
      (u) => u.isNaval === true
        && (u.rangedStrength ?? 0) > 0
        && this.canBuildUnit(nationId, u.id),
    );
  }

  private hasRangedNavalUnitAvailableOrProducible(nationId: string): boolean {
    if (this.unitManager.getUnitsByOwner(nationId).some((unit) => (
      unit.unitType.isNaval === true &&
      (unit.unitType.rangedStrength ?? 0) > 0
    ))) {
      return true;
    }

    const coastalCities = this.cityManager.getCitiesByOwner(nationId)
      .filter((city) => cityHasWaterTile(city, this.mapData));
    if (coastalCities.length === 0) return false;

    return ALL_UNIT_TYPES.some((unitType) => (
      unitType.isNaval === true &&
      (unitType.rangedStrength ?? 0) > 0 &&
      this.canBuildUnit(nationId, unitType.id) &&
      coastalCities.some((city) => (
        canCityProduceUnit(city, unitType, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
      ))
    ));
  }

  private pickNavalUnitForCity(
    city: City,
    nationId: string,
    doctrineCtx?: { doctrine: AIMilitaryDoctrine; nationEraIndex: number },
  ): UnitType | undefined {
    const candidates = ALL_UNIT_TYPES.filter((u) => (
      u.isNaval === true &&
      u.baseStrength > 0 &&
      this.canBuildUnit(nationId, u.id) &&
      canCityProduceUnit(city, u, this.mapData, this.gridSystem, this.getUnitProductionRuleContext())
    ));
    if (candidates.length === 0) return undefined;

    if (doctrineCtx) {
      const { doctrine, nationEraIndex } = doctrineCtx;

      let maxDeficit = -Infinity;
      const unitDeficits = new Map<string, number>();
      for (const u of candidates) {
        const role = getUnitDoctrineRole(u);
        if (role !== null) {
          const deficit = this.doctrineEvaluator.getRoleDeficit(nationId, role);
          unitDeficits.set(u.id, deficit);
          if (deficit > maxDeficit) maxDeficit = deficit;
        }
      }

      let best: UnitType = candidates[0];
      let bestFinalScore = -Infinity;
      let bestRoleDeficitMultiplier = 1.0;
      let bestRole: AIMilitaryDoctrineRole | null = null;
      let bestPreferredRoleMultiplier = 1.0;

      for (const u of candidates) {
        let score = scoreMilitaryUnitCandidate(u, doctrine, nationEraIndex);
        const role = getUnitDoctrineRole(u);
        const roleDeficitMultiplier = role !== null
          ? this.doctrineEvaluator.getRoleDeficitMultiplier(nationId, role)
          : 1.0;
        score *= roleDeficitMultiplier;

        if (roleDeficitMultiplier < 0.75 && (unitDeficits.get(u.id) ?? -Infinity) < maxDeficit) {
          score *= 0.75;
        }

        if (score > bestFinalScore) {
          best = u;
          bestFinalScore = score;
          bestRoleDeficitMultiplier = roleDeficitMultiplier;
          bestRole = role;
          bestPreferredRoleMultiplier = role !== null
            ? this.doctrineEvaluator.getPreferredRoleMultiplier(nationId, role)
            : 1.0;
        }
      }

      this.militaryPickRationaleByNation.set(nationId, {
        role: bestRole,
        preferredRoleMultiplier: bestPreferredRoleMultiplier,
        roleDeficitMultiplier: bestRoleDeficitMultiplier,
        finalScore: bestFinalScore,
      });

      return best;
    }

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

  /**
   * Logs once per city/round when the era-obsolescence filter removed every
   * buildable military option, leaving no valid production candidate. This is
   * the only obsolete-filtering situation worth surfacing.
   */
  private warnNoValidMilitaryCandidate(city: City, nationId: string, nationEra: Era): void {
    const key = `${this.turnManager.getCurrentRound()}:${city.id}`;
    if (this.obsoleteMilitaryStarvationLogKeys.has(key)) return;
    this.obsoleteMilitaryStarvationLogKeys.add(key);
    this.logStrategicEvent?.(
      nationId,
      `no valid military candidate for ${city.name}: every buildable unit is obsolete for the ${nationEra} era.`,
    );
  }

  private pickMilitaryUnitForCity(
    city: City,
    nationId: string,
    doctrineCtx?: { doctrine: AIMilitaryDoctrine; nationEraIndex: number },
  ): UnitType | undefined {
    const maritime = doctrineCtx !== undefined && isMaritimeDoctrine(doctrineCtx.doctrine);
    const ctx = this.getUnitProductionRuleContext();
    const nationEra = this.getNationEra(nationId);
    const buildableMilitary = MILITARY_OPTIONS.filter((u) =>
      (!u.isNaval || maritime) && this.canBuildUnit(nationId, u.id));
    // Drop era-obsolete options as the candidate list is built, before any
    // doctrine scoring. Legal producibility is unchanged — canCityProduceUnit
    // still gates obsolete units for every other caller (e.g. human UI).
    const nonObsolete = buildableMilitary.filter((u) =>
      !(isMilitaryProductionUnit(u) && isUnitObsoleteForNationEra(u.era, nationEra)));
    const available = nonObsolete.filter((u) =>
      canCityProduceUnit(city, u, this.mapData, this.gridSystem, ctx));
    if (available.length === 0) {
      // Only surface the abnormal outcome: obsolescence removed every buildable
      // military option, so no valid candidate remains. Routine per-unit
      // obsolete rejections are silent.
      if (buildableMilitary.length > 0 && nonObsolete.length === 0) {
        this.warnNoValidMilitaryCandidate(city, nationId, nationEra);
      }
      return undefined;
    }

    if (doctrineCtx) {
      const { doctrine, nationEraIndex } = doctrineCtx;
      const covertPersonality = this.nationManager.getCovertPersonality(nationId);

      // Once any ranged naval ship is buildable, melee naval units become a
      // heavy-suppressed fallback — maritime doctrines should converge on the
      // strongest ranged option rather than accumulating obsolete melee ships.
      const hasRangedNavalOption = maritime && available.some(
        (u) => u.isNaval === true && (u.rangedStrength ?? 0) > 0,
      );

      // Pre-compute deficits so the dampening rule can detect better alternatives.
      let maxDeficit = -Infinity;
      const unitDeficits = new Map<string, number>();
      for (const u of available) {
        const role = getUnitDoctrineRole(u);
        if (role !== null) {
          const deficit = this.doctrineEvaluator.getRoleDeficit(nationId, role);
          unitDeficits.set(u.id, deficit);
          if (deficit > maxDeficit) maxDeficit = deficit;
        }
      }

      let best: UnitType = available[0];
      let bestFinalScore = -Infinity;
      let bestRoleDeficitMultiplier = 1.0;
      let bestRole: AIMilitaryDoctrineRole | null = null;
      let bestPreferredRoleMultiplier = 1.0;

      for (const u of available) {
        let score = scoreMilitaryUnitCandidate(u, doctrine, nationEraIndex);
        const role = getUnitDoctrineRole(u);
        const roleDeficitMultiplier = role !== null
          ? this.doctrineEvaluator.getRoleDeficitMultiplier(nationId, role)
          : 1.0;
        score *= roleDeficitMultiplier;

        // Dampen overrepresented candidates when at least one better-deficit alternative exists.
        if (roleDeficitMultiplier < 0.75 && (unitDeficits.get(u.id) ?? -Infinity) < maxDeficit) {
          score *= 0.75;
        }

        // Suppress melee naval candidates when a ranged naval option exists.
        if (hasRangedNavalOption && u.isNaval && (u.rangedStrength ?? 0) === 0) {
          score *= NAVAL_MELEE_SUPPRESSION_MULTIPLIER;
        }

        // Pirate personalities strongly favour privateers; doctrine still governs.
        if (u.id === PRIVATEER.id) {
          score *= getPrivateerPersonalityMultiplier(covertPersonality);
        }

        if (score > bestFinalScore) {
          best = u;
          bestFinalScore = score;
          bestRoleDeficitMultiplier = roleDeficitMultiplier;
          bestRole = role;
          bestPreferredRoleMultiplier = role !== null
            ? this.doctrineEvaluator.getPreferredRoleMultiplier(nationId, role)
            : 1.0;
        }
      }

      this.militaryPickRationaleByNation.set(nationId, {
        role: bestRole,
        preferredRoleMultiplier: bestPreferredRoleMultiplier,
        roleDeficitMultiplier: bestRoleDeficitMultiplier,
        finalScore: bestFinalScore,
      });

      // Log once when a ranged naval unit won over suppressed melee naval options.
      if (
        hasRangedNavalOption &&
        best.isNaval &&
        (best.rangedStrength ?? 0) > 0 &&
        available.some((u) => u.isNaval && (u.rangedStrength ?? 0) === 0 && u.baseStrength > 0)
      ) {
        console.debug(this.formatLog(nationId, `doctrine preferred ranged naval ${best.name} over weaker naval option for ${doctrine.id}.`));
      }

      // Covert units compete as one more input: a personality with a real covert
      // deficit can outscore the best military choice, but otherwise loses.
      const covertChoice = this.evaluateCovertProductionCandidate(nationId, city, covertPersonality, bestFinalScore);
      if (covertChoice) return covertChoice;

      return best;
    }

    const archer = available.find((u) => u.id === ARCHER.id);
    if (archer && !this.hasFriendlyRangedUnitNearby(city, nationId)) return archer;
    return available.find((u) => u.id === WARRIOR.id) ?? available[0];
  }

  /** Buildable covert-category units (spy/agent/rebels/partisans) for this city/era. */
  private getBuildableCovertUnits(nationId: string, city: City): UnitType[] {
    return COVERT_CANDIDATE_UNIT_IDS
      .map((id) => getUnitTypeById(id))
      .filter((u): u is UnitType => u !== undefined
        && this.canBuildUnit(nationId, u.id)
        && canCityProduceUnit(city, u, this.mapData, this.gridSystem, this.getUnitProductionRuleContext()));
  }

  /** Owned land covert units (the covert-force "current capability"). */
  private countCovertUnits(nationId: string): number {
    return this.unitManager.getUnitsByOwner(nationId).filter((u) => isManagedCovertUnit(u.unitType)).length;
  }

  /**
   * If the nation has a covert deficit and its personality wants covert units
   * strongly enough to beat the best military score, return the covert unit to
   * build (else undefined). Reuses the same scoring scale via `militaryScore`.
   */
  private evaluateCovertProductionCandidate(
    nationId: string,
    city: City,
    personality: CovertPersonality,
    militaryScore: number,
  ): UnitType | undefined {
    const buildable = this.getBuildableCovertUnits(nationId, city);
    if (buildable.length === 0) return undefined;

    const desired = getDesiredCovertCapability(personality, true);
    const current = this.countCovertUnits(nationId);
    const deficit = Math.max(0, desired - current);
    if (deficit <= 0) return undefined;

    const covertUnit = pickPreferredCovertUnit(buildable);
    if (!covertUnit) return undefined;

    const factor = getCovertDemandFactor(personality, true);
    const reference = Math.max(militaryScore, COVERT_MIN_REFERENCE_SCORE);
    const covertScore = reference * factor;
    if (covertScore <= militaryScore) return undefined;

    console.debug(this.formatLog(
      nationId,
      `covert force deficit (${current}/${desired}): ${covertUnit.name} production selected — ${personality.name} personality covert demand (factor ${factor.toFixed(2)}).`,
    ));
    return covertUnit;
  }

  private canBuildUnit(nationId: string, unitId: string): boolean {
    return this.researchSystem?.isUnitUnlocked(nationId, unitId) ?? true;
  }

  private canAffordUnitProduction(nationId: string, unitType: UnitType): boolean {
    return this.unitUpkeepSystem?.getUnitUpkeepAffordabilityReason(nationId, unitType, 10) === undefined;
  }

  private unitProductionRestrictionReason?: (nationId: string, unitTypeId: string) => string | undefined;

  /** Inject the authoritative per-nation production restriction (e.g. capitulation demilitarization). */
  setUnitProductionRestrictionReason(fn: (nationId: string, unitTypeId: string) => string | undefined): void {
    this.unitProductionRestrictionReason = fn;
  }

  private getUnitProductionRuleContext(): UnitProductionRuleContext {
    return {
      strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
      unitUpkeepAffordability: this.unitUpkeepSystem,
      upkeepAffordabilityTurns: 10,
      getUnitProductionRestrictionReason: this.unitProductionRestrictionReason,
      hasActiveUnitOfType: (nationId, unitTypeId) =>
        this.unitManager.getUnitsByOwner(nationId).some((unit) => unit.unitType.id === unitTypeId),
      isResidenceCapital: (city) => city.isResidenceCapital,
      getNationEra: (nationId) => this.getNationEra(nationId),
    };
  }

  private canBuildBuilding(nationId: string, buildingId: string): boolean {
    if (buildingId === GRAND_STADIUM_BUILDING_ID) return false;
    return this.researchSystem?.isBuildingUnlocked(nationId, buildingId) ?? true;
  }

  private ensureGrandStadiumProduction(nationId: string): void {
    const cityId = this.gamesOfNationsSystem?.getGrandStadiumPriorityCityId(nationId);
    if (!cityId) return;
    const city = this.cityManager.getCity(cityId);
    if (!city || city.ownerId !== nationId || this.cityManager.getBuildings(cityId).has(GRAND_STADIUM_BUILDING_ID)) return;
    const queue = this.productionSystem.getQueue(cityId);
    const priorityAction = getGrandStadiumPriorityQueueAction(queue);
    if (priorityAction === null) return;
    if (priorityAction > 0) {
      this.productionSystem.moveQueueEntryToFront(cityId, priorityAction);
      this.logStrategicEvent?.(nationId, `Grand Stadium moved to highest production priority in ${city.name}.`);
      return;
    }
    const placement = this.reserveAIBuildingPlacement(city, GRAND_STADIUM);
    if (this.buildingPlacementSystem && !placement) {
      this.logStrategicEvent?.(nationId, `Grand Stadium priority blocked in ${city.name}: no valid placement.`);
      return;
    }
    this.productionSystem.enqueueFront(cityId, { kind: 'building', buildingType: GRAND_STADIUM }, { placement });
    this.logStrategicEvent?.(nationId, `Grand Stadium set as highest production priority in ${city.name}.`);
  }

  /**
   * Science Victory execution: once a nation is in Science Victory Focus, force
   * the victory chain (found AeroSpace Industries → manufacture Aerospace Parts)
   * so routine city production cannot indefinitely starve an available win path.
   *
   * This runs before the normal per-city production loop, so it commits idle
   * cities ahead of ordinary scoring/rhythm choices. It reuses the canonical
   * corporation and Aerospace-Part requirement checks; it never cancels an
   * in-progress build, and it yields to genuine emergencies (threatened cities
   * are already committed to defenders by ensureEmergencyMilitaryProduction, and
   * the queue-jump path is skipped while any emergency threat is active).
   */
  private ensureScienceVictoryProduction(nationId: string, cities: readonly City[]): void {
    const corporationSystem = this.corporationSystem;
    if (!this.scienceVictoryEnabled || !corporationSystem || !this.victorySystem) return;
    if (cities.length === 0) return;
    const nation = this.nationManager.getNation(nationId);
    if (nation?.aiVictoryFocus?.type !== 'science') return;

    const progress = this.victorySystem.getScienceVictoryProgress(nationId);
    const corporationDefinition = AEROSPACE_INDUSTRIES_DEFINITION;
    const canFound = !progress.hasAerospaceIndustries
      && corporationSystem.canFoundCorporation(nationId, AEROSPACE_INDUSTRIES_ID);

    if (canFound && !this.aerospaceFoundingActionableLoggedNationIds.has(nationId)) {
      this.aerospaceFoundingActionableLoggedNationIds.add(nationId);
      this.logScienceVictoryAI(
        nationId,
        `${nation.name} Science Victory Focus is actionable: AeroSpace Industries requirements satisfied — prioritizing founding.`,
      );
    }

    const corporationInProduction = cities.some((city) => {
      const current = this.productionSystem.getProduction(city.id);
      return current?.item.kind === 'corporation' && current.item.corporationType.id === AEROSPACE_INDUSTRIES_ID;
    }) || isCorporationQueuedByNation(cities, AEROSPACE_INDUSTRIES_ID, this.productionSystem);

    const corporationItem: Producible | undefined = corporationDefinition
      ? { kind: 'corporation', corporationType: corporationDefinition }
      : undefined;
    const corporationEligibleCities = corporationItem
      ? cities
        .filter((city) => corporationSystem.canCityProduceCorporation(city, AEROSPACE_INDUSTRIES_ID))
        .map((city) => ({
          cityId: city.id,
          idle: this.productionSystem.getProduction(city.id) === undefined,
          turns: this.productionSystem.getTurnsEstimate(city.id, corporationItem),
        }))
      : [];

    const aerospacePartSystem = this.aerospacePartSystem;
    const aerospacePartItem: Producible = {
      kind: 'manufacturedResource',
      productionType: AEROSPACE_PART_PRODUCTION,
    };
    const partEligibleCities = aerospacePartSystem
      ? cities
        .filter((city) => aerospacePartSystem.canCityProduce(city))
        .map((city) => ({
          cityId: city.id,
          idle: this.productionSystem.getProduction(city.id) === undefined,
          turns: this.productionSystem.getTurnsEstimate(city.id, aerospacePartItem),
        }))
      : [];

    const plan = planScienceVictoryProduction({
      inScienceFocus: true,
      hasAerospaceIndustries: progress.hasAerospaceIndustries,
      canFoundAerospaceIndustries: canFound,
      aerospaceIndustriesInProduction: corporationInProduction,
      emergencyActive: this.getEmergencyCityThreats(nationId).length > 0,
      accumulatedParts: progress.aerospaceParts,
      inFlightParts: aerospacePartSystem?.getInFlightQuantity(nationId) ?? 0,
      requiredParts: progress.requiredAerospaceParts,
      corporationEligibleCities,
      partEligibleCities,
    });

    this.executeScienceVictoryPlan(nationId, cities, plan, corporationItem, progress.aerospaceParts, progress.requiredAerospaceParts);
  }

  private executeScienceVictoryPlan(
    nationId: string,
    cities: readonly City[],
    plan: ScienceVictoryExecutionPlan,
    corporationItem: Producible | undefined,
    accumulatedParts: number,
    requiredParts: number,
  ): void {
    const cityName = (cityId: string): string => cities.find((city) => city.id === cityId)?.name ?? cityId;

    switch (plan.kind) {
      case 'foundAerospaceIndustries': {
        if (!corporationItem) return;
        if (plan.immediate) {
          this.productionSystem.setProduction(plan.cityId, corporationItem);
          this.logForcedScienceVictory(nationId, `selected ${cityName(plan.cityId)} for AeroSpace Industries; production started (Science Victory Focus).`);
        } else {
          // Never interrupts the current build — queued ahead of routine work.
          this.productionSystem.enqueueFront(plan.cityId, corporationItem);
          this.logForcedScienceVictory(nationId, `queued AeroSpace Industries at the front in ${cityName(plan.cityId)}; builds after the current item (not blocked by routine production).`);
        }
        return;
      }
      case 'deferFounding':
        this.logForcedScienceVictory(nationId, `AeroSpace Industries deferred: ${plan.reason}.`);
        return;
      case 'produceAerospaceParts': {
        const item: Producible = { kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION };
        if (plan.immediate) {
          for (const cityId of plan.cityIds) this.productionSystem.setProduction(cityId, item);
        } else {
          const cityId = plan.cityIds[0];
          if (!cityId) return;
          this.productionSystem.enqueueFront(cityId, item);
          this.logForcedScienceVictory(
            nationId,
            `reprioritized eligible busy city ${cityName(cityId)} for an Aerospace Part; inserted at the front of its queue (Science Victory Focus).`,
          );
          return;
        }
        this.logForcedScienceVictory(
          nationId,
          `prioritized ${plan.cityIds.length} Aerospace Part slot(s) in idle cities; progress ${accumulatedParts}/${requiredParts}.`,
        );
        return;
      }
      case 'none':
        return;
    }
  }

  private logForcedScienceVictory(nationId: string, message: string): void {
    if (this.forcedScienceVictoryStateByNation.get(nationId) === message) return; // dedupe unchanged state
    this.forcedScienceVictoryStateByNation.set(nationId, message);
    this.logScienceVictoryAI(nationId, message);
  }

  private canCityBuildBuilding(city: City, nationId: string, building: BuildingType): boolean {
    if (!this.canBuildBuilding(nationId, building.id)) return false;
    if (building.placement === 'city') return true;
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
      if (this.isScienceBuilding(candidate)) continue;
      if (!cheapest || candidate.productionCost < cheapest.productionCost) {
        cheapest = candidate;
      }
    }
    return cheapest;
  }

  private findMissingScienceBuilding(
    nationId: string,
    buildings: CityBuildings,
  ): BuildingType | null {
    let best: BuildingType | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of ALL_BUILDINGS) {
      if (buildings.has(candidate.id)) continue;
      if (!this.canBuildBuilding(nationId, candidate.id)) continue;
      if (!this.isScienceBuilding(candidate)) continue;

      const score = this.getScienceBuildingProductionScore(candidate) - candidate.productionCost / 20;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
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

  private isScienceBuilding(candidate: BuildingType): boolean {
    const modifiers = candidate.modifiers;
    return (modifiers.sciencePerTurn ?? 0) > 0 || (modifiers.sciencePercent ?? 0) > 0;
  }

  private getScienceBuildingProductionScore(buildingType: BuildingType): number {
    const modifiers = buildingType.modifiers;
    return SCORE_SCIENCE_BUILDING
      + (modifiers.sciencePerTurn ?? 0) * 12
      + (modifiers.sciencePercent ?? 0) * 2;
  }

  private pickBestAvailableWorldWonder(
    city: City,
    nationId: string,
    eraStrategy: AILeaderEraStrategy,
  ): WonderType | null {
    if (!this.wonderSystem || !this.wonderPlacementSystem) return null;
    // True-disable gate only: a wonder weight of exactly 0 (or negative) means
    // this leader/era never builds wonders. Default/neutral leaders (weight ~1)
    // are NOT hard-gated here — they compete via the weighted production scoring
    // (scoreAIProductionCandidate multiplies the wonder candidate by both the
    // strategy and era wonder weight), so higher-bias leaders still prefer
    // wonders while normal nations may pick one when it scores well.
    if ((eraStrategy.productionWeights.wonder ?? 1) <= 0) return null;

    let best: WonderType | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const wonder of ALL_WONDERS) {
      if (!this.wonderSystem.canCityBuildWonder(city, wonder, { researchSystem: this.researchSystem })) continue;
      if (this.isWonderQueuedByNation(wonder.id, nationId)) continue;
      if (this.wonderPlacementSystem.getValidPlacementCoords(city, wonder, this.mapData).length === 0) continue;

      const score = this.getWorldWonderProductionScore(wonder) - wonder.productionCost / 30;
      if (score > bestScore) {
        best = wonder;
        bestScore = score;
      }
    }
    return best;
  }

  private isWonderQueuedByNation(wonderId: string, nationId: string): boolean {
    return this.cityManager.getAllCities().some((city) => (
      city.ownerId === nationId
      && this.productionSystem.getQueue(city.id)
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
    if (item.kind === 'manufacturedResource') return 'science victory';
    if (item.kind === 'tradeRoute') return 'infrastructure';
    if (item.kind === 'project') return 'consolidation';
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
    if (item.kind === 'manufacturedResource') return item.productionType.name;
    if (item.kind === 'tradeRoute') return item.displayName;
    if (item.kind === 'project') return item.projectType.name;
    return item.buildingType.name;
  }

  private needsDefender(city: City, nationId: string, doctrine?: AIMilitaryDoctrine): boolean {
    const cityPos = { x: city.tileX, y: city.tileY };
    const tilesToCheck = [cityPos, ...this.gridSystem.getAdjacentCoords(cityPos)];

    for (const pos of tilesToCheck) {
      const unit = this.unitManager.getUnitAt(pos.x, pos.y);
      if (
        unit &&
        unit.ownerId === nationId &&
        unit.unitType.baseStrength > 0
      ) return false;
    }

    // For maritime doctrines, a ranged naval unit within its attack range of a
    // coastal city counts as a defender — a warship parked offshore satisfies
    // the "city needs defender" pressure without requiring a land garrison.
    if (doctrine && isMaritimeDoctrine(doctrine) && this.isCoastalFoundingTile(city.tileX, city.tileY)) {
      for (const unit of this.unitManager.getUnitsByOwner(nationId)) {
        if (unit.unitType.isNaval && (unit.unitType.rangedStrength ?? 0) > 0) {
          const dist = this.gridSystem.getDistance(cityPos, { x: unit.tileX, y: unit.tileY });
          if (dist <= (unit.unitType.range ?? 1)) return false;
        }
      }
    }

    return true;
  }

  private canBuildRoutineCityDefenderForCity(
    city: City,
    nationId: string,
    militaryCount: number,
    effectiveMilitaryMax: number,
  ): boolean {
    const hasEmergencyThreat = this.getEmergencyCityThreats(nationId)
      .some((threat) => threat.city.id === city.id);
    const upkeep = this.unitUpkeepSystem?.calculateUpkeep(nationId);
    const structuralNetIncome = upkeep === undefined
      ? Number.POSITIVE_INFINITY
      : this.nationManager.getResources(nationId).goldPerTurn - upkeep;
    const allowed = canBuildRoutineCityDefender({
      isEconomicCrisis:
        this.consolidationSystem?.isConsolidating(nationId) === true
        && this.consolidationSystem.getReason(nationId) === 'economicCrisis',
      structuralNetIncome,
      militaryCount,
      effectiveMilitaryMax,
      hasEmergencyThreat,
    });
    const logKey = `${nationId}:${city.id}`;

    if (allowed) {
      this.routineDefenderSuppressionLoggedCityIds.delete(logKey);
      return true;
    }

    if (!this.routineDefenderSuppressionLoggedCityIds.has(logKey)) {
      this.routineDefenderSuppressionLoggedCityIds.add(logKey);
      const message = `${city.name} routine defender production suppressed: economic crisis, negative structural income, at/over effective military max, no emergency threat.`;
      console.log(this.formatLog(nationId, message));
      this.logStrategicEvent?.(nationId, message);
    }
    return false;
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

  private isCargoUnit(unit: Unit): boolean {
    return unit.carriedByUnitId !== undefined;
  }
}
