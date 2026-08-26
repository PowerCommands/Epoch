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
import {
  CityIntegrationSystem,
  getCityIntegrationOutputMultiplier,
  getNationCityIntegrationCounts,
} from '../systems/CityIntegrationSystem';
import {
  CurrencySystem,
  countActiveBanksForNation,
  getActiveInternationalTradePartnerIds,
  type CurrencyStrength,
} from '../systems/CurrencySystem';
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
import { initializeWorldNaturalResources } from '../systems/WorldResourceInitialization';
import {
  AEROSPACE_INDUSTRIES_ID,
  AEROSPACE_PART_PRODUCTION,
  AEROSPACE_PARTS_ID,
  DEFAULT_REQUIRED_AEROSPACE_PARTS,
} from '../data/scienceVictory';
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
import { ProductionPurchaseSystem } from '../systems/ProductionPurchaseSystem';
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
import { canUnitEnterTile, isWaterTile } from '../systems/UnitMovementRules';
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
import { GossipSystem } from '../systems/GossipSystem';
import { GossipFlavorEventSystem } from '../systems/GossipFlavorEventSystem';
import { recordGossipInsultInHistory } from '../systems/GossipHistoryRecorder';
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
import { NewspaperSystem } from '../systems/NewspaperSystem';
import {
  GamesOfNationsSystem,
  type GamesOfNationsSportResolvedEvent,
} from '../systems/GamesOfNationsSystem';
import { buildGamesOfNationsEdition } from '../systems/GamesOfNationsChronicle';
import type { GamesOfNationsSportValues, GamesOfNationsSummary } from '../types/gamesOfNations';
import { buildGamesOfNationsUiModel } from '../ui/hud/GamesOfNationsUiModel';
import { buildDominationRanking } from '../systems/DominationRanking';
import { TimelinePanel } from '../ui/TimelinePanel';
import { NewspaperDialog } from '../ui/NewspaperDialog';
import { EraSystem, getEraRank, getHighestEra } from '../systems/EraSystem';
import type { Era } from '../data/technologies';
import { AISystem } from '../systems/AISystem';
import { getLeaderByNationId, getLeaderPersonalityByNationId, setScenarioLeaderOverrides } from '../data/leaders';
import { GOSSIP_DEFINITIONS } from '../data/gossip';
import { resolveLeaderEraStrategy } from '../data/aiLeaderEraStrategies';
import { FoundCitySystem } from '../systems/FoundCitySystem';
import { VictorySystem, type EnabledVictoryConditions, type VictoryType } from '../systems/VictorySystem';
import { PoliticalCapitalSystem } from '../systems/PoliticalCapitalSystem';
import { NationCollapseSystem } from '../systems/NationCollapseSystem';
import { ExileProtectionSystem } from '../systems/ExileProtectionSystem';
import { CityDefenseSystem } from '../systems/CityDefenseSystem';
import { BuilderSystem } from '../systems/BuilderSystem';
import { InfrastructureSabotageSystem, IMPROVEMENT_DESTRUCTION_LOOT_GOLD } from '../systems/InfrastructureSabotageSystem';
import { InfrastructureRepairSystem } from '../systems/InfrastructureRepairSystem';
import { InsurgentBehaviorSystem } from '../systems/InsurgentBehaviorSystem';
import { BarbarianSystem } from '../systems/BarbarianSystem';
import { resolveBarbarianSpawnInterval } from '../data/barbarians';
import { CovertSuspicionSystem } from '../systems/diplomacy/CovertSuspicionSystem';
import { AICovertOperationsSystem } from '../systems/ai/AICovertOperationsSystem';
import { IntelReportDialog } from '../ui/IntelReportDialog';
import { isCovertOperative } from '../utils/unitRoleUtils';
import { CheatSystem } from '../systems/CheatSystem';
import { AutoplaySystem } from '../systems/AutoplaySystem';
import { CombatAnimationSystem } from '../systems/CombatAnimationSystem';
import { isHumanInvolvedInCombat } from '../systems/CombatAnimationPolicy';
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
import { WorldCouncilSystem } from '../systems/WorldCouncilSystem';
import { WorldCouncilResolutionSystem } from '../systems/WorldCouncilResolutionSystem';
import { CorporationSystem } from '../systems/CorporationSystem';
import { AerospacePartSystem } from '../systems/AerospacePartSystem';
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
import { SaveGameDialog } from '../ui/SaveGameDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SettingsDialog } from '../ui/SettingsDialog';
import { isAutofocusOnEndTurn, isAutoEndTurn } from '../systems/PlayerSettings';
import { CityView, type CityViewBuildingOption, type CityViewCorporationOption, type CityViewPlacementPanelState, type CityViewQueueItem, type CityViewUnitOption, type CityViewWonderOption } from '../ui/CityView';
import type { CityViewTilePurchaseState } from '../ui/CityView';
import type { AIDiplomacyAction } from '../types/aiDiplomacy';
import { ALL_WONDERS, getWonderById } from '../data/wonders';
import type { WonderState, WonderType } from '../entities/Wonder';
import type { WorldCouncilOrganizationKind } from '../types/worldCouncil';
import { CORPORATIONS, getCorporationById } from '../data/corporations';
import { getResourceDefinitionById, getResourceDisplayName } from '../data/resources';
import type { Producible } from '../types/producible';
import { HudLayer } from '../ui/hud/HudLayer';
import { TutorialWizard, type StartupGuideStep } from '../ui/hud/TutorialWizard';
import { isTutorialDontShowAgain } from '../systems/TutorialSettings';
import { GuideProgression } from '../systems/GuideProgression';
import { buildProgressiveGuideTips } from '../data/progressiveGuide';
import type { ScreenRect } from '../types/screenRect';
import { Tooltip } from '../ui/hud/Tooltip';
import type { DiscoveryPopupData, DiscoveryPopupRow } from '../ui/hud/DiscoveryPopup';
import { UnitHoverDiagnosticHud } from '../ui/hud/UnitHoverDiagnosticHud';
import { MinimapHud } from '../ui/hud/MinimapHud';
import { NationHudDataProvider } from '../ui/hud/NationHudDataProvider';
import { RightSidebarPanel } from '../ui/phaser/RightSidebarPanel';
import { RightSidebarPanelDataProvider } from '../ui/phaser/RightSidebarPanelDataProvider';
import { LeaderAudienceDialog } from '../ui/dialogs/LeaderAudienceDialog';
import { LeaderGossipDialog } from '../ui/dialogs/LeaderGossipDialog';
import { filterGossipTargets } from '../ui/dialogs/GossipDialogModel';
import { SaveLoadService } from '../systems/SaveLoadService';
import { LATEST_AUTOSAVE_KEY } from '../systems/AutosaveService';
import type { SavedGameState, SavedGuideProgress } from '../types/saveGame';
import { ALL_BUILDINGS, GRAND_STADIUM, GRAND_STADIUM_BUILDING_ID, getBuildingById, isBarbarianCamp } from '../data/buildings';
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
import { materializeScenarioNationReplacements } from '../utils/scenarioNationReplacements';
import { applyScenarioNationCustomizations } from '../utils/scenarioNationCustomizations';
import { DEFAULT_GAME_SPEED_ID, getGameSpeedById } from '../data/gameSpeeds';
import { LogManager } from '../systems/LogManager';

interface EpochGameDiagnostics {
  startAutoplay: (rounds: number, options?: { continueAfterVictory?: boolean }) => Promise<{ completedRounds: number; victory: EpochVictorySummary | null }>;
  stopAutoplay: () => void;
  isAutoplayActive: () => boolean;
  isAutoplayCompleted: () => boolean;
  getEventLogEntries: () => Array<{ id: number; text: string; nationIds: string[]; round: number }>;
  getEventLogText: () => string;
  getStateSummary: () => EpochStateSummary;
  getSaveState: () => SavedGameState;
  /** Dev-only: centre the camera on the first founded city so visual tests can screenshot a city banner. */
  focusFirstCity: (zoom?: number) => { ok: boolean };
}

/** Per-nation progression snapshot used for timeline/balance calibration. */
interface EpochNationStateSummary {
  id: string;
  name: string;
  isHuman: boolean;
  era: string;
  technologyCount: number;
  cultureNodeCount: number;
  currentResearch: string | null;
  currentResearchEffectiveCost: number | null;
  currentResearchTimeline: {
    technologyEra: string;
    currentYear: number;
    eraStartYear: number;
    yearsAhead: number;
    multiplier: number;
  } | null;
  sciencePerTurn: number;
  currentCulture: string | null;
  cityCount: number;
  population: number;
  currency: {
    name: string;
    symbol: string;
    strength: CurrencyStrength;
    treasury: number;
  } | null;
  cityIntegration: {
    occupied: number;
    recovering: number;
    integrated: number;
  };
  culturalVictory: {
    normalRequirementsMet: boolean;
    latestCompletedGamesNumber: number | null;
    reigningGamesChampionNationId: string | null;
    isReigningGamesChampion: boolean;
    victoryEligible: boolean;
  };
}

/** First observed actual era transition during a diagnostics/autorun session. */
interface EpochEraMilestone {
  era: string;
  nationId: string;
  nationName: string;
  turn: number;
  worldYear: number;
  worldYearLabel: string;
  previousEra: string;
  newEra: string;
  source: string | null;
}

/** Structured victory outcome surfaced to diagnostics/autorun. */
interface EpochVictorySummary {
  nationId: string;
  nationName: string;
  type: VictoryType;
  round: number;
}

