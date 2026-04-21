import type { MapData } from '../types/map';
import type {
  SavedCity,
  SavedDiplomacyEntry,
  SavedDiscoveryEntry,
  SavedGameState,
  SavedNation,
  SavedQueueEntry,
  SavedTile,
  SavedUnit,
} from '../types/saveGame';
import { SAVED_GAME_VERSION } from '../types/saveGame';
import { ALL_BUILDINGS, getBuildingById } from '../data/buildings';
import { getUnitTypeById } from '../data/units';
import type { Producible } from '../types/producible';
import type { CityManager } from './CityManager';
import type { DiplomacyManager } from './DiplomacyManager';
import type { DiscoverySystem } from './DiscoverySystem';
import type { NationManager } from './NationManager';
import type { ProductionSystem } from './ProductionSystem';
import type { TurnManager } from './TurnManager';
import type { UnitManager } from './UnitManager';
import type { QueueEntry } from './ProductionSystem';
import type { IGridSystem } from './grid/IGridSystem';
import { CityTerritorySystem } from './CityTerritorySystem';

export interface SaveLoadContext {
  mapKey: string;
  humanNationId: string;
  activeNationIds: string[];
  mapData: MapData;
  nationManager: NationManager;
  cityManager: CityManager;
  unitManager: UnitManager;
  productionSystem: ProductionSystem;
  diplomacyManager: DiplomacyManager;
  discoverySystem: DiscoverySystem;
  turnManager: TurnManager;
  gridSystem: IGridSystem;
}

/**
 * Result returned by {@link SaveLoadService.parse}. Keeps error handling
 * explicit so callers can show a clean failure message without throwing.
 */
export type SaveParseResult =
  | { ok: true; state: SavedGameState }
  | { ok: false; error: string };

/**
 * Serializer/deserializer for a running game session.
 *
 * The service intentionally touches managers through small restoration
 * helpers rather than mutating private fields directly. This keeps each
 * system's invariants intact and makes future format migrations easier.
 */
