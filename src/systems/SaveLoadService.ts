import type { MapData } from '../types/map';
import type {
  SavedCity,
  SavedDiplomacyEntry,
  SavedDiscoveryEntry,
  SavedGameState,
  SavedNation,
  SavedProducible,
  SavedQueueEntry,
  SavedTile,
  SavedUnit,
  SavedWonder,
  SavedCorporation,
} from '../types/saveGame';
import { SAVED_GAME_VERSION } from '../types/saveGame';
import { ALL_BUILDINGS, getBuildingById } from '../data/buildings';
import { getLegacyCompatibleUnitTypeById } from '../data/units';
import { getWonderById } from '../data/wonders';
import { getCorporationById } from '../data/corporations';
import type { Producible } from '../types/producible';
import type { CityManager } from './CityManager';
import type { City } from '../entities/City';
import type { DiplomacyManager } from './DiplomacyManager';
import type { DiscoverySystem } from './DiscoverySystem';
import type { NationManager } from './NationManager';
import type { ProductionSystem } from './ProductionSystem';
import type { PolicySystem } from './PolicySystem';
import type { TradeDealSystem } from './TradeDealSystem';
import type { ExileProtectionSystem } from './ExileProtectionSystem';
import type { WorldMarkerSystem } from './WorldMarkerSystem';
import type { TurnManager } from './TurnManager';
import type { UnitManager } from './UnitManager';
import type { WonderSystem } from './WonderSystem';
import type { CorporationSystem } from './CorporationSystem';
import type { QueueEntry } from './ProductionSystem';
import type { IGridSystem } from './grid/IGridSystem';
import { CityTerritorySystem } from './CityTerritorySystem';
import { CulturalSphereSystem } from './CulturalSphereSystem';
import { getGameSpeedById, type GameSpeedId } from '../data/gameSpeeds';
import { BASELINE_AI_STRATEGY_ID } from '../data/aiStrategies';
import { BALANCED_AGENDA_ID } from '../data/aiNationalAgendas';

