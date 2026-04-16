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
import { FlatResourceGenerator } from '../systems/ResourceGenerator';
import { ProductionSystem } from '../systems/ProductionSystem';
import { HealingSystem } from '../systems/HealingSystem';
import { TerritoryRenderer } from '../systems/TerritoryRenderer';
import { CityRenderer } from '../systems/CityRenderer';
import { UnitRenderer } from '../systems/UnitRenderer';
import { MovementSystem } from '../systems/MovementSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { AISystem } from '../systems/AISystem';
import { FoundCitySystem } from '../systems/FoundCitySystem';
import { VictorySystem } from '../systems/VictorySystem';
import { DebugHUD } from '../ui/DebugHUD';
import { CombatLog } from '../ui/CombatLog';
import { LeftPanel } from '../ui/LeftPanel';
import { RightPanel } from '../ui/RightPanel';
import { TileType } from '../types/map';
import type { ScenarioData } from '../types/scenario';
import type { City } from '../entities/City';
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

    // 2. Filter to active nations only, set isHuman from config
    const activeSet = new Set(data.activeNationIds);
    const activeNations = scenario.nations.filter(n => activeSet.has(n.id));
    const activeCities = scenario.cities.filter(c => activeSet.has(c.nationId));
    const activeUnits = scenario.units.filter(u => activeSet.has(u.nationId));

    // 3. Create nations and claim start territories (mutates mapData.tiles)
    const nationManager = NationManager.loadFromScenario(activeNations, mapData);

    // Override isHuman from config (ignore JSON values)
    for (const nation of nationManager.getAllNations()) {
      nation.isHuman = nation.id === data.humanNationId;
    }

    // 4. Render terrain (depth 0)
    const tileMap = new TileMap(this, mapData);

    // 5. Render territory overlay (depth 5)
    const territoryRenderer = new TerritoryRenderer(this, tileMap, nationManager, mapData);
    territoryRenderer.render();

    // 6. Create cities from scenario (filtered)
    const cityManager = CityManager.loadFromScenario(activeCities, mapData);

    // 7. Create units from scenario (filtered)
    const unitManager = UnitManager.loadFromScenario(activeUnits, mapData);

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
      nationManager, cityManager, turnManager, new FlatResourceGenerator(),
    );

    // 12. Selection-system (hover depth 20, selection depth 21)
    const selectionManager = new SelectionManager(
      this, tileMap, this.cameraController, cityManager, unitManager,
    );

    // 13. Produktionssystem
    const productionSystem = new ProductionSystem(cityManager, turnManager);
    let leftPanel: LeftPanel | null = null;
    let rightPanel: RightPanel | null = null;

    // 14. Stridssystem
    const combatSystem = new CombatSystem(unitManager, turnManager, cityManager, productionSystem, mapData);
    selectionManager.onSelectionTarget((target, currentSelection) => {
      if (currentSelection?.kind !== 'unit') return false;

      const targetTile = this.getTileForSelectable(tileMap, target);
      if (targetTile === null) return false;

      // Try attack against unit or city at target tile
      return combatSystem.tryAttack(currentSelection.unit, targetTile.x, targetTile.y);
    });

    // 15. Rörelseregler för enheter
    const movementSystem = new MovementSystem(tileMap, unitManager, unitRenderer, turnManager, selectionManager);

    // 16. Läkningssystem
    const healingSystem = new HealingSystem(unitManager, cityManager, turnManager);

    // 17. Victory system
    const victorySystem = new VictorySystem(cityManager, nationManager, turnManager);

    // 18. Stadsgrundningssystem
    const foundCitySystem = new FoundCitySystem(
      unitManager, cityManager, nationManager, turnManager,
      territoryRenderer, cityRenderer, resourceSystem, mapData,
    );

    // 18. AI-system för icke-mänskliga nationer
    const aiSystem = new AISystem(
      unitManager, cityManager, nationManager, turnManager,
      movementSystem, combatSystem, productionSystem, foundCitySystem, mapData,
    );

    turnManager.on('turnStart', (e) => {
      if (!e.nation.isHuman) {
        aiSystem.runTurn(e.nation.id);
        turnManager.endCurrentTurn();
      }
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

      const placement = this.findUnitPlacementTile(tileMap, unitManager, city, item.unitType);
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
      leftPanel?.refresh();

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
        leftPanel?.refresh();
        // Recalculate resources for both old and new owner
        resourceSystem.recalculateForNation(e.attacker.ownerId);
      }

      rightPanel?.refreshCurrent();
    });

    // ─── Healing events ─────────────────────────────────────────────────────

    healingSystem.onCityHealed((e) => {
      const city = cityManager.getCity(e.cityId);
      if (city) {
        cityRenderer.refreshCity(city);
        leftPanel?.refresh();
        rightPanel?.refreshCurrent();
      }
    });

    // ─── UI ──────────────────────────────────────────────────────────────────

    this.debugHUD = new DebugHUD(this);

    const humanNationId = nationManager.getHumanNationId();
    leftPanel = new LeftPanel(nationManager, turnManager, humanNationId);
    leftPanel.setEndTurnCallback(() => turnManager.endCurrentTurn());

    rightPanel = new RightPanel(
      productionSystem,
      cityManager,
      unitManager,
      nationManager,
      mapData,
      humanNationId,
    );
    rightPanel.setFoundCityHandler(
      (unit) => foundCitySystem.canFound(unit),
      (unit) => {
        const city = foundCitySystem.foundCity(unit);
        if (!city) return;
        leftPanel?.refresh();
        rightPanel?.clear();
      },
    );

    new CombatLog(this, combatSystem, nationManager);

    turnManager.on('turnStart', () => {
      leftPanel?.refresh();
      const activeNation = turnManager.getCurrentNation();
      leftPanel?.setEndTurnEnabled(activeNation.isHuman);
      if (rightPanel?.getCurrentCity()) {
        rightPanel.refreshProductionQueue(rightPanel.getCurrentCity()!.id);
      }
      if (rightPanel?.getView() === 'nation') {
        rightPanel.refreshNationView();
      }
    });
    turnManager.on('roundStart', () => leftPanel?.refresh());
    resourceSystem.on(() => leftPanel?.refresh());
    unitManager.onUnitChanged(() => {
      leftPanel?.refresh();
      rightPanel?.refreshCurrent();
    });
    productionSystem.onChanged(() => {
      leftPanel?.refresh();
      rightPanel?.refreshCurrent();
    });

    // Map selection → right panel (clears nation highlight)
    selectionManager.onSelectionChanged((selection) => {
      leftPanel?.clearSelectedNation();
      if (selection?.kind === 'tile') {
        rightPanel?.showTile(selection.tile);
      } else if (selection?.kind === 'city') {
        rightPanel?.showCity(selection.city);
      } else if (selection?.kind === 'unit') {
        rightPanel?.showUnit(selection.unit);
      } else {
        rightPanel?.clear();
      }
    });

    // Nation selected from LeftPanel list
    const onNationSelected = (event: Event) => {
      const { nationId } = (event as CustomEvent<{ nationId: string }>).detail;
      rightPanel?.showNation(nationId);
      leftPanel?.setSelectedNation(nationId);
    };
    document.addEventListener('nationSelected', onNationSelected);

    const onFocusCity = (event: Event) => {
      const cityId = (event as CustomEvent<{ cityId: string }>).detail.cityId;
      const city = cityManager.getCity(cityId);
      if (!city) return;

      const { x, y } = tileMap.tileToWorld(city.tileX, city.tileY);
      this.cameras.main.centerOn(x, y);
      selectionManager.selectCity(city);
      rightPanel?.showCity(city);
    };
    window.addEventListener('focusCity', onFocusCity);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('focusCity', onFocusCity);
      document.removeEventListener('nationSelected', onNationSelected);
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
  ): { x: number; y: number } | null {
    const adjacentCandidates = [
      { x: city.tileX, y: city.tileY - 1 },
      { x: city.tileX + 1, y: city.tileY },
      { x: city.tileX, y: city.tileY + 1 },
      { x: city.tileX - 1, y: city.tileY },
    ];
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
      if (unitManager.getUnitAt(candidate.x, candidate.y) !== undefined) continue;
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
