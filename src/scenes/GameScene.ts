import Phaser from 'phaser';
import { TileMap } from '../systems/TileMap';
import { ScenarioLoader } from '../systems/ScenarioLoader';
import { CameraController } from '../systems/CameraController';
import { SelectionManager } from '../systems/SelectionManager';
import { NationManager } from '../systems/NationManager';
import { CityManager } from '../systems/CityManager';
import { UnitManager } from '../systems/UnitManager';
import { UnitBoardingManager } from '../systems/UnitBoardingManager';
import { TurnManager } from '../systems/TurnManager';
import { ResourceSystem } from '../systems/ResourceSystem';
import { UnitUpkeepSystem } from '../systems/UnitUpkeepSystem';
import { UnitUpgradeSystem } from '../systems/UnitUpgradeSystem';
import { UnitLifetimeSystem } from '../systems/UnitLifetimeSystem';
import { WorldMarkerSystem } from '../systems/WorldMarkerSystem';
import { WorldMarkerRenderer } from '../systems/WorldMarkerRenderer';
import { ImprovementConstructionSystem } from '../systems/ImprovementConstructionSystem';
import { TradeDealSystem } from '../systems/TradeDealSystem';
import { TradeConnectionSystem } from '../systems/TradeConnectionSystem';
import { TRADE_ROUTE_PRODUCTION_COST } from '../types/tradeConnection';
import { ResourceAccessSystem } from '../systems/ResourceAccessSystem';
import { ResourceCitySearchSystem } from '../systems/ResourceCitySearchSystem';
import { BorderPressureSystem, type BorderPressureEvent } from '../systems/BorderPressureSystem';
import { ForeignTroopViolationSystem } from '../systems/ForeignTroopViolationSystem';
import { ExplorationMemorySystem } from '../systems/ExplorationMemorySystem';
import { NaturalResourceSystem } from '../systems/NaturalResourceSystem';
import { NaturalResourceRenderer } from '../systems/NaturalResourceRenderer';
import { HappinessSystem } from '../systems/HappinessSystem';
import { MilitaryUnhappinessSystem } from '../systems/MilitaryUnhappinessSystem';
import { ImperialOverstretchSystem } from '../systems/ImperialOverstretchSystem';
import { ConqueredCityUnhappinessSystem } from '../systems/ConqueredCityUnhappinessSystem';
import { WarWearinessSystem } from '../systems/WarWearinessSystem';
import { CultureSystem } from '../systems/culture/CultureSystem';
import { CultureEffectSystem } from '../systems/culture/CultureEffectSystem';
import { PolicySystem } from '../systems/PolicySystem';
import { ResearchSystem } from '../systems/ResearchSystem';
import { TileResourceGenerator } from '../systems/ResourceGenerator';
import { ProductionSystem } from '../systems/ProductionSystem';
import { HealingSystem } from '../systems/HealingSystem';
import { TerritoryRenderer } from '../systems/TerritoryRenderer';
import { HexEdgeOverlayRenderer } from '../systems/HexEdgeOverlayRenderer';
import { COAST_EDGE_PASSES, BIOME_EDGE_PASSES } from '../data/terrainEdges';
import { CityRenderer } from '../systems/CityRenderer';
import { UnitRenderer } from '../systems/UnitRenderer';
import { MovementSystem } from '../systems/MovementSystem';
import { PathfindingSystem } from '../systems/PathfindingSystem';
import { PathPreviewRenderer } from '../systems/PathPreviewRenderer';
import { InvalidTileFeedbackRenderer } from '../renderers/InvalidTileFeedbackRenderer';
import { canUnitEnterTile } from '../systems/UnitMovementRules';
import { RangedPreviewRenderer } from '../systems/RangedPreviewRenderer';
import { TurnOrderSystem } from '../systems/TurnOrderSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { CityWorkTileRenderer } from '../systems/CityWorkTileRenderer';
import { CultureClaimTileRenderer } from '../systems/CultureClaimTileRenderer';
import { BuildingPlacementSystem } from '../systems/BuildingPlacementSystem';
import { WonderPlacementSystem } from '../systems/WonderPlacementSystem';
import { CityTerritorySystem } from '../systems/CityTerritorySystem';
import {
  CulturalSphereSystem,
  CULTURAL_BUILDING_BURST_RADIUS,
  CULTURAL_BUILDING_BURST_MAX_TILES,
  CULTURAL_PERCENT_BUILDING_BURST_RADIUS,
  CULTURAL_PERCENT_BUILDING_BURST_MAX_TILES,
  WORLD_WONDER_CULTURAL_BURST_RADIUS,
  WORLD_WONDER_CULTURAL_BURST_MAX_TILES,
} from '../systems/CulturalSphereSystem';
import { CityViewInteractionController } from '../systems/CityViewInteractionController';
import { getCityViewTileBreakdown } from '../systems/CityViewData';
import { CityViewRenderer, type CityViewPlacementRenderState } from '../systems/CityViewRenderer';
import { DiplomacyManager, MIN_WAR_TURNS_FOR_PEACE, PEACE_TREATY_COOLDOWN_TURNS } from '../systems/DiplomacyManager';
import { PeaceTreatySystem } from '../systems/PeaceTreatySystem';
import { DiplomaticMemorySystem } from '../systems/diplomacy/DiplomaticMemorySystem';
import { SymbolicGiftRegistry } from '../systems/diplomacy/SymbolicGiftRegistry';
import { AllianceManager } from '../systems/diplomacy/AllianceManager';
import { AllianceWarSystem } from '../systems/diplomacy/AllianceWarSystem';
import { JointWarSystem } from '../systems/diplomacy/JointWarSystem';
import type { JointWarKind } from '../types/jointWar';
import { AllianceCouncilManager } from '../systems/diplomacy/AllianceCouncilManager';
import { AllianceCouncilDialog } from '../ui/AllianceCouncilDialog';
import { TradeDiplomacySystem } from '../systems/diplomacy/TradeDiplomacySystem';
import { DiplomaticEvaluationSystem } from '../systems/diplomacy/DiplomaticEvaluationSystem';
import { DiplomaticProposalSystem } from '../systems/diplomacy/DiplomaticProposalSystem';
import { IdeologicalDriftSystem, type IdeologicalDriftEvent } from '../systems/diplomacy/IdeologicalDriftSystem';
import { NATURAL_RESOURCES, getNaturalResourceById } from '../data/naturalResources';
import { AIDiplomacySystem } from '../systems/ai/AIDiplomacySystem';
import { AIExplorationSystem } from '../systems/ai/AIExplorationSystem';
import { AIOverseasExpansionSystem } from '../systems/AIOverseasExpansionSystem';
import { AIPolicySystem } from '../systems/ai/AIPolicySystem';
import { AIMilitaryEvaluationSystem } from '../systems/ai/AIMilitaryEvaluationSystem';
import { AIMilitaryThreatEvaluationSystem } from '../systems/ai/AIMilitaryThreatEvaluationSystem';
import { createAILogFormatter } from '../systems/ai/AILogFormatter';
import { DiscoverySystem } from '../systems/DiscoverySystem';
import { EventLogSystem } from '../systems/EventLogSystem';
import { HistoricalTimelineService } from '../systems/HistoricalTimelineService';
import { TimelinePanel } from '../ui/TimelinePanel';
import { EraSystem } from '../systems/EraSystem';
import { AISystem } from '../systems/AISystem';
import { getLeaderByNationId, getLeaderPersonalityByNationId, setScenarioLeaderOverrides } from '../data/leaders';
import { resolveLeaderEraStrategy } from '../data/aiLeaderEraStrategies';
import { FoundCitySystem } from '../systems/FoundCitySystem';
import { VictorySystem } from '../systems/VictorySystem';
import { PoliticalCapitalSystem } from '../systems/PoliticalCapitalSystem';
import { LeaderCaptureSystem, type LeaderCaptureChoiceRequest } from '../systems/LeaderCaptureSystem';
import { NationCollapseSystem } from '../systems/NationCollapseSystem';
import { ExileProtectionSystem, type ExileProtectionChoiceRequest } from '../systems/ExileProtectionSystem';
import { CityDefenseSystem } from '../systems/CityDefenseSystem';
import { BuilderSystem } from '../systems/BuilderSystem';
import { CheatSystem } from '../systems/CheatSystem';
import { AutoplaySystem } from '../systems/AutoplaySystem';
import { CombatAnimationSystem } from '../systems/CombatAnimationSystem';
import { AutoplayHud } from '../ui/hud/AutoplayHud';
import { DiagnosticSystem } from '../systems/DiagnosticSystem';
import { calculateCityEconomy } from '../systems/CityEconomy';
import { CityBannerRenderer } from '../systems/CityBannerRenderer';
import { SetupMusicManager } from '../systems/SetupMusicManager';
import { TileBuildingRenderer } from '../systems/TileBuildingRenderer';
import { TileImprovementOverlayRenderer } from '../renderers/TileImprovementOverlayRenderer';
import { CultureLayerRenderer } from '../renderers/CultureLayerRenderer';
import { FogOfWarRenderer } from '../renderers/FogOfWarRenderer';
import { VisibilitySystem } from '../systems/VisibilitySystem';
import { DEFAULT_MAP_LENS, type MapLensMode } from '../types/mapLens';
import { WonderSystem } from '../systems/WonderSystem';
import { CorporationSystem } from '../systems/CorporationSystem';
import { TerritoryExpansionBonusSystem } from '../systems/TerritoryExpansionBonusSystem';
import type { IGridSystem } from '../systems/grid/IGridSystem';
import { HexGridSystem } from '../systems/grid/HexGridSystem';
import { HexGridLayout } from '../systems/gridLayout/HexGridLayout';
import { WorldInputGate } from '../systems/input/WorldInputGate';
import { CombatLog } from '../ui/CombatLog';
import { CheatConsole } from '../ui/CheatConsole';
import { DiagnosticDialog } from '../ui/DiagnosticDialog';
import { LeaderPortraitStrip } from '../ui/LeaderPortraitStrip';
import { UnitActionToolbox } from '../ui/UnitActionToolbox';
import { EscapeMenu } from '../ui/EscapeMenu';
import { TutorialView } from '../ui/TutorialView';
import { SettingsDialog } from '../ui/SettingsDialog';
import { isAutofocusOnEndTurn, isAutoEndTurn } from '../systems/PlayerSettings';
import { CityView, type CityViewBuildingOption, type CityViewCorporationOption, type CityViewPlacementPanelState, type CityViewQueueItem, type CityViewUnitOption, type CityViewWonderOption } from '../ui/CityView';
import type { CityViewTilePurchaseState } from '../ui/CityView';
import type { AIDiplomacyAction } from '../types/aiDiplomacy';
import { ALL_WONDERS, getWonderById } from '../data/wonders';
import { CORPORATIONS, getCorporationById } from '../data/corporations';
import { getResourceDisplayName } from '../data/resources';
import type { Producible } from '../types/producible';
import { HudLayer } from '../ui/hud/HudLayer';
import { TutorialWizard, type TutorialStep } from '../ui/hud/TutorialWizard';
import { isTutorialDontShowAgain, setTutorialDontShowAgain } from '../systems/TutorialSettings';
import type { ScreenRect } from '../types/screenRect';
import { Tooltip } from '../ui/hud/Tooltip';
import type { DiscoveryPopupData, DiscoveryPopupRow } from '../ui/hud/DiscoveryPopup';
import { UnitHoverDiagnosticHud } from '../ui/hud/UnitHoverDiagnosticHud';
import { MinimapHud } from '../ui/hud/MinimapHud';
import { NationHudDataProvider } from '../ui/hud/NationHudDataProvider';
import { RightSidebarPanel } from '../ui/phaser/RightSidebarPanel';
import { RightSidebarPanelDataProvider } from '../ui/phaser/RightSidebarPanelDataProvider';
import { LeaderAudienceDialog } from '../ui/dialogs/LeaderAudienceDialog';
import { SaveLoadService } from '../systems/SaveLoadService';
import { LATEST_AUTOSAVE_KEY } from '../systems/AutosaveService';
import type { SavedGameState } from '../types/saveGame';
import { ALL_BUILDINGS, getBuildingById } from '../data/buildings';
import { CULTURE_TREE } from '../data/cultureTree';
import { getImprovementById } from '../data/improvements';
import { getTechnologyById, type TechnologyDefinition, type TechnologyUnlock } from '../data/technologies';
import { ALL_UNIT_TYPES, WORK_BOAT, getUnitTypeById } from '../data/units';
import type { CultureNode } from '../types/CultureNode';
import type { CultureUnlock } from '../types/CultureUnlock';
import {
  getBuildingSpriteKey,
  getBuildingSpritePath,
  getCorporationSpritePath,
  getCultureSpriteKey,
  getCultureSpritePath,
  getTechnologySpriteKey,
  getTechnologySpritePath,
  getUnitSpriteKey,
  getUnitSpritePath,
  getWonderSpriteKey,
  getWonderSpritePath,
} from '../utils/assetPaths';
import { canCityProduceUnit, getCityUnitProductionBlockReason } from '../systems/ProductionRules';
import { StrategicResourceCapacitySystem } from '../systems/StrategicResourceCapacitySystem';
import { TileType, type Tile, type MapData } from '../types/map';
import { isMilitaryUnitType } from '../utils/unitRoleUtils';
import type { ScenarioData, ScenarioNation } from '../types/scenario';
import type { City } from '../entities/City';
import type { Nation } from '../entities/Nation';
import type { Unit } from '../entities/Unit';
import type { UnitType } from '../entities/UnitType';
import type { Selectable } from '../types/selection';
import type { GameConfig } from '../types/gameConfig';
import { DEFAULT_GAME_SPEED_ID, getGameSpeedById } from '../data/gameSpeeds';
import { LogManager } from '../systems/LogManager';

interface EpochGameDiagnostics {
  startAutoplay: (rounds: number) => Promise<{ completedRounds: number }>;
  stopAutoplay: () => void;
  isAutoplayActive: () => boolean;
  isAutoplayCompleted: () => boolean;
  getEventLogEntries: () => Array<{ id: number; text: string; nationIds: string[]; round: number }>;
  getEventLogText: () => string;
  getStateSummary: () => {
    currentRound: number;
    currentNationId: string;
    currentNationName: string;
    nationCount: number;
    cityCount: number;
    unitCount: number;
  };
  getSaveState: () => SavedGameState;
}

/**
 * GameScene — huvudspelscenen.
 * Orkestrerar karta, nationer, städer, enheter, turordning, resurser,
 * produktion, byggnader, strid, läkning, AI, stadsgrundning,
 * kamerakontroll, selection och HUD.
 */
