import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const END_TURN_SIZE = 128;
const END_TURN_RADIUS = END_TURN_SIZE / 2;
const HUD_MARGIN = 20;

export class EndTurnHudButton {
  private readonly background: Phaser.GameObjects.Arc;
  private readonly rim: Phaser.GameObjects.Arc;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly hitArea: Phaser.GameObjects.Arc;
  private readonly spriteMask: Phaser.GameObjects.Graphics;

  private enabled = true;
  private hovered = false;
  private pressed = false;
  private clickHandler: (() => void) | null = null;
  private centerX = 0;
  private centerY = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
  ) {
    this.background = addOwned(new Phaser.GameObjects.Arc(scene, 0, 0, END_TURN_RADIUS, 0, 360, false, 0x0f1824, 0.96))
      .setDepth(DEPTH)
      .setScrollFactor(0);

    this.rim = addOwned(new Phaser.GameObjects.Arc(scene, 0, 0, END_TURN_RADIUS + 4, 0, 360, false, 0x000000, 0))
      .setDepth(DEPTH + 1)
      .setStrokeStyle(4, 0xf2d38b, 0.9)
      .setScrollFactor(0);

    this.sprite = addOwned(new Phaser.GameObjects.Image(scene, 0, 0, 'end_turn'))
      .setDepth(DEPTH + 2)
      .setScrollFactor(0);
    this.spriteMask = new Phaser.GameObjects.Graphics(scene);
    this.sprite.setMask(this.spriteMask.createGeometryMask());

    this.hitArea = addOwned(new Phaser.GameObjects.Arc(scene, 0, 0, END_TURN_RADIUS, 0, 360, false, 0x000000, 0.001))
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setInteractive(new Phaser.Geom.Circle(0, 0, END_TURN_RADIUS), Phaser.Geom.Circle.Contains)
      .setOrigin(0.5);

    this.hitArea.on(Phaser.Input.Events.POINTER_OVER, (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (!this.enabled) return;
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
      if (!this.enabled || pointer.button !== 0) return;
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
      const shouldClick = this.enabled && this.pressed;
      this.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      if (shouldClick) {
        this.clickHandler?.();
      }
      this.refreshVisualState();
    });

    this.refreshVisualState();
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.hovered = false;
      this.pressed = false;
    }
    this.hitArea.disableInteractive();
    if (enabled) {
      this.hitArea.setInteractive(new Phaser.Geom.Circle(0, 0, END_TURN_RADIUS), Phaser.Geom.Circle.Contains, true);
      this.hitArea.input!.cursor = 'pointer';
    }
    this.refreshVisualState();
  }

  setOnClick(handler: () => void): void {
    this.clickHandler = handler;
  }

  layout(viewportWidth: number, viewportHeight: number): void {
    const x = viewportWidth - HUD_MARGIN - END_TURN_RADIUS;
    const y = viewportHeight - HUD_MARGIN - END_TURN_RADIUS;
    this.centerX = x;
    this.centerY = y;

    this.background.setPosition(x, y).setRadius(END_TURN_RADIUS);
    this.rim.setPosition(x, y).setRadius(END_TURN_RADIUS + 4);
    this.sprite.setPosition(x, y).setDisplaySize(END_TURN_SIZE, END_TURN_SIZE);
    this.hitArea.setPosition(x, y).setRadius(END_TURN_RADIUS);
    this.spriteMask.clear();
    this.spriteMask.fillStyle(0xffffff, 1);
    this.spriteMask.fillCircle(x, y, END_TURN_RADIUS);

    this.refreshVisualState();
  }

  getLayout(): { centerX: number; centerY: number; radius: number } {
    return {
      centerX: this.centerX,
      centerY: this.centerY,
      radius: END_TURN_RADIUS,
    };
  }

  destroy(): void {
    this.background.destroy();
    this.rim.destroy();
    this.sprite.clearMask(true);
    this.sprite.destroy();
    this.spriteMask.destroy();
    this.hitArea.destroy();
  }

  private refreshVisualState(): void {
    const fillColor = !this.enabled
      ? 0x2a2f38
      : this.pressed
        ? 0x8f5d19
        : this.hovered
          ? 0xc07a1e
          : 0xa96a1b;

    const fillAlpha = this.enabled ? 0.98 : 0.58;
    const scale = this.pressed ? 0.95 : this.hovered ? 1.04 : 1;

    this.background.setFillStyle(fillColor, fillAlpha).setScale(scale);
    this.rim
      .setStrokeStyle(this.hovered ? 5 : 4, this.enabled ? 0xf4dfaa : 0x767c88, this.enabled ? 0.95 : 0.45)
      .setScale(scale);
    this.sprite
      .setScale(scale)
      .setAlpha(this.enabled ? 1 : 0.55)
      .setTint(this.enabled ? 0xffffff : 0x8e97a5);
  }
}
