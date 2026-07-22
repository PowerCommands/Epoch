import type { GameSpeedId } from '../data/gameSpeeds';
import type { Alliance } from './alliance';
import type { CityFocusType } from '../entities/City';
import type { CityProductionRhythm } from '../entities/City';
import type { ActivePolicyAssignment } from '../entities/NationPolicies';
import type { AINationalAgendaId } from './aiNationalAgenda';
import type { CovertPersonalityId } from './covertPersonality';
import type { TradeDeal } from './tradeDeal';
import type { TradeConnection } from './tradeConnection';
import type { HistoricalEvent } from './historicalTimeline';
import type { SavedTradeHistoryEntry } from '../systems/diplomacy/TradeDiplomacySystem';
import type { WorldMarker, WorldMarkerClaimEntry, WorldMarkerDiscoveryEntry } from './WorldMarker';
import type { OverseasSettlementTarget } from './ai/OverseasSettlementTarget';
import type { WorldCouncilState } from './worldCouncil';

/**
 * Explicit JSON shape used to save/restore a running game.
 *
 * Every field is a primitive or plain object — no class instances, Phaser
 * references, DOM nodes, or function references. The format is versioned
 * so future changes can be detected and rejected cleanly.
 */

export const SAVED_GAME_VERSION = 4 as const;

export interface SavedProducible {
  kind: 'unit' | 'building' | 'wonder' | 'corporation' | 'manufacturedResource' | 'tradeRoute';
  id: string;
  /** Extra fields for tradeRoute queue entries. Optional for backward compat. */
  fromCityId?: string;
  toCityId?: string;
  targetNationId?: string;
  displayName?: string;
}

export interface SavedBuilding {
  buildingId: string;
  broken?: boolean;
}

export interface SavedWonder {
  wonderId: string;
  cityId: string;
  ownerId: string;
  tileX?: number;
  tileY?: number;
  completedTurn: number;
  broken?: boolean;
}

export interface SavedCorporation {
  corporationId: string;
  founderNationId: string;
  cityId?: string;
  foundedTurn: number;
}

export interface SavedAerospacePartProgress {
  nationId: string;
  quantity: number;
}

export interface SavedQueueEntry {
  item: SavedProducible;
  accumulated: number;
  blockedReason?: string;
  placement?: {
    tileX: number;
    tileY: number;
  };
}

export interface SavedNation {
  id: string;
  isHuman: boolean;
  aiStrategyId?: string;
  aiStrategyStartedTurn?: number;
  previousAiStrategyId?: string;
  aiNationalAgendaId?: AINationalAgendaId;
  /** Covert-warfare personality. Optional so older saves load (→ leader/neutral default). */
  covertPersonalityId?: CovertPersonalityId;
  researchedTechIds: string[];
  currentResearchTechId?: string;
  researchProgress: number;
  unlockedCultureNodeIds?: string[];
  currentCultureNodeId?: string;
  cultureProgress?: number;
  activePolicies?: ActivePolicyAssignment[];
  gold: number;
  culture: number;
  influence?: number;
  knownIslandTargets?: OverseasSettlementTarget[];
  handledOverseasRegionNames?: string[];
}

export interface SavedCity {
  id: string;
  name: string;
  ownerId: string;
  tileX: number;
  tileY: number;
  isCapital: boolean;
  originNationId: string;
  isOriginalCapital: boolean;
  isResidenceCapital: boolean;
  occupiedOriginalNationId?: string;
  focus?: CityFocusType;
  productionRhythm?: CityProductionRhythm;
  health: number;
  population: number;
  foodStorage: number;
  culture: number;
  culturalSphereProgress?: number;
  ownedTileCoords?: Array<{ x: number; y: number }>;
  workedTileCoords?: Array<{ x: number; y: number }>;
  nextExpansionTileCoord?: { x: number; y: number };
  lastTurnAttacked: number | null;
  lastTilePurchaseTurn?: number;
  recentlyConqueredTurnsRemaining?: number;
  integrationStartedRound?: number;
  // Backward-compatible: old saves store plain building ids; newer saves may
  // store objects carrying broken state. Strings load as working (not broken).
  buildings: Array<string | SavedBuilding>;
  productionQueue: SavedQueueEntry[];
}

export interface SavedUnit {
  id: string;
  name: string;
  ownerId: string;
  unitTypeId: string;
  tileX: number;
  tileY: number;
  health: number;
  movementPoints: number;
  createdRound?: number;
  expiresAtRound?: number;
  queuedDestination?: { x: number; y: number };
  improvementCharges?: number;
  carriedByUnitId?: string;
  cargoUnitIds?: string[];
  /** Legacy save-load migration field. Runtime Unit state uses carriedByUnitId. */
  transportId?: string;
  isSleeping: boolean;
  // Optional in older saves; absent values are derived from isSleeping +
  // tile.improvementConstruction at load time.
  actionStatus?: 'active' | 'sleep' | 'building';
  buildAction?: {
    improvementId: string;
    tileX: number;
    tileY: number;
    progress: number;
    requiredProgress: number;
  };
  /** Player-enabled automation (e.g. auto-explore). Absent in older saves. */
  automation?: 'explore';
}

