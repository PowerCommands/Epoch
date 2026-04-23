import Phaser from 'phaser';
import type { UnitActionMode, UnitActionToolbox, UnitActionViewState } from '../UnitActionToolbox';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const ACTION_SIZE = 64;
const ACTION_RADIUS = ACTION_SIZE / 2;
const ACTION_HIT_SIZE = 96;
const ACTION_SPACING = 10;
const CLUSTER_GAP = 12;

const ACTION_ICON_KEYS: Record<UnitActionMode, string> = {
  move: 'action_move',
  attack: 'action_attack',
  ranged: 'action_ranged_attack',
  sleep: 'action_sleep',
  build: 'action_improve',
  found: 'action_found_city',
  kill: 'action_attack',
};

interface ToolboxButtonView {
  state: UnitActionViewState;
  background: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Image;
  hitArea: Phaser.GameObjects.Zone;
  iconMask: Phaser.GameObjects.Graphics;
  hovered: boolean;
  pressed: boolean;
}

export class UnitActionHudToolbox {
  private readonly buttons: ToolboxButtonView[] = [];
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly toolbox: UnitActionToolbox,
    private readonly worldInputGate: WorldInputGate,
  ) {
    for (const state of this.toolbox.getHudActions()) {
      const background = addOwned(new Phaser.GameObjects.Arc(scene, 0, 0, ACTION_RADIUS, 0, 360, false, 0x12202d, 0.94))
        .setDepth(DEPTH + 1)
        .setScrollFactor(0)
        .setVisible(false);
      const ring = addOwned(new Phaser.GameObjects.Arc(scene, 0, 0, ACTION_RADIUS + 3, 0, 360, false, 0x000000, 0))
        .setDepth(DEPTH + 2)
        .setScrollFactor(0)
        .setStrokeStyle(2, 0x6f89a2, 0.35)
        .setVisible(false);

      const icon = addOwned(new Phaser.GameObjects.Image(scene, 0, 0, ACTION_ICON_KEYS[state.mode]))
        .setOrigin(0.5)
        .setDepth(DEPTH + 3)
        .setScrollFactor(0)
        .setDisplaySize(ACTION_SIZE, ACTION_SIZE)
        .setVisible(false);
      const iconMask = new Phaser.GameObjects.Graphics(scene);
      icon.setMask(iconMask.createGeometryMask());

      const hitArea = addOwned(new Phaser.GameObjects.Zone(scene, 0, 0, ACTION_HIT_SIZE, ACTION_HIT_SIZE))
        .setOrigin(0.5)
        .setDepth(DEPTH + 4)
        .setScrollFactor(0)
        .setVisible(false)
        .setInteractive({ useHandCursor: state.isAvailable });

      const button: ToolboxButtonView = {
        state,
        background,
        ring,
        icon,
        hitArea,
        iconMask,
        hovered: false,
        pressed: false,
      };

      hitArea.on(Phaser.Input.Events.POINTER_OVER, (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        button.hovered = true;
        this.refreshButtonVisual(button);
      });
      hitArea.on(Phaser.Input.Events.POINTER_OUT, (
        _pointer: Phaser.Input.Pointer,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        button.hovered = false;
        button.pressed = false;
        this.refreshButtonVisual(button);
      });
      hitArea.on(Phaser.Input.Events.POINTER_DOWN, (
        pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        if (!button.state.isAvailable || pointer.button !== 0) return;
        this.worldInputGate.claimPointer(pointer.id);
        button.pressed = true;
        consumePointerEvent(pointer);
        this.refreshButtonVisual(button);
      });
      hitArea.on(Phaser.Input.Events.POINTER_UP, (
        pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        consumePointerEvent(pointer);
        const shouldActivate = button.state.isAvailable && button.pressed;
        button.pressed = false;
        this.worldInputGate.releasePointer(pointer.id);
        if (shouldActivate) {
          this.toolbox.tryActivate(button.state.mode);
        }
        this.refreshButtonVisual(button);
      });

      this.buttons.push(button);
    }
  }

  refresh(): void {
    const states = this.toolbox.getHudActions();
    this.visible = this.toolbox.hasSelectedUnit();

    for (let index = 0; index < this.buttons.length; index += 1) {
      const button = this.buttons[index];
      button.state = states[index];
      const isVisible = this.visible;
      button.background.setVisible(isVisible);
      button.ring.setVisible(isVisible);
      button.icon.setVisible(isVisible);
      button.hitArea.setVisible(isVisible);
      button.hovered = isVisible ? button.hovered : false;
      button.pressed = isVisible ? button.pressed : false;
      button.hitArea.disableInteractive();
      if (isVisible) {
        button.hitArea.setInteractive({ useHandCursor: button.state.isAvailable });
        button.hitArea.input!.cursor = button.state.isAvailable ? 'pointer' : 'default';
      }
      this.refreshButtonVisual(button);
    }
  }

  layout(endTurnCenterX: number, endTurnCenterY: number, endTurnRadius: number): void {
    const totalWidth = this.buttons.length * ACTION_SIZE + (this.buttons.length - 1) * ACTION_SPACING;
    const startCenterX = endTurnCenterX - endTurnRadius - CLUSTER_GAP - totalWidth + ACTION_RADIUS;
    const centerY = endTurnCenterY;

    let centerX = startCenterX;
    for (const button of this.buttons) {
      button.background.setPosition(centerX, centerY).setRadius(ACTION_RADIUS);
      button.ring.setPosition(centerX, centerY).setRadius(ACTION_RADIUS + 3);
      button.icon.setPosition(centerX, centerY).setDisplaySize(ACTION_SIZE, ACTION_SIZE);
      button.hitArea.setPosition(centerX, centerY).setSize(ACTION_HIT_SIZE, ACTION_HIT_SIZE);
      button.iconMask.clear();
      button.iconMask.fillStyle(0xffffff, 1);
      button.iconMask.fillCircle(centerX, centerY, ACTION_RADIUS);
      centerX += ACTION_SIZE + ACTION_SPACING;
    }
  }

  destroy(): void {
    for (const button of this.buttons) {
      button.background.destroy();
      button.ring.destroy();
      button.icon.clearMask(true);
      button.icon.destroy();
      button.iconMask.destroy();
      button.hitArea.destroy();
    }
  }

  private refreshButtonVisual(button: ToolboxButtonView): void {
    const { isAvailable, isActive } = button.state;

    const fillColor = !isAvailable
      ? 0x1c2630
      : button.pressed
        ? 0x7c4e17
        : isActive
          ? 0xb6781f
          : button.hovered
            ? 0x244052
            : 0x132330;
    const strokeColor = isActive
      ? 0xf3d48d
      : !isAvailable
        ? 0x52606d
        : button.hovered
          ? 0x93bfdc
          : 0x6f89a2;
    const alpha = isAvailable ? 0.96 : 0.6;
    const scale = button.pressed ? 0.96 : button.hovered && isAvailable ? 1.04 : 1;

    button.background
      .setFillStyle(fillColor, alpha)
      .setScale(scale);
    button.ring
      .setStrokeStyle(isActive ? 4 : button.hovered && isAvailable ? 3 : 2, strokeColor, isAvailable ? 0.95 : 0.4)
      .setScale(scale);
    button.icon
      .setScale(scale)
      .setAlpha(isAvailable ? 1 : 0.42)
      .setTint(isAvailable ? 0xffffff : 0x8d97a5);
  }
}