export class GameScene extends Phaser.Scene {
  private cameraController!: CameraController;
  private diagnosticSystem!: DiagnosticSystem;
  private minimapHud: MinimapHud | null = null;
  private tutorialWizard: TutorialWizard | null = null;
  private rightSidebarPanel: RightSidebarPanel | null = null;
  private leaderAudienceDialog: LeaderAudienceDialog | null = null;
  private isAutoplayActiveForVisuals: () => boolean = () => false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data: GameConfig): void {
    this.minimapHud = null;
    this.rightSidebarPanel = null;
    this.leaderAudienceDialog = null;
    this.tutorialWizard = null;
    this.isAutoplayActiveForVisuals = () => false;
    // ─── Data & system ───────────────────────────────────────────────────────

    // 1. Parse scenario using map key from config
    const scenarioJson = this.cache.json.get(data.mapKey) as ScenarioData;
    // Install scenario-authored leader name/description overrides before any
    // system or UI reads leaders, so the override flows through the whole game.
    setScenarioLeaderOverrides(scenarioJson.nations);

    const scenario = ScenarioLoader.parse(scenarioJson);
    const mapData = scenario.mapData;
    const worldMarkerSystem = new WorldMarkerSystem(data.savedState?.worldMarkers ?? scenario.worldMarkers);
    const gridSystem = new HexGridSystem();
    const gridLayout = new HexGridLayout();
    const resourceAbundance = data.resourceAbundance ?? 'normal';
    const gameSpeed = getGameSpeedById(data.savedState?.gameSpeedId ?? data.gameSpeedId ?? DEFAULT_GAME_SPEED_ID);
    // Read autofocus live so the in-game Settings dialog applies immediately. An
    // explicit config value (e.g. diagnostic runs) still overrides the setting.
    const autofocusEnabled = (): boolean => data.autofocusOnEndTurn ?? isAutofocusOnEndTurn();

    // 2. Filter to active nations only, set isHuman from config
    const activeSet = new Set(data.activeNationIds);
    const activeNations = scenario.nations
      .filter(n => activeSet.has(n.id))
      .map(n => ({ ...n, isHuman: n.id === data.humanNationId }));
    const activeCities = scenario.cities.filter(c => activeSet.has(c.nationId));
    const activeUnits = scenario.units.filter(u => activeSet.has(u.nationId));
    const cityTerritorySystem = new CityTerritorySystem(gameSpeed, gridSystem);

    if (!data.savedState) {
      new NaturalResourceSystem().generate(mapData, {
        mapKey: data.mapKey,
        activeNationIds: data.activeNationIds,
        humanNationId: data.humanNationId,
        resourceAbundance,
        cityCoords: activeCities.map((city) => ({ x: city.q, y: city.r })),
        worldSeed: data.worldSeed ?? generateWorldSeed(),
      });
    }

    // 3. Create nations and claim AI start territories (mutates mapData.tiles)
    const nationManager = NationManager.loadFromScenario(activeNations, mapData, gridSystem);

    // Override isHuman from config (ignore JSON values)
    for (const nation of nationManager.getAllNations()) {
      nation.isHuman = nation.id === data.humanNationId;
    }
    const humanNationId = nationManager.getHumanNationId();

    // 4. Render terrain (depth 0)
    const tileMap = new TileMap(this, mapData, gridLayout);

    // 4b. Render coast edge overlays (depth 2) — shoreline strokes on coast
    // hex edges that face land neighbors. Sits above terrain, below territory.
    const coastEdgeRenderer = new HexEdgeOverlayRenderer(this, tileMap, mapData, { depth: 2, passes: COAST_EDGE_PASSES });

    // 4c. Render biome edge overlays (depth 3) — forest tree-line against
    // plains and mountain ridge against surrounding non-mountain land.
    const biomeEdgeRenderer = new HexEdgeOverlayRenderer(this, tileMap, mapData, { depth: 3, passes: BIOME_EDGE_PASSES });

    // 4d. Render natural resources above terrain and below borders/units.
    const naturalResourceRenderer = new NaturalResourceRenderer(this, tileMap, mapData);

    // 5. Render border-only territory visualization.
    const territoryRenderer = new TerritoryRenderer(this, tileMap, nationManager, mapData, gridSystem);
    territoryRenderer.invalidate();

    // 5b. Culture overlay renderer (hidden until the player toggles the lens).
    const cultureLayerRenderer = new CultureLayerRenderer(this, tileMap, nationManager, mapData);

    // 5c. Fog of war — depth 7 (above borders/resources, below cities and units).
    const visibilitySystem = new VisibilitySystem(mapData, gridSystem);
    const fogOfWarRenderer = new FogOfWarRenderer(this, tileMap, mapData, visibilitySystem);

    // 6. Create cities from scenario (filtered)
    const cityManager = CityManager.loadFromScenario(activeCities, mapData);
    const eraSystem = new EraSystem(nationManager);
    const culturalSphereSystem = new CulturalSphereSystem();
    for (const city of cityManager.getAllCities()) {
      cityTerritorySystem.initializeOwnedTiles(city, mapData, gridSystem);
      culturalSphereSystem.claimInitialCityCulture(city, mapData, gridSystem);
    }

    // 7. Create units from scenario (filtered)
    const unitManager = UnitManager.loadFromScenario(activeUnits, mapData, gameSpeed);
    // Enrich unit events with cityId (used by right-side details refreshes).
    unitManager.setCityLocator((x, y) => cityManager.getCityAt(x, y)?.id);

    // 7b. Give every nation a starting Scout to accelerate early-game
    // exploration, discovery and diplomacy. New games only — loaded saves
    // already contain their units. Scenarios that explicitly place a Scout for
    // a nation keep theirs (duplicate protection below).
    if (!data.savedState) {
      this.spawnStartingScouts(activeNations, unitManager, gridSystem, mapData);
    }

    // Assigned once all object renderers exist (see fog wiring below). Lets
    // updateFog() re-cull cities/units/borders/resources/improvements after a
    // visibility recompute. No-op until then so early calls stay safe.
    let applyFogToRenderers: () => void = () => {};
    const updateFog = (): void => {
      if (!humanNationId) return;
      const humanCities = cityManager.getCitiesByOwner(humanNationId);
      const humanUnits = unitManager.getUnitsByOwner(humanNationId);
      visibilitySystem.update(humanCities, humanUnits);
      // Any city now in vision becomes permanently known (city + surroundings).
      visibilitySystem.recordVisibleCities(cityManager.getAllCities());
      fogOfWarRenderer.refresh(humanCities, humanUnits);
      applyFogToRenderers();
    };

    // 7. Kamerakontroll
    const { width: worldWidth, height: worldHeight } = tileMap.getWorldBounds();
    const overviewZoom = this.getMapCoverZoom(worldWidth, worldHeight);
    const worldInputGate = new WorldInputGate();
    this.cameraController = new CameraController(this, worldWidth, worldHeight, worldInputGate, overviewZoom);
    // 8. Rendera städer (depth 15)
    const cityRenderer = new CityRenderer(this, tileMap, cityManager, nationManager, (nationId) => eraSystem.getNationEra(nationId));

    // 9. Rendera enheter (depth 18)
    const unitRenderer = new UnitRenderer(this, tileMap, unitManager, nationManager, mapData);

    // 10. Starta i en overview som täcker hela canvasen.
    this.cameras.main.setZoom(overviewZoom);
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);

    // 11. Turordning
    const turnManager = new TurnManager(nationManager, gameSpeed, scenarioJson.meta);
    unitManager.setCurrentRoundProvider(() => turnManager.getCurrentRound());

    // World chronicle (History panel). Records major events as they happen and
    // persists with the save. Subscriptions to game events are wired below once
    // the source systems exist.
    const historicalTimeline = new HistoricalTimelineService(
      () => turnManager.getCurrentRound(),
      () => turnManager.getGameDateLabel(),
    );
    const timelineNationName = (nationId: string): string =>
      nationManager.getNation(nationId)?.name ?? nationId;
    // Permanent right-side History panel (always present, collapsible).
    const timelinePanel = new TimelinePanel(historicalTimeline);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timelinePanel.shutdown());

    // 11b. Discovery system — tracks which nations have met each other
    const discoverySystem = new DiscoverySystem(
      nationManager, cityManager, unitManager, gridSystem,
    );
    discoverySystem.scan();
    updateFog();

    // 11c. Event log — strategic history filtered by discovery
    const eventLog = new EventLogSystem(discoverySystem, data.humanNationId);
    const policySystem = new PolicySystem(nationManager);
    const wonderSystem = new WonderSystem();
    let corporationSystem: CorporationSystem | undefined;
    const territoryExpansionBonusSystem = new TerritoryExpansionBonusSystem(gridSystem, cityTerritorySystem);
    let getAvailableLuxuryResourceQuantities: (
      nationId: string,
    ) => ReadonlyArray<{ readonly resourceId: string; readonly quantity: number }> = () => [];
    let cultureEffectSystem: CultureEffectSystem;
    let getMilitaryUnhappiness: (nationId: string) => number = () => 0;
    let getCityCountPressure: (nationId: string) => number = () => 0;
    let getDistancePressure: (nationId: string) => number = () => 0;
    let getConqueredCityUnhappiness: (nationId: string) => number = () => 0;
    let getWarWeariness: (nationId: string) => number = () => 0;
    const happinessSystem = new HappinessSystem(
      nationManager,
      cityManager,
      (nationId) => wonderSystem.getNationModifiers(nationId),
      (nationId) => getAvailableLuxuryResourceQuantities(nationId),
      policySystem,
      (nationId) => cultureEffectSystem?.getCultureHappinessBonus(nationId) ?? 0,
      (nationId) => corporationSystem?.getNationHappinessBonus(nationId) ?? 0,
      (nationId) => getMilitaryUnhappiness(nationId),
      (nationId) => getCityCountPressure(nationId),
      (nationId) => getDistancePressure(nationId),
      (nationId) => getConqueredCityUnhappiness(nationId),
      (nationId) => getWarWeariness(nationId),
    );
    const formatLog = createAILogFormatter({
      nationManager,
      turnManager,
      eraSystem,
      happinessSystem,
    });
    const isAINation = (nationId: string): boolean => nationManager.getNation(nationId)?.isHuman === false;
    const logManager = new LogManager({ turnManager, nationManager, eraSystem, happinessSystem, eventLog });
    const cultureSystem = new CultureSystem(
      nationManager,
      () => turnManager.getCurrentRound(),
      undefined,
      gameSpeed,
      undefined,
      (nationId, message) => logManager.info({ nationId, category: 'culture', message }),
      (nationId) => happinessSystem.getNetHappiness(nationId),
    );
    cultureEffectSystem = new CultureEffectSystem(
      nationManager,
      (nationId) => happinessSystem.getNetHappiness(nationId),
      (nationId, message) => logManager.info({ nationId, category: 'culture', message }),
    );
    const humanNeedsCultureSelection = (): boolean => {
      if (!humanNationId) return false;
      return !cultureSystem.getCurrentCultureNode(humanNationId)
        && cultureSystem.getAvailableCultureNodes(humanNationId).length > 0;
    };
    let getTradeGoldPerTurnDelta: (nationId: string) => number = () => 0;
    let refreshCultureOverlay = (): void => {};
    let isAutoplayActive = (): boolean => false;
    const rebuildMinimapForGameplay = (): void => {
      if (isAutoplayActive()) return;
      this.minimapHud?.rebuild();
    };
    const resourceSystem = new ResourceSystem(
      nationManager,
      cityManager,
      turnManager,
      new TileResourceGenerator(),
      mapData,
      gridSystem,
      happinessSystem,
      (nationId) => wonderSystem.getNationModifiers(nationId),
      gameSpeed,
      (nationId) => getTradeGoldPerTurnDelta(nationId),
      policySystem,
      cultureEffectSystem,
      culturalSphereSystem,
      wonderSystem,
      () => refreshCultureOverlay(),
    );
    const unitUpkeepSystem = new UnitUpkeepSystem(
      nationManager,
      unitManager,
      resourceSystem,
      mapData,
      cityManager,
      policySystem,
      (nationId, message) => logManager.info({ nationId, category: 'upkeep', message }),
    );
    turnManager.on('turnStart', (e) => unitUpkeepSystem.handleTurnStart(e));

    // 12. Selection-system (hover depth 20, selection depth 21)
    const selectionManager = new SelectionManager(
      this, tileMap, this.cameraController, cityManager, unitManager, worldInputGate,
    );
    const pathfindingSystem = new PathfindingSystem(mapData, unitManager, gridSystem, nationManager);
    const pathPreviewRenderer = new PathPreviewRenderer(this, tileMap);
    const invalidTileFeedbackRenderer = new InvalidTileFeedbackRenderer(this, tileMap);
    const rangedPreviewRenderer = new RangedPreviewRenderer(this, tileMap);
    const productionSystem = new ProductionSystem(cityManager, turnManager, happinessSystem, gameSpeed, policySystem);
    const cityBannerTooltip = new Tooltip(this, (obj) => { this.add.existing(obj); return obj; });
    const cityBannerRenderer = new CityBannerRenderer(
      this,
      tileMap,
      cityManager,
      nationManager,
      productionSystem,
      wonderSystem,
      cityBannerTooltip,
    );
    let rangedTargets = new Set<string>();
    const cityWorkTileRenderer = new CityWorkTileRenderer(this, tileMap, cityManager, mapData, gridSystem);
    const buildingPlacementSystem = new BuildingPlacementSystem();
    const wonderPlacementSystem = new WonderPlacementSystem();
    const cityViewRenderer = new CityViewRenderer(
      this,
      tileMap,
      mapData,
      cityTerritorySystem,
      gridSystem,
      productionSystem,
    );
    const cityViewInteraction = new CityViewInteractionController(cityTerritorySystem);
    const cultureClaimTileRenderer = new CultureClaimTileRenderer(
      this,
      tileMap,
      nationManager,
      mapData,
      cityTerritorySystem,
      data.humanNationId,
    );
    let reachableTiles = new Set<string>();
    const unitActionToolbox = new UnitActionToolbox(humanNationId);
    let suppressPromote = false;

    // 13. Produktionssystem
    const tileBuildingRenderer = new TileBuildingRenderer(this, tileMap, mapData, productionSystem);
    const tileImprovementOverlayRenderer = new TileImprovementOverlayRenderer(this, tileMap, mapData);
    tileImprovementOverlayRenderer.rebuildAll();
    let hudLayer: HudLayer | null = null;
    let rightPanel: RightSidebarPanelDataProvider | null = null;
    let leaderStrip: LeaderPortraitStrip | null = null;
    let mapLensMode: MapLensMode = DEFAULT_MAP_LENS;
    const applyMapLensMode = (): void => {
      cultureLayerRenderer.setVisible(mapLensMode === 'culture');
      hudLayer?.setMapLensMode(mapLensMode);
    };
    refreshCultureOverlay = (): void => {
      cultureLayerRenderer.refresh();
    };
    const toggleMapLens = (): void => {
      mapLensMode = mapLensMode === 'culture' ? 'normal' : 'culture';
      refreshCultureOverlay();
      applyMapLensMode();
    };
    refreshCultureOverlay();
    const cityView = new CityView();
    let cityViewDismissedCityId: string | null = null;

    // 13b. Diplomacy system
    const diplomacyManager = new DiplomacyManager(turnManager);
    const unitLifetimeSystem = new UnitLifetimeSystem(
      unitManager,
      nationManager,
      diplomacyManager,
      (nationId, message) => logManager.info({ nationId, category: 'unit', message }),
      (unit) => {
        const selected = selectionManager.getSelected();
        if (selected?.kind === 'unit' && selected.unit.id === unit.id) {
          selectionManager.clearSelection();
        }
      },
    );
    turnManager.on('roundStart', (event) => unitLifetimeSystem.handleRoundStart(event.round));
    const diplomaticMemorySystem = new DiplomaticMemorySystem(diplomacyManager);
    diplomacyManager.attachMemoryHook(diplomaticMemorySystem);
    // Tracks one-time symbolic-gift milestones (player's gift reward + the AI's
    // reciprocal first-meeting courtesy) per nation pair.
    const symbolicGiftRegistry = new SymbolicGiftRegistry();
    const allianceManager = new AllianceManager();
    // Alliance partners cannot declare war on each other (central rule).
    diplomacyManager.setAllianceGuard((a, b) => allianceManager.areAllied(a, b));
    const tradeDiplomacySystem = new TradeDiplomacySystem(diplomacyManager);
    const diplomaticEvaluationSystem = new DiplomaticEvaluationSystem(diplomacyManager);
    const ideologicalDriftSystem = new IdeologicalDriftSystem(
      diplomacyManager,
      nationManager,
      (a, b) => discoverySystem.hasMet(a, b),
    );
    const aiMilitaryEvaluationSystem = new AIMilitaryEvaluationSystem(unitManager, cityManager, allianceManager, diplomacyManager);
    const aiMilitaryThreatEvaluationSystem = new AIMilitaryThreatEvaluationSystem(unitManager, cityManager, gridSystem);
    const jointWarSystem = new JointWarSystem(
      diplomacyManager,
      diplomaticEvaluationSystem,
      aiMilitaryEvaluationSystem,
      allianceManager,
      nationManager,
      (a, b) => discoverySystem.hasMet(a, b),
    );
    const borderPressureSystem = new BorderPressureSystem(
      diplomacyManager,
      cityManager,
      nationManager,
      mapData,
      gridSystem,
      aiMilitaryEvaluationSystem,
      (a, b) => discoverySystem.hasMet(a, b),
    );
    const foreignTroopViolationSystem = new ForeignTroopViolationSystem(
      diplomacyManager,
      nationManager,
      unitManager,
      mapData,
    );
    const peaceTreatySystem = new PeaceTreatySystem(
      cityManager,
      nationManager,
      resourceSystem,
      diplomacyManager,
      mapData,
      gridSystem,
      productionSystem,
      aiMilitaryEvaluationSystem,
      aiMilitaryThreatEvaluationSystem,
      diplomaticEvaluationSystem,
    );

    const aiDiplomacySystem = new AIDiplomacySystem(
      diplomacyManager,
      diplomaticEvaluationSystem,
      nationManager,
      turnManager,
      aiMilitaryEvaluationSystem,
      aiMilitaryThreatEvaluationSystem,
      (a, b) => discoverySystem.hasMet(a, b),
      formatLog,
      (nationId) => resolveLeaderEraStrategy(
        getLeaderByNationId(nationId)?.id,
        eraSystem.getNationEra(nationId),
      ),
      peaceTreatySystem,
    );
    const tradeDealSystem = new TradeDealSystem(
      diplomacyManager,
      () => turnManager.getCurrentRound(),
      {
        getGold: (nationId) => nationManager.getResources(nationId).gold,
        addGold: (nationId, amount) => {
          resourceSystem.addGold(nationId, amount);
        },
      },
      (nationId) => nationManager.getNation(nationId) !== undefined,
    );
    getTradeGoldPerTurnDelta = (nationId) =>
      tradeDealSystem.getGoldPerTurnDeltaForNation(nationId);
    const tradeConnectionSystem = new TradeConnectionSystem(
      cityManager,
      diplomacyManager,
      nationManager,
      (message, nationId) => logManager.info({ nationId, category: 'diplomacy', message }),
    );
    const resourceAccessSystem = new ResourceAccessSystem(mapData, tradeDealSystem);
    const resourceCitySearchSystem = new ResourceCitySearchSystem(mapData, cityManager, nationManager);
    getAvailableLuxuryResourceQuantities = (nationId) =>
      resourceAccessSystem.getAvailableLuxuryResourceQuantities(nationId);
    happinessSystem.recalculateAll();
    const strategicResourceCapacitySystem = new StrategicResourceCapacitySystem(resourceAccessSystem, unitManager);
    const unitProductionRuleContext = {
      strategicResourceCapacitySystem,
      unitUpkeepAffordability: unitUpkeepSystem,
      upkeepAffordabilityTurns: 10,
      hasActiveUnitOfType: (nationId: string, unitTypeId: string) =>
        unitManager.getUnitsByOwner(nationId).some((unit) => unit.unitType.id === unitTypeId),
      isResidenceCapital: (city: City) => city.isResidenceCapital,
      getNationEra: (nationId: string) => eraSystem.getNationEra(nationId),
    };
    tradeDealSystem.setCanExportResource((sellerNationId, resourceId) =>
      resourceAccessSystem.canExportResource(sellerNationId, resourceId),
    );
    tradeDealSystem.setConnectionCapacityProvider((a, b) =>
      tradeConnectionSystem.getActiveDealCapacityBetweenNations(a, b),
    );
    // Human deals use directional import/export capacity (see TradeDealSystem).
    tradeDealSystem.setHumanNationId(humanNationId);
    turnManager.on('turnStart', (e) => tradeDealSystem.advanceTurnForNation(e.nation.id));
    const ideologicalDriftEvents: IdeologicalDriftEvent[] = [];
    const ideologicalDriftLogCooldowns = new Map<string, number>();
    const borderPressureEvents: BorderPressureEvent[] = [];
    const borderPressureLogCooldowns = new Map<string, number>();
    ideologicalDriftSystem.onDrift((event) => ideologicalDriftEvents.push(event));
    borderPressureSystem.onPressure((event) => borderPressureEvents.push(event));
    turnManager.on('roundStart', (event) => {
      ideologicalDriftEvents.length = 0;
      borderPressureEvents.length = 0;
      ideologicalDriftSystem.handleRoundStart(event.round);
      borderPressureSystem.handleRoundStart(event.round);
      const summary = formatIdeologicalDriftSummary(
        event.round,
        ideologicalDriftEvents,
        ideologicalDriftLogCooldowns,
      );
      if (summary) {
        logManager.info({ nationIds: summary.nationIds, category: 'diplomacy', message: summary.text });
      }
      const borderPressureSummary = formatBorderPressureSummary(
        event.round,
        borderPressureEvents,
        borderPressureLogCooldowns,
      );
      if (borderPressureSummary) {
        logManager.info({ nationIds: borderPressureSummary.nationIds, category: 'diplomacy', message: borderPressureSummary.text });
      }
      if ((ideologicalDriftEvents.length > 0 || borderPressureEvents.length > 0) && !isAutoplayActive()) {
        rightPanel?.requestRefresh();
      }
    });
    const militaryUnhappinessSystem = new MilitaryUnhappinessSystem(unitManager, diplomacyManager, nationManager);
    getMilitaryUnhappiness = (nationId) => militaryUnhappinessSystem.getUnhappiness(nationId);

    const imperialOverstretchSystem = new ImperialOverstretchSystem(cityManager, gridSystem);
    getCityCountPressure = (nationId) => imperialOverstretchSystem.getCityCountPressure(nationId);
    getDistancePressure = (nationId) => imperialOverstretchSystem.getDistancePressure(nationId);

    const conqueredCityUnhappinessSystem = new ConqueredCityUnhappinessSystem(cityManager);
    getConqueredCityUnhappiness = (nationId) => conqueredCityUnhappinessSystem.getUnhappiness(nationId);
    turnManager.on('roundStart', () => conqueredCityUnhappinessSystem.handleRoundStart());
    turnManager.on('roundStart', () => updateFog());
    turnManager.on('roundStart', (event) => {
      tradeDiplomacySystem.onRoundEnd(
        event.round,
        tradeConnectionSystem.getAllConnections(),
        tradeDealSystem.getAllDeals(),
      );
    });

    const warWearinessSystem = new WarWearinessSystem(nationManager, diplomacyManager, () => turnManager.getCurrentRound());
    getWarWeariness = (nationId) => warWearinessSystem.getWarWeariness(nationId);

    diplomacyManager.onWarDeclared((aggressorId, targetId) => {
      tradeDealSystem.cancelDealsBetween(aggressorId, targetId, 'war');
      const cancelledConns = tradeConnectionSystem.cancelConnectionsBetweenNations(aggressorId, targetId);
      if (cancelledConns.length > 0) {
        tradeDiplomacySystem.onWarWithTrade(aggressorId, targetId);
      }
      for (const conn of cancelledConns) {
        const fromCity = cityManager.getCity(conn.cityAId);
        const toCity = cityManager.getCity(conn.cityBId);
        const routeLabel = `${fromCity?.name ?? conn.cityAId} ↔ ${toCity?.name ?? conn.cityBId}`;
        logManager.info({
          nationIds: [aggressorId, targetId],
          category: 'diplomacy',
          message: `Trade connection ${routeLabel} was severed by war.`,
        });
        // Remove any building queue item that referenced this connection
        const queue = productionSystem.getQueue(conn.cityAId);
        const idx = queue.findIndex((e) => {
          const item = e.item;
          return item.kind === 'tradeRoute' && item.connectionId === conn.id;
        });
        if (idx >= 0) productionSystem.removeFromQueue(conn.cityAId, idx);
      }
      // Snapshot military strength at war start so war-exhaustion ratios are meaningful.
      diplomacyManager.snapshotWarStartStrength(aggressorId, targetId, aiMilitaryEvaluationSystem.getMilitaryStrength(aggressorId).totalStrength);
      diplomacyManager.snapshotWarStartStrength(targetId, aggressorId, aiMilitaryEvaluationSystem.getMilitaryStrength(targetId).totalStrength);
    });
    tradeDealSystem.onChanged((event) => {
      resourceSystem.recalculateForNation(event.deal.sellerNationId);
      resourceSystem.recalculateForNation(event.deal.buyerNationId);
      if (isAutoplayActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });

    const diplomaticProposalSystem = new DiplomaticProposalSystem();

    turnManager.on('turnStart', (e) => diplomaticProposalSystem.update(e.round));

    const shouldAutoplayAcceptPeace = (proposal: { fromNationId: string; toNationId: string; offeredCityId?: string; goldReparations?: number; warDuration: number }): boolean => {
      return peaceTreatySystem.aiShouldAcceptTreaty(proposal, proposal.toNationId);
    };

    const logTreatyDetails = (proposal: { fromNationId: string; toNationId: string; offeredCityId?: string; goldReparations?: number; warDuration: number }): void => {
      const fromName = nationManager.getNation(proposal.fromNationId)?.name ?? proposal.fromNationId;
      const toName = nationManager.getNation(proposal.toNationId)?.name ?? proposal.toNationId;
      logManager.info({
        nationIds: [proposal.fromNationId, proposal.toNationId],
        category: 'diplomacy',
        message: `${fromName} proposed peace to ${toName} after ${proposal.warDuration} turn${proposal.warDuration === 1 ? '' : 's'} of war.`,
      });
      if (proposal.offeredCityId) {
        const city = cityManager.getCity(proposal.offeredCityId);
        if (city) {
          logManager.info({
            nationIds: [proposal.fromNationId, proposal.toNationId],
            category: 'diplomacy',
            message: `${fromName} offered city ${city.name} to ${toName} as part of the peace treaty.`,
          });
        }
      }
      if (proposal.goldReparations && proposal.goldReparations > 0) {
        logManager.info({
          nationIds: [proposal.fromNationId, proposal.toNationId],
          category: 'diplomacy',
          message: `${fromName} offered ${proposal.goldReparations} gold in war reparations to ${toName}.`,
        });
      }
    };

    const logAutoplayPeaceResolution = (proposal: { fromNationId: string; toNationId: string; offeredCityId?: string; goldReparations?: number; warDuration: number }, accepted: boolean): void => {
      const fromName = nationManager.getNation(proposal.fromNationId)?.name ?? proposal.fromNationId;
      const toName = nationManager.getNation(proposal.toNationId)?.name ?? proposal.toNationId;
      logManager.info({
        nationIds: [proposal.fromNationId, proposal.toNationId],
        category: 'diplomacy',
        message: `${toName} ${accepted ? 'accepted' : 'rejected'} ${fromName}'s peace offer during autoplay.`,
      });
    };

    diplomaticProposalSystem.onCreated((proposal) => {
      if (proposal.toNationId !== humanNationIdForDiplomacy) return;
      if (isAutoplayActive()) {
        if (proposal.payload.kind === 'peace') {
          const peaceProposal = diplomacyManager.getPendingProposal(proposal.toNationId)
            ?? { fromNationId: proposal.fromNationId, toNationId: proposal.toNationId, warDuration: 0 };
          const accepted = shouldAutoplayAcceptPeace(peaceProposal);
          if (accepted) diplomaticProposalSystem.acceptProposal(proposal.id);
          else diplomaticProposalSystem.rejectProposal(proposal.id);
          logAutoplayPeaceResolution(peaceProposal, accepted);
        }
        return;
      }
      hudLayer?.enqueueProposal(proposal);
    });
    diplomaticProposalSystem.onExpired((proposal) => {
      if (proposal.toNationId !== humanNationIdForDiplomacy) return;
      hudLayer?.dismissProposal(proposal.id);
    });
    diplomaticProposalSystem.onAccepted((proposal) => {
      const fromId = proposal.fromNationId;
      const toId = proposal.toNationId;
      switch (proposal.payload.kind) {
        case 'open_borders': {
          if (!diplomacyManager.isOpenBorderGrantedFrom(fromId, toId)) {
            diplomacyManager.toggleOpenBorders(fromId, toId);
          }
          break;
        }
        case 'embassy': {
          diplomacyManager.establishEmbassy(fromId, toId);
          break;
        }
        case 'peace': {
          diplomacyManager.proposePeace(fromId, toId);
          diplomacyManager.respondToPeace(fromId, toId, true);
          break;
        }
        case 'resource_trade': {
          const sellerNationId = proposal.payload.sellerNationId ?? fromId;
          const buyerNationId = proposal.payload.buyerNationId ?? toId;
          tradeDealSystem.createDeal({
            sellerNationId,
            buyerNationId,
            resourceId: proposal.payload.resourceId,
            turns: proposal.payload.turns,
            goldPerTurn: proposal.payload.goldPerTurn,
          });
          tradeDiplomacySystem.onTradeProposalAccepted(fromId, toId);
          break;
        }
        case 'gold_trade': {
          const amount = proposal.payload.goldAmount;
          if (amount > 0) {
            resourceSystem.addGold(fromId, -amount);
            resourceSystem.addGold(toId, amount);
          }
          break;
        }
      }
      const fromName = nationManager.getNation(fromId)?.name ?? fromId;
      const toName = nationManager.getNation(toId)?.name ?? toId;
      logManager.info({
        nationId: fromId,
        nationIds: [fromId, toId],
        category: 'diplomacy',
        message: `${toName} accepted ${formatProposalKind(proposal.payload.kind)} from ${fromName}.`,
      });
    });
    diplomaticProposalSystem.onRejected((proposal) => {
      const fromName = nationManager.getNation(proposal.fromNationId)?.name ?? proposal.fromNationId;
      const toName = nationManager.getNation(proposal.toNationId)?.name ?? proposal.toNationId;
      logManager.info({
        nationId: proposal.fromNationId,
        nationIds: [proposal.fromNationId, proposal.toNationId],
        category: 'diplomacy',
        message: `${toName} rejected ${formatProposalKind(proposal.payload.kind)} from ${fromName}.`,
      });
    });

    diplomaticProposalSystem.onCreated((proposal) => {
      if (proposal.payload.kind !== 'resource_trade') return;
      if (proposal.toNationId !== humanNationIdForDiplomacy) return;
      const fromName = nationManager.getNation(proposal.fromNationId)?.name ?? proposal.fromNationId;
      const resourceName = proposal.payload.resourceId;
      const humanIsSeller = proposal.payload.sellerNationId === proposal.toNationId;
      const action = humanIsSeller ? `offered to buy ${resourceName} trade from` : `offered ${resourceName} trade to`;
      logManager.info({
        nationIds: [proposal.fromNationId, proposal.toNationId],
        category: 'diplomacy',
        message: `${fromName} ${action} you.`,
      });
    });
    aiDiplomacySystem.onDecision((reason) => {
      const targetName = nationManager.getNation(reason.targetNationId)?.name ?? reason.targetNationId;
      logManager.info({
        nationId: reason.actorNationId,
        nationIds: [reason.actorNationId, reason.targetNationId],
        category: 'diplomacy',
        message: `${formatAIDiplomacyAction(reason.action, targetName)} Reason: ${reason.reasonText}`,
      });
    });
    const researchSystem = new ResearchSystem(
      nationManager,
      cityManager,
      () => turnManager.getCurrentRound(),
      (nationId) => cityManager.getCitiesByOwner(nationId)
        .reduce((sum, city) => sum + calculateCityEconomy(
          city,
          mapData,
          cityManager.getBuildings(city.id),
          gridSystem,
          wonderSystem.getNationModifiers(nationId),
        ).science, 0),
      gameSpeed,
      undefined,
      (nationId, message) => logManager.info({ nationId, category: 'research', message }),
    );
    // Practical trade connections require Trade Networks on at least one side.
    tradeDealSystem.setHasTradeNetworks((nationId) =>
      researchSystem.isResearched(nationId, 'trade_networks'),
    );
    corporationSystem = new CorporationSystem(
      nationManager,
      cityManager,
      {
        researchSystem,
        resourceAccessSystem,
        logEvent: (nationId, message) => logManager.info({ nationId, category: 'corporation', message }),
        getCurrentTurn: () => turnManager.getCurrentRound(),
        grantCultureBurst: (nationId, amount) => {
          nationManager.getResources(nationId).culture += amount;
          const originCity = cityManager.getCitiesByOwner(nationId)
            .find((city) => city.isCapital)
            ?? cityManager.getCitiesByOwner(nationId)[0];
          if (!originCity) return;

          const maxTiles = Math.max(1, Math.min(4, Math.ceil(amount / 20)));
          const burst = culturalSphereSystem.triggerCulturalBurst(originCity, mapData, gridSystem, {
            radius: 1,
            maxTiles,
            allowOverwrite: true,
          });
          if (burst.claimedTiles + burst.convertedTiles > 0) {
            refreshCultureOverlay();
          }
        },
        recalculateHappiness: (nationId) => happinessSystem.recalculateNation(nationId),
      },
    );
    resourceAccessSystem.setManufacturedResourceProvider((nationId) =>
      corporationSystem?.getNationManufacturedResources(nationId) ?? new Map(),
    );
    const humanNeedsResearchSelection = (): boolean => {
      if (!humanNationId) return false;
      return !researchSystem.getCurrentResearch(humanNationId)
        && researchSystem.getAvailableTechnologies(humanNationId).length > 0;
    };
    const openPendingHumanSelectionPanels = (): void => {
      if (hudLayer?.hasBlockingModal()) return;
      if (humanNeedsResearchSelection()) {
        hudLayer?.openResearchPanel();
      } else if (humanNeedsCultureSelection()) {
        hudLayer?.openCulturePanel();
      }
    };
    const buildTechnologyDiscoveryPopupData = (technology: TechnologyDefinition): DiscoveryPopupData => ({
      title: technology.name,
      imageKey: getTechnologySpriteKey(technology.id),
      imagePath: getTechnologySpritePath(technology.id),
      description: technology.description,
      unlockRows: technology.unlocks.map((unlock) => buildTechnologyUnlockRow(unlock)),
      leadsToRows: technology.leadsTo.map((technologyId) => {
        const leadTechnology = getTechnologyById(technologyId);
        return {
          label: leadTechnology?.name ?? technologyId,
          imageKey: getTechnologySpriteKey(technologyId),
          imagePath: getTechnologySpritePath(technologyId),
          fallbackLabel: getDiscoveryFallbackLabel(leadTechnology?.name ?? technologyId),
        };
      }),
    });
    const buildTechnologyUnlockRow = (unlock: TechnologyUnlock): DiscoveryPopupRow => {
      switch (unlock.kind) {
        case 'unit': {
          const unitType = getUnitTypeById(unlock.id);
          const label = unitType?.name ?? unlock.id;
          return {
            label,
            imageKey: getUnitSpriteKey(unlock.id),
            imagePath: getUnitSpritePath(unlock.id),
            fallbackLabel: getDiscoveryFallbackLabel(label),
          };
        }
        case 'building': {
          const building = getBuildingById(unlock.id);
          const label = building?.name ?? unlock.id;
          return {
            label,
            imageKey: getBuildingSpriteKey(unlock.id),
            imagePath: getBuildingSpritePath(unlock.id),
            fallbackLabel: getDiscoveryFallbackLabel(label),
          };
        }
        case 'wonder': {
          const wonder = getWonderById(unlock.id);
          const label = wonder?.name ?? unlock.id;
          return {
            label,
            imageKey: getWonderSpriteKey(unlock.id),
            imagePath: getWonderSpritePath(unlock.id),
            fallbackLabel: getDiscoveryFallbackLabel(label),
          };
        }
        case 'improvement': {
          const improvement = getImprovementById(unlock.id);
          const label = improvement?.name ?? unlock.id;
          return {
            label,
            fallbackLabel: getDiscoveryFallbackLabel(label),
          };
        }
      }
    };
    const buildCultureDiscoveryPopupData = (cultureNode: CultureNode): DiscoveryPopupData => ({
      title: cultureNode.name,
      imageKey: getCultureSpriteKey(cultureNode.id),
      imagePath: getCultureSpritePath(cultureNode.id),
      description: cultureNode.description,
      unlockRows: cultureNode.unlocks.map((unlock) => buildCultureUnlockRow(unlock)),
      leadsToRows: getCultureLeadsTo(cultureNode.id).map((nextNode) => ({
        label: nextNode.name,
        imageKey: getCultureSpriteKey(nextNode.id),
        imagePath: getCultureSpritePath(nextNode.id),
        fallbackLabel: getDiscoveryFallbackLabel(nextNode.name),
      })),
    });
    const buildCultureUnlockRow = (unlock: CultureUnlock): DiscoveryPopupRow => {
      switch (unlock.type) {
        case 'unit': {
          const unitType = getUnitTypeById(unlock.value);
          const label = unitType?.name ?? formatCultureUnlockValue(unlock.value);
          return {
            label,
            imageKey: getUnitSpriteKey(unlock.value),
            imagePath: getUnitSpritePath(unlock.value),
            fallbackLabel: getDiscoveryFallbackLabel(label),
          };
        }
        case 'building': {
          const building = getBuildingById(unlock.value);
          const label = building?.name ?? formatCultureUnlockValue(unlock.value);
          return {
            label,
            imageKey: getBuildingSpriteKey(unlock.value),
            imagePath: getBuildingSpritePath(unlock.value),
            fallbackLabel: getDiscoveryFallbackLabel(label),
          };
        }
        case 'government': {
          const label = formatCultureUnlockValue(unlock.value);
          return {
            label,
            fallbackLabel: getDiscoveryFallbackLabel(label),
          };
        }
        case 'policySlot': {
          const label = `${formatCultureUnlockValue(unlock.value)} Policy Slot`;
          return {
            label,
            fallbackLabel: getDiscoveryFallbackLabel(label),
          };
        }
        case 'policy': {
          const label = `${formatCultureUnlockValue(unlock.value)} Policy`;
          return {
            label,
            fallbackLabel: getDiscoveryFallbackLabel(label),
          };
        }
        case 'diplomacy': {
          const label = formatCultureUnlockValue(unlock.value);
          return {
            label,
            fallbackLabel: getDiscoveryFallbackLabel(label),
          };
        }
      }
    };
    const getCultureLeadsTo = (cultureId: string): CultureNode[] => (
      CULTURE_TREE.filter((node) => node.prerequisites?.includes(cultureId) === true)
    );
    const improvementConstructionSystem = new ImprovementConstructionSystem(
      mapData,
      unitManager,
      cityManager,
      policySystem,
    );
    // `diagnostic`/cheat map reveal forces every resource icon visible,
    // bypassing both the reveal-tech gate and fog of war.
    let isMapRevealActive = false;
    // Tech-gate only: whether the human nation has researched the reveal tech
    // for a given resource. Fog of war is applied separately below.
    const isNaturalResourceVisibleToHuman = (resourceId: string): boolean => {
      if (isMapRevealActive) return true;

      const resource = getNaturalResourceById(resourceId);
      if (!resource) return false;
      if (!resource.revealTechId) return true;
      if (!humanNationId) return false;
      return researchSystem.isResearched(humanNationId, resource.revealTechId);
    };
    // Combined predicate the renderer actually uses: the resource must pass the
    // reveal-tech gate AND sit on a tile the human can currently see. Resources
    // are hidden on explored-but-not-visible tiles (fog of war rule).
    const isResourceTileVisibleToHuman = (tileX: number, tileY: number): boolean => {
      const resourceId = mapData.tiles[tileY]?.[tileX]?.resourceId;
      if (!resourceId) return false;
      if (!isNaturalResourceVisibleToHuman(resourceId)) return false;
      if (isMapRevealActive) return true;
      return visibilitySystem.canRenderObjectAt(tileX, tileY);
    };
    const revealMapResourcesTemporarily = (): void => {
      isMapRevealActive = true;
      naturalResourceRenderer.rebuildAll();
    };
    const clearTemporaryMapReveal = (): void => {
      if (!isMapRevealActive) return;
      isMapRevealActive = false;
      naturalResourceRenderer.rebuildAll();
    };
    const isNaturalResourceRevealTechnology = (technologyId: string): boolean => (
      NATURAL_RESOURCES.some((resource) => resource.revealTechId === technologyId)
    );
    naturalResourceRenderer.setVisibilityPredicate(isResourceTileVisibleToHuman);
    naturalResourceRenderer.rebuildAll();

    // ── Fog of war: gate every map object by current human visibility ──────────
    // Cities, units, borders, tile buildings and improvements only render on
    // tiles the human player can currently see. Human-owned cities/units always
    // generate vision, so they remain visible after each recompute.
    const canSeeTile = (tileX: number, tileY: number): boolean =>
      visibilitySystem.canRenderObjectAt(tileX, tileY);
    // Cities are permanent intelligence: a discovered city stays on the map even
    // when it leaves vision. Other objects (units, borders, resources,
    // improvements) still require current vision.
    const canShowCity = (tileX: number, tileY: number): boolean => {
      if (visibilitySystem.canRenderObjectAt(tileX, tileY)) return true;
      const city = cityManager.getCityAt(tileX, tileY);
      return city !== undefined && visibilitySystem.isKnownCity(city.id);
    };
    cityRenderer.setVisibilityPredicate(canShowCity);
    cityBannerRenderer.setVisibilityPredicate(canShowCity);
    unitRenderer.setVisibilityPredicate(canSeeTile);
    territoryRenderer.setVisibilityPredicate(canSeeTile);
    tileBuildingRenderer.setVisibilityPredicate(canSeeTile);
    tileImprovementOverlayRenderer.setVisibilityPredicate(canSeeTile);
    selectionManager.setVisibilityPredicates(
      (x, y) => visibilitySystem.isTileVisibleToHuman(x, y),
      (x, y) => visibilitySystem.isTileExploredByHuman(x, y),
    );

    // Re-cull all fog-dependent renderers after a visibility recompute.
    applyFogToRenderers = (): void => {
      cityRenderer.refreshAllVisibility();
      cityBannerRenderer.refreshAllVisibility();
      unitRenderer.refreshAllVisibility();
      territoryRenderer.invalidate();
      naturalResourceRenderer.rebuildAll();
      tileBuildingRenderer.rebuildAll();
      tileImprovementOverlayRenderer.rebuildAll();
      this.minimapHud?.rebuild();
    };
    // Apply fog now that all renderers and predicates are wired.
    updateFog();

    resourceAccessSystem.setResourceUsabilityPredicate((nationId, resourceId) => {
      const resource = getNaturalResourceById(resourceId);
      if (!resource) return false;
      if (!resource.requiredTechId) return true;
      return researchSystem.isResearched(nationId, resource.requiredTechId);
    });
    happinessSystem.recalculateAll();
    for (const nation of nationManager.getAllNations()) {
      resourceSystem.recalculateForNation(nation.id);
    }

    if (!data.savedState && humanNationId) {
      if (!researchSystem.getCurrentResearch(humanNationId)) {
        researchSystem.startResearch(humanNationId, 'agriculture');
      }
      if (!cultureSystem.getCurrentCultureNode(humanNationId)) {
        cultureSystem.startCultureNode(humanNationId, 'code_of_laws');
      }
    }

    const exileProtectionSystem = new ExileProtectionSystem(
      cityManager,
      unitManager,
      nationManager,
      diplomacyManager,
      mapData,
      turnManager,
      (a, b) => discoverySystem.hasMet(a, b),
      (nationId) => getAvailableLuxuryResourceQuantities(nationId).map((entry) => entry.resourceId),
    );
    const cityDefenseSystem = new CityDefenseSystem(unitManager);

    // 14. Stridssystem
    const combatSystem = new CombatSystem(
      unitManager,
      turnManager,
      cityManager,
      productionSystem,
      mapData,
      diplomacyManager,
      gridSystem,
      (unit) => improvementConstructionSystem.isUnitBusy(unit.id),
      policySystem,
      (attacker, target) => exileProtectionSystem.getProtectorForProtectedLeaderTarget(attacker.ownerId, target),
      cityDefenseSystem,
    );
    const nationCollapseSystem = new NationCollapseSystem(
      cityManager,
      unitManager,
      nationManager,
      turnManager,
      mapData,
      productionSystem,
      diplomacyManager,
      gridSystem,
      tradeDealSystem,
      exileProtectionSystem,
    );
    const politicalCapitalSystem = new PoliticalCapitalSystem(
      cityManager,
      unitManager,
      nationManager,
      turnManager,
      nationCollapseSystem,
    );
    const leaderCaptureSystem = new LeaderCaptureSystem(
      cityManager,
      unitManager,
      nationManager,
      mapData,
      gridSystem,
      diplomacyManager,
      nationCollapseSystem,
      (nationId) => nationManager.getNation(nationId)?.isHuman === true,
    );
    const unitUpgradeSystem = new UnitUpgradeSystem(
      nationManager,
      unitManager,
      researchSystem,
      {
        logEvent: (nationId, message) => logManager.info({ nationId, category: 'unit', message }),
      },
    );
    // Unit action toolbox modes run before movement and culture claim.
    const builderSystem = new BuilderSystem(
      unitManager,
      cityManager,
      turnManager,
      mapData,
      gridSystem,
      researchSystem,
      eraSystem,
    );
    unitActionToolbox.setBuildAvailabilityProvider(builderSystem);
    unitActionToolbox.setDismissAvailabilityProvider(unitManager);
    unitActionToolbox.setUpgradeAvailabilityProvider(unitUpgradeSystem);
    let foundCitySystem: FoundCitySystem;
    let movementSystem: MovementSystem;
    let selectedBuilderForHints: Unit | null = null;
    const performFoundCityAction = (unit: Unit): boolean => {
      const city = foundCitySystem.foundCity(unit);
      if (!city) return false;

      selectedBuilderForHints = null;
      unitActionToolbox.setSelectedUnit(null);
      reachableTiles = new Set<string>();
      pathPreviewRenderer.clear();
      if (city.ownerId === humanNationId) {
        cityViewDismissedCityId = null;
        selectionManager.selectCity(city);
      } else {
        rightPanel?.clear();
      }
      cityBannerRenderer.refreshCity(city);
      hudLayer?.refresh();
      return true;
    };
    const performBuildImprovementAction = (unit: Unit): boolean => {
      const tile = mapData.tiles[unit.tileY]?.[unit.tileX];
      if (!tile) return false;

      const result = builderSystem.build(unit, tile, {
        consumeMovement: true,
        requireMovement: true,
      });
      if (!result) return false;
      unit.queuedDestination = undefined;

      const locationLabel = result.city ? `near ${result.city.name}` : 'on a sea resource';
      logManager.info({
        nationId: unit.ownerId,
        category: 'improvement',
        message: `started building ${result.improvement.name} ${locationLabel}.`,
      });

      reachableTiles = new Set<string>();
      pathPreviewRenderer.clear();
      tileImprovementOverlayRenderer.refreshTile(result.tile.x, result.tile.y);
      rightPanel?.showTile(result.tile);
      rightPanel?.requestRefresh();
      hudLayer?.refresh();
      return true;
    };
    const tryActionAttack = (unit: Unit, targetTile: { x: number; y: number }): boolean => {
      const targetUnit = unitManager.getUnitAt(targetTile.x, targetTile.y);
      const targetCity = cityManager.getCityAt(targetTile.x, targetTile.y);
      const hasEnemyTarget =
        (targetUnit !== null && targetUnit.ownerId !== unit.ownerId) ||
        (targetCity !== undefined && targetCity.ownerId !== unit.ownerId);
      if (!hasEnemyTarget) return false;

      if (combatSystem.tryAttack(unit, targetTile.x, targetTile.y, { source: 'human-ui' })) {
        unit.queuedDestination = undefined;
        return true;
      }

      if (unit.movementPoints <= 0) return false;

      const range = unit.unitType.range ?? 1;
      const targetPositions = range <= 1
        ? gridSystem.getAdjacentCoords(targetTile)
        : gridSystem.getTilesInRange(targetTile, range, mapData, { includeCenter: false });

      const path = pathfindingSystem.findBestPathToAnyTarget(unit, targetPositions, {
        respectMovementPoints: false,
      });
      if (path === null) return false;

      unit.queuedDestination = undefined;
      reachableTiles = new Set<string>();
      pathPreviewRenderer.clear();
      movementSystem.moveAlongPath(unit, path, { source: 'human-ui' });
      combatSystem.tryAttack(unit, targetTile.x, targetTile.y, { source: 'human-ui' });
      return true;
    };

    // ─── Free Selection Mode ─────────────────────────────────────────────────
    // A temporary "look but don't move" state. Entered by clicking the already-
    // selected (human) unit again while in the default move mode. While active,
    // a click selects/inspects whatever is under it instead of issuing a move
    // order. It only suppresses the default move workflow — explicit action
    // modes (Found/Build/Attack/Ranged) and embark/debark are untouched, since
    // those only run when free mode is off (the move handlers below bail out
    // while it is on). The mode ends as soon as the selection changes, the same
    // unit is re-clicked, or an explicit action mode takes over.
    let freeSelectionMode = false;
    const setFreeSelectionMode = (active: boolean): void => {
      if (freeSelectionMode === active) return;
      freeSelectionMode = active;
      selectionManager.setFreeSelectionMode(active);
      this.input.setDefaultCursor(active ? 'help' : 'default');
    };

    selectionManager.onSelectionTarget((target, currentSelection) => {
      if (!freeSelectionMode) {
        // Enter: clicking the already-selected human unit again (default mode only).
        if (
          currentSelection?.kind === 'unit' &&
          target?.kind === 'unit' &&
          target.unit.id === currentSelection.unit.id &&
          currentSelection.unit.ownerId === humanNationId &&
          unitActionToolbox.getMode() === 'move'
        ) {
          setFreeSelectionMode(true);
          return true; // consume: keep the unit selected, issue no order
        }
        return false;
      }

      // An explicit action mode takes precedence over free selection.
      if (unitActionToolbox.getMode() !== 'move') {
        setFreeSelectionMode(false);
        return false;
      }
      // Re-clicking the same unit exits free mode but keeps it selected.
      if (
        target?.kind === 'unit' &&
        currentSelection?.kind === 'unit' &&
        target.unit.id === currentSelection.unit.id
      ) {
        setFreeSelectionMode(false);
        return true; // consume: no toggle-deselect, no move
      }
      // Any other click performs normal selection/inspection. Leave the flag set
      // so the move handlers stay suppressed for this click; the resulting
      // selection change exits free mode (see onSelectionChanged below).
      return false;
    });

    // Selecting anything else naturally ends Free Selection Mode.
    selectionManager.onSelectionChanged(() => {
      if (freeSelectionMode) setFreeSelectionMode(false);
    });
    // Activating any explicit action mode (Found/Build/Attack/Ranged/Sleep/…)
    // takes over from free selection immediately.
    unitActionToolbox.onModeChanged((mode) => {
      if (mode !== 'move' && freeSelectionMode) setFreeSelectionMode(false);
    });

    selectionManager.onSelectionTarget((target, currentSelection) => {
      if (currentSelection?.kind !== 'unit') return false;
      if (freeSelectionMode) return false;

      const targetTile = this.getTileForSelectable(tileMap, target);
      if (targetTile === null) return false;

      const tile = tileMap.getTileAt(targetTile.x, targetTile.y);
      if (tile === null) return false;

      const unit = currentSelection.unit;
      if (unit.ownerId !== humanNationId) return false;
      if (unit.carriedByUnitId !== undefined) return false;
      if (improvementConstructionSystem.isUnitBusy(unit.id)) return true;

      const mode = unitActionToolbox.getMode();
      if (unit.isSleeping) unit.isSleeping = false;
      if (mode === 'move') {
        if (unit.unitType.baseStrength <= 0) return false;
        return tryActionAttack(unit, tile);
      }

      try {
        if (mode === 'found') {
          performFoundCityAction(unit);
          return true;
        }

        if (mode === 'attack') {
          tryActionAttack(unit, tile);
          return true;
        }

        if (mode === 'ranged') {
          const range = unit.unitType.range ?? 1;
          if (range < 2 || (unit.unitType.rangedStrength ?? 0) <= 0) return true;
          const key = `${tile.x},${tile.y}`;
          if (!rangedTargets.has(key)) return true;
          if (unit.isSleeping) unit.isSleeping = false;
          unit.queuedDestination = undefined;
          combatSystem.tryAttack(unit, tile.x, tile.y, { source: 'human-ui' });
          rangedTargets = new Set<string>();
          rangedPreviewRenderer.clear();
          return true;
        }

        if (mode === 'build') {
          performBuildImprovementAction(unit);
          return true;
        }

        return false;
      } finally {
        unitActionToolbox.resetMode();
      }
    });

    const unitBoardingManager = new UnitBoardingManager(
      unitManager,
      mapData,
      gridSystem,
      nationManager,
      (message) => logManager.info({
        nationId: turnManager.getCurrentNation().id,
        category: 'unit',
        message,
      }),
    );

    // 15. Rörelseregler för enheter
    movementSystem = new MovementSystem(
      tileMap,
      unitManager,
      unitRenderer,
      turnManager,
      selectionManager,
      gridSystem,
      nationManager,
      diplomacyManager,
      (unit) => improvementConstructionSystem.isUnitBusy(unit.id),
      (unit, territoryOwnerId) => exileProtectionSystem.canLeaderEnterTerritory(unit, territoryOwnerId),
      unitBoardingManager,
    );

    // Turn order: built AFTER MovementSystem so MovementSystem's turnStart
    // reset fires before TurnOrderSystem auto-selects the active unit.
    // Otherwise the freshly-selected unit would still have 0 MP and the
    // movement-preview matrix would stay hidden until the first move.
    const turnOrderSystem = new TurnOrderSystem(
      unitManager,
      turnManager,
      humanNationId,
      (unit) => improvementConstructionSystem.isUnitBusy(unit.id) || unit.automation === 'explore',
    );
    turnManager.on('turnStart', (e) => improvementConstructionSystem.handleTurnStart(e));
    improvementConstructionSystem.onCompleted((event) => {
      resourceSystem.recalculateForNation(event.construction.ownerId);
      if (event.unit.improvementCharges !== undefined) {
        event.unit.improvementCharges = Math.max(0, event.unit.improvementCharges - 1);
      }
      const locationLabel = event.city ? `near ${event.city.name}` : 'on a sea resource';
      if (
        event.unit.unitType.id === WORK_BOAT.id &&
        event.tile.resourceId !== undefined
      ) {
        logManager.info({
          nationId: event.construction.ownerId,
          category: 'improvement',
          message: `Work Boat improved ${event.tile.resourceId} at (${event.tile.x},${event.tile.y}) with ${event.improvement.id}.`,
        });
      }
      logManager.info({
        nationId: event.construction.ownerId,
        category: 'improvement',
        message: `built ${event.improvement.name} ${locationLabel}.`,
      });
      if (event.unit.improvementCharges === 0) {
        unitManager.removeUnit(event.unit.id);
        const selected = selectionManager.getSelected();
        if (selected?.kind === 'unit' && selected.unit.id === event.unit.id) {
          selectionManager.clearSelection();
        }
      }
      if (!autoplaySystem.isActive()) {
        rightPanel?.requestRefresh();
        hudLayer?.refresh();
        refreshOpenCityView();
        tileBuildingRenderer.rebuildAll();
        tileImprovementOverlayRenderer.refreshTile(event.tile.x, event.tile.y);
        turnOrderSystem.refreshActive();
      }
    });
    improvementConstructionSystem.onCancelled((event) => {
      if (!autoplaySystem.isActive()) {
        rightPanel?.requestRefresh();
        hudLayer?.refresh();
        refreshOpenCityView();
        tileImprovementOverlayRenderer.refreshTile(event.tile.x, event.tile.y);
        turnOrderSystem.refreshActive();
      }
    });
    selectionManager.onSelectionTarget((target, currentSelection, clickedTile) => {
      if (currentSelection?.kind !== 'unit') return false;
      if (freeSelectionMode) return false;

      const unit = currentSelection.unit;
      // Prefer the resolved selectable's tile, but fall back to the raw clicked
      // tile so move orders can be issued into fog of war (unexplored tiles
      // resolve to a null target). Fog never blocks issuing a move order.
      const targetTile = this.getTileForSelectable(tileMap, target) ?? clickedTile;
      if (targetTile === null) return false;

      const destTile = tileMap.getTileAt(targetTile.x, targetTile.y);
      if (destTile === null) return false;

      const inReachable = reachableTiles.has(`${targetTile.x},${targetTile.y}`);

      if (unit.carriedByUnitId !== undefined) {
        if (!inReachable) return false;
        if (!unitBoardingManager.canUnboard(unit, targetTile.x, targetTile.y)) return false;
        unit.queuedDestination = undefined;
        reachableTiles = new Set<string>();
        pathPreviewRenderer.clear();
        unitBoardingManager.unboard(unit, targetTile.x, targetTile.y);
        return true;
      }

      // Terrain validation: a destination the unit can never occupy (land unit →
      // water without embarkation, naval unit → land) is fundamentally invalid.
      // canUnitEnterTile encodes the embark rules, so embark-capable land units
      // still pass and follow the existing embarkation logic. Flash red and
      // consume the click without issuing an order.
      if (!canUnitEnterTile(unit, destTile, nationManager.getNation(unit.ownerId))) {
        invalidTileFeedbackRenderer.flash(targetTile.x, targetTile.y);
        return true;
      }

      if (inReachable) {
        const path = pathfindingSystem.findPath(unit, targetTile.x, targetTile.y);
        if (path === null) return false;
        unit.queuedDestination = undefined;
        if (unit.isSleeping) unit.isSleeping = false;
        reachableTiles = new Set<string>();
        pathPreviewRenderer.clear();
        movementSystem.moveAlongPath(unit, path, { source: 'human-ui' });
        return true;
      }

      // Far tile: set queued destination and begin moving this turn
      if (unit.movementPoints <= 0) return false;
      const fullPath = pathfindingSystem.findPath(unit, targetTile.x, targetTile.y, { respectMovementPoints: false });
      if (fullPath === null) return false;

      unit.queuedDestination = { x: targetTile.x, y: targetTile.y };
      if (unit.isSleeping) unit.isSleeping = false;
      reachableTiles = new Set<string>();
      pathPreviewRenderer.clear();
      movementSystem.moveAlongPath(unit, fullPath, { source: 'human-ui' });
      if (unit.tileX === targetTile.x && unit.tileY === targetTile.y) {
        unit.queuedDestination = undefined;
      }
      return true;
    });

    selectionManager.onSelectionTarget((target, currentSelection) => {
      if (currentSelection?.kind !== 'city') return false;
      if (currentSelection.city.ownerId !== data.humanNationId) return false;
      if (target?.kind !== 'tile') return false;
      return cityView.isOpenForCity(currentSelection.city.id);
    });

    // 16. Läkningssystem
    const healingSystem = new HealingSystem(unitManager, cityManager, turnManager);

    // 17. Victory system
    const victorySystem = new VictorySystem(
      cityManager,
      nationManager,
      turnManager,
      resourceAccessSystem,
      { science: data.victoryConditions?.science },
      (nationId, message) => logManager.info({ nationId, category: 'victory', message }),
      researchSystem,
      corporationSystem,
      wonderSystem,
    );

    // 18. Stadsgrundningssystem
    foundCitySystem = new FoundCitySystem(
      unitManager, cityManager, nationManager, turnManager,
      territoryRenderer, cityRenderer, resourceSystem, mapData,
      gridSystem,
    );

    // Log city founded and re-scan discovery (new city may trigger encounters).
    foundCitySystem.onCityFounded((city) => {
      logManager.info({ nationId: city.ownerId, category: 'city', message: `${city.name} was founded.` });
      discoverySystem.scan();
      if (city.ownerId === humanNationId) updateFog();
      if (autoplaySystem.isActive()) return;
      cityBannerRenderer.refreshCity(city);
      refreshCultureOverlay();
    });

    // 18. AI-system för icke-mänskliga nationer
    const explorationMemorySystem = new ExplorationMemorySystem(gridSystem, mapData, cityManager);
    const aiOverseasExpansionSystem = new AIOverseasExpansionSystem(
      worldMarkerSystem,
      nationManager,
      cityManager,
      turnManager,
      mapData,
      productionSystem,
      unitManager,
      movementSystem,
      pathfindingSystem,
      gridSystem,
      unitBoardingManager,
      formatLog,
      (nationId, message) => logManager.info({ nationId, category: 'ai', message }),
    );
    const aiExplorationSystem = new AIExplorationSystem(
      unitManager,
      cityManager,
      nationManager,
      turnManager,
      movementSystem,
      pathfindingSystem,
      mapData,
      eventLog,
      formatLog,
      (nationId, resourceId) => {
        const resource = getNaturalResourceById(resourceId);
        if (!resource) return false;
        if (!resource.revealTechId) return true;
        return researchSystem.isResearched(nationId, resource.revealTechId);
      },
      undefined,
      undefined,
      worldMarkerSystem,
      aiOverseasExpansionSystem,
      (nationId, message) => logManager.info({ nationId, category: 'exploration', message }),
    );
    const aiSystem = new AISystem(
      unitManager, cityManager, nationManager, turnManager,
      movementSystem, pathfindingSystem, combatSystem, productionSystem, foundCitySystem, mapData,
      gridSystem,
      cityTerritorySystem,
      researchSystem,
      diplomacyManager,
      happinessSystem,
      aiMilitaryThreatEvaluationSystem,
      discoverySystem,
      tradeDealSystem,
      resourceAccessSystem,
      explorationMemorySystem,
      strategicResourceCapacitySystem,
      unitUpkeepSystem,
      unitUpgradeSystem,
      formatLog,
      eraSystem,
      undefined,
      undefined,
      builderSystem,
      wonderSystem,
      wonderPlacementSystem,
      buildingPlacementSystem,
      (nationId, message) => logManager.info({ nationId, category: 'ai', message }),
      () => isAutoplayActive() || this.diagnosticSystem?.isTurnLoggingEnabled() === true,
      cityDefenseSystem,
      aiOverseasExpansionSystem,
      exileProtectionSystem,
      tradeConnectionSystem,
      diplomaticProposalSystem,
    );
    aiSystem.setCultureSystem(cultureSystem);
    const aiPolicySystem = new AIPolicySystem(policySystem, nationManager, happinessSystem);

    const runAutoplayNationTurn = (nation: Nation): void => {
      discoverySystem.scan();

      aiDiplomacySystem.runTurn(nation.id);
      maybeProposeAIJointWar(nation.id);
      aiSystem.runTurn(nation.id);
      aiExplorationSystem.runTurn(nation.id);
    };

    const autoplaySystem = new AutoplaySystem(
      nationManager,
      turnManager,
      this.cameraController,
      tileMap,
      combatSystem,
      foundCitySystem,
      eventLog,
      runAutoplayNationTurn,
    );
    isAutoplayActive = () => autoplaySystem.isActive();
    this.isAutoplayActiveForVisuals = () => autoplaySystem.isActive();

    const combatAnimationSystem = new CombatAnimationSystem(this, tileMap, unitRenderer, autoplaySystem);

    aiExplorationSystem.onIslandDiscovered((e) => {
      if (e.nationId !== humanNationId) return;
      if (autoplaySystem.isActive()) return;
      hudLayer?.enqueueDiscovery({
        title: `You discovered ${e.markerName}!`,
        imageKey: getUnitSpriteKey('scout_boat'),
        description: 'An overseas settlement opportunity has been revealed.',
        unlockRows: [],
        leadsToRows: [],
      });
    });

    // Humans pick their own initial research via the HUD research panel.
    // AI nations keep the deterministic auto-pick so they never stall.
    const refreshPolicyDerivedState = (nationId: string): void => {
      happinessSystem.recalculateNation(nationId);
      resourceSystem.recalculateForNation(nationId);
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    };

    const refreshGameplayAfterAutoplay = (): void => {
      territoryRenderer.invalidate();
      this.minimapHud?.rebuild();
      this.minimapHud?.update();
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      refreshOpenCityView();
      // Rebuild renderers that may have been suppressed during autoplay.
      cityBannerRenderer.rebuildAll();
      tileBuildingRenderer.rebuildAll();
      tileImprovementOverlayRenderer.rebuildAll();
    };
    autoplaySystem.onCompleted(refreshGameplayAfterAutoplay);
    autoplaySystem.onStopped(refreshGameplayAfterAutoplay);

    autoplaySystem.onStarted(() => {
      if (!autoplaySystem.isVisualSuppressionEnabled()) return;
      SetupMusicManager.getShared().muteForSession();
      const originalConsoleLog = console.log;
      console.log = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].startsWith('[autorun]')) {
          originalConsoleLog(...args);
        }
      };
      const restoreConsole = () => { console.log = originalConsoleLog; };
      autoplaySystem.onCompleted(restoreConsole);
      autoplaySystem.onStopped(restoreConsole);
    });
    autoplaySystem.onCompleted(() => SetupMusicManager.getShared().unmuteForSession());
    autoplaySystem.onStopped(() => SetupMusicManager.getShared().unmuteForSession());

    turnManager.on('turnStart', (e) => {
      const isAutoplay = autoplaySystem.isActive();
      const shouldAutoControlNation = !e.nation.isHuman || isAutoplay;

      if (shouldAutoControlNation) {
        researchSystem.ensureResearchSelected(e.nation.id);
        cultureSystem.ensureCultureNodeSelected(e.nation.id);
      }
      researchSystem.advanceResearchForNation(e.nation.id);
      cultureSystem.advanceCultureForNation(e.nation.id);
      policySystem.normalizeActivePolicies(e.nation.id);
      if (shouldAutoControlNation) {
        aiPolicySystem.runTurn(e.nation.id);
        refreshPolicyDerivedState(e.nation.id);
      } else {
        hudLayer?.refreshPolicyPanel();
      }

      if (e.nation.isHuman && !isAutoplay) {
        openPendingHumanSelectionPanels();
      }
    });

    turnManager.on('turnStart', (e) => {
      if (autoplaySystem.isActive()) return;

      if (!e.nation.isHuman) {
        discoverySystem.scan();
        // Diplomacy decisions run before military planning — the rest of the
        // AI turn (settlers, combat, movement, production) reads the freshly
        // adjusted state.
        aiDiplomacySystem.runTurn(e.nation.id);
        maybeProposeAIJointWar(e.nation.id);
        aiSystem.runTurn(e.nation.id);
        aiExplorationSystem.runTurn(e.nation.id);
        territoryRenderer.invalidate();

        const endingNationId = e.nation.id;
        this.time.delayedCall(AI_TURN_YIELD_MS, () => {
          if (autoplaySystem.isActive()) return;
          const current = turnManager.getCurrentNation();
          if (current?.id !== endingNationId) return;
          turnManager.endCurrentTurn();
        });
      }
    });

    // Focus the camera on the human capital at the start of each human turn.
    const humanIdForFocus = data.humanNationId;
    const focusOnCity = (city: City): void => {
      const { x, y } = tileMap.tileToWorld(city.tileX, city.tileY);
      this.cameraController.focusOn(x, y, 1.5);
    };
    const focusHumanCapital = () => {
      if (!humanIdForFocus) return;
      const ownedCities = cityManager.getCitiesByOwner(humanIdForFocus);
      if (ownedCities.length > 0) {
        const target = ownedCities.find((c) => c.isResidenceCapital) ?? ownedCities[0];
        focusOnCity(target);
        return;
      }
      const ownedUnits = unitManager.getUnitsByOwner(humanIdForFocus);
      if (ownedUnits.length === 0) return;
      const settler = ownedUnits.find((u) => u.unitType.canFound) ?? ownedUnits[0];
      const { x, y } = tileMap.tileToWorld(settler.tileX, settler.tileY);
      this.cameraController.focusOn(x, y, 1.5);
    };
    const focusUnit = (unit: Unit) => {
      suppressPromote = true;
      try {
        selectionManager.selectUnit(unit);
      } finally {
        suppressPromote = false;
      }
      const { x, y } = tileMap.tileToWorld(unit.tileX, unit.tileY);
      this.cameraController.focusOn(x, y, 1.5);
    };
    const selectActiveUnitWithoutCamera = (unit: Unit) => {
      suppressPromote = true;
      try {
        selectionManager.selectUnit(unit);
      } finally {
        suppressPromote = false;
      }
    };
    const activateFocusedUnitMove = () => {
      unitActionToolbox.resetMode();
      refreshMovePreview();
    };

    // Auto-explore human recon units at the start of their owner's turn, after MP
    // reset and before the turn queue is built (so spent scouts are skipped like
    // sleeping ones). Reuses the AI scouting behavior via exploreUnit().
    turnManager.on('turnStart', (e) => {
      if (!e.nation.isHuman || isAutoplayActive()) return;
      for (const unit of unitManager.getUnitsByOwner(e.nation.id)) {
        if (unit.automation !== 'explore') continue;
        if (unit.carriedByUnitId !== undefined) continue;
        if (!aiExplorationSystem.canAutoExplore(unit)) {
          unit.automation = undefined; // unit is no longer a recon type (e.g. upgraded)
          continue;
        }
        aiExplorationSystem.exploreUnit(unit);
      }
      territoryRenderer.invalidate();
    });

    // Continue queued long-distance movement at the start of each human turn.
    // Runs after MovementSystem resets MP (registered later) but before TurnOrderSystem
    // refreshes the active unit queue (done inside the next turnStart listener below).
    turnManager.on('turnStart', (e) => {
      if (!e.nation.isHuman || isAutoplayActive()) return;
      for (const unit of unitManager.getAllUnits()) {
        if (unit.ownerId !== e.nation.id) continue;
        if (!unit.queuedDestination) continue;
        if (unit.carriedByUnitId !== undefined) continue;
        if (unit.isSleeping) continue;
        if (unit.actionStatus === 'building') continue;
        if (unit.movementPoints <= 0) continue;
        const dest = unit.queuedDestination;
        const path = pathfindingSystem.findPath(unit, dest.x, dest.y, { respectMovementPoints: false });
        if (path === null) {
          unit.queuedDestination = undefined;
          continue;
        }
        movementSystem.moveAlongPath(unit, path, { source: 'human-ui' });
        if (unit.tileX === dest.x && unit.tileY === dest.y) {
          unit.queuedDestination = undefined;
        }
      }
    });

    turnManager.on('turnStart', (e) => {
      if (!e.nation.isHuman) return;
      turnOrderSystem.refreshActive();
      const active = turnOrderSystem.getActive();
      if (!active) {
        selectionManager.clearSelection();
        if (autofocusEnabled()) {
          focusHumanCapital();
        }
        maybeAutoEndTurn();
        return;
      }
      // Force-focus even if the active id is unchanged since last turn —
      // refreshActive() skips the listener in that case.
      if (autofocusEnabled()) {
        focusUnit(active);
      } else {
        selectActiveUnitWithoutCamera(active);
      }
      // SelectionManager no-ops on same-unit re-select, so onSelectionChanged
      // listeners (including move-preview) don't fire. Refresh explicitly so
      // reachableTiles reflects the unit's just-reset movement points.
      activateFocusedUnitMove();
    });

    // Mid-turn queue progression (markDone, skipActive, promoteTo, sleep toggle).
    // Do NOT pan to the capital here — capital focus is a turn-start rule only.
    turnOrderSystem.onActiveUnitChanged((unit) => {
      if (!turnManager.getCurrentNation().isHuman) return;
      if (!unit) {
        selectionManager.clearSelection();
        maybeAutoEndTurn();
        return;
      }
      if (autofocusEnabled()) {
        focusUnit(unit);
      } else {
        selectActiveUnitWithoutCamera(unit);
      }
      activateFocusedUnitMove();
    });

    // Space skips the active unit.
    const onSpaceSkip = () => {
      if (!turnManager.getCurrentNation().isHuman) return;
      turnOrderSystem.skipActive();
    };

    // C centers the camera on the active unit, or on the human capital
    // if no active unit is available. Reuses the turn-flow focus helpers.
    const onKeyCenter = () => {
      const active = turnOrderSystem.getActive();
      if (active) {
        focusUnit(active);
        return;
      }
      focusHumanCapital();
    };

    // Unit/action gameplay hotkeys for the selected human unit.
    const activateActionIfHumanTurn = (mode: 'move' | 'attack' | 'ranged' | 'sleep') => {
      if (!turnManager.getCurrentNation().isHuman) return;
      const selection = selectionManager.getSelected();
      if (selection?.kind !== 'unit' || selection.unit.ownerId !== humanNationId) return;
      // Sleep is the cancel-build affordance for a busy worker; the
      // sleep handler routes through cancelBuildForUnit. Other actions
      // (move/attack/ranged) stay blocked while a build is running so
      // the user explicitly cancels via Sleep before redirecting.
      if (mode !== 'sleep' && improvementConstructionSystem.isUnitBusy(selection.unit.id)) return;
      unitActionToolbox.tryActivate(mode);
    };
    const onKeyMove = () => activateActionIfHumanTurn('move');
    const onKeyAttack = () => activateActionIfHumanTurn('attack');
    const onKeyRanged = () => activateActionIfHumanTurn('ranged');
    const onKeySleep = () => activateActionIfHumanTurn('sleep');
    const bindGameplayHotkeys = (): void => {
      this.input.keyboard?.on('keydown-SPACE', onSpaceSkip);
      this.input.keyboard?.on('keydown-C', onKeyCenter);
      this.input.keyboard?.on('keydown-M', onKeyMove);
      this.input.keyboard?.on('keydown-A', onKeyAttack);
      this.input.keyboard?.on('keydown-R', onKeyRanged);
      this.input.keyboard?.on('keydown-S', onKeySleep);
    };
    const unbindGameplayHotkeys = (): void => {
      this.input.keyboard?.off('keydown-SPACE', onSpaceSkip);
      this.input.keyboard?.off('keydown-C', onKeyCenter);
      this.input.keyboard?.off('keydown-M', onKeyMove);
      this.input.keyboard?.off('keydown-A', onKeyAttack);
      this.input.keyboard?.off('keydown-R', onKeyRanged);
      this.input.keyboard?.off('keydown-S', onKeySleep);
    };
    bindGameplayHotkeys();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unbindGameplayHotkeys();
    });

    // Re-scan after a unit moves or is created (new positions may meet a city).
    unitManager.onUnitChanged((event) => {
      if (event.reason === 'moved' || event.reason === 'created') {
        discoverySystem.scan();
        if (event.unit.ownerId === humanNationId) {
          updateFog();
        }
      }
    });

    // Log city founded events — covers both human and AI via FoundCitySystem.
    // Wired after foundCitySystem is constructed; see below.

    // ─── Leader audience coordinator (auto-meet + music) ─────────────────────
    // Meeting a new leader automatically opens their audience chamber. Several
    // first contacts in one turn are shown one at a time via a small queue. The
    // visited nation's music plays while the chamber is open and the previous
    // playlist is restored once the last queued audience closes.
    const audienceMusic = SetupMusicManager.getShared();
    let musicKeyBeforeAudience: string | null = null;
    const pendingAudienceLeaderIds: string[] = [];

    const processAudienceQueue = (): void => {
      const dialog = this.leaderAudienceDialog;
      if (!dialog || dialog.isOpen()) return;
      const nextLeaderId = pendingAudienceLeaderIds.shift();
      if (nextLeaderId) dialog.open(nextLeaderId);
    };
    const enqueueAudienceForNation = (nationId: string): void => {
      const leaderId = getLeaderByNationId(nationId)?.id;
      if (!leaderId) return;
      if (this.leaderAudienceDialog?.getCurrentLeaderId() === leaderId) return;
      if (pendingAudienceLeaderIds.includes(leaderId)) return;
      pendingAudienceLeaderIds.push(leaderId);
      processAudienceQueue();
    };
    const onAudienceOpened = (nationId: string): void => {
      if (musicKeyBeforeAudience === null) musicKeyBeforeAudience = audienceMusic.getCurrentPlaylistKey();
      audienceMusic.playPlaylist(nationId);
    };
    const onAudienceClosed = (): void => {
      // Chain straight into the next queued audience (which switches the music
      // to that nation); only restore the prior playlist once none remain.
      if (pendingAudienceLeaderIds.length > 0) {
        processAudienceQueue();
        return;
      }
      if (musicKeyBeforeAudience !== null) {
        audienceMusic.playPlaylist(musicKeyBeforeAudience);
        musicKeyBeforeAudience = null;
      }
      // Audiences open over the world (often while zoomed out to the overview
      // after a fresh meeting), so closing the last one would otherwise leave
      // the camera stranded far out. Re-focus the active unit or capital using
      // the same routine as turn-start / the C key.
      onKeyCenter();
      // Also close the Leader Details sidebar so the player returns straight to
      // the game instead of being left on the leader's panel.
      this.rightSidebarPanel?.collapse();
    };

    // Log discovery events, and refresh UI when a new nation becomes visible.
    discoverySystem.onNationsMet((a, b) => {
      const nameA = nationManager.getNation(a)?.name ?? a;
      const nameB = nationManager.getNation(b)?.name ?? b;
      logManager.info({ nationIds: [a, b], category: 'diplomacy', message: `${nameA} has met ${nameB}.` });
      // New nation may now be visible in the UI.
      if (isAutoplayActive()) return;
      hudLayer?.refresh();
      leaderStrip?.rebuild();
      rightPanel?.requestRefresh();
      // Automatically grant the player an audience with a newly met AI leader.
      if (humanNationId && (a === humanNationId || b === humanNationId)) {
        enqueueAudienceForNation(a === humanNationId ? b : a);
      }
    });

    const updateCityProductionRhythm = (city: City, item: Producible): void => {
      if (item.kind === 'unit') {
        city.productionRhythm.completedUnitsSinceInfrastructure += 1;
        city.productionRhythm.completedInfrastructureSinceUnit = 0;
        return;
      }

      city.productionRhythm.completedUnitsSinceInfrastructure = 0;
      city.productionRhythm.completedInfrastructureSinceUnit += 1;
    };

    // Hantera färdig produktion
    productionSystem.onCompleted((cityId, item, entry) => {
      const city = cityManager.getCity(cityId);
      if (!city) return false;

      if (item.kind === 'building') {
        const completedTile = buildingPlacementSystem.finalizeReservedBuilding(cityId, item.buildingType.id, mapData);
        if (!completedTile) {
          console.warn(`[BuildingPlacement] Completed ${item.buildingType.id} for ${cityId} without a reserved tile.`);
          return false;
        }

        cityManager.getBuildings(cityId).add(item.buildingType);
        resourceSystem.recalculateForNation(city.ownerId);
        tileBuildingRenderer.refreshTile(completedTile.x, completedTile.y);

        const hasFlatCulture = (item.buildingType.modifiers.culturePerTurn ?? 0) > 0;
        const hasPercentCulture = (item.buildingType.modifiers.culturePercent ?? 0) > 0;
        if (hasPercentCulture || hasFlatCulture) {
          const burst = culturalSphereSystem.triggerCulturalBurst(city, mapData, gridSystem, {
            radius: hasPercentCulture
              ? CULTURAL_PERCENT_BUILDING_BURST_RADIUS
              : CULTURAL_BUILDING_BURST_RADIUS,
            maxTiles: hasPercentCulture
              ? CULTURAL_PERCENT_BUILDING_BURST_MAX_TILES
              : CULTURAL_BUILDING_BURST_MAX_TILES,
            allowOverwrite: true,
          });
          refreshCultureOverlay();
          if (burst.claimedTiles + burst.convertedTiles > 0) {
            const burstText = `${city.name} cultural burst from ${item.buildingType.name}: ${burst.claimedTiles} claimed, ${burst.convertedTiles} converted.`;
            logManager.info({ nationId: city.ownerId, category: 'culture', message: burstText });
          }
        }

        refreshOpenCityView();
        updateCityProductionRhythm(city, item);
        return true;
      }

      if (item.kind === 'wonder') {
        const placement = entry.placement;
        if (!placement) return false;
        if (wonderSystem.isWonderBuilt(item.wonderType.id)) return false;

        const completedTile = wonderPlacementSystem.finalizeReservedWonder(cityId, item.wonderType.id, mapData);
        if (!completedTile || completedTile.x !== placement.tileX || completedTile.y !== placement.tileY) {
          console.warn(`[WonderPlacement] Completed ${item.wonderType.id} for ${cityId} without its reserved tile.`);
          return false;
        }

        const registered = wonderSystem.completeWonder(
          city,
          item.wonderType,
          turnManager.getCurrentRound(),
          placement,
        );
        if (!registered) return false;

        productionSystem.removeWonderFromAllQueues(item.wonderType.id);
        wonderPlacementSystem.releaseWonderReservations(item.wonderType.id, mapData);

        const wonderState = wonderSystem.getCompletedWonder(item.wonderType.id);
        if (wonderState?.tileX === undefined || wonderState.tileY === undefined) return false;
        const origin = { x: wonderState.tileX, y: wonderState.tileY };
        const expansion = territoryExpansionBonusSystem.apply({
          city,
          ownerId: city.ownerId,
          origin,
          radius: 1,
          source: 'wonder',
          reason: item.wonderType.id,
        }, mapData);

        for (const nation of nationManager.getAllNations()) {
          resourceSystem.recalculateForNation(nation.id);
        }
        if (expansion.claimedCoords.length > 0) {
          territoryRenderer.invalidate();
          rebuildMinimapForGameplay();
        }
        logManager.info({ nationId: city.ownerId, category: 'wonder', message: `completed the ${item.wonderType.name} in ${city.name}.` });
        if (expansion.claimedCoords.length > 0) {
          logManager.info({ nationId: city.ownerId, category: 'wonder', message: `${item.wonderType.name} expanded ${city.name}'s territory.` });
        }

        const wonderBurst = culturalSphereSystem.triggerCulturalBurst(city, mapData, gridSystem, {
          radius: WORLD_WONDER_CULTURAL_BURST_RADIUS,
          maxTiles: WORLD_WONDER_CULTURAL_BURST_MAX_TILES,
          allowOverwrite: true,
        });
        refreshCultureOverlay();
        if (wonderBurst.claimedTiles + wonderBurst.convertedTiles > 0) {
          const wonderBurstText = `${city.name} cultural burst from ${item.wonderType.name}: ${wonderBurst.claimedTiles} claimed, ${wonderBurst.convertedTiles} converted.`;
          logManager.info({ nationId: city.ownerId, category: 'wonder', message: wonderBurstText });
        }

        refreshOpenCityView();
        rightPanel?.requestRefresh();
        hudLayer?.refresh();
        updateCityProductionRhythm(city, item);
        return true;
      }

      if (item.kind === 'corporation') {
        if (corporationSystem?.isFounded(item.corporationType.id)) return false;
        if (!corporationSystem?.canCityProduceCorporation(city, item.corporationType.id)) return false;

        const founded = corporationSystem.foundCorporation(city.ownerId, item.corporationType.id, city.id);
        if (!founded) return false;

        productionSystem.removeCorporationFromAllQueues(item.corporationType.id);
        resourceSystem.recalculateForNation(city.ownerId);
        happinessSystem.recalculateNation(city.ownerId);
        refreshOpenCityView();
        rightPanel?.requestRefresh();
        hudLayer?.refresh();
        updateCityProductionRhythm(city, item);
        return true;
      }

      if (item.kind === 'tradeRoute') {
        const conn = tradeConnectionSystem.getConnection(item.connectionId);
        if (!conn) return; // Already cancelled externally — allow item removal
        const connFromCity = cityManager.getCity(conn.cityAId);
        const connToCity = cityManager.getCity(conn.cityBId);
        const connNationA = nationManager.getNation(conn.nationAId);
        const connNationB = nationManager.getNation(conn.nationBId);
        const atWar = diplomacyManager.getState(conn.nationAId, conn.nationBId) === 'WAR';
        const routeName = `${connFromCity?.name ?? conn.cityAId} ↔ ${connToCity?.name ?? conn.cityBId}`;
        if (!connFromCity || !connToCity || !connNationA || !connNationB || atWar) {
          tradeConnectionSystem.cancelConnection(item.connectionId);
          const reason = atWar ? 'the nations are now at war' : 'a city or nation no longer exists';
          logManager.info({
            nationIds: [conn.nationAId, conn.nationBId],
            category: 'diplomacy',
            message: `Trade route ${routeName} was cancelled because ${reason}.`,
          });
          return; // Allow item to be removed from queue (connection already cancelled)
        }
        tradeConnectionSystem.activateTradeConnection(item.connectionId);
        const activated = tradeConnectionSystem.getConnection(item.connectionId);
        if (activated) {
          tradeDiplomacySystem.onTradeRouteActivated(activated.nationAId, activated.nationBId);
          const nameA = nationManager.getNation(activated.nationAId)?.name ?? activated.nationAId;
          const nameB = nationManager.getNation(activated.nationBId)?.name ?? activated.nationBId;
          logManager.info({
            nationIds: [activated.nationAId, activated.nationBId],
            category: 'diplomacy',
            message: `${nameA} and ${nameB} strengthened relations through a new trade route.`,
          });
        }
        rightPanel?.requestRefresh();
        return; // Allow item to be removed from queue
      }

      const placement = this.findUnitPlacementTile(tileMap, unitManager, city, item.unitType, gridSystem);
      if (placement === null) return false;
      const unitBlockReason = getCityUnitProductionBlockReason(
        city,
        item.unitType,
        mapData,
        gridSystem,
        unitProductionRuleContext,
      );
      if (unitBlockReason) {
        entry.blockedReason = unitBlockReason;
        return false;
      }

      unitManager.createUnit({
        type: item.unitType,
        ownerId: city.ownerId,
        tileX: placement.x,
        tileY: placement.y,
        movementPoints: 0,
      });

      updateCityProductionRhythm(city, item);
      return true;
    });
    productionSystem.onRemoved((cityId, entry) => {
      if (entry.item.kind === 'wonder') {
        wonderPlacementSystem.releaseCityWonderReservation(cityId, entry.item.wonderType.id, mapData);
      }
      if (entry.item.kind === 'building') {
        buildingPlacementSystem.releaseCityBuildingReservation(cityId, entry.item.buildingType.id, mapData);
      }
      if (entry.item.kind === 'tradeRoute') {
        const conn = tradeConnectionSystem.getConnection(entry.item.connectionId);
        if (conn && conn.status === 'building') {
          tradeConnectionSystem.cancelConnection(entry.item.connectionId);
          const fromCity = cityManager.getCity(entry.item.fromCityId);
          const toCity = cityManager.getCity(entry.item.toCityId);
          logManager.info({
            nationIds: [conn.nationAId, conn.nationBId],
            category: 'diplomacy',
            message: `Trade route project ${fromCity?.name ?? entry.item.fromCityId} ↔ ${toCity?.name ?? entry.item.toCityId} was cancelled.`,
          });
        }
      }
    });

    // ─── Leader capture and combat events ───────────────────────────────────

    const showLeaderCaptureDialog = (request: LeaderCaptureChoiceRequest): void => {
      const existing = document.getElementById('leader-capture-modal');
      if (existing) existing.remove();

      const attackerName = nationManager.getNation(request.attacker.ownerId)?.name ?? request.attacker.ownerId;
      const defeatedName = nationManager.getNation(request.defeatedNationId)?.name ?? request.defeatedNationId;
      const defeatedGold = nationManager.getResources(request.defeatedNationId).gold;
      const ransomGold = Math.floor(Math.max(0, defeatedGold) * 0.5);

      const overlay = document.createElement('div');
      overlay.id = 'leader-capture-modal';
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.72);
      `;

      const box = document.createElement('div');
      box.style.cssText = `
        width: min(460px, calc(100vw - 32px));
        background: #191b24; border: 2px solid #d9b85f;
        border-radius: 8px; padding: 26px 30px; color: #eee;
        font-family: sans-serif; box-shadow: 0 14px 40px rgba(0,0,0,0.45);
      `;

      const title = document.createElement('div');
      title.textContent = `${attackerName} captured ${defeatedName}'s leader`;
      title.style.cssText = 'font-size: 20px; font-weight: 700; margin-bottom: 12px;';
      box.appendChild(title);

      const details = document.createElement('div');
      details.textContent = `Execute the leader to collapse ${defeatedName}, or ransom and release them for up to 50% of their treasury (${ransomGold} gold). Released leaders escape to a valid land tile and do not move the residence capital until end turn.`;
      details.style.cssText = 'font-size: 15px; line-height: 1.45; color: #d8d8d8; margin-bottom: 22px;';
      box.appendChild(details);

      const buttons = document.createElement('div');
      buttons.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;';

      const makeButton = (label: string, primary: boolean, handler: () => void): HTMLButtonElement => {
        const button = document.createElement('button');
        button.textContent = label;
        button.style.cssText = `
          padding: 9px 14px; border-radius: 6px; cursor: pointer; font-size: 14px;
          border: 1px solid ${primary ? '#d9b85f' : '#777'};
          background: ${primary ? '#d9b85f' : 'transparent'};
          color: ${primary ? '#111' : '#eee'};
        `;
        button.addEventListener('click', () => {
          overlay.remove();
          handler();
        });
        return button;
      };

      buttons.appendChild(makeButton('Ransom and Release Leader', false, request.ransom));
      buttons.appendChild(makeButton('Execute Leader', true, request.execute));
      box.appendChild(buttons);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    };

    leaderCaptureSystem.onChoiceRequested(showLeaderCaptureDialog);
    leaderCaptureSystem.onResolved((event) => {
      logManager.info({ nationIds: [event.attacker.ownerId, event.defeatedNationId], category: 'combat', message: event.message });
      unitRenderer.rebuildAll();
      cityRenderer.rebuildAll();
      cityBannerRenderer.rebuildAll();
      territoryRenderer.invalidate();
      rebuildMinimapForGameplay();
      refreshCultureOverlay();
      resourceSystem.recalculateForNation(event.attacker.ownerId);
      if (nationManager.getNation(event.defeatedNationId)) {
        resourceSystem.recalculateForNation(event.defeatedNationId);
      }
      happinessSystem.recalculateAll();
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });

    const showExileProtectionDialog = (request: ExileProtectionChoiceRequest): void => {
      const existing = document.getElementById('exile-protection-modal');
      if (existing) existing.remove();

      const protectedName = nationManager.getNation(request.protectedNationId)?.name ?? request.protectedNationId;
      const enemyName = nationManager.getNation(request.enemyNationId)?.name ?? request.enemyNationId;

      const overlay = document.createElement('div');
      overlay.id = 'exile-protection-modal';
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.72);
      `;

      const box = document.createElement('div');
      box.style.cssText = `
        width: min(520px, calc(100vw - 32px));
        background: #191b24; border: 2px solid #79a7d8;
        border-radius: 8px; padding: 26px 30px; color: #eee;
        font-family: sans-serif; box-shadow: 0 14px 40px rgba(0,0,0,0.45);
      `;

      const title = document.createElement('div');
      title.textContent = `${protectedName} requests protection`;
      title.style.cssText = 'font-size: 20px; font-weight: 700; margin-bottom: 12px;';
      box.appendChild(title);

      const details = document.createElement('div');
      details.textContent = `${protectedName}'s fleeing leader asks to shelter in your territory. Accepting allows the Leader into your land and cities, damages relations with ${enemyName}, and may force a war if ${enemyName} attacks the Leader under your protection.`;
      details.style.cssText = 'font-size: 15px; line-height: 1.45; color: #d8d8d8; margin-bottom: 22px;';
      box.appendChild(details);

      const buttons = document.createElement('div');
      buttons.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;';

      const makeButton = (label: string, handler: () => void): HTMLButtonElement => {
        const button = document.createElement('button');
        button.textContent = label;
        button.style.cssText = `
          padding: 9px 12px; border-radius: 6px; cursor: pointer; font-size: 14px;
          border: 1px solid #79a7d8; background: transparent; color: #eee;
        `;
        button.addEventListener('click', () => {
          overlay.remove();
          handler();
        });
        return button;
      };

      buttons.appendChild(makeButton('Deny protection', request.deny));
      buttons.appendChild(makeButton('Accept for free', request.acceptFree));
      buttons.appendChild(makeButton('Accept for gold tribute', request.acceptGold));
      buttons.appendChild(makeButton('Accept for resource tribute', request.acceptResource));
      box.appendChild(buttons);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    };

    exileProtectionSystem.onChoiceRequested(showExileProtectionDialog);
    exileProtectionSystem.onGranted((event) => {
      logManager.info({ nationIds: [event.request.protectedNationId, event.request.protectorNationId, event.request.enemyNationId], category: 'diplomacy', message: event.message });
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    exileProtectionSystem.onDenied((event) => {
      logManager.info({ nationIds: [event.request.protectedNationId, event.request.protectorNationId], category: 'diplomacy', message: event.message });
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    exileProtectionSystem.onExpired((event) => {
      logManager.info({ nationIds: [event.request.protectedNationId, event.request.protectorNationId], category: 'diplomacy', message: event.message });
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });

    combatSystem.on(async (e) => {
      const isRanged = (e.attacker.unitType.range ?? 1) >= 2;
      if (isRanged) {
        await combatAnimationSystem.playRangedAttack(e.attacker, e.defender.tileX, e.defender.tileY, e.defender.id);
      } else {
        await combatAnimationSystem.playMeleeAttack(e.attacker, e.defender.tileX, e.defender.tileY, e.defender.id);
      }
      if (e.result.defenderDied) {
        leaderCaptureSystem.handleUnitDefeated(e.attacker, e.defender);
      }
      if (e.result.attackerDied) {
        unitRenderer.removeUnit(e.attacker.id);
      } else {
        unitRenderer.refreshUnitPosition(e.attacker.id);
      }
      if (!e.result.defenderDied || e.defender.unitType.id !== 'leader') {
        if (e.result.defenderDied) unitRenderer.removeUnit(e.defender.id);
        else unitRenderer.refreshUnitPosition(e.defender.id);
      }
      // Record per-war unit losses for military units (baseStrength > 0).
      if (diplomacyManager.getState(e.attacker.ownerId, e.defender.ownerId) === 'WAR') {
        if (e.result.attackerDied && e.attacker.unitType.baseStrength > 0) {
          diplomacyManager.recordWarUnitLoss(e.attacker.ownerId, e.defender.ownerId);
        }
        if (e.result.defenderDied && e.defender.unitType.baseStrength > 0) {
          diplomacyManager.recordWarUnitLoss(e.defender.ownerId, e.attacker.ownerId);
        }
      }
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });

    combatSystem.onCityCombat(async (e) => {
      const isRanged = (e.attacker.unitType.range ?? 1) >= 2;
      if (isRanged) {
        await combatAnimationSystem.playRangedAttack(e.attacker, e.city.tileX, e.city.tileY);
      } else {
        await combatAnimationSystem.playMeleeAttack(e.attacker, e.city.tileX, e.city.tileY);
      }
      // Uppdatera stadsrendering
      cityRenderer.refreshCity(e.city);
      cityBannerRenderer.refreshCity(e.city);
      hudLayer?.refresh();
      if ((e.leaderDefenseBonus ?? 0) > 0) {
        logManager.info({ nationId: e.city.ownerId, category: 'combat', message: `${e.city.name} defended with Leader bonus (+50%).` });
      }

      // Om attackeraren dog
      if (e.result.attackerDied) {
        unitRenderer.removeUnit(e.attacker.id);
      } else {
        // Uppdatera attackerarens HP-bar
        unitRenderer.refreshUnitPosition(e.attacker.id);
      }

      // Record per-war losses for city combat.
      if (diplomacyManager.getState(e.attacker.ownerId, e.city.ownerId) === 'WAR') {
        if (e.result.attackerDied && e.attacker.unitType.baseStrength > 0) {
          diplomacyManager.recordWarUnitLoss(e.attacker.ownerId, e.city.ownerId);
        }
        if (e.captured && e.previousOwnerId) {
          diplomacyManager.recordWarCityLoss(e.previousOwnerId, e.attacker.ownerId);
        }
      }

      // Om staden erövrades
      if (e.captured) {
        let leaderCaptureHandled = false;
        if (e.previousOwnerId) {
          leaderCaptureHandled = leaderCaptureSystem.handleCityCaptured(e.city, e.previousOwnerId, e.attacker);
          if (!leaderCaptureHandled) {
            politicalCapitalSystem.handleCityCaptured(e.city, e.previousOwnerId, e.attacker.ownerId);
          }
        }
        // Den erövrande enheten flyttades in på stadens tile
        unitRenderer.refreshUnitPosition(e.attacker.id);
        cityRenderer.refreshCity(e.city);
        cityBannerRenderer.refreshCity(e.city);
        // Territory borders och minimap behöver ritas om efter ownerId-transfer.
        territoryRenderer.invalidate();
        rebuildMinimapForGameplay();
        refreshCultureOverlay();
        hudLayer?.refresh();
        // Recalculate resources for both old and new owner
        resourceSystem.recalculateForNation(e.attacker.ownerId);
        if (e.previousOwnerId) {
          resourceSystem.recalculateForNation(e.previousOwnerId);
        }
        // Diplomatic memory: capturing a city scars the relationship.
        if (e.previousOwnerId) {
          diplomaticMemorySystem.onCityCaptured(e.attacker.ownerId, e.previousOwnerId);
        }
        // A conquered city may introduce new encounters
        discoverySystem.scan();
        if (e.attacker.ownerId === humanNationId) updateFog();
      }

      rightPanel?.requestRefresh();
    });

    politicalCapitalSystem.onResidenceRelocated((event) => {
      cityRenderer.refreshCity(event.fromCity);
      cityRenderer.refreshCity(event.toCity);
      cityBannerRenderer.refreshCity(event.fromCity);
      cityBannerRenderer.refreshCity(event.toCity);
      unitRenderer.rebuildAll();
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      logManager.info({
        nationId: event.nationId,
        category: 'city',
        message: `relocated its residence capital from ${event.fromCity.name} to ${event.toCity.name}.`,
      });
    });

    nationCollapseSystem.onNationCollapsed((event) => {
      for (const city of event.occupiedCities) {
        cityRenderer.refreshCity(city);
        cityBannerRenderer.refreshCity(city);
      }
      unitRenderer.rebuildAll();
      territoryRenderer.invalidate();
      rebuildMinimapForGameplay();
      refreshCultureOverlay();
      if (event.conquerorNationId) resourceSystem.recalculateForNation(event.conquerorNationId);
      happinessSystem.recalculateAll();
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      if (event.reason === 'leader_executed') return;
      logManager.info({ nationIds: event.conquerorNationId ? [event.conquerorNationId] : [], category: 'combat', message: event.message });
    });

    // ─── Healing events ─────────────────────────────────────────────────────

    healingSystem.onCityHealed((e) => {
      const city = cityManager.getCity(e.cityId);
      if (city) {
        cityRenderer.refreshCity(city);
        cityBannerRenderer.refreshCity(city);
        hudLayer?.refresh();
        rightPanel?.requestRefresh();
      }
    });

    // ─── Diplomacy ────────────────────────────────────────────────────────────

    const humanNationIdForDiplomacy = data.humanNationId;

    // Helper: show diplomacy modal
    const showDiplomacyModal = (opts: {
      title: string;
      message: string;
      accentColor: string;
      confirmLabel: string;
      cancelLabel: string;
      onConfirm: () => void;
      onCancel: () => void;
    }) => {
      const existing = document.getElementById('diplomacy-modal');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'diplomacy-modal';
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.7);
      `;

      const box = document.createElement('div');
      box.style.cssText = `
        background: #1a1a2e; border: 2px solid ${opts.accentColor};
        border-radius: 8px; padding: 32px 40px; text-align: center;
        color: #eee; font-family: sans-serif; max-width: 400px;
      `;

      const titleEl = document.createElement('div');
      titleEl.textContent = opts.title;
      titleEl.style.cssText = `font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: ${opts.accentColor}; margin-bottom: 16px;`;
      box.appendChild(titleEl);

      const msg = document.createElement('div');
      msg.textContent = opts.message;
      msg.style.cssText = 'font-size: 20px; margin-bottom: 24px;';
      box.appendChild(msg);

      const btnContainer = document.createElement('div');
      btnContainer.style.cssText = 'display: flex; gap: 16px; justify-content: center;';

      const makeBtn = (label: string, primary: boolean, handler: () => void) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = `
          padding: 8px 24px; font-size: 16px; cursor: pointer;
          border: 1px solid ${primary ? opts.accentColor : '#666'}; border-radius: 4px;
          background: ${primary ? opts.accentColor : 'transparent'};
          color: ${primary ? '#000' : '#ccc'};
        `;
        btn.addEventListener('click', () => {
          handler();
          overlay.remove();
        });
        return btn;
      };

      btnContainer.appendChild(makeBtn(opts.confirmLabel, true, opts.onConfirm));
      // An empty cancel label renders a single-button (acknowledge-only) modal.
      if (opts.cancelLabel) btnContainer.appendChild(makeBtn(opts.cancelLabel, false, opts.onCancel));
      box.appendChild(btnContainer);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    };

    // ─── Joint War Requests ──────────────────────────────────────────────────
    // Execution + side effects orchestrated here; validation and AI acceptance
    // live in JointWarSystem, war state goes through the central diplomacy
    // system (so defensive alliance activation fires automatically).
    const jointWarLastProposalTurn = new Map<string, number>();
    const JOINT_WAR_PROPOSAL_COOLDOWN = 12;

    const formatJointWarProposalLog = (proposerId: string, receiverId: string, targetId: string, kind: JointWarKind): string => {
      const p = nationManager.getNation(proposerId)?.name ?? proposerId;
      const r = nationManager.getNation(receiverId)?.name ?? receiverId;
      const t = nationManager.getNation(targetId)?.name ?? targetId;
      return kind === 'join'
        ? `${p} asked ${r} to join the war against ${t}.`
        : `${p} proposed a joint war with ${r} against ${t}.`;
    };

    const executeJointWar = (proposerId: string, receiverId: string, targetId: string, kind: JointWarKind): void => {
      // Request: both co-declare. Join: only the receiver does (proposer already
      // at war). Defensive alliance activation fires from declareWar listeners.
      if (kind === 'request') diplomacyManager.declareWar(proposerId, targetId);
      diplomacyManager.declareWar(receiverId, targetId);
      diplomacyManager.recordJointWarAgreement(proposerId, receiverId);
    };

    const finalizeJointWar = (proposerId: string, receiverId: string, targetId: string, kind: JointWarKind, accepted: boolean): void => {
      const p = nationManager.getNation(proposerId)?.name ?? proposerId;
      const r = nationManager.getNation(receiverId)?.name ?? receiverId;
      const t = nationManager.getNation(targetId)?.name ?? targetId;
      if (accepted) {
        // State may have shifted between proposal and a delayed human accept.
        if (!jointWarSystem.canRequestJointWar(proposerId, receiverId, targetId, kind).ok) {
          hudLayer?.refresh();
          rightPanel?.requestRefresh();
          return;
        }
        executeJointWar(proposerId, receiverId, targetId, kind);
        logManager.info({
          nationIds: [proposerId, receiverId, targetId],
          category: 'diplomacy',
          message: kind === 'join'
            ? `${r} accepted and entered the war against ${t}.`
            : `${r} accepted. ${p} and ${r} declared war on ${t}.`,
        });
      } else {
        logManager.info({
          nationIds: [proposerId, receiverId, targetId],
          category: 'diplomacy',
          message: kind === 'join'
            ? `${r} rejected ${p}'s request to join the war against ${t}.`
            : `${r} rejected ${p}'s joint war proposal against ${t}.`,
        });
      }
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    };

    // AI-initiated joint-war proposals, cooldown-gated so they stay rare.
    const maybeProposeAIJointWar = (proposerId: string): void => {
      const self = nationManager.getNation(proposerId);
      if (!self || self.isHuman) return;
      const currentTurn = turnManager.getCurrentRound();
      const last = jointWarLastProposalTurn.get(proposerId);
      if (last !== undefined && currentTurn - last < JOINT_WAR_PROPOSAL_COOLDOWN) return;

      const proposal = jointWarSystem.findAIProposal(proposerId);
      if (!proposal) return;
      jointWarLastProposalTurn.set(proposerId, currentTurn);

      const { receiverNationId, targetNationId: jointTargetId, kind } = proposal;
      logManager.info({
        nationIds: [proposerId, receiverNationId, jointTargetId],
        category: 'diplomacy',
        message: formatJointWarProposalLog(proposerId, receiverNationId, jointTargetId, kind),
      });

      // Ask the human explicitly; never auto-accept on their behalf.
      if (receiverNationId === humanNationIdForDiplomacy && !isAutoplayActive()) {
        const p = self.name;
        const t = nationManager.getNation(jointTargetId)?.name ?? jointTargetId;
        const accentColor = `#${(self.color ?? 0xcccccc).toString(16).padStart(6, '0')}`;
        showDiplomacyModal({
          title: 'Joint War Request',
          message: kind === 'join'
            ? `${p} is at war with ${t} and asks you to join the war against ${t}.`
            : `${p} proposes a joint war against ${t}. Both of you would declare war on ${t}.`,
          accentColor,
          confirmLabel: 'Accept',
          cancelLabel: 'Reject',
          onConfirm: () => finalizeJointWar(proposerId, receiverNationId, jointTargetId, kind, true),
          onCancel: () => finalizeJointWar(proposerId, receiverNationId, jointTargetId, kind, false),
        });
        return;
      }

      const accepted = jointWarSystem.shouldAccept(receiverNationId, proposerId, jointTargetId, kind);
      finalizeJointWar(proposerId, receiverNationId, jointTargetId, kind, accepted);
    };

    // ─── Alliance Council (Phases 1–3) ───────────────────────────────────────
    const allianceCouncilDialog = new AllianceCouncilDialog();
    const allianceCouncilManager = new AllianceCouncilManager(
      allianceManager,
      nationManager,
      diplomacyManager,
      aiMilitaryEvaluationSystem,
      diplomaticEvaluationSystem,
      (a, b) => discoverySystem.hasMet(a, b),
      {
        getCurrentRound: () => turnManager.getCurrentRound(),
        isHuman: (nationId) => nationManager.getNation(nationId)?.isHuman === true,
        isAutoplayActive: () => isAutoplayActive(),
        log: (nationIds, message) => logManager.info({ nationIds, category: 'diplomacy', message }),
        openCouncilDialog: (view) => allianceCouncilDialog.show(view),
        closeCouncilDialog: () => allianceCouncilDialog.hide(),
        requestHumanInviteResponse: (allianceName, proposerName, onAccept, onReject) => {
          showDiplomacyModal({
            title: 'Alliance Invitation',
            message: `${proposerName}'s council invites you to join ${allianceName}.`,
            accentColor: '#c9a227',
            confirmLabel: 'Accept',
            cancelLabel: 'Reject',
            onConfirm: onAccept,
            onCancel: onReject,
          });
        },
        embargoTrade: (memberId, targetId) => {
          diplomacyManager.cancelTradeRelations(memberId, targetId);
          tradeDealSystem.cancelDealsBetween(memberId, targetId, 'cancelled');
          tradeConnectionSystem.cancelConnectionsBetweenNations(memberId, targetId);
        },
        onChanged: () => {
          hudLayer?.refresh();
          rightPanel?.requestRefresh();
        },
      },
    );
    turnManager.on('roundStart', () => allianceCouncilManager.update());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => allianceCouncilDialog.hide());

    foreignTroopViolationSystem.onWarning((event) => {
      logManager.info({
        nationIds: [event.warning.offendedNationId, event.warning.violatingNationId],
        category: 'diplomacy',
        message: `${event.offendedNationName} warned ${event.violatingNationName} about ${event.warning.unitCount} military units inside ${event.offendedNationName} territory.`,
      });

      if (event.warning.violatingNationId !== humanNationIdForDiplomacy) return;
      if (isAutoplayActive()) return;

      const offendedNation = nationManager.getNation(event.warning.offendedNationId);
      if (!offendedNation) return;
      const color = `#${offendedNation.color.toString(16).padStart(6, '0')}`;
      showDiplomacyModal({
        title: `${offendedNation.name} Warning`,
        message: 'You have military units inside our territory. What are you doing?',
        accentColor: color,
        confirmLabel: 'They are only passing through.',
        cancelLabel: 'That is none of your concern.',
        onConfirm: () => {
          foreignTroopViolationSystem.recordHumanResponse(
            event.warning.offendedNationId,
            event.warning.violatingNationId,
            'passingThrough',
          );
        },
        onCancel: () => {
          foreignTroopViolationSystem.recordHumanResponse(
            event.warning.offendedNationId,
            event.warning.violatingNationId,
            'defiant',
          );
          rightPanel?.requestRefresh();
        },
      });
    });

    foreignTroopViolationSystem.onEscalation((event) => {
      logManager.info({
        nationIds: [event.warning.offendedNationId, event.warning.violatingNationId],
        category: 'diplomacy',
        message: `${event.offendedNationName} relations worsened with ${event.violatingNationName} due to continued military presence inside ${event.offendedNationName} territory (${formatSignedDeltaLabel(event.delta.trust)}trust, ${formatSignedDeltaLabel(event.delta.hostility)}hostility).`,
      });
      rightPanel?.requestRefresh();
    });

    foreignTroopViolationSystem.onCleared((event) => {
      logManager.info({
        nationIds: [event.warning.offendedNationId, event.warning.violatingNationId],
        category: 'diplomacy',
        message: `${event.offendedNationName} reports that ${event.violatingNationName} withdrew its troops from ${event.offendedNationName} territory.`,
      });
    });

    turnManager.on('roundEnd', (event) => {
      foreignTroopViolationSystem.handleRoundEnd(event.round);
    });

    const getPeaceTreatyBlockReason = (targetNationId: string): string | null => {
      const remaining = diplomacyManager.getPeaceTreatyRemainingTurns(
        humanNationIdForDiplomacy,
        targetNationId,
        turnManager.getCurrentRound(),
      );
      return remaining > 0 ? `Peace treaty active for ${remaining} more turn${remaining === 1 ? '' : 's'}.` : null;
    };
    const logBlockedHumanWarDeclaration = (targetNationId: string): void => {
      const remaining = diplomacyManager.getPeaceTreatyRemainingTurns(
        humanNationIdForDiplomacy,
        targetNationId,
        turnManager.getCurrentRound(),
      );
      if (remaining <= 0) return;
      const humanName = nationManager.getNation(humanNationIdForDiplomacy)?.name ?? humanNationIdForDiplomacy;
      const targetName = nationManager.getNation(targetNationId)?.name ?? targetNationId;
      logManager.info({
        nationIds: [humanNationIdForDiplomacy, targetNationId],
        category: 'diplomacy',
        message: `${humanName} cannot declare war on ${targetName} for ${remaining} more turn${remaining === 1 ? '' : 's'} due to active peace treaty.`,
      });
    };

    // War declaration modal when human tries to attack a nation at peace
    combatSystem.onWarRequired((e) => {
      if (e.source !== 'human-ui') return;
      if (e.attacker.ownerId !== humanNationIdForDiplomacy) return;

      const targetNation = nationManager.getNation(e.targetNationId);
      if (!targetNation) return;
      if (getPeaceTreatyBlockReason(e.targetNationId)) {
        logBlockedHumanWarDeclaration(e.targetNationId);
        rightPanel?.refreshCurrent();
        return;
      }
      const color = `#${targetNation.color.toString(16).padStart(6, '0')}`;

      showDiplomacyModal({
        title: 'Declare War',
        message: `Declare war on ${targetNation.name}?`,
        accentColor: '#c44',
        confirmLabel: 'Declare War!',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          if (!diplomacyManager.declareWar(humanNationIdForDiplomacy, e.targetNationId)) {
            logBlockedHumanWarDeclaration(e.targetNationId);
            rightPanel?.refreshCurrent();
            return;
          }
          // Re-attempt attack now that war is declared
          combatSystem.tryAttack(e.attacker, e.tileX, e.tileY, { source: 'human-ui' });
          rightPanel?.refreshCurrent();
        },
        onCancel: () => {},
      });
    });

    movementSystem.onWarRequired((e) => {
      if (e.source !== 'human-ui') return;
      if (e.unit.ownerId !== humanNationIdForDiplomacy) return;

      const targetNation = nationManager.getNation(e.targetNationId);
      if (!targetNation) return;
      if (getPeaceTreatyBlockReason(e.targetNationId)) {
        logBlockedHumanWarDeclaration(e.targetNationId);
        rightPanel?.refreshCurrent();
        return;
      }

      showDiplomacyModal({
        title: 'Declare War',
        message: `Declare war on ${targetNation.name} to enter their territory?`,
        accentColor: '#c44',
        confirmLabel: 'Declare War!',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          if (!diplomacyManager.declareWar(humanNationIdForDiplomacy, e.targetNationId)) {
            logBlockedHumanWarDeclaration(e.targetNationId);
            rightPanel?.refreshCurrent();
            return;
          }
          const targetTile = tileMap.getTileAt(e.tileX, e.tileY);
          if (targetTile !== null) {
            movementSystem.moveAlongPath(e.unit, [targetTile], { source: 'human-ui' });
          }
          rightPanel?.refreshCurrent();
        },
        onCancel: () => {},
      });
    });

    // AI proposes peace when all units lost (subject to normal peace rules)
    unitManager.onUnitChanged((event) => {
      if (event.reason !== 'removed') return;
      const deadOwnerId = event.unit.ownerId;
      const nation = nationManager.getNation(deadOwnerId);
      if (!nation || nation.isHuman) return;
      if (diplomacyManager.getState(deadOwnerId, humanNationIdForDiplomacy) !== 'WAR') return;
      if (unitManager.getUnitsByOwner(deadOwnerId).length > 0) return;
      const currentTurn = turnManager.getCurrentRound();
      if (!diplomacyManager.canProposePeace(deadOwnerId, humanNationIdForDiplomacy, currentTurn)) return;
      const treaty = peaceTreatySystem.buildAIPeaceTreaty(deadOwnerId, humanNationIdForDiplomacy);
      if (!treaty) return; // capital-only nation — fight to the end
      diplomacyManager.proposePeace(deadOwnerId, humanNationIdForDiplomacy, treaty);
    });

    // Peace proposal modal (incoming from AI only)
    diplomacyManager.onPeaceProposed((proposal) => {
      // Skip modal if human is the proposer (already handled via diplomacyAction)
      if (proposal.fromNationId === humanNationIdForDiplomacy) return;

      // AI-to-AI peace: the receiving AI auto-evaluates without showing a player modal.
      if (proposal.toNationId !== humanNationIdForDiplomacy) {
        const accepted = peaceTreatySystem.aiShouldAcceptTreaty(proposal, proposal.toNationId);
        if (accepted) {
          logTreatyDetails(proposal);
          peaceTreatySystem.executeTreaty(proposal);
        }
        diplomacyManager.respondToPeace(proposal.fromNationId, proposal.toNationId, accepted);
        if (!isAutoplayActive()) rightPanel?.requestRefresh();
        return;
      }

      if (isAutoplayActive()) {
        const accepted = shouldAutoplayAcceptPeace(proposal);
        logTreatyDetails(proposal);
        if (accepted) peaceTreatySystem.executeTreaty(proposal);
        diplomacyManager.respondToPeace(proposal.fromNationId, proposal.toNationId, accepted);
        logAutoplayPeaceResolution(proposal, accepted);
        return;
      }

      const nation = nationManager.getNation(proposal.fromNationId);
      if (!nation) return;
      const color = `#${nation.color.toString(16).padStart(6, '0')}`;

      const offeredCity = proposal.offeredCityId ? cityManager.getCity(proposal.offeredCityId) : undefined;
      const cityLine = offeredCity ? `\nOffers city: ${offeredCity.name}` : '';
      const goldLine = proposal.goldReparations && proposal.goldReparations > 0
        ? `\nWar reparations: ${proposal.goldReparations} gold`
        : '';
      const durationLine = `\nWar duration: ${proposal.warDuration} turn${proposal.warDuration === 1 ? '' : 's'}`;

      showDiplomacyModal({
        title: 'Peace Proposal',
        message: `${nation.name} proposes peace.${durationLine}${cityLine}${goldLine}\n\nAccept?`,
        accentColor: color,
        confirmLabel: 'Accept',
        cancelLabel: 'Decline',
        onConfirm: () => {
          logTreatyDetails(proposal);
          peaceTreatySystem.executeTreaty(proposal);
          diplomacyManager.respondToPeace(proposal.fromNationId, humanNationIdForDiplomacy, true);
          rightPanel?.refreshCurrent();
        },
        onCancel: () => {
          diplomacyManager.respondToPeace(proposal.fromNationId, humanNationIdForDiplomacy, false);
        },
      });
    });

    diplomacyManager.onPeaceAccepted((nationA, nationB) => {
      const nameA = nationManager.getNation(nationA)?.name ?? nationA;
      const nameB = nationManager.getNation(nationB)?.name ?? nationB;
      console.log(`[Diplomacy] Peace established: ${nameA} / ${nameB}`);
      const aiActor = isAINation(nationA) ? nationA : isAINation(nationB) ? nationB : undefined;
      logManager.info({
        nationId: aiActor,
        nationIds: [nationA, nationB],
        category: 'diplomacy',
        message: `peace was made between ${nameA} and ${nameB}.`,
      });
      logManager.info({
        nationIds: [nationA, nationB],
        category: 'diplomacy',
        message: `${nameA} and ${nameB} entered enforced peace treaty for ${PEACE_TREATY_COOLDOWN_TURNS} turns.`,
      });
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });

    // Assigned just below; declared first so the war-log listener can ask
    // whether the current declaration is a defensive ally join (logged
    // separately with alliance context, so the generic line is skipped).
    let allianceWarSystem: AllianceWarSystem | null = null;
    diplomacyManager.onWarDeclared((aggressorId, targetId) => {
      if (allianceWarSystem?.isActivating()) return;
      const nameA = nationManager.getNation(aggressorId)?.name ?? aggressorId;
      const nameB = nationManager.getNation(targetId)?.name ?? targetId;
      console.log(`[Diplomacy] War declared: ${nameA} → ${nameB}`);
      logManager.info({
        nationId: isAINation(aggressorId) ? aggressorId : undefined,
        nationIds: [aggressorId, targetId],
        category: 'diplomacy',
        message: `${nameA} declared war on ${nameB}.`,
      });
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    diplomacyManager.onDiplomacyChanged(() => {
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });

    // Defensive Alliance Activation: when an alliance member is attacked, its
    // ally automatically joins the war. Registered after the generic war-log
    // listener so the original declaration is logged first.
    allianceWarSystem = new AllianceWarSystem(diplomacyManager, allianceManager);
    allianceWarSystem.onActivation(({ attackerNationId, defenderNationId, joiningNationId, allianceName }) => {
      const attackerName = nationManager.getNation(attackerNationId)?.name ?? attackerNationId;
      const defenderName = nationManager.getNation(defenderNationId)?.name ?? defenderNationId;
      const joiningName = nationManager.getNation(joiningNationId)?.name ?? joiningNationId;

      logManager.info({
        nationId: isAINation(joiningNationId) ? joiningNationId : undefined,
        nationIds: [joiningNationId, attackerNationId],
        category: 'diplomacy',
        message: `${joiningName} entered the war against ${attackerName} (Alliance: ${allianceName}).`,
      });
      hudLayer?.refresh();
      rightPanel?.requestRefresh();

      if (isAutoplayActive()) return;
      const human = humanNationIdForDiplomacy;
      let message: string | null = null;
      if (joiningNationId === human) {
        message = `${attackerName} has declared war on your ally ${defenderName}.\nAccording to the ${allianceName}, you have entered the war against ${attackerName}.`;
      } else if (defenderNationId === human) {
        message = `${attackerName} has declared war on you.\nYour ally ${joiningName} has entered the war against ${attackerName}.`;
      } else if (attackerNationId === human) {
        message = `You declared war on ${defenderName}.\n${defenderName}'s ally ${joiningName} has entered the war against you.`;
      }
      if (message === null) return;
      const accentColor = `#${(nationManager.getNation(attackerNationId)?.color ?? 0xcc4444).toString(16).padStart(6, '0')}`;
      showDiplomacyModal({
        title: 'Alliance Activated',
        message,
        accentColor,
        confirmLabel: 'Understood',
        cancelLabel: '',
        onConfirm: () => {},
        onCancel: () => {},
      });
    });

    const refreshAfterGift = (fromNationId: string, toNationId: string): void => {
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      leaderStrip?.rebuild();
      resourceSystem.recalculateForNation(fromNationId);
      resourceSystem.recalculateForNation(toNationId);
      happinessSystem.recalculateNation(fromNationId);
      happinessSystem.recalculateNation(toNationId);
    };

    const transferGiftCity = (city: City, toNationId: string): void => {
      city.occupiedOriginalNationId = city.originNationId !== toNationId
        ? city.originNationId
        : undefined;
      cityManager.transferOwnership(city.id, toNationId, productionSystem);
      cityTerritorySystem.transferCityTerritory(city, toNationId, mapData);
      culturalSphereSystem.claimInitialCityCulture(city, mapData, gridSystem);
      cityRenderer.refreshCity(city);
      cityBannerRenderer.refreshCity(city);
      territoryRenderer.invalidate();
      rebuildMinimapForGameplay();
      refreshCultureOverlay();
      discoverySystem.scan();
      updateFog();
    };

    // Cost of a "symbolic gift of gesture" and its UI symbol. The gift transfers
    // no value — only the giver pays — and is a one-time courtesy per leader.
    const SYMBOLIC_GIFT_COST = 100;
    const SYMBOLIC_GIFT_SYMBOL = '🎁';

    /** Small modal acknowledging a gift, with the leader's heraldic framing. */
    const showLeaderResponsePopup = (targetNationId: string, title: string, lines: string[]): void => {
      const targetNation = nationManager.getNation(targetNationId);
      if (!targetNation) return;
      document.getElementById('diplomatic-gift-response')?.remove();

      const overlay = document.createElement('div');
      overlay.id = 'diplomatic-gift-response';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.62);'
        + 'display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#edf4ff;';

      const panel = document.createElement('div');
      panel.style.cssText = 'width:min(460px,calc(100vw - 32px));background:#111923;border-radius:6px;'
        + 'box-shadow:0 24px 80px rgba(0,0,0,0.55);padding:20px;'
        + `border:2px solid #${targetNation.color.toString(16).padStart(6, '0')};`;
      overlay.appendChild(panel);

      const heading = document.createElement('h2');
      heading.textContent = title;
      heading.style.cssText = 'margin:0 0 12px;font-size:20px;';
      panel.appendChild(heading);

      for (const line of lines) {
        const p = document.createElement('div');
        p.textContent = line;
        p.style.cssText = 'margin-bottom:8px;color:#cbd8ea;line-height:1.4;';
        panel.appendChild(p);
      }

      const controls = document.createElement('div');
      controls.style.cssText = 'display:flex;justify-content:flex-end;margin-top:16px;';
      const okButton = document.createElement('button');
      okButton.textContent = 'Close';
      okButton.style.cssText = 'padding:9px 16px;border-radius:4px;border:1px solid rgba(143,163,190,0.55);'
        + 'background:#1a2b38;color:#edf4ff;font-weight:700;cursor:pointer;';
      okButton.onclick = () => overlay.remove();
      controls.appendChild(okButton);
      panel.appendChild(controls);

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) overlay.remove();
      });
      document.body.appendChild(overlay);
      okButton.focus();
    };

    /**
     * Acknowledge a gift the player just gave: the leader thanks them, and at a
     * first meeting (not at war, AI can afford it) returns its own symbolic gift
     * of gesture — applied once per pair.
     */
    const showLeaderGiftResponse = (targetNationId: string): void => {
      const targetNation = nationManager.getNation(targetNationId);
      if (!targetNation) return;
      const human = humanNationIdForDiplomacy;
      const aiLeaderName = getLeaderByNationId(targetNationId)?.name ?? targetNation.name;
      const lines: string[] = [`${aiLeaderName} accepts your gift and thanks you.`];

      const notAtWar = diplomacyManager.getState(human, targetNationId) !== 'WAR';
      const aiGold = nationManager.getResources(targetNationId).gold;
      if (notAtWar && aiGold >= SYMBOLIC_GIFT_COST && !symbolicGiftRegistry.hasReciprocated(human, targetNationId)) {
        resourceSystem.addGold(targetNationId, -SYMBOLIC_GIFT_COST);
        diplomacyManager.recordSymbolicGift(targetNationId, human);
        symbolicGiftRegistry.markReciprocated(human, targetNationId);
        lines.push(`${aiLeaderName} gives you a symbolic gift of gesture.`);
        logManager.info({
          nationIds: [human, targetNationId],
          category: 'diplomacy',
          message: `${targetNation.name} returned a symbolic gift of gesture.`,
        });
        refreshAfterGift(human, targetNationId);
      }

      showLeaderResponsePopup(targetNationId, aiLeaderName, lines);
    };

    const showGiftDialog = (targetNationId: string): void => {
      const targetNation = nationManager.getNation(targetNationId);
      const humanNation = nationManager.getNation(humanNationIdForDiplomacy);
      if (!targetNation || !humanNation) return;

      const existing = document.getElementById('diplomatic-gift-modal');
      existing?.remove();

      const overlay = document.createElement('div');
      overlay.id = 'diplomatic-gift-modal';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.zIndex = '10000';
      overlay.style.background = 'rgba(0,0,0,0.62)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.fontFamily = 'sans-serif';
      overlay.style.color = '#edf4ff';

      const panel = document.createElement('div');
      panel.style.width = 'min(760px, calc(100vw - 32px))';
      panel.style.maxHeight = 'min(760px, calc(100vh - 32px))';
      panel.style.overflow = 'auto';
      panel.style.background = '#111923';
      panel.style.border = `2px solid #${targetNation.color.toString(16).padStart(6, '0')}`;
      panel.style.borderRadius = '6px';
      panel.style.boxShadow = '0 24px 80px rgba(0,0,0,0.55)';
      panel.style.padding = '20px';
      overlay.appendChild(panel);

      const title = document.createElement('h2');
      title.textContent = `Give Gift to ${targetNation.name}`;
      title.style.margin = '0 0 12px';
      title.style.fontSize = '22px';
      panel.appendChild(title);

      const message = document.createElement('div');
      message.style.minHeight = '20px';
      message.style.marginBottom = '12px';
      message.style.color = '#aebdd0';
      panel.appendChild(message);

      const form = document.createElement('div');
      form.style.display = 'grid';
      form.style.gap = '12px';
      panel.appendChild(form);

      const makeSection = (label: string, value?: string): HTMLDivElement => {
        const section = document.createElement('div');
        section.style.border = '1px solid rgba(143,163,190,0.35)';
        section.style.borderRadius = '6px';
        section.style.padding = '12px';
        const header = document.createElement('label');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '8px';
        header.style.fontWeight = '700';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'gift-kind';
        radio.value = value ?? label.toLowerCase();
        header.appendChild(radio);
        header.append(label);
        section.appendChild(header);
        form.appendChild(section);
        return section;
      };

      const availableGold = Math.max(0, Math.floor(nationManager.getResources(humanNationIdForDiplomacy).gold));

      // Symbolic gift of gesture — listed first. It may be given only once per
      // nation, so once presented the option is omitted from the dialog entirely.
      const symbolicAlreadyGiven = symbolicGiftRegistry.hasGivenSymbolic(humanNationIdForDiplomacy, targetNationId);
      if (!symbolicAlreadyGiven) {
        const canAffordSymbolic = availableGold >= SYMBOLIC_GIFT_COST;
        const symbolicSection = makeSection(`${SYMBOLIC_GIFT_SYMBOL} Symbolic gift of gesture (${SYMBOLIC_GIFT_COST} gold)`, 'symbolic');
        const symbolicRadio = symbolicSection.querySelector('input[type="radio"]') as HTMLInputElement;
        symbolicRadio.disabled = !canAffordSymbolic;
        symbolicSection.style.opacity = canAffordSymbolic ? '1' : '0.5';
        const symbolicHint = document.createElement('div');
        symbolicHint.style.marginTop = '8px';
        symbolicHint.style.color = '#aebdd0';
        symbolicHint.style.fontSize = '13px';
        symbolicHint.textContent = canAffordSymbolic
          ? 'A formal gesture of respect and friendliness. No gold changes hands.'
          : `Requires ${SYMBOLIC_GIFT_COST} gold.`;
        symbolicSection.appendChild(symbolicHint);
      }

      const goldSection = makeSection('Gold');
      const goldRadio = goldSection.querySelector('input[type="radio"]') as HTMLInputElement;
      goldRadio.checked = true;
      const goldInput = document.createElement('input');
      goldInput.type = 'number';
      goldInput.min = '1';
      goldInput.max = String(availableGold);
      goldInput.step = '1';
      goldInput.value = String(Math.min(50, Math.max(1, availableGold)));
      goldInput.style.marginTop = '10px';
      goldInput.style.width = '160px';
      goldInput.style.padding = '8px';
      goldInput.style.background = '#0b1118';
      goldInput.style.color = '#edf4ff';
      goldInput.style.border = '1px solid rgba(143,163,190,0.55)';
      goldInput.style.borderRadius = '4px';
      goldSection.appendChild(goldInput);
      goldInput.addEventListener('focus', () => {
        goldRadio.checked = true;
        updateValidation();
      });
      const goldHint = document.createElement('div');
      goldHint.textContent = `Available gold: ${availableGold}`;
      goldHint.style.marginTop = '6px';
      goldHint.style.color = '#aebdd0';
      goldSection.appendChild(goldHint);

      const unitSection = makeSection('Military Units');
      const unitRadio = unitSection.querySelector('input[type="radio"]') as HTMLInputElement;
      const unitList = document.createElement('div');
      unitList.style.marginTop = '10px';
      unitList.style.display = 'grid';
      unitList.style.gap = '6px';
      const unitGiftWarBlocked = diplomacyManager.getState(humanNationIdForDiplomacy, targetNationId) === 'WAR';
      const giftableUnits = unitGiftWarBlocked
        ? []
        : unitManager.getUnitsByOwner(humanNationIdForDiplomacy)
          .filter((unit) => isMilitaryUnitType(unit.unitType))
          .filter((unit) => unit.carriedByUnitId === undefined)
          .filter((unit) => unit.cargoUnitIds.length === 0);
      for (const unit of giftableUnits) {
        const row = document.createElement('label');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.alignItems = 'center';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.value = unit.id;
        row.appendChild(box);
        const power = Math.max(unit.unitType.baseStrength, unit.unitType.rangedStrength ?? 0);
        row.append(`${unit.unitType.name} at (${unit.tileX},${unit.tileY})  Power ${power}`);
        unitList.appendChild(row);
      }
      if (unitGiftWarBlocked || giftableUnits.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = unitGiftWarBlocked ? 'Cannot gift units during war.' : 'No military units available.';
        empty.style.color = '#aebdd0';
        unitList.appendChild(empty);
      }
      unitSection.appendChild(unitList);
      unitList.addEventListener('change', () => {
        unitRadio.checked = true;
        updateValidation();
      });

      const citySection = makeSection('City');
      const cityRadio = citySection.querySelector('input[type="radio"]') as HTMLInputElement;
      const cityList = document.createElement('div');
      cityList.style.marginTop = '10px';
      cityList.style.display = 'grid';
      cityList.style.gap = '6px';
      const humanCities = cityManager.getCitiesByOwner(humanNationIdForDiplomacy);
      const giftableCities = humanCities.filter((city) => !city.isCapital && !city.isResidenceCapital && humanCities.length > 1);
      for (const city of giftableCities) {
        const row = document.createElement('label');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.alignItems = 'center';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'gift-city-id';
        radio.value = city.id;
        row.appendChild(radio);
        row.append(`${city.name}  Pop ${city.population}`);
        cityList.appendChild(row);
      }
      if (giftableCities.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = humanCities.length <= 1 ? 'Cannot gift your last remaining city.' : 'Cannot gift capital.';
        empty.style.color = '#aebdd0';
        cityList.appendChild(empty);
      }
      citySection.appendChild(cityList);
      cityList.addEventListener('change', () => {
        cityRadio.checked = true;
        updateValidation();
      });

      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.justifyContent = 'flex-end';
      controls.style.gap = '10px';
      controls.style.marginTop = '16px';
      panel.appendChild(controls);

      const cancelButton = document.createElement('button');
      cancelButton.textContent = 'Cancel';
      const confirmButton = document.createElement('button');
      confirmButton.textContent = 'Confirm Gift';
      for (const button of [cancelButton, confirmButton]) {
        button.style.padding = '9px 14px';
        button.style.borderRadius = '4px';
        button.style.border = '1px solid rgba(143,163,190,0.55)';
        button.style.background = '#1a2b38';
        button.style.color = '#edf4ff';
        button.style.fontWeight = '700';
      }
      controls.append(cancelButton, confirmButton);

      type GiftKind = 'gold' | 'military units' | 'city' | 'symbolic';
      const getGiftKind = (): GiftKind => (
        (form.querySelector('input[name="gift-kind"]:checked') as HTMLInputElement | null)?.value as GiftKind
      ) ?? 'gold';

      const getValidationMessage = (): string | null => {
        const kind = getGiftKind();
        if (kind === 'gold') {
          const amount = Math.floor(Number(goldInput.value));
          if (!Number.isFinite(amount) || amount <= 0) return 'Enter a positive gold amount.';
          if (amount > nationManager.getResources(humanNationIdForDiplomacy).gold) return 'Not enough gold.';
          return null;
        }
        if (kind === 'symbolic') {
          if (symbolicAlreadyGiven) return `Already presented to ${targetNation.name}.`;
          if (nationManager.getResources(humanNationIdForDiplomacy).gold < SYMBOLIC_GIFT_COST) {
            return `Requires ${SYMBOLIC_GIFT_COST} gold.`;
          }
          return null;
        }
        if (kind === 'military units') {
          if (unitGiftWarBlocked) return 'Cannot gift units during war.';
          const selected = unitList.querySelectorAll('input[type="checkbox"]:checked');
          if (selected.length === 0) return 'Select at least one military unit.';
          return null;
        }
        const cityId = (cityList.querySelector('input[name="gift-city-id"]:checked') as HTMLInputElement | null)?.value;
        if (!cityId) return giftableCities.length === 0 ? 'No giftable city available.' : 'Select a city.';
        return null;
      };

      const updateValidation = (): void => {
        const reason = getValidationMessage();
        confirmButton.disabled = reason !== null;
        confirmButton.style.opacity = reason ? '0.5' : '1';
        confirmButton.style.cursor = reason ? 'not-allowed' : 'pointer';
        message.textContent = reason ?? 'Choose a gift and confirm.';
      };

      form.addEventListener('input', updateValidation);
      form.addEventListener('change', updateValidation);
      cancelButton.onclick = () => overlay.remove();
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) overlay.remove();
      });
      confirmButton.onclick = () => {
        if (getValidationMessage()) {
          updateValidation();
          return;
        }
        const kind = getGiftKind();
        if (kind === 'gold') {
          const amount = Math.floor(Number(goldInput.value));
          resourceSystem.addGold(humanNationIdForDiplomacy, -amount);
          resourceSystem.addGold(targetNationId, amount);
          diplomacyManager.recordGoldGift(humanNationIdForDiplomacy, targetNationId, amount);
          logManager.info({
            nationIds: [humanNationIdForDiplomacy, targetNationId],
            category: 'diplomacy',
            message: `${humanNation.name} gave ${amount} gold to ${targetNation.name}.`,
          });
        } else if (kind === 'military units') {
          const selectedIds = Array.from(unitList.querySelectorAll('input[type="checkbox"]:checked'))
            .map((input) => (input as HTMLInputElement).value);
          let powerValue = 0;
          let transferred = 0;
          for (const unitId of selectedIds) {
            const unit = unitManager.getUnit(unitId);
            if (!unit || unit.ownerId !== humanNationIdForDiplomacy || !isMilitaryUnitType(unit.unitType)) continue;
            powerValue += Math.max(unit.unitType.baseStrength, unit.unitType.rangedStrength ?? 0);
            if (unitManager.transferOwnership(unit.id, targetNationId)) transferred++;
          }
          if (transferred > 0) {
            diplomacyManager.recordUnitGift(humanNationIdForDiplomacy, targetNationId, transferred, powerValue);
            discoverySystem.scan();
            updateFog();
            logManager.info({
              nationIds: [humanNationIdForDiplomacy, targetNationId],
              category: 'diplomacy',
              message: `${humanNation.name} gifted ${transferred} military unit${transferred === 1 ? '' : 's'} to ${targetNation.name}.`,
            });
          }
        } else if (kind === 'symbolic') {
          // A formal courtesy: the giver pays, the recipient receives no gold.
          resourceSystem.addGold(humanNationIdForDiplomacy, -SYMBOLIC_GIFT_COST);
          if (!symbolicGiftRegistry.hasGivenSymbolic(humanNationIdForDiplomacy, targetNationId)) {
            diplomacyManager.recordSymbolicGift(humanNationIdForDiplomacy, targetNationId);
            symbolicGiftRegistry.markGivenSymbolic(humanNationIdForDiplomacy, targetNationId);
          }
          logManager.info({
            nationIds: [humanNationIdForDiplomacy, targetNationId],
            category: 'diplomacy',
            message: `${humanNation.name} presented a symbolic gift of gesture to ${targetNation.name}.`,
          });
        } else {
          const cityId = (cityList.querySelector('input[name="gift-city-id"]:checked') as HTMLInputElement | null)?.value;
          const city = cityId ? cityManager.getCity(cityId) : undefined;
          if (!city || city.ownerId !== humanNationIdForDiplomacy || city.isCapital || city.isResidenceCapital || humanCities.length <= 1) {
            updateValidation();
            return;
          }
          transferGiftCity(city, targetNationId);
          diplomacyManager.recordCityGift(humanNationIdForDiplomacy, targetNationId, city.id);
          logManager.info({
            nationIds: [humanNationIdForDiplomacy, targetNationId],
            category: 'diplomacy',
            message: `${humanNation.name} gifted ${city.name} to ${targetNation.name}.`,
          });
        }
        refreshAfterGift(humanNationIdForDiplomacy, targetNationId);
        overlay.remove();
        showLeaderGiftResponse(targetNationId);
      };

      document.body.appendChild(overlay);
      updateValidation();
      goldInput.focus();
    };

    // Diplomacy actions from right-side details buttons
    const onDiplomacyAction = (event: Event) => {
      const { action, targetNationId } = (event as CustomEvent<{ action: string; targetNationId: string; fromCityId?: string; toCityId?: string; setupPaymentGold?: number }>).detail;
      const targetNation = nationManager.getNation(targetNationId);
      if (!targetNation) return;
      const color = `#${targetNation.color.toString(16).padStart(6, '0')}`;
      const validationContext = {
        haveMet: (a: string, b: string): boolean => discoverySystem.hasMet(a, b),
        hasTechnology: (nationId: string, techId: string): boolean => researchSystem.isResearched(nationId, techId),
        hasCulture: (nationId: string, cultureId: string): boolean => cultureSystem.isUnlocked(nationId, cultureId),
      };

      if (action === 'declareWar') {
        const peaceTreatyReason = getPeaceTreatyBlockReason(targetNationId);
        if (peaceTreatyReason) {
          logBlockedHumanWarDeclaration(targetNationId);
          rightPanel?.refreshCurrent();
          return;
        }
        showDiplomacyModal({
          title: 'Declare War',
          message: `Declare war on ${targetNation.name}?`,
          accentColor: '#c44',
          confirmLabel: 'Declare War!',
          cancelLabel: 'Cancel',
          onConfirm: () => {
            if (!diplomacyManager.declareWar(humanNationIdForDiplomacy, targetNationId)) {
              logBlockedHumanWarDeclaration(targetNationId);
            }
            rightPanel?.refreshCurrent();
          },
          onCancel: () => {},
        });
      } else if (action === 'proposePeace') {
        const currentTurn = turnManager.getCurrentRound();
        if (!diplomacyManager.canProposePeace(humanNationIdForDiplomacy, targetNationId, currentTurn)) return;
        const offeredCity = peaceTreatySystem.selectPeaceOfferCity(humanNationIdForDiplomacy);
        if (!offeredCity) return; // capital-only — cannot propose peace
        const aggressorId = diplomacyManager.getAggressorNationId(humanNationIdForDiplomacy, targetNationId);
        const isAggressor = aggressorId === humanNationIdForDiplomacy;
        const goldReparations = isAggressor ? peaceTreatySystem.calculateReparations(humanNationIdForDiplomacy) : undefined;

        const cityLine = `\nOffering city: ${offeredCity.name}`;
        const goldLine = goldReparations && goldReparations > 0 ? `\nWar reparations: ${goldReparations} gold` : '';
        const warDuration = diplomacyManager.getWarDuration(humanNationIdForDiplomacy, targetNationId, currentTurn);
        const durationLine = `\nWar duration: ${warDuration} turn${warDuration === 1 ? '' : 's'}`;

        showDiplomacyModal({
          title: 'Propose Peace',
          message: `Propose peace to ${targetNation.name}?${durationLine}${cityLine}${goldLine}`,
          accentColor: color,
          confirmLabel: 'Propose',
          cancelLabel: 'Cancel',
          onConfirm: () => {
            const treaty = { offeredCityId: offeredCity.id, goldReparations };
            diplomacyManager.proposePeace(humanNationIdForDiplomacy, targetNationId, treaty);
            const pendingProposal = diplomacyManager.getPendingProposal(targetNationId);
            const accepted = pendingProposal
              ? peaceTreatySystem.aiShouldAcceptTreaty(pendingProposal, targetNationId)
              : false;
            if (accepted && pendingProposal) {
              logTreatyDetails(pendingProposal);
              peaceTreatySystem.executeTreaty(pendingProposal);
            }
            diplomacyManager.respondToPeace(humanNationIdForDiplomacy, targetNationId, accepted);
            if (!accepted) {
              const toName = nationManager.getNation(targetNationId)?.name ?? targetNationId;
              logManager.info({
                nationIds: [humanNationIdForDiplomacy, targetNationId],
                category: 'diplomacy',
                message: `${toName} rejected the peace offer.`,
              });
            }
            rightPanel?.refreshCurrent();
          },
          onCancel: () => {},
        });
      } else if (action === 'toggleOpenBorders') {
        if (diplomacyManager.getState(humanNationIdForDiplomacy, targetNationId) === 'WAR') return;
        diplomacyManager.toggleOpenBorders(humanNationIdForDiplomacy, targetNationId);
        rightPanel?.refreshCurrent();
      } else if (action === 'establishEmbassy') {
        if (!diplomacyManager.canEstablishEmbassy(
          humanNationIdForDiplomacy,
          targetNationId,
          validationContext,
        ).ok) return;
        diplomacyManager.establishEmbassy(humanNationIdForDiplomacy, targetNationId);
        rightPanel?.refreshCurrent();
      } else if (action === 'establishTradeRelations') {
        if (!diplomacyManager.canEstablishTradeRelations(
          humanNationIdForDiplomacy,
          targetNationId,
          validationContext,
        ).ok) return;
        diplomacyManager.establishTradeRelations(humanNationIdForDiplomacy, targetNationId);
        rightPanel?.refreshCurrent();
      } else if (action === 'cancelTradeRelations') {
        diplomacyManager.cancelTradeRelations(humanNationIdForDiplomacy, targetNationId);
        rightPanel?.refreshCurrent();
      } else if (action === 'exchangeMaps') {
        const leaderName = getLeaderByNationId(targetNationId)?.name ?? targetNation.name;
        const atWar = diplomacyManager.getState(humanNationIdForDiplomacy, targetNationId) === 'WAR';
        const attitude = diplomaticEvaluationSystem?.evaluateAttitude(targetNationId, humanNationIdForDiplomacy) ?? 'neutral';
        const accepted = !atWar && attitude !== 'hostile';

        if (accepted) {
          // Reuse the normal city-discovery path for every current AI city.
          // Already-known cities are ignored by discoverCity().
          for (const city of cityManager.getCitiesByOwner(targetNationId)) {
            visibilitySystem.discoverCity(city);
          }
          diplomacyManager.recordMapExchange(humanNationIdForDiplomacy, targetNationId);
          updateFog();
          logManager.info({
            nationIds: [humanNationIdForDiplomacy, targetNationId],
            category: 'diplomacy',
            message: `${leaderName} agrees to exchange maps.`,
          });
        } else {
          logManager.info({
            nationIds: [humanNationIdForDiplomacy, targetNationId],
            category: 'diplomacy',
            message: `${leaderName} refuses to exchange maps.`,
          });
        }
        hudLayer?.refresh();
        rightPanel?.refreshCurrent();
      } else if (action === 'giveGift') {
        showGiftDialog(targetNationId);
      } else if (action === 'proposeAlliance') {
        // Alliance Core v1: human proposes, AI accepts deterministically.
        const allianceContext = {
          haveMet: (a: string, b: string): boolean => discoverySystem.hasMet(a, b),
          isAtWar: (a: string, b: string): boolean => diplomacyManager.getState(a, b) === 'WAR',
          hasOpenBorders: (a: string, b: string): boolean => diplomacyManager.isOpenBorderGrantedFrom(a, b),
          hasEmbassy: (a: string, b: string): boolean => diplomacyManager.hasEmbassy(a, b),
          hasTradeRelations: (a: string, b: string): boolean => diplomacyManager.hasTradeRelations(a, b),
        };
        const humanName = nationManager.getNation(humanNationIdForDiplomacy)?.name ?? humanNationIdForDiplomacy;
        // Default generated name for v1 — the proposer's leader name.
        const proposerLeaderName = getLeaderByNationId(humanNationIdForDiplomacy)?.name ?? humanName;

        if (!allianceManager.canProposeAlliance(humanNationIdForDiplomacy, targetNationId, allianceContext).ok) {
          rightPanel?.refreshCurrent();
          return;
        }

        const relation = diplomacyManager.getRelation(humanNationIdForDiplomacy, targetNationId);
        const accepted = allianceManager.shouldAcceptAlliance(
          humanNationIdForDiplomacy,
          targetNationId,
          allianceContext,
          { trust: relation.trust, hostility: relation.hostility },
        );

        if (accepted) {
          const alliance = allianceManager.createAlliance(
            humanNationIdForDiplomacy,
            targetNationId,
            `${proposerLeaderName} Alliance`,
            turnManager.getCurrentRound(),
          );
          if (alliance) {
            diplomacyManager.recordAllianceFormed(humanNationIdForDiplomacy, targetNationId);
            logManager.info({
              nationIds: [humanNationIdForDiplomacy, targetNationId],
              category: 'diplomacy',
              message: `${humanName} and ${targetNation.name} formed ${alliance.name}.`,
            });
          }
        } else {
          logManager.info({
            nationIds: [humanNationIdForDiplomacy, targetNationId],
            category: 'diplomacy',
            message: `${targetNation.name} rejected an alliance proposal from ${humanName}.`,
          });
        }
        hudLayer?.refresh();
        rightPanel?.refreshCurrent();
      } else if (action === 'requestJointWar' || action === 'askToJoinWar') {
        // Human (proposer) asks the viewed nation (receiver) to start/join a
        // war against a chosen third-party target.
        const kind: JointWarKind = action === 'requestJointWar' ? 'request' : 'join';
        const jointDetail = (event as CustomEvent).detail as { jointWarTargetNationId?: string };
        const jointTargetId = jointDetail.jointWarTargetNationId;
        const receiverId = targetNationId;
        const proposerId = humanNationIdForDiplomacy;
        if (!jointTargetId || !jointWarSystem.canRequestJointWar(proposerId, receiverId, jointTargetId, kind).ok) {
          rightPanel?.refreshCurrent();
          return;
        }
        logManager.info({
          nationIds: [proposerId, receiverId, jointTargetId],
          category: 'diplomacy',
          message: formatJointWarProposalLog(proposerId, receiverId, jointTargetId, kind),
        });
        const accepted = jointWarSystem.shouldAccept(receiverId, proposerId, jointTargetId, kind);
        finalizeJointWar(proposerId, receiverId, jointTargetId, kind, accepted);
        if (!isAutoplayActive()) {
          const receiverName = targetNation.name;
          const jointTargetName = nationManager.getNation(jointTargetId)?.name ?? jointTargetId;
          showDiplomacyModal({
            title: 'Joint War',
            message: accepted
              ? (kind === 'join'
                ? `${receiverName} agreed to join the war against ${jointTargetName}.`
                : `${receiverName} agreed to a joint war against ${jointTargetName}.`)
              : `${receiverName} declined your request regarding ${jointTargetName}.`,
            accentColor: color,
            confirmLabel: 'Understood',
            cancelLabel: '',
            onConfirm: () => {},
            onCancel: () => {},
          });
        }
        rightPanel?.refreshCurrent();
      } else if (action === 'proposeTradeRoute') {
        const detail = (event as CustomEvent).detail as { fromCityId: string; toCityId: string; setupPaymentGold: number };
        const { fromCityId, toCityId, setupPaymentGold } = detail;
        if (!fromCityId || !toCityId) return;

        const humanName = nationManager.getNation(humanNationIdForDiplomacy)?.name ?? humanNationIdForDiplomacy;
        const fromCity = cityManager.getCity(fromCityId);
        const toCity = cityManager.getCity(toCityId);
        if (!fromCity || !toCity) return;

        const validation = tradeConnectionSystem.canCreateTradeConnection(fromCityId, toCityId);
        if (!validation.ok) return;

        const humanResources = nationManager.getResources(humanNationIdForDiplomacy);
        if (humanResources.gold < setupPaymentGold) return;

        const targetAttitude = diplomaticEvaluationSystem?.evaluateAttitude(targetNationId, humanNationIdForDiplomacy) ?? 'neutral';
        const accepted = targetAttitude !== 'hostile';

        const routeLabel = `${fromCity.name} ↔ ${toCity.name}`;
        logManager.info({
          nationIds: [humanNationIdForDiplomacy, targetNationId],
          category: 'diplomacy',
          message: `${humanName} proposed trade route ${routeLabel} to ${targetNation.name}${setupPaymentGold > 0 ? ` for ${setupPaymentGold} gold` : ''}.`,
        });

        if (accepted) {
          humanResources.gold -= setupPaymentGold;
          nationManager.getResources(targetNationId).gold += setupPaymentGold;
          const connection = tradeConnectionSystem.createTradeConnectionDraft(fromCityId, toCityId, turnManager.getCurrentRound());
          logManager.info({
            nationIds: [humanNationIdForDiplomacy, targetNationId],
            category: 'diplomacy',
            message: `${targetNation.name} accepted trade route ${routeLabel}.`,
          });
          const tradeRouteItem: Producible = {
            kind: 'tradeRoute',
            connectionId: connection.id,
            fromCityId,
            toCityId,
            targetNationId,
            displayName: `Trade Route to ${toCity.name}`,
            productionCost: TRADE_ROUTE_PRODUCTION_COST,
          };
          productionSystem.enqueue(fromCityId, tradeRouteItem);
          logManager.info({
            nationId: humanNationIdForDiplomacy,
            category: 'diplomacy',
            message: `${fromCity.name} queued Trade Route to ${toCity.name}.`,
          });
          hudLayer?.refresh();

          // Estimate completion using the city's normal production logic so the
          // figure matches what the player will see in the production queue.
          const estimatedTurns = productionSystem.getTurnsEstimate(fromCityId, tradeRouteItem);
          showLeaderResponsePopup(targetNationId, 'Trade Route Accepted', [
            `${targetNation.name} has accepted the proposal.`,
            `A trade route between ${fromCity.name} and ${toCity.name} has been established.`,
            `${fromCity.name} will now begin constructing the trade route.`,
            `Estimated completion time: ${estimatedTurns} turn${estimatedTurns === 1 ? '' : 's'}.`,
            `The trade route has been added to ${fromCity.name}'s production queue.`,
          ]);
        } else {
          logManager.info({
            nationIds: [humanNationIdForDiplomacy, targetNationId],
            category: 'diplomacy',
            message: `${targetNation.name} rejected the trade route proposal.`,
          });
          showLeaderResponsePopup(targetNationId, 'Trade Route Rejected', [
            `${targetNation.name} has declined the proposal.`,
            'Reason: relations are too poor.',
          ]);
        }
        rightPanel?.refreshCurrent();
      }
    };
    document.addEventListener('diplomacyAction', onDiplomacyAction);

    // ─── UI ──────────────────────────────────────────────────────────────────

    this.diagnosticSystem = new DiagnosticSystem();
    this.diagnosticSystem.setCameraProvider(() => ({
      zoom: this.cameraController.zoom,
      scrollX: this.cameraController.scrollX,
      scrollY: this.cameraController.scrollY,
    }));
    const diagnosticDialog = new DiagnosticDialog(
      this.diagnosticSystem,
      () => [
        `Round: ${turnManager.getCurrentRound()}`,
        `Year: ${turnManager.getGlobalYearLabel()}`,
        '',
        ...aiOverseasExpansionSystem.getDiagnosticLines(),
        '',
        ...aiSystem.getLeaderEvacuationDiagnosticLines(),
      ],
    );
    const worldMarkerRenderer = new WorldMarkerRenderer(this, tileMap, worldMarkerSystem, this.diagnosticSystem);
    const endHumanTurn = () => {
      if (!turnManager.getCurrentNation().isHuman) return;
      if (hudLayer?.hasBlockingModal()) return;
      turnManager.endCurrentTurn();
    };
    // Auto End Turn: when enabled and no human unit still needs orders, advance
    // the turn automatically — reusing endHumanTurn (the same path as the End
    // Turn button), never a second turn-advancement route. Whether a unit needs
    // orders is decided by the existing turn queue (sleeping/fortified/exploring/
    // done units are already excluded), so this just reacts to getActive() == null.
    let autoEndTurnPending = false;
    const maybeAutoEndTurn = (): void => {
      if (autoEndTurnPending) return;
      if (!isAutoEndTurn()) return;
      if (!turnManager.getCurrentNation().isHuman) return;
      if (isAutoplayActive()) return;
      if (hudLayer?.hasBlockingModal()) return;
      if (turnOrderSystem.getActive()) return;
      // Defer so it doesn't re-enter the turn/active-unit listeners and so the
      // player can glance at the board; re-check every guard when it fires.
      autoEndTurnPending = true;
      this.time.delayedCall(AUTO_END_TURN_DELAY_MS, () => {
        autoEndTurnPending = false;
        if (!isAutoEndTurn()) return;
        if (!turnManager.getCurrentNation().isHuman) return;
        if (isAutoplayActive()) return;
        if (hudLayer?.hasBlockingModal()) return;
        if (turnOrderSystem.getActive()) return;
        endHumanTurn();
      });
    };
    const isFocusedElementEditingText = (): boolean => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return false;
      if (active.isContentEditable) return true;
      return Boolean(active.closest('input, textarea, select, [contenteditable="true"]'));
    };
    const isVisibleModalOverlayActive = (): boolean => {
      const modalIds = ['diplomacy-modal', 'building-placement-modal', 'escape-menu'];
      return modalIds.some((id) => {
        const element = document.getElementById(id);
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    };
    const shouldIgnoreGlobalTurnHotkey = (): boolean => (
      isFocusedElementEditingText() || isVisibleModalOverlayActive() || hudLayer?.hasBlockingModal() === true
    );
    // Global turn hotkeys stay bound across CityView and other UI states.
    const onEnterEndTurn = (event?: KeyboardEvent) => {
      if (shouldIgnoreGlobalTurnHotkey()) return;
      event?.preventDefault();
      endHumanTurn();
    };
    this.input.keyboard?.on('keydown-ENTER', onEnterEndTurn);
    this.input.keyboard?.on('keydown-NUMPAD_ENTER', onEnterEndTurn);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ENTER', onEnterEndTurn);
      this.input.keyboard?.off('keydown-NUMPAD_ENTER', onEnterEndTurn);
    });
    const hudDataProvider = new NationHudDataProvider(
      nationManager,
      cityManager,
      happinessSystem,
      researchSystem,
      cultureSystem,
      turnManager,
      resourceAccessSystem,
      unitUpkeepSystem,
    );
    hudLayer = new HudLayer(this, {
      humanNationId,
      dataProvider: hudDataProvider,
      policySystem,
      unitActionToolbox,
      worldInputGate,
      proposalContext: {
        getNationName: (nationId) => nationManager.getNation(nationId)?.name ?? nationId,
        getNationColor: (nationId) => nationManager.getNation(nationId)?.color ?? 0xb59a5a,
        getResourceName: (resourceId) => getResourceDisplayName(resourceId),
      },
      onEndTurn: endHumanTurn,
      getIdleCityIds: () => (
        humanNationId
          ? cityManager.getCitiesByOwner(humanNationId)
            .filter((city) => productionSystem.getQueue(city.id).length === 0)
            .map((city) => city.id)
          : []
      ),
      onOpenIdleCity: (cityId) => {
        const city = cityManager.getCity(cityId);
        if (!city || city.ownerId !== humanNationId) return;
        cityViewDismissedCityId = null;
        selectionManager.clearSelection();
        selectionManager.selectCity(city);
      },
      onSelectResearch: (technologyId) => {
        if (!humanNationId) return false;
        const started = researchSystem.startResearch(humanNationId, technologyId);
        if (!started) return false;
        if (humanNeedsCultureSelection()) {
          hudLayer?.openCulturePanel();
        }
        return true;
      },
      onSelectCultureNode: (nodeId) => {
        if (!humanNationId) return false;
        return cultureSystem.startCultureNode(humanNationId, nodeId);
      },
      onPoliciesChanged: refreshPolicyDerivedState,
      onAcceptProposal: (proposalId) => diplomaticProposalSystem.acceptProposal(proposalId),
      onRejectProposal: (proposalId) => diplomaticProposalSystem.rejectProposal(proposalId),
      onDiscoveryClosed: openPendingHumanSelectionPanels,
      onToggleMapLens: toggleMapLens,
    });
    hudLayer.setEndTurnEnabled(turnManager.getCurrentNation().isHuman);
    hudLayer.setEndTurnBusy(!turnManager.getCurrentNation().isHuman);
    hudLayer.refresh();
    applyMapLensMode();

    new UnitHoverDiagnosticHud(
      this,
      hudLayer.getOwnedObjectAttacher(),
      selectionManager,
      unitManager,
      nationManager,
    );
    researchSystem.onChanged(() => {
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    cultureSystem.onChanged(() => {
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    this.minimapHud = new MinimapHud(
      this,
      tileMap,
      mapData,
      nationManager,
      cityManager,
      this.cameraController,
      worldInputGate,
    );
    // Fog of war: gate minimap ownership colours by human visibility.
    this.minimapHud.setVisibilityPredicates(
      (x, y) => visibilitySystem.isTileVisibleToHuman(x, y),
      (x, y) => visibilitySystem.isTileExploredByHuman(x, y),
      (x, y) => {
        const city = cityManager.getCityAt(x, y);
        return city !== undefined && visibilitySystem.isKnownCity(city.id);
      },
    );
    // Stack the lens toggle above the minimap panel.
    hudLayer.setMapLensBottomReserved(236);

    // ─── New-game tutorial wizard ────────────────────────────────────────────
    // New players get a guided overlay that points at their starting units and
    // the core HUD controls. It auto-launches on every new game unless the
    // player ticks "Don't show again"; the framework is generic so future
    // scripted tutorials can reuse it by supplying their own step list.
    this.setupTutorialWizard({
      humanNationId,
      unitManager,
      tileMap,
      hudLayer,
      worldInputGate,
      selectionManager,
      focusUnit,
      isFreshGame: data.savedState === undefined,
    });

    rightPanel = new RightSidebarPanelDataProvider(
      productionSystem,
      cityManager,
      unitManager,
      nationManager,
      mapData,
      humanNationId,
      cityTerritorySystem,
      gridSystem,
      happinessSystem,
      strategicResourceCapacitySystem,
      unitUpkeepSystem,
    );
    this.rightSidebarPanel = new RightSidebarPanel(this, worldInputGate, rightPanel);
    // The sidebar (Details/Leaderboard/Diplomacy) expands over the same right
    // area as the permanent History panel, so hide History while it is open.
    this.rightSidebarPanel.setOnExpandedChanged((expanded) => timelinePanel.setHidden(expanded));
    this.diagnosticSystem.subscribeVisibility((open) => {
      this.rightSidebarPanel?.setDiagnosticsEnabled(open);
    });
    rightPanel.setDiplomacyManager(diplomacyManager);
    rightPanel.setAllianceManager(allianceManager);
    rightPanel.setJointWarSystem(jointWarSystem);
    rightPanel.setCurrentTurnGetter(() => turnManager.getCurrentRound());
    rightPanel.setDiplomaticEvaluationSystem(diplomaticEvaluationSystem);
    rightPanel.setBorderPressureSystem(borderPressureSystem);
    rightPanel.setMilitaryEvaluationSystem(aiMilitaryEvaluationSystem);
    rightPanel.setThreatEvaluationSystem(aiMilitaryThreatEvaluationSystem);
    rightPanel.setResearchSystem(researchSystem);
    rightPanel.setCultureSystem(cultureSystem);
    rightPanel.setWonderSystem(wonderSystem);
    rightPanel.setCorporationSystem(corporationSystem);
    rightPanel.setTradeDealSystem(tradeDealSystem);
    rightPanel.setTradeConnectionSystem(tradeConnectionSystem);
    rightPanel.setTradeDiplomacySystem(tradeDiplomacySystem);
    rightPanel.setResourceAccessSystem(resourceAccessSystem);
    rightPanel.setResourceCitySearchSystem(resourceCitySearchSystem);
    rightPanel.setEraSystem(eraSystem);
    rightPanel.setDiscoverySystem(discoverySystem);
    // ─── Historical timeline: subscribe to existing game events ──────────────
    foundCitySystem.onCityFounded((city) => {
      const capital = city.isCapital || city.isResidenceCapital || city.isOriginalCapital;
      historicalTimeline.record({
        type: 'cityFounded',
        icon: '🏠',
        text: capital
          ? `${timelineNationName(city.ownerId)} founded its capital ${city.name}`
          : `${timelineNationName(city.ownerId)} founded ${city.name}`,
        eventNationIds: [city.ownerId],
      });
    });
    discoverySystem.onNationsMet((a, b) => {
      historicalTimeline.record({
        type: 'firstContact',
        icon: '🧑‍🤝‍🧑',
        text: `${timelineNationName(a)} met ${timelineNationName(b)}`,
        eventNationIds: [a, b],
      });
    });
    diplomacyManager.onWarDeclared((aggressorId, targetId) => {
      // If the target was already at war with another nation, this reads as
      // joining an existing war rather than starting a fresh one.
      const targetAlreadyAtWar = nationManager.getAllNations().some((nation) =>
        nation.id !== aggressorId && nation.id !== targetId
        && diplomacyManager.getState(targetId, nation.id) === 'WAR');
      historicalTimeline.record(targetAlreadyAtWar
        ? {
          type: 'joinedWar',
          icon: '⚔',
          text: `${timelineNationName(aggressorId)} joined the war against ${timelineNationName(targetId)}`,
          eventNationIds: [aggressorId, targetId],
        }
        : {
          type: 'warDeclared',
          icon: '⚔',
          text: `${timelineNationName(aggressorId)} declared war on ${timelineNationName(targetId)}`,
          eventNationIds: [aggressorId, targetId],
        });
    });
    diplomacyManager.onPeaceAccepted((a, b) => {
      historicalTimeline.record({
        type: 'peace',
        icon: '🕊',
        text: `${timelineNationName(a)} and ${timelineNationName(b)} signed peace`,
        eventNationIds: [a, b],
      });
    });
    diplomacyManager.onEmbassyEstablished((from, to) => {
      historicalTimeline.record({
        type: 'embassyEstablished',
        icon: '🏛',
        text: `${timelineNationName(from)} established an embassy in ${timelineNationName(to)}`,
        eventNationIds: [from, to],
      });
    });
    diplomacyManager.onTradeRelationsEstablished((a, b) => {
      historicalTimeline.record({
        type: 'tradeRelations',
        icon: '💰',
        text: `${timelineNationName(a)} and ${timelineNationName(b)} established trade relations`,
        eventNationIds: [a, b],
      });
    });
    diplomacyManager.onAllianceFormed((a, b) => {
      historicalTimeline.record({
        type: 'allianceFormed',
        icon: '🤝',
        text: `${timelineNationName(a)} and ${timelineNationName(b)} became allies`,
        eventNationIds: [a, b],
      });
    });
    combatSystem.onCityCombat((event) => {
      if (!event.captured || !event.previousOwnerId) return;
      historicalTimeline.record({
        type: 'cityCaptured',
        icon: '🏴',
        text: `${timelineNationName(event.city.ownerId)} captured ${event.city.name} from ${timelineNationName(event.previousOwnerId)}`,
        eventNationIds: [event.city.ownerId, event.previousOwnerId],
      });
    });
    tradeConnectionSystem.onConnectionActivated((connection) => {
      const cityAName = cityManager.getCity(connection.cityAId)?.name ?? connection.cityAId;
      const cityBName = cityManager.getCity(connection.cityBId)?.name ?? connection.cityBId;
      historicalTimeline.record({
        type: 'tradeRouteCompleted',
        icon: '🚚',
        text: `Trade route completed between ${cityAName} and ${cityBName}`,
        eventNationIds: [connection.nationAId, connection.nationBId],
      });
    });
    wonderSystem.onWonderCompleted((state, wonderType) => {
      historicalTimeline.record({
        type: 'wonderBuilt',
        icon: '🏛',
        text: `${timelineNationName(state.ownerId)} completed ${wonderType.name}`,
        eventNationIds: [state.ownerId],
      });
    });
    corporationSystem?.onCorporationFounded((result) => {
      historicalTimeline.record({
        type: 'corporationFounded',
        icon: '🏢',
        text: `${timelineNationName(result.founded.founderNationId)} founded ${result.definition.name}`,
        eventNationIds: [result.founded.founderNationId],
      });
    });
    rightPanel.setBuilderHintProvider((tile) => {
      if (!selectedBuilderForHints) return null;
      return builderSystem.getBuildPreview(selectedBuilderForHints, tile);
    });
    const getReservedBuildingIds = (city: City): Set<string> => new Set(
      city.ownedTileCoords
        .map((coord) => mapData.tiles[coord.y]?.[coord.x]?.buildingConstruction?.buildingId)
        .filter((buildingId): buildingId is string => buildingId !== undefined),
    );
    const getOccupiedBuildingIds = (city: City): Set<string> => new Set(
      city.ownedTileCoords
        .flatMap((coord) => {
          const tile = mapData.tiles[coord.y]?.[coord.x];
          if (!tile) return [];
          return [tile.buildingId, tile.buildingConstruction?.buildingId];
        })
        .filter((buildingId): buildingId is string => buildingId !== undefined),
    );
    const isBuildingQueued = (cityId: string, buildingId: string): boolean => productionSystem.getQueue(cityId)
      .some((entry) => entry.item.kind === 'building' && entry.item.buildingType.id === buildingId);
    const getCityViewBuildingOptions = (city: City): CityViewBuildingOption[] => {
      const occupiedBuildingIds = getOccupiedBuildingIds(city);
      return ALL_BUILDINGS
        .filter((building) => !cityManager.getBuildings(city.id).has(building.id))
        .filter((building) => !occupiedBuildingIds.has(building.id))
        .filter((building) => researchSystem ? researchSystem.isBuildingUnlocked(city.ownerId, building.id) : true)
        .map((building) => {
          const validCoords = buildingPlacementSystem.getValidPlacementCoords(city, building, mapData);
          return {
            id: building.id,
            name: building.name,
            cost: productionSystem.getCost({ kind: 'building', buildingType: building }),
            placement: building.placement,
            disabled: validCoords.length === 0,
            reason: validCoords.length === 0 ? 'No valid owned tile matches this building placement.' : undefined,
          };
        });
    };
    const getCityViewQueueItems = (city: City): CityViewQueueItem[] => {
      const availableGold = nationManager.getResources(city.ownerId).gold;
      return productionSystem.getQueue(city.id)
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => !(
          entry.item.kind === 'wonder' && wonderSystem.isWonderBuilt(entry.item.wonderType.id)
        ))
        .filter(({ entry }) => !(
          entry.item.kind === 'corporation' && (corporationSystem?.isFounded(entry.item.corporationType.id) ?? false)
        ))
        .map(({ entry, index }) => {
          const buyCost = city.ownerId === humanNationId ? productionSystem.getBuyCost(city.id, index) : null;
          const canBuy = buyCost !== null && availableGold >= buyCost;
          return {
            index,
            name: getProducibleName(entry.item),
            spritePath: getProducibleSpritePath(entry.item),
            progress: entry.progress,
            cost: entry.cost,
            turnsRemaining: entry.turnsRemaining,
            blockedReason: entry.blockedReason,
            active: index === 0,
            buyCost: buyCost ?? undefined,
            buyLabel: buyCost === null
              ? undefined
              : canBuy
                ? `Buy ${buyCost}`
                : `Need ${buyCost - availableGold}`,
            canBuy,
          };
        });
    };
    const getCityViewUnitOptions = (city: City): CityViewUnitOption[] => (
      ALL_UNIT_TYPES
        .filter((unitType) => unitType.category !== 'leader')
        .filter((unitType) => researchSystem.isUnitUnlocked(city.ownerId, unitType.id))
        .flatMap((unitType) => {
          const reason = getCityUnitProductionBlockReason(
            city,
            unitType,
            mapData,
            gridSystem,
            unitProductionRuleContext,
          );
          if (reason && !unitType.requiredResource && !isUnitUpkeepAffordabilityReason(reason)) return [];
          return [{
            id: unitType.id,
            name: unitType.name,
            cost: productionSystem.getCost({ kind: 'unit', unitType }),
            disabled: reason !== undefined,
            reason,
          }];
        })
    );
    const getCityViewWonderOptions = (city: City): CityViewWonderOption[] => {
      const isQueuedHere = (wonderId: string): boolean => productionSystem.getQueue(city.id)
        .some((entry) => entry.item.kind === 'wonder' && entry.item.wonderType.id === wonderId);

      return wonderSystem.getAvailableWonders(ALL_WONDERS)
        .filter((wonderType) => researchSystem.isWonderUnlocked(city.ownerId, wonderType.id))
        .map((wonderType) => {
          const queuedHere = isQueuedHere(wonderType.id);
          const cityCanBuild = wonderSystem.canCityBuildWonder(city, wonderType, { researchSystem });
          const validCoords = wonderPlacementSystem.getValidPlacementCoords(city, wonderType, mapData);
          let disabled = false;
          let reason: string | undefined;
          if (queuedHere) { disabled = true; reason = 'Already in this queue'; }
          else if (!cityCanBuild) { disabled = true; reason = 'This city cannot build it'; }
          else if (validCoords.length === 0) { disabled = true; reason = 'No valid owned tile matches this wonder placement.'; }
          return {
            id: wonderType.id,
            name: wonderType.name,
            cost: productionSystem.getCost({ kind: 'wonder', wonderType }),
            description: wonderType.description,
            disabled,
            reason,
          };
        });
    };
    const getCityViewCorporationOptions = (city: City): CityViewCorporationOption[] => {
      const isQueuedHere = (corporationId: string): boolean => productionSystem.getQueue(city.id)
        .some((entry) => entry.item.kind === 'corporation' && entry.item.corporationType.id === corporationId);

      return CORPORATIONS
        .filter((corporationType) => !corporationSystem?.isFounded(corporationType.id))
        .map((corporationType) => {
          const queuedHere = isQueuedHere(corporationType.id);
          const blockers = corporationSystem?.getCityCorporationBlockers(city, corporationType.id) ?? [];
          let disabled = false;
          let reason: string | undefined;
          if (queuedHere) { disabled = true; reason = 'Already in this queue'; }
          else if (blockers.length > 0) { disabled = true; reason = blockers.join(', '); }
          return {
            id: corporationType.id,
            name: corporationType.name,
            cost: productionSystem.getCost({ kind: 'corporation', corporationType }),
            turnsRemaining: productionSystem.getTurnsEstimate(city.id, { kind: 'corporation', corporationType }),
            description: corporationType.description,
            outputSummary: `Produces ${corporationType.resourcePerBuilding} ${corporationType.manufacturedResourceId} per ${corporationType.productionBuildingId}.`,
            disabled,
            reason,
          };
        });
    };
    const getCityViewPlacementRenderState = (city: City): CityViewPlacementRenderState => {
      const placementState = buildingPlacementSystem.getState();
      if (placementState?.cityId === city.id) {
        return {
          active: true,
          validCoords: placementState.validCoords,
        };
      }
      const wonderPlacementState = wonderPlacementSystem.getState();
      if (wonderPlacementState?.cityId === city.id) {
        return {
          active: true,
          validCoords: wonderPlacementState.validCoords,
        };
      }
      return { active: false, validCoords: [] };
    };
    const getCityViewPlacementPanelState = (city: City): CityViewPlacementPanelState => {
      const placementState = buildingPlacementSystem.getState();
      const building = placementState && placementState.cityId === city.id
        ? getBuildingById(placementState.buildingId)
        : undefined;
      const wonderPlacementState = wonderPlacementSystem.getState();
      const wonder = wonderPlacementState && wonderPlacementState.cityId === city.id
        ? getWonderById(wonderPlacementState.wonderId)
        : undefined;
      const reservedBuildingIds = [...getReservedBuildingIds(city)];
      const reservedBuildingId = reservedBuildingIds[0];
      const reservedBuilding = reservedBuildingId ? getBuildingById(reservedBuildingId) : undefined;
      const reservedProgress = reservedBuildingId
        ? productionSystem.getQueue(city.id).find((entry) => (
          entry.item.kind === 'building' && entry.item.buildingType.id === reservedBuildingId
        ))
        : undefined;
      return {
        active: Boolean((placementState && placementState.cityId === city.id) || wonder),
        mode: wonder ? 'wonder' : building ? 'building' : undefined,
        buildingId: building?.id,
        buildingName: building?.name,
        wonderId: wonder?.id,
        wonderName: wonder?.name,
        underConstructionLabel: reservedBuilding
          ? `${reservedBuilding.name} (${Math.max(0, Math.min(100, Math.floor(((reservedProgress?.progress ?? 0) / (reservedProgress?.cost ?? 1)) * 100)))}%)`
          : undefined,
      };
    };
    const getCityViewTilePurchaseState = (city: City): CityViewTilePurchaseState => {
      if (city.ownerId !== humanNationId) {
        return { visible: false, enabled: false, buttonLabel: 'Buy Tile' };
      }

      cityTerritorySystem.refreshNextExpansionTile(city, mapData);
      const nextTile = city.nextExpansionTileCoord;
      if (!nextTile) {
        return {
          visible: true,
          enabled: false,
          buttonLabel: 'Buy Tile',
          detailText: 'No planned expansion tile is available to buy.',
        };
      }

      const cost = cityTerritorySystem.getClaimCost(city, mapData);
      const availableGold = nationManager.getResources(city.ownerId).gold;
      const missingGold = Math.max(0, cost - availableGold);
      const alreadyPurchasedThisTurn = city.lastTilePurchaseTurn === turnManager.getCurrentRound();
      return {
        visible: true,
        enabled: availableGold >= cost && !alreadyPurchasedThisTurn,
        buttonLabel: `Buy Tile (${cost} gold)`,
        detailText: alreadyPurchasedThisTurn
          ? 'This city has already bought a tile this turn.'
          : availableGold >= cost
          ? `Claim the currently planned expansion tile immediately.`
          : `Need ${missingGold} more gold to buy the planned tile.`,
      };
    };
    rightPanel.setBuildingPlacementRequestHandler((city, buildingId) => {
      if (city.ownerId !== humanNationId) {
        return { ok: false, message: 'Only a human-owned selected city can place buildings.' };
      }

      const selected = selectionManager.getSelected();
      if (selected?.kind !== 'city' || selected.city.id !== city.id) {
        return { ok: false, message: 'Select the city before starting building placement.' };
      }

      if (cityManager.getBuildings(city.id).has(buildingId) || getOccupiedBuildingIds(city).has(buildingId)) {
        return { ok: false, message: 'That building is already built or under construction in this city.' };
      }

      if (!buildingPlacementSystem.startPlacement(city, buildingId, mapData)) {
        return { ok: false, message: 'No building placements available for this city.' };
      }
      wonderPlacementSystem.cancelPlacement();

      cityViewDismissedCityId = null;
      territoryRenderer.setMode('cityView');
      if (!cityView.isOpenForCity(city.id)) {
        openCityView(city);
      } else {
        refreshOpenCityView();
      }
      rightPanel?.requestRefresh();

      return { ok: true };
    });
    rightPanel.setWonderPlacementAvailabilityProvider((city, wonderId) => (
      wonderPlacementSystem.getValidPlacementCoords(city, wonderId, mapData).length > 0
    ));
    rightPanel.setWonderPlacementRequestHandler((city, wonderId) => {
      if (city.ownerId !== humanNationId) {
        return { ok: false, message: 'Only a human-owned selected city can place wonders.' };
      }

      const selected = selectionManager.getSelected();
      if (selected?.kind !== 'city' || selected.city.id !== city.id) {
        return { ok: false, message: 'Select the city before starting wonder placement.' };
      }

      const wonderType = getWonderById(wonderId);
      if (!wonderType) return { ok: false, message: 'Unknown wonder.' };
      if (!wonderSystem.canCityBuildWonder(city, wonderType, { researchSystem })) {
        return { ok: false, message: 'This city cannot build that wonder.' };
      }
      const alreadyQueued = productionSystem.getQueue(city.id).some((entry) => (
        entry.item.kind === 'wonder' && entry.item.wonderType.id === wonderId
      ));
      if (alreadyQueued) return { ok: false, message: 'That wonder is already in this city queue.' };

      if (!wonderPlacementSystem.startPlacement(city, wonderId, mapData)) {
        return { ok: false, message: 'No wonder placements available for this city.' };
      }
      buildingPlacementSystem.cancelPlacement();

      cityViewDismissedCityId = null;
      territoryRenderer.setMode('cityView');
      if (!cityView.isOpenForCity(city.id)) {
        openCityView(city);
      } else {
        refreshOpenCityView();
      }
      rightPanel?.requestRefresh();

      return { ok: true };
    });
    rightPanel.setBuyProductionRequestHandler((city, index) => {
      if (city.ownerId !== humanNationId) return;
      const cost = productionSystem.getBuyCost(city.id, index);
      if (cost === null) return;
      const nationResources = nationManager.getResources(city.ownerId);
      if (nationResources.gold < cost) {
        rightPanel?.requestRefresh();
        return;
      }

      resourceSystem.addGold(city.ownerId, -cost);
      const result = productionSystem.completeQueueEntry(city.id, index);
      if (!result.ok) {
        resourceSystem.addGold(city.ownerId, cost);
        rightPanel?.requestRefresh();
        return;
      }
      resourceSystem.recalculateForNation(city.ownerId);
    });
    const getOpenCityViewCity = (): City | null => {
      const selected = selectionManager.getSelected();
      if (selected?.kind !== 'city') return null;
      if (!cityView.isOpenForCity(selected.city.id)) return null;
      if (selected.city.ownerId !== humanNationId) return null;
      return selected.city;
    };
    const getHumanCitiesForCityViewNavigation = (): City[] => (
      humanNationId ? cityManager.getCitiesByOwner(humanNationId) : []
    );
    const shouldIgnoreCityViewNavigationHotkey = (): boolean => (
      shouldIgnoreGlobalTurnHotkey() || hudLayer?.hasOpenSelectionPanel() === true
    );
    const navigateOpenCityView = (direction: 1 | -1): boolean => {
      const openCityId = cityView.getOpenCityId();
      if (openCityId === null) return false;

      const humanCities = getHumanCitiesForCityViewNavigation();
      if (humanCities.length <= 1) return false;

      const currentIndex = humanCities.findIndex((city) => city.id === openCityId);
      if (currentIndex < 0) return false;

      const nextIndex = (currentIndex + direction + humanCities.length) % humanCities.length;
      const targetCity = humanCities[nextIndex];
      cityViewDismissedCityId = null;
      selectionManager.selectCity(targetCity);
      focusOnCity(targetCity);
      return true;
    };
    const onKeyCityViewTab = (event: KeyboardEvent): void => {
      if (shouldIgnoreCityViewNavigationHotkey()) return;
      const handled = navigateOpenCityView(event.shiftKey ? -1 : 1);
      if (!handled) return;
      event.preventDefault();
    };
    this.input.keyboard?.on('keydown-TAB', onKeyCityViewTab);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-TAB', onKeyCityViewTab);
    });
    const clearCityViewInteraction = (): void => {
      cityViewInteraction.clear();
      buildingPlacementSystem.cancelPlacement();
      wonderPlacementSystem.cancelPlacement();
      document.getElementById('building-placement-modal')?.remove();
      cityView.hideTooltip();
      this.cameraController.setPointerPanEnabled(true);
    };
    const closeOpenCityView = (): boolean => {
      const selected = selectionManager.getSelected();
      if (selected?.kind !== 'city' || !cityView.isOpenForCity(selected.city.id)) {
        return false;
      }

      bindGameplayHotkeys();
      clearCityViewInteraction();
      if (selected?.kind === 'city' && selected.city.ownerId === humanNationId) {
        cityViewDismissedCityId = selected.city.id;
        cityView.close();
        cityViewRenderer.clear();
        territoryRenderer.setMode('normal');
        cityWorkTileRenderer.show(selected.city);
        cultureClaimTileRenderer.show(selected.city);
        rightPanel?.requestRefresh();
        return true;
      }

      cityViewDismissedCityId = null;
      cityView.close();
      cityViewRenderer.clear();
      territoryRenderer.setMode('normal');
      return true;
    };
    cityView.onCloseRequested(() => {
      closeOpenCityView();
    });
    cityView.onPlacementRequested((buildingId) => {
      const city = getOpenCityViewCity();
      if (!city) return;

      const state = buildingPlacementSystem.getState();
      if (state?.cityId === city.id && state.buildingId === buildingId) {
        buildingPlacementSystem.cancelPlacement();
      } else {
        buildingPlacementSystem.startPlacement(city, buildingId, mapData);
        wonderPlacementSystem.cancelPlacement();
      }

      refreshOpenCityView();
    });
    cityView.onPlacementCancelled(() => {
      buildingPlacementSystem.cancelPlacement();
      wonderPlacementSystem.cancelPlacement();
      refreshOpenCityView();
    });
    cityView.onBuyTileRequested(() => {
      const city = getOpenCityViewCity();
      if (!city) return;
      const currentTurn = turnManager.getCurrentRound();
      if (city.lastTilePurchaseTurn === currentTurn) {
        refreshOpenCityView();
        return;
      }

      cityTerritorySystem.refreshNextExpansionTile(city, mapData);
      if (!city.nextExpansionTileCoord) {
        refreshOpenCityView();
        return;
      }

      const cost = cityTerritorySystem.getClaimCost(city, mapData);
      const nationResources = nationManager.getResources(city.ownerId);
      if (nationResources.gold < cost) {
        refreshOpenCityView();
        return;
      }

      resourceSystem.addGold(city.ownerId, -cost);
      const claimed = cityTerritorySystem.claimNextExpansionTileImmediately(city, mapData);
      if (!claimed) {
        resourceSystem.addGold(city.ownerId, cost);
        refreshOpenCityView();
        return;
      }

      city.lastTilePurchaseTurn = currentTurn;
      resourceSystem.recalculateForNation(city.ownerId);
      rightPanel?.requestRefresh();
      refreshOpenCityView();
    });
    cityView.onRenameRequested((cityId, name) => {
      const city = cityManager.renameCity(cityId, name);
      if (!city) {
        refreshOpenCityView();
        return;
      }

      cityBannerRenderer.refreshCity(city);
      rightPanel?.requestRefresh();
      refreshOpenCityView();
    });
    cityView.onUnitRequested((unitId) => {
      const city = getOpenCityViewCity();
      if (!city) return;
      const unitType = ALL_UNIT_TYPES.find((candidate) => candidate.id === unitId && candidate.category !== 'leader');
      if (!unitType) return;
      if (!canCityProduceUnit(city, unitType, mapData, gridSystem, unitProductionRuleContext)) return;
      if (!researchSystem.isUnitUnlocked(city.ownerId, unitType.id)) return;
      productionSystem.enqueue(city.id, { kind: 'unit', unitType });
      rightPanel?.requestRefresh();
      if (cityView.isAutoCloseEnabled()) {
        closeOpenCityView();
        return;
      }
      cityView.switchToQueueMode();
      refreshOpenCityView();
    });
    cityView.onQueueRemoveRequested((index) => {
      const city = getOpenCityViewCity();
      if (!city) return;
      productionSystem.removeFromQueue(city.id, index);
      rightPanel?.requestRefresh();
      refreshOpenCityView();
    });
    cityView.onQueueBuyRequested((index) => {
      const city = getOpenCityViewCity();
      if (!city) return;
      const cost = productionSystem.getBuyCost(city.id, index);
      if (cost === null) return;
      const nationResources = nationManager.getResources(city.ownerId);
      if (nationResources.gold < cost) {
        refreshOpenCityView();
        return;
      }

      resourceSystem.addGold(city.ownerId, -cost);
      const result = productionSystem.completeQueueEntry(city.id, index);
      if (!result.ok) {
        resourceSystem.addGold(city.ownerId, cost);
        refreshOpenCityView();
        return;
      }
      resourceSystem.recalculateForNation(city.ownerId);
      rightPanel?.requestRefresh();
      refreshOpenCityView();
    });
    cityView.onWonderRequested((wonderId) => {
      const city = getOpenCityViewCity();
      if (!city) return;
      const wonderType = getWonderById(wonderId);
      if (!wonderType) return;
      if (!wonderSystem.canCityBuildWonder(city, wonderType, { researchSystem })) {
        refreshOpenCityView();
        return;
      }
      const alreadyQueued = productionSystem.getQueue(city.id).some((entry) => (
        entry.item.kind === 'wonder' && entry.item.wonderType.id === wonderId
      ));
      if (alreadyQueued) {
        refreshOpenCityView();
        return;
      }
      const state = wonderPlacementSystem.getState();
      if (state?.cityId === city.id && state.wonderId === wonderId) {
        wonderPlacementSystem.cancelPlacement();
      } else if (wonderPlacementSystem.startPlacement(city, wonderId, mapData)) {
        buildingPlacementSystem.cancelPlacement();
      }
      rightPanel?.requestRefresh();
      refreshOpenCityView();
    });
    cityView.onCorporationRequested((corporationId) => {
      const city = getOpenCityViewCity();
      if (!city) return;
      const corporationType = getCorporationById(corporationId);
      if (!corporationType) return;
      if (!corporationSystem?.canCityProduceCorporation(city, corporationType.id)) {
        refreshOpenCityView();
        return;
      }
      const alreadyQueued = productionSystem.getQueue(city.id).some((entry) => (
        entry.item.kind === 'corporation' && entry.item.corporationType.id === corporationType.id
      ));
      if (alreadyQueued) {
        refreshOpenCityView();
        return;
      }
      productionSystem.enqueue(city.id, { kind: 'corporation', corporationType });
      rightPanel?.requestRefresh();
      if (cityView.isAutoCloseEnabled()) {
        closeOpenCityView();
        return;
      }
      cityView.switchToQueueMode();
      refreshOpenCityView();
    });

    const onCityViewPointerDown = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.button !== 0) return;
      const city = getOpenCityViewCity();
      if (!city) return;

      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tile = tileMap.worldToTile(world.x, world.y);
      const coord = tile ? { x: tile.x, y: tile.y } : null;
      if (wonderPlacementSystem.isActiveForCity(city.id)) {
        const result = wonderPlacementSystem.selectTile(city, coord, mapData);
        if (result.status === 'reserved') {
          const wonderType = getWonderById(result.wonderId);
          let enqueued = false;
          if (wonderType) {
            const alreadyQueued = productionSystem.getQueue(city.id).some((entry) => (
              entry.item.kind === 'wonder' && entry.item.wonderType.id === result.wonderId
            ));
            if (!alreadyQueued) {
              productionSystem.enqueue(
                city.id,
                { kind: 'wonder', wonderType },
                { placement: { tileX: result.coord.x, tileY: result.coord.y } },
              );
              enqueued = true;
            }
          }
          cityView.hideTooltip();
          rightPanel?.requestRefresh();
          // Auto Close: a tile was successfully chosen for the wonder, so close
          // the dialog (the same flow as adding a unit).
          if (cityView.isAutoCloseEnabled()) {
            closeOpenCityView();
            return;
          }
          if (enqueued) cityView.switchToQueueMode();
          refreshOpenCityView();
          return;
        }
        if (result.status === 'invalid') return;
      }
      if (buildingPlacementSystem.isActiveForCity(city.id)) {
        const result = buildingPlacementSystem.selectTile(city, coord, mapData);
        if (result.status === 'reserved') {
          const buildingDef = getBuildingById(result.buildingId);
          let enqueued = false;
          if (buildingDef && !isBuildingQueued(city.id, result.buildingId)) {
            productionSystem.enqueue(city.id, { kind: 'building', buildingType: buildingDef });
            enqueued = true;
          }
          cityTerritorySystem.updateWorkedTiles(city, mapData);
          resourceSystem.recalculateForNation(city.ownerId);
          tileBuildingRenderer.refreshTile(result.coord.x, result.coord.y);
          cityView.hideTooltip();
          rightPanel?.requestRefresh();
          // Auto Close: a tile was successfully chosen for the building, so close
          // the dialog (the same flow as adding a unit).
          if (cityView.isAutoCloseEnabled()) {
            closeOpenCityView();
            return;
          }
          if (enqueued) cityView.switchToQueueMode();
          refreshOpenCityView();
          return;
        }
        if (result.status === 'invalid') return;
      }
      if (!cityViewInteraction.beginDrag(city, coord, mapData)) return;

      this.cameraController.setPointerPanEnabled(false);
      cityView.hideTooltip();
      cityViewRenderer.showWithState(
        city,
        cityViewInteraction.getRenderState(),
        getCityViewPlacementRenderState(city),
      );
    };

    const onCityViewPointerMove = (pointer: Phaser.Input.Pointer): void => {
      const city = getOpenCityViewCity();
      if (!city) {
        cityView.hideTooltip();
        return;
      }

      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tile = tileMap.worldToTile(world.x, world.y);
      const coord = tile ? { x: tile.x, y: tile.y } : null;
      cityViewInteraction.updateHover(city, coord, mapData);

      const hovered = cityViewInteraction.getHoveredCoord();
      const breakdown = hovered
        ? getCityViewTileBreakdown(city, hovered, mapData, gridSystem, cityTerritorySystem)
        : null;
      if (breakdown) cityView.showTooltip(breakdown, pointer.x, pointer.y);
      else cityView.hideTooltip();

      if (cityViewInteraction.isDragging()) {
        cityViewRenderer.showWithState(
          city,
          cityViewInteraction.getRenderState(),
          getCityViewPlacementRenderState(city),
        );
      }
    };

    const onCityViewPointerUp = (pointer: Phaser.Input.Pointer): void => {
      const city = getOpenCityViewCity();
      if (!city || !cityViewInteraction.isDragging()) return;

      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tile = tileMap.worldToTile(world.x, world.y);
      const coord = tile ? { x: tile.x, y: tile.y } : null;
      const changed = cityViewInteraction.handleDrop(city, coord, mapData);
      this.cameraController.setPointerPanEnabled(true);
      cityView.hideTooltip();
      cityView.refresh(
        city,
        getCityViewUnitOptions(city),
        getCityViewBuildingOptions(city),
        getCityViewPlacementPanelState(city),
        getCityViewTilePurchaseState(city),
        getCityViewWonderOptions(city),
        getCityViewCorporationOptions(city),
        getCityViewQueueItems(city),
      );
      cityViewRenderer.showWithState(
        city,
        cityViewInteraction.getRenderState(),
        getCityViewPlacementRenderState(city),
      );
      if (changed) {
        rightPanel?.requestRefresh();
      }
    };

    this.input.on(Phaser.Input.Events.POINTER_DOWN, onCityViewPointerDown);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, onCityViewPointerMove);
    this.input.on(Phaser.Input.Events.POINTER_UP, onCityViewPointerUp);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, onCityViewPointerUp);

    // Phaser-side leader portrait strip (replaces the old left-panel leader list)
    leaderStrip = new LeaderPortraitStrip(this, nationManager, discoverySystem, humanNationId);
    if (this.rightSidebarPanel) {
      const panel = this.rightSidebarPanel;
      leaderStrip.setRightBoundaryProvider(() => panel.getButtonRowLeftX());
    }

    // Audience chamber: opened from the leader Details view to meet a foreign
    // leader. Created after every other screen-space panel so its UI camera is
    // the last one added and therefore renders on top of the whole HUD.
    this.leaderAudienceDialog = new LeaderAudienceDialog(this, worldInputGate, {
      getNationName: (nationId) => nationManager.getNation(nationId)?.name ?? nationId,
      getNationColor: (nationId) => nationManager.getNation(nationId)?.color ?? 0xf4f1e7,
      getNationSecondaryColor: (nationId) => nationManager.getNation(nationId)?.secondaryColor ?? 0x9a7b3a,
      getRelationshipSummary: (nationId) => {
        if (!humanNationId || nationId === humanNationId) return 'Your nation';
        if (diplomacyManager.getState(humanNationId, nationId) === 'WAR') return 'At War';
        const attitude = diplomaticEvaluationSystem.evaluateAttitude(nationId, humanNationId);
        switch (attitude) {
          case 'friendly': return 'Friendly';
          case 'hostile': return 'Hostile';
          case 'afraid': return 'Suspicious';
          case 'neutral': return 'Neutral';
        }
      },
      getStatusRows: (nationId) => rightPanel?.getAudienceStatusRows(nationId) ?? [],
      getDiplomacyActionRows: (nationId) => rightPanel?.getAudienceDiplomacyActionRows(nationId) ?? [],
      getTradeRows: (nationId) => rightPanel?.getAudienceTradeRows(nationId) ?? [],
      onChanged: (listener) => rightPanel?.onChanged(listener),
    }, {
      onOpened: (nationId) => onAudienceOpened(nationId),
      onClosed: () => onAudienceClosed(),
    });
    rightPanel.setArrangeAudienceHandler((leaderId) => this.leaderAudienceDialog?.open(leaderId));
    const computeRangedTargets = (unit: Unit): Set<string> => {
      const range = unit.unitType.range ?? 1;
      if (range < 2 || (unit.unitType.rangedStrength ?? 0) <= 0) return new Set();
      const tiles = gridSystem.getTilesInRange(
        { x: unit.tileX, y: unit.tileY }, range, mapData, { includeCenter: false },
      );
      const keys = new Set<string>();
      for (const tile of tiles) {
        const targetUnit = unitManager.getUnitAt(tile.x, tile.y);
        const targetCity = cityManager.getCityAt(tile.x, tile.y);
        const hasEnemyUnit = targetUnit !== null && targetUnit.ownerId !== unit.ownerId;
        const hasEnemyCity = targetCity !== undefined && targetCity.ownerId !== unit.ownerId;
        if (hasEnemyUnit || hasEnemyCity) keys.add(`${tile.x},${tile.y}`);
      }
      return keys;
    };
    const showDismissConfirmation = (unit: Unit) => {
      const unitId = unit.id;
      showDiplomacyModal({
        title: 'Dismiss Unit',
        message: 'Dismiss this unit permanently?',
        accentColor: '#c44',
        confirmLabel: 'Dismiss',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          const currentUnit = unitManager.getUnit(unitId);
          if (currentUnit === undefined || currentUnit.ownerId !== humanNationId) {
            const selection = selectionManager.getSelected();
            if (selection?.kind === 'unit' && selection.unit.id === unitId) {
              selectionManager.clearSelection();
            }
            unitActionToolbox.resetMode();
            hudLayer?.refresh();
            rightPanel?.requestRefresh();
            return;
          }
          if (unitManager.getCargoForTransport(currentUnit) !== undefined) {
            unitActionToolbox.resetMode();
            hudLayer?.refresh();
            rightPanel?.requestRefresh();
            return;
          }
          unitManager.removeUnit(currentUnit.id);
          selectionManager.clearSelection();
          unitActionToolbox.resetMode();
          turnOrderSystem.refreshActive();
          hudLayer?.refresh();
          rightPanel?.requestRefresh();
        },
        onCancel: () => {
          unitActionToolbox.resetMode();
          hudLayer?.refresh();
        },
      });
    };
    unitActionToolbox.onModeChanged((mode) => {
      hudLayer?.refresh();
      rangedTargets = new Set();
      rangedPreviewRenderer.clear();

      if (mode === 'found' || mode === 'build') {
        try {
          const selection = selectionManager.getSelected();
          if (selection?.kind !== 'unit') return;

          if (mode === 'found') {
            performFoundCityAction(selection.unit);
            return;
          }

          performBuildImprovementAction(selection.unit);
        } finally {
          unitActionToolbox.resetMode();
        }
        return;
      }

      if (mode === 'ranged') {
        const selection = selectionManager.getSelected();
        if (selection?.kind !== 'unit') return;
        rangedTargets = computeRangedTargets(selection.unit);
        rangedPreviewRenderer.showTargets(rangedTargets);
        return;
      }

      if (mode === 'explore') {
        const selection = selectionManager.getSelected();
        if (selection?.kind !== 'unit'
          || selection.unit.ownerId !== humanNationId
          || !aiExplorationSystem.canAutoExplore(selection.unit)) {
          unitActionToolbox.resetMode();
          return;
        }
        const unit = selection.unit;
        // Enable automation and clear conflicting state, then explore right away
        // this turn using the shared AI scouting behavior.
        unit.automation = 'explore';
        unit.isSleeping = false;
        unit.actionStatus = 'active';
        unit.queuedDestination = undefined;
        aiExplorationSystem.exploreUnit(unit);
        territoryRenderer.invalidate();
        unitActionToolbox.resetMode();
        unitActionToolbox.refresh();
        turnOrderSystem.refreshActive();
        hudLayer?.refresh();
        rightPanel?.requestRefresh();
        return;
      }

      if (mode === 'sleep') {
        const selection = selectionManager.getSelected();
        if (selection?.kind !== 'unit') return;
        // Pressing Sleep on a building worker cancels the build —
        // matching the "moving/waking cancels progress" rule. The unit
        // returns to active so the next turn it can be redirected.
        if (improvementConstructionSystem.isUnitBusy(selection.unit.id)) {
          improvementConstructionSystem.cancelBuildForUnit(selection.unit.id);
          unitActionToolbox.refresh();
          turnOrderSystem.refreshActive();
          hudLayer?.refresh();
          rightPanel?.requestRefresh();
          unitActionToolbox.resetMode();
          return;
        }
        selection.unit.isSleeping = !selection.unit.isSleeping;
        selection.unit.actionStatus = selection.unit.isSleeping ? 'sleep' : 'active';
        if (selection.unit.isSleeping) selection.unit.queuedDestination = undefined;
        unitActionToolbox.refresh();
        turnOrderSystem.refreshActive();
        hudLayer?.refresh();
        rightPanel?.requestRefresh();
        unitActionToolbox.resetMode();
        return;
      }

      if (mode === 'upgrade') {
        const selection = selectionManager.getSelected();
        if (selection?.kind !== 'unit' || selection.unit.ownerId !== humanNationId) {
          unitActionToolbox.resetMode();
          return;
        }
        const upgraded = unitUpgradeSystem.upgradeUnit(selection.unit, humanNationId);
        if (upgraded) {
          unitActionToolbox.refresh();
          turnOrderSystem.refreshActive();
          hudLayer?.refresh();
          rightPanel?.requestRefresh();
        }
        unitActionToolbox.resetMode();
        return;
      }

      if (mode === 'dismiss') {
        const selection = selectionManager.getSelected();
        if (selection?.kind !== 'unit' || selection.unit.ownerId !== humanNationId) {
          unitActionToolbox.resetMode();
          return;
        }
        if (unitManager.getCargoForTransport(selection.unit) !== undefined) {
          unitActionToolbox.resetMode();
          hudLayer?.refresh();
          return;
        }
        showDismissConfirmation(selection.unit);
        return;
      }
    });
    unitActionToolbox.onChanged(() => hudLayer?.refresh());
    researchSystem.onChanged(() => {
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    researchSystem.onCompleted((event) => {
      if (event.nationId === humanNationId && isNaturalResourceRevealTechnology(event.technologyId)) {
        naturalResourceRenderer.rebuildAll();
      }
      for (const city of cityManager.getCitiesByOwner(event.nationId)) {
        cityRenderer.refreshCity(city);
      }
      resourceSystem.recalculateForNation(event.nationId);
      happinessSystem.recalculateNation(event.nationId);
      if (event.nationId === humanNationId && !autoplaySystem.isActive()) {
        const technology = getTechnologyById(event.technologyId);
        if (technology) {
          hudLayer?.enqueueDiscovery(buildTechnologyDiscoveryPopupData(technology));
        }
      }
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    cultureSystem.onChanged(() => {
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      refreshOpenCityView();
    });
    cultureSystem.onCompleted((event) => {
      cultureEffectSystem.handleCultureNodeCompleted(event.nationId, event.cultureNode);
      resourceSystem.recalculateForNation(event.nationId);
      happinessSystem.recalculateNation(event.nationId);
      if (event.nationId === humanNationId && !autoplaySystem.isActive()) {
        hudLayer?.enqueueDiscovery(buildCultureDiscoveryPopupData(event.cultureNode));
      }
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      refreshOpenCityView();
    });
    happinessSystem.onChanged(() => {
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      refreshOpenCityView();
    });

    new CombatLog(this, combatSystem, nationManager);
    new AutoplayHud(autoplaySystem);
    if (isDevBuild()) {
      // Enable the unbounded full-session log immediately so every entry from
      // game start is captured. The UI still uses the capped getAllEntries() buffer.
      eventLog.enableFullLog();
      const diagnosticsWindow = window as Window & { __epochDiagnostics?: EpochGameDiagnostics };
      diagnosticsWindow.__epochDiagnostics = {
        startAutoplay: (rounds: number) => new Promise((resolve) => {
          const requestedRounds = Math.max(1, Math.floor(rounds));
          this.diagnosticSystem.enableTurnLogging();
          autoplaySystem.onCompleted((event) => resolve({ completedRounds: event.totalRounds }));
          autoplaySystem.start(requestedRounds, { suppressVisuals: true });
        }),
        stopAutoplay: () => autoplaySystem.stop(),
        isAutoplayActive: () => autoplaySystem.isActive(),
        isAutoplayCompleted: () => autoplaySystem.isCompleted(),
        getEventLogEntries: () => eventLog.getFullLogEntries(),
        getEventLogText: () => eventLog.getFullLogEntries()
          .map((entry) => `T${entry.round}: ${entry.text}`)
          .join('\n'),
        getStateSummary: () => {
          const currentNation = turnManager.getCurrentNation();
          return {
            currentRound: turnManager.getCurrentRound(),
            currentNationId: currentNation.id,
            currentNationName: currentNation.name,
            nationCount: nationManager.getAllNations().length,
            cityCount: cityManager.getAllCities().length,
            unitCount: unitManager.getAllUnits().length,
          };
        },
        getSaveState: () => SaveLoadService.serialize({
          mapKey: data.mapKey,
          humanNationId: data.humanNationId,
          activeNationIds: data.activeNationIds,
          gameSpeedId: gameSpeed.id,
          mapData,
          nationManager,
          cityManager,
          unitManager,
          productionSystem,
          diplomacyManager,
          allianceManager,
          discoverySystem,
          symbolicGiftRegistry,
          turnManager,
          gridSystem,
          wonderSystem,
          policySystem,
          tradeDealSystem,
          tradeConnectionSystem,
          tradeDiplomacySystem,
          visibilitySystem,
          exileProtectionSystem,
          corporationSystem,
          worldMarkerSystem,
          foreignTroopViolationSystem,
          historicalTimeline,
        }),
      };
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete diagnosticsWindow.__epochDiagnostics;
      });
    }
    // Force an alliance between the human player and a target nation, reusing the
    // exact alliance-formation side effects of a successful negotiated alliance:
    // AllianceManager state (create the alliance, or grow the human's existing
    // one via addMember), DiplomacyManager relation updates, the event log, and
    // a HUD/sidebar refresh. No cheat-only alliance storage or rules.
    const formHumanAllianceForCheat = (targetNationId: string): 'created' | 'exists' => {
      if (!humanNationId) return 'exists';
      if (allianceManager.areAllied(humanNationId, targetNationId)) return 'exists';
      // v1 rule: a nation can only belong to one alliance. If the target is
      // already committed to a different alliance, make no change.
      if (allianceManager.isInAlliance(targetNationId)) return 'exists';

      const humanName = nationManager.getNation(humanNationId)?.name ?? humanNationId;
      const targetName = nationManager.getNation(targetNationId)?.name ?? targetNationId;
      const existingAlliance = allianceManager.getAllianceForNation(humanNationId);

      if (!existingAlliance) {
        const proposerLeaderName = getLeaderByNationId(humanNationId)?.name ?? humanName;
        const alliance = allianceManager.createAlliance(
          humanNationId,
          targetNationId,
          `${proposerLeaderName} Alliance`,
          turnManager.getCurrentRound(),
        );
        if (!alliance) return 'exists';
        diplomacyManager.recordAllianceFormed(humanNationId, targetNationId);
        logManager.info({
          nationIds: [humanNationId, targetNationId],
          category: 'diplomacy',
          message: `${humanName} and ${targetName} formed ${alliance.name}.`,
        });
      } else {
        // Human already in an alliance: grow it, mirroring the council invite path.
        const existingMembers = existingAlliance.memberNationIds.slice();
        allianceManager.addMember(existingAlliance.id, targetNationId);
        for (const memberId of existingMembers) {
          diplomacyManager.recordAllianceFormed(targetNationId, memberId);
        }
        logManager.info({
          nationIds: [targetNationId, ...existingMembers],
          category: 'diplomacy',
          message: `${targetName} joined ${existingAlliance.name}.`,
        });
      }

      hudLayer?.refresh();
      rightPanel?.refreshCurrent();
      return 'created';
    };

    const cheatConsole = new CheatConsole(new CheatSystem({
      humanNationId,
      researchSystem,
      cultureSystem,
      corporationSystem,
      resourceSystem,
      resourceAccessSystem,
      diagnosticSystem: this.diagnosticSystem,
      discoverySystem,
      nationManager,
      productionSystem,
      cityManager,
      selectionManager,
      unitManager,
      autoplaySystem,
      revealMapResourcesTemporarily,
      setFogEnabled: (enabled: boolean): void => {
        visibilitySystem.setEnabled(enabled);
        fogOfWarRenderer.setVisible(enabled);
        updateFog();
      },
      formHumanAlliance: formHumanAllianceForCheat,
    }));

    turnManager.on('turnStart', () => {
      clearTemporaryMapReveal();
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      const activeNation = turnManager.getCurrentNation();
      hudLayer?.setEndTurnEnabled(activeNation.isHuman);
      // Spin the End Turn button while the AI is taking its turn.
      hudLayer?.setEndTurnBusy(!activeNation.isHuman);
      const selectedCity = rightPanel?.getCurrentCity();
      if (selectedCity) {
        rightPanel!.refreshProductionQueue(selectedCity.id);
        cityWorkTileRenderer.show(selectedCity);
        cultureClaimTileRenderer.show(selectedCity);
      }
      if (rightPanel?.getView() === 'nation') {
        rightPanel.refreshNationView();
      }
    });
    turnManager.on('roundStart', () => {
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
    });
    turnManager.on('roundStart', (event) => {
      if (!this.diagnosticSystem.isTurnLoggingEnabled()) return;
      const cities = cityManager.getAllCities().length;
      const units = unitManager.getAllUnits().length;
      console.log(`[autorun] Turn ${event.round} | cities: ${cities} | units: ${units}`);
    });
    resourceSystem.on(() => {
      if (autoplaySystem.isActive()) return;
      territoryRenderer.invalidate();
      rebuildMinimapForGameplay();
      cityBannerRenderer.rebuildAll();
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      refreshSelectedCityOverlays();
      refreshOpenCityView();
    });
    unitManager.onUnitChanged((event) => {
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      if (
        rightPanel &&
        (rightPanel.isShowingCity(event.cityId) || rightPanel.isShowingUnit(event.unit) || rightPanel.getView() === 'leader')
      ) {
        rightPanel.requestRefresh();
      }
      refreshMovePreview();
    });
    productionSystem.onChanged(() => {
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      cityBannerRenderer.rebuildAll();
      tileBuildingRenderer.rebuildAll();
      refreshOpenCityView();
    });

    // Map selection → right panel (clears nation highlight)
    selectionManager.onSelectionChanged((selection) => {
      leaderStrip?.setSelectedNation(null);
      rangedTargets = new Set();
      rangedPreviewRenderer.clear();
      if (selection?.kind !== 'city' || selection.city.id !== cityViewDismissedCityId) {
        cityViewDismissedCityId = null;
      }

      if (selection?.kind === 'unit'
        && selection.unit.ownerId === humanNationId
        && !suppressPromote
        && turnManager.getCurrentNation().isHuman
        && selection.unit.carriedByUnitId === undefined
      ) {
        turnOrderSystem.promoteTo(selection.unit.id);
      }

      if (selection?.kind === 'tile') {
        clearCityViewInteraction();
        selectedBuilderForHints = null;
        unitActionToolbox.setSelectedUnit(null);
        rightPanel?.showTile(selection.tile);
        territoryRenderer.setMode('normal');
        cityWorkTileRenderer.clear();
        cultureClaimTileRenderer.clear();
        cityView.close();
        cityViewRenderer.clear();
      } else if (selection?.kind === 'city') {
        clearCityViewInteraction();
        selectedBuilderForHints = null;
        unitActionToolbox.setSelectedUnit(null);
        rightPanel?.showCity(selection.city);
        if (selection.city.ownerId === humanNationId && cityViewDismissedCityId !== selection.city.id) {
          territoryRenderer.setMode('cityView');
          openCityView(selection.city);
          cityWorkTileRenderer.clear();
          cultureClaimTileRenderer.clear();
        } else {
          territoryRenderer.setMode('normal');
          cityView.close();
          cityViewRenderer.clear();
          cityWorkTileRenderer.show(selection.city);
          cultureClaimTileRenderer.show(selection.city);
        }
      } else if (selection?.kind === 'unit') {
        clearCityViewInteraction();
        selectedBuilderForHints = selection.unit.unitType.canBuildImprovements ? selection.unit : null;
        unitActionToolbox.setSelectedUnit(selection.unit);
        rightPanel?.showUnit(selection.unit);
        territoryRenderer.setMode('normal');
        cityWorkTileRenderer.clear();
        cultureClaimTileRenderer.clear();
        cityView.close();
        cityViewRenderer.clear();
      } else {
        clearCityViewInteraction();
        selectedBuilderForHints = null;
        unitActionToolbox.setSelectedUnit(null);
        rightPanel?.clear();
        territoryRenderer.setMode('normal');
        cityWorkTileRenderer.clear();
        cultureClaimTileRenderer.clear();
        cityView.close();
        cityViewRenderer.clear();
      }
      refreshMovePreview();
    });

    // Shift+click on a tile with a city opens city view directly, bypassing
    // unit-priority tile resolution so it works even when units occupy the tile.
    selectionManager.onDirectCityViewRequested((city) => {
      if (city.ownerId === humanNationId) cityViewDismissedCityId = null;
      selectionManager.clearSelection();
      selectionManager.selectCity(city);
    });

    selectionManager.onHoverChanged((_hovered, hoveredTile) => {
      const selected = selectionManager.getSelected();
      // Free Selection Mode: stop the move-path line from following the pointer.
      // It resumes once a unit is activated again (free mode ends).
      if (freeSelectionMode) {
        pathPreviewRenderer.clearPath();
        rangedPreviewRenderer.clearCurve();
        return;
      }
      if (selected?.kind !== 'unit') {
        pathPreviewRenderer.clearPath();
        rangedPreviewRenderer.clearCurve();
        return;
      }

      // Use the fog-independent hovered tile so the move-path preview follows the
      // pointer into unexplored territory (matching that move orders may target
      // fog). For visible tiles this equals the resolved hover's tile.
      const hoverTile = hoveredTile;
      if (unitActionToolbox.getMode() === 'ranged') {
        pathPreviewRenderer.clearPath();
        if (hoverTile === null || !rangedTargets.has(`${hoverTile.x},${hoverTile.y}`)) {
          rangedPreviewRenderer.clearCurve();
          return;
        }
        rangedPreviewRenderer.showCurve(
          { x: selected.unit.tileX, y: selected.unit.tileY },
          hoverTile,
        );
        return;
      }

      rangedPreviewRenderer.clearCurve();

      if (selected.unit.carriedByUnitId !== undefined) {
        pathPreviewRenderer.clearPath();
        return;
      }

      if (hoverTile === null) {
        pathPreviewRenderer.clearPath();
        return;
      }

      const inReachable = reachableTiles.has(`${hoverTile.x},${hoverTile.y}`);
      if (!inReachable && selected.unit.movementPoints <= 0) {
        pathPreviewRenderer.clearPath();
        return;
      }

      const path = inReachable
        ? pathfindingSystem.findPath(selected.unit, hoverTile.x, hoverTile.y)
        : pathfindingSystem.findPath(selected.unit, hoverTile.x, hoverTile.y, { respectMovementPoints: false });
      if (path === null) {
        pathPreviewRenderer.clearPath();
        return;
      }

      pathPreviewRenderer.showPath(path);
    });

    // Nation selected from legacy HTML events
    const onNationSelected = (event: Event) => {
      const { nationId } = (event as CustomEvent<{ nationId: string }>).detail;
      rightPanel?.showNation(nationId);
      leaderStrip?.setSelectedNation(nationId);
    };
    document.addEventListener('nationSelected', onNationSelected);

    const onLeaderSelected = (event: Event) => {
      const { nationId, leaderId } = (event as CustomEvent<{ nationId: string; leaderId?: string }>).detail;
      rightPanel?.showLeader(leaderId ?? nationId);
      this.rightSidebarPanel?.showDetails();
      leaderStrip?.setSelectedNation(nationId);
    };
    document.addEventListener('leaderSelected', onLeaderSelected);

    const onFocusCity = (event: Event) => {
      const cityId = (event as CustomEvent<{ cityId: string }>).detail.cityId;
      const city = cityManager.getCity(cityId);
      if (!city) return;

      const { x, y } = tileMap.tileToWorld(city.tileX, city.tileY);
      this.cameras.main.centerOn(x, y);
      selectionManager.selectCity(city);
      rightPanel?.showCity(city);
      refreshMovePreview();
    };
    window.addEventListener('focusCity', onFocusCity);

    const onLeaderCityFocusRequested = (event: Event) => {
      const cityId = (event as CustomEvent<{ cityId: string }>).detail.cityId;
      const city = cityManager.getCity(cityId);
      if (!city) return;

      if (city.ownerId === humanNationId) {
        // Clear any dismissed state so city view opens unconditionally.
        // clearSelection ensures onSelectionChanged fires even if the city
        // is already selected, guaranteeing city view opens.
        cityViewDismissedCityId = null;
        selectionManager.clearSelection();
        selectionManager.selectCity(city);
        // openCityView is called by onSelectionChanged; it handles camera focus.
      } else {
        focusOnCity(city);
      }
    };
    window.addEventListener('leaderCityFocusRequested', onLeaderCityFocusRequested);

    const onFocusUnit = (event: Event) => {
      const unitId = (event as CustomEvent<{ unitId: string }>).detail.unitId;
      const unit = unitManager.getUnit(unitId);
      if (!unit) return;

      const { x, y } = tileMap.tileToWorld(unit.tileX, unit.tileY);
      this.cameras.main.centerOn(x, y);
      selectionManager.selectUnit(unit);
      rightPanel?.showUnit(unit);
      refreshMovePreview();
    };
    window.addEventListener('focusUnit', onFocusUnit);
    const onDetailsFinderFocus = (event: Event) => {
      const detail = (event as CustomEvent<
        | { kind: 'tile'; x: number; y: number }
        | { kind: 'city'; cityId: string }
      >).detail;

      if (detail.kind === 'city') {
        const city = cityManager.getCity(detail.cityId);
        if (!city) return;
        const { x, y } = tileMap.tileToWorld(city.tileX, city.tileY);
        this.cameraController.focusOn(x, y, this.cameraController.zoom);
        selectionManager.selectCity(city);
        rightPanel?.showCity(city);
        refreshMovePreview();
        return;
      }

      const tile = tileMap.getTileAt(detail.x, detail.y);
      if (!tile) return;
      const { x, y } = tileMap.tileToWorld(tile.x, tile.y);
      this.cameraController.focusOn(x, y, this.cameraController.zoom);
      selectionManager.selectTile(tile);
      rightPanel?.showTile(tile);
      refreshMovePreview();
    };
    window.addEventListener('detailsFinderFocus', onDetailsFinderFocus);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearCityViewInteraction();
      this.input.off(Phaser.Input.Events.POINTER_DOWN, onCityViewPointerDown);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, onCityViewPointerMove);
      this.input.off(Phaser.Input.Events.POINTER_UP, onCityViewPointerUp);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, onCityViewPointerUp);
      window.removeEventListener('focusCity', onFocusCity);
      window.removeEventListener('leaderCityFocusRequested', onLeaderCityFocusRequested);
      window.removeEventListener('focusUnit', onFocusUnit);
      window.removeEventListener('detailsFinderFocus', onDetailsFinderFocus);
      document.removeEventListener('nationSelected', onNationSelected);
      document.removeEventListener('leaderSelected', onLeaderSelected);
      document.removeEventListener('diplomacyAction', onDiplomacyAction);
      tileMap.shutdown();
      coastEdgeRenderer.shutdown();
      biomeEdgeRenderer.shutdown();
      territoryRenderer.shutdown();
      hudLayer?.shutdown();
      rightPanel?.shutdown();
      diagnosticDialog.shutdown();
      worldMarkerRenderer.shutdown();
      this.diagnosticSystem.shutdown();
      cityView.shutdown();
      cityBannerRenderer.shutdown();
      cityRenderer.shutdown();
      naturalResourceRenderer.shutdown();
      tileBuildingRenderer.shutdown();
      tileImprovementOverlayRenderer.shutdown();
      invalidTileFeedbackRenderer.shutdown();
      this.minimapHud?.shutdown();
      this.minimapHud = null;
      this.rightSidebarPanel?.shutdown();
      this.rightSidebarPanel = null;
      this.leaderAudienceDialog?.destroy();
      this.leaderAudienceDialog = null;
      leaderStrip?.shutdown();
      cheatConsole.shutdown();
    });

    // Victory overlay
    victorySystem.onVictory((nationId, type) => {
      turnManager.stop();

      const nation = nationManager.getNation(nationId);
      const nationName = nation?.name ?? 'Unknown';
      const nationColor = nation ? `#${nation.color.toString(16).padStart(6, '0')}` : '#ffffff';

      const { width, height } = this.scale;

      const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
        .setScrollFactor(0)
        .setDepth(200);

      const victoryText = type === 'science'
        ? `Science Victory\n${nationName} has completed its aerospace program.`
        : type === 'cultural'
          ? `Cultural Victory\n${nationName} commands the world's World Wonders.`
          : `${nationName} has conquered all capitals!\nVICTORY`;

      this.add.text(width / 2, height / 2 - 30, victoryText, {
          fontSize: '32px',
          fontStyle: 'bold',
          color: nationColor,
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(201);

      this.add.text(width / 2, height / 2 + 40, 'Refresh to play again', {
        fontSize: '16px',
        color: '#aaaaaa',
        align: 'center',
      })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(201);

      // Block further input on the overlay
      overlay.setInteractive();

      // Human science / cultural victory: also show the modal popup
      if ((type === 'science' || type === 'cultural') && !isAutoplayActive() && nationId === humanNationId) {
        showDiplomacyModal({
          title: type === 'science' ? 'Science Victory' : 'Cultural Victory',
          message: type === 'science'
            ? `${nationName} has completed its aerospace program.`
            : `${nationName} commands the world's World Wonders.`,
          accentColor: type === 'science' ? '#4af' : '#c084fc',
          confirmLabel: 'Continue',
          cancelLabel: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      }
    });

    // Apply a saved snapshot (if loading) before the turn manager starts
    // so UI refreshes triggered by the initial turnStart reflect the
    // restored session.
    if (data.savedState) {
      SaveLoadService.apply(data.savedState, {
        mapKey: data.mapKey,
        humanNationId: data.humanNationId,
        activeNationIds: data.activeNationIds,
        gameSpeedId: gameSpeed.id,
        mapData,
        nationManager,
        cityManager,
        unitManager,
        productionSystem,
        diplomacyManager,
        allianceManager,
        discoverySystem,
        symbolicGiftRegistry,
        turnManager,
        gridSystem,
        wonderSystem,
        policySystem,
        tradeDealSystem,
        tradeConnectionSystem,
        tradeDiplomacySystem,
        visibilitySystem,
        exileProtectionSystem,
        corporationSystem,
        worldMarkerSystem,
        foreignTroopViolationSystem,
        historicalTimeline,
      });
      updateFog();
      // Older saves only persist tile.improvementConstruction; recompute
      // the unit-side mirror so the worker shows its build sprite + %.
      improvementConstructionSystem.syncUnitsFromTiles();

      const restoredCities = cityManager.getAllCities();
      console.log(
        '[GameScene] Restored cities before renderer rebuild:',
        restoredCities.length,
        restoredCities.map((city) => ({
          id: city.id,
          name: city.name,
          ownerId: city.ownerId,
          tileX: city.tileX,
          tileY: city.tileY,
        })),
      );
      for (const savedCity of data.savedState.cities) {
        if (cityManager.getCity(savedCity.id)) continue;
        console.warn(
          `[GameScene] Restored city missing from CityManager before cityRenderer.rebuildAll(): ${savedCity.id} (${savedCity.name})`,
        );
      }

      // Rebuild renderers that depend on replaced entities.
      cityRenderer.rebuildAll();
      cityBannerRenderer.rebuildAll();
      naturalResourceRenderer.rebuildAll();
      tileBuildingRenderer.rebuildAll();
      tileImprovementOverlayRenderer.rebuildAll();
      unitRenderer.rebuildAll();
      territoryRenderer.invalidate();
      refreshCultureOverlay();
      worldMarkerRenderer.refresh();
      leaderStrip?.rebuild();
      for (const nation of nationManager.getAllNations()) {
        resourceSystem.recalculateForNation(nation.id);
      }
      happinessSystem.recalculateAll();
      refreshOpenCityView();
    } else {
      // Fresh game from a scenario: apply the editor-configured starting
      // diplomacy (wars, alliances, open borders, embassies, trade, memory
      // values). Saves carry their own diplomacy and take the branch above.
      const activeDiplomacy = scenario.initialDiplomacy.filter(
        (entry) => activeSet.has(entry.nationA) && activeSet.has(entry.nationB),
      );
      SaveLoadService.applyScenarioDiplomacy(activeDiplomacy, {
        diplomacyManager,
        discoverySystem,
        allianceManager,
        turnManager,
        nationName: (id) => nationManager.getNation(id)?.name ?? id,
      });
    }

    const writeLatestAutosave = (): void => {
      try {
        const state = SaveLoadService.serialize({
          mapKey: data.mapKey,
          humanNationId: data.humanNationId,
          activeNationIds: data.activeNationIds,
          gameSpeedId: gameSpeed.id,
          mapData,
          nationManager,
          cityManager,
          unitManager,
          productionSystem,
          diplomacyManager,
          allianceManager,
          discoverySystem,
          symbolicGiftRegistry,
          turnManager,
          gridSystem,
          wonderSystem,
          policySystem,
          tradeDealSystem,
          tradeConnectionSystem,
          tradeDiplomacySystem,
          visibilitySystem,
          exileProtectionSystem,
          corporationSystem,
          worldMarkerSystem,
          foreignTroopViolationSystem,
          historicalTimeline,
        });
        window.localStorage.setItem(LATEST_AUTOSAVE_KEY, JSON.stringify(state));
      } catch (err: unknown) {
        console.warn(`Could not write latest autosave: ${(err as Error).message}`);
      }
    };

    turnManager.on('turnEnd', (e) => {
      if (e.nation.id === humanNationId) {
        writeLatestAutosave();
      }
    });

    // ─── Escape menu ─────────────────────────────────────────────────────────

    const tutorialView = new TutorialView();
    const settingsDialog = new SettingsDialog({
      music: SetupMusicManager.getShared(),
      // Enabling Auto End Turn mid-turn should take effect right away if nothing
      // currently needs orders.
      onAutoEndTurnChanged: () => maybeAutoEndTurn(),
    });
    const escapeMenu = new EscapeMenu(
      {
        onSave: () => {
          const state = SaveLoadService.serialize({
            mapKey: data.mapKey,
            humanNationId: data.humanNationId,
            activeNationIds: data.activeNationIds,
            gameSpeedId: gameSpeed.id,
            mapData,
            nationManager,
            cityManager,
            unitManager,
            productionSystem,
            diplomacyManager,
            allianceManager,
            discoverySystem,
            symbolicGiftRegistry,
            turnManager,
            gridSystem,
            wonderSystem,
            policySystem,
            tradeDealSystem,
            tradeConnectionSystem,
            tradeDiplomacySystem,
            visibilitySystem,
            exileProtectionSystem,
            corporationSystem,
            worldMarkerSystem,
            foreignTroopViolationSystem,
            historicalTimeline,
          });
          downloadSaveFile(state);
          escapeMenu.close();
        },
        onLoad: (file) => {
          file.text().then((text) => {
            const result = SaveLoadService.parse(text);
            if (!result.ok) {
              escapeMenu.setError(result.error);
              return;
            }
            const savedState = result.state;
            escapeMenu.close();
            this.scene.start('GameScene', {
              mapKey: savedState.mapKey,
              humanNationId: savedState.humanNationId,
              activeNationIds: savedState.activeNationIds,
              resourceAbundance: 'normal',
              gameSpeedId: savedState.gameSpeedId ?? DEFAULT_GAME_SPEED_ID,
              savedState,
            });
          }).catch((err: unknown) => {
            escapeMenu.setError(`Failed to read file: ${(err as Error).message}`);
          });
        },
        onQuit: () => {
          escapeMenu.close();
          this.scene.start('MainMenuScene');
        },
        onTutorial: () => {
          // Open the manual on top of the pause menu; leave the pause menu open
          // underneath so closing the tutorial returns the player to it.
          tutorialView.show();
        },
        onSettings: () => {
          // Open Settings over the pause menu; closing it returns to the menu.
          settingsDialog.show();
        },
      },
    );

    const onKeyEscape = () => {
      // An open menu always closes first.
      if (escapeMenu.isOpen()) {
        escapeMenu.close();
        return;
      }
      if (closeOpenCityView()) return;
      // If a human unit is in focus (selected, default move mode, not already in
      // free selection mode), Escape first "frees" it into inspect mode — the
      // same as clicking the active unit — instead of opening the menu. A second
      // Escape (no unit in focus) then opens the menu.
      const selection = selectionManager.getSelected();
      if (
        !freeSelectionMode &&
        selection?.kind === 'unit' &&
        selection.unit.ownerId === humanNationId &&
        unitActionToolbox.getMode() === 'move'
      ) {
        setFreeSelectionMode(true);
        return;
      }
      escapeMenu.toggle();
    };
    // Ctrl+Q is a second shortcut that always opens/toggles the game menu.
    const onKeyCtrlQ = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (closeOpenCityView()) return;
      escapeMenu.toggle();
    };
    this.input.keyboard?.on('keydown-ESC', onKeyEscape);
    this.input.keyboard?.on('keydown-Q', onKeyCtrlQ);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', onKeyEscape);
      this.input.keyboard?.off('keydown-Q', onKeyCtrlQ);
      escapeMenu.shutdown();
      tutorialView.shutdown();
      settingsDialog.shutdown();
    });

    // Starta turordningen — sist, efter att alla lyssnare kopplats
    turnManager.start();

    function refreshMovePreview(): void {
      const selected = selectionManager.getSelected();
      if (selected?.kind !== 'unit') {
        reachableTiles = new Set<string>();
        pathPreviewRenderer.clear();
        return;
      }

      const unit = selected.unit;
      const activeNation = turnManager.getCurrentNation();
      if (!activeNation.isHuman || unit.ownerId !== activeNation.id) {
        reachableTiles = new Set<string>();
        pathPreviewRenderer.clear();
        return;
      }

      if (unit.carriedByUnitId !== undefined) {
        const transport = unitManager.getUnit(unit.carriedByUnitId);
        const disembarkSet = new Set<string>();
        if (transport) {
          for (const coord of gridSystem.getAdjacentCoords({ x: transport.tileX, y: transport.tileY })) {
            if (unitBoardingManager.canUnboard(unit, coord.x, coord.y)) {
              disembarkSet.add(`${coord.x},${coord.y}`);
            }
          }
        }
        reachableTiles = disembarkSet;
        if (disembarkSet.size > 0) pathPreviewRenderer.showReachableTiles(disembarkSet);
        else pathPreviewRenderer.clear();
        pathPreviewRenderer.clearPath();
        return;
      }

      if (
        unit.movementPoints <= 0 ||
        improvementConstructionSystem.isUnitBusy(unit.id)
      ) {
        reachableTiles = new Set<string>();
        pathPreviewRenderer.clear();
        return;
      }

      reachableTiles = pathfindingSystem.getReachableTiles(unit);
      pathPreviewRenderer.showReachableTiles(reachableTiles);

      if (unit.queuedDestination) {
        const dest = unit.queuedDestination;
        const queuedPath = pathfindingSystem.findPath(unit, dest.x, dest.y, { respectMovementPoints: false });
        if (queuedPath !== null) {
          pathPreviewRenderer.showPath(queuedPath);
        } else {
          unit.queuedDestination = undefined;
          pathPreviewRenderer.clearPath();
        }
      } else {
        pathPreviewRenderer.clearPath();
      }
    }

    function refreshSelectedCityOverlays(): void {
      const selected = selectionManager.getSelected();
      if (selected?.kind !== 'city') return;
      if (cityView.isOpenForCity(selected.city.id)) {
        territoryRenderer.setMode('cityView');
        cityViewRenderer.showWithInteraction(selected.city, cityViewInteraction.getRenderState());
        return;
      }
      territoryRenderer.setMode('normal');
      cityWorkTileRenderer.show(selected.city);
      cultureClaimTileRenderer.show(selected.city);
    }

    function refreshOpenCityView(): void {
      const selected = selectionManager.getSelected();
      if (selected?.kind !== 'city') return;
      if (!cityView.isOpenForCity(selected.city.id)) return;
      cityView.refresh(
        selected.city,
        getCityViewUnitOptions(selected.city),
        getCityViewBuildingOptions(selected.city),
        getCityViewPlacementPanelState(selected.city),
        getCityViewTilePurchaseState(selected.city),
        getCityViewWonderOptions(selected.city),
        getCityViewCorporationOptions(selected.city),
        getCityViewQueueItems(selected.city),
      );
      cityViewRenderer.showWithState(
        selected.city,
        cityViewInteraction.getRenderState(),
        getCityViewPlacementRenderState(selected.city),
      );
    }

    const openCityView = (city: City): void => {
      unbindGameplayHotkeys();
      const { x, y } = tileMap.tileToWorld(city.tileX, city.tileY);
      this.cameraController.focusOn(x, y, 2.0);
      const screenPosition = worldToScreen(this.cameras.main, x, y);
      cityView.show(
        city,
        getCityViewUnitOptions(city),
        getCityViewBuildingOptions(city),
        getCityViewPlacementPanelState(city),
        getCityViewTilePurchaseState(city),
        getCityViewWonderOptions(city),
        getCityViewCorporationOptions(city),
        getCityViewQueueItems(city),
        screenPosition,
      );
      cityViewRenderer.showWithState(
        city,
        cityViewInteraction.getRenderState(),
        getCityViewPlacementRenderState(city),
      );
    };
  }

  update(_time: number, delta: number): void {
    if (!this.cameraController) return;
    this.cameraController.update(delta);
    if (!this.isAutoplayActiveForVisuals()) {
      this.minimapHud?.update();
    }
    // Re-anchor the tutorial overlay so it tracks units / HUD as the camera moves.
    this.tutorialWizard?.update();
    this.diagnosticSystem.update();
  }

  /**
   * Builds the first-time tutorial step list and auto-launches the wizard on new
   * games. GameScene stays orchestration-only: every step supplies a closure
   * that resolves its live screen-space target (units via the camera transform,
   * HUD controls via HudLayer accessors) and optional selection side effects.
   * The wizard itself owns no game knowledge, so the same framework can drive
   * future tutorials with a different step list.
   */
  private setupTutorialWizard(deps: {
    humanNationId: string | undefined;
    unitManager: UnitManager;
    tileMap: TileMap;
    hudLayer: HudLayer;
    worldInputGate: WorldInputGate;
    selectionManager: SelectionManager;
    focusUnit: (unit: Unit) => void;
    isFreshGame: boolean;
  }): void {
    const { humanNationId, unitManager, tileMap, hudLayer, worldInputGate, selectionManager, focusUnit, isFreshGame } = deps;
    if (humanNationId === undefined) return;

    const humanUnits = unitManager.getUnitsByOwner(humanNationId);
    const startingSettlerId = humanUnits.find((u) => u.unitType.canFound)?.id;
    const startingScoutId = humanUnits.find(
      (u) => u.unitType.category === 'recon' || u.unitType.category === 'naval_recon',
    )?.id;

    // Without a starting settler there's nothing meaningful to teach; bail out.
    if (startingSettlerId === undefined) return;

    const camera = this.cameras.main;
    const unitTargetRect = (unitId: string | undefined): ScreenRect | null => {
      if (unitId === undefined) return null;
      const unit = unitManager.getUnit(unitId);
      if (!unit) return null; // founded/dismissed — target no longer exists
      const world = tileMap.tileToWorld(unit.tileX, unit.tileY);
      const view = camera.worldView;
      const centerX = (world.x - view.x) * camera.zoom;
      const centerY = (world.y - view.y) * camera.zoom;
      const size = Math.max(tileMap.getTileSize() * camera.zoom, 32);
      // Drop the arrow when the unit is well outside the viewport.
      if (
        centerX < -size || centerY < -size
        || centerX > this.scale.width + size || centerY > this.scale.height + size
      ) {
        return null;
      }
      return { centerX, centerY, width: size, height: size };
    };

    const selectUnitById = (unitId: string | undefined): void => {
      if (unitId === undefined) return;
      const unit = unitManager.getUnit(unitId);
      if (!unit || unit.ownerId !== humanNationId) return;
      // SelectionManager no-ops when re-selecting the already-selected unit, so
      // onSelectionChanged (which wires the unit-action toolbox) would not fire
      // and the action buttons could stay hidden. Clear first when the unit is
      // already selected so focusUnit re-triggers selection and the Found City
      // button reliably appears on the relevant step.
      const current = selectionManager.getSelected();
      if (current?.kind === 'unit' && current.unit.id === unit.id) {
        selectionManager.clearSelection();
      }
      focusUnit(unit);
    };

    const steps: TutorialStep[] = [
      {
        title: 'Your Settler',
        text: 'This is your Settler. Settlers are used to found new cities and begin expanding your civilization.',
        targetType: 'unit',
        placement: 'auto',
        onEnter: () => selectUnitById(startingSettlerId),
        resolveTarget: () => unitTargetRect(startingSettlerId),
      },
      {
        title: 'Found City',
        text: 'Units have different action buttons depending on what they are capable of doing. The Settler can found a city.',
        targetType: 'ui-element',
        placement: 'auto',
        onEnter: () => selectUnitById(startingSettlerId),
        resolveTarget: () => hudLayer.getUnitActionButtonRect('found'),
      },
      {
        title: 'Your Scout',
        text: 'Scouts are used to explore the world and discover cities, resources, natural wonders and other civilizations. Scouts can also be automated.',
        targetType: 'unit',
        placement: 'auto',
        onEnter: () => selectUnitById(startingScoutId),
        resolveTarget: () => unitTargetRect(startingScoutId),
      },
      {
        title: 'Automated Scouting',
        text: 'Automated scouting allows the Scout to explore on its own using the same exploration logic used by AI scouts.',
        targetType: 'ui-element',
        placement: 'auto',
        onEnter: () => selectUnitById(startingScoutId),
        resolveTarget: () => hudLayer.getUnitActionButtonRect('explore'),
      },
      {
        title: 'Next Turn',
        text: 'End your current turn and let all other civilizations act. Normally you press this once you have finished giving orders (or press Return / Enter). If you prefer, enable Auto End Turn in Settings — then the game advances the turn for you automatically once no units need orders.',
        targetType: 'ui-element',
        placement: 'auto',
        resolveTarget: () => hudLayer.getEndTurnButtonRect(),
      },
      {
        title: 'Gold',
        text: 'Gold is used to support your civilization. Military units require maintenance, so running out of gold can become a serious problem.',
        targetType: 'ui-element',
        placement: 'below',
        resolveTarget: () => hudLayer.getResourceEntryRect('gold'),
      },
      {
        title: 'Unit Focus',
        text: 'Clicking the active unit toggles unit focus on and off. When a unit is inactive you can freely inspect cities, tiles and other units without issuing movement orders.',
        targetType: 'unit',
        placement: 'auto',
        onEnter: () => selectUnitById(startingSettlerId),
        resolveTarget: () => unitTargetRect(startingSettlerId),
      },
    ];

    this.tutorialWizard = new TutorialWizard(
      this,
      hudLayer.getOwnedObjectAttacher(),
      worldInputGate,
      {
        // Close (any step): persist the player's "Don't show again" choice
        // verbatim (only a ticked checkbox suppresses future runs), then return
        // focus to the Settler so the player resumes with it selected and active.
        onClose: (dontShowAgain) => {
          setTutorialDontShowAgain(dontShowAgain);
          selectUnitById(startingSettlerId);
        },
      },
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tutorialWizard?.destroy();
      this.tutorialWizard = null;
    });

    if (isFreshGame && !isTutorialDontShowAgain()) {
      this.tutorialWizard.start(steps);
    }
  }

  private findUnitPlacementTile(
    tileMap: TileMap,
    unitManager: UnitManager,
    city: City,
    unitType: UnitType,
    gridSystem: IGridSystem,
  ): { x: number; y: number } | null {
    if (unitType.residenceCapitalOnly === true) {
      const tile = tileMap.getTileAt(city.tileX, city.tileY);
      if (tile && tile.ownerId === city.ownerId && city.isResidenceCapital) {
        return { x: city.tileX, y: city.tileY };
      }
      return null;
    }

    const adjacentCandidates = gridSystem.getAdjacentCoords({ x: city.tileX, y: city.tileY });
    const candidates = unitType.isNaval
      ? city.ownedTileCoords
      : [{ x: city.tileX, y: city.tileY }, ...adjacentCandidates];

    for (const candidate of candidates) {
      const tile = tileMap.getTileAt(candidate.x, candidate.y);
      if (tile === null) continue;
      if (tile.ownerId !== city.ownerId) continue;
      if (unitType.isNaval) {
        if (tile.type !== TileType.Ocean && tile.type !== TileType.Coast) continue;
      } else if (tile.type === TileType.Ocean || tile.type === TileType.Coast) {
        continue;
      }
      if (unitManager.getUnitAt(candidate.x, candidate.y) !== null) continue;
      return candidate;
    }

    return null;
  }

  /**
   * Spawn one starting Scout per nation, using the normal unit creation path.
   * Each Scout is anchored on the nation's scenario start position
   * (`startTerritoryCenter`) — the same point the settler and initial territory
   * derive from — which is stable regardless of whether the nation begins with
   * a settler or a city. Nations that already own a Scout (e.g. one placed
   * explicitly by a scenario) are skipped, so scenarios can override this.
   */
  private spawnStartingScouts(
    nations: ReadonlyArray<ScenarioNation>,
    unitManager: UnitManager,
    gridSystem: IGridSystem,
    mapData: MapData,
  ): void {
    const scoutType = getUnitTypeById('scout');
    if (!scoutType) return;

    for (const nation of nations) {
      // Duplicate protection: respect a Scout the scenario already placed.
      if (unitManager.getUnitsByOwner(nation.id).some((unit) => unit.unitType.id === 'scout')) continue;

      const anchor = { x: nation.startTerritoryCenter.q, y: nation.startTerritoryCenter.r };
      const tile = this.findStartingScoutTile(anchor, unitManager, gridSystem, mapData);
      if (tile === null) continue;

      unitManager.createUnit({ type: scoutType, ownerId: nation.id, tileX: tile.x, tileY: tile.y });
    }
  }

  /**
   * Find a spawn tile for a starting Scout: the anchor tile when free,
   * otherwise the nearest free land tile expanding outward ring by ring.
   */
  private findStartingScoutTile(
    center: { x: number; y: number },
    unitManager: UnitManager,
    gridSystem: IGridSystem,
    mapData: MapData,
  ): Tile | null {
    const isLandAndFree = (tile: Tile | undefined): tile is Tile =>
      tile !== undefined
      && tile.type !== TileType.Ocean
      && tile.type !== TileType.Coast
      && unitManager.getUnitAt(tile.x, tile.y) === null;

    const centerTile = mapData.tiles[center.y]?.[center.x];
    if (isLandAndFree(centerTile)) return centerTile;

    const MAX_RADIUS = 4;
    for (let radius = 1; radius <= MAX_RADIUS; radius++) {
      const ring = gridSystem
        .getTilesInRange(center, radius, mapData)
        .filter((tile) => gridSystem.getDistance(center, { x: tile.x, y: tile.y }) === radius)
        .filter(isLandAndFree);
      if (ring.length > 0) return ring[0]!;
    }
    return null;
  }

  private getMapCoverZoom(worldWidth: number, worldHeight: number): number {
    const canvasWidth = this.cameras.main.width;
    const canvasHeight = this.cameras.main.height;
    return Math.max(canvasWidth / worldWidth, canvasHeight / worldHeight);
  }

  private getTileForSelectable(
    tileMap: TileMap,
    selectable: Selectable | null,
  ): { x: number; y: number } | null {
    if (selectable === null) return null;
    if (selectable.kind === 'tile') return selectable.tile;
    if (selectable.kind === 'city') {
      return tileMap.getTileAt(selectable.city.tileX, selectable.city.tileY);
    }
    return tileMap.getTileAt(selectable.unit.tileX, selectable.unit.tileY);
  }
}

