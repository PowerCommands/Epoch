import type { MapData } from '../types/map';
import type {
  SavedCity,
  SavedDiplomacyEntry,
  SavedDiscoveryEntry,
  SavedForeignTroopViolationWarning,
  SavedGuideProgress,
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
import type { ScenarioInitialDiplomacyEntry } from '../types/scenario';
import { ALL_BUILDINGS, getBuildingById } from '../data/buildings';
import { getUnitTypeById } from '../data/units';
import { getWonderById } from '../data/wonders';
import { getCorporationById } from '../data/corporations';
import { AEROSPACE_PART_PRODUCTION, AEROSPACE_PARTS_ID } from '../data/scienceVictory';
import type { Producible } from '../types/producible';
import { TRADE_ROUTE_PRODUCTION_COST } from '../types/tradeConnection';
import type { CityManager } from './CityManager';
import type { City } from '../entities/City';
import type { Nation } from '../entities/Nation';
import type { DiplomacyManager } from './DiplomacyManager';
import type { AllianceManager } from './diplomacy/AllianceManager';
import type { DiscoverySystem } from './DiscoverySystem';
import type { SymbolicGiftRegistry } from './diplomacy/SymbolicGiftRegistry';
import type { NationManager } from './NationManager';
import type { ProductionSystem } from './ProductionSystem';
import type { PolicySystem } from './PolicySystem';
import type { TradeDealSystem } from './TradeDealSystem';
import type { TradeConnectionSystem } from './TradeConnectionSystem';
import type { TradeDiplomacySystem } from './diplomacy/TradeDiplomacySystem';
import type { VisibilitySystem } from './VisibilitySystem';
import type { ExileProtectionSystem } from './ExileProtectionSystem';
import type { WorldMarkerSystem } from './WorldMarkerSystem';
import type { ForeignTroopViolationSystem } from './ForeignTroopViolationSystem';
import type { HistoricalTimelineService } from './HistoricalTimelineService';
import type { NewspaperSystem } from './NewspaperSystem';
import type { GamesOfNationsSystem } from './GamesOfNationsSystem';
import type { CovertSuspicionSystem } from './diplomacy/CovertSuspicionSystem';
import type { VictorySystem } from './VictorySystem';
import type { TurnManager } from './TurnManager';
import type { UnitManager } from './UnitManager';
import type { WonderSystem } from './WonderSystem';
import type { CorporationSystem } from './CorporationSystem';
import type { AerospacePartSystem } from './AerospacePartSystem';
import type { WorldCouncilSystem } from './WorldCouncilSystem';
import type { GossipSystem } from './GossipSystem';
import type { GossipFlavorEventSystem } from './GossipFlavorEventSystem';
import type { ScenarioHistoricalEventSystem } from './ScenarioHistoricalEventSystem';
import type { QueueEntry } from './ProductionSystem';
import type { IGridSystem } from './grid/IGridSystem';
import { CityTerritorySystem } from './CityTerritorySystem';
import { CulturalSphereSystem } from './CulturalSphereSystem';
import { getGameSpeedById, type GameSpeedId } from '../data/gameSpeeds';
import { BASELINE_AI_STRATEGY_ID } from '../data/aiStrategies';
import { BALANCED_AGENDA_ID } from '../data/aiNationalAgendas';
import { getActiveLeaderSelections, getLeaderCovertPersonalityByNationId } from '../data/leaders';
import type { GeneratedScenarioSnapshot } from './procedural/RandomScenarioTypes';

export interface SaveLoadContext {
  mapKey: string;
  generatedScenario?: GeneratedScenarioSnapshot;
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
  allianceManager?: AllianceManager;
  discoverySystem: DiscoverySystem;
  symbolicGiftRegistry?: SymbolicGiftRegistry;
  gossipSystem?: GossipSystem;
  gossipFlavorEventSystem?: GossipFlavorEventSystem;
  turnManager: TurnManager;
  gridSystem: IGridSystem;
  wonderSystem: WonderSystem;
  corporationSystem?: CorporationSystem;
  aerospacePartSystem?: AerospacePartSystem;
  tradeDealSystem?: TradeDealSystem;
  tradeConnectionSystem?: TradeConnectionSystem;
  tradeDiplomacySystem?: TradeDiplomacySystem;
  visibilitySystem?: VisibilitySystem;
  exileProtectionSystem?: ExileProtectionSystem;
  worldMarkerSystem?: WorldMarkerSystem;
  foreignTroopViolationSystem?: ForeignTroopViolationSystem;
  historicalTimeline?: HistoricalTimelineService;
  scenarioHistoricalEventSystem?: ScenarioHistoricalEventSystem;
  newspaperSystem?: NewspaperSystem;
  gamesOfNationsSystem?: GamesOfNationsSystem;
  covertSuspicionSystem?: CovertSuspicionSystem;
  victorySystem?: VictorySystem;
  worldCouncilSystem?: WorldCouncilSystem;
  /** Snapshot supplied by the progressive guide; presentation state is excluded. */
  guideProgress?: SavedGuideProgress;
}

/**
 * Result returned by {@link SaveLoadService.parse}. Keeps error handling
 * explicit so callers can show a clean failure message without throwing.
 */
export type SaveParseResult =
  | { ok: true; state: SavedGameState }
  | { ok: false; error: string };

/**
 * Restore absolute research state from a save. Progress deliberately remains an
 * accumulated science value: era-cost changes alter only the remaining amount.
 */
export function applySavedResearchState(
  nation: Nation,
  saved: Pick<SavedNation, 'currentResearchTechId' | 'researchProgress'>,
): void {
  nation.currentResearchTechId = saved.currentResearchTechId;
  nation.researchProgress = saved.researchProgress;
}

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
      generatedScenario,
      humanNationId,
      gameSpeedId,
      mapData,
      nationManager,
      cityManager,
      unitManager,
      productionSystem,
      policySystem,
      diplomacyManager,
      allianceManager,
      discoverySystem,
      symbolicGiftRegistry,
      gossipSystem,
      gossipFlavorEventSystem,
      turnManager,
      wonderSystem,
      corporationSystem,
      aerospacePartSystem,
      tradeDealSystem,
      tradeConnectionSystem,
      tradeDiplomacySystem,
      visibilitySystem,
      exileProtectionSystem,
      worldMarkerSystem,
      foreignTroopViolationSystem,
      historicalTimeline,
      scenarioHistoricalEventSystem,
      newspaperSystem,
      gamesOfNationsSystem,
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
        covertPersonalityId: nation.covertPersonalityId,
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
        handledOverseasRegionNames: nation.handledOverseasRegionNames ? [...nation.handledOverseasRegionNames] : undefined,
      };
    });

    const cities: SavedCity[] = cityManager.getAllCities().map((city) => {
      const queue = productionSystem.getQueue(city.id);
      // Serialize working buildings as plain ids (keeps saves compact and
      // readable by older parsers) and only broken ones as objects.
      const buildings = cityManager.getBuildings(city.id).getAllEntries().map((entry) =>
        entry.broken ? { buildingId: entry.buildingId, broken: true } : entry.buildingId,
      );

      const productionQueue: SavedQueueEntry[] = queue.map((view) => ({
        item: toSavedProducible(view.item),
        accumulated: view.progress,
        lockedProductionCost: view.lockedProductionCost,
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
        recentlyConqueredTurnsRemaining: city.recentlyConqueredTurnsRemaining > 0
          ? city.recentlyConqueredTurnsRemaining
          : undefined,
        integrationStartedRound: city.integrationStartedRound,
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
      createdRound: unit.createdRound,
      expiresAtRound: unit.expiresAtRound,
      queuedDestination: unit.queuedDestination ? { ...unit.queuedDestination } : undefined,
      improvementCharges: unit.improvementCharges,
      carriedByUnitId: unit.carriedByUnitId,
      cargoUnitIds: [...unit.cargoUnitIds],
      isSleeping: unit.isSleeping,
      actionStatus: unit.actionStatus,
      buildAction: unit.buildAction ? { ...unit.buildAction } : undefined,
      automation: unit.automation,
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
          && tile.buildingBroken === undefined
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
          buildingBroken: tile.buildingBroken ? true : undefined,
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
      suspicion: entry.relation.suspicion,
      lastWarDeclarationTurn: entry.relation.lastWarDeclarationTurn,
      lastPeaceProposalTurn: entry.relation.lastPeaceProposalTurn,
      lastOpenBordersChangeTurn: entry.relation.lastOpenBordersChangeTurn,
      lastEmbassyChangeTurn: entry.relation.lastEmbassyChangeTurn,
      lastTradeRelationsChangeTurn: entry.relation.lastTradeRelationsChangeTurn,
      peaceTreatyUntilTurn: entry.relation.peaceTreatyUntilTurn,
      militaryUnitsLostA: entry.relation.militaryUnitsLostA,
      militaryUnitsLostB: entry.relation.militaryUnitsLostB,
      citiesLostA: entry.relation.citiesLostA,
      citiesLostB: entry.relation.citiesLostB,
      militaryStrengthAtWarStartA: entry.relation.militaryStrengthAtWarStartA,
      militaryStrengthAtWarStartB: entry.relation.militaryStrengthAtWarStartB,
    }));

    const discovery: SavedDiscoveryEntry[] = discoverySystem.getAllMetPairs().map(([a, b]) => ({
      nationA: a,
      nationB: b,
    }));

    const foreignTroopViolationWarnings: SavedForeignTroopViolationWarning[] | undefined =
      foreignTroopViolationSystem?.getWarningsForSave();

    const wonders: SavedWonder[] = wonderSystem.getCompletedWonders().map((state) => ({
      wonderId: state.wonderId,
      cityId: state.cityId,
      ownerId: state.ownerId,
      tileX: state.tileX,
      tileY: state.tileY,
      completedTurn: state.completedTurn,
      broken: state.broken === true ? true : undefined,
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
      worldYear: turnManager.getGlobalYear(),
      mapKey,
      generatedScenario,
      humanNationId,
      activeNationIds: nationManager.getAllNations().map((nation) => nation.id),
      leaderSelections: (() => {
        const selections = getActiveLeaderSelections();
        return Object.keys(selections).length > 0 ? selections : undefined;
      })(),
      gameSpeedId,
      victoryConditions: context.victorySystem
        ? {
            ...context.victorySystem.getEnabledConditions(),
            scienceRequiredAerospaceParts: context.victorySystem.getScienceVictorySettings().requiredAerospaceParts,
          }
        : undefined,
      turn: {
        currentRound: turnManager.getCurrentRound(),
        currentTurnIndex: turnManager.getCurrentTurnIndex(),
      },
      guideProgress: context.guideProgress ? { ...context.guideProgress } : undefined,
      newspaper: newspaperSystem?.getState(),
      gamesOfNations: gamesOfNationsSystem?.getState(),
      tiles,
      nations,
      cities,
      units,
      diplomacy,
      discovery,
      symbolicGifts: symbolicGiftRegistry?.serialize(),
      gossip: gossipSystem?.serialize(),
      gossipFlavor: gossipFlavorEventSystem?.serialize(),
      wonders,
      worldCouncil: context.worldCouncilSystem?.getState() ?? undefined,
      alliances: allianceManager?.getAllAlliances().map((alliance) => ({
        ...alliance,
        memberNationIds: [...alliance.memberNationIds],
      })),
      corporations,
      aerospaceParts: aerospacePartSystem?.getProgressForSave() ?? [],
      tradeDeals: tradeDealSystem?.getAllDeals().map((deal) => ({ ...deal })),
      tradeConnections: tradeConnectionSystem?.getAllConnections(),
      tradeHistory: tradeDiplomacySystem?.getAllEntries(),
      fogOfWar: visibilitySystem
        ? {
            explored: visibilitySystem.getExploredTileCoords(),
            knownCityIds: visibilitySystem.getKnownCityIds(),
          }
        : undefined,
      worldMarkers: worldMarkerSystem?.getAllMarkersForSave(),
      worldMarkerDiscoveries: worldMarkerSystem?.getDiscoveryEntries(),
      worldMarkerClaims: worldMarkerSystem?.getClaimEntries(),
      foreignTroopViolationWarnings,
      historicalTimeline: historicalTimeline?.serialize(),
      scenarioHistoricalEvents: scenarioHistoricalEventSystem?.serialize(),
      covertIncidents: context.covertSuspicionSystem?.getOffenseRecords(),
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
    if (obj.generatedScenario !== undefined) {
      const generated = obj.generatedScenario as Record<string, unknown> | null;
      const metadata = generated && typeof generated.metadata === 'object'
        ? generated.metadata as Record<string, unknown>
        : null;
      const scenario = generated && typeof generated.scenario === 'object'
        ? generated.scenario as Record<string, unknown>
        : null;
      const map = scenario && typeof scenario.map === 'object'
        ? scenario.map as Record<string, unknown>
        : null;
      if (!generated || !metadata || !scenario || !map
        || metadata.generatorVersion !== 1
        || metadata.width !== map.width
        || metadata.height !== map.height
        || !Array.isArray(map.tiles)) {
        return { ok: false, error: 'Save file contains an invalid embedded Random Scenario.' };
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
    context.worldCouncilSystem?.restore(state.worldCouncil);
    SaveLoadService.applyCorporations(state.corporations ?? [], context.corporationSystem);
    context.aerospacePartSystem?.restoreProgress(state.aerospaceParts ?? []);
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
    context.allianceManager?.restoreAlliances(state.alliances);
    context.foreignTroopViolationSystem?.restoreWarnings(state.foreignTroopViolationWarnings);
    context.tradeDealSystem?.restoreDeals(state.tradeDeals ?? []);
    context.tradeConnectionSystem?.restoreConnections(state.tradeConnections ?? []);
    context.tradeDiplomacySystem?.restoreEntries(state.tradeHistory ?? []);
    if (state.fogOfWar && context.visibilitySystem) {
      context.visibilitySystem.restoreExplored(state.fogOfWar.explored);
      context.visibilitySystem.restoreKnownCities(state.fogOfWar.knownCityIds ?? []);
    }
    context.historicalTimeline?.restore(state.historicalTimeline);
    if (context.worldMarkerSystem) {
      context.worldMarkerSystem.replaceMarkers(state.worldMarkers ?? context.worldMarkerSystem.getAllMarkers());
      context.worldMarkerSystem.restoreDiscovery(state.worldMarkerDiscoveries ?? []);
      context.worldMarkerSystem.restoreClaims(state.worldMarkerClaims ?? []);
    }
    SaveLoadService.applyDiscovery(state.discovery, context.discoverySystem);
    context.symbolicGiftRegistry?.restore(state.symbolicGifts);
    context.gossipSystem?.restore(state.gossip);
    context.gossipFlavorEventSystem?.restore(state.gossipFlavor);
    context.covertSuspicionSystem?.restoreOffenseRecords(state.covertIncidents);
    context.turnManager.restoreTurnState(
      state.turn.currentRound,
      state.turn.currentTurnIndex,
    );
    // Restore lifecycle and its calendar anchor only after the round cursor is
    // in place, but before GameScene resumes with TurnManager.start().
    context.scenarioHistoricalEventSystem?.restore(state.scenarioHistoricalEvents);
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
        broken: saved.broken === true ? true : undefined,
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
        tile.buildingBroken = undefined;
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
      const savedBuildingIsCityBound = saved.buildingId !== undefined
        && getBuildingById(saved.buildingId)?.placement === 'city';
      if (saved.buildingId !== undefined && !savedBuildingIsCityBound) tile.buildingId = saved.buildingId;
      if (saved.buildingBroken === true && !savedBuildingIsCityBound) tile.buildingBroken = true;
      const constructionIsCityBound = saved.buildingConstruction !== undefined
        && getBuildingById(saved.buildingConstruction.buildingId)?.placement === 'city';
      if (saved.buildingConstruction !== undefined && !constructionIsCityBound) {
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

  /**
   * Maps renamed technology ids from older saves to their current ids. The
   * technology `foreign_trade` was renamed to `trade_networks`; the culture
   * node `foreign_trade` is unaffected (cultures use a separate id list).
   */
  private static readonly RENAMED_TECH_IDS: Readonly<Record<string, string>> = {
    foreign_trade: 'trade_networks',
  };

  private static migrateTechId(techId: string | undefined): string | undefined {
    if (techId === undefined) return undefined;
    return SaveLoadService.RENAMED_TECH_IDS[techId] ?? techId;
  }

  /** Migrate a list of researched tech ids, de-duplicating after renames. */
  private static migrateTechIds(techIds: readonly string[]): string[] {
    const migrated: string[] = [];
    for (const techId of techIds) {
      const next = SaveLoadService.RENAMED_TECH_IDS[techId] ?? techId;
      if (!migrated.includes(next)) migrated.push(next);
    }
    return migrated;
  }

  private static applyNations(nations: SavedNation[], nationManager: NationManager): void {
    for (const saved of nations) {
      const nation = nationManager.getNation(saved.id);
      if (!nation) continue;
      nation.aiStrategyId = saved.aiStrategyId ?? BASELINE_AI_STRATEGY_ID;
      nation.aiStrategyStartedTurn = saved.aiStrategyStartedTurn ?? 0;
      nation.previousAiStrategyId = saved.previousAiStrategyId;
      nation.aiNationalAgendaId = saved.aiNationalAgendaId ?? BALANCED_AGENDA_ID;
      // Older saves predate covert personalities → fall back to the leader default.
      nation.covertPersonalityId = saved.covertPersonalityId ?? getLeaderCovertPersonalityByNationId(saved.id);
      nation.researchedTechIds = SaveLoadService.migrateTechIds(saved.researchedTechIds);
      applySavedResearchState(nation, {
        currentResearchTechId: SaveLoadService.migrateTechId(saved.currentResearchTechId),
        researchProgress: saved.researchProgress,
      });
      nation.unlockedCultureNodeIds = [...(saved.unlockedCultureNodeIds ?? [])];
      nation.currentCultureNodeId = saved.currentCultureNodeId;
      nation.cultureProgress = saved.cultureProgress ?? 0;
      nation.knownIslandTargets = saved.knownIslandTargets?.map((target) => ({ ...target }));
      nation.handledOverseasRegionNames = saved.handledOverseasRegionNames ? [...saved.handledOverseasRegionNames] : undefined;

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
        integrationStartedRound: saved.integrationStartedRound,
      });
      city.recentlyConqueredTurnsRemaining = saved.recentlyConqueredTurnsRemaining ?? 0;

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
      for (const entry of saved.buildings) {
        // Backward-compatible: a plain string is a working building; an object
        // carries the broken flag. Unknown ids are skipped silently.
        const id = typeof entry === 'string' ? entry : entry.buildingId;
        const broken = typeof entry === 'string' ? false : entry.broken === true;
        const def = getBuildingById(id) ?? ALL_BUILDINGS.find((b) => b.id === id);
        if (def) buildings.addEntry(def.id, broken);
      }

      const queueEntries: QueueEntry[] = [];
      for (const entry of saved.productionQueue) {
        const producible = fromSavedProducible(entry.item);
        if (!producible) continue;
        queueEntries.push({
          item: producible,
          accumulated: entry.accumulated,
          lockedProductionCost: entry.lockedProductionCost,
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
        createdRound: saved.createdRound,
        expiresAtRound: saved.expiresAtRound,
        queuedDestination: saved.queuedDestination,
        improvementCharges: saved.improvementCharges,
        carriedByUnitId: saved.carriedByUnitId ?? saved.transportId,
        cargoUnitIds: saved.cargoUnitIds,
        isSleeping: saved.isSleeping,
        actionStatus: saved.actionStatus,
        buildAction: saved.buildAction ? { ...saved.buildAction } : undefined,
        automation: saved.automation,
      });
    }
    unitManager.normalizeCargoLinks();
  }

  /**
   * Apply a scenario's pre-configured diplomacy when starting a fresh game
   * (NOT loading a save — saves carry their own diplomacy snapshot). Reuses the
   * same normalization/restoration path as save-load so missing values get
   * normal diplomacy defaults. Scenario-authored wars are stamped as starting
   * on the current round, so normal minimum-war-duration peace rules advance
   * from game start without triggering declaration side effects, notifications,
   * penalties, or AI reactions.
   *
   * Editor-level "ALLIANCE" is not a relation state: such pairs are set to PEACE
   * with the alliance prerequisites enabled (mutual open borders, mutual
   * embassies, trade relations) and a real alliance is formed through
   * AllianceManager — the engine's single source of truth for alliances.
   */
  static applyScenarioDiplomacy(
    entries: ScenarioInitialDiplomacyEntry[],
    context: {
      diplomacyManager: DiplomacyManager;
      discoverySystem: DiscoverySystem;
      allianceManager?: AllianceManager;
      turnManager?: TurnManager;
      nationName?: (nationId: string) => string;
    },
  ): void {
    const { diplomacyManager, discoverySystem, allianceManager, turnManager, nationName } = context;
    const currentTurn = turnManager?.getCurrentRound() ?? 0;
    for (const entry of entries) {
      const { nationA, nationB } = entry;
      if (nationA === nationB) continue;
      // Only an actual relationship (war, alliance, open borders, embassy or
      // trade) implies the nations have met. A pure memory-tuning entry — PEACE
      // with no agreements, just pre-seeded trust/fear/hostility/affinity — must
      // NOT pre-mark them as met, or the AI would open diplomacy/trade with the
      // human before either side has actually discovered the other.
      const impliesContact =
        entry.state === 'WAR' ||
        entry.state === 'ALLIANCE' ||
        entry.tradeRelations ||
        entry.embassyFromAToB || entry.embassyFromBToA ||
        entry.openBordersFromAToB || entry.openBordersFromBToA;
      if (impliesContact) discoverySystem.restoreMet(nationA, nationB);

      const isAlliance = entry.state === 'ALLIANCE';
      const isWar = entry.state === 'WAR';
      // ALLIANCE is an editor concept layered on PEACE; the relation itself is
      // only ever WAR or PEACE.
      diplomacyManager.restoreState(nationA, nationB, {
        state: isWar ? 'WAR' : 'PEACE',
        // War starts from a clean diplomatic break, matching declareWar.
        // Alliances require mutual open borders, mutual embassies and trade.
        openBordersFromAToB: isWar ? false : isAlliance ? true : entry.openBordersFromAToB,
        openBordersFromBToA: isWar ? false : isAlliance ? true : entry.openBordersFromBToA,
        embassyFromAToB: isWar ? false : isAlliance ? true : entry.embassyFromAToB,
        embassyFromBToA: isWar ? false : isAlliance ? true : entry.embassyFromBToA,
        tradeRelations: isWar ? false : isAlliance ? true : entry.tradeRelations,
        trust: entry.trust,
        fear: entry.fear,
        hostility: entry.hostility,
        affinity: entry.affinity,
        suspicion: entry.suspicion,
        lastWarDeclarationTurn: isWar ? currentTurn : null,
        aggressorNationId: isWar ? nationA : undefined,
        peaceTreatyUntilTurn: null,
        militaryUnitsLostA: 0,
        militaryUnitsLostB: 0,
        citiesLostA: 0,
        citiesLostB: 0,
        militaryStrengthAtWarStartA: 0,
        militaryStrengthAtWarStartB: 0,
      });

      if (isAlliance && allianceManager) {
        const name = `${nationName?.(nationA) ?? nationA}–${nationName?.(nationB) ?? nationB} Alliance`;
        allianceManager.createAlliance(nationA, nationB, name, currentTurn);
      }
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
        suspicion: entry.suspicion,
        lastWarDeclarationTurn: entry.lastWarDeclarationTurn,
        lastPeaceProposalTurn: entry.lastPeaceProposalTurn,
        lastOpenBordersChangeTurn: entry.lastOpenBordersChangeTurn,
        lastEmbassyChangeTurn: entry.lastEmbassyChangeTurn,
        lastTradeRelationsChangeTurn: entry.lastTradeRelationsChangeTurn,
        peaceTreatyUntilTurn: entry.peaceTreatyUntilTurn,
        lastWarTurn: entry.lastWarTurn,
        lastPeaceTurn: entry.lastPeaceTurn,
        militaryUnitsLostA: entry.militaryUnitsLostA,
        militaryUnitsLostB: entry.militaryUnitsLostB,
        citiesLostA: entry.citiesLostA,
        citiesLostB: entry.citiesLostB,
        militaryStrengthAtWarStartA: entry.militaryStrengthAtWarStartA,
        militaryStrengthAtWarStartB: entry.militaryStrengthAtWarStartB,
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
    case 'manufacturedResource':
      return { kind: 'manufacturedResource', id: item.productionType.id };
    case 'tradeRoute':
      return {
        kind: 'tradeRoute',
        id: item.connectionId,
        fromCityId: item.fromCityId,
        toCityId: item.toCityId,
        targetNationId: item.targetNationId,
        displayName: item.displayName,
      };
  }
}

function fromSavedProducible(item: SavedProducible): Producible | null {
  if (item.kind === 'tradeRoute') {
    return {
      kind: 'tradeRoute',
      connectionId: item.id,
      fromCityId: item.fromCityId ?? '',
      toCityId: item.toCityId ?? '',
      targetNationId: item.targetNationId ?? '',
      displayName: item.displayName ?? 'Trade Route',
      productionCost: TRADE_ROUTE_PRODUCTION_COST,
    };
  }
  if (item.kind === 'unit') {
    const type = getUnitTypeById(item.id);
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
  if (item.kind === 'manufacturedResource') {
    if (item.id !== AEROSPACE_PARTS_ID) {
      console.warn(`[SaveLoadService] Unknown manufactured production id during restore: ${item.id}`);
      return null;
    }
    return { kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION };
  }
  const def = getBuildingById(item.id);
  return def ? { kind: 'building', buildingType: def } : null;
}
