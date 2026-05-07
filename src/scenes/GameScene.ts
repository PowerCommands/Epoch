import Phaser from 'phaser';
import { TileMap } from '../systems/TileMap';
import { ScenarioLoader } from '../systems/ScenarioLoader';
import { CameraController } from '../systems/CameraController';
import { SelectionManager } from '../systems/SelectionManager';
import { NationManager } from '../systems/NationManager';
import { CityManager } from '../systems/CityManager';
import { UnitManager } from '../systems/UnitManager';
import { TurnManager } from '../systems/TurnManager';
import { ResourceSystem } from '../systems/ResourceSystem';
import { UnitUpkeepSystem } from '../systems/UnitUpkeepSystem';
import { ImprovementConstructionSystem } from '../systems/ImprovementConstructionSystem';
import { TradeDealSystem } from '../systems/TradeDealSystem';
import { ResourceAccessSystem } from '../systems/ResourceAccessSystem';
import { ExplorationMemorySystem } from '../systems/ExplorationMemorySystem';
import { NaturalResourceSystem } from '../systems/NaturalResourceSystem';
import { NaturalResourceRenderer } from '../systems/NaturalResourceRenderer';
import { HappinessSystem } from '../systems/HappinessSystem';
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
import { RangedPreviewRenderer } from '../systems/RangedPreviewRenderer';
import { TurnOrderSystem } from '../systems/TurnOrderSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { CityWorkTileRenderer } from '../systems/CityWorkTileRenderer';
import { CultureClaimTileRenderer } from '../systems/CultureClaimTileRenderer';
import { BuildingPlacementSystem } from '../systems/BuildingPlacementSystem';
import { WonderPlacementSystem } from '../systems/WonderPlacementSystem';
import { CityTerritorySystem } from '../systems/CityTerritorySystem';
import { CityViewInteractionController } from '../systems/CityViewInteractionController';
import { getCityViewTileBreakdown } from '../systems/CityViewData';
import { CityViewRenderer, type CityViewPlacementRenderState } from '../systems/CityViewRenderer';
import { DiplomacyManager } from '../systems/DiplomacyManager';
import { DiplomaticMemorySystem } from '../systems/diplomacy/DiplomaticMemorySystem';
import { DiplomaticEvaluationSystem } from '../systems/diplomacy/DiplomaticEvaluationSystem';
import { DiplomaticProposalSystem } from '../systems/diplomacy/DiplomaticProposalSystem';
import { NATURAL_RESOURCES, getNaturalResourceById } from '../data/naturalResources';
import { AIDiplomacySystem } from '../systems/ai/AIDiplomacySystem';
import { AIExplorationSystem } from '../systems/ai/AIExplorationSystem';
import { AIPolicySystem } from '../systems/ai/AIPolicySystem';
import { AIMilitaryEvaluationSystem } from '../systems/ai/AIMilitaryEvaluationSystem';
import { AIMilitaryThreatEvaluationSystem } from '../systems/ai/AIMilitaryThreatEvaluationSystem';
import { createAILogFormatter } from '../systems/ai/AILogFormatter';
import { DiscoverySystem } from '../systems/DiscoverySystem';
import { EventLogSystem } from '../systems/EventLogSystem';
import { EraSystem } from '../systems/EraSystem';
import { AISystem } from '../systems/AISystem';
import { getLeaderByNationId } from '../data/leaders';
import { resolveLeaderEraStrategy } from '../data/aiLeaderEraStrategies';
import { FoundCitySystem } from '../systems/FoundCitySystem';
import { VictorySystem } from '../systems/VictorySystem';
import { BuilderSystem } from '../systems/BuilderSystem';
import { CheatSystem } from '../systems/CheatSystem';
import { AutoplaySystem } from '../systems/AutoplaySystem';
import { AutoplayHud } from '../ui/hud/AutoplayHud';
import { DiagnosticSystem } from '../systems/DiagnosticSystem';
import { calculateCityEconomy } from '../systems/CityEconomy';
import { CityBannerRenderer } from '../systems/CityBannerRenderer';
import { SetupMusicManager } from '../systems/SetupMusicManager';
import { TileBuildingRenderer } from '../systems/TileBuildingRenderer';
import { TileImprovementOverlayRenderer } from '../renderers/TileImprovementOverlayRenderer';
import { TimeSystem } from '../systems/TimeSystem';
import { getEstimatedEraFromProgress } from '../data/eraTimeline';
import { WonderSystem } from '../systems/WonderSystem';
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
import { CityView, type CityViewBuildingOption, type CityViewPlacementPanelState, type CityViewQueueItem, type CityViewUnitOption, type CityViewWonderOption } from '../ui/CityView';
import type { CityViewTilePurchaseState } from '../ui/CityView';
import type { AIDiplomacyAction } from '../types/aiDiplomacy';
import { ALL_WONDERS, getWonderById } from '../data/wonders';
import type { Producible } from '../types/producible';
import { HudLayer } from '../ui/hud/HudLayer';
import type { DiscoveryPopupData, DiscoveryPopupRow } from '../ui/hud/DiscoveryPopup';
import { UnitHoverDiagnosticHud } from '../ui/hud/UnitHoverDiagnosticHud';
import { MinimapHud } from '../ui/hud/MinimapHud';
import { NationHudDataProvider } from '../ui/hud/NationHudDataProvider';
import { RightSidebarPanel } from '../ui/phaser/RightSidebarPanel';
import { RightSidebarPanelDataProvider } from '../ui/phaser/RightSidebarPanelDataProvider';
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
import { TileType } from '../types/map';
import type { ScenarioData } from '../types/scenario';
import type { City } from '../entities/City';
import type { Nation } from '../entities/Nation';
import type { Unit } from '../entities/Unit';
import type { UnitType } from '../entities/UnitType';
import type { Selectable } from '../types/selection';
import type { GameConfig } from '../types/gameConfig';
import { DEFAULT_GAME_SPEED_ID, getGameSpeedById } from '../data/gameSpeeds';

