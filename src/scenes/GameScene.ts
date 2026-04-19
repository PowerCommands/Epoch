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
import { claimTile, getClaimableTiles, getClaimCost } from '../systems/CultureExpansion';
import { DiplomacyManager } from '../systems/DiplomacyManager';
import { DiscoverySystem } from '../systems/DiscoverySystem';
import { EventLogSystem } from '../systems/EventLogSystem';
import { AISystem } from '../systems/AISystem';
import { FoundCitySystem } from '../systems/FoundCitySystem';
import { VictorySystem } from '../systems/VictorySystem';
import { BuilderSystem } from '../systems/BuilderSystem';
import { CheatSystem } from '../systems/CheatSystem';
import { calculateCityEconomy } from '../systems/CityEconomy';
import type { IGridSystem } from '../systems/grid/IGridSystem';
import { HexGridSystem } from '../systems/grid/HexGridSystem';
import { HexGridLayout } from '../systems/gridLayout/HexGridLayout';
import { DebugHUD } from '../ui/DebugHUD';
import { CombatLog } from '../ui/CombatLog';
import { CheatConsole } from '../ui/CheatConsole';
import { LeftPanel } from '../ui/LeftPanel';
import { RightPanel } from '../ui/RightPanel';
import { UnitActionToolbox } from '../ui/UnitActionToolbox';
import { TileType } from '../types/map';
import type { ScenarioData } from '../types/scenario';
import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import type { UnitType } from '../entities/UnitType';
import type { Selectable } from '../types/selection';
import type { GameConfig } from '../types/gameConfig';

/**
 * GameScene — huvudspelscenen.
 * Orkestrerar karta, nationer, städer, enheter, turordning, resurser,
 * produktion, byggnader, strid, läkning, AI, stadsgrundning,
 * kamerakontroll, selection och HUD.
 */