interface EpochStateSummary {
  currentRound: number;
  currentNationId: string;
  currentNationName: string;
  nationCount: number;
  cityCount: number;
  unitCount: number;
  worldYear: number;
  worldYearLabel: string;
  scenario: string;
  victory: EpochVictorySummary | null;
  gamesOfNations: GamesOfNationsSummary;
  nations: EpochNationStateSummary[];
  eraMilestones: EpochEraMilestone[];
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
  private leaderGossipDialog: LeaderGossipDialog | null = null;
  private isAutoplayActiveForVisuals: () => boolean = () => false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data: GameConfig): void {
    this.minimapHud = null;
    this.rightSidebarPanel = null;
    this.leaderAudienceDialog = null;
    this.leaderGossipDialog = null;
    this.tutorialWizard = null;
    this.isAutoplayActiveForVisuals = () => false;
    // ─── Data & system ───────────────────────────────────────────────────────

    // 1. Parse scenario using map key from config. Procedural saves carry their
    // original scenario so loading never depends on rerunning a newer generator.
    const embeddedGeneratedScenario = data.savedState?.generatedScenario ?? data.generatedScenario;
    if (embeddedGeneratedScenario && !this.cache.json.has(data.mapKey)) {
      this.cache.json.add(data.mapKey, embeddedGeneratedScenario.scenario);
    }
    const scenarioJson = (embeddedGeneratedScenario?.scenario ?? this.cache.json.get(data.mapKey)) as ScenarioData | undefined;
    if (!scenarioJson) throw new Error(`Scenario could not be loaded: ${data.mapKey}`);
    if (embeddedGeneratedScenario !== data.generatedScenario) data = { ...data, generatedScenario: embeddedGeneratedScenario };
    const replacementResult = data.savedState
      ? { scenario: scenarioJson, idMap: {} }
      : materializeScenarioNationReplacements(scenarioJson, data.scenarioNationReplacements);
    const runtimeScenarioJson = data.savedState
      ? replacementResult.scenario
      : applyScenarioNationCustomizations(
          replacementResult.scenario,
          data.scenarioNationCustomizations,
          replacementResult.idMap,
        );
    if (data.generatedScenario && !data.savedState) {
      data = {
        ...data,
        generatedScenario: {
          metadata: data.generatedScenario.metadata,
          scenario: runtimeScenarioJson,
        },
      };
    }
    if (!data.savedState && Object.keys(replacementResult.idMap).length > 0) {
      const remapNationId = (nationId: string) => replacementResult.idMap[nationId] ?? nationId;
      data = {
        ...data,
        humanNationId: remapNationId(data.humanNationId),
        activeNationIds: data.activeNationIds.map(remapNationId),
      };
    }
    // Install scenario-authored leader name/description overrides before any
    // system or UI reads leaders, so the override flows through the whole game.
    setScenarioLeaderOverrides(runtimeScenarioJson.nations);

    const scenario = ScenarioLoader.parse(runtimeScenarioJson);
    const mapData = scenario.mapData;
    // "No barbarians" setup option: strip every Barbarian Camp from the scenario
    // up front, as if it never had any. Done before any system/renderer reads the
    // map. Only relevant on fresh starts (loaded saves carry their own map state).
    if (data.noBarbarians && !data.savedState) {
      for (const row of mapData.tiles) {
        for (const tile of row) {
          if (isBarbarianCamp(tile.buildingId)) {
            tile.buildingId = undefined;
            tile.buildingBroken = undefined;
          }
        }
      }
    }
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

    // Fresh maps finish ordinary seeded resource distribution first, then add
    // enabled-victory resource guarantees. Loaded saves skip both passes.
    initializeWorldNaturalResources(mapData, {
      isLoadedGame: data.savedState !== undefined,
      mapKey: data.mapKey,
      activeNationIds: data.activeNationIds,
      humanNationId: data.humanNationId,
      resourceAbundance,
      cityCoords: activeCities.map((city) => ({ x: city.q, y: city.r })),
      worldSeed: data.worldSeed ?? generateWorldSeed(),
      scienceVictoryEnabled: data.savedState?.victoryConditions?.science
        ?? data.victoryConditions?.science?.enabled
        ?? true,
      requiredAerospaceParts: data.savedState?.victoryConditions?.scienceRequiredAerospaceParts
        ?? data.victoryConditions?.science?.requiredAerospaceParts
        ?? DEFAULT_REQUIRED_AEROSPACE_PARTS,
    });

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
    const scenarioCityById = new Map(activeCities.map((city) => [city.id, city]));
    for (const city of cityManager.getAllCities()) {
      if (!Array.isArray(scenarioCityById.get(city.id)?.ownedTileCoords)) {
        cityTerritorySystem.initializeOwnedTiles(city, mapData, gridSystem);
      }
      culturalSphereSystem.claimInitialCityCulture(city, mapData, gridSystem);
    }

    // 7. Create units from scenario (filtered)
    const unitManager = UnitManager.loadFromScenario(activeUnits, mapData, gameSpeed);
    // Enrich unit events with cityId (used by right-side details refreshes).
    unitManager.setCityLocator((x, y) => cityManager.getCityAt(x, y)?.id);

    // 7b. Give every nation in authored scenarios a starting Scout to accelerate
    // early exploration. Random Scenarios carry their explicitly configured
    // Settler/Scout/Warrior package and must not receive an extra automatic Scout.
    if (!data.savedState && !data.generatedScenario) {
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
    const observedEraByNation = new Map<string, Era>();
    const eraMilestones: EpochEraMilestone[] = [];
    let eraMilestoneBaselineInitialized = false;
    const syncEraMilestoneBaseline = (): void => {
      observedEraByNation.clear();
      for (const nation of nationManager.getAllNations()) {
        observedEraByNation.set(nation.id, eraSystem.getNationEra(nation.id));
      }
      eraMilestoneBaselineInitialized = true;
    };
    const recordEraMilestone = (nationId: string, source: string | null): Era | null => {
      if (!eraMilestoneBaselineInitialized) syncEraMilestoneBaseline();
      const nation = nationManager.getNation(nationId);
      if (!nation) return null;
      const previousEra = observedEraByNation.get(nationId) ?? eraSystem.getNationEra(nationId);
      const newEra = eraSystem.getNationEra(nationId);
      observedEraByNation.set(nationId, newEra);
      if (getEraRank(newEra) <= getEraRank(previousEra)) return null;

      const gameDate = turnManager.getGameDate();
      eraMilestones.push({
        era: newEra,
        nationId: nation.id,
        nationName: nation.name,
        turn: turnManager.getCurrentRound(),
        worldYear: gameDate.signedYear,
        worldYearLabel: turnManager.getGameDateLabel(),
        previousEra,
        newEra,
        source,
      });
      historicalTimeline.record({
        type: 'eraReached',
        icon: '⚙',
        text: `${nation.name} entered the ${newEra} Era`,
        eventNationIds: [nation.id],
        metadata: { eraName: newEra },
      });
      if (this.diagnosticSystem.isTurnLoggingEnabled()) {
        console.log(`[TechEra] ${nation.name} entered ${newEra} Era — turn ${turnManager.getCurrentRound()}`);
      }
      return newEra;
    };

    // World chronicle (History panel). Records major events as they happen and
    // persists with the save. Subscriptions to game events are wired below once
    // the source systems exist.
    const historicalTimeline = new HistoricalTimelineService(
      () => turnManager.getCurrentRound(),
      () => turnManager.getGameDateLabel(),
      (nationId) => nationManager.getNation(nationId)?.name,
      (nationId) => getLeaderByNationId(nationId)?.name,
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
    let aerospacePartSystem: AerospacePartSystem;
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
    const getGamesCultureOutput = (nationId: string): number => (
      nationManager.getResources(nationId).culturePerTurn
    );
    const getGamesProductionSources = (nationId: string) => cityManager.getCitiesByOwner(nationId).map((city) => ({
      cityId: city.id,
      available: Math.floor(
        cityManager.getResources(city.id).productionPerTurn
        * happinessSystem.getProductionModifier(nationId),
      ),
    }));
    let isAutoplayActive = (): boolean => false;
    let presentGamesOfNationsEdition: (event: GamesOfNationsSportResolvedEvent) => void = () => {};
    let victorySystem!: VictorySystem;
    const gamesOfNationsSystem = GamesOfNationsSystem.fromSave({
      getCurrentTurn: () => turnManager.getCurrentRound(),
      getLivingNationIds: () => nationManager.getAllNations().map((nation) => nation.id),
      getNationName: (nationId) => nationManager.getNation(nationId)?.name,
      getCapitalCity: (nationId) => {
        const ownedCities = cityManager.getCitiesByOwner(nationId);
        const capital = cityManager.getResidenceCapital(nationId)
          ?? ownedCities.find((city) => city.isCapital)
          ?? ownedCities[0];
        return capital ? { id: capital.id, name: capital.name } : undefined;
      },
      getCityName: (cityId) => cityManager.getCity(cityId)?.name,
      getCityOwnerId: (cityId) => cityManager.getCity(cityId)?.ownerId,
      hasGrandStadium: (cityId) => cityManager.getBuildings(cityId)?.hasActive(GRAND_STADIUM_BUILDING_ID) === true,
      hasGrandStadiumStructure: (cityId) => cityManager.getBuildings(cityId)?.has(GRAND_STADIUM_BUILDING_ID) === true,
      getHostCityCandidates: (nationId) => cityManager.getCitiesByOwner(nationId).map((city) => ({
        id: city.id,
        name: city.name,
        productionPerTurn: Math.max(0, Math.floor(cityManager.getResources(city.id).productionPerTurn)),
        canConstructGrandStadium: !cityManager.getBuildings(city.id).has(GRAND_STADIUM_BUILDING_ID)
          && buildingPlacementSystem.getValidPlacementCoords(city, GRAND_STADIUM, mapData).length > 0,
        hasGrandStadium: cityManager.getBuildings(city.id).hasActive(GRAND_STADIUM_BUILDING_ID),
      })),
      getWorldDateForTurn: (turn) => ({
        worldYear: turnManager.getGameDateForRound(turn).signedYear,
        yearLabel: turnManager.getGameDateLabelForRound(turn),
      }),
      isHumanNation: (nationId) => nationId === humanNationId,
      isAutoplayActive: () => isAutoplayActive(),
      getCultureOutput: getGamesCultureOutput,
      getProductionSources: getGamesProductionSources,
      getCulturalPriority: (nationId) => {
        const nation = nationManager.getNation(nationId);
        const personalityBias = getLeaderPersonalityByNationId(nationId).cultureBias;
        const agendaBonus = nation?.aiNationalAgendaId === 'culture' ? 0.2 : 0;
        const strategyBonus = nation?.aiStrategyId === 'cultural_dominance' ? 0.2 : 0;
        return Math.max(0, Math.min(1, (personalityBias + 12) / 40 + agendaBonus + strategyBonus));
      },
      getGold: (nationId) => nationManager.getResources(nationId).gold,
      spendGold: (nationId, amount) => {
        const resources = nationManager.getResources(nationId);
        if (!Number.isInteger(amount) || amount < 0 || resources.gold < amount) return false;
        resources.gold -= amount;
        return true;
      },
      getLeaderGamesPreferences: (nationId) => getLeaderByNationId(nationId)?.gamesOfNationsPreferences,
      getWorldEra: () => getHighestEra(nationManager.getAllNations().map((nation) => eraSystem.getNationEra(nation.id))),
      seed: `${data.mapKey}|${[...data.activeNationIds].sort().join(',')}|games-of-nations-v1`,
      log: (message) => logManager.info({ category: 'games-of-nations', message }),
      onGoldMedal: (event) => {
        const winnerName = timelineNationName(event.goldNationId);
        const location = event.hostCityName ? ` in ${event.hostCityName}` : '';
        historicalTimeline.record({
          type: 'gamesGold',
          icon: '🏆',
          text: `${winnerName} wins Gold in ${event.sport} at the Games of Nations${location}.`,
          eventNationIds: [event.goldNationId],
          newsImportance: 5,
          metadata: {
            gamesNumber: event.gamesNumber,
            gamesSport: event.sport,
            gamesWinnerNationId: event.goldNationId,
            gamesHostNationId: event.hostNationId,
            cityId: event.hostCityId,
            cityName: event.hostCityName,
          },
        });
      },
      onGamesCompleted: (event) => {
        const winner = event.medalTable.find((standing) => standing.nationId === event.overallWinnerNationId);
        const leaders = event.medalTable.slice(0, 3).map((standing) => standing.nationId);
        const location = event.hostCityName ? ` in ${event.hostCityName}` : '';
        const runnerUpNames = event.medalTable.slice(1, 3).map((standing) => timelineNationName(standing.nationId));
        const resultText = winner
          ? `${timelineNationName(winner.nationId)} wins the Games with ${winner.gold} Gold, ${winner.silver} Silver and ${winner.bronze} Bronze medal${winner.bronze === 1 ? '' : 's'}${runnerUpNames.length > 0 ? `, ahead of ${runnerUpNames.join(' and ')}` : ''}.`
          : 'No medals were awarded, so there is no overall winner.';
        historicalTimeline.record({
          type: 'gamesCompleted',
          icon: '🏆',
          text: `Games of Nations #${event.gamesNumber} conclude${location}. ${resultText}`,
          eventNationIds: leaders.length > 0 ? leaders : event.hostNationId ? [event.hostNationId] : [],
          newsImportance: 3,
          metadata: {
            gamesNumber: event.gamesNumber,
            gamesWinnerNationId: event.overallWinnerNationId,
            gamesHostNationId: event.hostNationId,
            cityId: event.hostCityId,
            cityName: event.hostCityName,
            gamesGold: winner?.gold,
            gamesSilver: winner?.silver,
            gamesBronze: winner?.bronze,
          },
        });
        if (
          humanNationId
          && event.overallWinnerNationId === humanNationId
          && victorySystem?.getEnabledConditions().cultural
        ) {
          const culturalProgress = victorySystem?.getCulturalVictoryProgress(humanNationId);
          if (!culturalProgress?.normalRequirementsMet) {
            logManager.info({
              nationId: humanNationId,
              category: 'victory',
              message: 'Games of Nations Champion — the path to Cultural Victory is open until the next Games conclude.',
            });
          }
        }
        rightPanel?.requestRefresh();
      },
      onHostingConfirmed: (event) => {
        const hostName = timelineNationName(event.hostNationId);
        const previousHostName = event.previousHostNationId
          ? timelineNationName(event.previousHostNationId)
          : undefined;
        historicalTimeline.record({
          type: 'gamesHostingAnnounced',
          icon: '🏟️',
          text: event.worldCouncilReplacement && previousHostName
            ? `The World Council has transferred hosting rights for Games of Nations #${event.gamesNumber} from ${previousHostName} to ${hostName}. ${event.hostCityName} will now host the Games, with preparations restarted.`
            : event.usedExistingGrandStadium
              ? `${hostName} will host the next Games of Nations in ${event.hostCityName}, reusing the city's existing Grand Stadium.`
              : `${hostName} will host the next Games of Nations in ${event.hostCityName}. The city now faces the task of completing its Grand Stadium before the Games begin.`,
          eventNationIds: event.previousHostNationId
            ? [event.previousHostNationId, event.hostNationId]
            : [event.hostNationId],
          newsImportance: 3,
          metadata: {
            gamesNumber: event.gamesNumber,
            gamesHostNationId: event.hostNationId,
            cityId: event.hostCityId,
            cityName: event.hostCityName,
            scheduledGamesTurn: event.scheduledGamesTurn,
            scheduledGamesYear: turnManager.getGameDateForRound(event.scheduledGamesTurn).signedYear,
          },
        });
      },
      onNationExcluded: (event) => {
        const nationName = timelineNationName(event.excludedNationId);
        historicalTimeline.record({
          type: 'gamesParticipantExcluded',
          icon: '🚫',
          text: `The World Council has voted to exclude ${nationName} from Games of Nations #${event.gamesNumber}. ${event.justification}`,
          eventNationIds: [event.excludedNationId],
          newsImportance: 3,
          metadata: {
            gamesNumber: event.gamesNumber,
            targetNationId: event.excludedNationId,
          },
        });
        if (event.excludedNationId === humanNationId) {
          const notice = `Excluded from Games of Nations #${event.gamesNumber}\n\nThe World Council has prohibited your nation from competing. All future Culture and Production commitments have been cancelled. Resources already invested will not be returned.`;
          logManager.info({
            nationId: event.excludedNationId,
            category: 'games-of-nations',
            message: `Excluded from Games of Nations #${event.gamesNumber}. Future Culture and Production commitments are cancelled; previously invested resources will not be returned.`,
          });
          if (!isAutoplayActive() && typeof window !== 'undefined') window.alert(notice);
        }
        rightPanel?.requestRefresh();
      },
      onGamesCancelled: (event) => {
        const location = event.hostCityName ? ` in ${event.hostCityName}` : '';
        historicalTimeline.record({
          type: 'gamesCancelled',
          icon: '🏟️',
          text: `The Games of Nations${location} have been cancelled. ${event.reason}.`,
          eventNationIds: event.hostNationId ? [event.hostNationId] : [],
          newsImportance: 3,
          metadata: {
            gamesNumber: event.gamesNumber,
            gamesHostNationId: event.hostNationId,
            cityId: event.hostCityId,
            cityName: event.hostCityName,
            gamesCancellationReason: event.reason,
          },
        });
        rightPanel?.requestRefresh();
      },
      onSportIntroduced: (event) => {
        historicalTimeline.record({
          type: 'gamesSportIntroduced',
          icon: '🏅',
          text: `${timelineNationName(event.introducingNationId)} has introduced ${event.sport} to the Games of Nations after winning an international bidding contest. The sport will debut in Games #${event.introducedForGamesNumber}.`,
          eventNationIds: [event.introducingNationId],
          newsImportance: 4,
          metadata: {
            gamesNumber: event.introducedForGamesNumber,
            gamesSport: event.sport,
            gamesSportId: event.sportId,
            gamesIntroducingNationId: event.introducingNationId,
            gamesWinningBid: event.winningBid,
            eraName: event.era,
          },
        });
        hudLayer?.refresh();
        rightPanel?.requestRefresh();
      },
      onSportResolved: (event) => presentGamesOfNationsEdition(event),
    }, data.savedState?.gamesOfNations, data.savedState?.turn.currentRound ?? 1);
    turnManager.on('roundStart', (event) => gamesOfNationsSystem.handleRoundStart(event.round));
    const cultureSystem = new CultureSystem(
      nationManager,
      () => turnManager.getCurrentRound(),
      (nationId) => Math.max(
        0,
        nationManager.getResources(nationId).culturePerTurn
          - gamesOfNationsSystem.getCultureDiversionForTurn(nationId, turnManager.getCurrentRound()),
      ),
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
    turnManager.on('turnStart', (event) => {
      gamesOfNationsSystem.processNationPreparationTurn(event.nation.id, event.round);
    });
    const cityIntegrationSystem = new CityIntegrationSystem(
      cityManager,
      turnManager,
      (nationId, message) => logManager.info({ nationId, category: 'city', message }),
      (city) => resourceSystem.recalculateForNation(city.ownerId),
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
    productionSystem.setProductionDiversionProvider((nationId, cityId) => (
      gamesOfNationsSystem.getProductionDiversionForTurn(
        nationId,
        cityId,
        turnManager.getCurrentRound(),
      )
    ));
    const productionPurchaseSystem = new ProductionPurchaseSystem(
      cityManager,
      nationManager,
      productionSystem,
      resourceSystem,
      () => turnManager.getCurrentRound(),
    );
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
    let getGossipMilitaryPower: (nationId: string) => number = () => 0;
    const gossipSystem = new GossipSystem(
      nationManager,
      diplomacyManager,
      resourceSystem,
      () => turnManager.getCurrentRound(),
      {
        hasMet: (observerNationId, otherNationId) => discoverySystem.hasMet(observerNationId, otherNationId),
        isGamesOfNationsFounded: () => gamesOfNationsSystem.getSummary().founded,
      },
      (nationId) => eraSystem.getNationEra(nationId),
      (nationId) => getGossipMilitaryPower(nationId),
    );
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
    // Multilateral Aggression Memory: third-party nations gain diplomatic memory
    // of wars and conquests they witness. Uses the existing contact model
    // (DiscoverySystem) and city-ownership survival condition — no new
    // information-propagation system.
    diplomaticMemorySystem.setMultilateralAggressionContext({
      getAllNationIds: () => nationManager.getAllNations().map((nation) => nation.id),
      haveMet: (a, b) => discoverySystem.hasMet(a, b),
      isNationActive: (nationId) => cityManager.getCitiesByOwner(nationId).length > 0,
    });
    turnManager.on('roundStart', (event) => {
      diplomaticMemorySystem.decayObserverAggressionMemory(event.round);
    });
    // Tracks one-time symbolic-gift milestones (player's gift reward + the AI's
    // reciprocal first-meeting courtesy) per nation pair.
    const symbolicGiftRegistry = new SymbolicGiftRegistry();
    const allianceManager = new AllianceManager();
    // Alliance partners cannot declare war on each other (central rule).
    diplomacyManager.setAllianceGuard((a, b) => allianceManager.areAllied(a, b));
    const tradeDiplomacySystem = new TradeDiplomacySystem(diplomacyManager);
    const diplomaticEvaluationSystem = new DiplomaticEvaluationSystem(
      diplomacyManager,
      (id) => nationManager.getCovertPersonality(id),
    );
    const ideologicalDriftSystem = new IdeologicalDriftSystem(
      diplomacyManager,
      nationManager,
      (a, b) => discoverySystem.hasMet(a, b),
    );
    const aiMilitaryEvaluationSystem = new AIMilitaryEvaluationSystem(unitManager, cityManager, allianceManager, diplomacyManager);
    getGossipMilitaryPower = (nationId) => aiMilitaryEvaluationSystem.getMilitaryStrength(nationId).totalStrength;
    const gossipFlavorEventSystem = new GossipFlavorEventSystem({
      nationManager,
      diplomacyManager,
      historicalTimeline,
      getRound: () => turnManager.getCurrentRound(),
      getMilitaryPower: (nationId) => aiMilitaryEvaluationSystem.getMilitaryStrength(nationId).totalStrength,
      isNationActive: (nationId) => cityManager.getCitiesByOwner(nationId).length > 0,
      // Save files do not currently persist worldSeed. Use stable session
      // identity fields so flavor rolls remain identical after save/load.
      randomSeed: `${data.mapKey}|${data.humanNationId}|${[...data.activeNationIds].sort().join(',')}|gossip-flavor-v1`,
      logGenerated: (result) => logManager.info({
        nationIds: [result.speakerNationId, result.recipientNationId],
        category: 'diplomacy',
        message: `[GossipFlavor] round=${result.round} trigger=${result.trigger} speaker=${result.speakerNationId} recipient=${result.recipientNationId} insult=${result.insultId} weight=${result.insultWeight} recipientHuman=${result.recipientIsHuman}${result.cityName ? ` city=${result.cityName}` : ''}`,
      }),
    });
    turnManager.on('roundStart', (event) => gossipFlavorEventSystem.handlePeriodicRound(event.round));
    turnManager.on('roundStart', () => aiMilitaryEvaluationSystem.invalidate());
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
      getUnitProductionRestrictionReason: undefined as ((nationId: string, unitTypeId: string) => string | undefined) | undefined,
    };
    tradeDealSystem.setCanExportResource((sellerNationId, resourceId) =>
      resourceAccessSystem.canExportResource(sellerNationId, resourceId),
    );
    const getTradeResourceCategory = (resourceId: string) =>
      getNaturalResourceById(resourceId)?.category
      ?? (getResourceDefinitionById(resourceId)?.category === 'manufactured' ? 'manufactured' : 'unknown');
    const worldCouncilResolutionSystem = new WorldCouncilResolutionSystem();
    const worldCouncilSystem = new WorldCouncilSystem(
      nationManager,
      cityManager,
      resourceSystem,
      worldCouncilResolutionSystem,
      discoverySystem,
      (nationId, message) => logManager.info({ nationId, category: 'diplomacy', message }),
    );
    aiMilitaryEvaluationSystem.setPeacekeepingDefensivePowerProvider((attackerNationId, defenderNationId, getMilitaryStrength) =>
      worldCouncilSystem.getPeacekeepingDefensivePowerAgainst(
        attackerNationId,
        defenderNationId,
        (nationId) => getMilitaryStrength(nationId).totalStrength,
      ));
    foreignTroopViolationSystem.setForeignTroopAuthorizationProvider((unit, territoryOwnerId) =>
      worldCouncilSystem.canPeacekeeperEnterTerritory(
        unit.ownerId,
        territoryOwnerId,
        Math.max(unit.unitType.baseStrength, unit.unitType.rangedStrength ?? 0) > 0,
      ));
    unitProductionRuleContext.getUnitProductionRestrictionReason = (nationId, unitTypeId) =>
      worldCouncilSystem.getUnitProductionRestrictionReason(nationId, unitTypeId);
    turnManager.on('turnStart', (event) => worldCouncilSystem.handleTurnStart(event));
    tradeDealSystem.setRestrictionProvider((input) =>
      worldCouncilSystem.getTradeRestrictionReason(
        input.sellerNationId,
        input.buyerNationId,
        getTradeResourceCategory(input.resourceId),
      ));
    tradeConnectionSystem.setRestrictionProvider((a, b) =>
      worldCouncilSystem.getTradeRestrictionReason(a, b, 'unknown'));
    tradeDealSystem.setConnectionCapacityProvider((a, b) =>
      tradeConnectionSystem.getActiveDealCapacityBetweenNations(a, b)
      + worldCouncilSystem.getTradeAgreementCapacityBetweenNations(a, b),
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
        .reduce((sum, city) => sum + Math.round(calculateCityEconomy(
          city,
          mapData,
          cityManager.getBuildings(city.id),
          gridSystem,
          wonderSystem.getNationModifiers(nationId),
        ).science * getCityIntegrationOutputMultiplier(city, turnManager.getCurrentRound())), 0),
      gameSpeed,
      undefined,
      (nationId, message) => logManager.info({ nationId, category: 'research', message }),
      (city) => getCityIntegrationOutputMultiplier(city, turnManager.getCurrentRound()),
      () => turnManager.getGlobalYear(),
    );
    // Culture-gated units (e.g. Rebels → Nationalism) are unlocked via the
    // culture tree rather than a technology; route that check through the shared
    // unit-availability gate so human and AI production both respect it.
    researchSystem.setCultureUnitUnlockResolver((nationId, unitId) =>
      cultureSystem.isUnitCultureUnlocked(nationId, unitId),
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
    const currencySystem = new CurrencySystem(
      nationManager,
      researchSystem,
      {
        getGoldIncome: (nationId) => (
          nationManager.getResources(nationId).goldPerTurn
          - unitUpkeepSystem.calculateUpkeep(nationId)
        ),
        getActiveTradePartnerIds: (nationId) => getActiveInternationalTradePartnerIds(
          nationId,
          tradeDealSystem,
        ),
        getCorporationCount: (nationId) => corporationSystem?.getCorporationsForNation(nationId).length ?? 0,
        getActiveBankCount: (nationId) => countActiveBanksForNation(
          nationId,
          cityManager,
          turnManager.getCurrentRound(),
        ),
      },
      (message) => logManager.info({ category: 'currency', message }),
    );
    researchSystem.onCompleted((event) => {
      if (event.technologyId === 'currency') {
        currencySystem.activateCurrency(event.nationId, turnManager.getCurrentRound());
      }
    });
    turnManager.on('roundStart', (event) => currencySystem.handleRoundStart(event.round));
    aerospacePartSystem = new AerospacePartSystem(
      cityManager,
      researchSystem,
      resourceAccessSystem,
      corporationSystem,
      productionSystem,
    );
    resourceAccessSystem.setManufacturedResourceProvider((nationId) => {
      const resources = new Map(corporationSystem?.getNationManufacturedResources(nationId) ?? []);
      for (const [resourceId, quantity] of aerospacePartSystem.getManufacturedResources(nationId)) {
        resources.set(resourceId, (resources.get(resourceId) ?? 0) + quantity);
      }
      return resources;
    });
    productionSystem.setItemProductionPercentProvider((nationId, item) => (
      item.kind === 'manufacturedResource' && item.productionType.id === AEROSPACE_PARTS_ID
        ? aerospacePartSystem.getProductionBonusPercent(nationId)
        : 0
    ));
    productionSystem.setItemProductionCostProvider((cityId, item, baseCost) => {
      if (item.kind !== 'manufacturedResource' || item.productionType.id !== AEROSPACE_PARTS_ID) {
        return baseCost;
      }
      const city = cityManager.getCity(cityId);
      return city
        ? { cost: aerospacePartSystem.getProductionCost(city.ownerId), lock: true }
        : baseCost;
    });
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
    const buildWonderCompletionPopupData = (state: WonderState, wonderType: WonderType): DiscoveryPopupData => {
      const nationName = timelineNationName(state.ownerId);
      const cityName = cityManager.getCity(state.cityId)?.name ?? 'an unknown city';
      return {
        title: wonderType.name,
        subtitle: `${nationName} has completed the ${wonderType.name} in ${cityName}.`,
        imageKey: getWonderSpriteKey(wonderType.id),
        imagePath: getWonderSpritePath(wonderType.id),
        description: wonderType.description,
        unlockRows: [],
        leadsToRows: [],
        hideProgression: true,
      };
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
    // Broken buildings/wonders render faded + with a ⚠️ marker. Improvements,
    // units and cities are never treated as broken.
    tileBuildingRenderer.setBrokenPredicate((tileX, tileY) => {
      const tile = mapData.tiles[tileY]?.[tileX];
      if (!tile) return false;
      if (tile.wonderId !== undefined) return wonderSystem.isWonderBroken(tile.wonderId);
      if (tile.buildingId !== undefined) {
        // Standalone tile structures (e.g. razed Barbarian Camps) track broken
        // state on the tile itself; city buildings track it in CityBuildings.
        if (tile.buildingBroken) return true;
        const owningCity = cityManager.getAllCities().find((candidate) =>
          candidate.ownedTileCoords.some((coord) => coord.x === tileX && coord.y === tileY),
        );
        return owningCity !== undefined
          && cityManager.getBuildings(owningCity.id).isBroken(tile.buildingId);
      }
      return false;
    });
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
      (a: string, b: string) => discoverySystem.hasMet(a, b),
      (nationId: string) => getAvailableLuxuryResourceQuantities(nationId).map((entry) => entry.resourceId),
    );
    const cityDefenseSystem = new CityDefenseSystem(wonderSystem, cityManager);
    cityDefenseSystem.setWorldHeritageProtectionActive(worldCouncilSystem.hasWorldHeritageProtection());
    worldCouncilResolutionSystem.setRuntime({
      getDiplomacyState: (a, b) => diplomacyManager.getState(a, b),
      getRelationMemory: (a, b) => {
        const relation = diplomacyManager.getRelation(a, b);
        return {
          trust: relation.trust,
          fear: relation.fear,
          hostility: relation.hostility,
          affinity: relation.affinity,
          suspicion: relation.suspicion,
        };
      },
      areAllied: (a, b) => allianceManager.areAllied(a, b),
      hasOpenBorders: (a, b) =>
        diplomacyManager.isOpenBorderGrantedFrom(a, b) || diplomacyManager.isOpenBorderGrantedFrom(b, a),
      hasTradeRelations: (a, b) => diplomacyManager.hasTradeRelations(a, b),
      getActiveTradeGoldPerTurnBetween: (a, b) =>
        tradeDealSystem.getDealsBetween(a, b).reduce((sum, deal) => sum + deal.goldPerTurn, 0),
      getLeaderPersonality: (nationId) => getLeaderPersonalityByNationId(nationId),
      getIdeologyId: (nationId) => getLeaderByNationId(nationId)?.ideologyId,
      getMilitaryStrength: (nationId) => aiMilitaryEvaluationSystem.getMilitaryStrength(nationId).totalStrength,
      getAllNationIds: () => nationManager.getAllNations().map((nation) => nation.id),
      isNationActive: (nationId) => aiMilitaryEvaluationSystem.isNationActive(nationId),
      getGamesOfNationsHostingContext: () => gamesOfNationsSystem.getUpcomingHostingContext(),
      canNationTakeOverGamesHosting: (nationId) => gamesOfNationsSystem.canNationTakeOverHosting(nationId),
      replaceGamesOfNationsHost: (nationId) => gamesOfNationsSystem.replaceUpcomingHostFromWorldCouncil(nationId),
      getGamesOfNationsParticipationContext: () => gamesOfNationsSystem.getUpcomingParticipationContext(),
      getGamesOfNationsCompetitionStrength: (nationId) => {
        const summary = gamesOfNationsSystem.getSummary();
        return Object.values(summary.effectiveGamesPointsByNation[nationId] ?? {})
          .reduce((sum, value) => sum + value, 0);
      },
      excludeGamesOfNationsParticipant: (nationId, justification) =>
        gamesOfNationsSystem.excludeNationFromUpcomingGames(nationId, justification),
      requestHumanGamesExclusionTarget: (input) => {
        if (isAutoplayActive() || typeof window === 'undefined') return null;
        const options = input.eligibleTargetNationIds.map((nationId, index) =>
          `${index + 1}. ${nationManager.getNation(nationId)?.name ?? nationId}`);
        const answer = window.prompt(
          `Select a nation to exclude from Games of Nations #${input.gamesNumber}:\n\n${options.join('\n')}`,
          '1',
        );
        if (answer === null) return null;
        const index = Number.parseInt(answer, 10) - 1;
        return input.eligibleTargetNationIds[index] ?? null;
      },
      getAggressorNationId: (a, b) => diplomacyManager.getAggressorNationId(a, b),
      hasActivePeacekeepingMissionForHost: (hostNationId) =>
        worldCouncilSystem.hasActivePeacekeepingMissionForHost(hostNationId),
      getAvailableInfluence: (nationId) => nationManager.getResources(nationId).influence,
      spendInfluence: (nationId, amount) => resourceSystem.spendInfluence(nationId, amount),
      isHumanNation: (nationId) => nationManager.getNation(nationId)?.isHuman === true,
      requestHumanInfluenceVote: (input) => {
        if (isAutoplayActive() || nationManager.getNation(input.nationId)?.isHuman !== true) return null;
        if (typeof window === 'undefined') return null;
        const definition = worldCouncilResolutionSystem.getDefinition(input.proposal.resolutionId);
        const title = definition?.title ?? input.proposal.resolutionId;
        const targetName = input.targetNationId
          ? nationManager.getNation(input.targetNationId)?.name ?? input.targetNationId
          : undefined;
        const secondaryTargetName = input.secondaryTargetNationId
          ? nationManager.getNation(input.secondaryTargetNationId)?.name ?? input.secondaryTargetNationId
          : undefined;
        const targetText = targetName && secondaryTargetName
          ? ` targeting ${targetName} - ${secondaryTargetName}`
          : targetName
            ? ` targeting ${targetName}`
            : '';
        const support = window.confirm(
          `${title}${targetText}\n\nChoose OK to vote YES, or Cancel to vote NO.`,
        );
        const rawAmount = window.prompt(
          `Spend Influence on this vote (available: ${Math.floor(input.maxInfluence)}).`,
          String(Math.min(Math.floor(input.maxInfluence), input.suggestedInfluence)),
        );
        if (rawAmount === null) {
          return { support, influence: input.suggestedInfluence };
        }
        const influence = Math.max(0, Math.min(Math.floor(input.maxInfluence), Number.parseInt(rawAmount, 10) || 0));
        return { support, influence };
      },
      shareMaps: (memberNationIds) => {
        const humanMember = memberNationIds.includes(humanNationIdForDiplomacy);
        if (humanMember) {
          for (const nationId of memberNationIds) {
            if (nationId === humanNationIdForDiplomacy) continue;
            for (const city of cityManager.getCitiesByOwner(nationId)) {
              visibilitySystem.discoverCity(city);
            }
          }
          updateFog();
        }
        for (let i = 0; i < memberNationIds.length; i += 1) {
          for (let j = i + 1; j < memberNationIds.length; j += 1) {
            diplomacyManager.recordMapExchange(memberNationIds[i]!, memberNationIds[j]!);
          }
        }
      },
      setWorldHeritageProtection: (active) => {
        cityDefenseSystem.setWorldHeritageProtectionActive(active);
      },
      condemnAggressiveWar: (targetNationId, memberNationIds) => {
        for (const memberNationId of memberNationIds) {
          diplomacyManager.recordWorldCouncilCondemnation(memberNationId, targetNationId);
        }
      },
      applyTradeRestrictions: (resolutionId, targetNationId) => {
        tradeDealSystem.cancelDealsMatching((deal) => {
          if (deal.sellerNationId !== targetNationId && deal.buyerNationId !== targetNationId) return false;
          return worldCouncilSystem.getTradeRestrictionReason(
            deal.sellerNationId,
            deal.buyerNationId,
            getTradeResourceCategory(deal.resourceId),
          ) !== undefined;
        }, 'sanctions');
        if (resolutionId === 'international_embargo') {
          for (const nation of nationManager.getAllNations()) {
            if (nation.id === targetNationId) continue;
            tradeConnectionSystem.cancelConnectionsBetweenNations(targetNationId, nation.id);
          }
        }
      },
      enforceCeasefire: (nationAId, nationBId, durationTurns) => {
        const enforced = diplomacyManager.enforceCeasefire(nationAId, nationBId, durationTurns, turnManager.getCurrentRound());
        if (!enforced) return false;
        const nameA = nationManager.getNation(nationAId)?.name ?? nationAId;
        const nameB = nationManager.getNation(nationBId)?.name ?? nationBId;
        logManager.info({
          nationIds: [nationAId, nationBId],
          category: 'diplomacy',
          message: `United Nations enforced a ceasefire between ${nameA} and ${nameB} for ${durationTurns} turns.`,
        });
        return true;
      },
      getTreasury: (nationId) => nationManager.getResources(nationId).gold,
      getGoldPerTurn: (nationId) => nationManager.getResources(nationId).goldPerTurn,
      getNationName: (nationId) => nationManager.getNation(nationId)?.name ?? nationId,
      isAtWarWithAnyone: (nationId) => nationManager.getAllNations()
        .some((nation) => nation.id !== nationId && diplomacyManager.getState(nationId, nation.id) === 'WAR'),
      transferGold: (fromNationId, toNationId, amount) => {
        const gold = Math.max(0, Math.floor(amount));
        if (gold <= 0) return false;
        if (nationManager.getResources(fromNationId).gold < gold) return false;
        resourceSystem.addGold(fromNationId, -gold);
        resourceSystem.addGold(toNationId, gold);
        return true;
      },
      recordGoldGift: (fromNationId, toNationId, amount) => {
        diplomacyManager.recordGoldGift(fromNationId, toNationId, amount);
      },
      awardGoldContributionDiplomacyScore: (nationId, gold) => {
        worldCouncilSystem.awardGoldContributionDiplomacyScore(nationId, gold);
      },
      requestHumanGoldDonation: (input) => {
        if (isAutoplayActive() || nationManager.getNation(input.nationId)?.isHuman !== true) return null;
        if (typeof window === 'undefined') return null;
        const recipientName = nationManager.getNation(input.recipientNationId)?.name ?? input.recipientNationId;
        const aggressorName = nationManager.getNation(input.aggressorNationId)?.name ?? input.aggressorNationId;
        const rawAmount = window.prompt(
          `${recipientName} requested Defense Support after being attacked by ${aggressorName}.\n\nDonate Gold (available: ${Math.floor(input.maxGold)}).`,
          String(Math.min(Math.floor(input.maxGold), input.suggestedGold)),
        );
        if (rawAmount === null) return 0;
        return Math.max(0, Math.min(Math.floor(input.maxGold), Number.parseInt(rawAmount, 10) || 0));
      },
    });

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
      cityIntegrationSystem,
    );
    peaceTreatySystem.setNationCollapseSystem(nationCollapseSystem);
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
      (attacker, target, tileOwnerId) =>
        worldCouncilSystem.canResolvePeacekeepingCombat(attacker.ownerId, target.ownerId, tileOwnerId),
      cityDefenseSystem,
      nationCollapseSystem,
      cityIntegrationSystem,
      (nationId, message) => logManager.info({ nationId, category: 'city', message }),
    );
    const politicalCapitalSystem = new PoliticalCapitalSystem(
      cityManager,
      nationManager,
      turnManager,
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
    const infrastructureSabotageSystem = new InfrastructureSabotageSystem(
      mapData,
      cityManager,
      wonderSystem,
      nationManager,
      ({ nationId, message }) => logManager.info({ nationId, category: 'unit', message }),
    );
    unitActionToolbox.setSabotageAvailabilityProvider(infrastructureSabotageSystem);

    // Covert actions (spying, sabotage, partisan/rebel/privateer raids) generate
    // Suspicion on the victim via a simple deterministic detection model. Player
    // log hides the attacker unless exposed; the [DEBUG] log carries full info for
    // autorun balancing. Wired into combat + sabotage; restored from save below.
    const covertSuspicionSystem = new CovertSuspicionSystem(
      diplomacyManager,
      turnManager,
      (id) => nationManager.getNation(id)?.name ?? id,
      (nationId, message) => logManager.info({ nationId, category: 'diplomacy', message }),
      (message) => console.log(`[autorun] ${message}`),
      (id) => nationManager.getCovertPersonality(id),
    );
    combatSystem.setCovertSuspicionSystem(covertSuspicionSystem);
    infrastructureSabotageSystem.setCovertSuspicionSystem(covertSuspicionSystem);
    const infrastructureRepairSystem = new InfrastructureRepairSystem(
      mapData,
      cityManager,
      wonderSystem,
      nationManager,
      ({ nationId, message }) => logManager.info({ nationId, category: 'unit', message }),
    );
    unitActionToolbox.setRepairAvailabilityProvider(infrastructureRepairSystem);
    // Intel (Spy/Agent) is available only while standing on a foreign city center.
    const intelReportDialog = new IntelReportDialog();
    const canGatherIntelHere = (unit: Unit): boolean => {
      if (unit.unitType.canGatherIntel !== true) return false;
      const city = cityManager.getCityAt(unit.tileX, unit.tileY);
      return city !== undefined && city.ownerId !== unit.ownerId;
    };
    unitActionToolbox.setIntelAvailabilityProvider({ canGatherIntel: canGatherIntelHere });
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
      // Covert operatives (Spy/Agent) engage only hostile covert operatives, which
      // getUnitAt excludes — so detect them explicitly.
      const hasCovertTarget = isCovertOperative(unit.unitType)
        && unitManager.getCovertOperativesAt(targetTile.x, targetTile.y)
          .some((other) => other.ownerId !== unit.ownerId);
      const hasEnemyTarget =
        hasCovertTarget ||
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
        // Insurgents are relocation-only for the player: never initiate combat
        // manually. Returning false routes to the default movement (relocation),
        // and autonomy resumes from the new position.
        if (unit.unitType.isInsurgentForce === true) return false;
        // Covert operatives (Spy/Agent) coexist with other units: relocate onto
        // any tile (including garrisoned foreign cities). The only combat they
        // initiate is against a hostile covert operative occupying the target.
        if (isCovertOperative(unit.unitType)) {
          const hasCovertDefender = unitManager.getCovertOperativesAt(tile.x, tile.y)
            .some((other) => other.ownerId !== unit.ownerId);
          return hasCovertDefender ? tryActionAttack(unit, tile) : false;
        }
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
    const getDebarkOption = (transport: Unit): {
      cargo?: Unit;
      target?: { x: number; y: number };
      reason?: string;
    } => {
      const cargoUnits = unitBoardingManager.getCargo(transport);
      if (cargoUnits.length === 0) return { reason: 'No cargo onboard.' };

      for (const cargo of cargoUnits) {
        for (const coord of gridSystem.getAdjacentCoords({ x: transport.tileX, y: transport.tileY })) {
          const tile = mapData.tiles[coord.y]?.[coord.x];
          if (!tile || isWaterTile(tile)) continue;
          if (unitBoardingManager.canUnboard(cargo, coord.x, coord.y)) {
            return { cargo, target: coord };
          }
        }
      }

      return { cargo: cargoUnits[0], reason: 'No adjacent valid tile to debark.' };
    };
    unitActionToolbox.setDebarkAvailabilityProvider({
      getDebarkPreview: (unit) => {
        const option = getDebarkOption(unit);
        return option.cargo && option.target
          ? { canDebark: true }
          : { canDebark: false, reason: option.reason ?? 'Cannot debark cargo here.' };
      },
    });

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
      (unit, territoryOwnerId) =>
        worldCouncilSystem.canPeacekeeperEnterTerritory(
          unit.ownerId,
          territoryOwnerId,
          Math.max(unit.unitType.baseStrength, unit.unitType.rangedStrength ?? 0) > 0,
        ),
      unitBoardingManager,
    );

    // Neutral barbarian faction: drives the units spawned by scenario-authored
    // Barbarian Camps, once per round (runRound) rather than via the participant
    // turn order. Camps themselves are NEVER generated by the game — they exist
    // only where a scenario author placed them in the Editor (tile.buildingId).
    nationManager.ensureBarbarianNation();
    const barbarianSystem = new BarbarianSystem(
      mapData,
      gridSystem,
      unitManager,
      cityManager,
      nationManager,
      turnManager,
      movementSystem,
      pathfindingSystem,
      combatSystem,
      (message) => logManager.info({ nationId: 'nation_barbarian', category: 'unit', message }),
      resolveBarbarianSpawnInterval(scenarioJson.meta?.barbarianSpawnInterval),
    );
    // Advance barbarians each round (spawn from existing camps, then move/attack).
    turnManager.on('roundStart', () => {
      barbarianSystem.runRound();
      tileBuildingRenderer.rebuildAll();
    });

    // AI covert mission execution: Spies (espionage), Agents (sabotage), and
    // Privateers (maritime economic raiding) act per personality, reusing
    // pathfinding/combat/sabotage and the covert-suspicion consequences. Driven
    // before the main AI pass each AI turn. Rebels/Partisans stay on
    // InsurgentBehaviorSystem above.
    const aiCovertOperationsSystem = new AICovertOperationsSystem(
      mapData,
      gridSystem,
      unitManager,
      cityManager,
      nationManager,
      movementSystem,
      pathfindingSystem,
      combatSystem,
      infrastructureSabotageSystem,
      covertSuspicionSystem,
      diplomacyManager,
      (nationId, message) => logManager.info({ nationId, category: 'ai', message }),
    );

    // Insurgent forces (Rebels, Partisans) act autonomously at the start of each
    // nation's turn — human- and AI-owned alike. The owner relocates them; they
    // choose how they fight. (AISystem.runMovement skips insurgents so there is
    // exactly one autonomy pass per unit per turn.)
    const insurgentBehaviorSystem = new InsurgentBehaviorSystem(
      unitManager,
      cityManager,
      gridSystem,
      pathfindingSystem,
      movementSystem,
      combatSystem,
    );
    turnManager.on('turnStart', (e) => insurgentBehaviorSystem.runForNation(e.nation.id));

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

    // 17. Victory system. A loaded save carries its own victory rules, which take
    // precedence over the start-up config so continuing a game preserves them.
    // Older saves without the field fall back to VictorySystem defaults (all on).
    const savedVictoryConditions = data.savedState?.victoryConditions;
    const effectiveVictoryConditions = savedVictoryConditions
      ? {
        domination: { enabled: savedVictoryConditions.domination },
        science: {
          ...data.victoryConditions?.science,
          enabled: savedVictoryConditions.science,
          requiredAerospaceParts: savedVictoryConditions.scienceRequiredAerospaceParts
            ?? data.victoryConditions?.science?.requiredAerospaceParts,
        },
        cultural: { enabled: savedVictoryConditions.cultural },
        diplomatic: { enabled: savedVictoryConditions.diplomatic ?? true },
      }
      : data.victoryConditions ?? {};
    victorySystem = new VictorySystem(
      cityManager,
      nationManager,
      turnManager,
      resourceAccessSystem,
      effectiveVictoryConditions,
      (nationId, message) => logManager.info({ nationId, category: 'victory', message }),
      researchSystem,
      corporationSystem,
      wonderSystem,
      worldCouncilSystem,
      currencySystem,
      gamesOfNationsSystem,
    );

    // 18. Stadsgrundningssystem
    foundCitySystem = new FoundCitySystem(
      unitManager, cityManager, nationManager, turnManager,
      territoryRenderer, cityRenderer, resourceSystem, mapData,
      gridSystem,
    );

    // Log city founded and re-scan discovery (new city may trigger encounters).
    foundCitySystem.onCityFounded((city) => {
      aiMilitaryEvaluationSystem.invalidate(city.ownerId);
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
      aiExplorationSystem,
      corporationSystem,
      victorySystem.getEnabledConditions().science,
      aerospacePartSystem,
      victorySystem.getScienceVictorySettings().requiredAerospaceParts,
      productionPurchaseSystem,
      gamesOfNationsSystem,
    );
    aiSystem.setCultureSystem(cultureSystem);
    const aiPolicySystem = new AIPolicySystem(policySystem, nationManager, happinessSystem);

    const runAutoplayNationTurn = (nation: Nation): void => {
      discoverySystem.scan();

      aiDiplomacySystem.runTurn(nation.id);
      maybeProposeAIJointWar(nation.id);
      // Clear nearby Barbarian Camps before the main AI pass spends movement.
      barbarianSystem.runAICampClearingForNation(nation.id, infrastructureSabotageSystem);
      // Covert operatives / privateers act before the main military movement pass.
      aiCovertOperationsSystem.runForNation(nation.id);
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

    const newspaperSystem = NewspaperSystem.fromSave({
      humanNationId: data.humanNationId,
      getTimelineEvents: () => historicalTimeline.getEvents(),
      getDominationRanking: () => buildDominationRanking(
        nationManager.getAllNations(),
        cityManager.getAllCities().filter((city) => city.isCapital),
        (nationId) => aiMilitaryEvaluationSystem.getMilitaryStrength(nationId).totalStrength,
      ).map((entry) => entry.nationId),
      getNationName: (nationId) => nationManager.getNation(nationId)?.name,
      getLeaderName: (nationId) => getLeaderByNationId(nationId)?.name,
      seed: `${data.mapKey}|${data.humanNationId}|${[...data.activeNationIds].sort().join(',')}|newspaper-v1`,
    }, data.savedState?.newspaper, data.savedState?.turn.currentRound ?? 1);
    const newspaperDialog = new NewspaperDialog();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => newspaperDialog.shutdown());
    presentGamesOfNationsEdition = (event) => {
      const issue = buildGamesOfNationsEdition({
        event,
        dateLabel: turnManager.getGameDateLabel(),
        worldYear: turnManager.getGlobalYear(),
        getNationName: (nationId) => nationManager.getNation(nationId)?.name,
        seed: `${data.mapKey}|${data.humanNationId}|games-chronicle-v1`,
      });
      if (this.diagnosticSystem.isTurnLoggingEnabled()) {
        console.log(`[GamesChronicle] Games #${event.gamesNumber} Day ${event.competitionDay}: ${issue.mainArticle.headline}`);
      }
      if (autoplaySystem.isActive() || this.diagnosticSystem.isTurnLoggingEnabled()) return;
      newspaperDialog.present(issue);
    };

    turnManager.on('turnStart', (event) => {
      if (event.nation.id !== humanNationId) return;
      const issue = newspaperSystem.consumeDueIssue(
        event.round,
        turnManager.getGameDateLabel(),
        autoplaySystem.isActive() || this.diagnosticSystem.isTurnLoggingEnabled(),
        turnManager.getGlobalYear(),
      );
      if (issue) newspaperDialog.present(issue);
    });

    const combatAnimationSystem = new CombatAnimationSystem(this, tileMap, unitRenderer, autoplaySystem);

    aiExplorationSystem.onIslandDiscovered((e) => {
      historicalTimeline.record({
        type: 'majorDiscovery',
        icon: '🧭',
        text: `${timelineNationName(e.nationId)} discovered ${e.markerName}`,
        eventNationIds: [e.nationId],
        metadata: { discoveryName: e.markerName },
      });
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
    autoplaySystem.onStarted(() => gamesOfNationsSystem.handleAutoplayStarted());

    autoplaySystem.onStarted(() => {
      if (!autoplaySystem.isVisualSuppressionEnabled()) return;
      SetupMusicManager.getShared().muteForSession();
      const originalConsoleLog = console.log;
      // Autoplay silences console.log to keep long headless runs quiet, but a
      // few prefixes are diagnostics the autorun pipeline exists to collect.
      // Suppressing those makes the run unobservable rather than merely quiet.
      const autoplayLogAllowList = ['[autorun]', '[TechEra]', '[EmergencyDefense]', '[Diplomacy]', '[AggressionMemory]', '[ScienceVictoryAI]'];
      console.log = (...args: unknown[]) => {
        const first = args[0];
        // Matched anywhere in the line, not just at the start: several systems
        // route diagnostics through a formatter that prefixes turn/nation
        // context ahead of the tag (see AISystem.logScienceVictoryAI).
        if (typeof first === 'string' && autoplayLogAllowList.some((tag) => first.includes(tag))) {
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
      if (!e.nation.isHuman) {
        const foundingCandidate = getWorldCouncilFoundingCandidate();
        if (foundingCandidate?.wonder.ownerId === e.nation.id) {
          foundWorldCouncil(e.nation.id, {
            gold: Math.floor(nationManager.getResources(e.nation.id).gold * 0.15),
            sciencePercent: 10,
            culturePercent: 10,
          });
        }
      }

      if (autoplaySystem.isActive()) return;

      if (!e.nation.isHuman) {
        discoverySystem.scan();
        // Diplomacy decisions run before military planning — the rest of the
        // AI turn (settlers, combat, movement, production) reads the freshly
        // adjusted state.
        aiDiplomacySystem.runTurn(e.nation.id);
        maybeProposeAIJointWar(e.nation.id);
        // Clear nearby Barbarian Camps before the main AI pass spends movement.
        barbarianSystem.runAICampClearingForNation(e.nation.id, infrastructureSabotageSystem);
        // Covert operatives / privateers act before the main military movement pass.
        aiCovertOperationsSystem.runForNation(e.nation.id);
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
    const getOrganizationDisplayName = (organizationKind: WorldCouncilOrganizationKind): string =>
      organizationKind === 'un' ? 'United Nations' : 'World Council';
    const getWorldCouncilFoundingCandidate = (): {
      wonder: WonderState;
      organizationKind: WorldCouncilOrganizationKind;
    } | undefined => {
      const statueOfLiberty = wonderSystem.getCompletedWonder('statue_of_liberty');
      if (statueOfLiberty && worldCouncilSystem.getOrganizationKind() !== 'un') {
        return { wonder: statueOfLiberty, organizationKind: 'un' };
      }
      const forbiddenCity = wonderSystem.getCompletedWonder('forbidden-city');
      if (!forbiddenCity || worldCouncilSystem.hasCouncil()) return undefined;
      return { wonder: forbiddenCity, organizationKind: 'worldCouncil' };
    };
    const getWorldCouncilFoundationStateForHuman = () => {
      if (!humanNationId || turnManager.getCurrentNation().id !== humanNationId) return null;
      const foundingCandidate = getWorldCouncilFoundingCandidate();
      if (!foundingCandidate || foundingCandidate.wonder.ownerId !== humanNationId) return null;
      const city = cityManager.getCity(foundingCandidate.wonder.cityId);
      const nation = nationManager.getNation(humanNationId);
      if (!city || !nation) return null;
      const resources = nationManager.getResources(humanNationId);
      return {
        organizationName: getOrganizationDisplayName(foundingCandidate.organizationKind),
        nationName: nation.name,
        cityName: city.name,
        maxGold: resources.gold,
        sciencePerTurn: researchSystem.getResearchPerTurn(humanNationId),
        culturePerTurn: resources.culturePerTurn,
      };
    };
    const getWorldCouncilOverviewStateForHuman = () => {
      const state = worldCouncilSystem.getState();
      if (!state) return null;
      const foundingCity = cityManager.getCity(state.foundingCityId);
      const foundingNation = nationManager.getNation(state.foundingNationId);
      const organizationName = getOrganizationDisplayName(state.organizationKind ?? 'worldCouncil');
      return {
        organizationName,
        status: state.status,
        foundingCityName: foundingCity?.name ?? 'Unknown City',
        foundingNationName: foundingNation?.name ?? state.foundingNationId,
        constructionTurnsRemaining: state.constructionTurnsRemaining,
        diplomacyScoreThreshold: worldCouncilSystem.getDiplomacyScoreThreshold(),
        nextRegularMeetingTurn: state.nextRegularMeetingTurn,
        canHumanLeave: false,
        members: state.members.map((member) => ({
          nationName: nationManager.getNation(member.nationId)?.name ?? member.nationId,
          diplomacyScore: member.diplomacyScore,
          diplomacyScoreSinceLastRegularMeeting: member.diplomacyScoreSinceLastRegularMeeting,
          goldContributed: member.goldContributed,
          scienceContributionPercent: member.scienceContributionPercent,
          cultureContributionPercent: member.cultureContributionPercent,
        })),
        enactedResolutions: state.enactedResolutions.map((resolution) => {
          const definition = worldCouncilResolutionSystem.getDefinition(resolution.resolutionId);
          const remainingTurns = resolution.active !== false
            && resolution.expired !== true
            && resolution.expirationTurn !== undefined
              ? Math.max(0, resolution.expirationTurn - turnManager.getCurrentRound())
              : undefined;
          return {
            resolutionId: resolution.resolutionId,
            title: definition?.title ?? resolution.resolutionId,
            status: resolution.expired === true
              ? 'expired' as const
              : resolution.active === false || resolution.repealed === true
                ? 'repealed' as const
                : 'active' as const,
            meetingKind: resolution.meetingKind === 'emergency'
              ? 'Emergency'
              : resolution.meetingKind === 'regular'
                ? 'Regular'
                : 'Unknown',
            turn: resolution.turn,
            repealTurn: resolution.repealTurn,
            targetNationName: resolution.targetNationId
              ? nationManager.getNation(resolution.targetNationId)?.name ?? resolution.targetNationId
              : undefined,
            secondaryTargetNationName: resolution.secondaryTargetNationId
              ? nationManager.getNation(resolution.secondaryTargetNationId)?.name ?? resolution.secondaryTargetNationId
              : undefined,
            remainingTurns,
            participantNationNames: resolution.participantNationIds?.map((nationId) =>
              nationManager.getNation(nationId)?.name ?? nationId),
          };
        }),
        meetings: state.meetings.map((meeting) => ({
          kind: meeting.kind === 'regular' ? 'Regular' : 'Emergency',
          turn: meeting.turn,
          cityName: cityManager.getCity(meeting.cityId)?.name ?? 'Unknown City',
          hostNationName: meeting.hostNationId
            ? nationManager.getNation(meeting.hostNationId)?.name ?? meeting.hostNationId
            : undefined,
          triggerText: meeting.emergencyTrigger?.eventType === 'warDeclared'
            ? `war declared: ${nationManager.getNation(meeting.emergencyTrigger.aggressorNationId ?? '')?.name ?? meeting.emergencyTrigger.aggressorNationId ?? 'Unknown'} vs ${nationManager.getNation(meeting.emergencyTrigger.targetNationId ?? '')?.name ?? meeting.emergencyTrigger.targetNationId ?? 'Unknown'}`
            : undefined,
          proposals: meeting.proposals?.map((proposal) => {
            const definition = worldCouncilResolutionSystem.getDefinition(proposal.resolutionId);
            const isRepeal = proposal.repealTargetEnactedResolutionId !== undefined;
            return {
              slot: proposal.slot,
              resolutionId: proposal.resolutionId,
              title: isRepeal
                ? `Repeal ${definition?.title ?? proposal.resolutionId}`
                : definition?.title ?? proposal.resolutionId,
              description: isRepeal
                ? `If passed, removes the active effect of ${definition?.title ?? proposal.resolutionId}.`
                : definition?.description ?? '',
              icon: isRepeal ? '↩' : definition?.icon ?? '📃',
              votingType: isRepeal ? 'influence' : definition?.votingType ?? 'influence',
              proposerNationName: proposal.proposerNationId
                ? nationManager.getNation(proposal.proposerNationId)?.name ?? proposal.proposerNationId
                : undefined,
              targetNationName: proposal.targetNationId
                ? nationManager.getNation(proposal.targetNationId)?.name ?? proposal.targetNationId
                : undefined,
              secondaryTargetNationName: proposal.secondaryTargetNationId
                ? nationManager.getNation(proposal.secondaryTargetNationId)?.name ?? proposal.secondaryTargetNationId
                : undefined,
              participantNationNames: proposal.participantNationIds?.map((nationId) =>
                nationManager.getNation(nationId)?.name ?? nationId),
              donations: proposal.donations?.map((donation) => ({
                nationName: nationManager.getNation(donation.nationId)?.name ?? donation.nationId,
                gold: donation.gold,
              })),
              distributions: proposal.distributions?.map((distribution) => ({
                nationName: nationManager.getNation(distribution.nationId)?.name ?? distribution.nationId,
                gold: distribution.gold,
              })),
              totalGoldDonated: proposal.totalGoldDonated,
              voteSummary: proposal.votes
                ? formatWorldCouncilVoteSummary(proposal.votes)
                : undefined,
              outcomeText: proposal.outcomeText,
              gamesNumber: proposal.gamesNumber,
              gamesHostingJustification: proposal.gamesHostingJustification,
              gamesParticipationJustification: proposal.gamesParticipationJustification,
              proposedGamesHostNationName: proposal.proposerNationId
                ? nationManager.getNation(proposal.proposerNationId)?.name ?? proposal.proposerNationId
                : undefined,
            };
          }) ?? [],
        })),
      };
    };
    const getWorldCouncilContributionStateForHuman = () => {
      if (!humanNationId || !worldCouncilSystem.hasPendingHumanContribution(humanNationId)) return null;
      const state = worldCouncilSystem.getState();
      const member = state?.members.find((entry) => entry.nationId === humanNationId);
      const nation = nationManager.getNation(humanNationId);
      if (!state || !member || !nation) return null;
      const resources = nationManager.getResources(humanNationId);
      return {
        organizationName: getOrganizationDisplayName(state.organizationKind ?? 'worldCouncil'),
        nationName: nation.name,
        maxGold: resources.gold,
        currentGold: Math.min(
          member.goldContributed,
          worldCouncilSystem.getMaxGoldContributionForOffer(
            humanNationId,
            member.scienceContributionPercent,
            member.cultureContributionPercent,
          ),
        ),
        currentSciencePercent: member.scienceContributionPercent,
        currentCulturePercent: member.cultureContributionPercent,
        getMaxGold: (sciencePercent: number, culturePercent: number) =>
          worldCouncilSystem.getMaxGoldContributionForOffer(humanNationId, sciencePercent, culturePercent),
      };
    };
    const foundWorldCouncil = (
      nationId: string,
      offer: { gold: number; sciencePercent: number; culturePercent: number },
    ): boolean => {
      const foundingCandidate = getWorldCouncilFoundingCandidate();
      if (!foundingCandidate || foundingCandidate.wonder.ownerId !== nationId) return false;
      const founded = worldCouncilSystem.found({
        foundingCityId: foundingCandidate.wonder.cityId,
        foundingNationId: nationId,
        foundingTurn: turnManager.getCurrentRound(),
        founderOffer: offer,
        organizationKind: foundingCandidate.organizationKind,
      });
      if (!founded) return false;
      const cityName = cityManager.getCity(foundingCandidate.wonder.cityId)?.name ?? 'Unknown City';
      const organizationName = getOrganizationDisplayName(foundingCandidate.organizationKind);
      historicalTimeline.record({
        type: 'worldCouncilFounded',
        icon: '📜',
        text: `${timelineNationName(nationId)} founded the ${organizationName} in ${cityName}`,
        eventNationIds: worldCouncilSystem.getState()?.memberNationIds ?? [nationId],
        metadata: { cityId: foundingCandidate.wonder.cityId, cityName },
      });
      logManager.info({
        nationId,
        nationIds: worldCouncilSystem.getState()?.memberNationIds ?? [nationId],
        category: 'diplomacy',
        message: `founded the ${organizationName} in ${cityName}. Construction will take 20 turns.`,
      });
      resourceSystem.recalculateForNation(nationId);
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      return true;
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
    // Plain S sleeps; Ctrl+S is reserved for the save dialog.
    const onKeySleep = (event: KeyboardEvent) => {
      if (event.ctrlKey) return;
      activateActionIfHumanTurn('sleep');
    };
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
      if (!dialog || dialog.isOpen() || this.leaderGossipDialog?.isOpen()) return;
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
        if (
          item.buildingType.id === GRAND_STADIUM_BUILDING_ID
          && !gamesOfNationsSystem.canCityConstructGrandStadium(cityId, city.ownerId)
        ) {
          console.warn(`[GamesOfNations] Blocked Grand Stadium completion outside the valid hosting window in ${city.name}.`);
          return false;
        }
        const completedTile = item.buildingType.placement === 'city'
          ? null
          : buildingPlacementSystem.finalizeReservedBuilding(cityId, item.buildingType.id, mapData);
        if (item.buildingType.placement !== 'city' && !completedTile) {
          console.warn(`[BuildingPlacement] Completed ${item.buildingType.id} for ${cityId} without a reserved tile.`);
          return false;
        }

        cityManager.getBuildings(cityId).add(item.buildingType);
        if ((item.buildingType.modifiers.cityDefensePercent ?? 0) > 0) {
          cityRenderer.refreshCity(city);
        }
        if (item.buildingType.id === GRAND_STADIUM_BUILDING_ID) {
          logManager.info({
            nationId: city.ownerId,
            category: 'games-of-nations',
            message: `[GamesOfNations] Grand Stadium completed in ${city.name}`,
          });
        }
        resourceSystem.recalculateForNation(city.ownerId);
        if (completedTile) tileBuildingRenderer.refreshTile(completedTile.x, completedTile.y);

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

      if (item.kind === 'manufacturedResource') {
        if (item.productionType.id !== AEROSPACE_PARTS_ID) return false;
        const costDetails = aerospacePartSystem.getProductionCostDetails(city.ownerId);
        const effectiveCost = productionSystem.getCost(item, city.id);
        const quantity = aerospacePartSystem.completeProduction(city);
        if (quantity === null) return false;
        const required = victorySystem.getScienceVictorySettings().requiredAerospaceParts;
        const nationName = nationManager.getNation(city.ownerId)?.name ?? city.ownerId;
        const bonus = aerospacePartSystem.getProductionBonusPercent(city.ownerId);
        logManager.info({
          nationId: city.ownerId,
          category: 'victory',
          message: `[ScienceVictoryAI] ${nationName} completed Aerospace Part ${quantity}/${required} in ${city.name}; completedParts=${costDetails.completedParts} baseCost=${costDetails.baseProductionCost} growthRate=${Math.round(costDetails.growthRate * 100)}% productionCost=${costDetails.productionCost} effectiveCost=${effectiveCost} aerospaceIndustriesBonus=${bonus}%; accumulated=${quantity}/${required}.`,
        });
        resourceSystem.recalculateForNation(city.ownerId);
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

      // Improvement-building units (Worker, Work Boat) only gain their full
      // multi-improvement capacity once the owning nation reaches the
      // renaissance era. Before then they are capped to a single charge and
      // "die" after one improvement. Renaissance+ uses the unit's data default.
      const reachedRenaissance =
        getEraRank(eraSystem.getNationEra(city.ownerId)) >= getEraRank('renaissance');
      const improvementCharges = item.unitType.canBuildImprovements && !reachedRenaissance
        ? 1
        : undefined;
      unitManager.createUnit({
        type: item.unitType,
        ownerId: city.ownerId,
        tileX: placement.x,
        tileY: placement.y,
        movementPoints: 0,
        improvementCharges,
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

    // ─── Combat events ──────────────────────────────────────────────────────

    combatSystem.on(async (e) => {
      const isRanged = (e.attacker.unitType.range ?? 1) >= 2;
      const animationOptions = {
        defenderUnitId: e.defender.id,
        shakeOnImpact: isHumanInvolvedInCombat(humanNationId, e.attacker.ownerId, e.defender.ownerId),
      };
      if (isRanged) {
        await combatAnimationSystem.playRangedAttack(e.attacker, e.defender.tileX, e.defender.tileY, animationOptions);
      } else {
        await combatAnimationSystem.playMeleeAttack(e.attacker, e.defender.tileX, e.defender.tileY, animationOptions);
      }
      if (e.result.attackerDied) {
        unitRenderer.removeUnit(e.attacker.id);
      } else {
        unitRenderer.refreshUnitPosition(e.attacker.id);
      }
      if (e.result.defenderDied) unitRenderer.removeUnit(e.defender.id);
      else unitRenderer.refreshUnitPosition(e.defender.id);
      // Record per-war unit losses for military units (baseStrength > 0).
      // Combat involving insurgents (Rebels, Partisans) is outside diplomacy and
      // must never create diplomatic penalties, so it is excluded entirely.
      const involvesInsurgent = e.attacker.unitType.isInsurgentForce === true
        || e.defender.unitType.isInsurgentForce === true;
      if (!involvesInsurgent && diplomacyManager.getState(e.attacker.ownerId, e.defender.ownerId) === 'WAR') {
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
      aiMilitaryEvaluationSystem.invalidate(e.city.ownerId);
      if (e.previousOwnerId) aiMilitaryEvaluationSystem.invalidate(e.previousOwnerId);
      const isRanged = (e.attacker.unitType.range ?? 1) >= 2;
      const defendingNationId = e.previousOwnerId ?? e.city.ownerId;
      const animationOptions = {
        shakeOnImpact: isHumanInvolvedInCombat(humanNationId, e.attacker.ownerId, defendingNationId),
      };
      if (isRanged) {
        await combatAnimationSystem.playRangedAttack(e.attacker, e.city.tileX, e.city.tileY, animationOptions);
      } else {
        await combatAnimationSystem.playMeleeAttack(e.attacker, e.city.tileX, e.city.tileY, animationOptions);
      }
      // Uppdatera stadsrendering
      cityRenderer.refreshCity(e.city);
      cityBannerRenderer.refreshCity(e.city);
      hudLayer?.refresh();
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
        if (e.previousOwnerId) {
          politicalCapitalSystem.handleCityCaptured(e.city, e.previousOwnerId);
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
          // ...and the rest of the known world takes note. Exactly one observer
          // event per capture — the capital variant replaces the ordinary one
          // rather than stacking on top of it.
          diplomaticMemorySystem.recordAggressionForObservers({
            type: e.city.isCapital ? 'capital_capture' : 'city_capture',
            aggressorNationId: e.attacker.ownerId,
            victimNationId: e.previousOwnerId,
            round: turnManager.getCurrentRound(),
            cityName: e.city.name,
          });
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
      // Destroying an entire civilization is the strongest signal the rest of
      // the world receives. Only conquest counts — a nation that collapses with
      // no conqueror has no aggressor to blame.
      if (event.conquerorNationId) {
        diplomaticMemorySystem.recordAggressionForObservers({
          type: 'nation_elimination',
          aggressorNationId: event.conquerorNationId,
          victimNationId: event.nationId,
          round: turnManager.getCurrentRound(),
        });
      }
      historicalTimeline.record({
        type: 'nationEliminated',
        icon: '⚑',
        text: `${event.nationName} was eliminated${event.conquerorName ? ` by ${event.conquerorName}` : ''}`,
        eventNationIds: [event.nationId, event.conquerorNationId].filter((id): id is string => id !== undefined),
        metadata: {
          nationNames: [event.nationName, event.conquerorName].filter((name): name is string => name !== undefined),
          aggressorNationId: event.conquerorNationId,
          targetNationId: event.nationId,
          cityId: event.triggerCity?.id,
          cityName: event.triggerCity?.name,
        },
      });
      worldCouncilSystem.removeEliminatedNation(event.nationId);
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
      logManager.info({ nationIds: event.conquerorNationId ? [event.conquerorNationId] : [], category: 'combat', message: event.message });
    });

    // ─── Healing events ─────────────────────────────────────────────────────

    healingSystem.onCityHealed((e) => {
      const city = cityManager.getCity(e.cityId);
      if (city) {
        aiMilitaryEvaluationSystem.invalidate(city.ownerId);
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
    // Diplomatic upkeep: suspicion drifts back toward 0 a little each round.
    turnManager.on('roundStart', () => { diplomacyManager.decaySuspicion(); });
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
      const ceasefireRemaining = diplomacyManager.getCeasefireRemainingTurns(
        humanNationIdForDiplomacy,
        targetNationId,
        turnManager.getCurrentRound(),
      );
      if (ceasefireRemaining > 0) {
        return `UN ceasefire active for ${ceasefireRemaining} more turn${ceasefireRemaining === 1 ? '' : 's'}.`;
      }
      const remaining = diplomacyManager.getPeaceTreatyRemainingTurns(
        humanNationIdForDiplomacy,
        targetNationId,
        turnManager.getCurrentRound(),
      );
      return remaining > 0 ? `Peace treaty active for ${remaining} more turn${remaining === 1 ? '' : 's'}.` : null;
    };
    const logBlockedHumanWarDeclaration = (targetNationId: string): void => {
      const ceasefireRemaining = diplomacyManager.getCeasefireRemainingTurns(
        humanNationIdForDiplomacy,
        targetNationId,
        turnManager.getCurrentRound(),
      );
      const remaining = diplomacyManager.getPeaceTreatyRemainingTurns(
        humanNationIdForDiplomacy,
        targetNationId,
        turnManager.getCurrentRound(),
      );
      if (remaining <= 0 && ceasefireRemaining <= 0) return;
      const humanName = nationManager.getNation(humanNationIdForDiplomacy)?.name ?? humanNationIdForDiplomacy;
      const targetName = nationManager.getNation(targetNationId)?.name ?? targetNationId;
      const reason = ceasefireRemaining > 0
        ? `active UN ceasefire for ${ceasefireRemaining} more turn${ceasefireRemaining === 1 ? '' : 's'}`
        : `active peace treaty for ${remaining} more turn${remaining === 1 ? '' : 's'}`;
      logManager.info({
        nationIds: [humanNationIdForDiplomacy, targetNationId],
        category: 'diplomacy',
        message: `${humanName} cannot declare war on ${targetName} due to ${reason}.`,
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
      // Third parties note that this nation is willing to use force. Guarded by
      // isActivating() above, so a defensive ally being pulled into a war is
      // not mistaken for fresh aggression.
      diplomaticMemorySystem.recordAggressionForObservers({
        type: 'war_declaration',
        aggressorNationId: aggressorId,
        victimNationId: targetId,
        round: turnManager.getCurrentRound(),
      });
      const endedPeacekeepingMission = worldCouncilSystem.expirePeacekeepingMissionBecauseHostDeclaredWar(aggressorId, targetId);
      if (endedPeacekeepingMission) {
        const message = `The UN Peacekeeping Mission in ${nameA} ended because ${nameA} initiated war against ${nameB}.`;
        logManager.info({
          nationId: aggressorId,
          nationIds: [aggressorId, targetId],
          category: 'diplomacy',
          message,
        });
      }
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
      const previousOwnerId = city.ownerId;
      city.occupiedOriginalNationId = city.originNationId !== toNationId
        ? city.originNationId
        : undefined;
      cityManager.transferOwnership(city.id, toNationId, productionSystem);
      cityTerritorySystem.transferCityTerritory(city, toNationId, mapData);
      culturalSphereSystem.claimInitialCityCulture(city, mapData, gridSystem);
      if (cityManager.getCitiesByOwner(previousOwnerId).length === 0) {
        nationCollapseSystem.collapse({
          nationId: previousOwnerId,
          conquerorNationId: toNationId,
          triggerCity: city,
          reason: 'no_valid_survival_state',
        });
      }
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
      this.diagnosticSystem,
    );
    const getGamesOfNationsUiModel = () => {
      const summary = gamesOfNationsSystem.getSummary();
      const hostNationName = summary.hostNationId
        ? nationManager.getNation(summary.hostNationId)?.name ?? null
        : null;
      const hostCityName = summary.hostCityId
        ? cityManager.getCity(summary.hostCityId)?.name ?? null
        : null;
      const founderNationName = summary.founderNationId
        ? nationManager.getNation(summary.founderNationId)?.name ?? null
        : null;
      const candidateNationName = summary.hostCandidateNationId
        ? nationManager.getNation(summary.hostCandidateNationId)?.name ?? null
        : null;
      const upcomingHostNationName = summary.upcomingHostNationId
        ? nationManager.getNation(summary.upcomingHostNationId)?.name ?? null
        : null;
      const upcomingHostCityName = summary.upcomingHostCityId
        ? cityManager.getCity(summary.upcomingHostCityId)?.name ?? null
        : null;
      const hostCityOptions = humanNationId
        ? gamesOfNationsSystem.getHostCityCandidates(humanNationId).map((city) => ({
          id: city.id,
          name: city.name,
          productionPerTurn: city.productionPerTurn,
          estimatedTurns: city.hasGrandStadium
            ? 0
            : productionSystem.getTurnsEstimate(city.id, { kind: 'building', buildingType: GRAND_STADIUM }),
          hasGrandStadium: city.hasGrandStadium,
        }))
        : [];
      const stadiumQueueEntry = summary.upcomingHostCityId
        ? productionSystem.getQueue(summary.upcomingHostCityId).find((entry) =>
          entry.item.kind === 'building' && entry.item.buildingType.id === GRAND_STADIUM_BUILDING_ID,
        )
        : undefined;
      return buildGamesOfNationsUiModel({
        summary,
        humanNationId: humanNationId ?? '',
        hostNationName,
        hostCityName,
        founderNationName,
        currentCultureAvailable: humanNationId ? getGamesCultureOutput(humanNationId) : 0,
        currentBaseProductionAvailable: humanNationId
          ? getGamesProductionSources(humanNationId).reduce((sum, source) => sum + source.available, 0)
          : 0,
        nationNames: Object.fromEntries(
          nationManager.getAllNations().map((nation) => [nation.id, nation.name]),
        ),
        candidateNationName,
        upcomingHostNationName,
        upcomingHostCityName,
        hostCityOptions,
        stadiumEstimatedTurns: summary.stadiumCompleted
          ? 0
          : stadiumQueueEntry?.turnsRemaining ?? (summary.upcomingHostCityId
            ? productionSystem.getTurnsEstimate(summary.upcomingHostCityId, { kind: 'building', buildingType: GRAND_STADIUM })
            : null),
        stadiumUnderConstruction: stadiumQueueEntry !== undefined,
        humanTreasury: humanNationId ? nationManager.getResources(humanNationId).gold : 0,
      });
    };
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
      getGamesOfNationsModel: getGamesOfNationsUiModel,
      onGamesParticipationDecision: (participating) => {
        if (!humanNationId) return false;
        const summary = gamesOfNationsSystem.getSummary();
        if (summary.phase !== 'preparation') return false;
        const participationSet = gamesOfNationsSystem.setParticipation(humanNationId, participating);
        if (!participationSet) return false;
        if (participating) {
          hudLayer?.refresh();
          return true;
        }
        const confirmed = gamesOfNationsSystem.confirmHumanPreparationConfiguration(
          humanNationId,
          summary.competitionNumber,
        );
        if (confirmed) hudLayer?.refresh();
        return confirmed;
      },
      onGamesHostingDecision: (accept) => {
        if (!humanNationId) return false;
        const handled = accept
          ? gamesOfNationsSystem.acceptHostingOffer(humanNationId)
          : gamesOfNationsSystem.declineHostingOffer(humanNationId);
        if (handled) hudLayer?.refresh();
        return handled;
      },
      onGamesHostCitySelected: (cityId) => {
        if (!humanNationId) return false;
        const selected = gamesOfNationsSystem.selectHostCity(humanNationId, cityId);
        if (selected) {
          hudLayer?.refresh();
          rightPanel?.requestRefresh();
        }
        return selected;
      },
      onGamesSportAuctionBid: (sportId, bid) => {
        if (!humanNationId) return false;
        const resolved = gamesOfNationsSystem.submitHumanSportAuctionBid(humanNationId, sportId, bid);
        if (resolved) {
          hudLayer?.refresh();
          rightPanel?.requestRefresh();
        }
        return resolved;
      },
      onGamesSportAuctionAbstain: () => {
        if (!humanNationId) return false;
        const resolved = gamesOfNationsSystem.abstainFromHumanSportAuction(humanNationId);
        if (resolved) {
          hudLayer?.refresh();
          rightPanel?.requestRefresh();
        }
        return resolved;
      },
      onApplyGamesStrategy: (culture, baseProduction, strategy: GamesOfNationsSportValues, hostBonusSport) => {
        if (!humanNationId) return false;
        if (
          !Number.isInteger(culture) || culture < 0
          || !Number.isInteger(baseProduction) || baseProduction < 0
        ) return false;
        const summary = gamesOfNationsSystem.getSummary();
        const participant = summary.participants
          .find((entry) => entry.nationId === humanNationId);
        if (summary.phase !== 'preparation' || !participant?.participating) return false;
        const cultureSet = gamesOfNationsSystem.setNationCultureCommitment(humanNationId, culture);
        const productionSet = gamesOfNationsSystem.setNationProductionCommitment(humanNationId, baseProduction);
        const strategySet = gamesOfNationsSystem.setNationGamesPointsStrategy(humanNationId, strategy);
        if (!(cultureSet && productionSet && strategySet)) return false;
        const confirmed = summary.humanPreparationPromptAcknowledgedCompetitionNumber === summary.competitionNumber
          || gamesOfNationsSystem.confirmHumanPreparationConfiguration(
            humanNationId,
            summary.competitionNumber,
            hostBonusSport,
          );
        if (confirmed) hudLayer?.refresh();
        return confirmed;
      },
      onGamesStrategyAdjustmentSeen: () => {
        if (humanNationId) gamesOfNationsSystem.acknowledgeHumanStrategyAdjustment(humanNationId);
      },
      onAllocateGamesPoints: (sport, amount) => {
        if (!humanNationId) return false;
        const allocated = gamesOfNationsSystem.allocateGamesPoints(humanNationId, sport, amount);
        if (allocated) hudLayer?.refresh();
        return allocated;
      },
      onDistributeRemainingGamesPoints: () => {
        if (!humanNationId) return false;
        const distributed = gamesOfNationsSystem.distributeRemainingGamesPointsEvenly(humanNationId);
        if (distributed) hudLayer?.refresh();
        return distributed;
      },
      onToggleMapLens: toggleMapLens,
      getWorldCouncilFoundationState: getWorldCouncilFoundationStateForHuman,
      getWorldCouncilOverviewState: getWorldCouncilOverviewStateForHuman,
      getWorldCouncilContributionState: getWorldCouncilContributionStateForHuman,
      onFoundWorldCouncil: (offer) => {
        if (!humanNationId) return false;
        return foundWorldCouncil(humanNationId, offer);
      },
      onSubmitWorldCouncilContribution: (offer) => {
        if (!humanNationId) return false;
        return worldCouncilSystem.submitHumanContribution(humanNationId, offer);
      },
      onLeaveWorldCouncil: () => {
        if (!humanNationId) return false;
        const left = worldCouncilSystem.leaveCouncil(humanNationId);
        if (left) {
          logManager.info({
            nationId: humanNationId,
            category: 'diplomacy',
            message: `left the ${worldCouncilSystem.getOrganizationName()}.`,
          });
        }
        return left;
      },
      isDiagnosticsEnabled: () => this.diagnosticSystem.isOpen(),
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
    currencySystem.onChanged(() => {
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    cultureSystem.onChanged(() => {
      if (autoplaySystem.isActive()) return;
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    worldCouncilSystem.onChanged(() => {
      cityDefenseSystem.setWorldHeritageProtectionActive(worldCouncilSystem.hasWorldHeritageProtection());
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

    // ─── Guides ───────────────────────────────────────────────────────────────
    // The new-game startup guide is separate from the progressive topics. One
    // progressive topic becomes due after every six completed human turns.
    const guideProgression = this.setupProgressiveGuide({
      humanNationId,
      unitManager,
      tileMap,
      hudLayer,
      worldInputGate,
      selectionManager,
      focusUnit,
      turnManager,
      isAutoplayActive: () => autoplaySystem.isActive(),
      savedProgress: data.savedState?.guideProgress,
      savedRound: data.savedState?.turn.currentRound ?? 0,
      isFreshGame: data.savedState === undefined,
      enabledVictories: victorySystem.getEnabledConditions(),
      requiredAerospaceParts: victorySystem.getScienceVictorySettings().requiredAerospaceParts,
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
    rightPanel.setGamesOfNationsSystem(gamesOfNationsSystem);
    rightPanel.setVictorySystem(victorySystem);
    rightPanel.setCityDefenseSystem(cityDefenseSystem);
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
    rightPanel.setCurrencySystem(currencySystem);
    rightPanel.setCultureSystem(cultureSystem);
    rightPanel.setWonderSystem(wonderSystem);
    rightPanel.setWorldCouncilSystem(worldCouncilSystem);
    rightPanel.setCorporationSystem(corporationSystem);
    rightPanel.setAerospacePartSystem(
      aerospacePartSystem,
      victorySystem.getScienceVictorySettings().requiredAerospaceParts,
    );
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
        metadata: { cityId: city.id, cityName: city.name },
      });
    });
    discoverySystem.onNationsMet((a, b) => {
      historicalTimeline.record({
        type: 'firstContact',
        icon: '🧑‍🤝‍🧑',
        text: `${timelineNationName(a)} met ${timelineNationName(b)}`,
        eventNationIds: [a, b],
        metadata: { aggressorNationId: a, targetNationId: b },
      });
    });
    diplomacyManager.onWarDeclared((aggressorId, targetId) => {
      worldCouncilSystem.triggerEmergencyMeeting(turnManager.getCurrentRound(), {
        eventType: 'warDeclared',
        aggressorNationId: aggressorId,
        targetNationId: targetId,
      });
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
          metadata: { aggressorNationId: aggressorId, targetNationId: targetId },
        }
        : {
          type: 'warDeclared',
          icon: '⚔',
          text: `${timelineNationName(aggressorId)} declared war on ${timelineNationName(targetId)}`,
          eventNationIds: [aggressorId, targetId],
          metadata: { aggressorNationId: aggressorId, targetNationId: targetId },
        });
      gossipFlavorEventSystem.handleWarDeclared(aggressorId, targetId);
    });
    diplomacyManager.onPeaceAccepted((a, b) => {
      historicalTimeline.record({
        type: 'peace',
        icon: '🕊',
        text: `${timelineNationName(a)} and ${timelineNationName(b)} signed peace`,
        eventNationIds: [a, b],
        metadata: { aggressorNationId: a, targetNationId: b },
      });
    });
    diplomacyManager.onEmbassyEstablished((from, to) => {
      historicalTimeline.record({
        type: 'embassyEstablished',
        icon: '🏛',
        text: `${timelineNationName(from)} established an embassy in ${timelineNationName(to)}`,
        eventNationIds: [from, to],
        metadata: { aggressorNationId: from, targetNationId: to },
      });
    });
    diplomacyManager.onTradeRelationsEstablished((a, b) => {
      historicalTimeline.record({
        type: 'tradeRelations',
        icon: '💰',
        text: `${timelineNationName(a)} and ${timelineNationName(b)} established trade relations`,
        eventNationIds: [a, b],
        metadata: { aggressorNationId: a, targetNationId: b },
      });
    });
    diplomacyManager.onAllianceFormed((a, b) => {
      historicalTimeline.record({
        type: 'allianceFormed',
        icon: '🤝',
        text: `${timelineNationName(a)} and ${timelineNationName(b)} became allies`,
        eventNationIds: [a, b],
        metadata: { aggressorNationId: a, targetNationId: b },
      });
    });
    combatSystem.onCityCombat((event) => {
      if (!event.captured || !event.previousOwnerId) return;
      historicalTimeline.record({
        type: event.city.isOriginalCapital ? 'capitalCaptured' : 'cityCaptured',
        icon: '🏴',
        text: `${timelineNationName(event.city.ownerId)} captured ${event.city.name} from ${timelineNationName(event.previousOwnerId)}`,
        eventNationIds: [event.city.ownerId, event.previousOwnerId],
        metadata: {
          cityId: event.city.id,
          cityName: event.city.name,
          aggressorNationId: event.city.ownerId,
          targetNationId: event.previousOwnerId,
          previousOwnerNationId: event.previousOwnerId,
        },
      });
      gossipFlavorEventSystem.handleCityCaptured(event.city.ownerId, event.previousOwnerId, event.city.name);
    });
    tradeConnectionSystem.onConnectionActivated((connection) => {
      const cityAName = cityManager.getCity(connection.cityAId)?.name ?? connection.cityAId;
      const cityBName = cityManager.getCity(connection.cityBId)?.name ?? connection.cityBId;
      historicalTimeline.record({
        type: 'tradeRouteCompleted',
        icon: '🚚',
        text: `Trade route completed between ${cityAName} and ${cityBName}`,
        eventNationIds: [connection.nationAId, connection.nationBId],
        metadata: { cityName: `${cityAName} and ${cityBName}` },
      });
    });
    wonderSystem.onWonderCompleted((state, wonderType) => {
      historicalTimeline.record({
        type: 'wonderBuilt',
        icon: '🏛',
        text: `${timelineNationName(state.ownerId)} completed ${wonderType.name}`,
        eventNationIds: [state.ownerId],
        metadata: {
          cityId: state.cityId,
          cityName: cityManager.getCity(state.cityId)?.name,
          wonderId: wonderType.id,
          wonderName: wonderType.name,
        },
      });
      // Surface a prominent completion popup whenever any nation finishes a
      // wonder during live human play. Skipped during autoplay/autorun, which
      // keeps log/timeline behavior only. Multiple completions in one turn are
      // queued by HudLayer and shown one at a time.
      if (!autoplaySystem.isActive()) {
        hudLayer?.enqueueDiscovery(buildWonderCompletionPopupData(state, wonderType));
      }
    });
    worldCouncilSystem.onCompleted((state) => {
      const cityName = cityManager.getCity(state.foundingCityId)?.name ?? 'Unknown City';
      const organizationName = getOrganizationDisplayName(state.organizationKind ?? 'worldCouncil');
      historicalTimeline.record({
        type: 'worldCouncilActive',
        icon: '📜',
        text: `${organizationName} became active in ${cityName}`,
        eventNationIds: state.memberNationIds.length > 0 ? state.memberNationIds : [state.foundingNationId],
      });
      logManager.info({
        nationId: state.foundingNationId,
        nationIds: state.memberNationIds.length > 0 ? state.memberNationIds : [state.foundingNationId],
        category: 'diplomacy',
        message: `${organizationName} became active in ${cityName}.`,
      });
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    worldCouncilSystem.onResolutionExpired((resolution, state) => {
      const definition = worldCouncilResolutionSystem.getDefinition(resolution.resolutionId);
      const organizationName = getOrganizationDisplayName(state.organizationKind ?? 'worldCouncil');
      const targetName = resolution.targetNationId
        ? timelineNationName(resolution.targetNationId)
        : undefined;
      const secondaryTargetName = resolution.secondaryTargetNationId
        ? timelineNationName(resolution.secondaryTargetNationId)
        : undefined;
      const verb = resolution.resolutionId === 'international_sanctions' ? 'have' : 'has';
      const message = resolution.resolutionId === 'ceasefire_resolution' && targetName && secondaryTargetName
        ? `The UN ceasefire between ${targetName} and ${secondaryTargetName} has expired.`
        : resolution.resolutionId === 'un_peacekeeping_mission' && targetName
          ? `The UN Peacekeeping Mission in ${targetName} has expired.`
        : resolution.resolutionId === 'global_infrastructure_initiative'
          ? 'The Global Infrastructure Initiative has concluded.'
        : targetName
        ? `${organizationName} ${definition?.title ?? resolution.resolutionId} against ${targetName} ${verb} expired.`
        : `${organizationName} ${definition?.title ?? resolution.resolutionId} ${verb} expired.`;
      historicalTimeline.record({
        type: 'worldCouncilMeeting',
        icon: '📜',
        text: message,
        eventNationIds: resolution.targetNationId
          ? [resolution.targetNationId, resolution.secondaryTargetNationId].filter((nationId): nationId is string => nationId !== undefined)
          : state.memberNationIds,
      });
      logManager.info({
        nationId: resolution.targetNationId ?? state.foundingNationId,
        nationIds: resolution.targetNationId
          ? [resolution.targetNationId, resolution.secondaryTargetNationId].filter((nationId): nationId is string => nationId !== undefined)
          : state.memberNationIds,
        category: 'diplomacy',
        message,
      });
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    worldCouncilSystem.onMeeting((meeting, state) => {
      const cityName = cityManager.getCity(meeting.cityId)?.name ?? 'Unknown City';
      const hostName = meeting.hostNationId
        ? timelineNationName(meeting.hostNationId)
        : undefined;
      const emergencyText = meeting.emergencyTrigger?.eventType === 'warDeclared'
        ? ` after ${timelineNationName(meeting.emergencyTrigger.aggressorNationId ?? '')} declared war on ${timelineNationName(meeting.emergencyTrigger.targetNationId ?? '')}`
        : '';
      const organizationName = getOrganizationDisplayName(state.organizationKind ?? 'worldCouncil');
      const meetingText = meeting.kind === 'regular'
        ? `${organizationName} held a regular meeting in ${cityName}${hostName ? `, hosted by ${hostName}` : ''}`
        : `${organizationName} held an emergency meeting in ${cityName}${emergencyText}`;
      const eventNationIds = meeting.kind === 'emergency'
        ? [
            meeting.emergencyTrigger?.aggressorNationId,
            meeting.emergencyTrigger?.targetNationId,
          ].filter((nationId): nationId is string => nationId !== undefined)
        : meeting.hostNationId
          ? [meeting.hostNationId]
          : state.memberNationIds;
      const primaryNationId = meeting.hostNationId
        ?? state.memberNationIds.find((nationId) => nationManager.getNation(nationId))
        ?? state.foundingNationId;
      historicalTimeline.record({
        type: 'worldCouncilMeeting',
        icon: '📜',
        text: meetingText,
        eventNationIds,
      });
      logManager.info({
        nationId: primaryNationId,
        nationIds: eventNationIds.length > 0 ? eventNationIds : state.memberNationIds,
        category: 'diplomacy',
        message: meetingText,
      });
      for (const proposal of meeting.proposals ?? []) {
        const definition = worldCouncilResolutionSystem.getDefinition(proposal.resolutionId);
        const proposalTitle = definition?.title ?? proposal.resolutionId;
        if (proposal.resolved && proposal.passed) {
          const involved = [
            proposal.proposerNationId,
            proposal.targetNationId,
            proposal.secondaryTargetNationId,
          ].filter((nationId): nationId is string => nationId !== undefined);
          historicalTimeline.record({
            type: 'worldCouncilResolution',
            icon: '⚖',
            text: `${organizationName} adopted ${proposalTitle}`,
            eventNationIds: involved.length > 0 ? involved : state.memberNationIds,
            metadata: {
              resolutionId: proposal.resolutionId,
              resolutionName: proposalTitle,
              aggressorNationId: proposal.proposerNationId,
              targetNationId: proposal.targetNationId,
            },
          });
        }
        if (proposal.selectionDiagnostics) {
          const candidateLines = proposal.selectionDiagnostics.candidates
            .map((candidate) =>
              `${worldCouncilResolutionSystem.getDefinition(candidate.resolutionId)?.title ?? candidate.resolutionId}`
              + `${candidate.repealTargetEnactedResolutionId ? ' (repeal)' : ''}: base ${candidate.baseScore}, `
              + `recent penalty ${candidate.recentPenalty}, proposer penalty ${candidate.repeatProposerPenalty}, `
              + `diversity ${candidate.diversityBonus}, final ${candidate.finalScore} (${candidate.reason})`);
          logManager.info({
            nationId: proposal.proposerNationId ?? primaryNationId,
            nationIds: state.memberNationIds,
            category: 'diplomacy',
            message: [
              `${organizationName} resolution evaluation (${proposal.slot} slot).`,
              ...candidateLines,
              `Selected: ${proposalTitle}${proposal.repealTargetEnactedResolutionId ? ' repeal' : ''}.`,
            ].join('\n'),
          });
        }
        if (proposal.votes && proposal.votes.length > 0) {
          const voteLines = proposal.votes.map((vote) => {
            const nationName = timelineNationName(vote.nationId);
            const voteText = vote.influence <= 0 ? 'ABSTAIN' : vote.support ? 'FOR' : 'AGAINST';
            return [
              nationName,
              `Influence available: ${vote.availableInfluence ?? vote.influence}`,
              `Influence committed: ${vote.influence}`,
              `Remaining influence: ${vote.remainingInfluence ?? 0}`,
              `Vote: ${voteText}`,
              `Support score: ${vote.supportScore ?? 'n/a'}`,
            ].join('\n');
          });
          const summary = proposal.voteSummary;
          logManager.info({
            nationId: proposal.proposerNationId ?? proposal.targetNationId ?? primaryNationId,
            nationIds: state.memberNationIds,
            category: 'diplomacy',
            message: [
              `${organizationName} influence usage for ${proposalTitle}.`,
              ...voteLines,
              summary
                ? `Meeting summary: ${summary.supportInfluence} for, ${summary.opposeInfluence} against, ${summary.abstentions} abstentions, margin ${summary.margin}, ${summary.outcome}.`
                : formatWorldCouncilVoteSummary(proposal.votes),
            ].join('\n\n'),
          });
        }
        if (proposal.resolutionId === 'defense_support' && proposal.donations) {
          const donationLines = proposal.donations.map((donation) => {
            const diagnostics = donation.diagnostics;
            return diagnostics
              ? [
                  timelineNationName(donation.nationId),
                  `Treasury: ${diagnostics.treasury}`,
                  `Gold per turn: ${diagnostics.goldPerTurn}`,
                  `Maximum donation: ${diagnostics.maximumDonation}`,
                  `Desired donation: ${diagnostics.desiredDonation}`,
                  `Actual donation: ${diagnostics.actualDonation}`,
                  `Reason: ${diagnostics.reason}`,
                ].join('\n')
              : `${timelineNationName(donation.nationId)}\nActual donation: ${donation.gold}`;
          });
          logManager.info({
            nationId: proposal.targetNationId ?? primaryNationId,
            nationIds: state.memberNationIds,
            category: 'diplomacy',
            message: [
              `${organizationName} Defense Support donation evaluation.`,
              ...donationLines,
            ].join('\n\n'),
          });
        }
        if (!proposal.outcomeText) continue;
        logManager.info({
          nationId: proposal.targetNationId ?? primaryNationId,
          nationIds: state.memberNationIds,
          category: 'diplomacy',
          message: proposal.outcomeText,
        });
      }
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    corporationSystem?.onCorporationFounded((result) => {
      historicalTimeline.record({
        type: 'corporationFounded',
        icon: '🏢',
        text: `${timelineNationName(result.founded.founderNationId)} founded ${result.definition.name}`,
        eventNationIds: [result.founded.founderNationId],
        metadata: {
          corporationId: result.definition.id,
          corporationName: result.definition.name,
          cityId: result.founded.cityId,
          cityName: result.founded.cityId ? cityManager.getCity(result.founded.cityId)?.name : undefined,
        },
      });
      if (result.definition.id === AEROSPACE_INDUSTRIES_ID) {
        const founder = nationManager.getNation(result.founded.founderNationId);
        const cityName = result.founded.cityId
          ? cityManager.getCity(result.founded.cityId)?.name
          : undefined;
        logManager.info({
          nationId: result.founded.founderNationId,
          category: 'victory',
          message: `[ScienceVictoryAI] ${founder?.name ?? result.founded.founderNationId} founded AeroSpace Industries${cityName ? ` in ${cityName}` : ''}; global Aerospace Parts production unlocked; founder production bonus=50%.`,
        });
      }
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
      const buildings = gamesOfNationsSystem.canCityConstructGrandStadium(city.id, city.ownerId)
        ? [...ALL_BUILDINGS, GRAND_STADIUM]
        : ALL_BUILDINGS;
      return buildings
        .filter((building) => !cityManager.getBuildings(city.id).has(building.id))
        .filter((building) => !occupiedBuildingIds.has(building.id))
        .filter((building) => !isBuildingQueued(city.id, building.id))
        .filter((building) => researchSystem ? researchSystem.isBuildingUnlocked(city.ownerId, building.id) : true)
        .map((building) => {
          const validCoords = building.placement === 'city'
            ? [{ x: city.tileX, y: city.tileY }]
            : buildingPlacementSystem.getValidPlacementCoords(city, building, mapData);
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
          const quote = city.ownerId === humanNationId
            ? productionPurchaseSystem.getQuote(city.id, index)
            : { ok: false as const, reason: 'Not human-controlled' };
          const rawBuyCost = productionSystem.getBuyCost(city.id, index);
          const buyCost = quote.ok ? quote.cost : rawBuyCost;
          const canBuy = quote.ok;
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
                : quote.reason === 'Insufficient gold'
                  ? `Need ${Math.max(0, buyCost - availableGold)}`
                  : quote.reason,
            canBuy,
          };
        });
    };
    const getCityViewUnitOptions = (city: City): CityViewUnitOption[] => (
      ALL_UNIT_TYPES
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
          const blockReason = wonderSystem.getCityWonderBlockReason(city, wonderType, { researchSystem });
          const validCoords = wonderPlacementSystem.getValidPlacementCoords(city, wonderType, mapData);
          let disabled = false;
          let reason: string | undefined;
          if (queuedHere) { disabled = true; reason = 'Already in this queue'; }
          else if (blockReason) { disabled = true; reason = blockReason; }
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

      const corporationOptions: CityViewCorporationOption[] = CORPORATIONS
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
            outputSummary: corporationType.id === AEROSPACE_INDUSTRIES_ID
              ? 'Globally unlocks Aerospace Part manufacturing; founder receives +50% Production for parts.'
              : `Produces ${corporationType.resourcePerBuilding} ${corporationType.manufacturedResourceId} per ${corporationType.productionBuildingId}.`,
            disabled,
            reason,
          };
        });
      // Aerospace Parts are a special global production item rather than a
      // corporation. Keep the initial grid to the twelve actual corporations;
      // the part replaces the founded AeroSpace Industries card once that
      // corporation has unlocked the global space race.
      if (corporationSystem?.isFounded(AEROSPACE_INDUSTRIES_ID)) {
        const aerospaceQueuedHere = productionSystem.getQueue(city.id).some((entry) => (
          entry.item.kind === 'manufacturedResource'
            && entry.item.productionType.id === AEROSPACE_PARTS_ID
        ));
        const aerospaceBlockers = aerospacePartSystem.getCityProductionBlockers(city);
        corporationOptions.push({
          id: AEROSPACE_PARTS_ID,
          spriteId: AEROSPACE_PARTS_ID,
          name: AEROSPACE_PART_PRODUCTION.name,
          cost: productionSystem.getCost({
            kind: 'manufacturedResource',
            productionType: AEROSPACE_PART_PRODUCTION,
          }, city.id),
          turnsRemaining: productionSystem.getTurnsEstimate(city.id, {
            kind: 'manufacturedResource',
            productionType: AEROSPACE_PART_PRODUCTION,
          }),
          description: AEROSPACE_PART_PRODUCTION.description,
          outputSummary: `Produces 1 accumulated Aerospace Part. Current: ${aerospacePartSystem.getQuantity(city.ownerId)}/${victorySystem.getScienceVictorySettings().requiredAerospaceParts}.`,
          disabled: aerospaceQueuedHere || aerospaceBlockers.length > 0,
          reason: aerospaceQueuedHere ? 'Already in this queue' : aerospaceBlockers.join(', ') || undefined,
        });
      }
      return corporationOptions;
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

      if (cityManager.getBuildings(city.id).has(buildingId) || getOccupiedBuildingIds(city).has(buildingId) || isBuildingQueued(city.id, buildingId)) {
        return { ok: false, message: 'That building is already built or under construction in this city.' };
      }

      const building = getBuildingById(buildingId);
      if (!building) return { ok: false, message: 'Unknown building.' };

      if (
        buildingId === GRAND_STADIUM_BUILDING_ID
        && !gamesOfNationsSystem.canCityConstructGrandStadium(city.id, city.ownerId)
      ) {
        return { ok: false, message: 'Grand Stadium is available only in the confirmed Games host city before Competition.' };
      }

      if (building.placement === 'city') {
        productionSystem.enqueue(city.id, { kind: 'building', buildingType: building });
        buildingPlacementSystem.cancelPlacement();
        wonderPlacementSystem.cancelPlacement();
        rightPanel?.requestRefresh();
        refreshOpenCityView();
        return { ok: true };
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
      const blockReason = wonderSystem.getCityWonderBlockReason(city, wonderType, { researchSystem });
      if (blockReason) {
        return { ok: false, message: `This city cannot build that wonder: ${blockReason}.` };
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
      productionPurchaseSystem.purchase(city.id, index);
      rightPanel?.requestRefresh();
    });
    rightPanel.setProductionPurchaseQuoteProvider((cityId, index) =>
      productionPurchaseSystem.getQuote(cityId, index),
    );
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

      const building = getBuildingById(buildingId);
      if (!building) return;
      if (building.placement === 'city') {
        if (!cityManager.getBuildings(city.id).has(buildingId) && !isBuildingQueued(city.id, buildingId)) {
          productionSystem.enqueue(city.id, { kind: 'building', buildingType: building });
        }
        buildingPlacementSystem.cancelPlacement();
        wonderPlacementSystem.cancelPlacement();
        rightPanel?.requestRefresh();
        if (cityView.isAutoCloseEnabled()) {
          closeOpenCityView();
          return;
        }
        cityView.switchToQueueMode();
        refreshOpenCityView();
        return;
      }

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
      const unitType = ALL_UNIT_TYPES.find((candidate) => candidate.id === unitId);
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
      productionPurchaseSystem.purchase(city.id, index);
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
      if (corporationId === AEROSPACE_PARTS_ID) {
        if (!aerospacePartSystem.canCityProduce(city)) {
          refreshOpenCityView();
          return;
        }
        const alreadyQueued = productionSystem.getQueue(city.id).some((entry) => (
          entry.item.kind === 'manufacturedResource'
            && entry.item.productionType.id === AEROSPACE_PARTS_ID
        ));
        if (!alreadyQueued) {
          productionSystem.enqueue(city.id, {
            kind: 'manufacturedResource',
            productionType: AEROSPACE_PART_PRODUCTION,
          });
        }
        rightPanel?.requestRefresh();
        if (cityView.isAutoCloseEnabled()) closeOpenCityView();
        else cityView.switchToQueueMode();
        refreshOpenCityView();
        return;
      }
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
    this.leaderGossipDialog = new LeaderGossipDialog(this, worldInputGate, {
      getNationName: (nationId) => nationManager.getNation(nationId)?.name ?? nationId,
      getNationColor: (nationId) => nationManager.getNation(nationId)?.color ?? 0xf4f1e7,
      getNationSecondaryColor: (nationId) => nationManager.getNation(nationId)?.secondaryColor ?? 0x9a7b3a,
      getAvailableItems: () => GOSSIP_DEFINITIONS,
      getValidTargets: (sourceNationId, recipientNationId) => filterGossipTargets(
        nationManager.getAllNations().flatMap((nation) => {
          const leader = getLeaderByNationId(nation.id);
          return leader ? [{
            nationId: nation.id,
            nationName: nation.name,
            leaderId: leader.id,
            leaderName: leader.name,
            knownToHuman: discoverySystem.hasMet(sourceNationId, nation.id),
          }] : [];
        }),
        sourceNationId,
        recipientNationId,
      ),
      getHumanInfluence: () => nationManager.getResources(data.humanNationId).influence,
      getItemAvailability: (sourceNationId, itemId, recipientNationId) => (
        gossipSystem.getItemAvailability(sourceNationId, itemId, recipientNationId)
      ),
      getKnownSportsPreferences: (sourceNationId, recipientNationId) => (
        gossipSystem.getKnownSportsPreferences(sourceNationId, recipientNationId)
      ),
      getManipulationStatus: (sourceNationId, recipientNationId) => (
        gossipSystem.getManipulationStatus(sourceNationId, recipientNationId)
      ),
      getManipulationCost: (itemId, sourceNationId, influenceTier) => (
        gossipSystem.getManipulationCost(itemId, sourceNationId, influenceTier)
      ),
      getInsultStatus: (sourceNationId, recipientNationId) => (
        gossipSystem.getInsultStatus(sourceNationId, recipientNationId)
      ),
      resolveText: (input) => gossipSystem.resolveText(input),
      execute: (input) => {
        const result = gossipSystem.execute(input);
        if (result.success && result.type === 'insult') {
          recordGossipInsultInHistory(result, historicalTimeline, {
            getNationName: (nationId) => nationManager.getNation(nationId)?.name,
            getLeaderName: (nationId) => getLeaderByNationId(nationId)?.name,
          });
        }
        rightPanel?.requestRefresh();
        return result;
      },
    }, data.humanNationId, {
      onOpened: (nationId) => onAudienceOpened(nationId),
      onClosed: () => onAudienceClosed(),
    });
    rightPanel.setArrangeAudienceHandler((leaderId) => {
      if (this.leaderGossipDialog?.isOpen()) this.leaderGossipDialog.close();
      this.leaderAudienceDialog?.open(leaderId);
    });
    rightPanel.setArrangeGossipHandler((leaderId) => {
      if (this.leaderAudienceDialog?.isOpen()) return;
      this.leaderGossipDialog?.open(leaderId);
    });
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

      if (mode === 'destroyImprovement' || mode === 'destroyBuilding') {
        const selection = selectionManager.getSelected();
        if (selection?.kind !== 'unit' || selection.unit.ownerId !== humanNationId) {
          unitActionToolbox.resetMode();
          return;
        }
        const unit = selection.unit;
        const kind = mode === 'destroyImprovement' ? 'improvement' : 'building';

        // Razing infrastructure executes the destroy and refreshes the affected
        // visuals; reused both for the direct path and after a war declaration.
        const executeDestroy = (): void => {
          const tileX = unit.tileX;
          const tileY = unit.tileY;
          // Captured before razing: razing a Barbarian Camp grants loot gold (0
          // for ordinary city buildings/wonders). Read up-front so we can play
          // the count-up feedback after the structure is gone.
          const buildingLoot = mode === 'destroyBuilding'
            ? infrastructureSabotageSystem.getDestroyBuildingLootGold(unit)
            : 0;
          const razed = mode === 'destroyImprovement'
            ? infrastructureSabotageSystem.destroyImprovement(unit)
            : infrastructureSabotageSystem.destroyBuilding(unit);
          if (razed) {
            if (mode === 'destroyImprovement') {
              tileImprovementOverlayRenderer.refreshTile(tileX, tileY);
            } else {
              tileBuildingRenderer.refreshTile(tileX, tileY);
            }
            unitActionToolbox.refresh();
            turnOrderSystem.refreshActive();
            hudLayer?.refresh();
            rightPanel?.requestRefresh();

            // Loot gold (improvement plunder, or razing a Barbarian Camp) is
            // granted in the sabotage system for human and AI alike. The gold
            // count-up feedback is human-manual-play only: never for AI and never
            // during autoplay/autorun/diagnostic autoplay.
            if (!isAutoplayActive()) {
              if (mode === 'destroyImprovement') {
                hudLayer?.playGoldReward(IMPROVEMENT_DESTRUCTION_LOOT_GOLD);
              } else if (buildingLoot > 0) {
                hudLayer?.playGoldReward(buildingLoot);
              }
            }
          }
        };

        // Razing another nation's infrastructure is an act of war for normal
        // (visible) units — even under open borders. hiddenNation units act
        // deniably (getActOfWarTarget returns undefined), and an existing war
        // needs no fresh declaration: both fall through to a direct destroy.
        const warTarget = infrastructureSabotageSystem.getActOfWarTarget(unit, kind);
        const needsWar = warTarget !== undefined
          && warTarget !== humanNationId
          && !diplomacyManager.canAttack(humanNationId, warTarget);

        if (needsWar) {
          const targetNation = nationManager.getNation(warTarget);
          if (!targetNation) {
            unitActionToolbox.resetMode();
            return;
          }
          if (getPeaceTreatyBlockReason(warTarget)) {
            logBlockedHumanWarDeclaration(warTarget);
            rightPanel?.refreshCurrent();
            unitActionToolbox.resetMode();
            return;
          }
          const targetLabel = kind === 'improvement' ? 'improvement' : 'building';
          showDiplomacyModal({
            title: 'Act of War',
            message: `Destroying ${targetNation.name}'s ${targetLabel} will declare war on ${targetNation.name}. Continue?`,
            accentColor: '#c44',
            confirmLabel: 'Declare War & Destroy',
            cancelLabel: 'Cancel',
            onConfirm: () => {
              if (!diplomacyManager.declareWar(humanNationId, warTarget)) {
                logBlockedHumanWarDeclaration(warTarget);
                rightPanel?.refreshCurrent();
                return;
              }
              executeDestroy();
              rightPanel?.refreshCurrent();
            },
            onCancel: () => {},
          });
          unitActionToolbox.resetMode();
          return;
        }

        executeDestroy();
        unitActionToolbox.resetMode();
        return;
      }

      if (mode === 'repair') {
        const selection = selectionManager.getSelected();
        if (selection?.kind !== 'unit' || selection.unit.ownerId !== humanNationId) {
          unitActionToolbox.resetMode();
          return;
        }
        const unit = selection.unit;
        const tileX = unit.tileX;
        const tileY = unit.tileY;
        if (infrastructureRepairSystem.repair(unit)) {
          // Building/wonder stays on the tile; refresh in case visuals reflect
          // the restored (working) state, plus city yields and HUD.
          tileBuildingRenderer.refreshTile(tileX, tileY);
          unitActionToolbox.refresh();
          turnOrderSystem.refreshActive();
          hudLayer?.refresh();
          rightPanel?.requestRefresh();
        }
        unitActionToolbox.resetMode();
        return;
      }

      if (mode === 'intel') {
        const selection = selectionManager.getSelected();
        if (selection?.kind === 'unit' && selection.unit.ownerId === humanNationId) {
          const unit = selection.unit;
          const city = cityManager.getCityAt(unit.tileX, unit.tileY);
          // Read-only report on the infiltrated city's owning civilization.
          if (rightPanel && city && city.ownerId !== unit.ownerId && unit.unitType.canGatherIntel === true) {
            intelReportDialog.show(rightPanel.buildIntelReport(city.ownerId));
            // Intelligence gathering risks tipping off the target (covert suspicion).
            covertSuspicionSystem.reportIncident({
              attackerNationId: unit.ownerId,
              victimNationId: city.ownerId,
              action: 'spyIntel',
            });
          }
        }
        unitActionToolbox.resetMode();
        return;
      }

      if (mode === 'debark') {
        const selection = selectionManager.getSelected();
        if (selection?.kind === 'unit' && selection.unit.ownerId === humanNationId) {
          const option = getDebarkOption(selection.unit);
          if (option.cargo && option.target) {
            selection.unit.queuedDestination = undefined;
            option.cargo.queuedDestination = undefined;
            reachableTiles = new Set<string>();
            pathPreviewRenderer.clear();
            unitBoardingManager.unboard(option.cargo, option.target.x, option.target.y);
            unitActionToolbox.refresh();
            turnOrderSystem.refreshActive();
            hudLayer?.refresh();
            rightPanel?.requestRefresh();
          }
        }
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
      const technology = getTechnologyById(event.technologyId);
      const reachedEra = recordEraMilestone(
        event.nationId,
        technology ? `technology:${technology.id} (${technology.name})` : `technology:${event.technologyId}`,
      );
      if (reachedEra) gamesOfNationsSystem.handleEraReached(reachedEra, turnManager.getCurrentRound());
      if (event.nationId === humanNationId && isNaturalResourceRevealTechnology(event.technologyId)) {
        naturalResourceRenderer.rebuildAll();
      }
      for (const city of cityManager.getCitiesByOwner(event.nationId)) {
        cityRenderer.refreshCity(city);
      }
      resourceSystem.recalculateForNation(event.nationId);
      happinessSystem.recalculateNation(event.nationId);
      if (event.nationId === humanNationId && !autoplaySystem.isActive()) {
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
      gamesOfNationsSystem.handleCultureCompleted(
        event.nationId,
        event.cultureNode.id,
        turnManager.getCurrentRound(),
      );
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
    let diagnosticContinueAfterVictory = false;
    if (isDevBuild()) {
      // Enable the unbounded full-session log immediately so every entry from
      // game start is captured. The UI still uses the capped getAllEntries() buffer.
      eventLog.enableFullLog();
      const diagnosticsWindow = window as Window & { __epochDiagnostics?: EpochGameDiagnostics };
      diagnosticsWindow.__epochDiagnostics = {
        startAutoplay: (rounds: number, options = {}) => new Promise((resolve) => {
          syncEraMilestoneBaseline();
          diagnosticContinueAfterVictory = options.continueAfterVictory === true;
          const requestedRounds = Math.max(1, Math.floor(rounds));
          this.diagnosticSystem.enableTurnLogging();
          // Resolve on a clean completion (requested rounds reached) OR on a stop —
          // victory stops autoplay early. `settle` guards against a double resolve.
          let settled = false;
          const settle = (): void => {
            if (settled) return;
            settled = true;
            const victoryState = victorySystem.getVictoryState();
            resolve({
              completedRounds: autoplaySystem.getCompletedRounds(),
              victory: victoryState
                ? {
                  nationId: victoryState.nationId,
                  nationName: nationManager.getNation(victoryState.nationId)?.name ?? victoryState.nationId,
                  type: victoryState.type,
                  round: victoryState.round,
                }
                : null,
            });
          };
          autoplaySystem.onCompleted(settle);
          autoplaySystem.onStopped(settle);
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
          if (!eraMilestoneBaselineInitialized) syncEraMilestoneBaseline();
          const currentNation = turnManager.getCurrentNation();
          const allNations = nationManager.getAllNations();
          const gameDate = turnManager.getGameDate();
          // Per-nation progression snapshot. Deterministic and read-only — purely
          // derived from current entity/system state so it is stable across long
          // autorun sessions and safe to call at any point.
          const nations: EpochNationStateSummary[] = allNations.map((nation) => {
            const cities = cityManager.getCitiesByOwner(nation.id);
            const currency = currencySystem.getCurrencyState(nation.id);
            const currentResearch = researchSystem.getCurrentResearch(nation.id);
            const researchTimeline = currentResearch
              ? researchSystem.getAheadOfTimeCostDetails(currentResearch.id)
              : undefined;
            const cityIntegration = getNationCityIntegrationCounts(
              nation.id,
              cityManager,
              turnManager.getCurrentRound(),
            );
            const culturalVictory = victorySystem.getCulturalVictoryProgress(nation.id);
            return {
              id: nation.id,
              name: nation.name,
              isHuman: nation.isHuman,
              era: eraSystem.getNationEra(nation.id),
              technologyCount: nation.researchedTechIds.length,
              cultureNodeCount: nation.unlockedCultureNodeIds.length,
              currentResearch: currentResearch?.name ?? null,
              currentResearchEffectiveCost: currentResearch
                ? researchSystem.getEffectiveCost(currentResearch.id)
                : null,
              currentResearchTimeline: currentResearch && researchTimeline
                ? {
                  technologyEra: currentResearch.era,
                  currentYear: researchTimeline.currentYear,
                  eraStartYear: researchTimeline.eraStartYear,
                  yearsAhead: researchTimeline.yearsAhead,
                  multiplier: researchTimeline.multiplier,
                }
                : null,
              sciencePerTurn: researchSystem.getResearchPerTurn(nation.id),
              currentCulture: cultureSystem.getCurrentCultureNode(nation.id)?.name ?? null,
              cityCount: cities.length,
              population: cities.reduce((sum, city) => sum + city.population, 0),
              currency: currency
                ? {
                  name: currency.currencyName,
                  symbol: currency.currencySymbol,
                  strength: currency.strength,
                  treasury: currency.treasury,
                }
                : null,
              cityIntegration,
              culturalVictory: {
                normalRequirementsMet: culturalVictory.normalRequirementsMet,
                latestCompletedGamesNumber: culturalVictory.latestCompletedGamesNumber,
                reigningGamesChampionNationId: culturalVictory.reigningGamesChampionNationId,
                isReigningGamesChampion: culturalVictory.isReigningGamesChampion,
                victoryEligible: culturalVictory.victoryEligible,
              },
            };
          });
          const victoryState = victorySystem.getVictoryState();
          const victory = victoryState
            ? {
              nationId: victoryState.nationId,
              nationName: nationManager.getNation(victoryState.nationId)?.name ?? victoryState.nationId,
              type: victoryState.type,
              round: victoryState.round,
            }
            : null;
          return {
            currentRound: turnManager.getCurrentRound(),
            currentNationId: currentNation.id,
            currentNationName: currentNation.name,
            nationCount: allNations.length,
            cityCount: cityManager.getAllCities().length,
            unitCount: unitManager.getAllUnits().length,
            worldYear: gameDate.signedYear,
            worldYearLabel: turnManager.getGameDateLabel(),
            scenario: data.mapKey,
            victory,
            gamesOfNations: gamesOfNationsSystem.getSummary(),
            nations,
            eraMilestones: [...eraMilestones],
          };
        },
        getSaveState: () => SaveLoadService.serialize({
          mapKey: data.mapKey,
          generatedScenario: data.generatedScenario,
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
          gossipSystem,
          gossipFlavorEventSystem,
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
          aerospacePartSystem,
          worldMarkerSystem,
          foreignTroopViolationSystem,
          historicalTimeline,
          newspaperSystem,
          gamesOfNationsSystem,
          covertSuspicionSystem,
          victorySystem,
          worldCouncilSystem,
          guideProgress: guideProgression.getState(),
        }),
        focusFirstCity: (zoom = 2) => {
          const city = cityManager.getAllCities()[0];
          if (!city) return { ok: false };
          const world = tileMap.tileToWorld(city.tileX, city.tileY);
          this.cameraController.focusOn(world.x, world.y, zoom);
          return { ok: true };
        },
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

    // Experimental developer cheat: reload the game as another nation. Shows a
    // confirmation modal first and only reloads the scene on confirm — it never
    // switches ownership live (see `playas` in CheatSystem).
    const switchHumanPlayerConfirmDialog = new ConfirmDialog();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => switchHumanPlayerConfirmDialog.shutdown());
    const switchHumanPlayerForCheat = (targetNationId: string): string => {
      const targetName = nationManager.getNation(targetNationId)?.name ?? targetNationId;
      if (targetNationId === humanNationId) {
        return `Already playing as ${targetName}.`;
      }
      const currentName = humanNationId
        ? nationManager.getNation(humanNationId)?.name ?? humanNationId
        : 'observer';

      switchHumanPlayerConfirmDialog.show({
        title: 'Switch Human Player',
        body: [
          'This is an experimental developer feature.',
          `The current game will be reloaded and you will continue playing as ${targetName}.`,
          'This functionality is intended for testing and debugging purposes and may expose edge cases that are not normally encountered during gameplay.',
          'Do you want to continue?',
        ],
        confirmLabel: 'Continue',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          const saved = serializeCurrentGame();
          const switched: SavedGameState = {
            ...saved,
            humanNationId: targetNationId,
            nations: saved.nations.map((nation) => ({
              ...nation,
              isHuman: nation.id === targetNationId,
            })),
          };
          console.log(`Developer action: Human player switched from ${currentName} to ${targetName}.`);
          this.scene.start('GameScene', {
            mapKey: switched.mapKey,
            humanNationId: switched.humanNationId,
            activeNationIds: switched.activeNationIds,
            resourceAbundance: 'normal',
            gameSpeedId: switched.gameSpeedId ?? DEFAULT_GAME_SPEED_ID,
            savedState: switched,
          });
        },
      });

      return `Confirm to switch human player to ${targetName}.`;
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
      switchHumanPlayer: switchHumanPlayerForCheat,
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
      this.leaderGossipDialog?.destroy();
      this.leaderGossipDialog = null;
      leaderStrip?.shutdown();
      cheatConsole.shutdown();
    });

    // Victory overlay
    victorySystem.onVictory((nationId, type) => {
      const wasAutoplayActive = autoplaySystem.isActive();
      const finalIssue = newspaperSystem.consumeVictoryIssue({
        round: turnManager.getCurrentRound(),
        worldYear: turnManager.getGlobalYear(),
        dateLabel: turnManager.getGameDateLabel(),
        nationId,
        victoryType: type,
      });
      if (diagnosticContinueAfterVictory && wasAutoplayActive) return;
      turnManager.stop();
      // Halt an in-progress autorun/autoplay so the session ends cleanly the moment
      // a nation wins, instead of running out the remaining requested rounds.
      if (autoplaySystem.isActive()) autoplaySystem.stop();

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
          ? `Cultural Victory\n${nationName} has achieved global cultural preeminence.`
          : type === 'diplomatic'
            ? `Diplomatic Victory\n${nationName} commands global influence.`
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

      const archiveButton = this.add.text(width / 2, height / 2 + 78, 'Newspaper Archive', {
          fontSize: '17px',
          fontStyle: 'bold',
          color: '#f0dfb5',
          backgroundColor: '#332b20',
          padding: { x: 14, y: 8 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(202)
        .setInteractive({ useHandCursor: true });
      archiveButton.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        newspaperDialog.showArchive(newspaperSystem.getIssues());
      });

      // Block further input on the overlay
      overlay.setInteractive();

      // Human non-domination victory: also show the modal popup
      if ((type === 'science' || type === 'cultural' || type === 'diplomatic') && !wasAutoplayActive && nationId === humanNationId) {
        showDiplomacyModal({
          title: type === 'science'
            ? 'Science Victory'
            : type === 'cultural'
              ? 'Cultural Victory'
              : 'Diplomatic Victory',
          message: type === 'science'
            ? `${nationName} has completed its aerospace program.`
            : type === 'cultural'
              ? `${nationName} commands the world's World Wonders.`
              : `${nationName} commands global influence.`,
          accentColor: type === 'science' ? '#4af' : type === 'cultural' ? '#c084fc' : '#a7f3d0',
          confirmLabel: 'Continue',
          cancelLabel: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      }
      if (!wasAutoplayActive && !this.diagnosticSystem.isTurnLoggingEnabled()) {
        newspaperDialog.show(finalIssue, { archive: newspaperSystem.getIssues() });
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
        gossipSystem,
        gossipFlavorEventSystem,
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
        aerospacePartSystem,
        worldMarkerSystem,
        foreignTroopViolationSystem,
        historicalTimeline,
        newspaperSystem,
        gamesOfNationsSystem,
        covertSuspicionSystem,
        worldCouncilSystem,
      });
      resourceAccessSystem.invalidateResourceIndex();
      updateFog();
      // Older saves only persist tile.improvementConstruction; recompute
      // the unit-side mirror so the worker shows its build sprite + %.
      improvementConstructionSystem.syncUnitsFromTiles();
      builderSystem.rebuildConstructionIndex();

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
      currencySystem.initializeAfterLoad(turnManager.getCurrentRound());
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
          generatedScenario: data.generatedScenario,
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
          gossipSystem,
          gossipFlavorEventSystem,
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
          aerospacePartSystem,
          worldMarkerSystem,
          foreignTroopViolationSystem,
          historicalTimeline,
          newspaperSystem,
          gamesOfNationsSystem,
          covertSuspicionSystem,
          victorySystem,
          worldCouncilSystem,
          guideProgress: guideProgression.getState(),
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

    const settingsDialog = new SettingsDialog({
      music: SetupMusicManager.getShared(),
      // Enabling Auto End Turn mid-turn should take effect right away if nothing
      // currently needs orders.
      onAutoEndTurnChanged: () => maybeAutoEndTurn(),
    });
    // All manual save triggers (Escape menu, Ctrl+S) route through a single
    // shared flow: serialize the live game, then download under the name the
    // player confirms in the dialog.
    const serializeCurrentGame = (): SavedGameState =>
      SaveLoadService.serialize({
        mapKey: data.mapKey,
        generatedScenario: data.generatedScenario,
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
        gossipSystem,
        gossipFlavorEventSystem,
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
        aerospacePartSystem,
        worldMarkerSystem,
        foreignTroopViolationSystem,
        historicalTimeline,
        newspaperSystem,
        gamesOfNationsSystem,
        covertSuspicionSystem,
        victorySystem,
        worldCouncilSystem,
        guideProgress: guideProgression.getState(),
      });
    const saveGameDialog = new SaveGameDialog({
      onConfirm: (filename) => {
        downloadCurrentSaveGame(serializeCurrentGame(), filename);
      },
    });
    const openSaveGameDialog = (): void => {
      if (saveGameDialog.isOpen()) return;
      saveGameDialog.show(buildDefaultSaveFilename(data.mapKey));
    };
    const escapeMenu = new EscapeMenu(
      {
        onSave: () => {
          // Leave the menu open behind the dialog so Cancel returns to it.
          openSaveGameDialog();
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
          escapeMenu.close();
          this.tutorialWizard?.openManual();
        },
        onSettings: () => {
          // Open Settings over the pause menu; closing it returns to the menu.
          settingsDialog.show();
        },
      },
    );

    const onKeyEscape = () => {
      if (this.tutorialWizard?.isActive()) {
        this.tutorialWizard.close();
        return;
      }
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
    // Ctrl+S opens the same save dialog as the Escape menu's save action.
    // preventDefault stops the browser's "save page" dialog.
    const onKeyCtrlS = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      openSaveGameDialog();
    };
    this.input.keyboard?.on('keydown-ESC', onKeyEscape);
    this.input.keyboard?.on('keydown-Q', onKeyCtrlQ);
    this.input.keyboard?.on('keydown-S', onKeyCtrlS);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', onKeyEscape);
      this.input.keyboard?.off('keydown-Q', onKeyCtrlQ);
      this.input.keyboard?.off('keydown-S', onKeyCtrlS);
      escapeMenu.shutdown();
      saveGameDialog.shutdown();
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
      const cityViewZoom = 2.0;
      const viewportWidth = window.innerWidth;
      const panelWidth = viewportWidth <= 900
        ? Math.max(0, viewportWidth - 24)
        : Math.min(760, viewportWidth * 0.64);
      const panelMargin = 24;
      const cityToPanelGap = 28 + 34;
      const preferredCityScreenX = Math.max(
        panelMargin + 34,
        Math.min(
          viewportWidth / 2,
          viewportWidth - panelMargin - panelWidth - cityToPanelGap,
        ),
      );
      const focusOffsetWorldX = (viewportWidth / 2 - preferredCityScreenX) / cityViewZoom;
      this.cameraController.focusOn(x + focusOffsetWorldX, y, cityViewZoom);
      cityView.show(
        city,
        getCityViewUnitOptions(city),
        getCityViewBuildingOptions(city),
        getCityViewPlacementPanelState(city),
        getCityViewTilePurchaseState(city),
        getCityViewWonderOptions(city),
        getCityViewCorporationOptions(city),
        getCityViewQueueItems(city),
        // Resolve after Phaser has applied camera bounds for this frame. Near
        // map edges, calculating this eagerly points at the requested camera
        // centre rather than the city's final on-screen position.
        () => worldToScreen(this.cameras.main, x, y),
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
    // Keep the guide panel responsive and anchored to startup-guide targets.
    this.tutorialWizard?.update();
    this.diagnosticSystem.update();
  }

  /**
   * Wires the separate new-game introduction and deterministic progressive
   * tips to the reused guide panel.
   */
  private setupProgressiveGuide(deps: {
    humanNationId: string | undefined;
    unitManager: UnitManager;
    tileMap: TileMap;
    hudLayer: HudLayer;
    worldInputGate: WorldInputGate;
    selectionManager: SelectionManager;
    focusUnit: (unit: Unit) => void;
    turnManager: TurnManager;
    isAutoplayActive: () => boolean;
    savedProgress: SavedGuideProgress | undefined;
    savedRound: number;
    isFreshGame: boolean;
    enabledVictories: EnabledVictoryConditions;
    requiredAerospaceParts: number;
  }): GuideProgression {
    const tips = buildProgressiveGuideTips({
      enabledVictories: deps.enabledVictories,
      requiredAerospaceParts: deps.requiredAerospaceParts,
    });
    const progression = GuideProgression.fromSave(
      tips.length,
      deps.savedProgress,
      deps.savedRound,
    );

    const humanUnits = deps.humanNationId === undefined
      ? []
      : deps.unitManager.getUnitsByOwner(deps.humanNationId);
    const startingSettlerId = humanUnits.find((unit) => unit.unitType.canFound)?.id;
    const startingScoutId = humanUnits.find(
      (unit) => unit.unitType.category === 'recon' || unit.unitType.category === 'naval_recon',
    )?.id;
    const unitTargetRect = (unitId: string | undefined): ScreenRect | null => {
      if (unitId === undefined) return null;
      const unit = deps.unitManager.getUnit(unitId);
      if (!unit) return null;
      const world = deps.tileMap.tileToWorld(unit.tileX, unit.tileY);
      const camera = this.cameras.main;
      const centerX = (world.x - camera.worldView.x) * camera.zoom;
      const centerY = (world.y - camera.worldView.y) * camera.zoom;
      const size = Math.max(deps.tileMap.getTileSize() * camera.zoom, 32);
      if (
        centerX < -size || centerY < -size
        || centerX > this.scale.width + size || centerY > this.scale.height + size
      ) return null;
      return { centerX, centerY, width: size, height: size };
    };
    const selectUnitById = (unitId: string | undefined): void => {
      if (unitId === undefined || deps.humanNationId === undefined) return;
      const unit = deps.unitManager.getUnit(unitId);
      if (!unit || unit.ownerId !== deps.humanNationId) return;
      const current = deps.selectionManager.getSelected();
      if (current?.kind === 'unit' && current.unit.id === unit.id) {
        deps.selectionManager.clearSelection();
      }
      deps.focusUnit(unit);
    };
    const startupSteps: StartupGuideStep[] = [
      {
        title: 'Your Settler',
        text: 'This is your Settler. Settlers are used to found new cities and begin expanding your civilization.',
        onEnter: () => selectUnitById(startingSettlerId),
        resolveTarget: () => unitTargetRect(startingSettlerId),
      },
      {
        title: 'Found City',
        text: 'Units have different action buttons depending on what they are capable of doing. The Settler can found a city.',
        onEnter: () => selectUnitById(startingSettlerId),
        resolveTarget: () => deps.hudLayer.getUnitActionButtonRect('found'),
      },
      {
        title: 'Your Scout',
        text: 'Scouts are used to explore the world and discover cities, resources, natural wonders and other civilizations. Scouts can also be automated.',
        onEnter: () => selectUnitById(startingScoutId),
        resolveTarget: () => unitTargetRect(startingScoutId),
      },
      {
        title: 'Automated Scouting',
        text: 'Automated scouting allows the Scout to explore on its own using the same exploration logic used by AI scouts.',
        onEnter: () => selectUnitById(startingScoutId),
        resolveTarget: () => deps.hudLayer.getUnitActionButtonRect('explore'),
      },
      {
        title: 'Next Turn',
        text: 'End your current turn and let all other civilizations act. Normally you press this once you have finished giving orders (or press Return / Enter). If you prefer, enable Auto End Turn in Settings — then the game advances the turn for you automatically once no units need orders.',
        resolveTarget: () => deps.hudLayer.getEndTurnButtonRect(),
      },
      {
        title: 'Gold',
        text: 'Gold is used to support your civilization. Military units require maintenance, so running out of gold can become a serious problem.',
        placement: 'below',
        resolveTarget: () => deps.hudLayer.getResourceEntryRect('gold'),
      },
      {
        title: 'Unit Focus',
        text: 'Clicking the active unit toggles unit focus on and off. When a unit is inactive you can freely inspect cities, tiles and other units without issuing movement orders.',
        onEnter: () => selectUnitById(startingSettlerId),
        resolveTarget: () => unitTargetRect(startingSettlerId),
      },
      {
        title: 'Start Guide Settings',
        text: 'You can turn this start guide off or on at any time in Settings. In game, open Settings from the pause menu.',
        resolveTarget: () => null,
      },
    ];

    this.tutorialWizard = new TutorialWizard(
      this,
      deps.hudLayer.getOwnedObjectAttacher(),
      deps.worldInputGate,
      tips,
      {
        onClose: (mode) => {
          if (mode === 'startup') selectUnitById(startingSettlerId);
        },
      },
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tutorialWizard?.destroy();
      this.tutorialWizard = null;
    });

    if (deps.isFreshGame && startingSettlerId !== undefined && !isTutorialDontShowAgain()) {
      this.tutorialWizard.openStartup(startupSteps);
    }

    if (deps.humanNationId !== undefined) {
      deps.turnManager.on('turnEnd', (event) => {
        if (event.nation.id !== deps.humanNationId) return;
        const dueTipIndex = progression.completeHumanTurn();
        if (dueTipIndex === null) return;
        if (deps.isAutoplayActive() || isTutorialDontShowAgain()) return;
        this.tutorialWizard?.openAutomaticTip(dueTipIndex);
      });
    }

    return progression;
  }

  private findUnitPlacementTile(
    tileMap: TileMap,
    unitManager: UnitManager,
    city: City,
    unitType: UnitType,
    gridSystem: IGridSystem,
  ): { x: number; y: number } | null {
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

/** Default filename proposed in the save dialog and used as fallback. */
function buildDefaultSaveFilename(mapKey: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `epoch-save-${mapKey}-${ts}.json`;
}

/** Serialize-free download of an already-built save state under a chosen name. */
function downloadCurrentSaveGame(state: SavedGameState, filename: string): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

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
    case 'manufacturedResource':
      return item.productionType.name;
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
    case 'manufacturedResource':
      return getCorporationSpritePath(AEROSPACE_PARTS_ID);
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
    screenX: camera.x + (worldX - camera.worldView.x) * camera.zoom,
    screenY: camera.y + (worldY - camera.worldView.y) * camera.zoom,
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

function formatWorldCouncilVoteSummary(
  votes: ReadonlyArray<{ readonly support: boolean; readonly influence: number }>,
): string {
  const support = votes
    .filter((vote) => vote.support)
    .reduce((sum, vote) => sum + vote.influence, 0);
  const oppose = votes
    .filter((vote) => !vote.support)
    .reduce((sum, vote) => sum + vote.influence, 0);
  return `Influence vote: ${support} for, ${oppose} against.`;
}
