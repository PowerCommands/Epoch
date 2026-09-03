import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import type { MapLensMode } from '../../types/mapLens';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const BUTTON_RADIUS = 22;
const HIT_SIZE = BUTTON_RADIUS * 2 + 8;
const BUTTON_GAP = 8;
const EDGE_MARGIN = 16;
const LABEL_FONT_SIZE = '20px';
const CULTURE_LABEL = '\u{1F3AD}';
const RESOURCE_LABEL = '\u{1F48E}';

const FILL_NORMAL = 0x101a26;
const FILL_HOVER = 0x1c2c3f;
const FILL_ACTIVE = 0x4b3c1d;
const FILL_ACTIVE_HOVER = 0x6a5526;
const STROKE_INACTIVE = 0xd8e2ee;
const STROKE_ACTIVE = 0xf2d38b;

/**
 * Compact HUD controls for the culture and discovered-resource map lenses.
 * They live on the same dedicated UI camera as the rest of the HUD
 * as the rest of the screen-space HUD; consumes pointer events so map
 * input (selection, drag) is not triggered when clicking the button.
 */
export class MapLensToggleHud {
  private readonly background: Phaser.GameObjects.Arc;
  private readonly border: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text;
  private readonly hitArea: Phaser.GameObjects.Zone;
  private readonly resourceBackground: Phaser.GameObjects.Arc;
  private readonly resourceBorder: Phaser.GameObjects.Arc;
  private readonly resourceLabel: Phaser.GameObjects.Text;
  private readonly resourceHitArea: Phaser.GameObjects.Zone;