export class GameScene extends Phaser.Scene {
  private cameraController!: CameraController;
  private debugHUD!: DebugHUD;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data: GameConfig): void {
    // ─── Data & system ───────────────────────────────────────────────────────

    // 1. Parse scenario using map key from config
    const scenarioJson = this.cache.json.get(data.mapKey) as ScenarioData;
    const scenario = ScenarioLoader.parse(scenarioJson);
    const mapData = scenario.mapData;
    const gridSystem = new HexGridSystem();
    const gridLayout = new HexGridLayout();

    // 2. Filter to active nations only, set isHuman from config
    const activeSet = new Set(data.activeNationIds);
    const activeNations = scenario.nations
      .filter(n => activeSet.has(n.id))
      .map(n => ({ ...n, isHuman: n.id === data.humanNationId }));
    const activeCities = scenario.cities.filter(c => activeSet.has(c.nationId));
    const activeUnits = scenario.units.filter(u => activeSet.has(u.nationId));

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

    // 5. Render territory overlay (depth 5)
    const territoryRenderer = new TerritoryRenderer(this, tileMap, nationManager, mapData, gridSystem);
    territoryRenderer.render();

    // 6. Create cities from scenario (filtered)
    const cityManager = CityManager.loadFromScenario(activeCities, mapData);

    // 7. Create units from scenario (filtered)
    const unitManager = UnitManager.loadFromScenario(activeUnits, mapData);
    // Enrich unit events with cityId (used by RightPanel to gate refreshes).
    unitManager.setCityLocator((x, y) => cityManager.getCityAt(x, y)?.id);

    // 7. Kamerakontroll
    const { width: worldWidth, height: worldHeight } = tileMap.getWorldBounds();
    const overviewZoom = this.getMapCoverZoom(worldWidth, worldHeight);
    this.cameraController = new CameraController(this, worldWidth, worldHeight, overviewZoom);

    // 8. Rendera städer (depth 15)
    const cityRenderer = new CityRenderer(this, tileMap, cityManager, nationManager);

    // 9. Rendera enheter (depth 18)
    const unitRenderer = new UnitRenderer(this, tileMap, unitManager, nationManager);

    // 10. Starta i en overview som täcker hela canvasen.
    this.cameras.main.setZoom(overviewZoom);
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);

    // 11. Turordning och resurssystem
    const turnManager = new TurnManager(nationManager);
    const resourceSystem = new ResourceSystem(
      nationManager, cityManager, turnManager, new TileResourceGenerator(), mapData, gridSystem,
    );

    // 12. Selection-system (hover depth 20, selection depth 21)
    const selectionManager = new SelectionManager(
      this, tileMap, this.cameraController, cityManager, unitManager,
    );
    const pathfindingSystem = new PathfindingSystem(mapData, unitManager, gridSystem);
    const pathPreviewRenderer = new PathPreviewRenderer(this, tileMap);
    const rangedPreviewRenderer = new RangedPreviewRenderer(this, tileMap);
    let rangedTargets = new Set<string>();
    const cityWorkTileRenderer = new CityWorkTileRenderer(this, tileMap, cityManager, mapData, gridSystem);
    const cultureClaimTileRenderer = new CultureClaimTileRenderer(
      this,
      tileMap,
      nationManager,
      mapData,
      data.humanNationId,
    );
    let reachableTiles = new Set<string>();
    const unitActionToolbox = new UnitActionToolbox(humanNationId);
    let suppressPromote = false;

    // 13. Produktionssystem
    const productionSystem = new ProductionSystem(cityManager, turnManager);
    let leftPanel: LeftPanel | null = null;
    let rightPanel: RightPanel | null = null;

    // 13b. Diplomacy system
    const diplomacyManager = new DiplomacyManager();

    // 13c. Discovery system — tracks which nations have met each other
    const discoverySystem = new DiscoverySystem(
      nationManager, cityManager, unitManager, gridSystem,
    );
    discoverySystem.scan();

    // 13d. Event log — strategic history filtered by discovery
    const eventLog = new EventLogSystem(discoverySystem, data.humanNationId);
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
        ).science, 0),
    );

    // 14. Stridssystem
    const combatSystem = new CombatSystem(
      unitManager,
      turnManager,
      cityManager,
      productionSystem,
      mapData,
      diplomacyManager,
      gridSystem,
    );
    // Unit action toolbox modes run before movement and culture claim.
    const builderSystem = new BuilderSystem(
      unitManager,
      cityManager,
      turnManager,
      mapData,
      gridSystem,
      researchSystem,
    );
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
      leftPanel?.refresh();
      rightPanel?.clear();
      return true;
    };
    const performBuildImprovementAction = (unit: Unit): boolean => {
      const tile = mapData.tiles[unit.tileY]?.[unit.tileX];
      if (!tile) return false;

      const result = builderSystem.build(unit, tile, {
        consumeMovement: true,
        requireMovement: false,
      });
      if (!result) return false;

      resourceSystem.recalculateForNation(result.unit.ownerId);
      const nationName = nationManager.getNation(result.unit.ownerId)?.name ?? result.unit.ownerId;
      eventLog.log(
        `${nationName} built ${result.improvement.name} near ${result.city.name}.`,
        [result.unit.ownerId],
        turnManager.getCurrentRound(),
      );
      reachableTiles = new Set<string>();
      pathPreviewRenderer.clear();
      rightPanel?.showTile(result.tile);
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

      movementSystem.moveAlongPath(unit, path);
      reachableTiles = new Set<string>();
      pathPreviewRenderer.clear();

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
    );

    // Turn order: built AFTER MovementSystem so MovementSystem's turnStart
    // reset fires before TurnOrderSystem auto-selects the active unit.
    // Otherwise the freshly-selected unit would still have 0 MP and the
    // movement-preview matrix would stay hidden until the first move.
    const turnOrderSystem = new TurnOrderSystem(unitManager, turnManager, humanNationId);
    selectionManager.onSelectionTarget((target, currentSelection) => {
      if (currentSelection?.kind !== 'unit') return false;

      const unit = currentSelection.unit;
      const targetTile = this.getTileForSelectable(tileMap, target);
      if (targetTile === null) return false;
      if (!reachableTiles.has(`${targetTile.x},${targetTile.y}`)) return false;

      const path = pathfindingSystem.findPath(unit, targetTile.x, targetTile.y);
      if (path === null) return false;

      if (unit.isSleeping) unit.isSleeping = false;
      movementSystem.moveAlongPath(unit, path);
      reachableTiles = new Set<string>();
      pathPreviewRenderer.clear();
      return true;
    });

    selectionManager.onSelectionTarget((target, currentSelection) => {
      if (currentSelection?.kind !== 'city') return false;
      if (currentSelection.city.ownerId !== data.humanNationId) return false;
      if (target?.kind !== 'tile') return false;

      const city = currentSelection.city;
      const tiles = mapData.tiles.flat();
      const cost = getClaimCost(city, tiles);
      if (city.culture < cost) return false;

      const claimableTiles = getClaimableTiles(city, tiles);
      if (!claimableTiles.includes(target.tile)) return false;

      if (!claimTile(city, target.tile)) return false;

      territoryRenderer.render();
      cityWorkTileRenderer.show(city);
      cultureClaimTileRenderer.show(city);
      leftPanel?.requestRefresh();
      rightPanel?.requestRefresh();
      discoverySystem.scan();
      return true;
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
      eventLog.log(`${city.name} was founded by ${nationName}.`, [city.ownerId], turnManager.getCurrentRound());
      discoverySystem.scan();
    });

    // 18. AI-system för icke-mänskliga nationer
    const aiSystem = new AISystem(
      unitManager, cityManager, nationManager, turnManager,
      movementSystem, pathfindingSystem, combatSystem, productionSystem, foundCitySystem, mapData,
      gridSystem,
      researchSystem,
    );

    // Humans pick their own initial research via the LeftPanel UI.
    // AI nations keep the deterministic auto-pick so they never stall.
    turnManager.on('turnStart', (e) => {
      if (!e.nation.isHuman) {
        researchSystem.ensureResearchSelected(e.nation.id);
      }
      researchSystem.advanceResearchForNation(e.nation.id);
    });

    turnManager.on('turnStart', (e) => {
      // Scan for new discoveries at the start of every turn
      discoverySystem.scan();

      if (!e.nation.isHuman) {
        aiSystem.runTurn(e.nation.id);
        territoryRenderer.render();
        turnManager.endCurrentTurn();
      }
    });

    // Focus the camera on the human capital at the start of each human turn.
    const humanIdForFocus = data.humanNationId;
    const focusHumanCapital = () => {
      if (!humanIdForFocus) return;
      const ownedCities = cityManager.getCitiesByOwner(humanIdForFocus);
      if (ownedCities.length > 0) {
        const target = ownedCities.find((c) => c.isCapital) ?? ownedCities[0];
        const { x, y } = tileMap.tileToWorld(target.tileX, target.tileY);
        this.cameraController.focusOn(x, y, 1.5);
        return;
      }
      const ownedUnits = unitManager.getUnitsByOwner(humanIdForFocus);
      if (ownedUnits.length === 0) return;
      const settler = ownedUnits.find((u) => u.unitType.canFound) ?? ownedUnits[0];
      const { x, y } = tileMap.tileToWorld(settler.tileX, settler.tileY);
      this.cameraController.focusOn(x, y, 1.5);
    };
    turnManager.on('turnStart', (e) => {
      if (e.nation.isHuman) {
        focusHumanCapital();
        turnOrderSystem.refreshActive();
      }
    });

    // Auto-select the active unit and focus the camera on it.
    turnOrderSystem.onActiveUnitChanged((unit) => {
      if (!unit) return;
      if (!turnManager.getCurrentNation().isHuman) return;
      suppressPromote = true;
      try {
        selectionManager.selectUnit(unit);
      } finally {
        suppressPromote = false;
      }
      const { x, y } = tileMap.tileToWorld(unit.tileX, unit.tileY);
      this.cameraController.focusOn(x, y, 1.5);
    });

    // Space skips the active unit.
    const onSpaceSkip = () => {
      if (!turnManager.getCurrentNation().isHuman) return;
      turnOrderSystem.skipActive();
    };
    this.input.keyboard?.on('keydown-SPACE', onSpaceSkip);

    // Keyboard shortcuts for unit actions on the selected human unit.
    const activateActionIfHumanTurn = (mode: 'move' | 'attack' | 'ranged' | 'sleep') => {
      if (!turnManager.getCurrentNation().isHuman) return;
      const selection = selectionManager.getSelected();
      if (selection?.kind !== 'unit' || selection.unit.ownerId !== humanNationId) return;
      unitActionToolbox.tryActivate(mode);
    };
    const onKeyMove = () => activateActionIfHumanTurn('move');
    const onKeyAttack = () => activateActionIfHumanTurn('attack');
    const onKeyRanged = () => activateActionIfHumanTurn('ranged');
    const onKeySleep = () => activateActionIfHumanTurn('sleep');
    this.input.keyboard?.on('keydown-M', onKeyMove);
    this.input.keyboard?.on('keydown-A', onKeyAttack);
    this.input.keyboard?.on('keydown-R', onKeyRanged);
    this.input.keyboard?.on('keydown-S', onKeySleep);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-SPACE', onSpaceSkip);
      this.input.keyboard?.off('keydown-M', onKeyMove);
      this.input.keyboard?.off('keydown-A', onKeyAttack);
      this.input.keyboard?.off('keydown-R', onKeyRanged);
      this.input.keyboard?.off('keydown-S', onKeySleep);
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
      // New nation may now be visible in the left panel.
      leftPanel?.requestRefresh();
    });

    // Hantera färdig produktion
    productionSystem.onCompleted((cityId, item) => {
      const city = cityManager.getCity(cityId);
      if (!city) return false;

      if (item.kind === 'building') {
        const buildings = cityManager.getBuildings(cityId);
        buildings.add(item.buildingType);
        resourceSystem.recalculateForNation(city.ownerId);
        return true;
      }

      const placement = this.findUnitPlacementTile(tileMap, unitManager, city, item.unitType, gridSystem);
      if (placement === null) return false;

      unitManager.createUnit({
        type: item.unitType,
        ownerId: city.ownerId,
        tileX: placement.x,
        tileY: placement.y,
        movementPoints: 0,
      });

      return true;
    });

    // ─── City combat events ─────────────────────────────────────────────────

    combatSystem.onCityCombat((e) => {
      // Uppdatera stadsrendering (HP-bar)
      cityRenderer.refreshCity(e.city);
      leftPanel?.requestRefresh();

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
        // Territory overlay behöver ritas om
        territoryRenderer.render();
        leftPanel?.requestRefresh();
        // Recalculate resources for both old and new owner
        resourceSystem.recalculateForNation(e.attacker.ownerId);
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
        leftPanel?.requestRefresh();
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
      eventLog.log(
        `Peace was made between ${nameA} and ${nameB}.`,
        [nationA, nationB],
        turnManager.getCurrentRound(),
      );
      leftPanel?.requestRefresh();
      rightPanel?.requestRefresh();
    });

    diplomacyManager.onWarDeclared((aggressorId, targetId) => {
      const nameA = nationManager.getNation(aggressorId)?.name ?? aggressorId;
      const nameB = nationManager.getNation(targetId)?.name ?? targetId;
      console.log(`[Diplomacy] War declared: ${nameA} → ${nameB}`);
      eventLog.log(
        `${nameA} declared war on ${nameB}.`,
        [aggressorId, targetId],
        turnManager.getCurrentRound(),
      );
      leftPanel?.requestRefresh();
      rightPanel?.requestRefresh();
    });

    // Diplomacy actions from RightPanel buttons
    const onDiplomacyAction = (event: Event) => {
      const { action, targetNationId } = (event as CustomEvent<{ action: string; targetNationId: string }>).detail;
      const targetNation = nationManager.getNation(targetNationId);
      if (!targetNation) return;
      const color = `#${targetNation.color.toString(16).padStart(6, '0')}`;

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
      }
    };
    document.addEventListener('diplomacyAction', onDiplomacyAction);

    // ─── UI ──────────────────────────────────────────────────────────────────

    this.debugHUD = new DebugHUD(this);

    leftPanel = new LeftPanel(nationManager, turnManager, humanNationId, discoverySystem);
    leftPanel.setResearchSystem(researchSystem);
    leftPanel.setUnitActionToolbox(unitActionToolbox);
    const endHumanTurn = () => {
      if (!turnManager.getCurrentNation().isHuman) return;
      turnManager.endCurrentTurn();
    };
    leftPanel.setEndTurnCallback(endHumanTurn);

    const onEnterEndTurn = () => endHumanTurn();
    this.input.keyboard?.on('keydown-ENTER', onEnterEndTurn);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ENTER', onEnterEndTurn);
    });

    rightPanel = new RightPanel(
      productionSystem,
      cityManager,
      unitManager,
      nationManager,
      mapData,
      humanNationId,
      gridSystem,
    );
    rightPanel.setDiplomacyManager(diplomacyManager);
    rightPanel.setResearchSystem(researchSystem);
    rightPanel.setDiscoverySystem(discoverySystem);
    rightPanel.setEventLog(eventLog);
    rightPanel.setBuilderHintProvider((tile) => {
      if (!selectedBuilderForHints) return null;
      return builderSystem.getBuildPreview(selectedBuilderForHints, tile);
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
    const showKillConfirmation = (unit: Unit) => {
      showDiplomacyModal({
        title: 'Disband Unit',
        message: `Disband ${unit.name}?`,
        accentColor: '#c44',
        confirmLabel: 'Kill',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          unitManager.removeUnit(unit.id);
        },
        onCancel: () => {},
      });
    };
    unitActionToolbox.onModeChanged((mode) => {
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
        selection.unit.isSleeping = !selection.unit.isSleeping;
        unitActionToolbox.refresh();
        turnOrderSystem.refreshActive();
        leftPanel?.requestRefresh();
        rightPanel?.requestRefresh();
        unitActionToolbox.resetMode();
        return;
      }

      if (mode === 'kill') {
        const selection = selectionManager.getSelected();
        if (selection?.kind !== 'unit') {
          unitActionToolbox.resetMode();
          return;
        }
        showKillConfirmation(selection.unit);
        unitActionToolbox.resetMode();
        return;
      }
    });
    researchSystem.onChanged(() => {
      leftPanel?.requestRefresh();
      rightPanel?.requestRefresh();
    });

    new CombatLog(this, combatSystem, nationManager);
    const cheatConsole = new CheatConsole(new CheatSystem({
      humanNationId,
      researchSystem,
      resourceSystem,
      productionSystem,
      cityManager,
      selectionManager,
      unitManager,
    }));

    turnManager.on('turnStart', () => {
      leftPanel?.refresh();
      const activeNation = turnManager.getCurrentNation();
      leftPanel?.setEndTurnEnabled(activeNation.isHuman);
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
    turnManager.on('roundStart', () => leftPanel?.requestRefresh());
    resourceSystem.on(() => {
      leftPanel?.requestRefresh();
      rightPanel?.requestRefresh();
      refreshSelectedCityOverlays();
    });
    unitManager.onUnitChanged((event) => {
      leftPanel?.requestRefresh();
      if (
        rightPanel &&
        (rightPanel.isShowingCity(event.cityId) || rightPanel.isShowingUnit(event.unit))
      ) {
        rightPanel.requestRefresh();
      }
      refreshMovePreview();
    });
    productionSystem.onChanged(() => {
      leftPanel?.requestRefresh();
      rightPanel?.requestRefresh();
    });

    // Map selection → right panel (clears nation highlight)
    selectionManager.onSelectionChanged((selection) => {
      leftPanel?.clearSelectedNation();
      rangedTargets = new Set();
      rangedPreviewRenderer.clear();

      if (selection?.kind === 'unit'
        && selection.unit.ownerId === humanNationId
        && !suppressPromote
        && turnManager.getCurrentNation().isHuman
      ) {
        turnOrderSystem.promoteTo(selection.unit.id);
      }

      if (selection?.kind === 'tile') {
        selectedBuilderForHints = null;
        unitActionToolbox.setSelectedUnit(null);
        rightPanel?.showTile(selection.tile);
        cityWorkTileRenderer.clear();
        cultureClaimTileRenderer.clear();
      } else if (selection?.kind === 'city') {
        selectedBuilderForHints = null;
        unitActionToolbox.setSelectedUnit(null);
        rightPanel?.showCity(selection.city);
        cityWorkTileRenderer.show(selection.city);
        cultureClaimTileRenderer.show(selection.city);
      } else if (selection?.kind === 'unit') {
        selectedBuilderForHints = selection.unit.unitType.canBuildImprovements ? selection.unit : null;
        unitActionToolbox.setSelectedUnit(selection.unit);
        rightPanel?.showUnit(selection.unit);
        cityWorkTileRenderer.clear();
        cultureClaimTileRenderer.clear();
      } else {
        selectedBuilderForHints = null;
        unitActionToolbox.setSelectedUnit(null);
        rightPanel?.clear();
        cityWorkTileRenderer.clear();
        cultureClaimTileRenderer.clear();
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

    // Nation selected from LeftPanel list
    const onNationSelected = (event: Event) => {
      const { nationId } = (event as CustomEvent<{ nationId: string }>).detail;
      rightPanel?.showNation(nationId);
      leftPanel?.setSelectedNation(nationId);
    };
    document.addEventListener('nationSelected', onNationSelected);

    const onLeaderSelected = (event: Event) => {
      const { nationId, leaderId } = (event as CustomEvent<{ nationId: string; leaderId?: string }>).detail;
      rightPanel?.showLeader(leaderId ?? nationId);
      leftPanel?.setSelectedNation(nationId);
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
      cityWorkTileRenderer.show(city);
      cultureClaimTileRenderer.show(city);
      refreshMovePreview();
    };
    window.addEventListener('focusCity', onFocusCity);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('focusCity', onFocusCity);
      document.removeEventListener('nationSelected', onNationSelected);
      document.removeEventListener('leaderSelected', onLeaderSelected);
      document.removeEventListener('diplomacyAction', onDiplomacyAction);
      leftPanel?.shutdown();
      rightPanel?.shutdown();
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
      if (!activeNation.isHuman || unit.ownerId !== activeNation.id || unit.movementPoints <= 0) {
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
      cityWorkTileRenderer.show(selected.city);
      cultureClaimTileRenderer.show(selected.city);
    }
  }

  update(_time: number, delta: number): void {
    if (!this.cameraController) return;
    this.cameraController.update(delta);
    this.debugHUD.update(
      this.cameraController.zoom,
      this.cameraController.scrollX,
      this.cameraController.scrollY,
    );
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
      ? adjacentCandidates
      : [{ x: city.tileX, y: city.tileY }, ...adjacentCandidates];

    for (const candidate of candidates) {
      const tile = tileMap.getTileAt(candidate.x, candidate.y);
      if (tile === null) continue;
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