function generateWorldSeed(): string {
  const cryptoRef = (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined) as
    | { randomUUID?: () => string }
    | undefined;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  return `${Date.now()}-${Math.random()}`;
}

function downloadSaveFile(state: SavedGameState): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `epoch-save-${state.mapKey}-${ts}.json`;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getDiscoveryFallbackLabel(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getProducibleName(item: Producible): string {
  switch (item.kind) {
    case 'unit':
      return item.unitType.name;
    case 'building':
      return item.buildingType.name;
    case 'wonder':
      return item.wonderType.name;
    case 'corporation':
      return item.corporationType.name;
    case 'tradeRoute':
      return item.displayName;
  }
}

function getProducibleSpritePath(item: Producible): string | undefined {
  switch (item.kind) {
    case 'unit':
      return getUnitSpritePath(item.unitType.id);
    case 'building':
      return getBuildingSpritePath(item.buildingType.id);
    case 'wonder':
      return getWonderSpritePath(item.wonderType.id);
    case 'corporation':
      return getCorporationSpritePath(item.corporationType.id);
  }
}

function formatCultureUnlockValue(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAIDiplomacyAction(
  action: AIDiplomacyAction,
  targetName: string,
): string {
  switch (action) {
    case 'declareWar':
      return `declared war on ${targetName}.`;
    case 'proposePeace':
      return `proposed peace to ${targetName}.`;
    case 'openBorders':
      return `opened borders to ${targetName}.`;
    case 'cancelOpenBorders':
      return `cancelled open borders with ${targetName}.`;
  }
}

const IDEOLOGICAL_DRIFT_LOG_COOLDOWN_ROUNDS = 20;
const MAX_IDEOLOGICAL_DRIFT_SUMMARY_LINES = 8;
const BORDER_PRESSURE_LOG_COOLDOWN_ROUNDS = 15;
const MAX_BORDER_PRESSURE_SUMMARY_LINES = 8;
/** Yield duration between AI nations. 0 ms is enough for the browser to paint and process input. */
const AI_TURN_YIELD_MS = 0;
/** Small pause before Auto End Turn fires, so the player can glance at the board. */
const AUTO_END_TURN_DELAY_MS = 350;

function formatIdeologicalDriftSummary(
  round: number,
  events: readonly IdeologicalDriftEvent[],
  recentLogs: Map<string, number>,
): { text: string; nationIds: string[] } | null {
  const lines: string[] = [];
  const nationIds = new Set<string>();

  for (const event of events) {
    if (!isMeaningfulIdeologicalDriftLogEvent(event)) continue;

    const cacheKey = getIdeologicalDriftLogCacheKey(event);
    const lastLoggedRound = recentLogs.get(cacheKey);
    if (
      lastLoggedRound !== undefined &&
      round - lastLoggedRound < IDEOLOGICAL_DRIFT_LOG_COOLDOWN_ROUNDS
    ) {
      continue;
    }

    recentLogs.set(cacheKey, round);
    nationIds.add(event.nationAId);
    nationIds.add(event.nationBId);
    lines.push(`- ${event.nationAName}/${event.nationBName}: ${event.compatibilityLabel} (${formatIdeologicalDriftDelta(event)})`);
  }

  pruneIdeologicalDriftLogCooldowns(round, recentLogs);
  if (lines.length === 0) return null;

  const visibleLines = lines.slice(0, MAX_IDEOLOGICAL_DRIFT_SUMMARY_LINES);
  const hiddenCount = lines.length - visibleLines.length;
  const overflowLine = hiddenCount > 0 ? [`- ${hiddenCount} more ideological shifts suppressed.`] : [];
  return {
    text: ['Ideological drift:', ...visibleLines, ...overflowLine].join('\n'),
    nationIds: [...nationIds],
  };
}

function formatIdeologicalDriftDelta(event: IdeologicalDriftEvent): string {
  const parts: string[] = [];
  if (event.delta.trust !== undefined && event.delta.trust !== 0) {
    parts.push(`${formatSignedDeltaLabel(event.delta.trust)}trust`);
  }
  if (event.delta.affinity !== undefined && event.delta.affinity !== 0) {
    parts.push(`${formatSignedDeltaLabel(event.delta.affinity)}affinity`);
  }
  if (event.delta.hostility !== undefined && event.delta.hostility !== 0) {
    parts.push(`${formatSignedDeltaLabel(event.delta.hostility)}hostility`);
  }
  if (event.delta.fear !== undefined && event.delta.fear !== 0) {
    parts.push(`${formatSignedDeltaLabel(event.delta.fear)}fear`);
  }
  return parts.join(', ');
}

function isMeaningfulIdeologicalDriftLogEvent(event: IdeologicalDriftEvent): boolean {
  return (event.delta.trust ?? 0) !== 0 || (event.delta.hostility ?? 0) !== 0;
}

function getIdeologicalDriftLogCacheKey(event: IdeologicalDriftEvent): string {
  const [firstNationId, secondNationId] = [event.nationAId, event.nationBId].sort();
  return [
    firstNationId,
    secondNationId,
    event.compatibilityLabel,
    event.delta.trust ?? 0,
    event.delta.hostility ?? 0,
  ].join('|');
}

function pruneIdeologicalDriftLogCooldowns(round: number, recentLogs: Map<string, number>): void {
  for (const [key, lastLoggedRound] of recentLogs) {
    if (round - lastLoggedRound >= IDEOLOGICAL_DRIFT_LOG_COOLDOWN_ROUNDS * 2) {
      recentLogs.delete(key);
    }
  }
}

function formatSignedDeltaLabel(value: number): string {
  return value > 0 ? '+' : '-';
}

function formatBorderPressureSummary(
  round: number,
  events: readonly BorderPressureEvent[],
  recentLogs: Map<string, number>,
): { text: string; nationIds: string[] } | null {
  const lines: string[] = [];
  const nationIds = new Set<string>();

  for (const event of events) {
    const cacheKey = getBorderPressureLogCacheKey(event);
    const lastLoggedRound = recentLogs.get(cacheKey);
    if (
      lastLoggedRound !== undefined &&
      round - lastLoggedRound < BORDER_PRESSURE_LOG_COOLDOWN_ROUNDS
    ) {
      continue;
    }

    recentLogs.set(cacheKey, round);
    nationIds.add(event.nationAId);
    nationIds.add(event.nationBId);
    lines.push(`- ${event.nationAName}/${event.nationBName}: ${event.pressureLevel} pressure (${formatBorderPressureDelta(event)})`);
  }

  pruneBorderPressureLogCooldowns(round, recentLogs);
  if (lines.length === 0) return null;

  const visibleLines = lines.slice(0, MAX_BORDER_PRESSURE_SUMMARY_LINES);
  const hiddenCount = lines.length - visibleLines.length;
  const overflowLine = hiddenCount > 0 ? [`- ${hiddenCount} more border pressure shifts suppressed.`] : [];
  return {
    text: ['Border tensions:', ...visibleLines, ...overflowLine].join('\n'),
    nationIds: [...nationIds],
  };
}

function formatBorderPressureDelta(event: BorderPressureEvent): string {
  const parts: string[] = [];
  if (event.delta.trust !== undefined && event.delta.trust !== 0) {
    parts.push(`${formatSignedDeltaLabel(event.delta.trust)}trust`);
  }
  if (event.delta.hostility !== undefined && event.delta.hostility !== 0) {
    parts.push(`${formatSignedDeltaLabel(event.delta.hostility)}hostility`);
  }
  if (event.delta.fear !== undefined && event.delta.fear !== 0) {
    parts.push(`${formatSignedDeltaLabel(event.delta.fear)}fear`);
  }
  if (event.compatibility >= 25) parts.push('softened by ideology');
  else if (event.compatibility <= -25) parts.push('amplified by ideology');
  return parts.join(', ');
}

function getBorderPressureLogCacheKey(event: BorderPressureEvent): string {
  const [firstNationId, secondNationId] = [event.nationAId, event.nationBId].sort();
  return [
    firstNationId,
    secondNationId,
    event.pressureLevel,
    event.delta.trust ?? 0,
    event.delta.hostility ?? 0,
    event.delta.fear ?? 0,
  ].join('|');
}

function pruneBorderPressureLogCooldowns(round: number, recentLogs: Map<string, number>): void {
  for (const [key, lastLoggedRound] of recentLogs) {
    if (round - lastLoggedRound >= BORDER_PRESSURE_LOG_COOLDOWN_ROUNDS * 2) {
      recentLogs.delete(key);
    }
  }
}

function isUnitUpkeepAffordabilityReason(reason: string): boolean {
  return reason.startsWith('Not enough gold reserves to support this unit');
}

function worldToScreen(
  camera: Phaser.Cameras.Scene2D.Camera,
  worldX: number,
  worldY: number,
): { screenX: number; screenY: number } {
  return {
    screenX: camera.x + (worldX - camera.scrollX) * camera.zoom,
    screenY: camera.y + (worldY - camera.scrollY) * camera.zoom,
  };
}

function isDevBuild(): boolean {
  if (Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV)) return true;
  if (typeof window === 'undefined') return false;
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocalHost && new URLSearchParams(window.location.search).get('epochDiagnostics') === '1';
}

function formatProposalKind(kind: 'open_borders' | 'embassy' | 'resource_trade' | 'gold_trade' | 'peace'): string {
  switch (kind) {
    case 'open_borders': return 'Open Borders proposal';
    case 'embassy': return 'Embassy proposal';
    case 'resource_trade': return 'resource trade';
    case 'gold_trade': return 'gold transfer';
    case 'peace': return 'peace proposal';
  }
}
