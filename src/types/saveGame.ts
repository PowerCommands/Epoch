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
import type { SavedNewspaperState } from './newspaper';
import type { SavedGamesOfNationsState } from './gamesOfNations';
import type { SavedTradeHistoryEntry } from '../systems/diplomacy/TradeDiplomacySystem';
import type { WorldMarker, WorldMarkerClaimEntry, WorldMarkerDiscoveryEntry } from './WorldMarker';
import type { OverseasSettlementTarget } from './ai/OverseasSettlementTarget';
import type { WorldCouncilState } from './worldCouncil';
import type { SavedCapitulationState } from '../systems/CapitulationSystem';
import type { SavedGossipState } from './gossip';
import type { SavedGossipFlavorState } from './gossipFlavor';
import type { GeneratedScenarioSnapshot } from '../systems/procedural/RandomScenarioTypes';
import type { SavedScenarioHistoricalEventsState } from '../systems/ScenarioHistoricalEventSystem';
import type { SavedReconciliationTurningPointState } from '../systems/diplomacy/ReconciliationTurningPointSystem';
import type { SavedLuckyLoserTurningPointState } from '../systems/diplomacy/LuckyLoserTurningPointSystem';
import type { PeaceProposal, VassalRelationship } from '../systems/DiplomacyManager';
import type { SavedJointWarEscalation } from './jointWar';
import type { AIVictoryFocusState } from './aiVictoryFocus';

/**
 * Explicit JSON shape used to save/restore a running game.
 *
 * Every field is a primitive or plain object — no class instances, Phaser
 * references, DOM nodes, or function references. The format is versioned
 * so future changes can be detected and rejected cleanly.
 */

export const SAVED_GAME_VERSION = 4 as const;

export interface SavedProducible {
  kind: 'unit' | 'building' | 'wonder' | 'corporation' | 'manufacturedResource' | 'project' | 'tradeRoute';
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
  /** Base production cost locked when the item was queued. */
  lockedProductionCost?: number;
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
  /** Settlers historically completed through production. Optional for older saves. */
  settlersProduced?: number;
  /** Active AI endgame strategy. Optional for saves predating Victory Focus. */
  aiVictoryFocus?: AIVictoryFocusState;
  /** Active Cultural Jealousy target. Optional for saves predating the agenda. */
  culturalJealousyTargetId?: string;
  /** Turn the nation last founded a city; drives the AI expansion cooldown. */
  lastCityFoundedTurn?: number;
  activePolicies?: ActivePolicyAssignment[];
  gold: number;
  culture: number;
  influence?: number;
  knownIslandTargets?: OverseasSettlementTarget[];
  handledOverseasRegionNames?: string[];
  /** AI Consolidation Mode state. Optional; absent means not consolidating. */
  consolidation?: SavedConsolidationState;
}