export class SaveLoadService {
  /** Build a {@link SavedGameState} snapshot from live managers. */
  static serialize(context: SaveLoadContext): SavedGameState {
    const {
      mapKey,
      humanNationId,
      activeNationIds,
      mapData,
      nationManager,
      cityManager,
      unitManager,
      productionSystem,
      diplomacyManager,
      discoverySystem,
      turnManager,
    } = context;

    const nations: SavedNation[] = nationManager.getAllNations().map((nation) => {
      const res = nationManager.getResources(nation.id);
      return {
        id: nation.id,
        isHuman: nation.isHuman,
        researchedTechIds: [...nation.researchedTechIds],
        currentResearchTechId: nation.currentResearchTechId,
        researchProgress: nation.researchProgress,
        gold: res.gold,
        culture: res.culture,
      };
    });

    const cities: SavedCity[] = cityManager.getAllCities().map((city) => {
      const queue = productionSystem.getQueue(city.id);
      const buildings = cityManager.getBuildings(city.id).getAll();

      const productionQueue: SavedQueueEntry[] = queue.map((view) => ({
        item: toSavedProducible(view.item),
        accumulated: view.progress,
        blockedReason: view.blockedReason,
      }));

      return {
        id: city.id,
        name: city.name,
        ownerId: city.ownerId,
        tileX: city.tileX,
        tileY: city.tileY,
        isCapital: city.isCapital,
        health: city.health,
        population: city.population,
        foodStorage: city.foodStorage,
        culture: city.culture,
        ownedTileCoords: city.ownedTileCoords.map((coord) => ({ ...coord })),
        workedTileCoords: city.workedTileCoords.map((coord) => ({ ...coord })),
        nextExpansionTileCoord: city.nextExpansionTileCoord
          ? { ...city.nextExpansionTileCoord }
          : undefined,
        lastTurnAttacked: city.lastTurnAttacked,
        buildings,
        productionQueue,
      };
    });

    const units: SavedUnit[] = unitManager.getAllUnits().map((unit) => ({
      id: unit.id,
      name: unit.name,
      ownerId: unit.ownerId,
      unitTypeId: unit.unitType.id,
      tileX: unit.tileX,
      tileY: unit.tileY,
      health: unit.health,
      movementPoints: unit.movementPoints,
      transportId: unit.transportId,
      isSleeping: unit.isSleeping,
    }));

    const tiles: SavedTile[] = [];
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId === undefined && tile.improvementId === undefined) continue;
        tiles.push({
          q: tile.x,
          r: tile.y,
          ownerId: tile.ownerId,
          improvementId: tile.improvementId,
        });
      }
    }

    const diplomacy: SavedDiplomacyEntry[] = diplomacyManager.getAllStates().map((entry) => ({
      nationA: entry.keys[0],
      nationB: entry.keys[1],
      state: entry.state,
    }));

    const discovery: SavedDiscoveryEntry[] = discoverySystem.getAllMetPairs().map(([a, b]) => ({
      nationA: a,
      nationB: b,
    }));

    return {
      version: SAVED_GAME_VERSION,
      savedAt: new Date().toISOString(),
      mapKey,
      humanNationId,
      activeNationIds: [...activeNationIds],
      turn: {
        currentRound: turnManager.getCurrentRound(),
        currentTurnIndex: turnManager.getCurrentTurnIndex(),
      },
      tiles,
      nations,
      cities,
      units,
      diplomacy,
      discovery,
    };
  }

  /**
   * Parse JSON text into a SavedGameState. Returns a structured result
   * so callers can show a clean error message without try/catch.
   */
  static parse(json: string): SaveParseResult {
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch (err) {
      return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
    }
    return SaveLoadService.validate(data);
  }

  static validate(data: unknown): SaveParseResult {
    if (typeof data !== 'object' || data === null) {
      return { ok: false, error: 'Save file is not a JSON object.' };
    }
    const obj = data as Record<string, unknown>;
    if (obj.version !== SAVED_GAME_VERSION) {
      return {
        ok: false,
        error: `Unsupported save version ${String(obj.version)} (expected ${SAVED_GAME_VERSION}).`,
      };
    }
    const required = [
      'mapKey',
      'humanNationId',
      'activeNationIds',
      'turn',
      'tiles',
      'nations',
      'cities',
      'units',
      'diplomacy',
      'discovery',
    ];
    for (const key of required) {
      if (!(key in obj)) {
        return { ok: false, error: `Save file missing required field: ${key}` };
      }
    }
    return { ok: true, state: obj as unknown as SavedGameState };
  }

  /**
   * Apply a saved snapshot onto live managers. The scene is expected
   * to have already run its normal scenario-based initialization; this
   * call replaces runtime state with the saved values.
   *
   * Caller must refresh renderers and UI after this returns.
   */
  static apply(state: SavedGameState, context: SaveLoadContext): void {
    SaveLoadService.applyTiles(state.tiles, context.mapData);
    SaveLoadService.applyNations(state.nations, context.nationManager);
    SaveLoadService.applyCitiesAndProduction(
      state.cities,
      context.cityManager,
      context.productionSystem,
      context.mapData,
      context.gridSystem,
    );
    SaveLoadService.applyUnits(state.units, context.unitManager);
    SaveLoadService.applyDiplomacy(state.diplomacy, context.diplomacyManager);
    SaveLoadService.applyDiscovery(state.discovery, context.discoverySystem);
    context.turnManager.restoreTurnState(
      state.turn.currentRound,
      state.turn.currentTurnIndex,
    );
  }

  private static applyTiles(tiles: SavedTile[], mapData: MapData): void {
    for (const row of mapData.tiles) {
      for (const tile of row) {
        tile.ownerId = undefined;
        tile.improvementId = undefined;
      }
    }
    for (const saved of tiles) {
      const tile = mapData.tiles[saved.r]?.[saved.q];
      if (!tile) continue;
      if (saved.ownerId !== undefined) tile.ownerId = saved.ownerId;
      if (saved.improvementId !== undefined) tile.improvementId = saved.improvementId;
    }
  }

  private static applyNations(nations: SavedNation[], nationManager: NationManager): void {
    for (const saved of nations) {
      const nation = nationManager.getNation(saved.id);
      if (!nation) continue;
      nation.researchedTechIds = [...saved.researchedTechIds];
      nation.currentResearchTechId = saved.currentResearchTechId;
      nation.researchProgress = saved.researchProgress;

      const res = nationManager.getResources(saved.id);
      res.gold = saved.gold;
      res.culture = saved.culture;
    }
  }

  private static applyCitiesAndProduction(
    cities: SavedCity[],
    cityManager: CityManager,
    productionSystem: ProductionSystem,
    mapData: MapData,
    gridSystem: IGridSystem,
  ): void {
    cityManager.clearAllSilently();
    productionSystem.clearAllQueues();
    const cityTerritorySystem = new CityTerritorySystem();

    for (const saved of cities) {
      const city = cityManager.restoreCity({
        id: saved.id,
        name: saved.name,
        ownerId: saved.ownerId,
        tileX: saved.tileX,
        tileY: saved.tileY,
        isCapital: saved.isCapital,
        health: saved.health,
        population: saved.population,
        foodStorage: saved.foodStorage,
        culture: saved.culture,
        lastTurnAttacked: saved.lastTurnAttacked,
      });

      if (saved.ownedTileCoords && saved.ownedTileCoords.length > 0) {
        city.ownedTileCoords = saved.ownedTileCoords.map((coord) => ({ ...coord }));
      } else {
        cityTerritorySystem.initializeOwnedTiles(city, mapData, gridSystem);
      }

      if (saved.workedTileCoords && saved.workedTileCoords.length > 0) {
        city.workedTileCoords = saved.workedTileCoords.map((coord) => ({ ...coord }));
      } else {
        cityTerritorySystem.updateWorkedTiles(city, mapData);
      }

      if (saved.nextExpansionTileCoord) {
        city.nextExpansionTileCoord = { ...saved.nextExpansionTileCoord };
      }
      cityTerritorySystem.refreshNextExpansionTile(city, mapData);

      const buildings = cityManager.getBuildings(saved.id);
      for (const id of saved.buildings) {
        const def = getBuildingById(id) ?? ALL_BUILDINGS.find((b) => b.id === id);
        if (def) buildings.add(def);
      }

      const queueEntries: QueueEntry[] = [];
      for (const entry of saved.productionQueue) {
        const producible = fromSavedProducible(entry.item);
        if (!producible) continue;
        queueEntries.push({
          item: producible,
          accumulated: entry.accumulated,
          blockedReason: entry.blockedReason,
        });
      }
      productionSystem.restoreQueue(saved.id, queueEntries);
    }
  }

  private static applyUnits(units: SavedUnit[], unitManager: UnitManager): void {
    unitManager.clearAllSilently();

    for (const saved of units) {
      const type = getUnitTypeById(saved.unitTypeId);
      if (!type) {
        console.warn(`[SaveLoadService] Unknown unit type: ${saved.unitTypeId}`);
        continue;
      }
      unitManager.restoreUnit({
        id: saved.id,
        name: saved.name,
        ownerId: saved.ownerId,
        tileX: saved.tileX,
        tileY: saved.tileY,
        unitType: type,
        health: saved.health,
        movementPoints: saved.movementPoints,
        transportId: saved.transportId,
        isSleeping: saved.isSleeping,
      });
    }
  }

  private static applyDiplomacy(
    entries: SavedDiplomacyEntry[],
    diplomacyManager: DiplomacyManager,
  ): void {
    diplomacyManager.resetAll();
    for (const entry of entries) {
      diplomacyManager.restoreState(entry.nationA, entry.nationB, entry.state);
    }
  }

  private static applyDiscovery(
    entries: SavedDiscoveryEntry[],
    discoverySystem: DiscoverySystem,
  ): void {
    for (const entry of entries) {
      discoverySystem.restoreMet(entry.nationA, entry.nationB);
    }
  }
}

function toSavedProducible(item: Producible): { kind: 'unit' | 'building'; id: string } {
  return item.kind === 'unit'
    ? { kind: 'unit', id: item.unitType.id }
    : { kind: 'building', id: item.buildingType.id };
}

function fromSavedProducible(item: { kind: 'unit' | 'building'; id: string }): Producible | null {
  if (item.kind === 'unit') {
    const type = getUnitTypeById(item.id);
    return type ? { kind: 'unit', unitType: type } : null;
  }
  const def = getBuildingById(item.id);
  return def ? { kind: 'building', buildingType: def } : null;
}
