import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { RafScheduler } from '../../utils/RafScheduler';
import type { UnitActionToolbox } from '../UnitActionToolbox';
import { EndTurnHudButton } from './EndTurnHudButton';
import type { NationHudDataProvider } from './NationHudDataProvider';
import { ResearchHudPanel } from './ResearchHudPanel';
import { TopResourceBar } from './TopResourceBar';
import { UnitActionHudToolbox } from './UnitActionHudToolbox';

interface HudLayerConfig {
  humanNationId: string | undefined;
  dataProvider: NationHudDataProvider;
  unitActionToolbox: UnitActionToolbox;
  worldInputGate: WorldInputGate;
  onEndTurn: () => void;
  onSelectResearch: (technologyId: string) => void;
}

export class HudLayer {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly owned = new Set<Phaser.GameObjects.GameObject>();
  private readonly onResize: () => void;
  private readonly onAddedToScene: (go: Phaser.GameObjects.GameObject) => void;
  private readonly scheduler = new RafScheduler();
  private readonly endTurnButton: EndTurnHudButton;
  private readonly topResourceBar: TopResourceBar;
  private readonly researchPanel: ResearchHudPanel;
  private readonly unitActionHudToolbox: UnitActionHudToolbox;
  private readonly handlePointerRelease = (pointer: Phaser.Input.Pointer): void => {
    this.config.worldInputGate.releasePointer(pointer.id);
  };
  private endTurnEnabled = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: HudLayerConfig,
  ) {
    this.uiCamera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);
    this.uiCamera.roundPixels = true;
    this.uiCamera.ignore(scene.children.list);

    this.onAddedToScene = (go) => {
      if (this.owned.has(go)) {
        scene.cameras.main.ignore(go);
      } else {
        this.uiCamera.ignore(go);
      }
    };
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);

    this.endTurnButton = new EndTurnHudButton(scene, (object) => this.addOwned(object), this.config.worldInputGate);
    this.endTurnButton.setOnClick(() => this.config.onEndTurn());

    this.topResourceBar = new TopResourceBar(scene, (object) => this.addOwned(object));

    this.researchPanel = new ResearchHudPanel(scene, (object) => this.addOwned(object));
    this.researchPanel.setOnSelectTechnology((technologyId) => this.config.onSelectResearch(technologyId));

    this.unitActionHudToolbox = new UnitActionHudToolbox(
      scene,
      (object) => this.addOwned(object),
      this.config.unitActionToolbox,
      this.config.worldInputGate,
    );
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerRelease);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerRelease);

    this.onResize = () => {
      this.uiCamera.setSize(scene.scale.width, scene.scale.height);
      this.layout();
    };
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);

    this.refresh();
  }

  setEndTurnEnabled(enabled: boolean): void {
    this.endTurnEnabled = enabled;
    this.endTurnButton.setEnabled(enabled);
  }

  refresh(): void {
    this.scheduler.schedule('refresh', () => this.refreshNow());
  }

  shutdown(): void {
    this.scheduler.cancel();
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerRelease);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerRelease);
    this.endTurnButton.destroy();
    this.topResourceBar.destroy();
    this.researchPanel.destroy();
    this.unitActionHudToolbox.destroy();
    this.config.worldInputGate.clearAll();
    this.owned.clear();
    this.scene.cameras.remove(this.uiCamera);
  }

  private refreshNow(): void {
    const nationId = this.config.humanNationId;
    if (!nationId) return;

    this.topResourceBar.setEntries(this.config.dataProvider.getResourceEntries(nationId));
    this.researchPanel.setState(this.config.dataProvider.getResearchState(nationId));
    this.unitActionHudToolbox.refresh();
    this.endTurnButton.setEnabled(this.endTurnEnabled);
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scene.scale;
    this.topResourceBar.layout();
    this.researchPanel.layout(width, height);
    this.endTurnButton.layout(width, height);
    const endTurnLayout = this.endTurnButton.getLayout();
    this.unitActionHudToolbox.layout(endTurnLayout.centerX, endTurnLayout.centerY, endTurnLayout.radius);
  }

  private addOwned<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.owned.add(object);
    this.scene.add.existing(object);
    return object;
  }
}