export interface SaveLoadContext {
  mapKey: string;
  humanNationId: string;
  activeNationIds: string[];
  gameSpeedId: GameSpeedId;
  mapData: MapData;
  nationManager: NationManager;
  cityManager: CityManager;
  unitManager: UnitManager;
  productionSystem: ProductionSystem;
  policySystem: PolicySystem;
  diplomacyManager: DiplomacyManager;
  discoverySystem: DiscoverySystem;
  turnManager: TurnManager;
  gridSystem: IGridSystem;
  wonderSystem: WonderSystem;
  corporationSystem?: CorporationSystem;
  tradeDealSystem?: TradeDealSystem;
  exileProtectionSystem?: ExileProtectionSystem;
  worldMarkerSystem?: WorldMarkerSystem;
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
      gameSpeedId,
      mapData,
      nationManager,
      cityManager,
      unitManager,
      productionSystem,
      policySystem,
      diplomacyManager,
      discoverySystem,
      turnManager,
      wonderSystem,
      corporationSystem,
      tradeDealSystem,
      exileProtectionSystem,
      worldMarkerSystem,
    } = context;

    const nations: SavedNation[] = nationManager.getAllNations().map((nation) => {
      const res = nationManager.getResources(nation.id);
      return {
        id: nation.id,
        isHuman: nation.isHuman,
        aiStrategyId: nation.aiStrategyId,
        aiStrategyStartedTurn: nation.aiStrategyStartedTurn,
        previousAiStrategyId: nation.previousAiStrategyId,
        aiNationalAgendaId: nation.aiNationalAgendaId,
        researchedTechIds: [...nation.researchedTechIds],
        currentResearchTechId: nation.currentResearchTechId,
        researchProgress: nation.researchProgress,
        unlockedCultureNodeIds: [...nation.unlockedCultureNodeIds],
        currentCultureNodeId: nation.currentCultureNodeId,
        cultureProgress: nation.cultureProgress,
        activePolicies: policySystem.getActivePolicyAssignments(nation.id),
        gold: res.gold,
        culture: res.culture,
        influence: res.influence,
        knownIslandTargets: nation.knownIslandTargets?.map((target) => ({ ...target })),
        leaderEvacuationState: nation.leaderEvacuationState
          ? { ...nation.leaderEvacuationState }
          : undefined,
      };
    });

    const cities: SavedCity[] = cityManager.getAllCities().map((city) => {
      const queue = productionSystem.getQueue(city.id);
      const buildings = cityManager.getBuildings(city.id).getAll();

      const productionQueue: SavedQueueEntry[] = queue.map((view) => ({
        item: toSavedProducible(view.item),
        accumulated: view.progress,
        blockedReason: view.blockedReason,
        placement: view.placement ? { ...view.placement } : undefined,
      }));

      return {
        id: city.id,
        name: city.name,
        ownerId: city.ownerId,
        tileX: city.tileX,
        tileY: city.tileY,
        isCapital: city.isOriginalCapital,
        originNationId: city.originNationId,
        isOriginalCapital: city.isOriginalCapital,
        isResidenceCapital: city.isResidenceCapital,
        occupiedOriginalNationId: city.occupiedOriginalNationId,
        focus: city.focus === 'balanced' ? undefined : city.focus,
        productionRhythm: {
          completedUnitsSinceInfrastructure: city.productionRhythm.completedUnitsSinceInfrastructure,
          completedInfrastructureSinceUnit: city.productionRhythm.completedInfrastructureSinceUnit,
        },
        health: city.health,
        population: city.population,
        foodStorage: city.foodStorage,
        culture: city.culture,
        culturalSphereProgress: city.culturalSphereProgress,
        ownedTileCoords: city.ownedTileCoords.map((coord) => ({ ...coord })),
        workedTileCoords: city.workedTileCoords.map((coord) => ({ ...coord })),
        nextExpansionTileCoord: city.nextExpansionTileCoord
          ? { ...city.nextExpansionTileCoord }
          : undefined,
        lastTurnAttacked: city.lastTurnAttacked,
        lastTilePurchaseTurn: city.lastTilePurchaseTurn,
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
      improvementCharges: unit.improvementCharges,
      transportId: unit.transportId,
      isSleeping: unit.isSleeping,
      actionStatus: unit.actionStatus,
      buildAction: unit.buildAction ? { ...unit.buildAction } : undefined,
    }));

    const tiles: SavedTile[] = [];
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (
          tile.ownerId === undefined
          && tile.resourceOwnerNationId === undefined
          && tile.resourceId === undefined
          && tile.improvementId === undefined
          && tile.improvementConstruction === undefined
          && tile.buildingId === undefined
          && tile.buildingConstruction === undefined
          && tile.wonderId === undefined
          && tile.wonderConstruction === undefined
          && tile.cultureOwnerId === undefined
          && tile.cultureSourceCityId === undefined
        ) continue;
        tiles.push({
          q: tile.x,
          r: tile.y,
          ownerId: tile.ownerId,
          resourceOwnerNationId: tile.resourceOwnerNationId,
          resourceId: tile.resourceId,
          improvementId: tile.improvementId,
          improvementConstruction: tile.improvementConstruction
            ? { ...tile.improvementConstruction }
            : undefined,
          buildingId: tile.buildingId,
          buildingConstruction: tile.buildingConstruction
            ? { ...tile.buildingConstruction }
            : undefined,
          wonderId: tile.wonderId,
          wonderConstruction: tile.wonderConstruction
            ? { ...tile.wonderConstruction }
            : undefined,
          cultureOwnerId: tile.cultureOwnerId,
          cultureSourceCityId: tile.cultureSourceCityId,
        });
      }
    }

    const diplomacy: SavedDiplomacyEntry[] = diplomacyManager.getAllStates().map((entry) => ({
      nationA: entry.keys[0],
      nationB: entry.keys[1],
      state: entry.relation.state,
      openBordersFromAToB: entry.relation.openBordersFromAToB,
      openBordersFromBToA: entry.relation.openBordersFromBToA,
      embassyFromAToB: entry.relation.embassyFromAToB,
      embassyFromBToA: entry.relation.embassyFromBToA,
      tradeRelations: entry.relation.tradeRelations,
      trust: entry.relation.trust,
      fear: entry.relation.fear,
      hostility: entry.relation.hostility,
      affinity: entry.relation.affinity,
      lastWarDeclarationTurn: entry.relation.lastWarDeclarationTurn,
      lastPeaceProposalTurn: entry.relation.lastPeaceProposalTurn,
      lastOpenBordersChangeTurn: entry.relation.lastOpenBordersChangeTurn,
      lastEmbassyChangeTurn: entry.relation.lastEmbassyChangeTurn,
      lastTradeRelationsChangeTurn: entry.relation.lastTradeRelationsChangeTurn,
    }));

    const discovery: SavedDiscoveryEntry[] = discoverySystem.getAllMetPairs().map(([a, b]) => ({
      nationA: a,
      nationB: b,
    }));

    const wonders: SavedWonder[] = wonderSystem.getCompletedWonders().map((state) => ({
      wonderId: state.wonderId,
      cityId: state.cityId,
      ownerId: state.ownerId,
      tileX: state.tileX,
      tileY: state.tileY,
      completedTurn: state.completedTurn,
    }));

    const corporations: SavedCorporation[] = corporationSystem?.getFoundedCorporations().map((state) => ({
      corporationId: state.corporationId,
      founderNationId: state.founderNationId,
      cityId: state.cityId,
      foundedTurn: state.foundedTurn,
    })) ?? [];

    return {
      version: SAVED_GAME_VERSION,
      savedAt: new Date().toISOString(),
      mapKey,
      humanNationId,
      activeNationIds: nationManager.getAllNations().map((nation) => nation.id),
      gameSpeedId,
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
      wonders,
      corporations,
      tradeDeals: tradeDealSystem?.getAllDeals().map((deal) => ({ ...deal })),
      exileProtectionAgreements: exileProtectionSystem?.getAllAgreements(),
      worldMarkers: worldMarkerSystem?.getAllMarkers(),
      worldMarkerDiscoveries: worldMarkerSystem?.getDiscoveryEntries(),
    };
  }

  /**
   * Parse JSON text into a SavedGameState. Returns a structured result
   * so callers can show a clean error message without try/catch.
   */
  static parse(json: string): SaveParseResult {
    // Migrate renamed nation ids from older saves before parsing.
    const migrated = json
      .replace(/"nation_north_america"/g, '"nation_usa"')
      .replace(/"nation_south_america"/g, '"nation_brazil"');
    let data: unknown;
    try {
      data = JSON.parse(migrated);
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
      'wonders',
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
    context.policySystem.loadAllNationPolicies(state.nations.map((nation) => ({
      nationId: nation.id,
      activePolicies: nation.activePolicies ?? [],
    })));
    SaveLoadService.applyWonders(state.wonders ?? [], context.wonderSystem);
    SaveLoadService.applyCorporations(state.corporations ?? [], context.corporationSystem);
    SaveLoadService.applyCitiesAndProduction(
      state.cities,
      context.cityManager,
      context.productionSystem,
      context.mapData,
      context.gridSystem,
      state.gameSpeedId ?? context.gameSpeedId,
    );
    SaveLoadService.applyCompletedWonderTiles(state.wonders ?? [], context.mapData);

    // Backfill culture for old saves that pre-date the culture layer.
    // New saves include culture data and are left untouched.
    if (!SaveLoadService.hasAnySavedCulture(state.tiles)) {
      const culturalSphereSystem = new CulturalSphereSystem();
      for (const city of context.cityManager.getAllCities()) {
        culturalSphereSystem.claimInitialCityCulture(
          city,
          context.mapData,
          context.gridSystem,
        );
      }
    }

    SaveLoadService.applyUnits(state.units, context.unitManager);
    SaveLoadService.applyDiplomacy(state.diplomacy, context.diplomacyManager);
    context.tradeDealSystem?.restoreDeals(state.tradeDeals ?? []);
    context.exileProtectionSystem?.restoreAgreements(state.exileProtectionAgreements ?? []);
    if (context.worldMarkerSystem) {
      context.worldMarkerSystem.replaceMarkers(state.worldMarkers ?? context.worldMarkerSystem.getAllMarkers());
      context.worldMarkerSystem.restoreDiscovery(state.worldMarkerDiscoveries ?? []);
    }
    SaveLoadService.applyDiscovery(state.discovery, context.discoverySystem);
    context.turnManager.restoreTurnState(
      state.turn.currentRound,
      state.turn.currentTurnIndex,
    );
  }

  private static applyWonders(wonders: SavedWonder[], wonderSystem: WonderSystem): void {
    wonderSystem.clearAll();
    for (const saved of wonders) {
      wonderSystem.restoreCompletedWonder({
        wonderId: saved.wonderId,
        cityId: saved.cityId,
        ownerId: saved.ownerId,
        tileX: saved.tileX,
        tileY: saved.tileY,
        completedTurn: saved.completedTurn,
      });
    }
  }

  private static applyCorporations(
    corporations: SavedCorporation[],
    corporationSystem: CorporationSystem | undefined,
  ): void {
    if (!corporationSystem) return;
    corporationSystem.clearAll();
    for (const saved of corporations) {
      corporationSystem.restoreFoundedCorporation({
        corporationId: saved.corporationId,
        founderNationId: saved.founderNationId,
        cityId: saved.cityId,
        foundedTurn: saved.foundedTurn,
      });
    }
  }

  private static applyTiles(tiles: SavedTile[], mapData: MapData): void {
    for (const row of mapData.tiles) {
      for (const tile of row) {
        tile.ownerId = undefined;
        tile.resourceOwnerNationId = undefined;
        tile.resourceId = undefined;
        tile.improvementId = undefined;
        tile.improvementConstruction = undefined;
        tile.buildingId = undefined;
        tile.buildingConstruction = undefined;
        tile.wonderId = undefined;
        tile.wonderConstruction = undefined;
        tile.cultureOwnerId = undefined;
        tile.cultureSourceCityId = undefined;
      }
    }
    for (const saved of tiles) {
      const tile = mapData.tiles[saved.r]?.[saved.q];
      if (!tile) continue;
      if (saved.ownerId !== undefined) tile.ownerId = saved.ownerId;
      if (saved.resourceOwnerNationId !== undefined) tile.resourceOwnerNationId = saved.resourceOwnerNationId;
      if (saved.resourceId !== undefined) tile.resourceId = saved.resourceId;
      if (saved.improvementId !== undefined) tile.improvementId = saved.improvementId;
      if (saved.improvementConstruction !== undefined) {
        tile.improvementConstruction = { ...saved.improvementConstruction };
      }
      if (saved.buildingId !== undefined) tile.buildingId = saved.buildingId;
      if (saved.buildingConstruction !== undefined) {
        tile.buildingConstruction = { ...saved.buildingConstruction };
      }
      if (saved.wonderId !== undefined) tile.wonderId = saved.wonderId;
      if (saved.wonderConstruction !== undefined) {
        tile.wonderConstruction = { ...saved.wonderConstruction };
      }
      if (saved.cultureOwnerId !== undefined) tile.cultureOwnerId = saved.cultureOwnerId;
      if (saved.cultureSourceCityId !== undefined) {
        tile.cultureSourceCityId = saved.cultureSourceCityId;
      }
    }
  }

  /**
   * Old saves predate the culture layer. After all cities have been
   * restored, callers can use this to detect missing culture data and
   * rebuild initial city culture as a fallback.
   */
  static hasAnySavedCulture(tiles: SavedTile[]): boolean {
    for (const saved of tiles) {
      if (saved.cultureOwnerId !== undefined) return true;
      if (saved.cultureSourceCityId !== undefined) return true;
    }
    return false;
  }

  private static applyCompletedWonderTiles(wonders: SavedWonder[], mapData: MapData): void {
    for (const saved of wonders) {
      if (saved.tileX === undefined || saved.tileY === undefined) continue;
      const tile = mapData.tiles[saved.tileY]?.[saved.tileX];
      if (tile) tile.wonderId = saved.wonderId;
    }
  }

  private static applyCityOwnedTilesToMap(city: City, mapData: MapData): void {
    const cityTile = mapData.tiles[city.tileY]?.[city.tileX];
    if (!cityTile) {
      console.warn(
        `[SaveLoadService] Saved city tile outside map: ${city.id} (${city.name}) at (${city.tileX},${city.tileY})`,
      );
    }

    const ownedTileKeys = new Set<string>();
    ownedTileKeys.add(`${city.tileX},${city.tileY}`);
    for (const coord of city.ownedTileCoords) {
      ownedTileKeys.add(`${coord.x},${coord.y}`);
    }

    for (const key of ownedTileKeys) {
      const [xText, yText] = key.split(',');
      const x = Number(xText);
      const y = Number(yText);
      const tile = mapData.tiles[y]?.[x];
      if (!tile) continue;
      tile.ownerId = city.ownerId;
    }

    if (cityTile && cityTile.ownerId === undefined) {
      console.warn(
        `[SaveLoadService] Restored city tile has no owner: ${city.id} (${city.name}) at (${city.tileX},${city.tileY})`,
      );
    }
  }

  private static applyNations(nations: SavedNation[], nationManager: NationManager): void {
    for (const saved of nations) {
      const nation = nationManager.getNation(saved.id);
      if (!nation) continue;
      nation.aiStrategyId = saved.aiStrategyId ?? BASELINE_AI_STRATEGY_ID;
      nation.aiStrategyStartedTurn = saved.aiStrategyStartedTurn ?? 0;
      nation.previousAiStrategyId = saved.previousAiStrategyId;
      nation.aiNationalAgendaId = saved.aiNationalAgendaId ?? BALANCED_AGENDA_ID;
      nation.researchedTechIds = [...saved.researchedTechIds];
      nation.currentResearchTechId = saved.currentResearchTechId;
      nation.researchProgress = saved.researchProgress;
      nation.unlockedCultureNodeIds = [...(saved.unlockedCultureNodeIds ?? [])];
      nation.currentCultureNodeId = saved.currentCultureNodeId;
      nation.cultureProgress = saved.cultureProgress ?? 0;
      nation.knownIslandTargets = saved.knownIslandTargets?.map((target) => ({ ...target }));
      nation.leaderEvacuationState = saved.leaderEvacuationState
        ? { ...saved.leaderEvacuationState }
        : undefined;

      const res = nationManager.getResources(saved.id);
      res.gold = saved.gold;
      res.culture = saved.culture;
      res.influence = saved.influence ?? 0;
    }
  }

  private static applyCitiesAndProduction(
    cities: SavedCity[],
    cityManager: CityManager,
    productionSystem: ProductionSystem,
    mapData: MapData,
    gridSystem: IGridSystem,
    gameSpeedId: GameSpeedId,
  ): void {
    cityManager.clearAllSilently();
    productionSystem.clearAllQueues();
    const cityTerritorySystem = new CityTerritorySystem(getGameSpeedById(gameSpeedId), gridSystem);

    for (const saved of cities) {
      const city = cityManager.restoreCity({
        id: saved.id,
        name: saved.name,
        ownerId: saved.ownerId,
        tileX: saved.tileX,
        tileY: saved.tileY,
        isCapital: saved.isCapital,
        originNationId: saved.originNationId ?? saved.ownerId,
        isOriginalCapital: saved.isOriginalCapital ?? saved.isCapital,
        isResidenceCapital: saved.isResidenceCapital ?? saved.isCapital,
        occupiedOriginalNationId: saved.occupiedOriginalNationId,
        focus: saved.focus,
        productionRhythm: {
          completedUnitsSinceInfrastructure: saved.productionRhythm?.completedUnitsSinceInfrastructure ?? 0,
          completedInfrastructureSinceUnit: saved.productionRhythm?.completedInfrastructureSinceUnit ?? 0,
        },
        health: saved.health,
        population: saved.population,
        foodStorage: saved.foodStorage,
        culture: saved.culture,
        culturalSphereProgress: saved.culturalSphereProgress,
        lastTurnAttacked: saved.lastTurnAttacked,
        lastTilePurchaseTurn: saved.lastTilePurchaseTurn,
      });

      if (saved.ownedTileCoords && saved.ownedTileCoords.length > 0) {
        city.ownedTileCoords = saved.ownedTileCoords.map((coord) => ({ ...coord }));
      } else {
        cityTerritorySystem.initializeOwnedTiles(city, mapData, gridSystem);
      }
      SaveLoadService.applyCityOwnedTilesToMap(city, mapData);

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
          placement: entry.placement ? { ...entry.placement } : undefined,
        });
        if (producible.kind === 'wonder' && entry.placement) {
          const tile = mapData.tiles[entry.placement.tileY]?.[entry.placement.tileX];
          if (tile && tile.wonderId === undefined) {
            tile.wonderConstruction = {
              wonderId: producible.wonderType.id,
              cityId: saved.id,
            };
          }
        }
      }
      productionSystem.restoreQueue(saved.id, queueEntries);
    }
  }

  private static applyUnits(units: SavedUnit[], unitManager: UnitManager): void {
    unitManager.clearAllSilently();

    for (const saved of units) {
      const type = getLegacyCompatibleUnitTypeById(saved.unitTypeId);
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
        improvementCharges: saved.improvementCharges,
        transportId: saved.transportId,
        isSleeping: saved.isSleeping,
        actionStatus: saved.actionStatus,
        buildAction: saved.buildAction ? { ...saved.buildAction } : undefined,
      });
    }
  }

  private static applyDiplomacy(
    entries: SavedDiplomacyEntry[],
    diplomacyManager: DiplomacyManager,
  ): void {
    diplomacyManager.resetAll();
    for (const entry of entries) {
      // Older saves only store state/openBorders — normalizeRelation
      // backfills directional grants from the legacy boolean and fills in
      // trust/fear/hostility/affinity + last*Turn defaults.
      diplomacyManager.restoreState(entry.nationA, entry.nationB, {
        state: entry.state,
        openBorders: entry.openBorders,
        openBordersFromAToB: entry.openBordersFromAToB,
        openBordersFromBToA: entry.openBordersFromBToA,
        embassyFromAToB: entry.embassyFromAToB,
        embassyFromBToA: entry.embassyFromBToA,
        tradeRelations: entry.tradeRelations,
        trust: entry.trust,
        fear: entry.fear,
        hostility: entry.hostility,
        affinity: entry.affinity,
        lastWarDeclarationTurn: entry.lastWarDeclarationTurn,
        lastPeaceProposalTurn: entry.lastPeaceProposalTurn,
        lastOpenBordersChangeTurn: entry.lastOpenBordersChangeTurn,
        lastEmbassyChangeTurn: entry.lastEmbassyChangeTurn,
        lastTradeRelationsChangeTurn: entry.lastTradeRelationsChangeTurn,
        lastWarTurn: entry.lastWarTurn,
        lastPeaceTurn: entry.lastPeaceTurn,
      });
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

function toSavedProducible(item: Producible): SavedProducible {
  switch (item.kind) {
    case 'unit':
      return { kind: 'unit', id: item.unitType.id };
    case 'building':
      return { kind: 'building', id: item.buildingType.id };
    case 'wonder':
      return { kind: 'wonder', id: item.wonderType.id };
    case 'corporation':
      return { kind: 'corporation', id: item.corporationType.id };
  }
}

function fromSavedProducible(item: SavedProducible): Producible | null {
  if (item.kind === 'unit') {
    const type = getLegacyCompatibleUnitTypeById(item.id);
    if (type?.category === 'leader') return null;
    return type ? { kind: 'unit', unitType: type } : null;
  }
  if (item.kind === 'wonder') {
    const def = getWonderById(item.id);
    if (!def) {
      console.warn(`[SaveLoadService] Unknown wonder id during restore: ${item.id}`);
      return null;
    }
    return { kind: 'wonder', wonderType: def };
  }
  if (item.kind === 'corporation') {
    const def = getCorporationById(item.id);
    if (!def) {
      console.warn(`[SaveLoadService] Unknown corporation id during restore: ${item.id}`);
      return null;
    }
    return { kind: 'corporation', corporationType: def };
  }
  const def = getBuildingById(item.id);
  return def ? { kind: 'building', buildingType: def } : null;
}
