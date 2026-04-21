/**
 * Explicit JSON shape used to save/restore a running game.
 *
 * Every field is a primitive or plain object — no class instances, Phaser
 * references, DOM nodes, or function references. The format is versioned
 * so future changes can be detected and rejected cleanly.
 */

export const SAVED_GAME_VERSION = 1 as const;

export interface SavedProducible {
  kind: 'unit' | 'building';
  id: string;
}

export interface SavedQueueEntry {
  item: SavedProducible;
  accumulated: number;
  blockedReason?: string;
}

export interface SavedNation {
  id: string;
  isHuman: boolean;
  researchedTechIds: string[];
  currentResearchTechId?: string;
  researchProgress: number;
  gold: number;
  culture: number;
}

export interface SavedCity {
  id: string;
  name: string;
  ownerId: string;
  tileX: number;
  tileY: number;
  isCapital: boolean;
  health: number;
  population: number;
  foodStorage: number;
  culture: number;
  ownedTileCoords?: Array<{ x: number; y: number }>;
  workedTileCoords?: Array<{ x: number; y: number }>;
  nextExpansionTileCoord?: { x: number; y: number };
  lastTurnAttacked: number | null;
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
  transportId?: string;
  isSleeping: boolean;
}

export interface SavedTile {
  q: number;
  r: number;
  ownerId?: string;
  improvementId?: string;
}

export interface SavedDiplomacyEntry {
  nationA: string;
  nationB: string;
  state: 'WAR' | 'PEACE';
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
}