export interface SavedTile {
  q: number;
  r: number;
  ownerId?: string;
  resourceOwnerNationId?: string;
  resourceId?: string;
  improvementId?: string;
  improvementConstruction?: {
    improvementId: string;
    cityId?: string;
    unitId: string;
    ownerId: string;
    resourceOwnerNationId?: string;
    remainingTurns: number;
    totalTurns: number;
  };
  buildingId?: string;
  buildingBroken?: boolean;
  buildingConstruction?: {
    buildingId: string;
    cityId: string;
  };
  wonderId?: string;
  wonderConstruction?: {
    wonderId: string;
    cityId: string;
  };
  // Culture layer is independent from territory ownership. Older saves
  // omit these fields; loading must accept their absence.
  cultureOwnerId?: string;
  cultureSourceCityId?: string;
}

export interface SavedDiplomacyEntry {
  nationA: string;
  nationB: string;
  state: 'WAR' | 'PEACE';
  /**
   * @deprecated Symmetric flag from older saves. Newer saves use the
   * directional fields below; kept optional so older payloads still load.
   */
  openBorders?: boolean;
  openBordersFromAToB?: boolean;
  openBordersFromBToA?: boolean;
  embassyFromAToB?: boolean;
  embassyFromBToA?: boolean;
  tradeRelations?: boolean;
  // New fields are optional so saves written before the diplomatic memory
  // groundwork still load cleanly. Missing values fall back to defaults.
  trust?: number;
  fear?: number;
  hostility?: number;
  affinity?: number;
  // Optional so saves written before suspicion existed still load (defaults to 0).
  suspicion?: number;
  lastWarDeclarationTurn?: number | null;
  lastPeaceProposalTurn?: number | null;
  lastOpenBordersChangeTurn?: number | null;
  lastEmbassyChangeTurn?: number | null;
  lastTradeRelationsChangeTurn?: number | null;
  peaceTreatyUntilTurn?: number | null;
  /** @deprecated renamed to lastWarDeclarationTurn. */
  lastWarTurn?: number | null;
  /** @deprecated renamed to lastPeaceProposalTurn. */
  lastPeaceTurn?: number | null;
  // War exhaustion counters — optional so older saves load cleanly.
  militaryUnitsLostA?: number;
  militaryUnitsLostB?: number;
  citiesLostA?: number;
  citiesLostB?: number;
  militaryStrengthAtWarStartA?: number;
  militaryStrengthAtWarStartB?: number;
}

export interface SavedDiscoveryEntry {
  nationA: string;
  nationB: string;
}

/**
 * One-time symbolic-gift milestones. `givers` holds directed `${from}->${to}`
 * keys (a nation has presented its gift); `reciprocated` holds unordered
 * `${a}|${b}` pair keys (the first-meeting courtesy has been exchanged).
 */
export interface SavedSymbolicGifts {
  givers: string[];
  reciprocated: string[];
}

export interface SavedForeignTroopViolationWarning {
  offendedNationId: string;
  violatingNationId: string;
  firstWarningRound: number;
  lastSeenRound: number;
  unitCount: number;
}

export interface SavedGameState {
  version: typeof SAVED_GAME_VERSION;
  savedAt: string;
  worldYear?: number;
  mapKey: string;
  humanNationId: string;
  activeNationIds: string[];
  gameSpeedId?: GameSpeedId;
  /**
   * Enabled victory conditions for the session. Optional so pre-feature saves
   * still load; loaders must default a missing field to all three enabled
   * (domination, science, cultural) to preserve historical behavior.
   */
  victoryConditions?: SavedVictoryConditions;
  turn: {
    currentRound: number;
    currentTurnIndex: number;
  };
  tiles: SavedTile[];
  nations: SavedNation[];
  cities: SavedCity[];
  units: SavedUnit[];
  diplomacy: SavedDiplomacyEntry[];
  discovery: SavedDiscoveryEntry[];
  /** One-time symbolic-gift milestones. Optional so pre-feature saves still load. */
  symbolicGifts?: SavedSymbolicGifts;
  wonders: SavedWonder[];
  /** Global World Council institution. Optional so older saves load with none. */
  worldCouncil?: WorldCouncilState;
  /** Alliance Core v1. Optional so older saves load with no alliances. */
  alliances?: Alliance[];
  corporations?: SavedCorporation[];
  /** Accumulated, deliberately manufactured Science Victory parts. */
  aerospaceParts?: SavedAerospacePartProgress[];
  tradeDeals?: TradeDeal[];
  tradeConnections?: TradeConnection[];
  tradeHistory?: SavedTradeHistoryEntry[];
  worldMarkers?: WorldMarker[];
  worldMarkerDiscoveries?: WorldMarkerDiscoveryEntry[];
  worldMarkerClaims?: WorldMarkerClaimEntry[];
  foreignTroopViolationWarnings?: SavedForeignTroopViolationWarning[];
  fogOfWar?: SavedFogOfWar;
  historicalTimeline?: HistoricalEvent[];
  /**
   * Repeated-offender memory for covert suspicion (per ordered attacker→victim
   * pair). Optional so older saves load cleanly (treated as no prior incidents).
   */
  covertIncidents?: SavedCovertIncident[];
}

/** Persisted enabled-state of each implemented victory type. */
export interface SavedVictoryConditions {
  domination: boolean;
  science: boolean;
  scienceRequiredAerospaceParts?: number;
  cultural: boolean;
  diplomatic?: boolean;
}

/** One attacker→victim covert offense tally for repeated-offender escalation. */
export interface SavedCovertIncident {
  attacker: string;
  victim: string;
  count: number;
}

/** Sparse list of tiles the human player has explored or seen. */
export interface SavedFogOfWar {
  explored: Array<{ q: number; r: number }>;
  /** Ids of cities the human has permanently discovered (intelligence). */
  knownCityIds?: string[];
}
