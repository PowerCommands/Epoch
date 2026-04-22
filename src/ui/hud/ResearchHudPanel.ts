import Phaser from 'phaser';
import type { HudResearchState } from './NationHudDataProvider';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const EDGE_MARGIN = 16;
const TOGGLE_SIZE = 62;
const PANEL_WIDTH = 384;
const PANEL_INNER_PADDING = 20;
const LINE_HEIGHT = 29;
const BUTTON_HEIGHT = 34;
const BUTTON_GAP = 7;
const SECTION_GAP = 17;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

interface TechButtonView {
  id: string;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class ResearchHudPanel {
  private readonly addOwned: AddOwned;
  private readonly toggleBackground: Phaser.GameObjects.Rectangle;
  private readonly toggleIcon: Phaser.GameObjects.Text;
  private readonly toggleHitArea: Phaser.GameObjects.Zone;
  private readonly panelBackground: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly currentText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly scienceText: Phaser.GameObjects.Text;
  private readonly availableHeading: Phaser.GameObjects.Text;
  private readonly researchedHeading: Phaser.GameObjects.Text;
  private readonly researchedText: Phaser.GameObjects.Text;

  private readonly techButtons: TechButtonView[] = [];
  private collapsed = true;
  private state: HudResearchState = {
    currentName: 'None',
    progress: 0,
    cost: 0,
    sciencePerTurn: 0,
    available: [],
    researchedNames: [],
  };
  private hoveredToggle = false;
  private onSelectTechnology: ((techId: string) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
  ) {
    this.addOwned = addOwned;
    this.toggleBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, TOGGLE_SIZE, TOGGLE_SIZE, 0x0c141d, 0.92))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68a9d5, 0.72);
    this.toggleIcon = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '🔬', {
      fontFamily: 'sans-serif',
      fontSize: '31px',
      color: '#eef7ff',
    }))
      .setOrigin(0.5)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    this.toggleHitArea = addOwned(new Phaser.GameObjects.Zone(scene, 0, 0, TOGGLE_SIZE, TOGGLE_SIZE))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    this.panelBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_WIDTH, 100, 0x071017, 0.88))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x7fb4d5, 0.45);
    this.titleText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'Research', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#f2f7fb',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    this.currentText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#f2f7fb',
      wordWrap: { width: PANEL_WIDTH - (PANEL_INNER_PADDING * 2), useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    this.progressText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#c7d6e5',
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    this.scienceText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#8fd0ff',
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    this.availableHeading = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'Available', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#88a6bd',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    this.researchedHeading = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'Researched', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#88a6bd',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    this.researchedText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#d5dde5',
      wordWrap: { width: PANEL_WIDTH - (PANEL_INNER_PADDING * 2), useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);

    this.toggleHitArea.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.hoveredToggle = true;
      this.refreshToggleState();
    });
    this.toggleHitArea.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.hoveredToggle = false;
      this.refreshToggleState();
    });
    this.toggleHitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return;
      pointer.event.stopPropagation();
      this.collapsed = !this.collapsed;
      this.layout(this.scene.scale.width, this.scene.scale.height);
      this.refreshToggleState();
    });

    this.refreshToggleState();
  }

  setState(state: HudResearchState): void {
    this.state = state;
    this.currentText.setText(`Current: ${state.currentName}`);
    this.progressText.setText(`Progress: ${state.progress} / ${state.cost}`);
    this.scienceText.setText(`Science: +${state.sciencePerTurn}/turn`);
    this.researchedText.setText(state.researchedNames.length > 0 ? state.researchedNames.join(', ') : 'None');
    this.rebuildTechButtons();
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  setOnSelectTechnology(handler: (techId: string) => void): void {
    this.onSelectTechnology = handler;
  }

  layout(viewportWidth: number, viewportHeight: number): void {
    const toggleX = EDGE_MARGIN;
    const toggleY = EDGE_MARGIN + 46;
    this.toggleBackground.setPosition(Math.round(toggleX), Math.round(toggleY));
    this.toggleIcon.setPosition(Math.round(toggleX + (TOGGLE_SIZE / 2)), Math.round(toggleY + (TOGGLE_SIZE / 2)));
    this.toggleHitArea.setPosition(Math.round(toggleX), Math.round(toggleY)).setSize(TOGGLE_SIZE, TOGGLE_SIZE);

    const panelVisible = !this.collapsed;
    this.panelBackground.setVisible(panelVisible);
    this.titleText.setVisible(panelVisible);
    this.currentText.setVisible(panelVisible);
    this.progressText.setVisible(panelVisible);
    this.scienceText.setVisible(panelVisible);
    this.availableHeading.setVisible(panelVisible);
    this.researchedHeading.setVisible(panelVisible);
    this.researchedText.setVisible(panelVisible);

    const panelX = EDGE_MARGIN;
    const panelY = toggleY + TOGGLE_SIZE + 12;
    const innerX = panelX + PANEL_INNER_PADDING;
    let cursorY = panelY + 18;

    this.titleText.setPosition(Math.round(innerX), Math.round(cursorY));
    cursorY += LINE_HEIGHT + 5;

    this.currentText.setPosition(Math.round(innerX), Math.round(cursorY));
    cursorY += this.currentText.height + 8;

    this.progressText.setPosition(Math.round(innerX), Math.round(cursorY));
    cursorY += LINE_HEIGHT;

    this.scienceText.setPosition(Math.round(innerX), Math.round(cursorY));
    cursorY += LINE_HEIGHT + SECTION_GAP;

    this.availableHeading.setPosition(Math.round(innerX), Math.round(cursorY));
    cursorY += LINE_HEIGHT;

    for (const button of this.techButtons) {
      button.background.setVisible(panelVisible);
      button.label.setVisible(panelVisible);
      button.background
        .setPosition(Math.round(innerX), Math.round(cursorY))
        .setDisplaySize(PANEL_WIDTH - (PANEL_INNER_PADDING * 2), BUTTON_HEIGHT);
      button.label.setPosition(Math.round(innerX + 12), Math.round(cursorY + (BUTTON_HEIGHT / 2)));
      cursorY += BUTTON_HEIGHT + BUTTON_GAP;
    }

    if (this.techButtons.length === 0) {
      cursorY += 4;
    }

    cursorY += SECTION_GAP - BUTTON_GAP;
    this.researchedHeading.setPosition(Math.round(innerX), Math.round(cursorY));
    cursorY += LINE_HEIGHT;

    this.researchedText.setPosition(Math.round(innerX), Math.round(cursorY));
    cursorY += this.researchedText.height + 20;

    const panelHeight = Math.min(cursorY - panelY, viewportHeight - panelY - EDGE_MARGIN);
    this.panelBackground
      .setPosition(Math.round(panelX), Math.round(panelY))
      .setDisplaySize(PANEL_WIDTH, Math.max(150, Math.round(panelHeight)));
  }

  destroy(): void {
    this.toggleBackground.destroy();
    this.toggleIcon.destroy();
    this.toggleHitArea.destroy();
    this.panelBackground.destroy();
    this.titleText.destroy();
    this.currentText.destroy();
    this.progressText.destroy();
    this.scienceText.destroy();
    this.availableHeading.destroy();
    this.researchedHeading.destroy();
    this.researchedText.destroy();
    this.destroyTechButtons();
  }

  private rebuildTechButtons(): void {
    this.destroyTechButtons();
    for (const tech of this.state.available) {
      const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, PANEL_WIDTH - (PANEL_INNER_PADDING * 2), BUTTON_HEIGHT, 0x153343, 0.96))
        .setOrigin(0, 0)
        .setDepth(DEPTH + 1)
        .setScrollFactor(0)
        .setStrokeStyle(1, 0x6fb2d4, 0.5)
        .setInteractive({ useHandCursor: true });
      const label = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, `${tech.name} (${tech.cost})`, {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: '#ddf2ff',
      }))
        .setOrigin(0, 0.5)
        .setDepth(DEPTH + 2)
        .setScrollFactor(0)
        .setResolution(HUD_TEXT_RESOLUTION);

      background.on(Phaser.Input.Events.POINTER_OVER, () => background.setFillStyle(0x1d495e, 1));
      background.on(Phaser.Input.Events.POINTER_OUT, () => background.setFillStyle(0x153343, 0.96));
      background.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
        if (pointer.button !== 0) return;
        pointer.event.stopPropagation();
        this.onSelectTechnology?.(tech.id);
      });

      this.techButtons.push({ id: tech.id, background, label });
    }
  }

  private destroyTechButtons(): void {
    for (const button of this.techButtons) {
      button.background.destroy();
      button.label.destroy();
    }
    this.techButtons.length = 0;
  }

  private refreshToggleState(): void {
    this.toggleBackground
      .setFillStyle(this.hoveredToggle ? 0x15303f : 0x0c141d, 0.94)
      .setStrokeStyle(2, this.collapsed ? 0x68a9d5 : 0x9ed7ff, this.hoveredToggle ? 0.95 : 0.72);
  }
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
