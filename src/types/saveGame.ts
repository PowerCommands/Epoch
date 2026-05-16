import type { GameSpeedId } from '../data/gameSpeeds';
import type { CityFocusType } from '../entities/City';
import type { CityProductionRhythm } from '../entities/City';
import type { ActivePolicyAssignment } from '../entities/NationPolicies';
import type { AINationalAgendaId } from './aiNationalAgenda';
import type { TradeDeal } from './tradeDeal';
import type { ExileProtectionAgreement } from '../systems/ExileProtectionSystem';
import type { WorldMarker, WorldMarkerDiscoveryEntry } from './WorldMarker';
import type { OverseasSettlementTarget } from './ai/OverseasSettlementTarget';

/**
 * Explicit JSON shape used to save/restore a running game.
 *
 * Every field is a primitive or plain object — no class instances, Phaser
 * references, DOM nodes, or function references. The format is versioned
 * so future changes can be detected and rejected cleanly.
 */

export const SAVED_GAME_VERSION = 4 as const;

export interface SavedProducible {
  kind: 'unit' | 'building' | 'wonder' | 'corporation';
  id: string;
}

export interface SavedWonder {
  wonderId: string;
  cityId: string;
  ownerId: string;
  tileX?: number;
  tileY?: number;
  completedTurn: number;
}

export interface SavedCorporation {
  corporationId: string;
  founderNationId: string;
  cityId?: string;
  foundedTurn: number;
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
  buildings: string[];
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
  improvementCharges?: number;
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
  lastWarDeclarationTurn?: number | null;
  lastPeaceProposalTurn?: number | null;
  lastOpenBordersChangeTurn?: number | null;
  lastEmbassyChangeTurn?: number | null;
  lastTradeRelationsChangeTurn?: number | null;
  /** @deprecated renamed to lastWarDeclarationTurn. */
  lastWarTurn?: number | null;
  /** @deprecated renamed to lastPeaceProposalTurn. */
  lastPeaceTurn?: number | null;
}

export interface SavedDiscoveryEntry {
  nationA: string;
  nationB: string;
}

export interface SavedGameState {
  version: typeof SAVED_GAME_VERSION;
  savedAt: string;
  mapKey: string;
  humanNationId: string;
  activeNationIds: string[];
  gameSpeedId?: GameSpeedId;
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
  wonders: SavedWonder[];
  corporations?: SavedCorporation[];
  tradeDeals?: TradeDeal[];
  exileProtectionAgreements?: ExileProtectionAgreement[];
  worldMarkers?: WorldMarker[];
  worldMarkerDiscoveries?: WorldMarkerDiscoveryEntry[];
}