/** Persisted AI Consolidation Mode state for a single nation. */
export interface SavedConsolidationState {
  reason: 'postWar' | 'economicCrisis';
  startedTurn: number;
  /** Earliest turn consolidation may end (minimum-duration guard). */
  minimumUntilTurn: number;
  /** Whether the "minimum reached but economy still negative" line was logged. */
  loggedMinimumReached?: boolean;
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
  /** Elapsed owner turns in an active energy shortage. */
  energyShortageTurns?: number;
  culture: number;
  culturalSphereProgress?: number;
  ownedTileCoords?: Array<{ x: number; y: number }>;
  workedTileCoords?: Array<{ x: number; y: number }>;
  nextExpansionTileCoord?: { x: number; y: number };
  lastTurnAttacked: number | null;
  lastTilePurchaseTurn?: number;
  recentlyConqueredTurnsRemaining?: number;
  integrationStartedRound?: number;
  /** Age of the city's canonical power plant. Optional for pre-system saves. */
  powerPlantAge?: number;
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
  /** Optional for saves created before improvements had explicit economic ownership. */
  improvementOwnerId?: string;
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
  /** Directional foreign-resource exploitation grants; optional for older saves. */
  exploitationRightsFromAToB?: boolean;
  exploitationRightsFromBToA?: boolean;
  embassyFromAToB?: boolean;
  embassyFromBToA?: boolean;
  tradeRelations?: boolean;
  // Directional Economic Pressure (None → Tariffs → Boycott → Embargo) and the
  // turn it was imposed. Optional so saves predating the feature load as "no
  // active Economic Pressure".
  economicPressureFromAToB?: 'tariffs' | 'boycott' | 'embargo' | null;
  economicPressureFromAToBTurn?: number | null;
  economicPressureFromAToBRemovalOfferPresented?: boolean;
  economicPressureFromBToA?: 'tariffs' | 'boycott' | 'embargo' | null;
  economicPressureFromBToATurn?: number | null;
  economicPressureFromBToARemovalOfferPresented?: boolean;
  // New fields are optional so saves written before the diplomatic memory
  // groundwork still load cleanly. Missing values fall back to defaults.
  trust?: number;
  fear?: number;
  hostility?: number;
  affinity?: number;
  // Optional so saves written before suspicion existed still load (defaults to 0).
  suspicion?: number;
  lastWarDeclarationTurn?: number | null;
  // Original aggressor of an active WAR. Optional so older saves load cleanly;
  // required for the AI war-timeout rule to survive a save/load roundtrip.
  aggressorNationId?: string;
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

/** Automatic progressive-guide cursor. Manual browsing is intentionally not persisted here. */
export interface SavedGuideProgress {
  nextAutomaticTipIndex: number;
  completedHumanTurns: number;
}

export interface SavedGameState {
  version: typeof SAVED_GAME_VERSION;
  savedAt: string;
  worldYear?: number;
  mapKey: string;
  /** Initial generated scenario, embedded so future generator changes cannot alter this save's geography. */
  generatedScenario?: GeneratedScenarioSnapshot;
  humanNationId: string;
  activeNationIds: string[];
  /** Explicit active leader ids by nation. Optional for older saves. */
  leaderSelections?: Record<string, string>;
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
  /** Optional so saves created before the progressive guide remain loadable. */
  guideProgress?: SavedGuideProgress;
  /** Consumed issue cursor. Optional so pre-newspaper saves remain loadable. */
  newspaper?: SavedNewspaperState;
  /** Global sporting lifecycle. Optional so pre-feature saves remain loadable. */
  gamesOfNations?: SavedGamesOfNationsState;
  tiles: SavedTile[];
  nations: SavedNation[];
  cities: SavedCity[];
  units: SavedUnit[];
  diplomacy: SavedDiplomacyEntry[];
  /** Persistent vassal -> host relationships. Optional for older saves. */
  vassalStates?: VassalRelationship[];
  /** Pending negotiated-peace offers, including AI offers awaiting a Human answer. */
  pendingPeaceProposals?: PeaceProposal[];
  /** Situation-scoped rejected AI Join War attempts; absent in older saves. */
  jointWarEscalations?: SavedJointWarEscalation[];
  discovery: SavedDiscoveryEntry[];
  /** One-time symbolic-gift milestones. Optional so pre-feature saves still load. */
  symbolicGifts?: SavedSymbolicGifts;
  /** Recipient-scoped manipulation cooldowns. Optional for older saves. */
  gossip?: SavedGossipState;
  /** Symmetric History-flavor noise cooldowns; mechanically independent from Gossip. */
  gossipFlavor?: SavedGossipFlavorState;
  wonders: SavedWonder[];
  /** Global World Council institution. Optional so older saves load with none. */
  worldCouncil?: WorldCouncilState;
  /** Per-nation demilitarization windows from capitulation. Optional for older saves. */
  capitulation?: SavedCapitulationState;
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
  /** Authored Historical Event lifecycle and runtime calendar anchors. */
  scenarioHistoricalEvents?: SavedScenarioHistoricalEventsState;
  /** One-shot Diplomatic Turning Point cursor. Optional for older saves. */
  reconciliationTurningPoint?: SavedReconciliationTurningPointState;
  /** One-shot Lucky Loser activation, retry cursor, and winner. */
  luckyLoserTurningPoint?: SavedLuckyLoserTurningPointState;
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
