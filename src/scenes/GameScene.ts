import Phaser from 'phaser';
import { TileMap } from '../systems/TileMap';
import { CameraController } from '../systems/CameraController';
import { SelectionManager } from '../systems/SelectionManager';
import { NationManager } from '../systems/NationManager';
import { CityManager } from '../systems/CityManager';
import { UnitManager } from '../systems/UnitManager';
import { TurnManager } from '../systems/TurnManager';
import { ResourceSystem } from '../systems/ResourceSystem';
import { FlatResourceGenerator } from '../systems/ResourceGenerator';
import { TerritoryRenderer } from '../systems/TerritoryRenderer';
import { CityRenderer } from '../systems/CityRenderer';
import { UnitRenderer } from '../systems/UnitRenderer';
import { MovementSystem } from '../systems/MovementSystem';
import { DebugHUD } from '../ui/DebugHUD';
import { TileInfoPanel } from '../ui/TileInfoPanel';
import { CityInfoPanel } from '../ui/CityInfoPanel';
import { UnitInfoPanel } from '../ui/UnitInfoPanel';
import { NationsPanel } from '../ui/NationsPanel';
import { TurnHUD } from '../ui/TurnHUD';
import { EndTurnButton } from '../ui/EndTurnButton';
import { ResourceBar } from '../ui/ResourceBar';

/**
 * GameScene — huvudspelscenen.
 * Orkestrerar karta, nationer, städer, enheter, turordning, resurser,
 * kamerakontroll, selection och HUD.
 */
export class GameScene extends Phaser.Scene {
  private cameraController!: CameraController;
  private debugHUD!: DebugHUD;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // ─── Data & system ───────────────────────────────────────────────────────

    // 1. Generera kartdata (40×25 tiles, 48px/tile)
    const mapData = TileMap.generatePlaceholder(40, 25, 48);

    // 2. Skapa nationer och tilldela startterritorier (muterar mapData.tiles)
    const nationManager = NationManager.createDefault(mapData);

    // 3. Rendera terräng (depth 0)
    const tileMap = new TileMap(this, mapData);

    // 4. Rendera territory-overlay (depth 5)
    const territoryRenderer = new TerritoryRenderer(this, tileMap, nationManager, mapData);
    territoryRenderer.render();

    // 5. Skapa städer baserat på nationer
    const cityManager = CityManager.createDefault(nationManager, mapData);

    // 6. Skapa startenheter baserat på nationer och huvudstäder
    const unitManager = UnitManager.createDefault(nationManager, cityManager, mapData);

    // 7. Kamerakontroll
    const { width: worldWidth, height: worldHeight } = tileMap.getWorldBounds();
    this.cameraController = new CameraController(this, worldWidth, worldHeight);

    // 8. Rendera städer (depth 15)
    new CityRenderer(this, tileMap, cityManager, nationManager);

    // 9. Rendera enheter (depth 18)
    const unitRenderer = new UnitRenderer(this, tileMap, unitManager, nationManager);

    // 10. Centrera kameran på kartans mitt
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

    // 13. Rörelseregler för enheter
    new MovementSystem(tileMap, unitManager, unitRenderer, turnManager, selectionManager);

    // ─── UI ──────────────────────────────────────────────────────────────────

    // 14. Resursbar och debug HUD (övre vänstra)
    new ResourceBar(this, nationManager, turnManager, resourceSystem);
    this.debugHUD = new DebugHUD(this);

    // 15. Turn-UI
    new TurnHUD(this, turnManager);
    new EndTurnButton(this, turnManager);

    // 16. Info-paneler
    const tileInfoPanel = new TileInfoPanel(this, nationManager);
    const cityInfoPanel = new CityInfoPanel(this, nationManager, cityManager, resourceSystem);
    const unitInfoPanel = new UnitInfoPanel(this, nationManager, unitManager);

    // 17. Nations-panel (övre högra)
    new NationsPanel(this, nationManager, mapData, resourceSystem);

    // 18. Koppla selection → rätt panel
    selectionManager.onSelectionChanged((selection) => {
      if (selection?.kind === 'tile') {
        tileInfoPanel.update(selection.tile);
        cityInfoPanel.update(null);
        unitInfoPanel.update(null);
      } else if (selection?.kind === 'city') {
        cityInfoPanel.update(selection.city);
        tileInfoPanel.update(null);
        unitInfoPanel.update(null);
      } else if (selection?.kind === 'unit') {
        unitInfoPanel.update(selection.unit);
        tileInfoPanel.update(null);
        cityInfoPanel.update(null);
      } else {
        tileInfoPanel.update(null);
        cityInfoPanel.update(null);
        unitInfoPanel.update(null);
      }
    });

    // 19. Starta turordningen — sist, efter att alla lyssnare kopplats
    turnManager.start();
  }

  update(_time: number, delta: number): void {
    this.cameraController.update(delta);
    this.debugHUD.update(
      this.cameraController.zoom,
      this.cameraController.scrollX,
      this.cameraController.scrollY,
    );
  }
}