/**
 * GameScene — huvudspelscenen.
 * Orkestrerar karta, nationer, städer, enheter, turordning, resurser,
 * produktion, byggnader, strid, läkning, AI, stadsgrundning,
 * kamerakontroll, selection och HUD.
 */
export class GameScene extends Phaser.Scene {
  private cameraController!: CameraController;
  private diagnosticSystem!: DiagnosticSystem;
  private timeSystem!: TimeSystem;
  private minimapHud: MinimapHud | null = null;
  private rightSidebarPanel: RightSidebarPanel | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data: GameConfig): void {
    this.minimapHud = null;
    this.rightSidebarPanel = null;
    // ─── Data & system ───────────────────────────────────────────────────────

    // 1. Parse scenario using map key from config
    const scenarioJson = this.cache.json.get(data.mapKey) as ScenarioData;
    const scenario = ScenarioLoader.parse(scenarioJson);
    const mapData = scenario.mapData;
    const gridSystem = new HexGridSystem();
    const gridLayout = new HexGridLayout();
    const resourceAbundance = data.resourceAbundance ?? 'normal';
    const gameSpeed = getGameSpeedById(data.savedState?.gameSpeedId ?? data.gameSpeedId ?? DEFAULT_GAME_SPEED_ID);
    const autofocusOnEndTurn = data.autofocusOnEndTurn ?? true;

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
    new HexEdgeOverlayRenderer(this, tileMap, mapData, { depth: 2, passes: COAST_EDGE_PASSES });

    // 4c. Render biome edge overlays (depth 3) — forest tree-line against
    // plains and mountain ridge against surrounding non-mountain land.
    new HexEdgeOverlayRenderer(this, tileMap, mapData, { depth: 3, passes: BIOME_EDGE_PASSES });

    // 4d. Render natural resources above terrain and below borders/units.
    const naturalResourceRenderer = new NaturalResourceRenderer(this, tileMap, mapData);

    // 5. Render border-only territory visualization.
    const territoryRenderer = new TerritoryRenderer(this, tileMap, nationManager, mapData, gridSystem);
    territoryRenderer.render();

    // 6. Create cities from scenario (filtered)
    const cityManager = CityManager.loadFromScenario(activeCities, mapData);
    for (const city of cityManager.getAllCities()) {
      cityTerritorySystem.initializeOwnedTiles(city, mapData, gridSystem);
    }

    // 7. Create units from scenario (filtered)
    const unitManager = UnitManager.loadFromScenario(activeUnits, mapData, gameSpeed);
    // Enrich unit events with cityId (used by right-side details refreshes).
    unitManager.setCityLocator((x, y) => cityManager.getCityAt(x, y)?.id);

    // 7. Kamerakontroll
    const { width: worldWidth, height: worldHeight } = tileMap.getWorldBounds();
    const overviewZoom = this.getMapCoverZoom(worldWidth, worldHeight);
    const worldInputGate = new WorldInputGate();
    this.cameraController = new CameraController(this, worldWidth, worldHeight, worldInputGate, overviewZoom);
    this.timeSystem = new TimeSystem(gameSpeed);

    // 8. Rendera städer (depth 15)
    const cityRenderer = new CityRenderer(this, tileMap, cityManager, nationManager);

    // 9. Rendera enheter (depth 18)
    const unitRenderer = new UnitRenderer(this, tileMap, unitManager, nationManager, mapData);

    // 10. Starta i en overview som täcker hela canvasen.
    this.cameras.main.setZoom(overviewZoom);
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);

    // 11. Turordning
    const turnManager = new TurnManager(nationManager);

    // 11b. Discovery system — tracks which nations have met each other
    const discoverySystem = new DiscoverySystem(
      nationManager, cityManager, unitManager, gridSystem,
    );
    discoverySystem.scan();

    // 11c. Event log — strategic history filtered by discovery
    const eventLog = new EventLogSystem(discoverySystem, data.humanNationId);
    const policySystem = new PolicySystem(nationManager);
    const wonderSystem = new WonderSystem();
    const territoryExpansionBonusSystem = new TerritoryExpansionBonusSystem(gridSystem, cityTerritorySystem);
    let getAvailableLuxuryResourceQuantities: (
      nationId: string,
    ) => ReadonlyArray<{ readonly resourceId: string; readonly quantity: number }> = () => [];
    let getCityFoodSurplus: (
      city: City,
    ) => number = () => 0;
    let cultureEffectSystem: CultureEffectSystem;
    const happinessSystem = new HappinessSystem(
      nationManager,
      cityManager,
      (nationId) => wonderSystem.getNationModifiers(nationId),
      (nationId) => getAvailableLuxuryResourceQuantities(nationId),
      (city) => getCityFoodSurplus(city),
      policySystem,
      (nationId) => cultureEffectSystem?.getCultureHappinessBonus(nationId) ?? 0,
    );
    const eraSystem = new EraSystem(nationManager);
    const formatLog = createAILogFormatter({
      nationManager,
      turnManager,
      eraSystem,
      happinessSystem,
    });
    const isAINation = (nationId: string): boolean => nationManager.getNation(nationId)?.isHuman === false;
    const cultureSystem = new CultureSystem(
      nationManager,
      eventLog,
      () => turnManager.getCurrentRound(),
      undefined,
      gameSpeed,
      undefined,
      formatLog,
      (nationId) => happinessSystem.getNetHappiness(nationId),
    );
    cultureEffectSystem = new CultureEffectSystem(
      nationManager,
      eventLog,
      () => turnManager.getCurrentRound(),
      (nationId) => happinessSystem.getNetHappiness(nationId),
      formatLog,
    );
    const humanNeedsCultureSelection = (): boolean => {
      if (!humanNationId) return false;
      return !cultureSystem.getCurrentCultureNode(humanNationId)
        && cultureSystem.getAvailableCultureNodes(humanNationId).length > 0;
    };
    let getTradeGoldPerTurnDelta: (nationId: string) => number = () => 0;
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
    );
    getCityFoodSurplus = (city) => resourceSystem.getFoodSurplus(city);
    const unitUpkeepSystem = new UnitUpkeepSystem(
      nationManager,
      unitManager,
      resourceSystem,
      mapData,
      policySystem,
    );
    turnManager.on('turnStart', (e) => unitUpkeepSystem.handleTurnStart(e));

    // 12. Selection-system (hover depth 20, selection depth 21)
    const selectionManager = new SelectionManager(
      this, tileMap, this.cameraController, cityManager, unitManager, worldInputGate,
    );
    const pathfindingSystem = new PathfindingSystem(mapData, unitManager, gridSystem, nationManager);
    const pathPreviewRenderer = new PathPreviewRenderer(this, tileMap);
    const rangedPreviewRenderer = new RangedPreviewRenderer(this, tileMap);
    const productionSystem = new ProductionSystem(cityManager, turnManager, happinessSystem, gameSpeed, policySystem);
    const cityBannerRenderer = new CityBannerRenderer(
      this,
      tileMap,
      cityManager,
      nationManager,
      productionSystem,
      wonderSystem,
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
    const cityView = new CityView();
    let cityViewDismissedCityId: string | null = null;

    // 13b. Diplomacy system
    const diplomacyManager = new DiplomacyManager(turnManager);
    const diplomaticMemorySystem = new DiplomaticMemorySystem(diplomacyManager);
    diplomacyManager.attachMemoryHook(diplomaticMemorySystem);
    const diplomaticEvaluationSystem = new DiplomaticEvaluationSystem(diplomacyManager);
    const aiMilitaryEvaluationSystem = new AIMilitaryEvaluationSystem(unitManager, cityManager);
    const aiMilitaryThreatEvaluationSystem = new AIMilitaryThreatEvaluationSystem(unitManager, cityManager, gridSystem);
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
    const resourceAccessSystem = new ResourceAccessSystem(mapData, tradeDealSystem);
    getAvailableLuxuryResourceQuantities = (nationId) =>
      resourceAccessSystem.getAvailableLuxuryResourceQuantities(nationId);
    happinessSystem.recalculateAll();
    const strategicResourceCapacitySystem = new StrategicResourceCapacitySystem(resourceAccessSystem, unitManager);
    const unitProductionRuleContext = { strategicResourceCapacitySystem };
    tradeDealSystem.setCanExportResource((sellerNationId, resourceId) =>
      resourceAccessSystem.canExportResource(sellerNationId, resourceId),
    );
    turnManager.on('turnStart', (e) => tradeDealSystem.advanceTurnForNation(e.nation.id));
    diplomacyManager.onWarDeclared((aggressorId, targetId) => {
      tradeDealSystem.cancelDealsBetween(aggressorId, targetId, 'war');
    });
    tradeDealSystem.onChanged((event) => {
      resourceSystem.recalculateForNation(event.deal.sellerNationId);
      resourceSystem.recalculateForNation(event.deal.buyerNationId);
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });

    const diplomaticProposalSystem = new DiplomaticProposalSystem();

    turnManager.on('turnStart', (e) => diplomaticProposalSystem.update(e.round));

    diplomaticProposalSystem.onCreated((proposal) => {
      if (proposal.toNationId !== humanNationIdForDiplomacy) return;
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
          tradeDealSystem.createDeal({
            sellerNationId: fromId,
            buyerNationId: toId,
            resourceId: proposal.payload.resourceId,
            turns: proposal.payload.turns,
            goldPerTurn: proposal.payload.goldPerTurn,
          });
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
      const text = `${toName} accepted ${formatProposalKind(proposal.payload.kind)} from ${fromName}.`;
      eventLog.log(
        isAINation(fromId) ? formatLog(fromId, `${toName} accepted ${formatProposalKind(proposal.payload.kind)}.`) : text,
        [fromId, toId],
        turnManager.getCurrentRound(),
      );
    });
    diplomaticProposalSystem.onRejected((proposal) => {
      const fromName = nationManager.getNation(proposal.fromNationId)?.name ?? proposal.fromNationId;
      const toName = nationManager.getNation(proposal.toNationId)?.name ?? proposal.toNationId;
      const text = `${toName} rejected ${formatProposalKind(proposal.payload.kind)} from ${fromName}.`;
      eventLog.log(
        isAINation(proposal.fromNationId) ? formatLog(proposal.fromNationId, `${toName} rejected ${formatProposalKind(proposal.payload.kind)}.`) : text,
        [proposal.fromNationId, proposal.toNationId],
        turnManager.getCurrentRound(),
      );
    });
    aiDiplomacySystem.onDecision((reason) => {
      const targetName = nationManager.getNation(reason.targetNationId)?.name ?? reason.targetNationId;
      eventLog.log(
        formatLog(reason.actorNationId, `${formatAIDiplomacyAction(reason.action, targetName)} Reason: ${reason.reasonText}`),
        [reason.actorNationId, reason.targetNationId],
        turnManager.getCurrentRound(),
      );
    });
    const researchSystem = new ResearchSystem(
      nationManager,
      cityManager,
      eventLog,
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
      formatLog,
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
    // Temporary debug reveal: only natural resource icons for now. This can
    // later expand to fog-of-war once an exploration visibility layer exists.
    let isMapRevealActive = false;
    const isNaturalResourceVisibleToHuman = (resourceId: string): boolean => {
      if (isMapRevealActive) return true;

      const resource = getNaturalResourceById(resourceId);
      if (!resource) return false;
      if (!resource.revealTechId) return true;
      if (!humanNationId) return false;
      return researchSystem.isResearched(humanNationId, resource.revealTechId);
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
    naturalResourceRenderer.setVisibilityPredicate(isNaturalResourceVisibleToHuman);
    naturalResourceRenderer.rebuildAll();

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

      const nationName = nationManager.getNation(unit.ownerId)?.name ?? unit.ownerId;
      const locationLabel = result.city ? `near ${result.city.name}` : 'on a sea resource';
      eventLog.log(
        `${nationName} started building ${result.improvement.name} ${locationLabel}.`,
        [unit.ownerId],
        turnManager.getCurrentRound(),
      );

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

      reachableTiles = new Set<string>();
      pathPreviewRenderer.clear();
      movementSystem.moveAlongPath(unit, path, { source: 'human-ui' });
      combatSystem.tryAttack(unit, targetTile.x, targetTile.y, { source: 'human-ui' });
      return true;
    };

    selectionManager.onSelectionTarget((target, currentSelection) => {
      if (currentSelection?.kind !== 'unit') return false;

      const targetTile = this.getTileForSelectable(tileMap, target);
      if (targetTile === null) return false;

      const tile = tileMap.getTileAt(targetTile.x, targetTile.y);
      if (tile === null) return false;

      const unit = currentSelection.unit;
      if (unit.ownerId !== humanNationId) return false;
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
    );

    // Turn order: built AFTER MovementSystem so MovementSystem's turnStart
    // reset fires before TurnOrderSystem auto-selects the active unit.
    // Otherwise the freshly-selected unit would still have 0 MP and the
    // movement-preview matrix would stay hidden until the first move.
    const turnOrderSystem = new TurnOrderSystem(
      unitManager,
      turnManager,
      humanNationId,
      (unit) => improvementConstructionSystem.isUnitBusy(unit.id),
    );
    turnManager.on('turnStart', (e) => improvementConstructionSystem.handleTurnStart(e));
    improvementConstructionSystem.onCompleted((event) => {
      resourceSystem.recalculateForNation(event.construction.ownerId);
      if (event.unit.improvementCharges !== undefined) {
        event.unit.improvementCharges = Math.max(0, event.unit.improvementCharges - 1);
      }
      const nationName = nationManager.getNation(event.construction.ownerId)?.name ?? event.construction.ownerId;
      const locationLabel = event.city ? `near ${event.city.name}` : 'on a sea resource';
      if (
        event.unit.unitType.id === WORK_BOAT.id &&
        event.tile.resourceId !== undefined
      ) {
        eventLog.log(
          formatLog(
            event.construction.ownerId,
            `Work Boat improved ${event.tile.resourceId} at (${event.tile.x},${event.tile.y}) with ${event.improvement.id}`,
          ),
          [event.construction.ownerId],
          turnManager.getCurrentRound(),
        );
      }
      eventLog.log(
        `${nationName} built ${event.improvement.name} ${locationLabel}.`,
        [event.construction.ownerId],
        turnManager.getCurrentRound(),
      );
      if (event.unit.improvementCharges === 0) {
        unitManager.removeUnit(event.unit.id);
        const selected = selectionManager.getSelected();
        if (selected?.kind === 'unit' && selected.unit.id === event.unit.id) {
          selectionManager.clearSelection();
        }
      }
      rightPanel?.requestRefresh();
      hudLayer?.refresh();
      refreshOpenCityView();
      tileBuildingRenderer.rebuildAll();
      tileImprovementOverlayRenderer.refreshTile(event.tile.x, event.tile.y);
      turnOrderSystem.refreshActive();
    });
    improvementConstructionSystem.onCancelled((event) => {
      rightPanel?.requestRefresh();
      hudLayer?.refresh();
      refreshOpenCityView();
      tileImprovementOverlayRenderer.refreshTile(event.tile.x, event.tile.y);
      turnOrderSystem.refreshActive();
    });
    selectionManager.onSelectionTarget((target, currentSelection) => {
      if (currentSelection?.kind !== 'unit') return false;

      const unit = currentSelection.unit;
      const targetTile = this.getTileForSelectable(tileMap, target);
      if (targetTile === null) return false;
      if (!reachableTiles.has(`${targetTile.x},${targetTile.y}`)) return false;

      const path = pathfindingSystem.findPath(unit, targetTile.x, targetTile.y);
      if (path === null) return false;

      if (unit.isSleeping) unit.isSleeping = false;
      reachableTiles = new Set<string>();
      pathPreviewRenderer.clear();
      movementSystem.moveAlongPath(unit, path, { source: 'human-ui' });
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
    const victorySystem = new VictorySystem(cityManager, nationManager, turnManager);

    // 18. Stadsgrundningssystem
    foundCitySystem = new FoundCitySystem(
      unitManager, cityManager, nationManager, turnManager,
      territoryRenderer, cityRenderer, resourceSystem, mapData,
      gridSystem,
    );

    // Log city founded and re-scan discovery (new city may trigger encounters).
    foundCitySystem.onCityFounded((city) => {
      const nationName = nationManager.getNation(city.ownerId)?.name ?? city.ownerId;
      const text = `${city.name} was founded by ${nationName}.`;
      eventLog.log(isAINation(city.ownerId) ? formatLog(city.ownerId, `${city.name} was founded.`) : text, [city.ownerId], turnManager.getCurrentRound());
      cityBannerRenderer.refreshCity(city);
      discoverySystem.scan();
    });

    // 18. AI-system för icke-mänskliga nationer
    const explorationMemorySystem = new ExplorationMemorySystem(gridSystem, mapData, cityManager);
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
      formatLog,
      eraSystem,
      undefined,
      undefined,
      builderSystem,
    );
    const aiPolicySystem = new AIPolicySystem(policySystem, nationManager, happinessSystem);

    const runAutoplayNationTurn = (nation: Nation): void => {
      discoverySystem.scan();

      aiDiplomacySystem.runTurn(nation.id);
      aiSystem.runTurn(nation.id);
      aiExplorationSystem.runTurn(nation.id);
      territoryRenderer.render();

      hudLayer?.refresh();
      rightPanel?.requestRefresh();
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

    // Humans pick their own initial research via the HUD research panel.
    // AI nations keep the deterministic auto-pick so they never stall.
    const refreshPolicyDerivedState = (nationId: string): void => {
      happinessSystem.recalculateNation(nationId);
      resourceSystem.recalculateForNation(nationId);
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    };

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
        aiSystem.runTurn(e.nation.id);
        aiExplorationSystem.runTurn(e.nation.id);
        territoryRenderer.render();
        turnManager.endCurrentTurn();
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
        const target = ownedCities.find((c) => c.isCapital) ?? ownedCities[0];
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

    turnManager.on('turnStart', (e) => {
      if (!e.nation.isHuman) return;
      turnOrderSystem.refreshActive();
      const active = turnOrderSystem.getActive();
      if (!active) {
        selectionManager.clearSelection();
        if (autofocusOnEndTurn) {
          focusHumanCapital();
        }
        return;
      }
      // Force-focus even if the active id is unchanged since last turn —
      // refreshActive() skips the listener in that case.
      if (autofocusOnEndTurn) {
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
        return;
      }
      if (autofocusOnEndTurn) {
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
      }
    });

    // Log city founded events — covers both human and AI via FoundCitySystem.
    // Wired after foundCitySystem is constructed; see below.

    // Log discovery events, and refresh UI when a new nation becomes visible.
    discoverySystem.onNationsMet((a, b) => {
      const nameA = nationManager.getNation(a)?.name ?? a;
      const nameB = nationManager.getNation(b)?.name ?? b;
      eventLog.log(`${nameA} has met ${nameB}.`, [a, b], turnManager.getCurrentRound());
      // New nation may now be visible in the UI.
      hudLayer?.refresh();
      leaderStrip?.rebuild();
      rightPanel?.requestRefresh();
    });

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
        refreshOpenCityView();
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
          territoryRenderer.render();
          this.minimapHud?.rebuild();
        }
        const ownerName = nationManager.getNation(city.ownerId)?.name ?? city.ownerId;
        const completedWonderText = `${ownerName} completed the ${item.wonderType.name} in ${city.name}.`;
        eventLog.log(
          isAINation(city.ownerId) ? formatLog(city.ownerId, `completed the ${item.wonderType.name} in ${city.name}.`) : completedWonderText,
          [city.ownerId],
          turnManager.getCurrentRound(),
        );
        if (expansion.claimedCoords.length > 0) {
          const expansionText = `${item.wonderType.name} expanded ${city.name}'s territory.`;
          eventLog.log(
            isAINation(city.ownerId) ? formatLog(city.ownerId, expansionText) : expansionText,
            [city.ownerId],
            turnManager.getCurrentRound(),
          );
        }
        refreshOpenCityView();
        rightPanel?.requestRefresh();
        hudLayer?.refresh();
        return true;
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

      return true;
    });
    productionSystem.onRemoved((cityId, entry) => {
      if (entry.item.kind !== 'wonder') return;
      wonderPlacementSystem.releaseCityWonderReservation(cityId, entry.item.wonderType.id, mapData);
    });

    // ─── City combat events ─────────────────────────────────────────────────

    combatSystem.onCityCombat((e) => {
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

      // Om staden erövrades
      if (e.captured) {
        // Den erövrande enheten flyttades in på stadens tile
        unitRenderer.refreshUnitPosition(e.attacker.id);
        cityRenderer.refreshCity(e.city);
        cityBannerRenderer.refreshCity(e.city);
        // Territory borders och minimap behöver ritas om efter ownerId-transfer.
        territoryRenderer.render();
        this.minimapHud?.rebuild();
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
      }

      rightPanel?.requestRefresh();
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
      btnContainer.appendChild(makeBtn(opts.cancelLabel, false, opts.onCancel));
      box.appendChild(btnContainer);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    };

    // War declaration modal when human tries to attack a nation at peace
    combatSystem.onWarRequired((e) => {
      if (e.source !== 'human-ui') return;
      if (e.attacker.ownerId !== humanNationIdForDiplomacy) return;

      const targetNation = nationManager.getNation(e.targetNationId);
      if (!targetNation) return;
      const color = `#${targetNation.color.toString(16).padStart(6, '0')}`;

      showDiplomacyModal({
        title: 'Declare War',
        message: `Declare war on ${targetNation.name}?`,
        accentColor: '#c44',
        confirmLabel: 'Declare War!',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          diplomacyManager.declareWar(humanNationIdForDiplomacy, e.targetNationId);
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

      showDiplomacyModal({
        title: 'Declare War',
        message: `Declare war on ${targetNation.name} to enter their territory?`,
        accentColor: '#c44',
        confirmLabel: 'Declare War!',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          diplomacyManager.declareWar(humanNationIdForDiplomacy, e.targetNationId);
          const targetTile = tileMap.getTileAt(e.tileX, e.tileY);
          if (targetTile !== null) {
            movementSystem.moveAlongPath(e.unit, [targetTile], { source: 'human-ui' });
          }
          rightPanel?.refreshCurrent();
        },
        onCancel: () => {},
      });
    });

    // AI proposes peace when all units lost
    unitManager.onUnitChanged((event) => {
      if (event.reason !== 'removed') return;
      const deadOwnerId = event.unit.ownerId;
      const nation = nationManager.getNation(deadOwnerId);
      if (!nation || nation.isHuman) return;
      if (diplomacyManager.getState(deadOwnerId, humanNationIdForDiplomacy) !== 'WAR') return;
      if (unitManager.getUnitsByOwner(deadOwnerId).length > 0) return;
      diplomacyManager.proposePeace(deadOwnerId, humanNationIdForDiplomacy);
    });

    // Peace proposal modal (incoming from AI only)
    diplomacyManager.onPeaceProposed((proposal) => {
      // Skip modal if human is the proposer (already handled via diplomacyAction)
      if (proposal.fromNationId === humanNationIdForDiplomacy) return;

      const nation = nationManager.getNation(proposal.fromNationId);
      if (!nation) return;
      const color = `#${nation.color.toString(16).padStart(6, '0')}`;

      showDiplomacyModal({
        title: 'Peace Proposal',
        message: `${nation.name} sues for peace. Accept?`,
        accentColor: color,
        confirmLabel: 'Accept',
        cancelLabel: 'Decline',
        onConfirm: () => {
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
      const aiActor = isAINation(nationA) ? nationA : isAINation(nationB) ? nationB : null;
      eventLog.log(
        aiActor ? formatLog(aiActor, `peace was made between ${nameA} and ${nameB}.`) : `Peace was made between ${nameA} and ${nameB}.`,
        [nationA, nationB],
        turnManager.getCurrentRound(),
      );
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });

    diplomacyManager.onWarDeclared((aggressorId, targetId) => {
      const nameA = nationManager.getNation(aggressorId)?.name ?? aggressorId;
      const nameB = nationManager.getNation(targetId)?.name ?? targetId;
      console.log(`[Diplomacy] War declared: ${nameA} → ${nameB}`);
      const text = `${nameA} declared war on ${nameB}.`;
      eventLog.log(
        isAINation(aggressorId) ? formatLog(aggressorId, `declared war on ${nameB}.`) : text,
        [aggressorId, targetId],
        turnManager.getCurrentRound(),
      );
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    diplomacyManager.onDiplomacyChanged(() => {
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });

    // Diplomacy actions from right-side details buttons
    const onDiplomacyAction = (event: Event) => {
      const { action, targetNationId } = (event as CustomEvent<{ action: string; targetNationId: string }>).detail;
      const targetNation = nationManager.getNation(targetNationId);
      if (!targetNation) return;
      const color = `#${targetNation.color.toString(16).padStart(6, '0')}`;
      const validationContext = {
        haveMet: (a: string, b: string): boolean => discoverySystem.hasMet(a, b),
        hasTechnology: (nationId: string, techId: string): boolean => researchSystem.isResearched(nationId, techId),
      };

      if (action === 'declareWar') {
        showDiplomacyModal({
          title: 'Declare War',
          message: `Declare war on ${targetNation.name}?`,
          accentColor: '#c44',
          confirmLabel: 'Declare War!',
          cancelLabel: 'Cancel',
          onConfirm: () => {
            diplomacyManager.declareWar(humanNationIdForDiplomacy, targetNationId);
            rightPanel?.refreshCurrent();
          },
          onCancel: () => {},
        });
      } else if (action === 'proposePeace') {
        showDiplomacyModal({
          title: 'Propose Peace',
          message: `Propose peace to ${targetNation.name}?`,
          accentColor: color,
          confirmLabel: 'Propose',
          cancelLabel: 'Cancel',
          onConfirm: () => {
            // AI always accepts human peace proposals
            diplomacyManager.proposePeace(humanNationIdForDiplomacy, targetNationId);
            diplomacyManager.respondToPeace(humanNationIdForDiplomacy, targetNationId, true);
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
    const diagnosticDialog = new DiagnosticDialog(this.diagnosticSystem);
    const endHumanTurn = () => {
      if (!turnManager.getCurrentNation().isHuman) return;
      if (hudLayer?.hasBlockingModal()) return;
      turnManager.endCurrentTurn();
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
      (turn) => {
        const era = humanNationId
          ? getEstimatedEraFromProgress({
              researchedTechIds: nationManager.getNation(humanNationId)?.researchedTechIds ?? [],
              unlockedCultureIds: cultureSystem.getUnlockedCultureNodes(humanNationId).map((node) => node.id),
            })
          : undefined;
        return this.timeSystem.getLabelForTurn(turn, era);
      },
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
        getResourceName: (resourceId) => getNaturalResourceById(resourceId)?.name ?? resourceId,
      },
      onEndTurn: endHumanTurn,
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
    });
    hudLayer.setEndTurnEnabled(turnManager.getCurrentNation().isHuman);
    hudLayer.refresh();

    new UnitHoverDiagnosticHud(
      this,
      hudLayer.getOwnedObjectAttacher(),
      selectionManager,
      unitManager,
      nationManager,
    );
    researchSystem.onChanged(() => {
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    cultureSystem.onChanged(() => {
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
    );
    this.rightSidebarPanel = new RightSidebarPanel(this, worldInputGate, rightPanel);
    rightPanel.setDiplomacyManager(diplomacyManager);
    rightPanel.setDiplomaticEvaluationSystem(diplomaticEvaluationSystem);
    rightPanel.setMilitaryEvaluationSystem(aiMilitaryEvaluationSystem);
    rightPanel.setThreatEvaluationSystem(aiMilitaryThreatEvaluationSystem);
    rightPanel.setResearchSystem(researchSystem);
    rightPanel.setCultureSystem(cultureSystem);
    rightPanel.setWonderSystem(wonderSystem);
    rightPanel.setTradeDealSystem(tradeDealSystem);
    rightPanel.setResourceAccessSystem(resourceAccessSystem);
    rightPanel.setEraSystem(eraSystem);
    rightPanel.setDiscoverySystem(discoverySystem);
    rightPanel.setEventLog(eventLog);
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
        .filter((unitType) => researchSystem.isUnitUnlocked(city.ownerId, unitType.id))
        .flatMap((unitType) => {
          const reason = getCityUnitProductionBlockReason(
            city,
            unitType,
            mapData,
            gridSystem,
            unitProductionRuleContext,
          );
          if (reason && !unitType.requiredResource) return [];
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
      const unitType = ALL_UNIT_TYPES.find((candidate) => candidate.id === unitId);
      if (!unitType) return;
      if (!canCityProduceUnit(city, unitType, mapData, gridSystem, unitProductionRuleContext)) return;
      if (!researchSystem.isUnitUnlocked(city.ownerId, unitType.id)) return;
      productionSystem.enqueue(city.id, { kind: 'unit', unitType });
      rightPanel?.requestRefresh();
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
            }
          }
          cityView.hideTooltip();
          refreshOpenCityView();
          rightPanel?.requestRefresh();
          return;
        }
        if (result.status === 'invalid') return;
      }
      if (buildingPlacementSystem.isActiveForCity(city.id)) {
        const result = buildingPlacementSystem.selectTile(city, coord, mapData);
        if (result.status === 'reserved') {
          const buildingDef = getBuildingById(result.buildingId);
          if (buildingDef && !isBuildingQueued(city.id, result.buildingId)) {
            productionSystem.enqueue(city.id, { kind: 'building', buildingType: buildingDef });
          }
          cityTerritorySystem.updateWorkedTiles(city, mapData);
          resourceSystem.recalculateForNation(city.ownerId);
          tileBuildingRenderer.refreshTile(result.coord.x, result.coord.y);
          cityView.hideTooltip();
          refreshOpenCityView();
          rightPanel?.requestRefresh();
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
        unitActionToolbox.refresh();
        turnOrderSystem.refreshActive();
        hudLayer?.refresh();
        rightPanel?.requestRefresh();
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
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    researchSystem.onCompleted((event) => {
      if (event.nationId === humanNationId && isNaturalResourceRevealTechnology(event.technologyId)) {
        naturalResourceRenderer.rebuildAll();
      }
      resourceSystem.recalculateForNation(event.nationId);
      happinessSystem.recalculateNation(event.nationId);
      if (event.nationId === humanNationId && !autoplaySystem.isActive()) {
        const technology = getTechnologyById(event.technologyId);
        if (technology) {
          hudLayer?.enqueueDiscovery(buildTechnologyDiscoveryPopupData(technology));
        }
      }
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
    });
    cultureSystem.onChanged(() => {
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
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      refreshOpenCityView();
    });
    happinessSystem.onChanged(() => {
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      refreshOpenCityView();
    });

    new CombatLog(this, combatSystem, nationManager);
    new AutoplayHud(autoplaySystem);
    const cheatConsole = new CheatConsole(new CheatSystem({
      humanNationId,
      researchSystem,
      cultureSystem,
      resourceSystem,
      diagnosticSystem: this.diagnosticSystem,
      discoverySystem,
      nationManager,
      productionSystem,
      cityManager,
      selectionManager,
      unitManager,
      autoplaySystem,
      revealMapResourcesTemporarily,
    }));

    turnManager.on('turnStart', () => {
      clearTemporaryMapReveal();
      hudLayer?.refresh();
      const activeNation = turnManager.getCurrentNation();
      hudLayer?.setEndTurnEnabled(activeNation.isHuman);
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
    turnManager.on('roundStart', () => hudLayer?.refresh());
    resourceSystem.on(() => {
      territoryRenderer.render();
      this.minimapHud?.rebuild();
      cityBannerRenderer.rebuildAll();
      hudLayer?.refresh();
      rightPanel?.requestRefresh();
      refreshSelectedCityOverlays();
      refreshOpenCityView();
    });
    unitManager.onUnitChanged((event) => {
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

    selectionManager.onHoverChanged((hovered) => {
      const selected = selectionManager.getSelected();
      if (selected?.kind !== 'unit') {
        pathPreviewRenderer.clearPath();
        rangedPreviewRenderer.clearCurve();
        return;
      }

      const hoverTile = this.getTileForSelectable(tileMap, hovered);
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

      if (hoverTile === null || !reachableTiles.has(`${hoverTile.x},${hoverTile.y}`)) {
        pathPreviewRenderer.clearPath();
        return;
      }

      const path = pathfindingSystem.findPath(selected.unit, hoverTile.x, hoverTile.y);
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

      focusOnCity(city);
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearCityViewInteraction();
      this.input.off(Phaser.Input.Events.POINTER_DOWN, onCityViewPointerDown);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, onCityViewPointerMove);
      this.input.off(Phaser.Input.Events.POINTER_UP, onCityViewPointerUp);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, onCityViewPointerUp);
      window.removeEventListener('focusCity', onFocusCity);
      window.removeEventListener('leaderCityFocusRequested', onLeaderCityFocusRequested);
      window.removeEventListener('focusUnit', onFocusUnit);
      document.removeEventListener('nationSelected', onNationSelected);
      document.removeEventListener('leaderSelected', onLeaderSelected);
      document.removeEventListener('diplomacyAction', onDiplomacyAction);
      hudLayer?.shutdown();
      rightPanel?.shutdown();
      diagnosticDialog.shutdown();
      this.diagnosticSystem.shutdown();
      cityView.shutdown();
      cityBannerRenderer.shutdown();
      cityRenderer.shutdown();
      naturalResourceRenderer.shutdown();
      tileBuildingRenderer.shutdown();
      tileImprovementOverlayRenderer.shutdown();
      this.minimapHud?.shutdown();
      this.minimapHud = null;
      this.rightSidebarPanel?.shutdown();
      this.rightSidebarPanel = null;
      leaderStrip?.shutdown();
      cheatConsole.shutdown();
    });

    // Victory overlay
    victorySystem.onVictory((nationId) => {
      turnManager.stop();

      const nation = nationManager.getNation(nationId);
      const nationName = nation?.name ?? 'Unknown';
      const nationColor = nation ? `#${nation.color.toString(16).padStart(6, '0')}` : '#ffffff';

      const { width, height } = this.scale;

      const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
        .setScrollFactor(0)
        .setDepth(200);

      this.add.text(width / 2, height / 2 - 30,
        `${nationName} has conquered all capitals!\nVICTORY`, {
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
        discoverySystem,
        turnManager,
        gridSystem,
        wonderSystem,
        policySystem,
        tradeDealSystem,
      });
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
      territoryRenderer.render();
      leaderStrip?.rebuild();
      for (const nation of nationManager.getAllNations()) {
        resourceSystem.recalculateForNation(nation.id);
      }
      happinessSystem.recalculateAll();
      refreshOpenCityView();
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
          discoverySystem,
          turnManager,
          gridSystem,
          wonderSystem,
          policySystem,
          tradeDealSystem,
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
            discoverySystem,
            turnManager,
            gridSystem,
            wonderSystem,
            policySystem,
            tradeDealSystem,
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
              autofocusOnEndTurn,
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
      },
      { music: SetupMusicManager.getShared() },
    );

    const onKeyEscape = () => {
      if (closeOpenCityView()) return;
      escapeMenu.toggle();
    };
    this.input.keyboard?.on('keydown-ESC', onKeyEscape);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', onKeyEscape);
      escapeMenu.shutdown();
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
      if (
        !activeNation.isHuman ||
        unit.ownerId !== activeNation.id ||
        unit.movementPoints <= 0 ||
        improvementConstructionSystem.isUnitBusy(unit.id)
      ) {
        reachableTiles = new Set<string>();
        pathPreviewRenderer.clear();
        return;
      }

      reachableTiles = pathfindingSystem.getReachableTiles(unit);
      pathPreviewRenderer.showReachableTiles(reachableTiles);
      pathPreviewRenderer.clearPath();
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
      cityView.show(
        city,
        getCityViewUnitOptions(city),
        getCityViewBuildingOptions(city),
        getCityViewPlacementPanelState(city),
        getCityViewTilePurchaseState(city),
        getCityViewWonderOptions(city),
        getCityViewQueueItems(city),
      );
      cityViewRenderer.showWithState(
        city,
        cityViewInteraction.getRenderState(),
        getCityViewPlacementRenderState(city),
      );
      const { x, y } = tileMap.tileToWorld(city.tileX, city.tileY);
      this.cameraController.focusOn(x, y, 2.0);
    };
  }

  update(_time: number, delta: number): void {
    if (!this.cameraController) return;
    this.cameraController.update(delta);
    this.minimapHud?.update();
    this.diagnosticSystem.update();
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

function formatProposalKind(kind: 'open_borders' | 'embassy' | 'resource_trade' | 'gold_trade' | 'peace'): string {
  switch (kind) {
    case 'open_borders': return 'Open Borders proposal';
    case 'embassy': return 'Embassy proposal';
    case 'resource_trade': return 'resource trade';
    case 'gold_trade': return 'gold transfer';
    case 'peace': return 'peace proposal';
  }
}