  private mode: MapLensMode = 'normal';
  private hovered = false;
  private pressed = false;
  private resourceHovered = false;
  private resourcePressed = false;
  private toggleHandler: (() => void) | null = null;
  private resourceToggleHandler: (() => void) | null = null;
  private bottomOffset = EDGE_MARGIN;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
  ) {
    this.background = addOwned(new Phaser.GameObjects.Arc(scene, 0, 0, BUTTON_RADIUS, 0, 360, false, FILL_NORMAL, 0.92))
      .setDepth(DEPTH)
      .setScrollFactor(0);

    this.border = addOwned(new Phaser.GameObjects.Arc(scene, 0, 0, BUTTON_RADIUS + 2, 0, 360, false, 0x000000, 0))
      .setDepth(DEPTH + 1)
      .setStrokeStyle(2, STROKE_INACTIVE, 0.85)
      .setScrollFactor(0);

    this.label = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, CULTURE_LABEL, {
      fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif',
      fontSize: LABEL_FONT_SIZE,
      color: '#ffffff',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0);

    this.hitArea = addOwned(new Phaser.GameObjects.Zone(scene, 0, 0, HIT_SIZE, HIT_SIZE))
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.resourceBackground = addOwned(new Phaser.GameObjects.Arc(scene, 0, 0, BUTTON_RADIUS, 0, 360, false, FILL_NORMAL, 0.92))
      .setDepth(DEPTH)
      .setScrollFactor(0);
    this.resourceBorder = addOwned(new Phaser.GameObjects.Arc(scene, 0, 0, BUTTON_RADIUS + 2, 0, 360, false, 0x000000, 0))
      .setDepth(DEPTH + 1)
      .setStrokeStyle(2, STROKE_INACTIVE, 0.85)
      .setScrollFactor(0);
    this.resourceLabel = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, RESOURCE_LABEL, {
      fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif',
      fontSize: LABEL_FONT_SIZE,
      color: '#ffffff',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0);
    this.resourceHitArea = addOwned(new Phaser.GameObjects.Zone(scene, 0, 0, HIT_SIZE, HIT_SIZE))
      .setName('resource-map-lens')
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.hitArea.on(Phaser.Input.Events.POINTER_OVER, (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.hovered = true;
      this.refreshVisualState();
    });
    this.hitArea.on(Phaser.Input.Events.POINTER_OUT, (
      _pointer: Phaser.Input.Pointer,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.hovered = false;
      this.pressed = false;
      this.refreshVisualState();
    });
    this.hitArea.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      this.pressed = true;
      consumePointerEvent(pointer);
      this.refreshVisualState();
    });
    this.hitArea.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldFire = this.pressed;
      this.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      if (shouldFire) {
        this.toggleHandler?.();
      }
      this.refreshVisualState();
    });

    this.resourceHitArea.on(Phaser.Input.Events.POINTER_OVER, (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.resourceHovered = true;
      this.refreshVisualState();
    });
    this.resourceHitArea.on(Phaser.Input.Events.POINTER_OUT, (
      _pointer: Phaser.Input.Pointer,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.resourceHovered = false;
      this.resourcePressed = false;
      this.refreshVisualState();
    });
    this.resourceHitArea.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      this.resourcePressed = true;
      consumePointerEvent(pointer);
      this.refreshVisualState();
    });
    this.resourceHitArea.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldFire = this.resourcePressed;
      this.resourcePressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      if (shouldFire) this.resourceToggleHandler?.();
      this.refreshVisualState();
    });

    this.refreshVisualState();
  }

  setOnToggle(handler: () => void): void {
    this.toggleHandler = handler;
  }

  setOnResourceToggle(handler: () => void): void {
    this.resourceToggleHandler = handler;
  }

  setMode(mode: MapLensMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.refreshVisualState();
  }

  /**
   * Lay out at the bottom-left corner, leaving room for the minimap
   * directly below. Caller passes the height that should be reserved
   * below the button (typically the minimap panel height plus margin).
   */
  layout(viewportHeight: number, bottomReserved: number): void {
    this.bottomOffset = bottomReserved + EDGE_MARGIN;
    const x = EDGE_MARGIN + BUTTON_RADIUS;
    const resourceX = x + BUTTON_RADIUS * 2 + BUTTON_GAP;
    const y = viewportHeight - this.bottomOffset - BUTTON_RADIUS;
    this.background.setPosition(x, y);
    this.border.setPosition(x, y);
    this.label.setPosition(x, y);
    this.hitArea.setPosition(x, y);
    this.resourceBackground.setPosition(resourceX, y);
    this.resourceBorder.setPosition(resourceX, y);
    this.resourceLabel.setPosition(resourceX, y);
    this.resourceHitArea.setPosition(resourceX, y);
  }

  destroy(): void {
    this.hitArea.destroy();
    this.label.destroy();
    this.border.destroy();
    this.background.destroy();
    this.resourceHitArea.destroy();
    this.resourceLabel.destroy();
    this.resourceBorder.destroy();
    this.resourceBackground.destroy();
  }

  private refreshVisualState(): void {
    const isActive = this.mode === 'culture';
    const baseFill = isActive ? FILL_ACTIVE : FILL_NORMAL;
    const hoverFill = isActive ? FILL_ACTIVE_HOVER : FILL_HOVER;
    const fillColor = this.pressed
      ? hoverFill
      : this.hovered
        ? hoverFill
        : baseFill;
    const scale = this.pressed ? 0.94 : this.hovered ? 1.05 : 1;

    this.background.setFillStyle(fillColor, 0.95).setScale(scale);
    this.border
      .setStrokeStyle(this.hovered ? 3 : 2, isActive ? STROKE_ACTIVE : STROKE_INACTIVE, 0.92)
      .setScale(scale);
    this.label.setScale(scale);

    const resourceActive = this.mode === 'resources';
    const resourceBaseFill = resourceActive ? FILL_ACTIVE : FILL_NORMAL;
    const resourceHoverFill = resourceActive ? FILL_ACTIVE_HOVER : FILL_HOVER;
    const resourceFill = this.resourcePressed || this.resourceHovered ? resourceHoverFill : resourceBaseFill;
    const resourceScale = this.resourcePressed ? 0.94 : this.resourceHovered ? 1.05 : 1;
    this.resourceBackground.setFillStyle(resourceFill, 0.95).setScale(resourceScale);
    this.resourceBorder
      .setStrokeStyle(this.resourceHovered ? 3 : 2, resourceActive ? STROKE_ACTIVE : STROKE_INACTIVE, 0.92)
      .setScale(resourceScale);
    this.resourceLabel.setScale(resourceScale);
  }
}
